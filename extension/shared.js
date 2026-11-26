// Tama Companion: pure helpers shared by the content script and the tests (no DOM, no chrome.*).
(function (root) {
  /** "Artist • Album • 2021" (or "Artist • 1.2M views • …" for videos) → { artist, album }. */
  function parseByline(text) {
    const parts = String(text || '').split(/\s+[•·]\s+/).map((s) => s.trim()).filter(Boolean);
    const isMeta = (s) => /^\d{4}$/.test(s) || /\b(views?|likes?|plays?)\b/i.test(s);
    const artist = parts[0] || '';
    const album = parts.slice(1).find((s) => !isMeta(s)) || '';
    return { artist, album };
  }

  /** The repeat button's label → 'off' | 'all' | 'one' | null. */
  function parseRepeat(label) {
    const s = String(label || '').toLowerCase();
    if (!s) return null;
    if (/one|1/.test(s)) return 'one';
    if (/all/.test(s)) return 'all';
    if (/off/.test(s)) return 'off';
    return null;
  }

  /** like-status attribute → 'like' | 'dislike' | 'none' | null. */
  function parseLike(status) {
    const s = String(status || '').toUpperCase();
    return s === 'LIKE' ? 'like' : s === 'DISLIKE' ? 'dislike' : s === 'INDIFFERENT' ? 'none' : null;
  }

  /** Ask Google's image server for a bigger cover (…=w60-h60-l90-rj → …=w544-h544-l90-rj). Only https URLs survive. */
  function bigArt(url) {
    const u = String(url || '');
    if (!/^https:\/\//.test(u)) return '';
    return u.replace(/=w\d+-h\d+/, '=w544-h544').replace(/\/(default|mqdefault|hqdefault)\.jpg/, '/hqdefault.jpg');
  }

  /** "3:25" / "1:02:03" → milliseconds (0 when unknown). */
  function parseDuration(text) {
    const p = String(text || '').trim().split(':').map(Number);
    if (!p.length || p.some((n) => !Number.isFinite(n))) return 0;
    return p.reduce((acc, n) => acc * 60 + n, 0) * 1000;
  }

  /**
   * Is `next` worth sending to Tama after `prev`? Position alone only counts when it jumped (a seek): Tama
   * advances the position itself between updates. Pure.
   */
  function significant(prev, next, now) {
    if (!prev || !next) return prev !== next;
    const keys = ['videoId', 'title', 'artist', 'album', 'art', 'playing', 'duration', 'volume', 'muted', 'repeat', 'like', 'lyrics', 'queueKey', 'healthKey'];
    for (const k of keys) if (prev[k] !== next[k]) return true;
    const expected = prev.playing ? prev.position + (now - prev.at) : prev.position;
    return Math.abs(expected - next.position) > 2500;
  }

  const api = { parseByline, parseRepeat, parseLike, bigArt, parseDuration, significant };
  root.TamaYtm = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
