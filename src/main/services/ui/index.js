// @ts-check
// UI preferences for this PC (TERM-2, BOND-3, D-032): terminal theme variant (unlocked by bond level) and
// one-time hints such as the terminal tour. Stored in device.json `ui` (a look preference, not part of the soul).
const { TOPICS } = require('../../bus-topics');
const theme = require('../../../shared/theme');

/** Reply languages for chat and moments (M10, D-048). auto = answer in the language the user writes in. */
const REPLY_LANGS = ['auto', 'en', 'id', 'ja'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Is `d` inside the quiet window from..to (HH:MM, local time)? A window may cross midnight (23:00–08:00). Pure.
 * @param {Date} d @param {string} from @param {string} to
 */
function inQuietHours(d, from, to) {
  if (!HHMM.test(from) || !HHMM.test(to) || from === to) return false;
  const m = (/** @type {string} */ s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const t = d.getHours() * 60 + d.getMinutes();
  const a = m(from); const b = m(to);
  return a < b ? t >= a && t < b : t >= a || t < b;
}

/**
 * @param {{ bus: import('../../bus').BusInstance, device: import('../../platform/store/device').DeviceSettings, now?: () => number }} deps
 */
function createUiPrefs({ bus, device, now = () => Date.now() }) {
  const prefs = () => ({
    termTheme: 'night', tourDone: false, dnd: false, nudges: true, walkMarker: true, mute: false, motion: 'auto',
    replyLang: 'auto', quiet: { on: false, from: '23:00', to: '08:00' }, ...(device.get().ui || {}),
  });

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
      termTheme, tourDone: !!p.tourDone, unlocked, dnd: !!p.dnd, nudges: p.nudges !== false, walkMarker: p.walkMarker !== false, mute: !!p.mute, motion: p.motion || 'auto',
      replyLang: REPLY_LANGS.includes(p.replyLang) ? p.replyLang : 'auto',
      quiet: { on: !!(p.quiet && p.quiet.on), from: (p.quiet && p.quiet.from) || '23:00', to: (p.quiet && p.quiet.to) || '08:00' },
      // Quiet hours (M10): like /dnd while inside the window. Consumers check `dnd || quietNow`.
      quietNow: !!(p.quiet && p.quiet.on && inQuietHours(new Date(now()), p.quiet.from, p.quiet.to)),
      variants: theme.VARIANTS.map((v) => ({ ...v, unlocked: unlocked.includes(v.id) })),
    };
  }

  /** @param {{ termTheme?: string, tourDone?: boolean, dnd?: boolean, nudges?: boolean, walkMarker?: boolean, mute?: boolean, motion?: string, replyLang?: string, quiet?: { on?: boolean, from?: string, to?: string } }} p */
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
    if (p.mute !== undefined) patch.mute = !!p.mute;        // PET-8: no voice at all
    if (['auto', 'reduced', 'full'].includes(String(p.motion))) patch.motion = p.motion; // PET-8: auto = follow Windows
    if (p.walkMarker !== undefined) patch.walkMarker = !!p.walkMarker; // SUM-5: edge marker while hidden (D-035)
    if (p.replyLang !== undefined) {
      if (!REPLY_LANGS.includes(String(p.replyLang))) return { error: `Unknown language. Try: ${REPLY_LANGS.join(', ')}` };
      patch.replyLang = String(p.replyLang);
    }
    if (p.quiet && typeof p.quiet === 'object') {
      const cur = prefs().quiet || {};
      const q = { on: p.quiet.on !== undefined ? !!p.quiet.on : !!cur.on, from: p.quiet.from ?? cur.from ?? '23:00', to: p.quiet.to ?? cur.to ?? '08:00' };
      if (!HHMM.test(q.from) || !HHMM.test(q.to)) return { error: 'Times look like 23:00 and 08:00.' };
      patch.quiet = q;
    }
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

module.exports = { createUiPrefs, inQuietHours, REPLY_LANGS };
