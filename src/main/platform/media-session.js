// @ts-check
// Windows media session reader (MUS-1, D-065/D-066): what plays right now in any player (YouTube Music in a browser,
// …) and play/pause/next/previous/seek, through Windows' GlobalSystemMediaTransportControls (the volume pop-up's
// source). The fallback when the Tama Companion extension isn't connected.
// Windows PowerShell can't read WinRT streams (cover art) and Add-Type can't reference WinRT metadata, so a tiny C#
// helper is compiled once with the .NET Framework's csc.exe against the WinRT metadata every Windows 10/11 has
// (System32\WinMetadata), cached by source hash in Tama's data folder, and kept running with a line protocol.
// Anything unexpected (other OS, no csc, timeout) means "nothing is playing" and the feature reports unavailable.
const { spawn: nodeSpawn, execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const HELPER_CS = String.raw`
using System; using System.Text; using System.Threading; using Windows.Foundation; using Windows.Media.Control; using Windows.Storage.Streams;
public static class TamaMedia {
  static T Wait<T>(IAsyncOperation<T> op) {
    int t = Environment.TickCount;
    while (op.Status == AsyncStatus.Started) { if (Environment.TickCount - t > 4000) throw new TimeoutException(); Thread.Sleep(2); }
    return op.GetResults();
  }
  static string J(string s) {
    if (s == null) return "null";
    var b = new StringBuilder("\"");
    foreach (char c in s) { if (c == '"' || c == '\\') b.Append('\\').Append(c); else if (c < 32) b.AppendFormat("\\u{0:x4}", (int)c); else b.Append(c); }
    return b.Append('"').ToString();
  }
  static GlobalSystemMediaTransportControlsSessionManager mgr;
  static GlobalSystemMediaTransportControlsSession Find(string app) {
    foreach (var s in mgr.GetSessions()) if (s.SourceAppUserModelId == app) return s;
    return null;
  }
  static string Now() {
    var cur = mgr.GetCurrentSession();
    var sb = new StringBuilder("{\"sessions\":[");
    bool first = true;
    foreach (var s in mgr.GetSessions()) {
      GlobalSystemMediaTransportControlsSessionMediaProperties p = null;
      try { p = Wait(s.TryGetMediaPropertiesAsync()); } catch { }
      var tl = s.GetTimelineProperties(); var pb = s.GetPlaybackInfo(); var c = pb.Controls;
      if (!first) sb.Append(','); first = false;
      sb.Append("{\"app\":").Append(J(s.SourceAppUserModelId))
        .Append(",\"title\":").Append(J(p == null ? null : p.Title)).Append(",\"artist\":").Append(J(p == null ? null : p.Artist))
        .Append(",\"album\":").Append(J(p == null ? null : p.AlbumTitle)).Append(",\"art\":").Append(p != null && p.Thumbnail != null ? "true" : "false")
        .Append(",\"status\":").Append((int)pb.PlaybackStatus)
        .Append(",\"pos\":").Append((long)tl.Position.TotalMilliseconds).Append(",\"end\":").Append((long)tl.EndTime.TotalMilliseconds)
        .Append(",\"upd\":").Append(tl.LastUpdatedTime.ToUnixTimeMilliseconds())
        .Append(",\"current\":").Append(cur != null && cur.SourceAppUserModelId == s.SourceAppUserModelId ? "true" : "false")
        .Append(",\"canSeek\":").Append(c.IsPlaybackPositionEnabled ? "true" : "false")
        .Append(",\"canNext\":").Append(c.IsNextEnabled ? "true" : "false").Append(",\"canPrev\":").Append(c.IsPreviousEnabled ? "true" : "false")
        .Append('}');
    }
    return sb.Append("]}").ToString();
  }
  static string Art(string app) {
    var s = Find(app); if (s == null) return "{\"art\":null}";
    var p = Wait(s.TryGetMediaPropertiesAsync()); if (p.Thumbnail == null) return "{\"art\":null}";
    var st = Wait(p.Thumbnail.OpenReadAsync());
    uint n = (uint)Math.Min(st.Size, 4000000UL);
    var r = new DataReader(st); Wait(r.LoadAsync(n)); var b = new byte[n]; r.ReadBytes(b);
    return "{\"art\":" + J("data:" + st.ContentType + ";base64," + Convert.ToBase64String(b)) + "}";
  }
  static string Cmd(string app, string what, string arg) {
    var s = Find(app); if (s == null) return "{\"ok\":false}";
    bool ok = false;
    if (what == "play") ok = Wait(s.TryPlayAsync());
    else if (what == "pause") ok = Wait(s.TryPauseAsync());
    else if (what == "toggle") ok = Wait(s.TryTogglePlayPauseAsync());
    else if (what == "next") ok = Wait(s.TrySkipNextAsync());
    else if (what == "prev") ok = Wait(s.TrySkipPreviousAsync());
    else if (what == "seek") ok = Wait(s.TryChangePlaybackPositionAsync(long.Parse(arg) * 10000L));
    return ok ? "{\"ok\":true}" : "{\"ok\":false}";
  }
  public static void Main() {
    Console.OutputEncoding = new UTF8Encoding(false);
    try { mgr = Wait(GlobalSystemMediaTransportControlsSessionManager.RequestAsync()); }
    catch (Exception e) { Console.WriteLine("{\"fatal\":" + J(e.Message) + "}"); return; }
    Console.WriteLine("{\"ready\":true}");
    string line;
    while ((line = Console.ReadLine()) != null) {
      var a = line.Split(' ');
      string res;
      try {
        if (a[0] == "now") res = Now();
        else if (a[0] == "art" && a.Length > 1) res = Art(Encoding.UTF8.GetString(Convert.FromBase64String(a[1])));
        else if (a[0] == "cmd" && a.Length > 2) res = Cmd(Encoding.UTF8.GetString(Convert.FromBase64String(a[1])), a[2], a.Length > 3 ? a[3] : "0");
        else if (a[0] == "quit") break;
        else res = "{\"error\":\"unknown\"}";
      } catch (Exception e) { res = "{\"error\":" + J(e.GetType().Name) + "}"; }
      Console.WriteLine(res);
    }
  }
}`;

/** Browser media sessions first: YouTube Music plays in a browser (MUS-1). */
const BROWSERS = /^(chrome|msedge|brave|vivaldi|opera|308046B0AF4A39CB|firefox)/i;

/**
 * @typedef {{ app: string, title: string|null, artist: string|null, album: string|null, art: boolean, status: number,
 *   pos: number, end: number, upd: number, current: boolean, canSeek: boolean, canNext: boolean, canPrev: boolean }} RawSession
 * @typedef {{ app: string, title: string, artist: string, album: string, hasArt: boolean, playing: boolean,
 *   position: number, duration: number, at: number, canSeek: boolean, canNext: boolean, canPrev: boolean }} MediaNow
 */

/**
 * Pick the session to show: playing beats paused, then browsers, then Windows' "current" one. Pure.
 * Status codes: 4 = playing, 5 = paused (GlobalSystemMediaTransportControlsSessionPlaybackStatus).
 * Positions are reported as of `upd` (the player's last update), so a playing position is advanced to `now`.
 * @param {RawSession[]} sessions @param {number} now
 * @returns {MediaNow | null}
 */
function pickSession(sessions, now) {
  const usable = (Array.isArray(sessions) ? sessions : []).filter((s) => s && typeof s.app === 'string' && s.title && (s.status === 4 || s.status === 5));
  if (!usable.length) return null;
  const score = (/** @type {RawSession} */ s) => (s.status === 4 ? 4 : 0) + (BROWSERS.test(s.app) ? 2 : 0) + (s.current ? 1 : 0);
  const s = usable.slice().sort((a, b) => score(b) - score(a))[0];
  const playing = s.status === 4;
  const duration = Math.max(0, Number(s.end) || 0);
  const since = playing && s.upd > 0 ? Math.max(0, now - s.upd) : 0;
  const position = Math.min(duration || Infinity, Math.max(0, (Number(s.pos) || 0) + since));
  return {
    app: s.app, title: String(s.title || '').slice(0, 300), artist: String(s.artist || '').slice(0, 300), album: String(s.album || '').slice(0, 300),
    hasArt: !!s.art, playing, position: Number.isFinite(position) ? position : 0, duration, at: now,
    canSeek: !!s.canSeek, canNext: !!s.canNext, canPrev: !!s.canPrev,
  };
}

const b64 = (/** @type {string} */ s) => Buffer.from(s, 'utf8').toString('base64');

/** Compile the helper once per source version. @param {string} dir @returns {string | null} the exe path */
function ensureHelper(dir) {
  const win = process.env.WINDIR || 'C:\\Windows';
  const hash = crypto.createHash('sha256').update(HELPER_CS).digest('hex').slice(0, 10);
  const exe = path.join(dir, `tama-media-${hash}.exe`);
  if (fs.existsSync(exe)) return exe;
  const fw = path.join(win, 'Microsoft.NET', 'Framework64', 'v4.0.30319');
  const csc = path.join(fw, 'csc.exe');
  const wm = path.join(win, 'System32', 'WinMetadata');
  if (!fs.existsSync(csc) || !fs.existsSync(wm)) return null;
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (/^tama-media-.*\.(exe|cs)$/.test(f)) fs.rmSync(path.join(dir, f), { force: true }); // older versions
  const src = path.join(dir, `tama-media-${hash}.cs`);
  fs.writeFileSync(src, HELPER_CS);
  try {
    execFileSync(csc, ['-nologo', '-optimize', `-out:${exe}`,
      `-r:${path.join(wm, 'Windows.Media.winmd')}`, `-r:${path.join(wm, 'Windows.Foundation.winmd')}`,
      `-r:${path.join(wm, 'Windows.Storage.winmd')}`, `-r:${path.join(fw, 'System.Runtime.dll')}`, src],
    { windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
  } finally { fs.rmSync(src, { force: true }); }
  return fs.existsSync(exe) ? exe : null;
}

/**
 * @param {{ dir: string, platform?: string, spawn?: typeof nodeSpawn, compile?: (dir: string) => string | null,
 *   timeoutMs?: number, now?: () => number, onError?: (msg: string) => void }} opts
 */
function createMediaSession(opts) {
  const { dir, platform = process.platform, spawn = nodeSpawn, compile = ensureHelper, timeoutMs = 6000, now = Date.now, onError = () => {} } = opts;
  /** @type {import('child_process').ChildProcessWithoutNullStreams | null} */ let proc = null;
  let ready = false; let buf = ''; let failures = 0; let stopped = false;
  /** @type {string | null | undefined} */ let exe;
  /** @type {Array<(v: any) => void>} */ let waiting = [];
  /** @type {Promise<any>} */ let chain = Promise.resolve();
  const MAX_FAILURES = 3;

  function kill() {
    const p = proc; proc = null; ready = false; buf = '';
    for (const w of waiting.splice(0)) w(null);
    if (p) { try { p.stdin.end('quit\n'); } catch { /* gone */ } try { p.kill(); } catch { /* gone */ } }
  }
  /** @param {string} why */
  function fail(why) { failures += 1; onError(`media session helper: ${why}${failures >= MAX_FAILURES ? ' (giving up)' : ''}`); kill(); }

  /** @returns {boolean} */
  function available() {
    if (platform !== 'win32' || stopped || failures >= MAX_FAILURES) return false;
    if (exe === undefined) {
      try { exe = compile(dir); } catch (e) { exe = null; onError(`media session helper: compile failed: ${String((/** @type {any} */ (e)).message || e).slice(0, 300)}`); }
    }
    return !!exe;
  }

  function ensure() {
    if (proc) return proc;
    const p = /** @type {any} */ (spawn(/** @type {string} */ (exe), [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }));
    proc = p;
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (/** @type {string} */ chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        /** @type {any} */ let msg = null;
        try { msg = JSON.parse(line); } catch { continue; }
        if (!ready) { if (msg && msg.ready) ready = true; else if (msg && msg.fatal) fail(String(msg.fatal)); continue; }
        const w = waiting.shift();
        if (w) w(msg);
      }
    });
    p.stderr.on('data', () => {});
    p.on('error', (/** @type {Error} */ e) => { if (proc === p) fail(`spawn failed: ${e.message}`); });
    p.on('exit', (/** @type {number} */ code) => { if (proc === p) fail(`exited (${code})`); });
    return p;
  }

  /** One request at a time (the helper answers in order). @param {string} line */
  function ask(line) {
    const run = async () => {
      if (!available()) return null;
      const p = ensure();
      const msg = await new Promise((resolve) => {
        const timer = setTimeout(() => { waiting = waiting.filter((w) => w !== done); resolve(undefined); }, timeoutMs);
        const done = (/** @type {any} */ v) => { clearTimeout(timer); resolve(v); };
        waiting.push(done);
        try { p.stdin.write(`${line}\n`); } catch { done(null); }
      });
      if (msg === undefined) { fail('no answer'); return null; }
      return msg;
    };
    const r = chain.then(run, run);
    chain = r.catch(() => null);
    return r;
  }

  return {
    available,
    /** What plays now (or null). @returns {Promise<MediaNow | null>} */
    async now() { const m = await ask('now'); return m && Array.isArray(m.sessions) ? pickSession(m.sessions, now()) : null; },
    /** Cover art as a data: URL. @param {string} app @returns {Promise<string | null>} */
    async art(app) { const m = await ask(`art ${b64(app)}`); return m && typeof m.art === 'string' && m.art.startsWith('data:image/') ? m.art : null; },
    /**
     * @param {string} app @param {'play'|'pause'|'toggle'|'next'|'prev'|'seek'} what @param {number} [ms]
     * @returns {Promise<boolean>}
     */
    async control(app, what, ms = 0) {
      if (!['play', 'pause', 'toggle', 'next', 'prev', 'seek'].includes(what)) return false;
      const m = await ask(`cmd ${b64(app)} ${what} ${Math.max(0, Math.round(ms)) || 0}`);
      return !!(m && m.ok);
    },
    stop() { stopped = true; kill(); },
  };
}

module.exports = { createMediaSession, pickSession, ensureHelper, HELPER_CS };
