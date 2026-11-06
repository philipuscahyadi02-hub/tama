// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMaps, parseMapsUrl } = require('./maps');
const { describe } = require('../../brain/chat-tools');

test('parseMapsUrl: place name + pin coordinates, ?q= links, consent wrapper; non-Google links refused', () => {
  const full = 'https://www.google.com/maps/place/Grand+Sport+Central/@-6.1531,106.8901,17z/data=!3m1!4b1!4m6!3m5!1s0x2e!8m2!3d-6.1529!4d106.8925!16s';
  assert.deepEqual(parseMapsUrl(full), { name: 'Grand Sport Central', lat: -6.1529, lng: 106.8925, query: '' }); // the pin, not the map centre
  assert.equal(parseMapsUrl('https://maps.google.com/?q=Monas+Jakarta')?.name, 'Monas Jakarta');
  assert.equal(parseMapsUrl('https://consent.google.com/ml?continue=https://www.google.com/maps/place/Monas/@-6.17,106.82,17z')?.name, 'Monas');
  assert.equal(parseMapsUrl('https://evil.example/maps/place/x'), null);
  assert.equal(parseMapsUrl('https://www.google.com/search?q=x'), null);
});

test('resolveLink follows a short link through Google redirects only', async () => {
  const hops = /** @type {Record<string, string>} */ ({
    'https://maps.app.goo.gl/AbC123': 'https://consent.google.com/ml?continue=https://www.google.com/maps/place/Grand+Sport+Central/@-6.15,106.89,17z',
  });
  /** @type {any} */ const f = async (/** @type {string} */ url) => ({ headers: { get: (/** @type {string} */ h) => (h === 'location' ? hops[url] || null : null) } });
  const maps = createMaps({ fetch: f, key: () => null, near: () => null });
  const r = await maps.resolveLink({ url: 'https://maps.app.goo.gl/AbC123' });
  assert.equal(r.name, 'Grand Sport Central');
  assert.equal(r.lat, -6.15);
  assert.equal(r.mapsLink, 'https://maps.app.goo.gl/AbC123'); // the user's own link is kept
  await assert.rejects(maps.resolveLink({ url: 'https://bit.ly/xyz' }), /not a Google Maps link/);
  hops['https://maps.app.goo.gl/Evil'] = 'https://evil.example/landing';
  await assert.rejects(maps.resolveLink({ url: 'https://maps.app.goo.gl/Evil' }), /not a Google Maps link/);
});

test('findPlace: without a key → Maps search link near the user\'s city; with a key → Google Places results, biased to the city', async () => {
  const near = () => ({ lat: -6.2, lng: 106.8, city: 'Jakarta' });
  const plain = createMaps({ fetch: /** @type {any} */ (async () => { throw new Error('no network expected'); }), key: () => null, near });
  const a = await plain.findPlace({ query: 'Grand Sport Central' });
  assert.equal(a.source, 'none');
  assert.equal(a.mapsSearchLink, 'https://www.google.com/maps/search/?api=1&query=Grand%20Sport%20Central%2C%20Jakarta');
  /** @type {any[]} */ const calls = [];
  /** @type {any} */ const f = async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ places: [{ displayName: { text: 'Grand Sport Central' }, formattedAddress: 'Jl. Contoh 1, Jakarta Utara', location: { latitude: -6.15, longitude: 106.89 }, googleMapsUri: 'https://maps.google.com/?cid=1' }] }) };
  };
  const g = createMaps({ fetch: f, key: () => 'AIzaTESTKEY', near });
  const b = await g.findPlace({ query: 'Grand Sport Central' });
  assert.equal(b.source, 'google');
  assert.deepEqual(b.results[0], { name: 'Grand Sport Central', address: 'Jl. Contoh 1, Jakarta Utara', lat: -6.15, lng: 106.89, mapsLink: 'https://maps.google.com/?cid=1' });
  assert.equal(calls[0].init.headers['X-Goog-Api-Key'], 'AIzaTESTKEY');
  assert.deepEqual(JSON.parse(calls[0].init.body).locationBias.circle.center, { latitude: -6.2, longitude: 106.8 });
});

test('the event confirm card shows the place and warns when it was not checked on a map', () => {
  const base = { summary: 'Tennis', start: '2026-11-07T19:00:00+07:00', end: '2026-11-07T21:00:00+07:00', location: 'Grand Sport Central' };
  assert.match(describe('calendar_create_event', base), /📍 Grand Sport Central\n⚠️ place not checked on a map/);
  assert.match(describe('calendar_create_event', { ...base, placeLink: 'https://maps.app.goo.gl/AbC' }), /🗺️ https:\/\/maps\.app\.goo\.gl\/AbC/);
});
