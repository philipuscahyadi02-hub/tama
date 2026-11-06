// @ts-check
// Usage log (M8, D-040): every AI turn and Google/Telegram call Tama makes, as numbers only (never prompt, email or file
// contents), in <data>/usage/YYYY-MM.jsonl on this PC. Feeds the Usage & accounts dashboard. Keeps 3 months.
const { TOPICS } = require('../../bus-topics');
const { dayOf } = require('../pet/bond');

const KEEP_MONTHS = 3;
const MEMORY_MAX = 5000;

/**
 * @typedef {{
 *   at: number, provider: 'claude'|'gemini'|'google'|'telegram', surface: string, op: string,
 *   model?: string, tokensIn?: number, tokensOut?: number, cacheRead?: number, cacheWrite?: number, tokens?: number,
 *   costUsd?: number, ms?: number, ok: boolean, account?: string,
 * }} UsageEntry
 */

const month = (/** @type {number} */ t) => dayOf(t).slice(0, 7);
const PROVIDERS = ['claude', 'gemini', 'google', 'telegram'];

/** Turn whatever a caller reported into a clean entry (numbers and short labels only). @param {any} e @param {number} t */
function clean(e, t) {
  const num = (/** @type {any} */ v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v) * 1e6) / 1e6 : undefined);
  const short = (/** @type {any} */ v, n = 60) => (v === undefined || v === null || v === '' ? undefined : String(v).replace(/[\r\n]+/g, ' ').slice(0, n));
  return /** @type {UsageEntry} */ (Object.fromEntries(Object.entries({
    at: t, provider: PROVIDERS.includes(e.provider) ? e.provider : 'claude', surface: short(e.surface, 20) || 'app', op: short(e.op, 60) || 'call',
    model: short(e.model, 60), tokensIn: num(e.tokensIn), tokensOut: num(e.tokensOut), cacheRead: num(e.cacheRead), cacheWrite: num(e.cacheWrite),
    tokens: num(e.tokens), costUsd: num(e.costUsd), ms: num(e.ms), ok: e.ok !== false, account: short(e.account, 80),
  }).filter(([, v]) => v !== undefined)));
}

/**
 * Summaries per day and provider for the dashboard. Pure.
 * @param {UsageEntry[]} entries @param {number} days @param {number} now
 */
function summarize(entries, days, now) {
  const since = new Date(now); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1));
  const from = since.getTime();
  /** @type {Record<string, Record<string, { calls: number, tokens: number, costUsd: number, errors: number }>>} */
  const byDay = {};
  /** @type {Record<string, { calls: number, tokens: number, costUsd: number, errors: number, ops: Record<string, number> }>} */
  const totals = {};
  for (const p of PROVIDERS) totals[p] = { calls: 0, tokens: 0, costUsd: 0, errors: 0, ops: {} };
  for (let i = 0; i < days; i++) { const d = new Date(from); d.setDate(d.getDate() + i); byDay[dayOf(d.getTime())] = {}; }
  for (const e of entries) {
    if (e.at < from) continue;
    const day = dayOf(e.at);
    const tok = e.tokens !== undefined ? e.tokens : (e.tokensIn || 0) + (e.tokensOut || 0) + (e.cacheRead || 0) + (e.cacheWrite || 0);
    const slot = (byDay[day] = byDay[day] || {});
    const s = (slot[e.provider] = slot[e.provider] || { calls: 0, tokens: 0, costUsd: 0, errors: 0 });
    for (const x of [s, totals[e.provider]]) { x.calls++; x.tokens += tok; x.costUsd += e.costUsd || 0; if (!e.ok) x.errors++; }
    totals[e.provider].ops[e.op] = (totals[e.provider].ops[e.op] || 0) + 1;
  }
  return { days, from, byDay, totals };
}

/** @param {{ bus: import('../../bus').BusInstance, store: import('../../platform/store').Store, device: import('../../platform/store/device').DeviceSettings, now?: () => number }} deps */
function createUsageLog({ bus, store, device, now = Date.now }) {
  /** @type {UsageEntry[]} */
  let recent = [];

  function load() {
    const t = now();
    const months = [];
    for (let i = KEEP_MONTHS - 1; i >= 0; i--) { const d = new Date(t); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(month(d.getTime())); }
    for (const f of store.listFiles('usage')) {
      const m = /^(\d{4}-\d{2})\.jsonl$/.exec(f);
      if (m && !months.includes(m[1])) store.removeFile(`usage/${f}`); // retention
    }
    /** @type {UsageEntry[]} */ const all = [];
    for (const m of months) {
      let text = '';
      try { text = store.readText(`usage/${m}.jsonl`); } catch { continue; }
      for (const line of text.split('\n')) { if (!line.trim()) continue; try { all.push(JSON.parse(line)); } catch { /* skip a torn line */ } }
    }
    recent = all.slice(-MEMORY_MAX);
  }

  /** @param {any} e */
  function record(e) {
    const entry = clean(e || {}, now());
    store.appendLine(`usage/${month(entry.at)}.jsonl`, JSON.stringify(entry));
    recent.push(entry);
    if (recent.length > MEMORY_MAX) recent = recent.slice(-MEMORY_MAX);
    bus.emit(TOPICS.USAGE_CHANGED, { last: entry });
    return entry;
  }

  /** @param {{ days?: number, provider?: string, limit?: number }} [p] */
  function get(p = {}) {
    const days = Math.min(90, Math.max(1, Number(p.days) || 14));
    const list = p.provider ? recent.filter((e) => e.provider === p.provider) : recent;
    return {
      summary: summarize(recent, days, now()),
      entries: list.slice(-(Math.min(1000, Number(p.limit) || 300))).reverse(),
    };
  }

  function start() {
    load();
    const offs = [
      bus.on(TOPICS.USAGE_RECORD, (/** @type {any} */ e) => { try { record(e); } catch (x) { bus.emit(TOPICS.APP_ERROR, { topic: 'usage', message: String(/** @type {Error} */ (x).message) }); } }),
      bus.handle(TOPICS.USAGE_GET, (/** @type {any} */ p) => get(p || {})),
    ];
    return () => { for (const off of offs) off(); };
  }

  return { start, record, get, load, entries: () => recent };
}

module.exports = { createUsageLog, summarize, clean };
