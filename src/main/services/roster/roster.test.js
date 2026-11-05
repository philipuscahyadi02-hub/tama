// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRoster } = require('.');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tama-roster-'));

test('first run with no kero-pet save creates an egg and makes it active', () => {
  const store = createStore(tmp());
  const roster = createRoster({ bus: new Bus(), store, legacySaveFiles: [], newId: () => 'tama-a' });
  assert.deepEqual(roster.ensureActive(), { id: 'tama-a', name: 'Tama', stage: 'egg' });
  assert.equal(store.read('active.json', 'active', () => ({})).activeTamaId, 'tama-a');
  assert.equal(store.exists('tamas/tama-a/state.json'), false); // pet service creates defaults
});

test('first run imports the most recent kero-pet save as a hatched Kero-chan (keeps bond)', () => {
  const legacyDir = tmp();
  const older = path.join(legacyDir, 'a.json');
  const newer = path.join(legacyDir, 'b.json');
  fs.writeFileSync(older, JSON.stringify({ bond: 5, lastSeen: 100 }));
  fs.writeFileSync(newer, JSON.stringify({ bond: 64, lastSeen: 200, xp: 9 }));
  const store = createStore(tmp());
  const roster = createRoster({ bus: new Bus(), store, legacySaveFiles: [older, newer, path.join(legacyDir, 'missing.json')], newId: () => 'tama-k' });
  assert.deepEqual(roster.ensureActive(), { id: 'tama-k', name: 'Kero-chan', stage: 'hatched' });
  const state = store.read('tamas/tama-k/state.json', 'tama-state', () => ({}));
  assert.equal(state.bond, 64);
  assert.equal(state.xp, 9);
  const ch = store.read('tamas/tama-k/character.json', 'character', () => ({}));
  assert.equal(ch.importedFrom, 'kero-pet');
  assert.equal(ch.parts.headwear, 'frog-hood');
});

test('later runs reuse the active Tama and never re-import', () => {
  const store = createStore(tmp());
  let n = 0;
  const roster = createRoster({ bus: new Bus(), store, newId: () => `tama-${++n}` });
  const first = roster.ensureActive();
  const second = roster.ensureActive();
  assert.equal(first.id, second.id);
  assert.equal(n, 1);
});

test('M0 character.json (preset only) is migrated to a full Kero-chan spec', () => {
  const store = createStore(tmp());
  fs.mkdirSync(path.join(store.rootDir, 'tamas', 'old'), { recursive: true });
  fs.writeFileSync(path.join(store.rootDir, 'tamas', 'old', 'character.json'),
    JSON.stringify({ name: 'Kero-chan', preset: 'kero', gender: 'girl', createdAt: 5, importedFrom: 'kero-pet', schemaVersion: 1 }));
  fs.writeFileSync(path.join(store.rootDir, 'active.json'), JSON.stringify({ activeTamaId: 'old', schemaVersion: 1 }));
  const roster = createRoster({ bus: new Bus(), store });
  assert.deepEqual(roster.ensureActive(), { id: 'old', name: 'Kero-chan', stage: 'hatched' });
});

test('character.save: hatch resets stats, restyle keeps them, rebirth can keep bond', async () => {
  const bus = new Bus();
  const store = createStore(tmp());
  const roster = createRoster({ bus, store, newId: () => 'tama-e', now: () => 1000 });
  const active = roster.ensureActive();
  roster.start(active);
  /** @type {any[]} */ const changes = [];
  bus.on('character.changed', (c) => changes.push(c));

  const hatched = await bus.request('character.save', { mode: 'hatch', spec: { name: 'Mochi', gender: 'boy', parts: { headwear: 'cat-ears', outfit: 'nonsense' } } });
  assert.equal(hatched.spec.name, 'Mochi');
  assert.equal(hatched.spec.parts.headwear, 'cat-ears');
  assert.equal(hatched.spec.parts.outfit, 'hoodie'); // unknown part → gender default
  assert.equal(changes[0].resetState, 'all');
  assert.equal((await bus.request('character.get')).stage, 'hatched');

  await bus.request('character.save', { mode: 'restyle', spec: { ...hatched.spec, palette: { ...hatched.spec.palette, hair: '#5b9cff' } } });
  assert.equal(changes[1].resetState, 'none');
  await bus.request('character.save', { mode: 'rebirth', keepBond: true, spec: { name: 'Yuki', gender: 'girl' } });
  assert.equal(changes[2].resetState, 'keep-bond');
  await assert.rejects(bus.request('character.save', { mode: 'delete', spec: {} }), /bad mode/);
});
