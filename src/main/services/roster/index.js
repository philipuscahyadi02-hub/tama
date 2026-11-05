// @ts-check
// Roster: which Tamas exist and which one is active (PORT-1; full roster UI is PORT-3/M2).
// M0: if there is no Tama yet, create one. If a kero-pet save exists, bring Kero-chan over
// with her stats and bond, so upgrading from kero-pet doesn't lose your pet (D-016).
const { TOPICS } = require('../../bus-topics');

/**
 * legacySaveFiles: absolute paths to kero-pet pet-state.json candidates.
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   store: import('../../platform/store').Store,
 *   legacySaveFiles?: string[],
 *   now?: () => number,
 *   newId?: () => string,
 * }} deps
 */
function createRoster({ bus, store, legacySaveFiles = [], now = Date.now, newId = defaultId }) {
  /** @returns {{ id: string, name: string }} */
  function ensureActive() {
    const active = store.read('active.json', 'active', () => ({ activeTamaId: null }));
    if (active.activeTamaId && store.exists(`tamas/${active.activeTamaId}/character.json`)) {
      return describe(active.activeTamaId);
    }
    const existing = store.listDirs('tamas').find((id) => store.exists(`tamas/${id}/character.json`));
    if (existing) {
      store.write('active.json', 'active', { activeTamaId: existing });
      return describe(existing);
    }
    return hatchFirst();
  }

  function hatchFirst() {
    const id = newId();
    const legacy = newestLegacySave();
    // Until M1 onboarding exists, every Tama uses the built-in Kero-chan preset.
    store.write(`tamas/${id}/character.json`, 'character', {
      name: 'Kero-chan', preset: 'kero', gender: 'girl', createdAt: now(), importedFrom: legacy ? 'kero-pet' : null,
    });
    if (legacy) store.write(`tamas/${id}/state.json`, 'tama-state', legacy);
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
    const c = store.read(`tamas/${id}/character.json`, 'character', () => ({ name: 'Tama' }));
    return { id, name: c.name };
  }

  /** @param {{id: string, name: string}} active */
  function start(active) {
    return bus.handle(TOPICS.ROSTER_GET, () => ({
      activeTamaId: active.id,
      tamas: store.listDirs('tamas').filter((id) => store.exists(`tamas/${id}/character.json`)).map(describe),
    }));
  }

  return { ensureActive, start };
}

function defaultId() {
  return `tama-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

module.exports = { createRoster };
