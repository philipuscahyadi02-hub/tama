// @ts-check
// Claude plan limits on demand (USE-5, D-041): opens a Claude Code session WITHOUT sending a message (no model call, $0)
// and asks for the structured /usage data. The SDK marks this API experimental, so every failure returns null and the
// app falls back to the rate-limit events that arrive with each turn.
const path = require('path');
const { pathToFileURL } = require('url');
const { CLAUDE_EXE } = require('./session');

const SDK_URL = pathToFileURL(
  path.join(__dirname, '..', '..', '..', '..', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs')
    .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`),
).href;
const TIMEOUT_MS = 30000;

/**
 * Normalize the /usage answer to Tama's limit shape. Pure. `used` is 0..1.
 * @param {any} r
 * @returns {{ subscription: string | null, windows: Record<string, { used: number, resetsAt: number | null }>,
 *   extra: { enabled: boolean, usedUsd: number | null } | null, breakdown: Array<{ name: string, percent: number }> } | null}
 */
function normalizeUsage(r) {
  if (!r || !r.rate_limits_available || !r.rate_limits) return null;
  /** @type {Record<string, { used: number, resetsAt: number | null }>} */
  const windows = {};
  for (const [k, v] of Object.entries(r.rate_limits)) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || typeof (/** @type {any} */ (v).utilization) !== 'number') continue;
    const w = /** @type {any} */ (v);
    windows[k] = { used: Math.max(0, Math.min(1, w.utilization / 100)), resetsAt: w.resets_at ? Date.parse(w.resets_at) : null };
  }
  for (const m of r.rate_limits.model_scoped || []) {
    if (m && typeof m.utilization === 'number') windows[`model:${m.display_name}`] = { used: Math.max(0, Math.min(1, m.utilization / 100)), resetsAt: m.resets_at ? Date.parse(m.resets_at) : null };
  }
  const ex = r.rate_limits.extra_usage;
  const extra = ex ? { enabled: !!ex.is_enabled, usedUsd: typeof ex.used_credits === 'number' ? ex.used_credits / Math.pow(10, ex.decimal_places || 2) : null } : null;
  const br = r.rate_limits.seven_day_breakdown;
  const breakdown = br && Array.isArray(br.rows) ? br.rows.map((/** @type {any} */ x) => ({ name: x.display_name, percent: x.percent })) : [];
  return { subscription: r.subscription_type || null, windows, extra, breakdown };
}

/** @returns {Promise<ReturnType<typeof normalizeUsage>>} */
async function fetchClaudeLimits() {
  if (!CLAUDE_EXE) return null;
  /** @type {any} */ let q = null;
  /** @type {() => void} */ let release = () => {};
  try {
    const { query } = await import(SDK_URL);
    const idle = new Promise((r) => { release = () => r(undefined); });
    async function* noMessages() { await idle; } // the session never gets a prompt
    q = query({ prompt: noMessages(), options: { model: 'haiku', pathToClaudeCodeExecutable: CLAUDE_EXE, settingSources: [], tools: [], persistSession: false, cwd: require('os').tmpdir() } });
    (async () => { for await (const _m of q) { /* drain */ } })().catch(() => {});
    const ask = q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET;
    if (typeof ask !== 'function') return null;
    const r = await Promise.race([ask.call(q, { skipBehaviors: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))]);
    return normalizeUsage(r);
  } catch {
    return null;
  } finally {
    release();
    try { if (q) q.close(); } catch { /* closed */ }
  }
}

/**
 * The rate-limit event that comes with each turn → the same shape (`unifiedWindows` holds both windows). Pure.
 * @param {any} info SDKRateLimitInfo
 */
function fromRateLimitEvent(info) {
  /** @type {Record<string, { used: number, resetsAt: number | null }>} */
  const windows = {};
  const sec = (/** @type {any} */ t) => (typeof t === 'number' ? (t < 1e12 ? t * 1000 : t) : null);
  if (info && info.unifiedWindows) {
    for (const [k, v] of Object.entries(info.unifiedWindows)) {
      const w = /** @type {any} */ (v);
      if (w && typeof w.utilization === 'number') windows[k] = { used: Math.max(0, Math.min(1, w.utilization)), resetsAt: sec(w.resetsAt) };
    }
  } else if (info && info.rateLimitType && typeof info.utilization === 'number') {
    windows[info.rateLimitType] = { used: Math.max(0, Math.min(1, info.utilization)), resetsAt: sec(info.resetsAt) };
  }
  return { windows, status: info ? info.status : null };
}

module.exports = { fetchClaudeLimits, normalizeUsage, fromRateLimitEvent };
