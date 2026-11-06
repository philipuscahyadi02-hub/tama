// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('child_process');
const { createChatTools, jsonSchema } = require('./chat-tools');
const { startToolBridge } = require('../platform/tool-bridge');
const { Bus } = require('../bus');

/** @returns {any[]} fake Google tools with the real policies */
function fakeTools(/** @type {string[]} */ ran) {
  /** @param {string} name @param {'read'|'create'|'edit'} policy */
  const t = (name, policy) => ({
    name, title: name, policy, description: `${name} tool`, params: { title: { type: 'string', desc: 'title' }, rows: { type: 'rows', desc: 'rows', optional: true } },
    run: async (/** @type {any} */ a) => { ran.push(name); return { ok: true, got: a }; },
  });
  return [t('calendar_list_events', 'read'), t('sheets_create', 'create'), t('docs_append', 'edit')];
}

test('chat tools: reads run at once; creations and edits wait for the user (D-037)', async () => {
  const bus = new Bus();
  /** @type {string[]} */ const ran = [];
  /** @type {any[]} */ const evs = [];
  bus.on('chat.event', (e) => evs.push(e));
  const ct = createChatTools({ bus, tools: () => fakeTools(ran) });
  const stop = ct.start();
  const list = await ct.list();
  assert.deepEqual(list.map((t) => t.name), ['calendar_list_events', 'sheets_create', 'docs_append']);
  assert.match(list[1].description, /confirm/);
  assert.equal(list[0].annotations.readOnlyHint, true);

  const r1 = await ct.call('calendar_list_events', { title: 'x' });
  assert.match(r1.text, /"ok": true/);
  assert.deepEqual(ran, ['calendar_list_events']);
  assert.equal(evs.filter((e) => e.t === 'confirm').length, 0);

  const p2 = ct.call('sheets_create', { title: 'Gym', sheets: [] });
  await new Promise((r) => setTimeout(r, 5));
  const ask = evs.find((e) => e.t === 'confirm');
  assert.match(ask.text, /Create a Google Sheet "Gym"/);
  assert.deepEqual(ran, ['calendar_list_events']); // not yet
  assert.deepEqual(await bus.request('chat.confirm', { id: ask.id, yes: true }), { ok: true });
  await p2;
  assert.deepEqual(ran, ['calendar_list_events', 'sheets_create']);

  const p3 = ct.call('docs_append', { title: 'x' });
  await new Promise((r) => setTimeout(r, 5));
  const ask2 = evs.filter((e) => e.t === 'confirm').at(-1);
  await bus.request('chat.confirm', { id: ask2.id, yes: false });
  assert.match((await p3).text, /declined/);
  assert.equal(ran.includes('docs_append'), false);
  assert.match((await ct.call('gmail_send', {})).text, /Unknown tool/); // nothing that isn't on the list
  stop();
});

test('jsonSchema builds MCP input schemas', () => {
  const s = jsonSchema({ a: { type: 'string', desc: 'A' }, b: { type: 'tabs', desc: 'B', optional: true } });
  assert.deepEqual(s.required, ['a']);
  assert.equal(s.properties.b.items.properties.rows.type, 'array');
});

test('bridge + relay: MCP over stdio reaches Tama\'s tools; a wrong key is refused', async () => {
  /** @type {any[]} */ const calls = [];
  const bridge = await startToolBridge({
    list: () => [{ name: 'echo', description: 'echo', inputSchema: { type: 'object', properties: {} } }],
    call: async (name, args) => { calls.push([name, args]); return { text: `echo:${args.x}` }; },
  });
  const bad = await fetch(`${bridge.url}/list`, { method: 'POST', headers: { authorization: 'Bearer nope' }, body: '{}' });
  assert.equal(bad.status, 403);

  const relay = spawn(process.execPath, [path.join(__dirname, '..', 'engines', 'agy', 'mcp-relay.js')], {
    env: { ...process.env, TAMA_BRIDGE_URL: bridge.url, TAMA_BRIDGE_KEY: bridge.key }, stdio: ['pipe', 'pipe', 'inherit'],
  });
  /** @type {Map<number, (v: any) => void>} */ const waiting = new Map();
  let buf = '';
  relay.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); const w = waiting.get(m.id); if (w) w(m); }
  });
  const rpc = (/** @type {number} */ id, /** @type {string} */ method, /** @type {any} */ params) => new Promise((resolve) => {
    waiting.set(id, resolve);
    relay.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  const init = /** @type {any} */ (await rpc(1, 'initialize', { protocolVersion: '2025-06-18' }));
  assert.equal(init.result.serverInfo.name, 'tama');
  relay.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const list = /** @type {any} */ (await rpc(2, 'tools/list', {}));
  assert.equal(list.result.tools[0].name, 'echo');
  const call = /** @type {any} */ (await rpc(3, 'tools/call', { name: 'echo', arguments: { x: 42 } }));
  assert.equal(call.result.content[0].text, 'echo:42');
  assert.deepEqual(calls, [['echo', { x: 42 }]]);
  relay.stdin.end();
  bridge.close();
});
