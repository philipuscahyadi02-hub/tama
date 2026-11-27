// @ts-check
// agy (Antigravity CLI, Gemini) as a provider (SHIP-8, D-054): chat and moments. Always read-only plan mode with the
// workspace guard hook (D-027, D-037); it never offers `code` or `json`. The chat session gets web search and Tama's
// Google tools (through the MCP relay while Google is signed in); the composer gets no tools at all.
// The model per role is the user's pick from their agy account (D-086); empty = Gemini Flash with low thinking.
// When a model's allowance is used up, sessions move to a model with room until it resets (D-088).
const { DEFAULT_MODEL: MODEL, agyModelFor, createModelList } = require('./models');
const { switchModel, readAgyUsage } = require('./usage');

/**
 * @param {{
 *   gate: import('../../brain/permission-gate').PermissionGate, mcpServers: () => any[], picks?: () => any,
 *   quota?: () => any, autoSwitch?: () => boolean, usageDir?: string, now?: () => number,
 * }} deps
 *   picks: the user's model per capability ({ chat?, compose? }, providers.set `model`), read when a session starts.
 *   quota: the last allowance windows (Limits, D-088); autoSwitch: move off a used-up model; usageDir: where /usage runs.
 * @returns {import('../../providers').Provider}
 */
function agyProvider({ gate, mcpServers, picks = () => ({}), quota = () => ({}), autoSwitch = () => true, usageDir = '', now = Date.now }) {
  const { AgyEngine } = require('./session');
  const { findAgyExecutable, CHAT_ALLOW, DENY_ALL } = require('./setup');
  let exe = findAgyExecutable(); // looked up once per run; the setup wizard re-checks after an install (SHIP-4)
  const listModels = createModelList();
  const base = { role: /** @type {'lite'} */ ('lite'), gate, mode: /** @type {'plan'} */ ('plan'), lockMode: true };
  /** A picked model carries its own thinking level in its id, so only the default forces 'low'. @param {'chat'|'compose'} cap */
  const effective = (/** @type {'chat'|'compose'} */ cap) => switchModel({ wanted: agyModelFor(picks(), cap) || MODEL, windows: quota() || {}, models: listModels.known(), now: now(), autoSwitch: autoSwitch() });
  const modelOpts = (cap) => {
    const { model } = effective(cap);
    return model === MODEL ? { model, thoughtLevel: /** @type {'low'} */ ('low') } : { model };
  };
  return {
    id: 'agy', name: 'Gemini (Antigravity)', model: MODEL, defaultModel: MODEL,
    available: () => !!exe,
    recheck: () => !!(exe = findAgyExecutable()),
    features: { webSearch: true, googleTools: true },
    chat: (emit, persona) => new AgyEngine(emit, { ...base, ...modelOpts('chat'), persona, mcpServers, guard: CHAT_ALLOW, ownTools: true }),
    compose: (emit, persona) => new AgyEngine(emit, { ...base, ...modelOpts('compose'), persona, guard: DENY_ALL }),
    /** What the persona says powers her chat (a picked Claude model is not "Gemini"). */
    poweredBy: () => { const m = effective('chat').model; return m !== MODEL ? `the model ${m} via the Antigravity CLI` : 'Gemini via the Antigravity CLI'; },
    /** The model each capability runs right now, and whether it was moved off a used-up one (D-088). */
    effective: () => ({ chat: effective('chat'), compose: effective('compose') }),
    /** What is left of the Antigravity allowance (`agy -p /usage`, no model turn). */
    usage: () => readAgyUsage(exe, usageDir),
    /** The models this agy account offers (`agy models`), for Settings. @param {boolean} [fresh] */
    models: (fresh = false) => listModels(exe, fresh),
  };
}

module.exports = { agyProvider };
