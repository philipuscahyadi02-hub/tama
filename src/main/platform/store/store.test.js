// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore } = require('.');
const { createDeviceSettings } = require('./device');
const { migrate, currentVersion } = require('./migrations');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tama-store-'));

test('write stamps schemaVersion; read round-trips', () => {
  const store = createStore(tmp());
  store.write('tamas/t1/state.json', 'tama-state', { hunger: 50 });
  const back = store.read('tamas/t1/state.json', 'tama-state', () => ({}));
  assert.equal(back.hunger, 50);
  assert.equal(back.schemaVersion, currentVersion('tama-state'));
});

test('legacy kero-pet state (no schemaVersion) is migrated all the way with defaults filled in', () => {
  const out = migrate('tama-state', { hunger: 10, bond: 77 });
  assert.equal(out.bondXp, 924);
  assert.equal(out.hunger, 10);
  assert.equal(out.energy, 80);
  assert.equal(out.schemaVersion, 2);
});

test('a file from a newer app version is refused, not silently downgraded', () => {
  assert.throws(() => migrate('device', { schemaVersion: 99 }), /newer Tama/);
});

test('missing file → fallback; corrupt file → moved aside + fallback', () => {
  const dir = tmp();
  const store = createStore(dir);
  assert.deepEqual(store.read('device.json', 'device', () => ({ fresh: true })), { fresh: true });
  fs.writeFileSync(path.join(dir, 'device.json'), '{not json');
  assert.deepEqual(store.read('device.json', 'device', () => ({ fresh: true })), { fresh: true });
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('device.json.corrupt-')));
});

test('paths cannot escape the store root', () => {
  const store = createStore(tmp());
  assert.throws(() => store.write('../evil.json', 'device', {}), /escapes root/);
  // a sibling folder that merely starts with the same name must also be rejected
  assert.throws(() => store.write(`../${path.basename(store.rootDir)}2/x.json`, 'device', {}), /escapes root/);
});

test('writeSoon + flush writes the latest data once', () => {
  const store = createStore(tmp());
  let n = 1;
  store.writeSoon('device.json', 'device', () => ({ n }), 60000);
  n = 2;
  store.flush();
  assert.equal(store.read('device.json', 'device', () => ({})).n, 2);
});

test('device settings: patches from different modules do not clobber each other', () => {
  const store = createStore(tmp());
  const device = createDeviceSettings(store);
  device.patch('engine', { cwd: 'C:/repo' });
  device.patch('windows', { pet: { x: 1, y: 2 } });
  device.patch('engine', { mode: 'plan' });
  store.flush();
  const back = store.read('device.json', 'device', () => ({}));
  assert.deepEqual(back.engine, { cwd: 'C:/repo', mode: 'plan' });
  assert.deepEqual(back.windows, { pet: { x: 1, y: 2 } });
});
