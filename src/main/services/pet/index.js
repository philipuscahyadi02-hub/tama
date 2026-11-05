// @ts-check
// Pet service: owns the active Tama's stats, ticks real time, persists, reacts to engine results.
const { TOPICS } = require('../../bus-topics');
const logic = require('./logic');

/** @typedef {import('../../bus-topics').PetState} PetState */

const TICK_MS = 5000;
const SAVE_MS = 10000;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   store: import('../../platform/store').Store,
 *   tama: { id: string, name: string },
 *   now?: () => number,
 * }} deps
 */
function createPetService({ bus, store, tama, now = Date.now }) {
  const file = `tamas/${tama.id}/state.json`;
  /** @type {PetState} */
  let state = store.read(file, 'tama-state', () => logic.defaultState(now()));
  let last = now();
  /** Hours the app was closed before this run (for the "I was lonely" greeting). */
  let hoursAway = 0;
  /** @type {NodeJS.Timeout | null} */
  let timer = null;
  const offs = /** @type {Array<() => void>} */ ([]);

  const snapshot = () => ({ tamaId: tama.id, name: tama.name, state, hoursAway });
  const persist = () => store.writeSoon(file, 'tama-state', () => ({ ...state, lastSeen: now() }), SAVE_MS);

  /** @param {PetState} next */
  function set(next) {
    state = next;
    persist();
    bus.emit(TOPICS.PET_STATE_CHANGED, snapshot());
  }

  function tick() {
    const t = now();
    let next = logic.applyTime(state, (t - last) / 3600000);
    last = t;
    const w = logic.autoWake(next);
    set({ ...w.state, lastSeen: t });
  }

  function start() {
    const caught = logic.catchUp(state, now());
    state = caught.state;
    hoursAway = caught.hoursAway;
    last = now();

    offs.push(bus.handle(TOPICS.PET_GET, () => snapshot()));
    offs.push(bus.handle(TOPICS.PET_ACT, (/** @type {{action: string}} */ { action }) => {
      const r = logic.act(state, action);
      if (r.ok) set(r.state);
      return { ok: r.ok, reason: r.reason, state };
    }));
    offs.push(bus.on(TOPICS.ENGINE_EVENT, (/** @type {{ev: any}} */ { ev }) => {
      if (ev.t === 'result' && !ev.isError) set(logic.questDone(state));
    }));
    timer = setInterval(tick, TICK_MS);
    bus.emit(TOPICS.PET_STATE_CHANGED, snapshot());
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const off of offs.splice(0)) off();
    store.write(file, 'tama-state', { ...state, lastSeen: now() });
  }

  return { start, stop, getState: () => state };
}

module.exports = { createPetService };
