// @ts-check
// Weather service (EVT-1, D-035): a per-PC location (device.json `weather`) set with /weather <city>, and the
// current weather from Open-Meteo (no API key), fetched at most every 30 minutes and only while a location is set.
// Network failures are quiet: events and chat simply go on without weather.
const { TOPICS } = require('../../bus-topics');
const W = require('./logic');

const REFRESH_MS = 30 * 60000;
/** Older readings are dropped rather than shown as "now". */
const STALE_MS = 3 * 3600000;
const TIMEOUT_MS = 10000;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   device: import('../../platform/store/device').DeviceSettings,
 *   fetch?: (url: string, init?: any) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>,
 *   now?: () => number,
 * }} deps
 */
function createWeather({ bus, device, fetch = /** @type {any} */ (globalThis.fetch), now = Date.now }) {
  /** @type {{ at: number, weather: import('./logic').Weather, key: string } | null} */
  let cache = null;
  let lastTry = 0;
  /** @type {Promise<void> | null} */
  let inFlight = null;

  /** @returns {import('./logic').WeatherLocation | null} */
  const location = () => {
    const l = device.get().weather;
    return l && typeof l.lat === 'number' && typeof l.lon === 'number' ? l : null;
  };
  const keyOf = (/** @type {import('./logic').WeatherLocation} */ l) => `${l.lat},${l.lon}`;

  /** @param {string} url */
  async function getJson(url) {
    if (typeof fetch !== 'function') throw new Error('fetch unavailable');
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  /** @param {import('./logic').WeatherLocation} loc */
  async function refresh(loc) {
    lastTry = now();
    try {
      const w = W.parseCurrent(await getJson(W.forecastUrl(loc)));
      if (!w) throw new Error('unexpected forecast response');
      cache = { at: now(), weather: w, key: keyOf(loc) };
    } catch (e) {
      bus.emit(TOPICS.APP_ERROR, { topic: 'weather.fetch', message: String((/** @type {any} */ (e)).message || e) });
    }
  }

  /** Current weather for the saved location (refreshing when older than 30 min), or nulls. */
  async function get() {
    const loc = location();
    if (!loc) return { location: null, current: null, fetchedAt: 0, summary: '' };
    const fresh = cache && cache.key === keyOf(loc) && now() - cache.at < REFRESH_MS;
    if (!fresh && now() - lastTry >= REFRESH_MS) {
      if (!inFlight) inFlight = refresh(loc).finally(() => { inFlight = null; });
      await inFlight;
    } else if (inFlight) await inFlight;
    const current = cache && cache.key === keyOf(loc) && now() - cache.at < STALE_MS ? cache.weather : null;
    return { location: loc, current, fetchedAt: current && cache ? cache.at : 0, summary: W.describe(current) };
  }

  /** @param {{ city?: string, off?: boolean }} p */
  async function set(p) {
    if (p.off) {
      device.patch(null, { weather: null });
      cache = null;
      return { ok: true, location: null, current: null, fetchedAt: 0, summary: '' };
    }
    const city = String(p.city || '').trim().slice(0, 80);
    if (city.length < 2) return { error: 'Tell me a city, e.g. /weather Tokyo' };
    let loc;
    try { loc = W.parseGeocode(await getJson(W.geocodeUrl(city))); } catch (e) {
      bus.emit(TOPICS.APP_ERROR, { topic: 'weather.geocode', message: String((/** @type {any} */ (e)).message || e) });
      return { error: "I couldn't reach the weather service. Try again later?" };
    }
    if (!loc) return { error: `I couldn't find "${city}" on the map~` };
    device.patch(null, { weather: loc });
    cache = null;
    lastTry = 0;
    return { ok: true, ...(await get()) };
  }

  function start() {
    const offs = [
      bus.handle(TOPICS.WEATHER_GET, () => get()),
      bus.handle(TOPICS.WEATHER_SET, (/** @type {any} */ p) => set(p || {})),
    ];
    return () => { for (const off of offs) off(); };
  }

  return { start, get, set };
}

module.exports = { createWeather, REFRESH_MS, STALE_MS };
