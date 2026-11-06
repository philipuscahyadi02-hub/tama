// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const { createDeviceSettings } = require('../../platform/store/device');
const { createUiPrefs } = require('.');

function setup(levelIndex = 0) {
  const bus = new Bus();
  const device = createDeviceSettings(createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'tama-ui-'))));
  const lvl = { index: levelIndex };
  bus.handle('pet.get', () => ({ level: lvl }));
  const ui = createUiPrefs({ bus, device });
  const stop = ui.start();
  /** @type {any[]} */ const notices = [];
  bus.on('brain.notice', (n) => notices.push(n));
  return { bus, ui, stop, lvl, notices, device };
}

test('terminal theme: night by default; locked variants are refused until the bond level allows (BOND-3)', async () => {
  const { bus, stop, lvl, device } = setup(0);
  const g = await bus.request('ui.prefs.get');
  assert.equal(g.termTheme, 'night');
  assert.deepEqual(g.unlocked, ['night']);
  assert.equal((await bus.request('ui.prefs.set', { termTheme: 'day' })).error, 'locked');
  lvl.index = 1;
  const ok = await bus.request('ui.prefs.set', { termTheme: 'day' });
  assert.equal(ok.termTheme, 'day');
  assert.equal(device.get().ui.termTheme, 'day');
  assert.match((await bus.request('ui.prefs.set', { termTheme: 'rainbow' })).error, /Unknown theme/);
  stop();
});

test('tour flag persists; a level-up that unlocks a theme announces it', async () => {
  const { bus, stop, notices } = setup(0);
  assert.equal((await bus.request('ui.prefs.set', { tourDone: true })).tourDone, true);
  bus.emit('pet.bond.changed', { source: 'agent', gained: 5, levelUp: { index: 1, title: 'Acquaintance' }, streak: null });
  bus.emit('pet.bond.changed', { source: 'agent', gained: 5, levelUp: { index: 2, title: 'Buddy' }, streak: null });
  assert.equal(notices.length, 1);
  assert.match(notices[0].text, /\/theme day/);
  stop();
});

test('walk marker pref: on by default, can be turned off per PC (SUM-5, D-035)', async () => {
  const { bus, stop, device } = setup(0);
  assert.equal((await bus.request('ui.prefs.get')).walkMarker, true);
  assert.equal((await bus.request('ui.prefs.set', { walkMarker: false })).walkMarker, false);
  assert.equal(device.get().ui.walkMarker, false);
  stop();
});
