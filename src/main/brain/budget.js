// @ts-check
// Daily engine usage + Claude budget (BRAIN-4, SAFE-5). Pure functions over a small usage record.
// Claude's cost is the SDK's API-equivalent estimate (on a subscription you don't pay it per token,
// but it tracks how hard you're using it). A rate/usage-limit error also marks Claude as tight.

const LIMIT_RE = /usage limit|rate limit|rate_limit|quota|limit reached|overloaded|too many requests|429/i;
const LIMIT_COOLDOWN_MS = 60 * 60 * 1000;

/** @param {number} t */
function dayOf(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * @typedef {{ day: string, claudeUsd: number, claudeTurns: number, agyTurns: number, agyTokens: number, liteTurns: number, limitHitAt: number }} Usage
 */

/** @param {number} now @returns {Usage} */
const fresh = (now) => ({ day: dayOf(now), claudeUsd: 0, claudeTurns: 0, agyTurns: 0, agyTokens: 0, liteTurns: 0, limitHitAt: 0 });

/** Roll over at local midnight (keeps limitHitAt so a late-night limit still cools down). @param {Usage | undefined} u @param {number} now */
function today(u, now) {
  if (!u || u.day !== dayOf(now)) return { ...fresh(now), limitHitAt: (u && u.limitHitAt) || 0 };
  return u;
}

/**
 * Record one finished turn.
 * @param {Usage | undefined} u @param {{ engine: string, role: string, ev: any }} r @param {number} now
 * @returns {Usage}
 */
function record(u, { engine, role, ev }, now) {
  const x = { ...today(u, now) };
  if (role === 'lite') x.liteTurns += 1;
  else if (engine === 'claude') { x.claudeTurns += 1; x.claudeUsd += Number(ev.cost) || 0; }
  else if (engine === 'agy') { x.agyTurns += 1; x.agyTokens += Number(ev.tokens) || 0; }
  if (engine === 'claude' && ev.isError && LIMIT_RE.test(String(ev.text || ev.message || ''))) x.limitHitAt = now;
  return x;
}

/**
 * Is Claude "tight" right now? (over 90% of the daily budget, or recently hit a usage limit)
 * @param {Usage | undefined} u @param {{ dailyClaudeUsd: number }} cfg @param {number} now
 */
function claudeTight(u, cfg, now) {
  const x = today(u, now);
  if (x.limitHitAt && now - x.limitHitAt < LIMIT_COOLDOWN_MS) return { tight: true, reason: 'usage limit hit' };
  if (cfg.dailyClaudeUsd > 0 && x.claudeUsd >= cfg.dailyClaudeUsd * 0.9) return { tight: true, reason: `≈$${x.claudeUsd.toFixed(2)} of $${cfg.dailyClaudeUsd} daily budget` };
  return { tight: false, reason: '' };
}

/** Crossed the 75% warning line with this turn? @param {Usage} before @param {Usage} after @param {{ dailyClaudeUsd: number }} cfg */
function crossedWarning(before, after, cfg) {
  if (!(cfg.dailyClaudeUsd > 0)) return false;
  const line = cfg.dailyClaudeUsd * 0.75;
  return before.claudeUsd < line && after.claudeUsd >= line;
}

module.exports = { dayOf, fresh, today, record, claudeTight, crossedWarning, LIMIT_RE };
