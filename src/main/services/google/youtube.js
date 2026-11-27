// @ts-check
// YouTube account data (MUS-6): the user's playlists, their songs, liked music and song search through the YouTube Data
// API with the read-only youtube.readonly scope. No unofficial APIs or cookies (D-006). Results are cached to save the
// daily quota (10,000 units; a search costs 100, a list 1). Titles come from YouTube: untrusted text, kept short.

const { createApi } = require('./api');

const API = 'https://youtube.googleapis.com/youtube/v3';
const LIST_TTL = 10 * 60000;
const SEARCH_TTL = 60 * 60000;
const MAX_ITEMS = 200;
const ID = /^[\w-]{2,64}$/;
/** Drops nulls with the type narrowed. @template T @param {Array<T | null>} a @returns {T[]} */
const present = (a) => /** @type {T[]} */ (a.filter((x) => x !== null));

const str = (/** @type {any} */ v, /** @type {number} */ max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');
/** Biggest thumbnail up to "medium" (320 px), from YouTube's image hosts only. @param {any} th */
function thumb(th) {
  const t = th && (th.medium || th.default || th.high);
  const u = t && typeof t.url === 'string' ? t.url : '';
  return /^https:\/\/([a-z0-9-]+\.)*(ytimg\.com|ggpht\.com|googleusercontent\.com)\//i.test(u) ? u : '';
}
/** "Artist - Topic" channels are YouTube Music's auto channels: show just the artist. @param {string} s */
const artist = (s) => str(s, 120).replace(/ - Topic$/, '');

/**
 * Pure: one playlist row. @param {any} p
 * @returns {{ id: string, title: string, count: number, art: string } | null}
 */
function slimPlaylist(p) {
  if (!p || !ID.test(String(p.id || ''))) return null;
  return { id: String(p.id), title: str(p.snippet && p.snippet.title, 150) || 'Untitled', count: Number(p.contentDetails && p.contentDetails.itemCount) || 0, art: thumb(p.snippet && p.snippet.thumbnails) };
}

/**
 * Pure: one song row from a playlist item, a video or a search result. Deleted and private videos are dropped.
 * @param {any} it
 * @returns {{ videoId: string, title: string, artist: string, art: string } | null}
 */
function slimSong(it) {
  const s = (it && it.snippet) || {};
  const videoId = String((s.resourceId && s.resourceId.videoId) || (it && it.id && typeof it.id === 'object' ? it.id.videoId : it && it.id) || '');
  const title = str(s.title, 200);
  if (!ID.test(videoId) || !title || /^(Deleted|Private) video$/.test(title)) return null;
  return { videoId, title, artist: artist(s.videoOwnerChannelTitle || s.channelTitle || ''), art: thumb(s.thumbnails) };
}

/** Readable errors for the usual YouTube API failures. @param {any} e */
function explain(e) {
  const m = String((e && e.message) || e);
  if (/has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(m)) return { error: 'The YouTube Data API is off in your Google Cloud project. Turn it on, then try again.', fix: 'enable-api' };
  if (/quotaExceeded|dailyLimitExceeded|quota/i.test(m)) return { error: 'YouTube\'s daily limit for your project is used up. It resets at midnight Pacific time.', fix: 'quota' };
  if (/permission missing|insufficient|Not signed in|invalid_grant/i.test(m)) return { error: 'Tama needs the YouTube permission again. Connect YouTube.', fix: 'connect' };
  if (/playlistNotFound|404/i.test(m)) return { error: 'That playlist is gone or private.' };
  return { error: m.slice(0, 200) };
}

/**
 * @param {ReturnType<typeof import('./api').createApi>} api
 * @param {{ now?: () => number }} [o]
 */
function createYoutube(api, { now = Date.now } = {}) {
  /** @type {Map<string, { at: number, ttl: number, value: any }>} */ const cache = new Map();
  /** @template T @param {string} key @param {number} ttl @param {() => Promise<T>} fn @returns {Promise<T>} */
  async function cached(key, ttl, fn) {
    const hit = cache.get(key);
    if (hit && now() - hit.at < hit.ttl) return hit.value;
    const value = await fn();
    cache.set(key, { at: now(), ttl, value });
    if (cache.size > 100) cache.delete(/** @type {string} */ (cache.keys().next().value));
    return value;
  }

  /** Pages through a list endpoint up to `max` rows. @param {string} path @param {Record<string, any>} query @param {number} max */
  async function pages(path, query, max) {
    /** @type {any[]} */ const out = [];
    let pageToken;
    do {
      const r = await api.request(`${API}/${path}`, { query: { ...query, maxResults: 50, pageToken } });
      out.push(...(r.items || []));
      pageToken = r.nextPageToken;
    } while (pageToken && out.length < max);
    return out.slice(0, max);
  }

  return {
    /** The user's playlists, plus "Liked music" first. */
    playlists: (/** @type {boolean} */ fresh = false) => {
      if (fresh) cache.delete('playlists');
      return cached('playlists', LIST_TTL, async () => {
        const rows = present((await pages('playlists', { part: 'snippet,contentDetails', mine: true }, MAX_ITEMS)).map(slimPlaylist));
        return [{ id: 'liked', title: 'Liked music', count: 0, art: '', liked: true }, ...rows];
      });
    },
    /** Songs of one playlist ("liked" = videos the user liked, music only). @param {string} id */
    items: (id) => {
      if (id === 'liked') {
        return cached('liked', LIST_TTL, async () => present((await pages('videos', { part: 'snippet', myRating: 'like' }, MAX_ITEMS))
          .filter((v) => v && v.snippet && v.snippet.categoryId === '10').map(slimSong)));
      }
      if (!ID.test(id)) return Promise.reject(new Error('That playlist id does not look right.'));
      return cached(`items:${id}`, LIST_TTL, async () => present((await pages('playlistItems', { part: 'snippet', playlistId: id }, MAX_ITEMS)).map(slimSong)));
    },
    /** Songs matching words (100 quota units, so cached for an hour). @param {string} q */
    search: (q) => {
      const words = str(q, 120);
      if (!words) return Promise.resolve([]);
      return cached(`search:${words.toLowerCase()}`, SEARCH_TTL, async () => {
        const r = await api.request(`${API}/search`, { query: { part: 'snippet', q: words, type: 'video', videoCategoryId: '10', maxResults: 20, safeSearch: 'none' } });
        return present((r.items || []).map(slimSong));
      });
    },
    clear: () => cache.clear(),
  };
}

/** Quota units a call costs (YouTube Data API v3). Pure. @param {string} op e.g. "youtube search GET" */
const quotaUnits = (op) => (/^youtube search/.test(op) ? 100 : /^youtube /.test(op) ? 1 : 0);

const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const KEY = 'google.youtube.tokens';

/**
 * YouTube's own grant (D-073): Google refuses youtube.readonly in the same request as Drive scopes, so YouTube gets a
 * separate sign-in with only that scope and its own tokens in secrets. It may even be another Google account.
 * @param {{
 *   secrets: { get: (k: string) => string | null, set: (k: string, v: string) => void, delete: (k: string) => void },
 *   oauth: { authorize: Function, refresh: Function, revoke: Function },
 *   client: () => { clientId: string, clientSecret: string } | null,
 *   openExternal: (url: string) => any, fetch?: typeof fetch, now?: () => number,
 *   onCall?: (c: { method: string, url: string, status: number, ms: number }) => void,
 *   onError?: (message: string) => void, onChange?: () => void,
 * }} d
 */
function createYoutubeAccess({ secrets, oauth, client, openExternal, fetch: f = fetch, now = Date.now, onCall = () => {}, onError = () => {}, onChange = () => {} }) {
  const tokens = () => { try { return JSON.parse(secrets.get(KEY) || 'null'); } catch { return null; } };
  const connected = () => !!(tokens() && tokens().refresh_token);
  const api = createApi({
    onCall, fetch: f, now,
    getTokens: tokens, saveTokens: (t) => secrets.set(KEY, JSON.stringify(t)),
    refresh: (rt) => { const c = client(); if (!c) throw new Error('Google client not set up.'); return oauth.refresh({ clientId: c.clientId, clientSecret: c.clientSecret, refreshToken: rt, fetch: f }); },
  });
  const yt = createYoutube(api, { now });

  async function connect() {
    const c = client();
    if (!c) return { error: 'Set up Google first (/google).', fix: 'google' };
    try {
      const r = await oauth.authorize({ clientId: c.clientId, clientSecret: c.clientSecret, scopes: [SCOPE], openExternal, fetch: f, includeGranted: false });
      if (!r.refresh_token) return { error: 'Google did not return a refresh token. Remove Tama at myaccount.google.com/permissions and connect again.' };
      secrets.set(KEY, JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, expiry: now() + (r.expires_in || 3600) * 1000, scope: r.scope || SCOPE }));
      yt.clear();
      onChange();
      return { ok: true };
    } catch (e) { return { error: String((/** @type {any} */ (e)).message || e).slice(0, 200) }; }
  }

  async function disconnect() {
    const t = tokens();
    if (t && t.refresh_token) await oauth.revoke(t.refresh_token, f);
    secrets.delete(KEY);
    yt.clear();
    onChange();
  }

  /** @param {{ op?: string, id?: string, q?: string, fresh?: boolean }} p */
  async function data(p) {
    if (p.op === 'connect') return connect();
    if (!connected()) return { error: 'Connect YouTube to see your playlists.', fix: 'connect' };
    try {
      if (p.op === 'playlists') return { playlists: await yt.playlists(!!p.fresh) };
      if (p.op === 'items') return { songs: await yt.items(String(p.id || '')) };
      if (p.op === 'search') return { songs: await yt.search(String(p.q || '')) };
      return { error: 'unknown request' };
    } catch (e) {
      const x = explain(e);
      if (!x.fix) onError(String((/** @type {any} */ (e)).message || e));
      return x;
    }
  }

  return { connected, connect, disconnect, data };
}

module.exports = { createYoutube, createYoutubeAccess, slimPlaylist, slimSong, explain, quotaUnits, API, SCOPE };
