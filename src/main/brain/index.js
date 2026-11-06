// @ts-check
// The brain: owns the engines (BRAIN-1..5, ENG-1..5, SAFE-1, SAFE-5). Two separate surfaces (D-029):
//   terminal = Claude Code only (coding, productivity work; asks before tools)
//   chat     = agy only (talk + web search with your Tama; read-only plan mode, D-027), see ./chat.js
// It answers the terminal's engine.* requests and emits every terminal event as { engine, role, ev } on engine.event.
const fs = require('fs');
const path = require('path');
const { TOPICS } = require('../bus-topics');
const persona = require('./persona');
const budget = require('./budget');
const { createChat } = require('./chat');
const { createComposer } = require('./compose');

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

/** @typedef {{ cwd: string|null, mode: string, model: string|null, busy: boolean, sessionId: string|null, totalCost: number,
 *   commands: any[], setCwd: (d: string) => void, setMode: (m: string) => any, setModel: (m: string|null) => any,
 *   send: (t: string) => any, interrupt: () => any, stop: () => void, setPersona?: (p: string) => void, resume?: (id: string) => any,
 *   effort?: string|null, setEffort?: (e: string|null) => any }} Engine */

/**
 * @param {{
 *   bus: import('../bus').BusInstance,
 *   device: import('../platform/store/device').DeviceSettings,
 *   gate: import('./permission-gate').PermissionGate,
 *   scratchDir: string,
 *   git: { isRepo: (d: string) => boolean },
 *   available: { claude: boolean, agy: boolean },
 *   factories: {
 *     claudeWorker: (emit: (ev: any) => void) => Engine,
 *     agyChat: (emit: (ev: any) => void, persona: string) => Engine,
 *     agyCompose?: (emit: (ev: any) => void, persona: string) => Engine,
 *   },
 *   now?: () => number,
 * }} deps
 */
function createBrain({ bus, device, gate, scratchDir, git, available, factories, now = Date.now }) {
  const cfg = () => ({ dailyClaudeUsd: 10, ...(device.get().brain || {}) });
  const eng = () => device.get().engine || {};
  const usage = () => budget.today(device.get().usage, now());

  /** @param {string} text @param {'info'|'warn'} [kind] */
  const notice = (text, kind = 'info') => {
    bus.emit(TOPICS.ENGINE_EVENT, { engine: 'tama', role: 'brain', ev: { t: 'info', text: `⎿  ${text}` } });
    bus.emit(TOPICS.BRAIN_NOTICE, { text, kind });
  };

  /** @param {'claude'|'agy'} engine @param {'lite'|'worker'} role @param {any} ev */
  function recordUsage(engine, role, ev) {
    const before = usage();
    const after = budget.record(device.get().usage, { engine, role, ev }, now());
    device.patch(null, { usage: after });
    if (budget.crossedWarning(before, after, cfg())) {
      notice(`Claude usage today is ≈$${after.claudeUsd.toFixed(2)} of your $${cfg().dailyClaudeUsd} budget. Maybe let me rest soon~ (/budget)`, 'warn');
    }
  }

  // ---------------- chat (agy) ----------------
  const chat = createChat({
    bus, scratchDir, available: () => available.agy, factory: factories.agyChat,
    onResult: (ev) => recordUsage('agy', 'lite', ev), now,
  });

  let googleSignedIn = false;
  // Events + diary text (EVT-3): its own agy session, same persona.
  let personaText = '';
  const composer = createComposer({
    factory: factories.agyCompose || factories.agyChat, scratchDir: path.join(scratchDir, 'compose'), available: () => available.agy, persona: () => personaText,
  });

  // ---------------- terminal (Claude Code) ----------------
  /** @type {Engine | null} */
  let claude = null;
  function worker() {
    if (!claude) {
      claude = factories.claudeWorker((ev) => {
        if (ev.t === 'session') device.patch('engine', { lastSessionId: ev.sessionId });
        bus.emit(TOPICS.ENGINE_EVENT, { engine: 'claude', role: 'worker', ev });
        if (ev.t === 'result') recordUsage('claude', 'worker', ev);
      });
      const e = eng();
      if (e.cwd && fs.existsSync(e.cwd)) claude.cwd = e.cwd;
      if (e.mode) claude.mode = e.mode;
      if (e.model) claude.model = e.model;
      if (e.effort) claude.effort = e.effort;
    }
    return claude;
  }

  /** @param {string} raw */
  function send(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    if (!available.claude) return notice('Claude Code isn\'t available. Install it and log in (`claude`), then restart Tama.', 'warn');
    if (!eng().cwd) return notice('Pick a project folder first with /cd, then ask again~', 'warn');
    const tight = budget.claudeTight(device.get().usage, cfg(), now());
    if (tight.tight) notice(`heads-up: ${tight.reason}. I'll still try~ (/budget to change)`, 'warn');
    return worker().send(text);
  }

  /** @param {string} dir */
  function setCwd(dir) {
    let resolved = dir;
    const cur = eng().cwd;
    if (cur && !path.isAbsolute(dir)) resolved = path.resolve(cur, dir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return { error: `Not a folder: ${resolved}` };
    if (claude) claude.setCwd(resolved);
    device.patch('engine', { cwd: resolved });
    const ev = { t: 'cwd', cwd: resolved, isGit: git.isRepo(resolved) };
    bus.emit(TOPICS.ENGINE_EVENT, { engine: 'tama', role: 'brain', ev });
    return ev;
  }

  function status() {
    const c = cfg();
    return {
      terminal: 'claude', chat: 'agy', available, dailyClaudeUsd: c.dailyClaudeUsd, usage: usage(),
      claudeTight: budget.claudeTight(device.get().usage, c, now()),
    };
  }

  /** @param {any} p */
  function setBrain(p) {
    if (Number.isFinite(p.dailyClaudeUsd) && p.dailyClaudeUsd >= 0) device.patch('brain', { dailyClaudeUsd: Math.min(1000, p.dailyClaudeUsd) });
    return status();
  }

  /** @param {any} spec */
  function updatePersona(spec) {
    personaText = persona.buildPersona(spec, { today: new Date(now()).toDateString() });
    chat.setPersona(personaText);
    composer.setPersona(personaText);
  }

  function start() {
    const stopChat = chat.start();
    const offs = [
      bus.handle(TOPICS.ENGINE_INFO, () => {
        const w = worker();
        return {
          cwd: eng().cwd || null, isGit: !!(eng().cwd && git.isRepo(eng().cwd)),
          mode: w.mode, model: w.model, effort: w.effort || null, busy: !!w.busy,
          lastSessionId: eng().lastSessionId || null, totalCost: usage().claudeUsd, commands: w.commands, brain: status(),
        };
      }),
      bus.handle(TOPICS.ENGINE_SEND, (/** @type {string} */ text) => send(text)),
      bus.handle(TOPICS.ENGINE_INTERRUPT, async () => { if (claude && claude.busy) await claude.interrupt(); }),
      bus.handle(TOPICS.ENGINE_CLEAR, () => {
        if (claude) { claude.stop(); claude.sessionId = null; }
        bus.emit(TOPICS.ENGINE_EVENT, { engine: 'tama', role: 'brain', ev: { t: 'cleared' } });
      }),
      bus.handle(TOPICS.ENGINE_SET_MODE, (/** @type {string} */ m) => { if (claude) claude.setMode(m); device.patch('engine', { mode: m }); }),
      bus.handle(TOPICS.ENGINE_SET_MODEL, (/** @type {string|null} */ m) => { worker().setModel(m); device.patch('engine', { model: m || null }); }),
      bus.handle(TOPICS.ENGINE_SET_EFFORT, (/** @type {string|null} */ v) => {
        const effort = EFFORTS.includes(String(v)) ? String(v) : null;
        const w = worker();
        if (w.setEffort) w.setEffort(effort);
        device.patch('engine', { effort });
      }),
      bus.handle(TOPICS.ENGINE_SET_CWD, setCwd),
      bus.handle(TOPICS.ENGINE_ANSWER_PERMISSION, (/** @type {any} */ a) => gate.answer(Number(a.id), a.choice, a.feedback)),
      bus.handle(TOPICS.ENGINE_RESUME, async (/** @type {string|null} */ id) => {
        const sid = id || eng().lastSessionId;
        if (!sid) return { error: 'No previous session to resume.' };
        if (!eng().cwd) return { error: 'Pick a project folder first (/cd).' };
        const w = worker();
        if (!w.resume) return { error: 'Resume is not supported.' };
        await w.resume(sid);
        return { ok: true };
      }),
      bus.handle(TOPICS.BRAIN_STATUS, () => status()),
      bus.handle(TOPICS.BRAIN_SET, setBrain),
      bus.handle(TOPICS.BRAIN_COMPOSE, (/** @type {any} */ p) => composer.compose({ kind: p && p.kind === 'diary' ? 'diary' : 'line', seed: String((p && p.seed) || '') })),
      bus.on(TOPICS.CHARACTER_CHANGED, (/** @type {any} */ c) => { updatePersona(c.spec); }),
      // Google tools for the chat brain come and go with sign-in (D-037): restart its session when that flips.
      bus.on(TOPICS.GOOGLE_CHANGED, (/** @type {any} */ g) => {
        const signedIn = !!(g && g.signedIn);
        if (signedIn !== googleSignedIn) { googleSignedIn = signedIn; chat.reset(); }
      }),
    ];
    bus.request(TOPICS.CHARACTER_GET).then((c) => updatePersona(c.spec)).catch(() => null);
    return () => { for (const off of offs) off(); stopChat(); composer.stop(); if (claude) claude.stop(); };
  }

  return { start, send, status, setBrain, chat };
}

module.exports = { createBrain };
