// @ts-check
// The brain (M3): owns the engines and decides who answers (BRAIN-1..5, ENG-1..5, SAFE-1, SAFE-5).
//   lite brain  = chat/events in Tama's persona, no tools (agy Gemini Flash, fallback Claude Haiku)
//   workers     = real coding agents in the project folder (Claude Code; agy only in git repos, D-026)
// agy only ever runs read-only in plan mode (D-027).
// It answers the terminal's engine.* bus requests (replacing the M0 engine host) and emits every engine
// event as { engine, role, ev } on engine.event.
const fs = require('fs');
const path = require('path');
const { TOPICS } = require('../bus-topics');
const { parseInput, pickWorker } = require('./router');
const persona = require('./persona');
const budget = require('./budget');

/** @typedef {{ cwd: string|null, mode: string, model: string|null, busy: boolean, sessionId: string|null, totalCost: number,
 *   commands: any[], setCwd: (d: string) => void, setMode: (m: string) => any, setModel: (m: string|null) => any,
 *   send: (t: string) => any, interrupt: () => any, stop: () => void, setPersona?: (p: string) => void, resume?: (id: string) => any }} Engine */

/**
 * @param {{
 *   bus: import('../bus').BusInstance,
 *   device: import('../platform/store/device').DeviceSettings,
 *   gate: import('./permission-gate').PermissionGate,
 *   scratchDir: string,
 *   git: { isRepo: (d: string) => boolean, changedFiles: (d: string) => Promise<string[]> },
 *   available: { claude: boolean, agy: boolean },
 *   factories: {
 *     claudeWorker: (emit: (ev: any) => void) => Engine,
 *     claudeLite: (emit: (ev: any) => void, persona: string) => Engine,
 *     agyWorker: (emit: (ev: any) => void) => Engine,
 *     agyLite: (emit: (ev: any) => void, persona: string) => Engine,
 *   },
 *   now?: () => number,
 * }} deps
 */
function createBrain({ bus, device, gate, scratchDir, git, available, factories, now = Date.now }) {
  const cfg = () => ({ chatMode: 'auto', codeEngine: 'auto', liteEngine: 'auto', dailyClaudeUsd: 10, ...(device.get().brain || {}) });
  const eng = () => device.get().engine || {};
  const usage = () => budget.today(device.get().usage, now());

  let personaText = persona.buildPersona(/** @type {any} */ ({ name: 'Tama', pronouns: { subject: 'she', object: 'her' }, personality: { energy: 50, tsundere: 20, formality: 20, chaos: 30 }, speech: { style: 'friendly', tics: [], catchphrases: [], emoji: [] }, motif: '' }));
  /** Lite engine actually in use this run ('agy' falls back to 'claude' if agy fails to start). */
  let liteKind = /** @type {'agy'|'claude'|'none'} */ ('none');
  let toldAgyReadOnly = false;
  /** Working-tree state before an agy turn, to catch unexpected writes (defense in depth, D-027). */
  let agyBefore = /** @type {string[] | null} */ (null);

  // ---------------- engine events ----------------
  /** @param {'claude'|'agy'} engine @param {'lite'|'worker'} role */
  const emitter = (engine, role) => (/** @type {any} */ ev) => onEngineEvent(engine, role, ev);
  /** @param {string} text @param {'info'|'warn'} [kind] */
  const notice = (text, kind = 'info') => {
    bus.emit(TOPICS.ENGINE_EVENT, { engine: 'tama', role: 'brain', ev: { t: 'info', text: `⎿  ${text}` } });
    bus.emit(TOPICS.BRAIN_NOTICE, { text, kind });
  };

  /** Escalation filter state for the current lite turn. */
  let lite = { input: '', text: '', decided: false, escalate: false, held: /** @type {any[]} */ ([]), errored: false, gotText: false };

  /** @param {'claude'|'agy'} engine @param {'lite'|'worker'} role @param {any} ev */
  function onEngineEvent(engine, role, ev) {
    const out = (/** @type {any} */ e) => bus.emit(TOPICS.ENGINE_EVENT, { engine, role, ev: e });
    if (role === 'lite') return onLiteEvent(engine, ev, out);
    if (ev.t === 'session' && engine === 'claude') device.patch('engine', { lastSessionId: ev.sessionId });
    out(ev);
    if (ev.t === 'result') afterWorkerTurn(engine, ev);
  }

  /** @param {'claude'|'agy'} engine @param {any} ev @param {(e: any) => void} out */
  function onLiteEvent(engine, ev, out) {
    if (ev.t === 'error') lite.errored = true;
    if (ev.t === 'text-start') { if (!lite.decided) lite.held.push(ev); else if (!lite.escalate) out(ev); return; }
    if (ev.t === 'text-delta') {
      lite.gotText = true;
      lite.text += ev.text;
      if (!lite.decided) {
        const e = persona.escalation(lite.text);
        if (!e.decided) { lite.held.push(ev); return; }
        lite.decided = true; lite.escalate = e.escalate;
        if (!lite.escalate) { for (const h of lite.held) out(h); out(ev); }
        lite.held = [];
        return;
      }
      if (!lite.escalate) out(ev);
      return;
    }
    if (ev.t === 'text-end') { if (!lite.escalate) { for (const h of lite.held) out(h); lite.held = []; out(ev); } return; }
    if (ev.t === 'result') {
      recordUsage(engine, 'lite', ev);
      const e = persona.escalation(lite.text);
      if (e.escalate) {
        out({ t: 'status', state: 'idle' });
        return handToWorker({ target: 'worker', text: lite.input }, e.task);
      }
      // agy lite failed to start/answer → fall back to Claude Haiku once (BRAIN-2)
      if (engine === 'agy' && ev.isError && !lite.gotText && available.claude) {
        notice('agy chat brain is unavailable; using Claude Haiku for chat this time.', 'warn');
        liteKind = 'claude';
        stopLite();
        return askLite(lite.input);
      }
      out(ev);
      return;
    }
    out(ev);
  }

  // ---------------- engines ----------------
  /** @type {{ claude: Engine | null, agy: Engine | null }} */
  const workers = { claude: null, agy: null };
  /** @type {Engine | null} */
  let liteEngine = null;

  /** @param {'claude'|'agy'} kind */
  function worker(kind) {
    let w = workers[kind];
    if (!w) {
      w = kind === 'claude' ? factories.claudeWorker(emitter('claude', 'worker')) : factories.agyWorker(emitter('agy', 'worker'));
      const e = eng();
      if (e.cwd && fs.existsSync(e.cwd)) w.cwd = e.cwd;
      if (e.mode) w.mode = e.mode;
      if (kind === 'claude' && e.model) w.model = e.model;
      workers[kind] = w;
    }
    return w;
  }

  function chooseLiteKind() {
    const want = cfg().liteEngine;
    if (want === 'claude') return available.claude ? 'claude' : available.agy ? 'agy' : 'none';
    return available.agy ? 'agy' : available.claude ? 'claude' : 'none';
  }

  function getLite() {
    if (liteEngine) return liteEngine;
    if (liteKind === 'none') liteKind = chooseLiteKind();
    if (liteKind === 'none') return null;
    fs.mkdirSync(scratchDir, { recursive: true });
    liteEngine = liteKind === 'agy' ? factories.agyLite(emitter('agy', 'lite'), personaText) : factories.claudeLite(emitter('claude', 'lite'), personaText);
    liteEngine.setCwd(scratchDir);
    return liteEngine;
  }
  function stopLite() { if (liteEngine) { liteEngine.stop(); liteEngine = null; } }

  // ---------------- turns ----------------
  /** @param {string} text */
  async function askLite(text) {
    const l = getLite();
    if (!l) return handToWorker({ target: 'worker', text }, '');
    lite = { input: text, text: '', decided: false, escalate: false, held: [], errored: false, gotText: false };
    const [pet, prod] = await Promise.all([
      bus.request(TOPICS.PET_GET).catch(() => null),
      bus.request(TOPICS.PROD_GET).catch(() => null),
    ]);
    return l.send(`${persona.statusLine(pet, prod)}\n${text}`);
  }

  /** @param {import('./router').Route} route @param {string} task */
  async function handToWorker(route, task) {
    const e = eng();
    const pick = pickWorker({
      explicit: route.engine, slash: route.slash, codeEngine: /** @type {any} */ (cfg().codeEngine), available,
      claudeTight: budget.claudeTight(device.get().usage, cfg(), now()),
    });
    if ('error' in pick) return notice(pick.error, 'warn');
    if (!e.cwd) return notice('Pick a project folder first with /cd, then ask again~', 'warn');
    if (task) notice(`handing this to ${pick.engine === 'claude' ? 'Claude Code' : 'agy'}: ${task}`);
    if (pick.notice) notice(pick.notice, 'warn');
    if (pick.engine === 'agy') {
      if (!toldAgyReadOnly) { toldAgyReadOnly = true; notice('agy works read-only here: it reviews and plans; real edits go through Claude Code (@claude). (D-027)'); }
      agyBefore = git.isRepo(e.cwd) ? await git.changedFiles(e.cwd).catch(() => null) : null;
    }
    return worker(pick.engine).send(route.text);
  }

  /** @param {string} text */
  async function send(text) {
    const route = parseInput(text, { chatMode: /** @type {any} */ (cfg().chatMode) });
    if (!route) return;
    if (route.target === 'lite') return askLite(route.text);
    return handToWorker(route, '');
  }

  /** @param {'claude'|'agy'} engine @param {'lite'|'worker'} role @param {any} ev */
  function recordUsage(engine, role, ev) {
    const before = usage();
    const after = budget.record(device.get().usage, { engine, role, ev }, now());
    device.patch(null, { usage: after });
    if (budget.crossedWarning(before, after, cfg())) {
      notice(`Claude usage today is ≈$${after.claudeUsd.toFixed(2)} of your $${cfg().dailyClaudeUsd} budget. I'll switch to agy near the limit~`, 'warn');
    }
  }

  /** @param {'claude'|'agy'} engine @param {any} ev */
  async function afterWorkerTurn(engine, ev) {
    recordUsage(engine, 'worker', ev);
    const cwd = eng().cwd;
    if (engine === 'agy' && cwd && agyBefore) {
      const after = await git.changedFiles(cwd).catch(() => agyBefore || []);
      const before = new Set(agyBefore);
      const unexpected = after.filter((f) => !before.has(f));
      agyBefore = null;
      if (unexpected.length) notice(`⚠ files changed during a read-only agy turn: ${unexpected.slice(0, 8).join(', ')}. Please check with git diff. (D-027)`, 'warn');
    }
  }

  // ---------------- terminal requests ----------------
  /** @param {string} dir */
  function setCwd(dir) {
    let resolved = dir;
    const cur = eng().cwd;
    if (cur && !path.isAbsolute(dir)) resolved = path.resolve(cur, dir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return { error: `Not a folder: ${resolved}` };
    for (const w of Object.values(workers)) if (w) w.setCwd(resolved);
    device.patch('engine', { cwd: resolved });
    const ev = { t: 'cwd', cwd: resolved, isGit: git.isRepo(resolved) };
    bus.emit(TOPICS.ENGINE_EVENT, { engine: 'tama', role: 'brain', ev });
    return ev;
  }

  function status() {
    const c = cfg();
    return {
      chatMode: c.chatMode, codeEngine: c.codeEngine, liteEngine: liteKind === 'none' ? chooseLiteKind() : liteKind,
      litePreference: c.liteEngine, available, dailyClaudeUsd: c.dailyClaudeUsd, usage: usage(),
      claudeTight: budget.claudeTight(device.get().usage, c, now()),
    };
  }

  /** @param {any} p */
  function setBrain(p) {
    const patch = {};
    if (['auto', 'chat', 'code'].includes(p.chatMode)) Object.assign(patch, { chatMode: p.chatMode });
    if (['auto', 'claude', 'agy'].includes(p.codeEngine)) Object.assign(patch, { codeEngine: p.codeEngine });
    if (['auto', 'claude', 'agy'].includes(p.liteEngine)) { Object.assign(patch, { liteEngine: p.liteEngine }); stopLite(); liteKind = 'none'; }
    if (Number.isFinite(p.dailyClaudeUsd) && p.dailyClaudeUsd >= 0) Object.assign(patch, { dailyClaudeUsd: Math.min(1000, p.dailyClaudeUsd) });
    device.patch('brain', patch);
    return status();
  }

  function start() {
    const offs = [
      bus.handle(TOPICS.ENGINE_INFO, () => {
        const w = worker('claude');
        return {
          cwd: eng().cwd || null, mode: w.mode, model: w.model, busy: !!(w.busy || workers.agy?.busy || liteEngine?.busy),
          lastSessionId: eng().lastSessionId || null, totalCost: usage().claudeUsd, commands: w.commands, brain: status(),
        };
      }),
      bus.handle(TOPICS.ENGINE_SEND, (/** @type {string} */ text) => send(text)),
      bus.handle(TOPICS.ENGINE_INTERRUPT, async () => { for (const e of [workers.claude, workers.agy, liteEngine]) if (e && e.busy) await e.interrupt(); }),
      bus.handle(TOPICS.ENGINE_CLEAR, () => {
        for (const w of Object.values(workers)) if (w) { w.stop(); w.sessionId = null; }
        stopLite();
        bus.emit(TOPICS.ENGINE_EVENT, { engine: 'tama', role: 'brain', ev: { t: 'cleared' } });
      }),
      bus.handle(TOPICS.ENGINE_SET_MODE, (/** @type {string} */ m) => { for (const w of Object.values(workers)) if (w) w.setMode(m); device.patch('engine', { mode: m }); }),
      bus.handle(TOPICS.ENGINE_SET_MODEL, (/** @type {string|null} */ m) => { worker('claude').setModel(m); device.patch('engine', { model: m || null }); }),
      bus.handle(TOPICS.ENGINE_SET_CWD, setCwd),
      bus.handle(TOPICS.ENGINE_ANSWER_PERMISSION, (/** @type {any} */ a) => gate.answer(Number(a.id), a.choice, a.feedback)),
      bus.handle(TOPICS.ENGINE_RESUME, async (/** @type {string|null} */ id) => {
        const sid = id || eng().lastSessionId;
        if (!sid) return { error: 'No previous session to resume.' };
        if (!eng().cwd) return { error: 'Pick a project folder first (/cd).' };
        const w = worker('claude');
        if (!w.resume) return { error: 'Resume is not supported.' };
        await w.resume(sid);
        return { ok: true };
      }),
      bus.handle(TOPICS.BRAIN_STATUS, () => status()),
      bus.handle(TOPICS.BRAIN_SET, setBrain),
      bus.on(TOPICS.CHARACTER_CHANGED, (/** @type {any} */ c) => { updatePersona(c.spec); }),
    ];
    bus.request(TOPICS.CHARACTER_GET).then((c) => updatePersona(c.spec)).catch(() => null);
    return () => { for (const off of offs) off(); for (const w of Object.values(workers)) if (w) w.stop(); stopLite(); };
  }

  /** @param {any} spec */
  function updatePersona(spec) {
    personaText = persona.buildPersona(spec, { today: new Date(now()).toDateString() });
    if (liteEngine && liteEngine.setPersona) liteEngine.setPersona(personaText);
  }

  return { start, send, status, setBrain };
}

module.exports = { createBrain };
