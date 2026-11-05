// @ts-check
// Engine host: exposes the active engine on the bus and remembers its settings in device.json.
// M0 has one engine (Claude Code). M3 adds AgyEngine, the router and PermissionGate (BRAIN-1, SAFE-1);
// until then permission answers come straight from the terminal via ENGINE_ANSWER_PERMISSION.
const fs = require('fs');
const path = require('path');
const { TOPICS } = require('../bus-topics');
const { ClaudeCodeEngine } = require('./claude/session');

/**
 * @param {{
 *   bus: import('../bus').BusInstance,
 *   device: import('../platform/store/device').DeviceSettings,
 *   tamaName: string,
 * }} deps
 */
function createEngineHost({ bus, device, tamaName }) {
  const emit = (/** @type {any} */ ev) => {
    bus.emit(TOPICS.ENGINE_EVENT, { engine: 'claude', ev });
    if (ev.t === 'session') saveDevice({ lastSessionId: ev.sessionId });
  };
  const engine = new ClaudeCodeEngine(emit, { tamaName });

  const saved = () => device.get().engine || {};
  /** @param {Record<string, any>} patch */
  const saveDevice = (patch) => device.patch('engine', patch);

  /** @param {string} dir */
  function setCwd(dir) {
    let resolved = dir;
    if (engine.cwd && !path.isAbsolute(dir)) resolved = path.resolve(engine.cwd, dir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return { error: `Not a folder: ${resolved}` };
    engine.setCwd(resolved);
    saveDevice({ cwd: resolved });
    const ev = { t: 'cwd', cwd: resolved, isGit: fs.existsSync(path.join(resolved, '.git')) };
    emit(ev);
    return ev;
  }

  const offs = /** @type {Array<() => void>} */ ([]);

  function start() {
    const s = saved();
    if (s.cwd && fs.existsSync(s.cwd)) engine.cwd = s.cwd;
    if (s.mode) engine.mode = s.mode;
    if (s.model) engine.model = s.model;

    offs.push(
      bus.handle(TOPICS.ENGINE_INFO, () => ({
        cwd: engine.cwd, mode: engine.mode, model: engine.model, busy: engine.busy,
        lastSessionId: saved().lastSessionId || null, totalCost: engine.totalCost, commands: engine.commands,
      })),
      bus.handle(TOPICS.ENGINE_SEND, (/** @type {string} */ text) => engine.send(text)),
      bus.handle(TOPICS.ENGINE_INTERRUPT, () => engine.interrupt()),
      bus.handle(TOPICS.ENGINE_CLEAR, () => {
        engine.stop(); engine.sessionId = null; engine.totalCost = 0; emit({ t: 'cleared' });
      }),
      bus.handle(TOPICS.ENGINE_SET_MODE, (/** @type {string} */ m) => { engine.setMode(m); saveDevice({ mode: m }); }),
      bus.handle(TOPICS.ENGINE_SET_MODEL, (/** @type {string|null} */ m) => { engine.setModel(m); saveDevice({ model: m || null }); }),
      bus.handle(TOPICS.ENGINE_SET_CWD, setCwd),
      bus.handle(TOPICS.ENGINE_ANSWER_PERMISSION, (/** @type {any} */ a) => engine.answerPermission(a.id, a.choice, a.feedback)),
      bus.handle(TOPICS.ENGINE_RESUME, async (/** @type {string|null} */ id) => {
        const sid = id || saved().lastSessionId;
        if (!sid) return { error: 'No previous session to resume.' };
        if (!engine.cwd) return { error: 'Pick a project folder first (/cd).' };
        await engine.resume(sid);
        return { ok: true };
      }),
    );
  }

  function stop() {
    for (const off of offs.splice(0)) off();
    engine.stop();
  }

  return { start, stop };
}

module.exports = { createEngineHost };
