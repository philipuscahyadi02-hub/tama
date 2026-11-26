// @ts-check
// Music state (MUS-1, MUS-10): pure helpers. Everything the Tama Companion extension sends is untrusted page data, so
// it is rebuilt field by field with types and size caps before it reaches the bus.

/**
 * @typedef {{ index: number, title: string, artist: string, duration: number, art: string, current: boolean }} QueueItem
 * @typedef {{ seek: boolean, next: boolean, prev: boolean, volume: boolean, shuffle: boolean, repeat: boolean,
 *   like: boolean, queue: boolean, lyrics: boolean }} Controls
 * @typedef {{ source: 'extension'|'media', app: string, playing: boolean, title: string, artist: string, album: string,
 *   art: string, videoId: string, url: string, position: number, duration: number, at: number, volume: number|null,
 *   muted: boolean|null, repeat: 'off'|'all'|'one'|null, like: 'like'|'dislike'|'none'|null, queue: QueueItem[],
 *   lyrics: string|null, controls: Controls, health: { ok: boolean, missing: string[] } }} MusicState
 */

/** Actions and the value each takes. */
const ACTIONS = {
  play: 'none', pause: 'none', toggle: 'none', next: 'none', prev: 'none', shuffle: 'none', repeat: 'none',
  like: 'none', dislike: 'none', lyrics: 'none', seek: 'ms', volume: 'percent', jump: 'index', open: 'url',
};
/** What works without the extension (Windows' media session). */
const MEDIA_ACTIONS = new Set(['play', 'pause', 'toggle', 'next', 'prev', 'seek']);
const YTM_URL = /^https:\/\/music\.youtube\.com\/[\w\-./?=&%#~+]*$/;
/** Covers come from Google's image servers (or YouTube's); anything else is dropped. */
const ART_URL = /^https:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|ytimg\.com|ggpht\.com)\/[^\s"'<>]*$/i;

const str = (/** @type {any} */ v, /** @type {number} */ max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '');
const num = (/** @type {any} */ v, /** @type {number} */ max) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0);
const DAY = 24 * 3600000;

/**
 * Validate one control request. Pure. @param {any} p
 * @returns {{ action: string, value?: number|string } | { error: string }}
 */
function cleanControl(p) {
  const action = String(p?.action || '');
  const kind = /** @type {Record<string, string>} */ (ACTIONS)[action];
  if (!kind || !Object.prototype.hasOwnProperty.call(ACTIONS, action)) return { error: `unknown action "${action.slice(0, 20)}"` };
  if (kind === 'none') return { action };
  if (kind === 'url') {
    const u = String(p?.value || '').trim();
    return YTM_URL.test(u) && u.length < 500 ? { action, value: u } : { error: 'only music.youtube.com links can be opened' };
  }
  const n = Number(p?.value);
  if (!Number.isFinite(n)) return { error: `${action} needs a number` };
  if (kind === 'percent') return { action, value: Math.round(Math.max(0, Math.min(100, n))) };
  if (kind === 'index') return { action, value: Math.max(0, Math.min(49, Math.floor(n))) };
  return { action, value: Math.round(Math.max(0, Math.min(DAY, n))) };
}

/**
 * Rebuild the extension's state from scratch. Pure. @param {any} s @param {number} now
 * @returns {MusicState | null}
 */
function cleanExtState(s, now) {
  if (!s || typeof s !== 'object') return null;
  const title = str(s.title, 300);
  if (!title) return null;
  const videoId = /^[\w-]{6,20}$/.test(String(s.videoId || '')) ? String(s.videoId) : '';
  const queue = (Array.isArray(s.queue) ? s.queue : []).slice(0, 50).map((/** @type {any} */ q, /** @type {number} */ i) => ({
    index: i, title: str(q?.title, 200), artist: str(q?.artist, 200), duration: num(q?.duration, DAY),
    art: ART_URL.test(String(q?.art || '')) ? String(q.art) : '', current: q?.current === true,
  })).filter((/** @type {QueueItem} */ q) => q.title);
  const repeat = ['off', 'all', 'one'].includes(s.repeat) ? s.repeat : null;
  const like = ['like', 'dislike', 'none'].includes(s.like) ? s.like : null;
  const missing = Array.isArray(s.health?.missing) ? s.health.missing.slice(0, 10).map((/** @type {any} */ m) => str(m, 40)).filter(Boolean) : [];
  return {
    source: 'extension', app: 'YouTube Music', playing: s.playing === true, title,
    artist: str(s.artist, 300), album: str(s.album, 300),
    art: ART_URL.test(String(s.art || '')) ? String(s.art) : '',
    videoId, url: videoId ? `https://music.youtube.com/watch?v=${videoId}` : '',
    position: num(s.position, DAY), duration: num(s.duration, DAY), at: now, // our clock, not the browser's
    volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.round(Math.max(0, Math.min(100, s.volume))) : null,
    muted: typeof s.muted === 'boolean' ? s.muted : null,
    repeat, like, queue,
    lyrics: typeof s.lyrics === 'string' && s.lyrics.trim() ? str(s.lyrics, 20000) : null,
    controls: { seek: true, next: true, prev: true, volume: true, shuffle: true, repeat: true, like: true, queue: true, lyrics: true },
    health: { ok: missing.length === 0, missing },
  };
}

/**
 * Windows media session reading → MusicState. Pure.
 * @param {import('../../platform/media-session').MediaNow} m @param {string} art a data: URL or ''
 * @returns {MusicState}
 */
function fromMedia(m, art) {
  return {
    source: 'media', app: m.app, playing: m.playing, title: m.title, artist: m.artist, album: m.album,
    art: art || '', videoId: '', url: '', position: m.position, duration: m.duration, at: m.at,
    volume: null, muted: null, repeat: null, like: null, queue: [], lyrics: null,
    controls: { seek: m.canSeek, next: m.canNext, prev: m.canPrev, volume: false, shuffle: false, repeat: false, like: false, queue: false, lyrics: false },
    health: { ok: true, missing: [] },
  };
}

/** Where the position should be now (a playing song moves on between updates). Pure. @param {MusicState} s @param {number} now */
function positionAt(s, now) {
  const p = s.playing ? s.position + Math.max(0, now - s.at) : s.position;
  return s.duration > 0 ? Math.min(s.duration, p) : p;
}

/**
 * Should listeners hear about `next`? Everything but the moving position counts; the position only when it jumped
 * (a seek) by more than 2.5 s from where it should be. Pure.
 * @param {MusicState | null} prev @param {MusicState | null} next
 */
function changed(prev, next) {
  if (!prev || !next) return prev !== next;
  const strip = (/** @type {MusicState} */ s) => JSON.stringify({ ...s, position: 0, at: 0 });
  if (strip(prev) !== strip(next)) return true;
  return Math.abs(positionAt(prev, next.at) - next.position) > 2500;
}

/** "3:05" from ms. @param {number} ms */
const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

module.exports = { ACTIONS, MEDIA_ACTIONS, cleanControl, cleanExtState, fromMedia, positionAt, changed, clock, YTM_URL, ART_URL };
