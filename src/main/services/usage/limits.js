// @ts-check
// Limits (USE-5..7, D-041): what is LEFT. Claude plan windows (exact, from the SDK), Gemini tier + quota-hit warnings
// (agy shares no remaining quota), Google calls this month incl. billable Places calls against a cap the user sets.
// History in usage/limits.jsonl (kept 90 days) for the trend chart; warnings at 25 % and 10 % left, once per window.
const { TOPICS } = require('../../bus-topics');
const { dayOf } = require('../pet/bond');

const REFRESH_MS = 20 * 60000;
const HISTORY_DAYS = 90;
const DEFAULT_ALERTS = [0.25, 0.10]; // fraction LEFT
const NICE = /** @type {Record<string, string>} */ ({ five_hour: '5-hour', seven_day: 'weekly', seven_day_opus: 'weekly Opus', seven_day_sonnet: 'weekly Sonnet', seven_day_oauth_apps: 'weekly apps' });

/** @param {string} k */
const nice = (k) => NICE[k] || k.replace(/^model:/, '');

/**
 * Which warnings to send now (pure): crossing below each threshold, once per window reset.
 * @param {Record<string, { used: number, resetsAt: number | null }>} windows @param {Record<string, true>} sent @param {number[]} alerts
 */
function dueAlerts(windows, sent, alerts) {
  /** @type {Array<{ key: string, window: string, left: number, resetsAt: number | null, threshold: number }>} */
  const out = [];
  for (const [w, v] of Object.entries(windows)) {
    const left = 1 - v.used;
    const hit = alerts.filter((a) => left <= a).sort((a, b) => a - b)[0]; // the most severe threshold crossed
    if (hit === undefined) continue;
    // The two sources report the same reset a few hundred ms apart: key on the minute.
    const key = `${w}|${v.resetsAt ? Math.round(v.resetsAt / 60000) : ''}|${hit}`;
    if (!sent[key]) out.push({ key, window: w, left, resetsAt: v.resetsAt, threshold: hit });
  }
  return out;
}

/**
 * @param {{
 *   bus: import('../../bus').BusInstance, store: import('../../platform/store').Store,
 *   device: import('../../platform/store/device').DeviceSettings,
 *   entries: () => Array<import('./index').UsageEntry>,
 *   refreshClaude?: () => Promise<any>, now?: () => number,
 * }} deps
 */
function createLimits({ bus, store, device, entries, refreshClaude = async () => null, now = Date.now }) {
  const cur = () => ({ claude: {}, gemini: {}, google: {}, alertsSent: {}, alertAt: DEFAULT_ALERTS, ...(device.get().limits || {}) });
  const save = (/** @type {any} */ patch) => device.patch('limits', patch);
  /** @type {Array<{ at: number, window: string, used: number, resetsAt: number | null }>} */
  let history = [];

  function loadHistory() {
    let text = '';
    try { text = store.readText('usage/limits.jsonl'); } catch { return; }
    const from = now() - HISTORY_DAYS * 86400000;
    history = text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x) => x && x.at >= from);
    store.writeText('usage/limits.jsonl', history.map((h) => JSON.stringify(h)).join('\n') + (history.length ? '\n' : ''));
  }

  /** Claude windows from a turn's rate-limit event or a live check. @param {{ windows: Record<string, any>, source: string, extra?: any, breakdown?: any[], subscription?: string | null, status?: string | null }} p */
  function onClaude(p) {
    const c = cur();
    const prev = c.claude.windows || {};
    const windows = { ...prev, ...p.windows };
    for (const [w, v] of Object.entries(p.windows)) {
      const old = prev[w];
      if (!old || Math.abs(old.used - v.used) >= 0.01 || old.resetsAt !== v.resetsAt) {
        const h = { at: now(), window: w, used: v.used, resetsAt: v.resetsAt };
        history.push(h);
        store.appendLine('usage/limits.jsonl', JSON.stringify(h));
      }
    }
    save({ claude: { ...c.claude, windows, updatedAt: now(), source: p.source, ...(p.extra !== undefined ? { extra: p.extra } : {}), ...(p.breakdown ? { breakdown: p.breakdown } : {}), ...(p.subscription ? { subscription: p.subscription } : {}) } });
    const sent = { ...c.alertsSent };
    for (const a of dueAlerts(p.windows, sent, c.alertAt)) {
      sent[a.key] = true;
      const reset = a.resetsAt ? new Date(a.resetsAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'later';
      bus.emit(TOPICS.BRAIN_NOTICE, { text: `Claude ${nice(a.window)} limit: only ${Math.round(a.left * 100)}% left (resets ${reset}). Maybe /model sonnet or /effort low~`, kind: 'warn' });
    }
    save({ alertsSent: Object.fromEntries(Object.entries(sent).slice(-200)) });
    bus.emit(TOPICS.USAGE_CHANGED, { limits: true });
  }

  /** @param {any} l */
  function onLimit(l) {
    if (!l) return;
    if (l.provider === 'gemini') {
      const c = cur();
      save({ gemini: { ...c.gemini, ...(l.tier ? { tier: l.tier } : {}), ...(l.hit ? { lastHit: { at: now(), message: String(l.hit).slice(0, 200) } } : {}) } });
      if (l.hit) bus.emit(TOPICS.BRAIN_NOTICE, { text: 'Gemini says its quota is used up for now… chat may pause until it resets 💤', kind: 'warn' });
      return;
    }
    if (l.windows) onClaude({ windows: l.windows, source: l.source || 'turn', status: l.status });
  }

  async function refresh() {
    const r = await refreshClaude().catch(() => null);
    if (r && r.windows) onClaude({ ...r, source: 'live' });
    return get();
  }

  async function get() {
    const c = cur();
    const t = now();
    const today = dayOf(t);
    const month = today.slice(0, 7);
    const all = entries();
    const gem = all.filter((e) => e.provider === 'gemini' && dayOf(e.at) === today);
    const goo = all.filter((e) => e.provider === 'google' && dayOf(e.at).slice(0, 7) === month);
    /** @type {Record<string, number>} */ const byApi = {};
    for (const e of goo) { const api = String(e.op).split(/[ .]/)[0]; byApi[api] = (byApi[api] || 0) + 1; }
    const places = goo.filter((e) => /^places/.test(e.op)).length;
    const gstat = await bus.request(TOPICS.GOOGLE_STATUS).catch(() => null);
    const clientId = gstat && gstat.clientId ? String(gstat.clientId) : '';
    return {
      claude: {
        ...c.claude,
        windows: Object.fromEntries(Object.entries(c.claude.windows || {}).map(([k, v]) => [k, { ...v, left: 1 - v.used, label: nice(k), expired: !!(v.resetsAt && v.resetsAt < t) }])),
        history: history.filter((h) => h.at >= t - 7 * 86400000),
      },
      gemini: { ...c.gemini, today: { turns: gem.length, tokens: gem.reduce((a, e) => a + (e.tokens || 0), 0) } },
      google: { month: { calls: goo.length, byApi, places }, placesCap: c.google.placesCap || null, project: clientId ? clientId.split('-')[0] : null, signedIn: !!(gstat && gstat.signedIn) },
      alertAt: c.alertAt,
    };
  }

  /** @param {{ placesCap?: number | null, alertAt?: number[] }} p */
  function set(p) {
    const c = cur();
    if (p.placesCap === null || (Number.isFinite(p.placesCap) && Number(p.placesCap) >= 0)) save({ google: { ...c.google, placesCap: p.placesCap === null ? null : Math.round(Number(p.placesCap)) } });
    if (Array.isArray(p.alertAt)) save({ alertAt: p.alertAt.map(Number).filter((x) => x > 0 && x < 1).slice(0, 4) });
    return get();
  }

  function start() {
    loadHistory();
    const timer = setInterval(() => { refresh().catch(() => null); }, REFRESH_MS);
    const first = setTimeout(() => { refresh().catch(() => null); }, 30000);
    const offs = [
      bus.on(TOPICS.USAGE_LIMIT, onLimit),
      bus.handle(TOPICS.USAGE_LIMITS_GET, () => get()),
      bus.handle(TOPICS.USAGE_LIMITS_REFRESH, () => refresh()),
      bus.handle(TOPICS.USAGE_LIMITS_SET, (/** @type {any} */ p) => set(p || {})),
    ];
    return () => { clearInterval(timer); clearTimeout(first); for (const off of offs) off(); };
  }

  return { start, get, refresh, set, onLimit };
}

module.exports = { createLimits, dueAlerts };
