// @ts-check
// summon() + watchdog (SUM-1, SUM-2, SUM-4). Fixes kero-pet's "Bring Kero-chan back", which only
// moved the window: it never re-showed a hidden window, never re-asserted always-on-top (Windows
// drops it after fullscreen apps / sleep / Explorer restarts), and dragging had no bounds at all.
const { powerMonitor } = require('electron');
const geo = require('./geometry');
const { workAreas, cursor, onDisplaysChanged } = require('../displays');

const WATCHDOG_MS = 30000;

/**
 * @param {{
 *   pet: import('../windows/pet-window').PetWindow,
 *   onSummoned?: (reason: string) => void,
 *   log?: (msg: string) => void,
 * }} deps
 */
function createSummoner({ pet, onSummoned = () => {}, log = () => {} }) {
  const { win } = pet;

  function raise() {
    if (win.isDestroyed()) return;
    win.setAlwaysOnTop(true, 'screen-saver');
    win.moveTop();
  }

  /** Bring the pet back no matter what state it's in. @param {string} reason */
  function summon(reason) {
    if (win.isDestroyed()) return;
    pet.clearHiddenByUser();
    if (win.isMinimized()) win.restore();
    pet.moveTo(geo.summonPosition(cursor(), workAreas(), pet.SIZE));
    win.showInactive(); // show without stealing keyboard focus from what the user is doing
    raise();
    log(`summon (${reason})`);
    onSummoned(reason);
  }

  /** Keep the pet visible and on top unless the user hid it on purpose. @param {string} why */
  function check(why) {
    if (win.isDestroyed() || pet.isHiddenByUser()) return;
    if (!win.isVisible()) win.showInactive();
    const areas = workAreas();
    if (!geo.isVisibleEnough(pet.bounds(), areas)) {
      pet.moveTo(geo.clampToScreen(pet.bounds(), areas));
      log(`watchdog: pet was off-screen, moved back (${why})`);
    }
    raise();
  }

  /** @type {NodeJS.Timeout | null} */
  let timer = null;
  function startWatchdog() {
    timer = setInterval(() => check('interval'), WATCHDOG_MS);
    onDisplaysChanged(() => setTimeout(() => check('displays-changed'), 500));
    powerMonitor.on('resume', () => setTimeout(() => check('resume'), 1500));
    powerMonitor.on('unlock-screen', () => setTimeout(() => check('unlock'), 1500));
  }

  function stop() { if (timer) clearInterval(timer); timer = null; }

  return { summon, check, startWatchdog, stop };
}

module.exports = { createSummoner };
