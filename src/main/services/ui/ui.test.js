// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const { createDeviceSettings } = require('../../platform/store/device');
const { createUiPrefs, inQuietHours } = require('.');

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

test('quiet hours: windows across midnight and within a day; bad times are refused (M10)', async () => {
  const at = (/** @type {string} */ hm) => new Date(`2026-11-07T${hm}:00`);
  const rows = [['23:30', '23:00', '08:00', true], ['07:59', '23:00', '08:00', true], ['08:00', '23:00', '08:00', false], ['12:00', '23:00', '08:00', false],
    ['13:00', '12:30', '14:00', true], ['14:00', '12:30', '14:00', false], ['10:00', '10:00', '10:00', false], ['10:00', 'bad', '11:00', false]];
  for (const [t, a, b, want] of rows) assert.equal(inQuietHours(at(String(t)), String(a), String(b)), want, `${t} in ${a}-${b}`);

  const { bus, stop } = setup(0);
  const off = await bus.request('ui.prefs.get');
  assert.deepEqual(off.quiet, { on: false, from: '23:00', to: '08:00' });
  assert.equal(off.quietNow, false);
  assert.match((await bus.request('ui.prefs.set', { quiet: { on: true, from: '25:00' } })).error, /23:00/);
  const r = await bus.request('ui.prefs.set', { quiet: { on: true, from: '00:00', to: '23:59' } });
  assert.equal(r.quiet.on, true);
  assert.equal(typeof r.quietNow, 'boolean');
  stop();
});

test('reply language: auto by default, en/id/ja accepted, others refused (M10)', async () => {
  const { bus, stop, device } = setup(0);
  assert.equal((await bus.request('ui.prefs.get')).replyLang, 'auto');
  assert.equal((await bus.request('ui.prefs.set', { replyLang: 'en' })).replyLang, 'en');
  assert.equal(device.get().ui.replyLang, 'en');
  assert.match((await bus.request('ui.prefs.set', { replyLang: 'klingon' })).error, /Unknown language/);
  stop();
});
