// @ts-check
// PermissionGate (SAFE-1): the ONE place where tool approvals are decided, for every engine and channel.
// - role 'lite' (chat brain): every tool request is denied automatically (D-026).
// - role 'worker': the request is shown to the user (terminal now, Telegram in M7) and waits for an answer.
// - "Always" answers are remembered for the rest of that engine session only.
// Bond level never changes any of this (BOND-4).
const { TOPICS } = require('../bus-topics');

/**
 * @typedef {{ name: string, title?: string, kind?: string, input?: any, reason?: string }} ToolAsk
 * @typedef {{ choice: 'yes'|'always'|'no', feedback?: string }} Decision
 */

/** @param {{ bus: import('../bus').BusInstance }} deps */
function createPermissionGate({ bus }) {
  let seq = 0;
  /** @type {Map<number, { engine: string, role: string, sessionKey: string, key: string, resolve: (d: Decision) => void }>} */
  const pending = new Map();
  /** "engine|session|tool-key" → always allowed */
  const always = new Set();

  /** @param {string} engine @param {string} role @param {any} ev */
  const emit = (engine, role, ev) => bus.emit(TOPICS.ENGINE_EVENT, { engine, role, ev });
  /** @param {ToolAsk} t */
  const toolKey = (t) => (t.kind && t.kind !== 'other' ? `kind:${t.kind}` : `name:${t.name}`);

  /**
   * @param {{ engine: string, role: 'lite'|'worker', sessionKey: string, tool: ToolAsk }} req
   * @returns {Promise<Decision>}
   */
  function request({ engine, role, sessionKey, tool }) {
    if (role !== 'worker') {
      emit(engine, role, { t: 'info', text: `⎿  (chat brain can't use tools; denied ${tool.name})` });
      return Promise.resolve({ choice: 'no', feedback: 'You are in chat mode and cannot use tools. Answer in words, or reply with [[ESCALATE]] if real work is needed.' });
    }
    const key = `${engine}|${sessionKey}|${toolKey(tool)}`;
    if (always.has(key)) return Promise.resolve({ choice: 'yes' });
    const id = ++seq;
    return new Promise((resolve) => {
      pending.set(id, { engine, role, sessionKey, key, resolve });
      emit(engine, role, { t: 'status', state: 'permission' });
      emit(engine, role, { t: 'permission', id, name: tool.title || tool.name, tool: tool.name, kind: tool.kind, input: tool.input, reason: tool.reason });
    });
  }

  /** @param {number} id @param {'yes'|'always'|'no'} choice @param {string} [feedback] */
  function answer(id, choice, feedback) {
    const p = pending.get(id);
    if (!p) return false;
    pending.delete(id);
    if (choice === 'always') always.add(p.key);
    p.resolve(choice === 'yes' || choice === 'always' ? { choice } : { choice: 'no', feedback: feedback || undefined });
    emit(p.engine, p.role, { t: 'permission-done', id, choice });
    emit(p.engine, p.role, { t: 'status', state: 'thinking' });
    return true;
  }

  /** Deny everything still waiting for an engine (interrupt / stop / session reset). @param {string} engine @param {string} [reason] */
  function cancelAll(engine, reason = 'Interrupted.') {
    for (const [id, p] of [...pending]) {
      if (p.engine !== engine) continue;
      pending.delete(id);
      p.resolve({ choice: 'no', feedback: reason });
      emit(p.engine, p.role, { t: 'permission-done', id });
    }
  }

  /** Forget "always" answers for one engine session (new conversation). @param {string} engine @param {string} sessionKey */
  function resetSession(engine, sessionKey) {
    for (const k of [...always]) if (k.startsWith(`${engine}|${sessionKey}|`)) always.delete(k);
  }

  return { request, answer, cancelAll, resetSession, pendingCount: () => pending.size };
}

/** @typedef {ReturnType<typeof createPermissionGate>} PermissionGate */

module.exports = { createPermissionGate };
