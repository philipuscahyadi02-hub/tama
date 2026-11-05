// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logic = require('./logic');
const { createPetService } = require('.');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');

const T0 = 1_700_000_000_000;
const H = 3600000;

test('decay table (kero-pet numbers until the M2 rebalance)', () => {
  const s = logic.applyTime(logic.defaultState(T0), 2);
  assert.deepEqual([s.hunger, s.clean, s.happy, s.energy], [64, 72, 68, 70]);
});

test('sleeping recharges energy; auto-wake at 100', () => {
  let s = { ...logic.defaultState(T0), energy: 90, asleep: true };
  s = logic.applyTime(s, 1);
  assert.equal(s.energy, 100);
  const w = logic.autoWake(s);
  assert.equal(w.woke, true);
  assert.equal(w.state.asleep, false);
});

test('offline catch-up is capped at 48h and the pet never goes below 0 (never dies)', () => {
  const s = { ...logic.defaultState(T0), lastSeen: T0 - 1000 * H };
  const { state, hoursAway } = logic.catchUp(s, T0);
  assert.equal(hoursAway, logic.OFFLINE_CAP_HOURS);
  for (const k of /** @type {const} */ (['hunger', 'happy', 'energy', 'clean'])) assert.ok(state[k] >= 0);
});

test('actions: feed refused when full, play refused when tired, everything refused while asleep except sleep', () => {
  const base = logic.defaultState(T0);
  assert.equal(logic.act({ ...base, hunger: 99 }, 'feed').reason, 'full');
  assert.equal(logic.act({ ...base, energy: 10 }, 'play').reason, 'tired');
  assert.equal(logic.act({ ...base, asleep: true }, 'feed').reason, 'asleep');
  assert.equal(logic.act({ ...base, asleep: true }, 'sleep').state.asleep, false);
  assert.equal(logic.act(base, 'dance').ok, false);
});

test('service: act persists, finished agent task raises bond + xp, failed task does not', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-pet-'));
  const bus = new Bus();
  const store = createStore(dir);
  const svc = createPetService({ bus, store, tama: { id: 't1', name: 'Mochi' }, now: () => T0 });
  svc.start();
  const r = await bus.request('pet.act', { action: 'clean' });
  assert.equal(r.ok, true);
  const bond = svc.getState().bond;
  bus.emit('engine.event', { engine: 'claude', ev: { t: 'result', isError: true } });
  assert.equal(svc.getState().bond, bond);
  bus.emit('engine.event', { engine: 'claude', ev: { t: 'result', isError: false } });
  assert.equal(svc.getState().bond, bond + 1);
  assert.equal(svc.getState().xp, 1);
  svc.stop();
  const saved = store.read('tamas/t1/state.json', 'tama-state', () => ({}));
  assert.equal(saved.clean, 100);
  assert.equal(saved.xp, 1);
});
