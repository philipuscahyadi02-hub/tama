// @ts-check
// Roster: which Tamas exist, which one is active, and their CharacterSpec (PORT-1, ONB-1, D-016, D-020).
// First run: with a kero-pet save → Kero-chan is imported already hatched; otherwise an egg waits for
// onboarding. Saving a character covers hatch / restyle / rebirth (PORT-4's first two cases).
const { TOPICS } = require('../../bus-topics');
const specMod = require('../../../shared/spec');
const { createLifecycle } = require('./lifecycle');

/** @typedef {import('../../../shared/spec').CharacterSpec} CharacterSpec */
/** @typedef {'egg'|'hatched'} Stage */

/**
 * legacySaveFiles: absolute paths to kero-pet pet-state.json candidates.
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   store: import('../../platform/store').Store,
 *   legacySaveFiles?: string[],
 *   now?: () => number,
 *   newId?: () => string,
 *   relaunch?: () => void,
 *   files?: { readBuffer: (p: string) => Buffer, writeBuffer: (p: string, b: Buffer) => void },
 *   secrets?: any,
 *   appVersion?: string,
 * }} deps
 */
function createRoster({ bus, store, legacySaveFiles = [], now = Date.now, newId = defaultId, relaunch = () => {}, files, secrets = null, appVersion }) {
  const charFile = (/** @type {string} */ id) => `tamas/${id}/character.json`;

  /** @param {string} id */
  function readCharacter(id) {
    const raw = store.read(charFile(id), 'character', () => ({}));
    return { raw, spec: specMod.normalizeSpec(raw), stage: /** @type {Stage} */ (raw.stage === 'egg' ? 'egg' : 'hatched') };
  }

  /** @returns {{ id: string, name: string, stage: Stage }} */
  function ensureActive() {
    const active = store.read('active.json', 'active', () => ({ activeTamaId: null }));
    if (active.activeTamaId && store.exists(charFile(active.activeTamaId))) return describe(active.activeTamaId);
    const existing = store.listDirs('tamas').find((id) => store.exists(charFile(id)));
    if (existing) {
      store.write('active.json', 'active', { activeTamaId: existing });
      return describe(existing);
    }
    return createFirst();
  }

  function createFirst() {
    const id = newId();
    const legacy = newestLegacySave();
    const meta = { createdAt: now(), importedFrom: legacy ? 'kero-pet' : null };
    if (legacy) {
      store.write(charFile(id), 'character', { ...specMod.preset('kero'), ...meta, stage: 'hatched' });
      store.write(`tamas/${id}/state.json`, 'tama-state', legacy);
    } else {
      // An egg: the real design comes from onboarding (ONB-1). The placeholder spec is never shown.
      store.write(charFile(id), 'character', { ...specMod.normalizeSpec({ name: 'Tama' }), ...meta, stage: 'egg' });
    }
    store.write('active.json', 'active', { activeTamaId: id });
    return describe(id);
  }

  /** The kero-pet save with the latest lastSeen, if any. */
  function newestLegacySave() {
    const saves = legacySaveFiles.map((f) => store.readExternal(f)).filter((s) => s && typeof s.bond === 'number');
    saves.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    if (!saves[0]) return null;
    const { schemaVersion: _drop, ...rest } = saves[0]; // legacy files are schema v0
    return rest;
  }

  /** @param {string} id */
  function describe(id) {
    const c = readCharacter(id);
    return { id, name: c.spec.name, stage: c.stage };
  }

  /**
   * Save a design for the active Tama.
   * - hatch:   egg → hatched, fresh stats (bornAt = now)
   * - restyle: new look/voice, everything else kept
   * - rebirth: new everything; stats reset unless keepBond (then bond/xp/pats survive)
   * @param {string} activeId
   * @param {{ spec: any, mode: 'hatch'|'restyle'|'rebirth', keepBond?: boolean }} req
   */
  function saveCharacter(activeId, { spec, mode, keepBond = true }) {
    if (!['hatch', 'restyle', 'rebirth'].includes(mode)) throw new Error(`character.save: bad mode ${mode}`);
    const { raw } = readCharacter(activeId);
    const clean = specMod.normalizeSpec(spec);
    const meta = { createdAt: raw.createdAt || now(), importedFrom: raw.importedFrom || null, updatedAt: now() };
    store.write(charFile(activeId), 'character', { ...clean, ...meta, stage: 'hatched' });
    const resetState = mode === 'hatch' || (mode === 'rebirth' && !keepBond) ? 'all' : mode === 'rebirth' ? 'keep-bond' : 'none';
    bus.emit(TOPICS.CHARACTER_CHANGED, { tamaId: activeId, spec: clean, stage: 'hatched', mode, resetState });
    return { tamaId: activeId, spec: clean };
  }

  /** @param {{id: string}} active */
  function start(active) {
    const noFiles = { readBuffer: () => { throw new Error('files unavailable'); }, writeBuffer: () => { throw new Error('files unavailable'); } };
    const life = createLifecycle({ store, activeId: () => active.id, relaunch, files: files || noFiles, secrets, now, newId, appVersion });
    const offs = [
      bus.handle(TOPICS.ROSTER_GET, () => ({ activeTamaId: active.id, tamas: life.list() })),
      bus.handle(TOPICS.ROSTER_SWITCH, (/** @type {any} */ p) => life.switchTo(p)),
      bus.handle(TOPICS.ROSTER_HATCH_NEW, () => life.hatchNew()),
      bus.handle(TOPICS.ROSTER_GRADUATE, (/** @type {any} */ p) => life.graduate(p)),
      bus.handle(TOPICS.ROSTER_RESTORE, (/** @type {any} */ p) => life.restore(p)),
      bus.handle(TOPICS.ROSTER_DELETE, (/** @type {any} */ p) => life.remove(p)),
      bus.handle(TOPICS.ROSTER_EXPORT, (/** @type {any} */ p) => life.exportTama(p)),
      bus.handle(TOPICS.ROSTER_IMPORT, (/** @type {any} */ p) => life.importTama(p)),
      bus.handle(TOPICS.CHARACTER_GET, () => {
        const c = readCharacter(active.id);
        return { tamaId: active.id, spec: c.spec, stage: c.stage };
      }),
      bus.handle(TOPICS.CHARACTER_SAVE, (/** @type {any} */ req) => saveCharacter(active.id, req)),
    ];
    return () => { for (const off of offs) off(); };
  }

  return { ensureActive, start };
}

function defaultId() {
  return `tama-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

module.exports = { createRoster };
