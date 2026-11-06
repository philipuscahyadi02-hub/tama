// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('./logic');
const { createWeather, REFRESH_MS, STALE_MS } = require('.');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const { createDeviceSettings } = require('../../platform/store/device');

test('weather codes map to kinds; hot and cold thresholds (table)', () => {
  /** @type {Array<[number, string]>} */
  const rows = [[0, 'clear'], [1, 'clear'], [2, 'cloudy'], [3, 'cloudy'], [45, 'cloudy'], [48, 'cloudy'],
    [51, 'rain'], [61, 'rain'], [67, 'rain'], [71, 'snow'], [77, 'snow'], [80, 'rain'], [82, 'rain'],
    [85, 'snow'], [86, 'snow'], [95, 'storm'], [99, 'storm']];
  for (const [code, kind] of rows) assert.equal(W.kindOf(code), kind, `code ${code}`);
  assert.equal(W.classify(0, 30).hot, true);
  assert.equal(W.classify(0, 29.9).hot, false);
  assert.equal(W.classify(0, 3).cold, true);
  assert.equal(W.classify(0, 3.1).cold, false);
  assert.equal(W.describe(W.classify(61, 12.4)), 'rainy, 12°C');
  assert.equal(W.describe(W.classify(0, 34)), 'clear sky, 34°C (very hot)');
  assert.equal(W.describe(null), '');
});

test('parsers reject unexpected responses', () => {
  assert.equal(W.parseGeocode({}), null);
  assert.equal(W.parseGeocode({ results: [] }), null);
  assert.deepEqual(W.parseGeocode({ results: [{ name: 'Tokyo', country_code: 'JP', latitude: 35.7, longitude: 139.7 }] }), { city: 'Tokyo, JP', lat: 35.7, lon: 139.7 });
  assert.equal(W.parseCurrent({ current: { temperature_2m: 'x' } }), null);
  assert.deepEqual(W.parseCurrent({ current: { temperature_2m: 5, weather_code: 95, is_day: 0 } }), { code: 95, tempC: 5, isDay: false, kind: 'storm', hot: false, cold: false });
  assert.match(W.geocodeUrl('São Paulo'), /name=S%C3%A3o%20Paulo&count=1$/);
});

function setup() {
  const bus = new Bus();
  const device = createDeviceSettings(createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'tama-wx-'))));
  let t = 1_000_000_000;
  /** @type {string[]} */ const urls = [];
  let fail = false;
  let code = 61;
  const fetch = async (/** @type {string} */ url) => {
    urls.push(url);
    if (fail) throw new Error('offline');
    const body = url.includes('geocoding')
      ? (url.includes('Nowhere') ? { results: [] } : { results: [{ name: 'Tokyo', country: 'Japan', latitude: 35.68, longitude: 139.69 }] })
      : { current: { temperature_2m: 14.2, weather_code: code, is_day: 1 } };
    return { ok: true, status: 200, json: async () => body };
  };
  /** @type {any[]} */ const errors = [];
  bus.on('app.error', (e) => errors.push(e));
  const wx = createWeather({ bus, device, fetch, now: () => t });
  const stop = wx.start();
  return {
    bus, device, urls, errors, stop,
    advance: (/** @type {number} */ ms) => { t += ms; },
    setFail: (/** @type {boolean} */ v) => { fail = v; },
    setCode: (/** @type {number} */ v) => { code = v; },
  };
}

test('weather service: no location → nothing fetched; /weather <city> geocodes and stores per PC', async () => {
  const s = setup();
  assert.deepEqual(await s.bus.request('weather.get'), { location: null, current: null, fetchedAt: 0, summary: '' });
  assert.equal(s.urls.length, 0);
  const r = await s.bus.request('weather.set', { city: 'Tokyo' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.location, { city: 'Tokyo, Japan', lat: 35.68, lon: 139.69 });
  assert.equal(r.current.kind, 'rain');
  assert.equal(r.summary, 'rainy, 14°C');
  assert.deepEqual(s.device.get().weather, { city: 'Tokyo, Japan', lat: 35.68, lon: 139.69 });
  assert.match(s.urls[1], /latitude=35.68&longitude=139.69&current=temperature_2m,weather_code,is_day/);
  assert.match((await s.bus.request('weather.set', { city: 'Nowhere' })).error, /couldn't find/);
  assert.match((await s.bus.request('weather.set', { city: '' })).error, /city/);
  const off = await s.bus.request('weather.set', { off: true });
  assert.equal(off.location, null);
  assert.equal(s.device.get().weather, null);
  s.stop();
});

test('weather service: cached for 30 minutes, refreshed after', async () => {
  const s = setup();
  await s.bus.request('weather.set', { city: 'Tokyo' });
  const n = s.urls.length;
  s.advance(REFRESH_MS - 1000);
  await s.bus.request('weather.get');
  assert.equal(s.urls.length, n); // still cached
  s.setCode(0);
  s.advance(2000);
  const r = await s.bus.request('weather.get');
  assert.equal(s.urls.length, n + 1);
  assert.equal(r.current.kind, 'clear');
  // concurrent callers share one request
  s.advance(REFRESH_MS);
  await Promise.all([s.bus.request('weather.get'), s.bus.request('weather.get')]);
  assert.equal(s.urls.length, n + 2);
  s.stop();
});

test('weather service: failures are quiet, not retried before 30 min, stale readings dropped', async () => {
  const s = setup();
  await s.bus.request('weather.set', { city: 'Tokyo' });
  s.setFail(true);
  s.advance(REFRESH_MS);
  const r = await s.bus.request('weather.get');
  assert.equal(r.current.kind, 'rain'); // last good reading is still fine
  assert.equal(s.errors.length, 1);
  assert.equal(s.errors[0].topic, 'weather.fetch');
  const n = s.urls.length;
  s.advance(60000);
  await s.bus.request('weather.get');
  assert.equal(s.urls.length, n); // no hammering while offline
  s.advance(STALE_MS);
  assert.equal((await s.bus.request('weather.get')).current, null);
  // geocoding while offline gives a friendly error
  assert.match((await s.bus.request('weather.set', { city: 'Paris' })).error, /couldn't reach/);
  s.stop();
});
