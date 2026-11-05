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

test('first run with no kero-pet save hatches a fresh Tama and makes it active', () => {
  const store = createStore(tmp());
  const roster = createRoster({ bus: new Bus(), store, legacySaveFiles: [], newId: () => 'tama-a' });
  assert.deepEqual(roster.ensureActive(), { id: 'tama-a', name: 'Kero-chan' });
  assert.equal(store.read('active.json', 'active', () => ({})).activeTamaId, 'tama-a');
  assert.equal(store.exists('tamas/tama-a/state.json'), false); // pet service creates defaults
});

test('first run imports the most recent kero-pet save (keeps bond)', () => {
  const legacyDir = tmp();
  const older = path.join(legacyDir, 'a.json');
  const newer = path.join(legacyDir, 'b.json');
  fs.writeFileSync(older, JSON.stringify({ bond: 5, lastSeen: 100 }));
  fs.writeFileSync(newer, JSON.stringify({ bond: 64, lastSeen: 200, xp: 9 }));
  const store = createStore(tmp());
  const roster = createRoster({ bus: new Bus(), store, legacySaveFiles: [older, newer, path.join(legacyDir, 'missing.json')], newId: () => 'tama-k' });
  roster.ensureActive();
  const state = store.read('tamas/tama-k/state.json', 'tama-state', () => ({}));
  assert.equal(state.bond, 64);
  assert.equal(state.xp, 9);
  assert.equal(store.read('tamas/tama-k/character.json', 'character', () => ({})).importedFrom, 'kero-pet');
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
