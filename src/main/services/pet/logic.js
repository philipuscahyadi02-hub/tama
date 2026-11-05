// @ts-check
// Pure pet math: needs, energy, sleep/naps, care actions (PET-1..4, D-023).
// Every function returns a NEW state; the clock comes in as `now`, nothing touches disk or Electron.
const bond = require('./bond');

/**
 * @typedef {Object} PetState
 * @property {number} schemaVersion
 * @property {number} hunger  0..100 ("Tummy")
 * @property {number} happy   0..100 ("Mood")
 * @property {number} energy  0..100
 * @property {number} clean   0..100
 * @property {number} bondXp  total bond XP (levels in bond.js)
 * @property {boolean} asleep
 * @property {null|'sleep'|'nap'|'auto'} sleepKind  bedtime / 10-min power nap / auto-nap while PC idle
 * @property {number} napUntil
 * @property {number} bornAt
 * @property {number} lastSeen
 * @property {number} xp      finished agent tasks ("quests")
 * @property {number} pats
 * @property {{ snack: number }} cooldowns  timestamps when each becomes available
 * @property {{ day: string, xp: Record<string, number> }} daily
 * @property {{ count: number, lastDay: string }} streak
 */

/** Per hour while awake. Gentler than kero-pet (8/6/4/5). */
const DECAY = { hunger: 6, happy: 4, clean: 3, energy: 3 };
/** Energy gained per hour by sleep kind / charging / app closed. */
const RECHARGE = { sleep: 25, nap: 300, auto: 30, charging: 12, offline: 10 };
const NAP_MS = 10 * 60 * 1000;
const SNACK_COOLDOWN_MS = 20 * 60 * 1000;
const OFFLINE_CAP_HOURS = 48;

/** @param {number} v */
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v * 100) / 100));

/** @param {number} now @returns {PetState} */
function defaultState(now) {
  return {
    schemaVersion: 2, hunger: 80, happy: 80, energy: 80, clean: 80, bondXp: 0,
    asleep: false, sleepKind: null, napUntil: 0, bornAt: now, lastSeen: now, xp: 0, pats: 0,
    cooldowns: { snack: 0 }, daily: { day: '', xp: {} }, streak: { count: 0, lastDay: '' },
  };
}

/**
 * Advance needs by `hours`. Asleep: energy refills by sleep kind and needs drain at half speed.
 * Awake and charging (laptop on AC): energy slowly refills instead of draining (PET-3).
 * @param {PetState} s @param {number} hours @param {{ charging?: boolean }} [ctx]
 */
function applyTime(s, hours, ctx = {}) {
  if (hours <= 0) return s;
  const slow = s.asleep ? 0.5 : 1;
  const hunger = clamp(s.hunger - DECAY.hunger * hours * slow);
  let energy;
  if (s.asleep) energy = s.energy + RECHARGE[s.sleepKind || 'sleep'] * hours;
  else if (ctx.charging) energy = s.energy + RECHARGE.charging * hours;
  else energy = s.energy - DECAY.energy * hours;
  return {
    ...s,
    hunger,
    clean: clamp(s.clean - DECAY.clean * hours * slow),
    happy: clamp(s.happy - DECAY.happy * hours * slow * (hunger < 25 ? 1.5 : 1)),
    energy: clamp(energy),
  };
}

/**
 * Catch up after the app was closed (capped at 48 h). You were away, so she rested: energy refills,
 * other needs drain at half speed, and any nap is over.
 * @param {PetState} s @param {number} now
 */
function catchUp(s, now) {
  const hoursAway = Math.max(0, Math.min(OFFLINE_CAP_HOURS, (now - s.lastSeen) / 3600000));
  const hunger = clamp(s.hunger - DECAY.hunger * hoursAway * 0.5);
  const state = {
    ...s, hunger,
    clean: clamp(s.clean - DECAY.clean * hoursAway * 0.5),
    happy: clamp(s.happy - DECAY.happy * hoursAway * 0.5),
    energy: clamp(s.energy + RECHARGE.offline * hoursAway),
    asleep: false, sleepKind: null, napUntil: 0, lastSeen: now,
  };
  return { state, hoursAway };
}

/** End naps and full-battery bedtime sleep. Auto-naps end when the user is back (service). @param {PetState} s @param {number} now */
function autoWake(s, now) {
  if (!s.asleep) return { state: s, woke: false };
  const napDone = s.sleepKind === 'nap' && now >= s.napUntil;
  const full = s.sleepKind === 'sleep' && s.energy >= 100;
  if (!napDone && !full) return { state: s, woke: false };
  return { state: { ...s, asleep: false, sleepKind: null, napUntil: 0 }, woke: true };
}

/** @param {PetState} s @param {'auto'} kind */
const fallAsleep = (s, kind) => (s.asleep ? s : { ...s, asleep: true, sleepKind: kind, napUntil: 0 });
/** @param {PetState} s */
const wakeFromAutoNap = (s) => (s.asleep && s.sleepKind === 'auto' ? { ...s, asleep: false, sleepKind: null } : s);

/**
 * Care actions. Returns { ok, reason?, state, award? }. `reason` lets the UI pick an in-character line.
 * @param {PetState} s @param {string} action @param {number} now
 * @returns {{ok: boolean, reason?: string, state: PetState, retryInMs?: number, bond?: { state: PetState, gained: number, levelUp: any, streak: any }}}
 */
function act(s, action, now) {
  const wakes = action === 'sleep' || action === 'nap';
  if (s.asleep && !wakes) return { ok: false, reason: 'asleep', state: s };
  switch (action) {
    case 'feed':
      if (s.hunger > 95) return { ok: false, reason: 'full', state: s };
      return { ok: true, state: { ...s, hunger: clamp(s.hunger + 25), happy: clamp(s.happy + 4) } };
    case 'snack': {
      const wait = (s.cooldowns?.snack || 0) - now;
      if (wait > 0) return { ok: false, reason: 'cooldown', retryInMs: wait, state: s };
      if (s.energy > 95) return { ok: false, reason: 'full-energy', state: s };
      return {
        ok: true,
        state: { ...s, energy: clamp(s.energy + 25), hunger: clamp(s.hunger + 5), cooldowns: { ...s.cooldowns, snack: now + SNACK_COOLDOWN_MS } },
      };
    }
    case 'play': {
      if (s.energy < 10) return { ok: false, reason: 'tired', state: s };
      const b = bond.award({ ...s, happy: clamp(s.happy + 15), energy: clamp(s.energy - 6), hunger: clamp(s.hunger - 3) }, 'play', now);
      return { ok: true, state: b.state, bond: b };
    }
    case 'clean':
      return { ok: true, state: { ...s, clean: 100, happy: clamp(s.happy + 5) } };
    case 'sleep':
      return s.asleep
        ? { ok: true, reason: 'woke', state: { ...s, asleep: false, sleepKind: null, napUntil: 0 } }
        : { ok: true, reason: 'slept', state: { ...s, asleep: true, sleepKind: 'sleep', napUntil: 0 } };
    case 'nap':
      if (s.asleep) return { ok: false, reason: 'already-asleep', state: s };
      if (s.energy >= 95) return { ok: false, reason: 'not-tired', state: s };
      return { ok: true, reason: 'napping', state: { ...s, asleep: true, sleepKind: 'nap', napUntil: now + NAP_MS } };
    case 'pat': {
      const b = bond.award({ ...s, pats: s.pats + 1, happy: clamp(s.happy + 3) }, 'pat', now);
      return { ok: true, state: b.state, bond: b };
    }
    default:
      return { ok: false, reason: 'unknown-action', state: s };
  }
}

/** A finished agent task ("quest"): small cost, happy, bond (PET-4). @param {PetState} s @param {number} now */
function questDone(s, now) {
  return bond.award({ ...s, xp: s.xp + 1, happy: clamp(s.happy + 5), energy: clamp(s.energy - 1), hunger: clamp(s.hunger - 1) }, 'agent', now);
}

module.exports = {
  DECAY, RECHARGE, NAP_MS, SNACK_COOLDOWN_MS, OFFLINE_CAP_HOURS,
  clamp, defaultState, applyTime, catchUp, autoWake, fallAsleep, wakeFromAutoNap, act, questDone,
};
