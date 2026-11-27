// @ts-check
// Music service (MUS-1, MUS-10; D-065, D-066): one "now playing" state for Tama, from the Tama Companion browser
// extension (YouTube Music: queue, likes, lyrics, full control) or, without it, from Windows' media session (song,
// cover, play/pause/next/previous/seek). Pairing with the extension works like Telegram's (D-036): a one-time code,
// then a per-pairing key kept in secrets, accepted only from the extension origin that paired.
const crypto = require('crypto');
const { TOPICS } = require('../../bus-topics');
const L = require('./logic');
const { createLibrary } = require('./library');
const { createMusicTools, musicRule } = require('./tools');

const PORTS = [47821, 47822, 47823, 47824, 47825]; // the extension tries the same list
const CODE_TTL_MS = 10 * 60000;
const MAX_TRIES = 5;
const HELLO_MS = 5000;
const CMD_MS = 6000;
const POLL_MS = 2000;
const POLL_IDLE_MS = 8000;
const SECRET = 'music.extension';
const ASK_MS = 60000; // how long a one-click pairing request waits for the user's Allow
const EXT_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

/**
 * @typedef {import('./logic').MusicState} MusicState
 * @typedef {import('../../platform/ws-server').WsConnection} WsConnection
 * @typedef {{ available: () => boolean, now: () => Promise<import('../../platform/media-session').MediaNow | null>,
 *   art: (app: string) => Promise<string | null>, control: (app: string, what: any, ms?: number) => Promise<boolean>, stop: () => void }} MediaSession
 */

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   secrets: { get: (k: string) => string | null, set: (k: string, v: string) => void, delete: (k: string) => void },
 *   media: MediaSession,
 *   startWs: (opts: { ports: number[], verifyOrigin: (o: string) => boolean, onConnection: (c: WsConnection) => void, onError?: (m: string) => void }) => Promise<{ port: number, close: () => void }>,
 *   openExternal?: (url: string) => unknown,
 *   extensionDir?: string,
 *   now?: () => number,
 *   log?: (...a: any[]) => void,
 * }} deps
 */
function createMusic({ bus, secrets, media, startWs, openExternal = () => null, extensionDir = '', now = Date.now, log = () => {} }) {
  /** @type {WsConnection | null} */ let ext = null;
  /** @type {MusicState | null} */ let extState = null;
  let extTabs = 0;
  /** @type {MusicState | null} */ let mediaState = null;
  /** @type {{ title: string, app: string, art: string } | null} */ let mediaArt = null;
  /** @type {MusicState | null} */ let lastEmitted = null;
  /** @type {{ code: string, until: number, tries: number } | null} */ let pairing = null;
  /** @type {Map<string, (r: any) => void>} */ const waiting = new Map();
  let port = 0;
  let lastPlayingAt = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */ let pollTimer = null;
  let stopped = false;

  /** @returns {{ key: string, origin: string } | null} */
  function paired() {
    try { const p = JSON.parse(secrets.get(SECRET) || 'null'); return p && typeof p.key === 'string' && typeof p.origin === 'string' ? p : null; } catch { return null; }
  }
  const err = (/** @type {string} */ topic, /** @type {any} */ e) => bus.emit(TOPICS.APP_ERROR, { topic, message: String(e?.message || e) });

  /** The state Tama shows: the extension's when it has a song, else Windows' media session. */
  function current() { return (ext && extState) || mediaState || null; }

  function emitIfChanged() {
    const s = current();
    if (!L.changed(lastEmitted, s)) return;
    lastEmitted = s;
    if (s && s.playing) lastPlayingAt = now();
    log(s ? `[music] ${s.source}: ${s.playing ? '▶' : '⏸'} ${s.title} · ${s.artist} · queue ${s.queue.length} · lyrics ${s.lyrics ? 'yes' : 'no'}${s.health.ok ? '' : ` · missing ${s.health.missing.join(',')}`}` : '[music] nothing playing');
    bus.emit(TOPICS.MUSIC_CHANGED, { state: s });
  }

  function status() {
    const s = current();
    const p = pairing && pairing.until > now() ? { code: pairing.code, until: pairing.until } : null;
    return {
      state: s ? { ...s, position: L.positionAt(s, now()), at: now() } : null,
      extension: { paired: !!paired(), connected: !!ext, tabs: ext ? extTabs : 0, port, dir: extensionDir },
      media: { available: media.available() },
      pairing: p,
    };
  }

  // ---- the extension link ----
  /** @param {WsConnection} c */
  function onConnection(c) {
    let authed = false;
    const helloTimer = setTimeout(() => { if (!authed) c.close(1008); }, HELLO_MS);
    c.onMessage((m) => {
      if (!authed) {
        if (!m || m.t !== 'hello') { c.close(1008); return; }
        clearTimeout(helloTimer);
        const promote = () => {
          authed = true;
          if (ext && ext !== c) ext.close(1000); // one browser at a time: the newest wins
          ext = c; extState = null; extTabs = 0;
          log('[music] extension connected');
          emitIfChanged();
        };
        const r = m.ask === true && !m.key && !m.code ? ask(c, promote) : hello(c, m);
        log(`[music] hello from the extension (${m.key ? 'key' : m.code ? 'code' : m.ask ? 'asks to connect' : 'nothing'}) → ${r.t}`);
        c.send(r);
        if (r.t === 'welcome' || r.t === 'paired') promote();
        else if (r.t !== 'waiting') c.close(1000);
        return;
      }
      if (m.t === 'state') {
        extTabs = Math.max(0, Math.min(99, Number(m.tabs) || 0));
        extState = L.cleanExtState(m.state, now());
        if (!extState) log(`[music] extension: ${extTabs} YouTube Music tab(s), no song${m.state ? ' (could not read the page)' : ''}`);
        emitIfChanged();
        schedulePoll(0);
      } else if (m.t === 'result') {
        const f = waiting.get(String(m.id || ''));
        if (f) { waiting.delete(String(m.id)); f({ ok: m.ok === true, error: m.ok ? undefined : String(m.error || 'failed').slice(0, 200), lyrics: typeof m.lyrics === 'string' ? m.lyrics.slice(0, 20000) : m.lyrics === null ? null : undefined }); }
      } else if (m.t === 'ping') c.send({ t: 'pong' });
      else if (m.t === 'bye') { secrets.delete(SECRET); c.close(1000); }
    });
    c.onClose(() => {
      clearTimeout(helloTimer);
      if (asking && asking.conn === c) endAsk(false, true);
      if (ext !== c) return;
      ext = null; extState = null; extTabs = 0;
      for (const f of waiting.values()) f({ ok: false, error: 'the browser extension disconnected' });
      waiting.clear();
      log('[music] extension disconnected');
      emitIfChanged();
      schedulePoll(0);
    });
  }

  // ---- one-click pairing (D-070): the extension asks, the user allows it on their desktop ----
  /** @type {{ conn: WsConnection, promote: () => void, timer: ReturnType<typeof setTimeout> } | null} */ let asking = null;
  let lastAskAt = 0;

  /** @param {WsConnection} c @param {() => void} promote @returns {{ t: string, reason?: string, until?: number }} */
  function ask(c, promote) {
    if (asking) return { t: 'denied', reason: 'Another connection request is already waiting on Tama.' };
    if (now() - lastAskAt < 5000) return { t: 'denied', reason: 'Please wait a moment and try again.' };
    lastAskAt = now();
    const until = now() + ASK_MS;
    asking = { conn: c, promote, timer: setTimeout(() => endAsk(false), ASK_MS) };
    bus.emit(TOPICS.MUSIC_PAIR_ASK, { until });
    return { t: 'waiting', until };
  }

  /** @param {boolean} allow @param {boolean} [gone] the extension hung up first */
  function endAsk(allow, gone = false) {
    const a = asking;
    if (!a) return { ok: false, error: 'No connection request is waiting.' };
    asking = null;
    clearTimeout(a.timer);
    bus.emit(TOPICS.MUSIC_PAIR_ASK, { until: 0 }); // tells the pet to drop the question
    if (gone) return { ok: false, error: 'The browser stopped waiting.' };
    if (!allow) { a.conn.send({ t: 'denied', reason: 'Not allowed on Tama.' }); a.conn.close(1000); return { ok: true, allowed: false }; }
    const key = crypto.randomBytes(32).toString('hex');
    secrets.set(SECRET, JSON.stringify({ key, origin: a.conn.origin, at: now() }));
    a.conn.send({ t: 'paired', key });
    a.promote();
    return { ok: true, allowed: true };
  }

  /** @param {WsConnection} c @param {any} m @returns {{ t: string, key?: string, reason?: string }} */
  function hello(c, m) {
    const p = paired();
    if (typeof m.key === 'string' && m.key) {
      const ok = p && p.origin === c.origin && m.key.length === p.key.length && crypto.timingSafeEqual(Buffer.from(m.key), Buffer.from(p.key));
      return ok ? { t: 'welcome' } : { t: 'denied', reason: 'This browser is not paired with Tama any more.' };
    }
    if (typeof m.code === 'string' && m.code) {
      if (!pairing || pairing.until <= now()) return { t: 'denied', reason: 'No pairing code is active. Type /music pair in Tama for a new one.' };
      if (m.code.toUpperCase() !== pairing.code) {
        pairing.tries += 1;
        if (pairing.tries >= MAX_TRIES) pairing = null;
        return { t: 'denied', reason: pairing ? 'That code did not work.' : 'Too many wrong codes. Get a new one with /music pair.' };
      }
      const key = crypto.randomBytes(32).toString('hex');
      secrets.set(SECRET, JSON.stringify({ key, origin: c.origin, at: now() }));
      pairing = null;
      return { t: 'paired', key };
    }
    return { t: 'need-code' };
  }

  /** @param {string} action @param {any} value @returns {Promise<{ ok: boolean, error?: string, lyrics?: string|null }>} */
  function toExtension(action, value) {
    const c = ext;
    if (!c) return Promise.resolve({ ok: false, error: 'not connected' });
    const id = crypto.randomBytes(6).toString('hex');
    return new Promise((resolve) => {
      const timer = setTimeout(() => { waiting.delete(id); resolve({ ok: false, error: 'YouTube Music did not answer' }); }, CMD_MS);
      waiting.set(id, (r) => { clearTimeout(timer); resolve(r); });
      c.send({ t: 'cmd', id, action, value });
    });
  }

  // ---- controls ----
  /** @param {any} p */
  async function control(p) {
    const c = L.cleanControl(p);
    if ('error' in c) return { ok: false, error: c.error };
    const { action, value } = c;
    if (ext && (extState || (action === 'open' && extTabs > 0))) return toExtension(action, value);
    if (action === 'open') {
      if (ext && extTabs === 0) { ext.send({ t: 'open-new', url: value }); return { ok: true, opened: 'browser' }; }
      try { await openExternal(String(value)); } catch (e) { err('music.open', e); return { ok: false, error: 'Could not open the browser.' }; }
      return { ok: true, opened: 'browser' };
    }
    const m = mediaState;
    if (!m) return { ok: false, error: 'Nothing is playing.' };
    if (!L.MEDIA_ACTIONS.has(action)) return { ok: false, error: `"${action}" needs the Tama Companion browser extension (/music).` };
    const ok = await media.control(m.app, /** @type {any} */ (action), Number(value) || 0);
    setTimeout(() => poll().catch(() => null), 400);
    return ok ? { ok: true } : { ok: false, error: 'The player did not accept that.' };
  }

  // ---- Windows media session (fallback) ----
  async function poll() {
    if (stopped) return;
    if (ext && extState) { mediaState = null; return; } // the extension knows more
    const m = await media.now();
    if (!m) { mediaState = null; emitIfChanged(); return; }
    if (!mediaArt || mediaArt.title !== m.title || mediaArt.app !== m.app) {
      mediaArt = { title: m.title, app: m.app, art: (m.hasArt && (await media.art(m.app))) || '' };
    }
    mediaState = L.fromMedia(m, mediaArt.art);
    emitIfChanged();
  }

  /** @param {number} [delay] */
  function schedulePoll(delay) {
    if (stopped) return;
    if (pollTimer) clearTimeout(pollTimer);
    const idle = now() - lastPlayingAt > 30000;
    pollTimer = setTimeout(async () => {
      pollTimer = null;
      try { await poll(); } catch (e) { err('music.poll', e); }
      schedulePoll();
    }, delay ?? (ext && extState ? POLL_IDLE_MS * 2 : idle ? POLL_IDLE_MS : POLL_MS));
  }

  function newCode() {
    pairing = { code: crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6), until: now() + CODE_TTL_MS, tries: 0 };
    return { code: pairing.code, until: pairing.until, port, dir: extensionDir };
  }

  const lib = createLibrary({ bus, control });

  function start() {
    /** @type {{ close: () => void } | null} */ let server = null;
    startWs({ ports: PORTS, verifyOrigin: (o) => { const ok = EXT_ORIGIN.test(o); if (!ok) log(`[music] refused a connection from ${o.slice(0, 60) || 'no origin'}`); return ok; }, onConnection, onError: (m) => err('music.ws', m) })
      .then((s) => { if (stopped) s.close(); else { server = s; port = s.port; log(`[music] listening on 127.0.0.1:${s.port}`); } })
      .catch((e) => err('music.ws', e));
    schedulePoll(1500);
    const offs = [
      bus.handle(TOPICS.MUSIC_GET, () => status()),
      bus.handle(TOPICS.MUSIC_CONTROL, (/** @type {any} */ p) => control(p || {})),
      bus.handle(TOPICS.MUSIC_PAIR, () => newCode()),
      bus.handle(TOPICS.MUSIC_LIBRARY, (/** @type {any} */ p) => lib.library(p || {})),
      bus.handle(TOPICS.MUSIC_PLAY, (/** @type {any} */ p) => lib.play(p || {})),
      bus.handle(TOPICS.MUSIC_PAIR_ANSWER, (/** @type {any} */ p) => endAsk(!!(p && p.allow === true))),
      bus.handle(TOPICS.MUSIC_UNPAIR, () => {
        secrets.delete(SECRET);
        if (ext) { ext.send({ t: 'unpaired' }); ext.close(1000); }
        return { ok: true };
      }),
    ];
    return () => {
      stopped = true;
      for (const off of offs) off();
      if (pollTimer) clearTimeout(pollTimer);
      if (server) server.close();
      media.stop();
    };
  }

  return { start, status, control, poll };
}

module.exports = { createMusic, createMusicTools, musicRule, PORTS };
