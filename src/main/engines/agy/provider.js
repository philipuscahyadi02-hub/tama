// @ts-check
// agy (Antigravity CLI, Gemini) as a provider (SHIP-8, D-054): chat and moments. Always read-only plan mode with the
// workspace guard hook (D-027, D-037); it never offers `code` or `json`. The chat session gets web search and Tama's
// Google tools (through the MCP relay while Google is signed in); the composer gets no tools at all.

const MODEL = 'gemini-3.8-flash-low';

/**
 * @param {{ gate: import('../../brain/permission-gate').PermissionGate, mcpServers: () => any[] }} deps
 * @returns {import('../../providers').Provider}
 */
function agyProvider({ gate, mcpServers }) {
  const { AgyEngine } = require('./session');
  const { findAgyExecutable, CHAT_ALLOW, DENY_ALL } = require('./setup');
  const exe = findAgyExecutable(); // looked up once per run, like before; the setup wizard re-checks (SHIP-4)
  const base = { role: /** @type {'lite'} */ ('lite'), gate, model: MODEL, thoughtLevel: /** @type {'low'} */ ('low'), mode: /** @type {'plan'} */ ('plan'), lockMode: true };
  return {
    id: 'agy', name: 'Gemini (Antigravity)', model: MODEL,
    available: () => !!exe,
    features: { webSearch: true, googleTools: true },
    chat: (emit, persona) => new AgyEngine(emit, { ...base, persona, mcpServers, guard: CHAT_ALLOW }),
    compose: (emit, persona) => new AgyEngine(emit, { ...base, persona, guard: DENY_ALL }),
  };
}

module.exports = { agyProvider };
