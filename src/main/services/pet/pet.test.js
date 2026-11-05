// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logic = require('./logic');
const bond = require('./bond');
const { createPetService } = require('.');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const { migrate } = require('../../platform/store/migrations');

const T0 = new Date(2026, 10, 5, 10, 0, 0).getTime(); // local 10:00
const H = 3600000;
const base = () => logic.defaultState(T0);

// ---------------- needs & energy (PET-1..4) ----------------
test('awake decay table (rebalanced, gentler than kero-pet)', () => {
  const s = logic.applyTime(base(), 2);
  assert.deepEqual([s.hunger, s.clean, s.happy, s.energy], [68, 74, 72, 74]);
});

test('charging on AC: energy refills while awake instead of draining', () => {
  const s = logic.applyTime({ ...base(), energy: 50 }, 1, { charging: true });
  assert.equal(s.energy, 62);
});

test('sleep kinds recharge at different speeds; needs drain at half speed while asleep', () => {
  const nap = logic.applyTime({ ...base(), energy: 20, asleep: true, sleepKind: 'nap' }, 10 / 60);
  assert.equal(nap.energy, 70); // +50 in a 10-minute power nap
  const auto = logic.applyTime({ ...base(), energy: 20, asleep: true, sleepKind: 'auto' }, 1);
  assert.equal(auto.energy, 50);
  assert.equal(auto.hunger, 77);
});

test('power nap ends after 10 minutes; bedtime sleep ends at full energy; auto-nap waits for the user', () => {
  const napping = logic.act({ ...base(), energy: 30 }, 'nap', T0).state;
  assert.equal(logic.autoWake(napping, T0 + 9 * 60000).woke, false);
  assert.equal(logic.autoWake(napping, T0 + logic.NAP_MS).woke, true);
  assert.equal(logic.autoWake({ ...base(), asleep: true, sleepKind: 'sleep', energy: 100 }, T0).woke, true);
  assert.equal(logic.autoWake({ ...base(), asleep: true, sleepKind: 'auto', energy: 100 }, T0).woke, false);
});

test('snack: +25 energy with a 20 minute cooldown', () => {
  const r1 = logic.act({ ...base(), energy: 40 }, 'snack', T0);
  assert.equal(r1.state.energy, 65);
  const r2 = logic.act(r1.state, 'snack', T0 + 60000);
  assert.equal(r2.reason, 'cooldown');
  assert.ok((r2.retryInMs || 0) > 18 * 60000);
  assert.equal(logic.act(r1.state, 'snack', T0 + logic.SNACK_COOLDOWN_MS).ok, true);
});

test('app closed = resting: energy refills, other needs drain at half speed, capped at 48 h, never dies', () => {
  const { state, hoursAway } = logic.catchUp({ ...base(), energy: 10, lastSeen: T0 - 4 * H }, T0);
  assert.equal(hoursAway, 4);
  assert.equal(state.energy, 50);
  assert.equal(state.hunger, 68);
  const long = logic.catchUp({ ...base(), lastSeen: T0 - 1000 * H }, T0);
  assert.equal(long.hoursAway, logic.OFFLINE_CAP_HOURS);
  for (const k of /** @type {const} */ (['hunger', 'happy', 'energy', 'clean'])) assert.ok(long.state[k] >= 0);
});

test('a finished agent task costs only 1 energy (PET-4)', () => {
  const b = logic.questDone({ ...base(), energy: 50 }, T0);
  assert.equal(b.state.energy, 49);
  assert.equal(b.state.xp, 1);
});

test('actions refused with a reason the UI can use', () => {
  assert.equal(logic.act({ ...base(), hunger: 99 }, 'feed', T0).reason, 'full');
  assert.equal(logic.act({ ...base(), energy: 5 }, 'play', T0).reason, 'tired');
  assert.equal(logic.act({ ...base(), asleep: true }, 'feed', T0).reason, 'asleep');
  assert.equal(logic.act({ ...base(), energy: 99 }, 'nap', T0).reason, 'not-tired');
  assert.equal(logic.act(base(), 'dance', T0).ok, false);
});

// ---------------- bond (BOND-1..3) ----------------
test('levels: thresholds and progress', () => {
  assert.equal(bond.levelOf(0).title, 'Stranger');
  assert.equal(bond.levelOf(60).title, 'Acquaintance');
  assert.equal(bond.levelOf(1200).title, 'Soulmate');
  assert.equal(bond.levelOf(150).progress, 0.5);
  assert.equal(bond.levelOf(5000).next, null);
});

test('daily cap: full XP to the cap, 25% up to 2x, then nothing', () => {
  let s = base();
  let total = 0;
  for (let i = 0; i < 60; i++) { const r = bond.award(s, 'todo', T0); s = r.state; total += r.gained; }
  // 10 full (10 XP) + 40 quarter awards (10 XP) + 10 at zero, plus the 1 XP daily streak bonus
  assert.equal(total, 21);
  const tomorrow = bond.award(s, 'todo', T0 + 24 * H);
  assert.equal(tomorrow.gained, 2); // fresh cap (1) + streak day 2 (1)
});

test('streak: consecutive productive days count up, a gap resets, pats/play do not count', () => {
  let s = base();
  s = bond.award(s, 'pat', T0).state;
  assert.equal(s.streak.count, 0);
  for (let d = 0; d < 7; d++) s = bond.award(s, 'commit', T0 + d * 24 * H).state;
  assert.equal(s.streak.count, 7);
  const r = bond.award(s, 'focus', T0 + 9 * 24 * H);
  assert.equal(r.streak && r.streak.count, 1);
});

test('day 7 gives the streak bonus and can level you up', () => {
  let s = { ...base(), bondXp: 50 };
  /** @type {any} */ let last = null;
  for (let d = 0; d < 7; d++) { last = bond.award(s, 'focus', T0 + d * 24 * H); s = last.state; }
  assert.equal(last.streak.bonus, 6);
  assert.ok(s.bondXp >= 60);
});

test('migration: kero-pet bond 13 → 156 XP (Acquaintance), new fields added', () => {
  const out = migrate('tama-state', { hunger: 50, bond: 13, asleep: true, schemaVersion: 1 });
  assert.equal(out.bondXp, 156);
  assert.equal('bond' in out, false);
  assert.equal(out.sleepKind, 'sleep');
  assert.deepEqual(out.streak, { count: 0, lastDay: '' });
  assert.equal(out.schemaVersion, 2);
});

// ---------------- service ----------------
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-pet-'));
  const bus = new Bus();
  const store = createStore(dir);
  let t = T0;
  const svc = createPetService({ bus, store, tama: { id: 't1', name: 'Mochi' }, now: () => t });
  svc.start();
  return { bus, store, svc, advance: (/** @type {number} */ ms) => { t += ms; } };
}

test('service: productivity awards bond and announces it; care-only sources are refused', async () => {
  const { bus, svc } = setup();
  /** @type {any[]} */ const events = [];
  bus.on('pet.bond.changed', (e) => events.push(e));
  const r = await bus.request('pet.award', { source: 'focus' });
  assert.equal(r.gained, 4); // 3 + day-1 streak
  assert.equal(events[0].source, 'focus');
  assert.equal((await bus.request('pet.award', { source: 'pat' })).gained, 0);
  bus.emit('engine.event', { engine: 'claude', ev: { t: 'result', isError: false } });
  assert.equal(svc.getState().xp, 1);
  svc.stop();
});

test('service: idle → auto-nap, back → wake; failed agent task gives nothing', async () => {
  const { bus, svc, store } = setup();
  bus.emit('device.idle.changed', { idle: true, idleSeconds: 700 });
  assert.equal(svc.getState().sleepKind, 'auto');
  bus.emit('device.idle.changed', { idle: false, idleSeconds: 0 });
  assert.equal(svc.getState().asleep, false);
  const xp = svc.getState().bondXp;
  bus.emit('engine.event', { engine: 'claude', ev: { t: 'result', isError: true } });
  assert.equal(svc.getState().bondXp, xp);
  await bus.request('pet.act', { action: 'clean' });
  svc.stop();
  assert.equal(store.read('tamas/t1/state.json', 'tama-state', () => ({})).clean, 100);
});

test('service: snapshot carries level + charging', async () => {
  const { bus, svc } = setup();
  bus.emit('device.power.changed', { onAC: true });
  const snap = await bus.request('pet.get');
  assert.equal(snap.charging, true);
  assert.equal(snap.level.title, 'Stranger');
  svc.stop();
});
