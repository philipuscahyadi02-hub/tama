// @ts-check
// Event triggers (EVT-1, D-033). Pure: deck + context in, the event to fire (or null) out.

/**
 * Trigger.hours: `[from, to)` for type 'time'; the minimum hours away for type 'absence'.
 * @typedef {{ type: string, hours?: number[] | number,
 *   days?: 'weekday'|'weekend', stat?: string, below?: number,
 *   atLeast?: number, md?: string, chance?: number, minutes?: number, hour?: number }} Trigger
 * @typedef {{ label: string, reply: string, bond?: number, remember?: string }} Choice
 * @typedef {{ label: string, reply: string, bond?: number, action?: string, source?: string }} Quest
 * @typedef {{ id: string, kind: 'chat'|'choice'|'quest'|'callback'|'nudge'|'diary', trigger: Trigger, cooldownH: number,
 *   minBond: number, seed: string, lines: string[], choices?: Choice[], quest?: Quest }} TamaEvent
 * @typedef {{
 *   now: number, hour: number, weekday: number, md: string,
 *   pet: { hunger: number, energy: number, asleep: boolean, streak: number, level: number },
 *   hoursAway: number, startup: boolean, levelUp: boolean, activeMinutes: number, facts: number,
 *   birthdayMd: string, diaryDone: boolean, random: () => number,
 * }} Ctx
 * @typedef {{ last: Record<string, number>, lastAny: number }} EventsState
 */

/** Minimum time between two non-nudge events, so she never nags. */
const GAP_MS = 40 * 60000;
/** Ticks run once a minute; `chance` in the deck is per hour. */
const TICKS_PER_HOUR = 60;

/** @param {Trigger} t @param {Ctx} c */
function matches(t, c) {
  switch (t.type) {
    case 'time': {
      const [from, to] = Array.isArray(t.hours) ? t.hours : [0, 24];
      if (c.hour < from || c.hour >= to) return false;
      const weekend = c.weekday === 0 || c.weekday === 6;
      if (t.days === 'weekend' && !weekend) return false;
      if (t.days === 'weekday' && weekend) return false;
      return true;
    }
    case 'lateNight': return c.hour >= 0 && c.hour < 4 && c.activeMinutes >= 5;
    case 'absence': return c.startup && c.hoursAway >= (typeof t.hours === 'number' ? t.hours : 8);
    case 'stat': return !c.pet.asleep && /** @type {any} */ (c.pet)[t.stat || 'hunger'] < (t.below ?? 25);
    case 'streak': return c.pet.streak >= (t.atLeast || 7);
    case 'date': return c.md === t.md;
    case 'birthday': return !!c.birthdayMd && c.md === c.birthdayMd;
    case 'random': return c.random() < (t.chance || 0) / TICKS_PER_HOUR;
    case 'memory': return c.facts > 0 && c.random() < 0.25 / TICKS_PER_HOUR;
    case 'diary': return !c.diaryDone && c.hour >= (t.hour ?? 21);
    case 'active': return c.activeMinutes >= (t.minutes || 90);
    case 'levelUp': return c.levelUp;
    default: return false;
  }
}

/**
 * Pick the event to fire now, if any. Deck order is priority order.
 * @param {TamaEvent[]} deck @param {Ctx} c @param {EventsState} s
 * @param {{ nudges: boolean, quiet: boolean }} opts  quiet = do-not-disturb (focus session, /dnd, user away)
 * @returns {TamaEvent | null}
 */
function pick(deck, c, s, opts) {
  for (const e of deck) {
    if (opts.quiet && e.kind !== 'diary') continue; // the diary is written quietly, never shown as a pop-up
    if (e.kind === 'nudge' && !opts.nudges) continue;
    if (c.pet.level < (e.minBond || 0)) continue;
    const last = s.last[e.id] || 0;
    if (last && c.now - last < (e.cooldownH || 0) * 3600000) continue;
    const gapApplies = e.kind !== 'nudge' && e.kind !== 'diary' && e.trigger.type !== 'levelUp';
    if (gapApplies && s.lastAny && c.now - s.lastAny < GAP_MS) continue;
    if (!matches(e.trigger, c)) continue;
    return e;
  }
  return null;
}

/** @param {any} raw @returns {TamaEvent[]} */
function validateDeck(raw) {
  const KINDS = ['chat', 'choice', 'quest', 'callback', 'nudge', 'diary'];
  const list = Array.isArray(raw && raw.events) ? raw.events : [];
  return list.filter((/** @type {any} */ e) => e && typeof e.id === 'string' && KINDS.includes(e.kind) && e.trigger && typeof e.trigger.type === 'string')
    .map((/** @type {any} */ e) => ({ cooldownH: 12, minBond: 0, seed: '', lines: [], ...e }));
}

module.exports = { matches, pick, validateDeck, GAP_MS };
