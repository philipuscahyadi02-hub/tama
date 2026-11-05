// @ts-check
// Forward-only migrations per file kind (ARCHITECTURE §6, D-011).
// To change a file's shape: append a function to its list. Never edit or remove existing steps.
// Step i upgrades data from schemaVersion i to i+1. Files without schemaVersion are version 0.
const specMod = require('../../../../shared/spec');

/** @type {Record<string, Array<(d: any) => any>>} */
const MIGRATIONS = {
  // device.json — this PC's settings
  device: [
    (d) => d, // 0 → 1: initial shape
  ],
  // active.json — { activeTamaId }
  active: [
    (d) => d,
  ],
  // user/productivity.json — todos, notes, reminders, focus timer (D-024)
  productivity: [
    (d) => d,
  ],
  // tamas/<id>/character.json
  character: [
    (d) => d,
    // 1 → 2 (M1): M0 stored { name, preset, gender, createdAt, importedFrom }. Expand to a full
    // CharacterSpec from the preset, keeping the name and meta fields (D-020).
    (d) => {
      const { preset, ...meta } = d;
      const base = preset ? specMod.PRESETS[preset] || specMod.PRESETS.kero : {};
      return { ...meta, ...specMod.normalizeSpec({ ...base, ...meta, name: d.name || base.name }), stage: 'hatched' };
    },
  ],
  // tamas/<id>/state.json — v0 is kero-pet's pet-state.json, which already has the v1 fields.
  'tama-state': [
    (d) => ({
      hunger: 80, happy: 80, energy: 80, clean: 80, bond: 10, asleep: false, xp: 0, pats: 0,
      bornAt: Date.now(), lastSeen: Date.now(),
      ...d,
    }),
    // 1 → 2 (M2, D-023): bond 0..100 becomes open-ended bondXp (x12, so old 100 = Soulmate);
    // adds sleep kinds, snack cooldown, daily XP caps and streak.
    (d) => {
      const { bond = 10, ...rest } = d;
      return {
        ...rest,
        bondXp: Math.round(Math.max(0, Math.min(100, Number(bond) || 0)) * 12),
        sleepKind: d.asleep ? 'sleep' : null, napUntil: 0,
        cooldowns: { snack: 0 }, daily: { day: '', xp: {} }, streak: { count: 0, lastDay: '' },
      };
    },
  ],
};

/** @param {string} kind */
function currentVersion(kind) {
  const list = MIGRATIONS[kind];
  if (!list) throw new Error(`migrations: unknown kind "${kind}"`);
  return list.length;
}

/**
 * Upgrade `data` to the current schemaVersion for `kind`.
 * With stampOnly, just sets schemaVersion (used on write, where data is already current).
 * @param {string} kind @param {any} data @param {{stampOnly?: boolean}} [opts]
 */
function migrate(kind, data, opts = {}) {
  const target = currentVersion(kind);
  if (opts.stampOnly) return { ...data, schemaVersion: target };
  let v = Number.isInteger(data && data.schemaVersion) ? data.schemaVersion : 0;
  if (v > target) throw new Error(`${kind} file is from a newer Tama (v${v} > v${target}); update the app`);
  let out = { ...data };
  for (; v < target; v++) out = MIGRATIONS[kind][v](out);
  out.schemaVersion = target;
  return out;
}

module.exports = { migrate, currentVersion, MIGRATIONS };
