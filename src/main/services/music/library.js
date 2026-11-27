// @ts-check
// The user's YouTube library in the music widget (MUS-6): playlists, their songs and search come from the Google
// service (YouTube Data API, read-only); playing one opens it in the paired YouTube Music tab, or without the
// extension on music.youtube.com in the default browser, where the user's own Premium session plays it.
const { TOPICS } = require('../../bus-topics');

const ID = /^[\w-]{2,64}$/;
const BASE = 'https://music.youtube.com';

/** encodeURIComponent plus the few characters it leaves that the music link check refuses. @param {string} s */
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Pure: the YouTube Music link that plays a song, a song inside a playlist, or a playlist from its start.
 * "liked" is YouTube Music's own Liked music list (LM). Returns '' for bad ids.
 * @param {{ videoId?: string, playlistId?: string }} p
 */
function playUrl({ videoId = '', playlistId = '' }) {
  const list = playlistId === 'liked' ? 'LM' : playlistId;
  if (videoId && !ID.test(videoId)) return '';
  if (list && !ID.test(list)) return '';
  if (videoId) return `${BASE}/watch?v=${videoId}${list ? `&list=${list}` : ''}`;
  return list ? `${BASE}/watch?list=${list}` : '';
}

/** Pure: a search page link (used when there is no Google sign-in to search with). @param {string} q */
const searchUrl = (q) => `${BASE}/search?q=${enc(String(q).trim().slice(0, 120))}`;

/**
 * @param {{ bus: import('../../bus').BusInstance, control: (p: any) => Promise<any> }} deps
 *   control: the music service's control (handles extension tab vs default browser for `open`).
 */
function createLibrary({ bus, control }) {
  const google = (/** @type {any} */ p) => bus.request(TOPICS.GOOGLE_YOUTUBE, p).catch((e) => ({ error: String(e?.message || e) }));

  /** Turn on the YouTube switch and sign in again when the permission is missing. */
  async function connect() {
    const st = await bus.request(TOPICS.GOOGLE_STATUS).catch(() => null);
    if (!st || !st.signedIn) return { error: 'Sign in to Google first (/google), then connect YouTube.', fix: 'google' };
    const r = await bus.request(TOPICS.GOOGLE_SET, { youtube: true });
    if (!r || !r.needsLogin) return { ok: true };
    const l = await bus.request(TOPICS.GOOGLE_LOGIN).catch((e) => ({ error: String(e?.message || e) }));
    return l && l.error ? { error: l.error } : { ok: true };
  }

  /** @param {any} p */
  async function library(p) {
    const op = String(p?.op || '');
    if (op === 'connect') return connect();
    if (op === 'playlists') return google({ op, fresh: p?.fresh === true });
    if (op === 'items') return google({ op, id: String(p?.id || '').slice(0, 64) });
    if (op === 'search') return google({ op, q: String(p?.q || '').slice(0, 120) });
    return { error: `unknown request "${op.slice(0, 20)}"` };
  }

  /** @param {any} p { videoId?, playlistId?, query? } */
  async function play(p) {
    const query = typeof p?.query === 'string' ? p.query.trim().slice(0, 120) : '';
    if (query) {
      const r = await google({ op: 'search', q: query });
      const song = r && r.songs && r.songs[0];
      if (!song) {
        // No Google (or nothing found): open YouTube Music's own search so the user can pick.
        if (r && r.songs) return { ok: false, error: `Nothing found for "${query}".` };
        const o = await control({ action: 'open', value: searchUrl(query) });
        return o.ok ? { ok: true, opened: 'search', note: 'Opened the search on YouTube Music (connect YouTube in Tama to play the first match).' } : o;
      }
      const o = await control({ action: 'open', value: playUrl({ videoId: song.videoId }) });
      return o.ok ? { ...o, song } : o;
    }
    const url = playUrl({ videoId: String(p?.videoId || ''), playlistId: String(p?.playlistId || '') });
    if (!url) return { ok: false, error: 'Nothing to play.' };
    return control({ action: 'open', value: url });
  }

  return { library, play };
}

module.exports = { createLibrary, playUrl, searchUrl };
