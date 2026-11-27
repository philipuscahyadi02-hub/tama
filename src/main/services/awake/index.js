// @ts-check
// Keep the PC awake (D-081): sleep pauses Tama (Claude tasks, music, the Telegram bot); locking does not. ui pref
// `keepAwake`: 'off', 'working' (default: while a coding or chat turn runs or music plays, and 5 minutes after) or
// 'always' (while Tama runs). Only system sleep is blocked: the screen may still turn off and lock as usual.
const { TOPICS } = require('../../bus-topics');

const GRACE_MS = 5 * 60000;
const TICK_MS = 30000;

/**
 * Pure: should the PC stay awake now?
 * @param {{ mode: string, busy: boolean, playing: boolean, lastActiveAt: number, now: number }} s
 */
function wantAwake({ mode, busy, playing, lastActiveAt, now }) {
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  return busy || playing || now - lastActiveAt < GRACE_MS;
}

/**
 * @param {{ bus: import('../../bus').BusInstance, keepAwake: (on: boolean, reason?: string) => boolean, now?: () => number }} deps
 */
function createAwake({ bus, keepAwake, now = Date.now }) {
  let mode = 'working';
  let playing = false;
  let lastActiveAt = -Infinity;
  /** engine|role → busy (a turn is running) */
  const busy = new Map();
  let on = false;

  function update() {
    const isBusy = [...busy.values()].some(Boolean);
    if (isBusy || playing) lastActiveAt = now();
    const want = wantAwake({ mode, busy: isBusy, playing, lastActiveAt, now: now() });
    if (want !== on) { on = want; keepAwake(on, 'work'); }
  }

  function start() {
    const offs = [
      bus.on(TOPICS.ENGINE_EVENT, (/** @type {any} */ e) => {
        if (!e || !e.ev || e.ev.t !== 'status') return;
        busy.set(`${e.engine}|${e.role}`, e.ev.state !== 'idle');
        update();
      }),
      bus.on(TOPICS.CHAT_EVENT, (/** @type {any} */ e) => {
        if (e && e.t === 'status') { busy.set('chat', e.state !== 'idle'); update(); }
        else if (e && e.t === 'done') { busy.set('chat', false); update(); }
      }),
      bus.on(TOPICS.MUSIC_CHANGED, (/** @type {any} */ p) => { playing = !!(p && p.state && p.state.playing); update(); }),
      bus.on(TOPICS.UI_PREFS_CHANGED, (/** @type {any} */ p) => { if (p && p.keepAwake) { mode = p.keepAwake; update(); } }),
    ];
    bus.request(TOPICS.UI_PREFS_GET).then((p) => { if (p && p.keepAwake) mode = p.keepAwake; update(); }).catch(() => update());
    const timer = setInterval(update, TICK_MS); // the 5-minute grace runs out without an event
    return () => { clearInterval(timer); for (const off of offs) off(); if (on) keepAwake(false, 'work'); };
  }

  return { start, update, isOn: () => on };
}

module.exports = { createAwake, wantAwake, GRACE_MS };
