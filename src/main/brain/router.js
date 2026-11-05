// @ts-check
// Routing rules (BRAIN-1, BRAIN-3, BRAIN-4). Pure: decides where a message goes; brain/index.js does it.

/**
 * @typedef {'auto'|'chat'|'code'} ChatMode     auto = lite brain answers and escalates real work
 * @typedef {'claude'|'agy'|'auto'} CodeEngine  auto = Claude unless tight, then agy (BRAIN-4)
 * @typedef {{ target: 'lite'|'worker', engine?: 'claude'|'agy', text: string, slash?: boolean }} Route
 */

const PREFIX = /^@(claude|agy|code|chat)\b\s*/i;

/**
 * @param {string} raw @param {{ chatMode: ChatMode }} cfg
 * @returns {Route | null}
 */
function parseInput(raw, cfg) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (text.startsWith('/')) return { target: 'worker', text, slash: true }; // /init, /compact, skills… → coding agent
  const m = PREFIX.exec(text);
  if (m) {
    const rest = text.slice(m[0].length);
    const tag = m[1].toLowerCase();
    if (tag === 'chat') return { target: 'lite', text: rest };
    if (tag === 'code') return { target: 'worker', text: rest };
    return { target: 'worker', engine: /** @type {'claude'|'agy'} */ (tag), text: rest };
  }
  if (cfg.chatMode === 'code') return { target: 'worker', text };
  return { target: 'lite', text }; // chat + auto; auto may escalate after the lite reply
}

/**
 * Pick the coding engine for a worker turn.
 * @param {{
 *   explicit?: 'claude'|'agy', slash?: boolean, codeEngine: CodeEngine,
 *   available: { claude: boolean, agy: boolean },
 *   claudeTight: { tight: boolean, reason: string },
 * }} s
 * @returns {{ engine: 'claude'|'agy', notice?: string } | { error: string }}
 */
function pickWorker(s) {
  // agy is read-only (plan & review, D-027): fine in any folder, but it can't make edits.
  const agyOk = s.available.agy;
  const agyWhyNot = 'agy is not installed';
  if (s.slash) {
    // Slash commands belong to whichever agent understands them; Claude Code's are the documented ones.
    if (s.available.claude) return { engine: 'claude' };
    return agyOk ? { engine: 'agy' } : { error: 'No coding agent available (install/log in to Claude Code or agy).' };
  }
  const want = s.explicit || (s.codeEngine === 'agy' ? 'agy' : 'claude');
  if (want === 'agy') {
    if (agyOk) return { engine: 'agy' };
    if (s.available.claude) return { engine: 'claude', notice: `${agyWhyNot}; using Claude Code instead.` };
    return { error: `${agyWhyNot}, and Claude Code isn't available.` };
  }
  // want claude
  if (!s.available.claude) {
    return agyOk ? { engine: 'agy', notice: 'Claude Code is not available; using agy.' } : { error: `Claude Code is not available and ${agyWhyNot}.` };
  }
  if (!s.explicit && s.codeEngine === 'auto' && s.claudeTight.tight && agyOk) {
    return { engine: 'agy', notice: `Claude is resting (${s.claudeTight.reason}); agy will review and plan this (read-only). Edits need Claude: /budget or try later~` };
  }
  return { engine: 'claude' };
}

module.exports = { parseInput, pickWorker };
