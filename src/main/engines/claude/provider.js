// @ts-check
// Claude Code as a provider (SHIP-8, D-054). Coding (the terminal) and structured output (the designer) by default;
// chat and moments only when the user opts in, because they spend Claude quota (D-029). For chat it runs the 'lite'
// profile: Haiku, no tools (the gate also denies every tool to non-worker roles), no user settings, not saved.

/**
 * @param {{ gate: import('../../brain/permission-gate').PermissionGate, tamaName: string,
 *   mcp: () => Array<{ name: string, tools: any[] }> }} deps
 * @returns {import('../../providers').Provider}
 */
function claudeProvider({ gate, tamaName, mcp }) {
  const { ClaudeCodeEngine, CLAUDE_EXE } = require('./session');
  const lite = (/** @type {(ev: any) => void} */ emit, /** @type {string} */ persona) => new ClaudeCodeEngine(emit, { role: 'lite', gate, persona });
  return {
    id: 'claude', name: 'Claude Code', model: 'haiku (chat) · your model (terminal)',
    available: () => !!CLAUDE_EXE,
    optIn: ['chat', 'compose'],
    features: { webSearch: false, googleTools: false },
    chat: lite,
    compose: lite,
    code: (emit) => new ClaudeCodeEngine(emit, { role: 'worker', gate, tamaName, mcp }),
    json: (req) => require('./oneshot').askJson(req),
  };
}

module.exports = { claudeProvider };
