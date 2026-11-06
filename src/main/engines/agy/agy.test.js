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
  await new Promise((r) => setTimeout(r, 50));
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
