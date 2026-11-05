// @ts-check
// Pure pet math. Ported from kero-pet/renderer/pet.js (same numbers; rebalance is M2: PET-3/4).
// Every function returns a NEW state; nothing here touches the clock, disk or Electron.

/** @typedef {import('../../bus-topics').PetState} PetState */

const DECAY_PER_HOUR = { hunger: 8, happy: 6, clean: 4, energy: 5 };
const SLEEP_ENERGY_PER_HOUR = 18;
const OFFLINE_CAP_HOURS = 48;

/** @param {number} v */
const clamp = (v) => Math.max(0, Math.min(100, v));

/** @param {number} now @returns {PetState} */
function defaultState(now) {
  return {
    schemaVersion: 1, hunger: 80, happy: 80, energy: 80, clean: 80, bond: 10,
    asleep: false, bornAt: now, lastSeen: now, xp: 0, pats: 0,
  };
}

/**
 * Advance needs by `hours` of real time.
 * @param {PetState} s @param {number} hours @returns {PetState}
 */
function applyTime(s, hours) {
  if (hours <= 0) return s;
  const hunger = clamp(s.hunger - DECAY_PER_HOUR.hunger * hours);
  return {
    ...s,
    hunger,
    clean: clamp(s.clean - DECAY_PER_HOUR.clean * hours),
    happy: clamp(s.happy - DECAY_PER_HOUR.happy * hours * (hunger < 25 ? 1.8 : 1)),
    energy: clamp(s.asleep ? s.energy + SLEEP_ENERGY_PER_HOUR * hours : s.energy - DECAY_PER_HOUR.energy * hours),
  };
}

/**
 * Catch up after the app was closed (capped, PET-1). Returns the new state and hours applied.
 * @param {PetState} s @param {number} now
 */
function catchUp(s, now) {
  const hoursAway = Math.max(0, Math.min(OFFLINE_CAP_HOURS, (now - s.lastSeen) / 3600000));
  return { state: { ...applyTime(s, hoursAway), lastSeen: now }, hoursAway };
}

/** Wake up automatically when fully charged. @param {PetState} s */
function autoWake(s) {
  return s.asleep && s.energy >= 100 ? { state: { ...s, asleep: false }, woke: true } : { state: s, woke: false };
}

/**
 * Care actions. Returns { ok, reason?, state }. `reason` lets the UI pick an in-character line.
 * @param {PetState} s @param {string} action
 * @returns {{ok: boolean, reason?: string, state: PetState}}
 */
function act(s, action) {
  if (s.asleep && action !== 'sleep') return { ok: false, reason: 'asleep', state: s };
  switch (action) {
    case 'feed':
      if (s.hunger > 95) return { ok: false, reason: 'full', state: s };
      return { ok: true, state: { ...s, hunger: clamp(s.hunger + 25), happy: clamp(s.happy + 4) } };
    case 'play':
      if (s.energy < 15) return { ok: false, reason: 'tired', state: s };
      return {
        ok: true,
        state: { ...s, happy: clamp(s.happy + 15), energy: clamp(s.energy - 8), hunger: clamp(s.hunger - 4), bond: clamp(s.bond + 1) },
      };
    case 'clean':
      return { ok: true, state: { ...s, clean: 100, happy: clamp(s.happy + 5) } };
    case 'sleep':
      return { ok: true, reason: s.asleep ? 'woke' : 'slept', state: { ...s, asleep: !s.asleep } };
    case 'pat':
      return { ok: true, state: { ...s, pats: s.pats + 1, happy: clamp(s.happy + 3), bond: clamp(s.bond + 0.5) } };
    default:
      return { ok: false, reason: 'unknown-action', state: s };
  }
}

/** A finished agent task ("coding quest"). @param {PetState} s @returns {PetState} */
function questDone(s) {
  return {
    ...s, xp: s.xp + 1, bond: clamp(s.bond + 1), happy: clamp(s.happy + 5),
    energy: clamp(s.energy - 4), hunger: clamp(s.hunger - 3),
  };
}

module.exports = { DECAY_PER_HOUR, OFFLINE_CAP_HOURS, clamp, defaultState, applyTime, catchUp, autoWake, act, questDone };
