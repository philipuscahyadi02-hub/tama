// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { AgyEngine } = require('./session');
const { mapAcpUpdate, pickOption } = require('./map-update');
const { ensureTamaAgySettings } = require('./setup');
const { createPermissionGate } = require('../../brain/permission-gate');
const { Bus } = require('../../bus');

const FAKE = path.join(__dirname, '..', '..', '..', '..', 'fixtures', 'fake-acp-agent.js');

/** Every engine a test creates; stopped after all tests even when an assertion fails. */
const engines = /** @type {InstanceType<typeof AgyEngine>[]} */ ([]);
test.after(() => { for (const e of engines) e.stop(); });

function setup(role = /** @type {'lite'|'worker'} */ ('worker'), persona = '') {
  const bus = new Bus();
  const gate = createPermissionGate({ bus });
  /** @type {any[]} */ const events = [];
  /** @type {any[]} */ const gateEvents = [];
  bus.on('engine.event', (e) => gateEvents.push(e));
  const engine = new AgyEngine((ev) => events.push(ev), {
    role, gate, persona,
    spawnAgent: (cwd) => spawn(process.execPath, [FAKE], { cwd, stdio: ['pipe', 'pipe', 'pipe'] }),
    prepare: () => {},
  });
  engines.push(engine);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-agy-'));
  engine.setCwd(cwd);
  return { bus, gate, engine, events, gateEvents, cwd };
}
const resultOf = (/** @type {any[]} */ evs) => evs.filter((e) => e.t === 'result').pop();

test('chat turn: streams text, appends the persona, reports a result', async () => {
  const { engine, events } = setup('lite', 'You are Mochi');
  await engine.send('hello');
  const r = resultOf(events);
  assert.equal(r.isError, false);
  assert.match(r.text, /echo: hello/);
  assert.match(r.text, /\[You are Mochi\]/);
  assert.ok(events.some((e) => e.t === 'text-delta'));
  assert.ok(events.some((e) => e.t === 'session'));
  engine.stop();
});

test('worker: command permission goes to the gate; "yes" lets it run', async () => {
  const { engine, events, gate, gateEvents } = setup('worker');
  const p = engine.send('RUN something');
  // wait for the gate to surface the request
  for (let i = 0; i < 50 && !gateEvents.some((e) => e.ev.t === 'permission'); i++) await new Promise((r) => setTimeout(r, 20));
  const ask = gateEvents.find((e) => e.ev.t === 'permission');
  assert.equal(ask.engine, 'agy');
  assert.equal(ask.ev.kind, 'execute');
  gate.answer(ask.ev.id, 'yes');
  await p;
  assert.match(resultOf(events).text, /ran it/);
  engine.stop();
});

test('worker: "no" blocks the command', async () => {
  const { engine, events, gate, gateEvents } = setup('worker');
  const p = engine.send('RUN something');
  for (let i = 0; i < 50 && !gateEvents.some((e) => e.ev.t === 'permission'); i++) await new Promise((r) => setTimeout(r, 20));
  gate.answer(gateEvents.find((e) => e.ev.t === 'permission').ev.id, 'no');
  await p;
  assert.match(resultOf(events).text, /not allowed/);
  engine.stop();
});

test('lite brain: tool requests are denied automatically, never shown to the user', async () => {
  const { engine, events, gateEvents } = setup('lite');
  await engine.send('RUN something');
  assert.match(resultOf(events).text, /not allowed/);
  assert.equal(gateEvents.filter((e) => e.ev.t === 'permission').length, 0);
  engine.stop();
});

test('in-workspace writes are not gated by agy (why D-026 keeps agy coding to git repos)', async () => {
  const { engine, cwd } = setup('worker');
  await engine.send('WRITE');
  assert.equal(fs.existsSync(path.join(cwd, 'fake-written.txt')), true);
  engine.stop();
});

test('agent crash → error + result, engine recovers on next send', async () => {
  const { engine, events } = setup('lite');
  await engine.send('hello');
  /** @type {any} */ (engine.client).close();
  // Wait for the engine to report the crash (a fixed sleep was flaky under a loaded full test run).
  for (let i = 0; i < 100 && !events.some((/** @type {any} */ e) => e.t === 'error'); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(events.some((/** @type {any} */ e) => e.t === 'error'), 'the crash is reported');
  await engine.send('again');
  assert.match(resultOf(events).text, /echo: again/);
  engine.stop();
});

test('map: chunks, tool calls and results; option picking', () => {
  const ctx = { textOpen: false, text: '' };
  const evs = [
    ...mapAcpUpdate({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } }, ctx),
    ...mapAcpUpdate({ sessionUpdate: 'tool_call', toolCallId: 'a', name: 'write_file', args: { Path: 'x' }, status: 'in_progress', kind: 'edit' }, ctx),
    ...mapAcpUpdate({ sessionUpdate: 'tool_call_update', toolCallId: 'a', status: 'failed', content: [{ type: 'content', content: { type: 'text', text: 'nope' } }] }, ctx),
  ];
  assert.deepEqual(evs.map((e) => e.t), ['text-start', 'text-delta', 'text-end', 'tool', 'status', 'tool-result']);
  assert.equal(evs[5].isError, true);
  const opts = [{ optionId: 'a', kind: 'allow_once' }, { optionId: 'aa', kind: 'allow_always' }, { optionId: 'r', kind: 'reject_once' }];
  assert.equal(pickOption(opts, 'yes'), 'a');
  assert.equal(pickOption(opts, 'always'), 'aa');
  assert.equal(pickOption(opts, 'no'), 'r');
  assert.equal(pickOption([{ optionId: 'a', kind: 'allow_once' }], 'no'), null);
});

test('setup: writes exactly toolPermission=request-review into a Tama-owned folder', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-home-'));
  const file = ensureTamaAgySettings(home);
  assert.match(file.replace(/\\/g, '/'), /\.gemini\/antigravity-cli\/tama-acp\/settings\.json$/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { toolPermission: 'request-review' });
});

test('gate: "always" is remembered for that session only', async () => {
  const bus = new Bus();
  const gate = createPermissionGate({ bus });
  /** @type {any[]} */ const asks = [];
  bus.on('engine.event', (e) => { if (e.ev.t === 'permission') asks.push(e.ev); });
  const tool = { name: 'run_command', kind: 'execute' };
  const first = gate.request({ engine: 'agy', role: 'worker', sessionKey: 's1', tool });
  gate.answer(asks[0].id, 'always');
  assert.equal((await first).choice, 'always');
  assert.equal((await gate.request({ engine: 'agy', role: 'worker', sessionKey: 's1', tool })).choice, 'yes');
  const other = gate.request({ engine: 'agy', role: 'worker', sessionKey: 's2', tool });
  assert.equal(asks.length, 2); // new session asks again
  gate.cancelAll('agy');
  assert.equal((await other).choice, 'no');
});

// ---------------- hard read-only guard (D-037) ----------------
const { decide } = require('./guard');
const setupMod = require('./setup');

test('guard: only Tama\'s own MCP tools + web search/read pass; everything else (and an empty list) is denied', () => {
  const A = setupMod.CHAT_ALLOW;
  for (const ok of ['mcp_tama_gmail_create_draft', 'mcp_tama_calendar_list_events', 'search_web', 'read_url_content']) assert.equal(decide(ok, A).decision, 'allow', ok);
  for (const no of ['write_file', 'run_command', 'view_file', 'mcp_other_server_tool', 'mcp_tama_x; rm', 'search_web2', '']) assert.equal(decide(no, A).decision, 'deny', no);
  assert.equal(decide('search_web', setupMod.DENY_ALL).decision, 'deny');
});

test('ensureWorkspaceGuard writes hooks.json + launcher + allow-list in the session folder; the launcher really answers', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama guard '));
  const hooksFile = setupMod.ensureWorkspaceGuard(dir, setupMod.CHAT_ALLOW, { exe: process.execPath });
  const hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
  const cmd = hooks['tama-readonly-guard'].PreToolUse[0].hooks[0].command;
  assert.equal(hooks['tama-readonly-guard'].PreToolUse[0].matcher, '*');
  assert.doesNotMatch(cmd, /\s|"/); // agy escapes quotes; spaces would break cmd.exe
  assert.equal(fs.readFileSync(path.join(dir, '.agent', 'guard-allow.txt'), 'utf8'), setupMod.CHAT_ALLOW);
  if (process.platform === 'win32') {
    const ask = (/** @type {string} */ name) => JSON.parse(execFileSync('cmd', ['/d', '/c', cmd], { input: JSON.stringify({ toolCall: { name } }), encoding: 'utf8' }));
    assert.equal(ask('mcp_tama_docs_create').decision, 'allow');
    assert.equal(ask('write_file').decision, 'deny');
  }
});

// ---- model picks (D-086) ----
test('parseAgyModels reads id<TAB>name lines and skips the rest', () => {
  const { parseAgyModels } = require('./models');
  const out = parseAgyModels('Fetching available models...\ngemini-3.8-flash-low\tGemini 3.8 Flash (Low)\r\nclaude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)\nBad Id\tx\ngemini-3.8-flash-low\tdup\n\n');
  assert.deepEqual(out, [{ id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' }, { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' }]);
});

test('agyModelFor: picked id, else empty for missing or odd values', () => {
  const { agyModelFor } = require('./models');
  assert.equal(agyModelFor({ chat: 'claude-opus-4-6-thinking' }, 'chat'), 'claude-opus-4-6-thinking');
  assert.equal(agyModelFor({ chat: 'claude-opus-4-6-thinking' }, 'compose'), '');
  assert.equal(agyModelFor({ chat: '--dangerously-skip-permissions' }, 'chat'), '');
  assert.equal(agyModelFor(null, 'chat'), '');
});

test('agy provider: the default keeps low thinking; a pick sets only the model', () => {
  const { agyProvider } = require('./provider');
  let picks = {};
  const pv = /** @type {any} */ (agyProvider({ gate: /** @type {any} */ ({}), mcpServers: () => [], picks: () => picks }));
  const a = pv.compose(() => {}, '');
  assert.equal(a.model, 'gemini-3.8-flash-low'); assert.equal(a.thoughtLevel, 'low');
  picks = { chat: 'claude-opus-4-6-thinking' };
  const c = pv.chat(() => {}, '');
  assert.equal(c.model, 'claude-opus-4-6-thinking'); assert.equal(c.thoughtLevel, null);
  assert.match(pv.poweredBy(), /claude-opus-4-6-thinking/);
});

// ---- allowance (D-088) ----
const USAGE_OUT = 'Gemini Models\tWeekly Limit Remaining\t0%\t2026-12-03T16:22:27Z\r\nClaude and GPT models\tWeekly Limit Remaining\t86%\t2026-12-04T15:52:16Z\nClaude and GPT models\tFive Hour Limit Remaining\t86%\t2026-11-27T20:52:16Z\nnoise line\n';

test('parseAgyUsage: one window per line, keyed by bucket and window', () => {
  const { parseAgyUsage } = require('./usage');
  const w = parseAgyUsage(USAGE_OUT);
  assert.deepEqual(Object.keys(w), ['gemini.weekly', 'claude_gpt.weekly', 'claude_gpt.five_hour']);
  assert.equal(w['gemini.weekly'].used, 1);
  assert.equal(w['gemini.weekly'].label, 'Gemini · weekly');
  assert.equal(w['claude_gpt.five_hour'].label, 'Claude and GPT · five hour');
  assert.equal(Math.round(w['claude_gpt.weekly'].used * 100), 14);
  assert.equal(w['gemini.weekly'].resetsAt, Date.parse('2026-12-03T16:22:27Z'));
  assert.deepEqual(parseAgyUsage(''), {});
});

test('switchModel: off a used-up bucket to the best model with room, only when allowed and not yet reset', () => {
  const { parseAgyUsage, switchModel, bucketOf } = require('./usage');
  const w = parseAgyUsage(USAGE_OUT);
  const now = Date.parse('2026-11-27T15:00:00Z');
  const models = ['gemini-3.8-flash-low', 'claude-opus-4-6-thinking', 'claude-sonnet-4-6', 'gpt-oss-120b-medium'];
  assert.equal(bucketOf('gpt-oss-120b-medium', w), 'claude_gpt');
  assert.deepEqual(switchModel({ wanted: 'gemini-3.8-flash-low', windows: w, models, now, autoSwitch: true }),
    { model: 'claude-sonnet-4-6', switched: { from: 'gemini-3.8-flash-low', to: 'claude-sonnet-4-6', back: Date.parse('2026-12-03T16:22:27Z') } });
  assert.equal(switchModel({ wanted: 'gemini-3.8-flash-low', windows: w, models, now, autoSwitch: false }).model, 'gemini-3.8-flash-low');
  assert.equal(switchModel({ wanted: 'claude-opus-4-6-thinking', windows: w, models, now, autoSwitch: true }).switched, null);
  assert.equal(switchModel({ wanted: 'gemini-3.8-flash-low', windows: w, models, now: Date.parse('2026-12-04T00:00:00Z'), autoSwitch: true }).switched, null, 'after the reset');
  const both = parseAgyUsage(USAGE_OUT.replace(/86%/g, '0%'));
  assert.equal(switchModel({ wanted: 'gemini-3.8-flash-low', windows: both, models, now, autoSwitch: true }).switched, null, 'nowhere to go');
  assert.equal(switchModel({ wanted: 'claude-sonnet-4-6', windows: parseAgyUsage(USAGE_OUT.replace('\t0%', '\t50%').replace(/86%/g, '0%')), models, now, autoSwitch: true }).model, 'gemini-3.8-flash-low');
});

test('agy turns that come back as "quota reached" text are errors, not replies', async () => {
  const gate = createPermissionGate({ bus: new Bus() });
  /** @type {any[]} */ const evs = [];
  const e = new AgyEngine((ev) => evs.push(ev), { role: 'lite', gate });
  e.cwd = os.tmpdir(); e.sessionId = 's1';
  e.client = /** @type {any} */ ({ request: async () => { e.ctx.text = '⚠ Individual quota reached. Please upgrade your subscription. Resets in 144h16m19s.'; return { stopReason: 'end_turn' }; } });
  e.start = async () => {};
  await e.send('hi');
  const res = evs.find((x) => x.t === 'result');
  assert.equal(res.isError, true); assert.equal(res.subtype, 'quota'); assert.equal(res.text, '');
  assert.ok(evs.some((x) => x.t === 'error' && x.quota));
});
