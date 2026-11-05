// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const bundle = require('./bundle');
const { createRoster } = require('.');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const realFiles = require('../../platform/files');

const tmp = (/** @type {string} */ p = 'tama-life-') => fs.mkdtempSync(path.join(os.tmpdir(), p));
const sample = () => /** @type {any} */ ({
  format: 'tama-bundle', version: 1, exportedAt: 1, app: 'tama test',
  tama: { name: 'Mochi', files: { 'character.json': JSON.stringify({ name: 'Mochi', gender: 'boy', schemaVersion: 2 }), 'memory/diary/day1.md': '# hi' } },
});

// ---------------- bundle format ----------------
test('bundle: round trip plain and encrypted; wrong/missing password refused', () => {
  const plain = bundle.encode(sample());
  assert.equal(bundle.isEncrypted(plain), false);
  assert.equal(bundle.decode(plain).tama.name, 'Mochi');
  const enc = bundle.encode(sample(), 'hunter2');
  assert.equal(bundle.isEncrypted(enc), true);
  assert.ok(!enc.toString('latin1').includes('Mochi'), 'name must not be readable in an encrypted file');
  assert.equal(bundle.decode(enc, 'hunter2').tama.files['memory/diary/day1.md'], '# hi');
  assert.throws(() => bundle.decode(enc), (e) => /** @type {any} */ (e).code === 'NEED_PASSWORD');
  assert.throws(() => bundle.decode(enc, 'nope'), (e) => /** @type {any} */ (e).code === 'BAD_PASSWORD');
});

test('bundle: connections need a password; tampering and unsafe paths are rejected', () => {
  assert.throws(() => bundle.encode({ ...sample(), connections: { 'telegram.token': 'x' } }), /password/);
  const enc = bundle.encode(sample(), 'pw');
  enc[enc.length - 1] ^= 0xff; // flip a byte
  assert.throws(() => bundle.decode(enc, 'pw'), /Wrong password|damaged/);
  assert.throws(() => bundle.decode(Buffer.from('PK\x03\x04 zip?')), /not a .tama/);
  for (const bad of ['../evil.json', 'a/../../b.json', 'C:/x.json', 'x.exe', '/abs.json']) {
    const b = sample(); b.tama.files[bad] = '{}';
    const buf = Buffer.concat([Buffer.from('TAMA'), Buffer.from([1, 0]), zlib.gzipSync(Buffer.from(JSON.stringify(b)))]);
    assert.throws(() => bundle.decode(buf), /Unsafe file name/, bad);
  }
});

// ---------------- lifecycle ----------------
function setup() {
  const store = createStore(tmp());
  const bus = new Bus();
  let n = 0;
  let relaunches = 0;
  const secretsMap = new Map([['telegram.token', '123:abc'], ['google.refresh', 'nope']]);
  const secrets = { keys: () => [...secretsMap.keys()], get: (/** @type {string} */ k) => secretsMap.get(k) ?? null, set: (/** @type {string} */ k, /** @type {string} */ v) => secretsMap.set(k, v) };
  const roster = createRoster({ bus, store, newId: () => `t${++n}`, relaunch: () => { relaunches++; }, files: realFiles, secrets, now: () => 5000 });
  const active = roster.ensureActive();
  roster.start(active);
  return { store, bus, active, secretsMap, relaunches: () => relaunches };
}

test('hatch another → new egg becomes active + relaunch; list shows statuses', async () => {
  const { bus, store, relaunches } = setup();
  const r = await bus.request('roster.hatchNew');
  assert.equal(r.relaunching, true);
  assert.equal(relaunches(), 1);
  assert.equal(store.read('active.json', 'active', () => ({})).activeTamaId, 't2');
  const list = (await bus.request('roster.get')).tamas;
  assert.deepEqual(list.map((/** @type {any} */ t) => [t.id, t.status, t.stage]), [['t1', 'active', 'egg'], ['t2', 'home', 'egg']]);
  // (this process still thinks t1 is active until the relaunch)
});

test('switching back un-pauses: no decay for time spent at home', async () => {
  const { bus, store } = setup();
  await bus.request('roster.hatchNew');
  store.write('tamas/t2/state.json', 'tama-state', { hunger: 50, lastSeen: 1 });
  await bus.request('roster.switch', { id: 't2' });
  assert.equal(store.read('tamas/t2/state.json', 'tama-state', () => ({})).lastSeen, 5000);
});

test('graduate / restore / delete (typed name, never the active one)', async () => {
  const { bus } = setup();
  await bus.request('roster.hatchNew'); // t2 at home
  assert.equal((await bus.request('roster.graduate', { id: 't2' })).ok, true);
  let list = (await bus.request('roster.get')).tamas;
  assert.equal(list.find((/** @type {any} */ t) => t.id === 't2').status, 'graduated');
  await bus.request('roster.restore', { id: 't2' });
  list = (await bus.request('roster.get')).tamas;
  assert.equal(list.find((/** @type {any} */ t) => t.id === 't2').status, 'home');
  assert.match((await bus.request('roster.delete', { id: 't2', confirmName: 'tama' })).error, /exactly/);
  assert.match((await bus.request('roster.delete', { id: 't1', confirmName: 'Tama' })).error, /Switch to another/);
  assert.equal((await bus.request('roster.delete', { id: 't2', confirmName: 'Tama' })).ok, true);
  assert.equal((await bus.request('roster.get')).tamas.length, 1);
  await assert.rejects(bus.request('roster.graduate', { id: '../../etc' }), /No such Tama/);
});

test('graduating the active Tama hatches a new egg first', async () => {
  const { bus, store } = setup();
  const r = await bus.request('roster.graduate', { id: 't1' });
  assert.equal(r.graduated, 't1');
  assert.equal(store.read('active.json', 'active', () => ({})).activeTamaId, 't2');
});

test('export → import: new id, character + state + user data, connections only with password', async () => {
  const a = setup();
  await a.bus.request('character.save', { mode: 'hatch', spec: { name: 'Yuki', gender: 'girl', parts: { headwear: 'bunny-hood' } } });
  a.store.write('tamas/t1/state.json', 'tama-state', { hunger: 42, bondXp: 300, lastSeen: 1 });
  a.store.write('user/productivity.json', 'productivity', { todos: [{ id: 'x', text: 'carry over', done: false }] });
  const out = path.join(tmp('tama-exp-'), 'Yuki.tama');
  assert.match((await a.bus.request('roster.export', { id: 't1', filePath: out, includeConnections: true })).error, /password/);
  const ex = await a.bus.request('roster.export', { id: 't1', filePath: out, password: 'pw', includeUser: true, includeConnections: true });
  assert.equal(ex.encrypted, true);

  const b = setup(); // a different "PC"
  b.secretsMap.clear();
  const need = await b.bus.request('roster.import', { filePath: out });
  assert.equal(need.code, 'NEED_PASSWORD');
  const im = await b.bus.request('roster.import', { filePath: out, password: 'pw', includeUser: true });
  assert.equal(im.ok, true);
  assert.equal(im.name, 'Yuki');
  assert.equal(im.connections, 1);
  assert.equal(b.secretsMap.get('telegram.token'), '123:abc');
  assert.equal(b.secretsMap.has('google.refresh'), false); // only telegram.* travels
  const st = b.store.read(`tamas/${im.id}/state.json`, 'tama-state', () => ({}));
  assert.equal(st.bondXp, 300);
  assert.equal(st.lastSeen, 5000); // no decay for the trip
  assert.equal(b.store.read('user/productivity.json', 'productivity', () => ({})).todos[0].text, 'carry over');
  const ch = b.store.read(`tamas/${im.id}/character.json`, 'character', () => ({}));
  assert.equal(ch.parts.headwear, 'bunny-hood');
  assert.equal(ch.importedFrom, 'tama-file');
});
