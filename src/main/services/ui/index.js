// @ts-check
// UI preferences for this PC (TERM-2, BOND-3, D-032): terminal theme variant (unlocked by bond level) and
// one-time hints such as the terminal tour. Stored in device.json `ui` (a look preference, not part of the soul).
const { TOPICS } = require('../../bus-topics');
const theme = require('../../../shared/theme');

/**
 * @param {{ bus: import('../../bus').BusInstance, device: import('../../platform/store/device').DeviceSettings }} deps
 */
function createUiPrefs({ bus, device }) {
  const prefs = () => ({ termTheme: 'night', tourDone: false, dnd: false, nudges: true, walkMarker: true, ...(device.get().ui || {}) });

  async function levelIndex() {
    const pet = await bus.request(TOPICS.PET_GET).catch(() => null);
    return (pet && pet.level && pet.level.index) || 0;
  }

  async function get() {
    const p = prefs();
    const lvl = await levelIndex();
    const unlocked = theme.unlocked(lvl).map((v) => v.id);
    // A theme chosen earlier stays usable; an unknown id falls back to night.
    const termTheme = theme.VARIANTS.some((v) => v.id === p.termTheme) ? p.termTheme : 'night';
    return {
      termTheme, tourDone: !!p.tourDone, unlocked, dnd: !!p.dnd, nudges: p.nudges !== false, walkMarker: p.walkMarker !== false,
      variants: theme.VARIANTS.map((v) => ({ ...v, unlocked: unlocked.includes(v.id) })),
    };
  }

  /** @param {{ termTheme?: string, tourDone?: boolean, dnd?: boolean, nudges?: boolean, walkMarker?: boolean }} p */
  async function set(p) {
    /** @type {Record<string, any>} */
    const patch = {};
    if (p.termTheme !== undefined) {
      const v = theme.VARIANTS.find((x) => x.id === p.termTheme);
      if (!v) return { error: `Unknown theme. Try: ${theme.VARIANTS.map((x) => x.id).join(', ')}` };
      if ((await levelIndex()) < v.minLevel) return { error: 'locked', minLevel: v.minLevel };
      patch.termTheme = v.id;
    }
    if (p.tourDone !== undefined) patch.tourDone = !!p.tourDone;
    if (p.dnd !== undefined) patch.dnd = !!p.dnd;           // PET-6: no events or babble
    if (p.nudges !== undefined) patch.nudges = !!p.nudges;  // PET-7: water/stretch reminders
    if (p.walkMarker !== undefined) patch.walkMarker = !!p.walkMarker; // SUM-5: edge marker while hidden (D-035)
    device.patch('ui', patch);
    const out = await get();
    bus.emit(TOPICS.UI_PREFS_CHANGED, out);
    return out;
  }

  function start() {
    const offs = [
      bus.handle(TOPICS.UI_PREFS_GET, () => get()),
      bus.handle(TOPICS.UI_PREFS_SET, (/** @type {any} */ p) => set(p || {})),
      // BOND-3: a level-up that unlocks a terminal theme gets a little announcement.
      bus.on(TOPICS.PET_BOND_CHANGED, (/** @type {any} */ b) => {
        if (!b || !b.levelUp) return;
        const fresh = theme.VARIANTS.filter((v) => v.minLevel === b.levelUp.index);
        for (const v of fresh) {
          bus.emit(TOPICS.BRAIN_NOTICE, { text: `New terminal theme unlocked: ${v.label}! Try /theme ${v.id} ✨`, kind: 'info' });
        }
      }),
    ];
    return () => { for (const off of offs) off(); };
  }

  return { start, get, set };
}

module.exports = { createUiPrefs };
