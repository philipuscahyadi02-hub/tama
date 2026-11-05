// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseInput, pickWorker } = require('./router');
const persona = require('./persona');
const budget = require('./budget');
const { createBrain } = require('.');
const { createPermissionGate } = require('./permission-gate');
const { Bus } = require('../bus');
const { createStore } = require('../platform/store');
const { createDeviceSettings } = require('../platform/store/device');
const { normalizeSpec } = require('../../shared/spec');

// ---------------- router ----------------
test('parseInput: slash → worker, @prefixes, chat modes', () => {
  assert.deepEqual(parseInput('/init', { chatMode: 'auto' }), { target: 'worker', text: '/init', slash: true });
  assert.deepEqual(parseInput('@agy fix the test', { chatMode: 'auto' }), { target: 'worker', engine: 'agy', text: 'fix the test' });
  assert.deepEqual(parseInput('@Claude hi', { chatMode: 'chat' }), { target: 'worker', engine: 'claude', text: 'hi' });
  assert.deepEqual(parseInput('@chat what is love', { chatMode: 'code' }), { target: 'lite', text: 'what is love' });
  assert.deepEqual(parseInput('refactor this', { chatMode: 'code' }), { target: 'worker', text: 'refactor this' });
  assert.deepEqual(parseInput('how are you?', { chatMode: 'auto' }), { target: 'lite', text: 'how are you?' });
  assert.equal(parseInput('   ', { chatMode: 'auto' }), null);
});

test('pickWorker: Claude by default; agy (read-only) on request or when Claude is tight (BRAIN-4)', () => {
  const base = { codeEngine: /** @type {const} */ ('auto'), available: { claude: true, agy: true }, claudeTight: { tight: false, reason: '' } };
  assert.deepEqual(pickWorker(base), { engine: 'claude' });
  const tight = /** @type {any} */ (pickWorker({ ...base, claudeTight: { tight: true, reason: 'limit' } }));
  assert.equal(tight.engine, 'agy');
  assert.match(tight.notice, /read-only/);
  assert.equal(/** @type {any} */ (pickWorker({ ...base, explicit: 'agy' })).engine, 'agy');
  const noAgy = /** @type {any} */ (pickWorker({ ...base, explicit: 'agy', available: { claude: true, agy: false } }));
  assert.equal(noAgy.engine, 'claude');
  assert.match(noAgy.notice, /not installed/);
  assert.equal(/** @type {any} */ (pickWorker({ ...base, codeEngine: 'claude', claudeTight: { tight: true, reason: 'x' } })).engine, 'claude'); // pinned
  assert.match(/** @type {any} */ (pickWorker({ ...base, available: { claude: false, agy: false } })).error, /not available/);
});

// ---------------- persona ----------------
test('persona: built from the spec, includes the escalation rule; status line', () => {
  const p = persona.buildPersona(normalizeSpec({ name: 'Mochi', gender: 'boy', speech: { tics: ['nya~'] } }));
  assert.match(p, /You are Mochi/);
  assert.match(p, /he\/him/);
  assert.match(p, /nya~/);
  assert.match(p, /\[\[ESCALATE\]\]/);
  const line = persona.statusLine({ state: { hunger: 10, happy: 50, energy: 80, clean: 90, streak: { count: 3 } }, level: { title: 'Buddy' } }, { todos: [{ done: false }], focus: { phase: 'focus' } });
  assert.match(line, /you feel hungry/);
  assert.match(line, /3-day streak/);
  assert.match(line, /1 open todo/);
  assert.match(line, /focus session/);
});

test('escalation marker detection works on partial streams', () => {
  assert.deepEqual(persona.escalation('[[ESC'), { escalate: false, task: '', decided: false });
  assert.deepEqual(persona.escalation('  [[ESCALATE]] fix tests'), { escalate: true, task: 'fix tests', decided: true });
  assert.equal(persona.escalation('Sure! here').decided, true);
});

// ---------------- budget ----------------
test('budget: daily rollover, 75% warning, 90% tight, limit error cooldown', () => {
  const T = new Date(2026, 10, 5, 12).getTime();
  const cfg = { dailyClaudeUsd: 10 };
  let u = budget.record(undefined, { engine: 'claude', role: 'worker', ev: { cost: 7 } }, T);
  assert.equal(budget.claudeTight(u, cfg, T).tight, false);
  const u2 = budget.record(u, { engine: 'claude', role: 'worker', ev: { cost: 1 } }, T);
  assert.equal(budget.crossedWarning(u, u2, cfg), true);
  u = budget.record(u2, { engine: 'claude', role: 'worker', ev: { cost: 1.5 } }, T);
  assert.equal(budget.claudeTight(u, cfg, T).tight, true);
  assert.equal(budget.claudeTight(u, cfg, T + 24 * 3600000).tight, false); // new day
  const lim = budget.record(undefined, { engine: 'claude', role: 'worker', ev: { isError: true, text: 'Claude usage limit reached' } }, T);
  assert.equal(budget.claudeTight(lim, cfg, T + 1000).reason, 'usage limit hit');
  assert.equal(budget.claudeTight(lim, cfg, T + 2 * 3600000).tight, false);
  const l = budget.record(undefined, { engine: 'agy', role: 'lite', ev: {} }, T);
  assert.equal(l.liteTurns, 1);
});

// ---------------- brain with fake engines ----------------
/** A fake engine that replies with a scripted text. */
function fakeEngine(emit, reply = (/** @type {string} */ t) => `ok: ${t}`) {
  return {
    cwd: /** @type {string|null} */ (null), mode: 'default', model: null, busy: false, sessionId: null, totalCost: 0, commands: [],
    sent: /** @type {string[]} */ ([]),
    setCwd(/** @type {string} */ d) { this.cwd = d; }, setMode() {}, setModel() {}, interrupt() {}, stop() {}, setPersona() {},
    async send(/** @type {string} */ t) {
      this.sent.push(t);
      const text = reply(t);
      emit({ t: 'text-start' });
      for (let i = 0; i < text.length; i += 4) emit({ t: 'text-delta', text: text.slice(i, i + 4) });
      emit({ t: 'text-end' });
      emit({ t: 'result', isError: false, text, cost: 0.5 });
    },
  };
}

function setupBrain(liteReply, gitOverride = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-brain-'));
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const bus = new Bus();
  const device = createDeviceSettings(createStore(dir));
  const gate = createPermissionGate({ bus });
  /** @type {Record<string, any>} */ const made = {};
  /** @type {any[]} */ const events = [];
  bus.on('engine.event', (e) => events.push(e));
  bus.handle('character.get', () => ({ spec: normalizeSpec({ name: 'Mochi' }) }));
  const brain = createBrain({
    bus, device, gate, scratchDir: path.join(dir, 'scratch'),
    git: { isRepo: (d) => fs.existsSync(path.join(d, '.git')), changedFiles: async () => [], ...gitOverride },
    available: { claude: true, agy: true },
    factories: {
      claudeWorker: (emit) => (made.claude = fakeEngine(emit)),
      agyWorker: (emit) => (made.agy = fakeEngine(emit)),
      agyLite: (emit) => (made.lite = fakeEngine(emit, liteReply)),
      claudeLite: (emit) => (made.claudeLite = fakeEngine(emit, liteReply)),
    },
  });
  brain.start();
  return { bus, brain, made, events, repo, device };
}
const texts = (/** @type {any[]} */ evs, /** @type {string} */ role) => evs.filter((e) => e.role === role && e.ev.t === 'text-delta').map((e) => e.ev.text).join('');

test('chat goes to the lite brain with a [status] line; the reply streams to the UI', async () => {
  const { bus, made, events } = setupBrain(() => 'hi there! nya~');
  await bus.request('engine.send', 'hello');
  assert.match(made.lite.sent[0], /^\[status\] .*\nhello$/);
  assert.equal(texts(events, 'lite'), 'hi there! nya~');
  assert.equal(made.claude, undefined); // no worker started for chat
});

test('escalation: the marker is never shown; the original request goes to Claude Code', async () => {
  const { bus, made, events, repo } = setupBrain(() => '[[ESCALATE]] fix the failing test');
  await bus.request('engine.setCwd', repo);
  await bus.request('engine.send', 'please fix the failing test in my repo');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(texts(events, 'lite'), '');
  assert.deepEqual(made.claude.sent, ['please fix the failing test in my repo']);
  assert.ok(events.some((e) => e.role === 'brain' && /handing this to Claude Code/.test(e.ev.text || '')));
});

test('@agy: read-only notice once; unexpected file changes during its turn are flagged (D-027)', async () => {
  let changed = ['M old.js'];
  const { bus, made, events, repo } = setupBrain(() => 'x', { changedFiles: async () => changed });
  await bus.request('engine.setCwd', repo);
  const p = bus.request('engine.send', '@agy review the tests');
  changed = ['M old.js', '?? sneaky.txt']; // something wrote a file during the turn
  await p;
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(made.agy.sent, ['review the tests']);
  const infos = events.filter((e) => e.role === 'brain').map((e) => e.ev.text || '').join('\n');
  assert.match(infos, /read-only/);
  assert.match(infos, /files changed during a read-only agy turn: \?\? sneaky\.txt/);
  assert.doesNotMatch(infos, /old\.js/); // already changed before the turn
});

test('no project folder → friendly notice instead of a crash', async () => {
  const { bus, events } = setupBrain(() => '[[ESCALATE]] do it');
  await bus.request('engine.send', 'refactor my code');
  assert.ok(events.some((e) => /Pick a project folder/.test(e.ev.text || '')));
});

test('worker results are recorded as usage; brain.set validates input', async () => {
  const { bus, repo } = setupBrain(() => 'x');
  await bus.request('engine.setCwd', repo);
  await bus.request('engine.send', '@claude go');
  const s = await bus.request('brain.status');
  assert.equal(s.usage.claudeTurns, 1);
  assert.equal(s.usage.claudeUsd, 0.5);
  const after = await bus.request('brain.set', { chatMode: 'code', codeEngine: 'nonsense', dailyClaudeUsd: 3 });
  assert.equal(after.chatMode, 'code');
  assert.equal(after.codeEngine, 'auto');
  assert.equal(after.dailyClaudeUsd, 3);
});
