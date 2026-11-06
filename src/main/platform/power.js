// @ts-check
// OS power + idle signals for the pet's easy-energy rules (PET-3): charging on AC, auto-nap while away.
const { powerMonitor } = require('electron');

const IDLE_NAP_SECONDS = 10 * 60;
const POLL_MS = 30 * 1000;

/**
 * @param {{ onPower: (onAC: boolean) => void, onIdle: (idle: boolean, idleSeconds: number) => void }} cb
 * @returns {() => void} stop
 */
function watchPower({ onPower, onIdle }) {
  let onAC = !powerMonitor.isOnBatteryPower();
  let idle = false;
  onPower(onAC);
  const powerChanged = () => {
    const now = !powerMonitor.isOnBatteryPower();
    if (now !== onAC) { onAC = now; onPower(onAC); }
  };
  powerMonitor.on('on-ac', powerChanged);
  powerMonitor.on('on-battery', powerChanged);

  const checkIdle = () => {
    const secs = powerMonitor.getSystemIdleTime();
    const nowIdle = secs >= IDLE_NAP_SECONDS;
    if (nowIdle !== idle) { idle = nowIdle; onIdle(idle, secs); }
  };
  const timer = setInterval(checkIdle, POLL_MS);
  // Locking the screen counts as away right away; unlocking as back.
  const lock = () => { if (!idle) { idle = true; onIdle(true, IDLE_NAP_SECONDS); } };
  powerMonitor.on('lock-screen', lock);
  powerMonitor.on('unlock-screen', checkIdle);

  return () => {
    clearInterval(timer);
    powerMonitor.removeListener('on-ac', powerChanged);
    powerMonitor.removeListener('on-battery', powerChanged);
    powerMonitor.removeListener('lock-screen', lock);
    powerMonitor.removeListener('unlock-screen', checkIdle);
  };
}

let blockerId = /** @type {number | null} */ (null);
/** Keep the PC from sleeping (remote mode, TG-8). Screen may still turn off. @param {boolean} on */
function keepAwake(on) {
  const { powerSaveBlocker } = require('electron');
  if (on && blockerId === null) blockerId = powerSaveBlocker.start('prevent-app-suspension');
  if (!on && blockerId !== null) { powerSaveBlocker.stop(blockerId); blockerId = null; }
  return blockerId !== null;
}

module.exports = { watchPower, keepAwake, IDLE_NAP_SECONDS };
