// @ts-check
// Places for calendar events (D-039): resolve Google Maps links the user pastes, and look places up so the user can
// confirm "is this the right place?" before an invitation goes out. Google Places API (New) when the user added a Maps
// Platform key; otherwise the chat brain finds the address with web search and Tama only builds the Maps link.
// (OpenStreetMap search was tried and rejected: wrong countries for local venues.)

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
/** Hosts a pasted Maps link may redirect through. */
const MAPS_HOST = /^(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+|consent\.google\.[a-z.]+)$/i;

/** Google Maps search link that opens the place (or the best match) in Maps. @param {string} q */
const searchLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/**
 * Pull a place out of a (full) Google Maps URL. Pure.
 * @param {string} url
 * @returns {{ name: string, lat: number | null, lng: number | null, query: string } | null}
 */
function parseMapsUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!MAPS_HOST.test(u.hostname)) return null;
  const cont = u.searchParams.get('continue'); // consent.google.com wraps the real URL
  if (/^consent\./i.test(u.hostname) && cont) return parseMapsUrl(cont);
  if (!/\/maps/.test(u.pathname) && !/^maps\./i.test(u.hostname)) return null;
  const dec = (/** @type {string} */ s) => decodeURIComponent(s.replace(/\+/g, ' ')).trim();
  const place = /\/maps\/place\/([^/@]+)/.exec(u.pathname);
  const name = place ? dec(place[1]) : '';
  // Prefer the place pin (!3d…!4d…) over the map centre (@lat,lng).
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url);
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(u.pathname);
  const ll = pin || at;
  const q = u.searchParams.get('query') || u.searchParams.get('q') || '';
  if (!name && !ll && !q) return null;
  return { name: name || dec(q), lat: ll ? Number(ll[1]) : null, lng: ll ? Number(ll[2]) : null, query: dec(q) };
}

/**
 * @param {{ fetch?: typeof fetch, key: () => string | null, near: () => { lat: number, lng: number, city?: string } | null,
 *   onCall?: (c: { op: string, ok: boolean, ms: number }) => void }} deps
 */
function createMaps({ fetch: f = fetch, key, near, onCall = () => {} }) {
  /** Follow a pasted (short) Maps link to the full URL, only through Google hosts. @param {{ url: string }} p */
  async function resolveLink({ url }) {
    let cur = String(url || '').trim();
    for (let i = 0; i < 6; i++) {
      let u;
      try { u = new URL(cur); } catch { throw new Error('That is not a link.'); }
      if (u.protocol !== 'https:' || !MAPS_HOST.test(u.hostname)) throw new Error('That is not a Google Maps link.');
      const parsed = parseMapsUrl(cur);
      if (parsed && (parsed.lat !== null || parsed.name)) {
        const label = parsed.name || parsed.query;
        return {
          name: label, lat: parsed.lat, lng: parsed.lng,
          mapsLink: /^maps\.app\.goo\.gl$/i.test(new URL(url).hostname) ? url : (parsed.lat !== null ? searchLink(`${label ? `${label} ` : ''}${parsed.lat},${parsed.lng}`.trim()) : searchLink(label)),
          verified: true,
        };
      }
      const r = await f(cur, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Tama desktop app)' } });
      const next = r.headers.get('location');
      if (!next) throw new Error('Could not read that Maps link (no place in it).');
      cur = new URL(next, cur).toString();
    }
    throw new Error('Too many redirects for that Maps link.');
  }

  /** Look a place up. With a Maps key: Google Places results; without: just a Maps search link (use web search for details). @param {{ query: string }} p */
  async function findPlace({ query }) {
    const q = String(query || '').trim();
    if (!q) throw new Error('What place should I look for?');
    const k = key();
    const n = near();
    if (!k) {
      const withCity = n && n.city && !q.toLowerCase().includes(String(n.city).toLowerCase()) ? `${q}, ${n.city}` : q;
      return { source: 'none', results: [], mapsSearchLink: searchLink(withCity), userCity: n && n.city ? n.city : null,
        note: 'No Google Maps key: use search_web to find the official name and address, then show them with mapsSearchLink and ask the user to confirm.' };
    }
    const body = { textQuery: q, maxResultCount: 3, ...(n ? { locationBias: { circle: { center: { latitude: n.lat, longitude: n.lng }, radius: 50000 } } } : {}) };
    const t0 = Date.now();
    const r = await f(PLACES_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': k, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.googleMapsUri' },
      body: JSON.stringify(body),
    });
    const j = /** @type {any} */ (await r.json().catch(() => ({})));
    onCall({ op: 'places.searchText (billable)', ok: r.ok, ms: Date.now() - t0 });
    if (!r.ok) throw new Error(`Google Maps: ${(j.error && j.error.message) || r.status}`);
    return {
      source: 'google',
      results: (j.places || []).map((/** @type {any} */ p) => ({
        name: p.displayName && p.displayName.text, address: p.formattedAddress,
        lat: p.location && p.location.latitude, lng: p.location && p.location.longitude, mapsLink: p.googleMapsUri,
      })),
    };
  }

  return { resolveLink, findPlace };
}

module.exports = { createMaps, parseMapsUrl, searchLink, MAPS_HOST };
