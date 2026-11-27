// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAwake, wantAwake, GRACE_MS } = require('.');
const { Bus } = require('../../bus');
const { TOPICS } = require('../../bus-topics');

test('awake: off / always / while working with a 5-minute grace', () => {
  const base = { busy: false, playing: false, lastActiveAt: -Infinity, now: 1e9 };
  assert.equal(wantAwake({ ...base, mode: 'off', busy: true }), false);
  assert.equal(wantAwake({ ...base, mode: 'always' }), true);
  assert.equal(wantAwake({ ...base, mode: 'working' }), false);
  assert.equal(wantAwake({ ...base, mode: 'working', busy: true }), true);
  assert.equal(wantAwake({ ...base, mode: 'working', playing: true }), true);
  assert.equal(wantAwake({ ...base, mode: 'working', lastActiveAt: 1e9 - GRACE_MS + 1000 }), true);
  assert.equal(wantAwake({ ...base, mode: 'working', lastActiveAt: 1e9 - GRACE_MS - 1 }), false);
});

test('awake: a Claude turn or music keeps the PC awake, then it lets go after the grace', async () => {
  const bus = new Bus();
  let t = 0;
  /** @type {boolean[]} */ const calls = [];
  bus.handle(TOPICS.UI_PREFS_GET, () => ({ keepAwake: 'working' }));
  const a = createAwake({ bus, keepAwake: (on) => { calls.push(on); return on; }, now: () => t });
  const stop = a.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(a.isOn(), false);
  bus.emit(TOPICS.ENGINE_EVENT, { engine: 'claude', role: 'worker', ev: { t: 'status', state: 'thinking' } });
  assert.equal(a.isOn(), true);
  t = 1000;
  bus.emit(TOPICS.ENGINE_EVENT, { engine: 'claude', role: 'worker', ev: { t: 'status', state: 'idle' } });
  assert.equal(a.isOn(), true, 'grace period');
  t = 1000 + GRACE_MS + 1;
  a.update();
  assert.equal(a.isOn(), false);
  bus.emit(TOPICS.MUSIC_CHANGED, { state: { playing: true } });
  assert.equal(a.isOn(), true);
  bus.emit(TOPICS.UI_PREFS_CHANGED, { keepAwake: 'off' });
  assert.equal(a.isOn(), false);
  stop();
  assert.deepEqual(calls, [true, false, true, false]);
});
