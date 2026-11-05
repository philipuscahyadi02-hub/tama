// @ts-check
// Bond = how close you and your Tama are. Grows from productivity + care, with daily caps so it can't
// be farmed (BOND-1, BOND-2). Bond never affects permissions (BOND-4). Pure functions only.

/** Levels (BOND-3). `min` is total bond XP. Old kero-pet bond 0..100 maps to xp = bond * 12 (D-023). */
const LEVELS = [
  { min: 0, title: 'Stranger', emoji: '👀' },
  { min: 60, title: 'Acquaintance', emoji: '📚' },
  { min: 240, title: 'Buddy', emoji: '✌️' },
  { min: 600, title: 'Partner', emoji: '💞' },
  { min: 1200, title: 'Soulmate', emoji: '💍' },
];

/**
 * XP per event and the daily cap (in XP) per source. Past the cap you get 25% until 2x the cap, then 0.
 * `productive` sources also keep the daily streak alive.
 */
const SOURCES = {
  agent: { xp: 2, cap: 20, productive: true },    // finished agent task
  commit: { xp: 1, cap: 10, productive: true },   // git commit in a watched repo
  focus: { xp: 3, cap: 15, productive: true },    // completed focus session
  todo: { xp: 1, cap: 10, productive: true },     // todo checked off
  calendar: { xp: 2, cap: 8, productive: true },  // finished calendar focus block (M6)
  play: { xp: 1, cap: 3, productive: false },
  pat: { xp: 0.5, cap: 3, productive: false },
};
const STREAK_BONUS = { daily: 1, 7: 5, 30: 15 };

/** Local calendar day (YYYY-MM-DD) for a timestamp. @param {number} t */
function dayOf(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** @param {string} day */
function prevDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return dayOf(new Date(y, m - 1, d - 1, 12).getTime());
}

/** @param {number} xp */
function levelOf(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  return {
    index: i, title: cur.title, emoji: cur.emoji, xp,
    next: next ? next.min : null,
    progress: next ? (xp - cur.min) / (next.min - cur.min) : 1,
  };
}

/**
 * Award bond XP for one event.
 * @template {{ bondXp: number, daily?: {day: string, xp: Record<string, number>}, streak?: {count: number, lastDay: string} }} S
 * @param {S} s @param {keyof typeof SOURCES} source @param {number} now
 * @returns {{ state: S, gained: number, levelUp: null | ReturnType<typeof levelOf>, streak: null | { count: number, bonus: number } }}
 */
function award(s, source, now) {
  const src = SOURCES[source];
  if (!src) throw new Error(`bond: unknown source ${source}`);
  const today = dayOf(now);
  const daily = s.daily && s.daily.day === today ? { day: today, xp: { ...s.daily.xp } } : { day: today, xp: {} };
  const earned = daily.xp[source] || 0;
  const factor = earned < src.cap ? 1 : earned < src.cap * 2 ? 0.25 : 0;
  let gained = src.xp * factor;
  daily.xp[source] = earned + gained;

  let streak = s.streak || { count: 0, lastDay: '' };
  /** @type {null | {count: number, bonus: number}} */
  let streakEvent = null;
  if (src.productive && streak.lastDay !== today) {
    const count = streak.lastDay === prevDay(today) ? streak.count + 1 : 1;
    const bonus = STREAK_BONUS.daily + (count === 7 ? STREAK_BONUS[7] : 0) + (count === 30 ? STREAK_BONUS[30] : 0);
    streak = { count, lastDay: today };
    streakEvent = { count, bonus };
    gained += bonus;
  }

  const before = levelOf(s.bondXp).index;
  const bondXp = Math.round((s.bondXp + gained) * 100) / 100;
  const after = levelOf(bondXp);
  return {
    state: { ...s, bondXp, daily, streak },
    gained,
    levelUp: after.index > before ? after : null,
    streak: streakEvent,
  };
}

module.exports = { LEVELS, SOURCES, STREAK_BONUS, dayOf, prevDay, levelOf, award };
