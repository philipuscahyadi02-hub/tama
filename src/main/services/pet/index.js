// @ts-check
// Pet service: owns the active Tama's stats. Ticks real time, applies easy-energy rules (charging,
// auto-nap while you're away), awards bond XP from care + productivity, persists, broadcasts snapshots.
const { TOPICS } = require('../../bus-topics');
const logic = require('./logic');
const bond = require('./bond');

/** @typedef {import('./logic').PetState} PetState */

const TICK_MS = 5000;
const SAVE_MS = 10000;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   store: import('../../platform/store').Store,
 *   tama: { id: string, name: string, stage?: 'egg'|'hatched' },
 *   now?: () => number,
 * }} deps
 */
function createPetService({ bus, store, tama, now = Date.now }) {
  const file = `tamas/${tama.id}/state.json`;
  /** @type {PetState} */
  let state = store.read(file, 'tama-state', () => logic.defaultState(now()));
  let name = tama.name;
  /** An unhatched egg doesn't get hungry or lonely (ONB-1). */
  let isEgg = tama.stage === 'egg';
  let charging = false;
  let last = now();
  /** Hours the app was closed before this run (for the "I was lonely" greeting). */
  let hoursAway = 0;
  /** @type {NodeJS.Timeout | null} */
  let timer = null;
  const offs = /** @type {Array<() => void>} */ ([]);

  const snapshot = () => ({
    tamaId: tama.id, name, egg: isEgg, state, hoursAway, charging, level: bond.levelOf(state.bondXp),
  });
  const persist = () => store.writeSoon(file, 'tama-state', () => ({ ...state, lastSeen: now() }), SAVE_MS);

  /** @param {PetState} next */
  function set(next) {
    state = next;
    persist();
    bus.emit(TOPICS.PET_STATE_CHANGED, snapshot());
  }

  /** Apply a bond award result and announce it. @param {{ state: PetState, gained: number, levelUp: any, streak: any }} b @param {string} source */
  function applyBond(b, source) {
    set(b.state);
    if (b.gained > 0 || b.levelUp || b.streak) {
      bus.emit(TOPICS.PET_BOND_CHANGED, { source, gained: b.gained, levelUp: b.levelUp, streak: b.streak });
    }
    return { gained: b.gained };
  }

  function tick() {
    const t = now();
    if (isEgg) { last = t; return; }
    const next = logic.applyTime(state, (t - last) / 3600000, { charging });
    last = t;
    set({ ...logic.autoWake(next, t).state, lastSeen: t });
  }

  function start() {
    if (!isEgg) {
      const caught = logic.catchUp(state, now());
      state = caught.state;
      hoursAway = caught.hoursAway;
    }
    last = now();

    offs.push(
      bus.handle(TOPICS.PET_GET, () => snapshot()),
      bus.handle(TOPICS.PET_ACT, (/** @type {{action: string}} */ { action }) => {
        if (isEgg) return { ok: false, reason: 'egg', state };
        const r = logic.act(state, action, now());
        if (r.ok) { if (r.bond) applyBond(r.bond, action); else set(r.state); }
        return { ok: r.ok, reason: r.reason, retryInMs: r.retryInMs, state };
      }),
      bus.handle(TOPICS.PET_AWARD, (/** @type {{source: any}} */ { source }) => {
        if (isEgg || !['commit', 'focus', 'todo', 'calendar'].includes(source)) return { gained: 0 };
        return applyBond(bond.award(state, source, now()), source);
      }),
      bus.on(TOPICS.ENGINE_EVENT, (/** @type {{ev: any, role?: string}} */ { ev, role }) => {
        // Only real agent work counts as a quest; chat with the lite brain does not (PET-4).
        if (ev.t === 'result' && !ev.isError && !isEgg && role === 'worker') applyBond(logic.questDone(state, now()), 'agent');
      }),
      bus.on(TOPICS.DEVICE_POWER_CHANGED, (/** @type {{onAC: boolean}} */ { onAC }) => { charging = onAC; bus.emit(TOPICS.PET_STATE_CHANGED, snapshot()); }),
      bus.on(TOPICS.DEVICE_IDLE_CHANGED, (/** @type {{idle: boolean}} */ { idle }) => {
        if (isEgg) return;
        set(idle ? logic.fallAsleep(state, 'auto') : logic.wakeFromAutoNap(state));
      }),
      bus.on(TOPICS.CHARACTER_CHANGED, (/** @type {any} */ c) => {
        if (c.tamaId !== tama.id) return;
        name = c.spec.name;
        isEgg = c.stage === 'egg';
        hoursAway = 0;
        if (c.resetState === 'all') set(logic.defaultState(now()));
        else if (c.resetState === 'keep-bond') {
          set({ ...logic.defaultState(now()), bondXp: state.bondXp, streak: state.streak, xp: state.xp, pats: state.pats });
        } else set(state);
      }),
    );
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
