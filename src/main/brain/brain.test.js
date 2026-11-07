// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const persona = require('./persona');
const budget = require('./budget');
const { createBrain } = require('.');
const { createPermissionGate } = require('./permission-gate');
const { Bus } = require('../bus');
const { createStore } = require('../platform/store');
const { createDeviceSettings } = require('../platform/store/device');
const { normalizeSpec } = require('../../shared/spec');

// ---------------- persona ----------------
test('persona: built from the spec, read-only chat with web search, knows how the app works; status line', () => {
  const p = persona.buildPersona(normalizeSpec({ name: 'Mochi', gender: 'boy', speech: { tics: ['nya~'] } }));
  assert.match(p, /You are Mochi/);
  assert.match(p, /he\/him/);
  assert.match(p, /nya~/);
  assert.match(p, /search_web/);
  assert.match(p, /read-only/);
  assert.match(p, /Ctrl\+Alt\+K/); // can guide the user to the terminal
  assert.match(p, /\/cd/);
  assert.match(p, /language the user writes in/); // M10: auto mirrors the user
  const en = persona.buildPersona(normalizeSpec({ name: 'Mochi' }), { replyLang: 'en' });
  assert.match(en, /Always reply in English/);
  assert.doesNotMatch(en, /language the user writes in/);
  assert.match(persona.buildPersona(normalizeSpec({ name: 'Mochi' }), { replyLang: 'id' }), /Bahasa Indonesia/);
  const line = persona.statusLine({ state: { hunger: 10, happy: 50, energy: 80, clean: 90, streak: { count: 3 } }, level: { title: 'Buddy' } }, { todos: [{ done: false }], focus: { phase: 'focus' } });
  assert.match(line, /you feel hungry/);
  assert.match(line, /3-day streak/);
  assert.match(line, /1 open todo/);
  assert.match(line, /focus session/);
  assert.doesNotMatch(line, /weather/);
  const wet = persona.statusLine(null, null, { location: { city: 'Tokyo, JP' }, current: { kind: 'rain', tempC: 12.6 } });
  assert.match(wet, /weather in Tokyo, JP: rain, 13°C/); // D-035
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
/** A fake engine that replies with a scripted text (and optionally a tool call first). */
function fakeEngine(emit, reply = (/** @type {string} */ t) => `ok: ${t}`, /** @type {any} */ tool = null) {
  return {
    cwd: /** @type {string|null} */ (null), mode: 'default', model: null, busy: false, sessionId: null, totalCost: 0, commands: [],
    sent: /** @type {string[]} */ ([]), persona: '',
    setCwd(/** @type {string} */ d) { this.cwd = d; }, setMode() {}, setModel() {}, interrupt() {}, stop() {},
    setPersona(/** @type {string} */ p) { this.persona = p; },
    async send(/** @type {string} */ t) {
      this.sent.push(t);
      const text = reply(t);
      emit({ t: 'status', state: 'thinking' });
      emit({ t: 'session', sessionId: 's1' });
      if (tool) emit({ t: 'tool', id: 't1', name: tool.name, input: tool.input });
      emit({ t: 'text-start' });
      for (let i = 0; i < text.length; i += 4) emit({ t: 'text-delta', text: text.slice(i, i + 4) });
      emit({ t: 'text-end' });
      emit({ t: 'result', isError: false, text, cost: 0.5 });
      emit({ t: 'status', state: 'idle' });
    },
  };
}

/** @param {{ chatReply?: (t: string) => string, tool?: any, agy?: boolean }} [o] */
function setupBrain({ chatReply = (t) => `hi! (${t.length})`, tool = null, agy = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-brain-'));
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const bus = new Bus();
  const device = createDeviceSettings(createStore(dir));
  const gate = createPermissionGate({ bus });
  /** @type {Record<string, any>} */ const made = {};
  /** @type {any[]} */ const term = [];
  /** @type {any[]} */ const chat = [];
  bus.on('engine.event', (e) => term.push(e));
  bus.on('chat.event', (e) => chat.push(e));
  bus.handle('character.get', () => ({ spec: normalizeSpec({ name: 'Mochi' }) }));
  const brain = createBrain({
    bus, device, gate, scratchDir: path.join(dir, 'scratch'),
    git: { isRepo: (d) => fs.existsSync(path.join(d, '.git')) },
    available: { claude: true, agy },
    factories: {
      claudeWorker: (emit) => (made.claude = fakeEngine(emit)),
      agyChat: (emit, p) => { made.chat = fakeEngine(emit, chatReply, tool); made.chat.persona = p; return made.chat; },
    },
  });
  const stop = brain.start();
  stoppers.push(stop);
  return { bus, brain, made, term, chat, repo, device };
}
/** @type {Array<() => void>} */
const stoppers = [];
test.after(() => { for (const s of stoppers) s(); });
const tick = () => new Promise((r) => setTimeout(r, 20));

test('terminal = Claude Code only: every message goes to Claude, nothing to the chat brain (D-029)', async () => {
  const { bus, made, term, repo } = setupBrain();
  await bus.request('engine.setCwd', repo);
  await bus.request('engine.send', 'how are you?');
  await bus.request('engine.send', '/init');
  assert.deepEqual(made.claude.sent, ['how are you?', '/init']);
  assert.equal(made.chat, undefined);
  assert.ok(term.every((e) => e.engine !== 'agy'));
});

test('terminal without a project folder → friendly notice instead of a crash', async () => {
  const { bus, term, made } = setupBrain();
  await bus.request('engine.send', 'refactor my code');
  assert.ok(term.some((e) => /Pick a project folder/.test(e.ev.text || '')));
  assert.equal(made.claude, undefined);
});

test('chat = agy: status line + message go to agy; the reply becomes a chat message; history keeps both', async () => {
  const { bus, made, chat, term } = setupBrain({ chatReply: () => 'hi there! nya~' });
  await tick(); // persona from character.get
  const r = await bus.request('chat.send', 'hello');
  assert.equal(r.ok, true);
  await tick();
  assert.match(made.chat.sent[0], /^\[status\] .*\n(\[memory\] .*\n)?hello$/);
  assert.match(made.chat.persona, /You are Mochi/);
  const msgs = chat.filter((e) => e.t === 'message').map((e) => [e.message.role, e.message.text]);
  assert.deepEqual(msgs, [['user', 'hello'], ['tama', 'hi there! nya~']]);
  assert.ok(chat.some((e) => e.t === 'delta'));
  assert.ok(chat.some((e) => e.t === 'done'));
  assert.ok(!chat.some((e) => e.t === 'session')); // engine housekeeping stays inside
  assert.equal(term.length, 0); // nothing leaks into the terminal
  const h = await bus.request('chat.history');
  assert.equal(h.messages.length, 2);
  assert.equal(h.available, true);
});

test('chat web search shows up as a tool line and is kept on the reply', async () => {
  const { bus, chat } = setupBrain({ chatReply: () => 'Electron 45!', tool: { name: 'search_web', input: { query: 'latest electron' } } });
  await bus.request('chat.send', 'latest electron?');
  await tick();
  assert.ok(chat.some((e) => e.t === 'tool' && /searched the web: latest electron/.test(e.text)));
  const tama = chat.find((e) => e.t === 'message' && e.message.role === 'tama');
  assert.deepEqual(tama.message.tools, ['🔎 searched the web: latest electron']);
});

test('chat without agy: a clear note, no Claude fallback (agy only)', async () => {
  const { bus, chat, made } = setupBrain({ agy: false });
  const r = await bus.request('chat.send', 'hello');
  assert.equal(r.ok, false);
  assert.ok(chat.some((e) => e.t === 'message' && e.message.role === 'note' && /Antigravity CLI/.test(e.message.text)));
  assert.equal(made.chat, undefined);
  assert.equal(made.claude, undefined);
});

test('an empty agy reply still answers (e.g. after a denied tool)', async () => {
  const { bus, chat } = setupBrain({ chatReply: () => '' });
  await bus.request('chat.send', 'run dir for me');
  await tick();
  const tama = chat.find((e) => e.t === 'message' && e.message.role === 'tama');
  assert.match(tama.message.text, /Ask me again/);
});

test('usage: Claude turns and chat messages are recorded; brain.set validates the budget', async () => {
  const { bus, repo } = setupBrain();
  await bus.request('engine.setCwd', repo);
  await bus.request('engine.send', 'go');
  await bus.request('chat.send', 'hi');
  await tick();
  const s = await bus.request('brain.status');
  assert.equal(s.usage.claudeTurns, 1);
  assert.equal(s.usage.claudeUsd, 0.5);
  assert.equal(s.usage.liteTurns, 1);
  assert.equal(s.terminal, 'claude');
  assert.equal(s.chat, 'agy');
  assert.equal((await bus.request('brain.set', { dailyClaudeUsd: 3 })).dailyClaudeUsd, 3);
  assert.equal((await bus.request('brain.set', { dailyClaudeUsd: -1 })).dailyClaudeUsd, 3);
});

// ---------------- memory in chat (EVT-4, D-033) ----------------
const { markerFilter } = require('./chat');
const { clean } = require('./compose');

test('marker filter hides [[remember: …]] even when split across chunks', () => {
  const f = markerFilter();
  const out = ['Nice to meet you! ', '[', '[remem', 'ber: name is Phil', ']]', ' bye'].map((c) => f.push(c)).join('') + f.end();
  assert.equal(out, 'Nice to meet you!  bye');
  const g = markerFilter();
  assert.equal(g.push('a [b] c [') + g.end(), 'a [b] c [');
  assert.equal(clean('"hello there~"'), 'hello there~');
  assert.equal(clean('[[remember: x]]'), null);
});

test('chat: a remember marker becomes a memory and is never shown; memories reach the session once', async () => {
  const { bus, made, chat } = setupBrain({ chatReply: () => 'Phil! Cute name~ [[remember: is called Phil]]' });
  /** @type {any[]} */ const facts = [];
  bus.handle('memory.add', (p) => { if (!facts.some((f) => f.text === p.text)) facts.push({ id: `f${facts.length}`, text: p.text }); return { ok: true }; });
  bus.handle('memory.get', () => ({ facts: facts.slice() }));
  await bus.request('chat.send', 'my name is Phil');
  await tick();
  assert.deepEqual(facts.map((f) => f.text), ['is called Phil']);
  assert.match(made.chat.sent[0], /\[memory\] You don't remember anything/);
  const shownText = chat.filter((e) => e.t === 'delta').map((e) => e.text).join('');
  assert.doesNotMatch(shownText, /remember/);
  const tama = chat.find((e) => e.t === 'message' && e.message.role === 'tama');
  assert.equal(tama.message.text, 'Phil! Cute name~');
  await bus.request('chat.send', 'hi again');
  await tick();
  assert.match(made.chat.sent[1], /\[memory\] What you remember about the user: 1\) is called Phil/);
  await bus.request('chat.send', 'and again');
  await tick();
  assert.doesNotMatch(made.chat.sent[2], /\[memory\]/); // unchanged → not repeated
  await bus.request('chat.push', { role: 'tama', text: 'lunch time~' });
  assert.equal((await bus.request('chat.history')).messages.at(-1).text, 'lunch time~');
});

test('chat: a [[work: …]] marker is hidden and attached to the message (phone hand-off button)', async () => {
  const { bus, chat } = setupBrain({ chatReply: () => 'Sure, Claude can make that! [[work: Create a Google Doc titled Plan]]' });
  await bus.request('chat.send', '📱 make a plan doc');
  await tick();
  const tama = chat.find((e) => e.t === 'message' && e.message.role === 'tama');
  assert.equal(tama.message.text, 'Sure, Claude can make that!');
  assert.equal(tama.message.work, 'Create a Google Doc titled Plan');
});
