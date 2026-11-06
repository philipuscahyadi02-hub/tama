// @ts-check
// Fullscreen detection for do-not-disturb (PET-6, D-035). Windows only: one long-lived hidden PowerShell process
// (spawned on the first query) compiles a tiny user32 helper once and answers one line per query over stdin/stdout.
// Anything unexpected (other OS, spawn failure, timeout, odd output) means "not fullscreen".
const { spawn: nodeSpawn } = require('child_process');

const HELPER_CS = `
using System; using System.Runtime.InteropServices; using System.Text;
public static class TamaFullscreen {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public int dwFlags; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr GetDesktopWindow();
  [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int index);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
  public static string Query() {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return "none";
    int shell = (h == GetDesktopWindow() || h == GetShellWindow()) ? 1 : 0;
    StringBuilder cls = new StringBuilder(256); GetClassName(h, cls, 256);
    RECT w; if (!GetWindowRect(h, out w)) return "none";
    MONITORINFO mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return "none";
    uint pid; GetWindowThreadProcessId(h, out pid);
    int caption = (GetWindowLong(h, -16) & 0x00C00000) == 0x00C00000 ? 1 : 0;
    RECT m = mi.rcMonitor;
    return String.Format("ok|{0}|{1}|{2}|{3}|{4}|{5},{6},{7},{8}|{9},{10},{11},{12}",
      cls.ToString().Replace("|", ""), shell, pid, caption, IsZoomed(h) ? 1 : 0, w.L, w.T, w.R, w.B, m.L, m.T, m.R, m.B);
  }
}`;

// The loop reads one line per query; EOF or "quit" ends the process.
const SCRIPT = `$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
${HELPER_CS}
'@
[Console]::Out.WriteLine('ready'); [Console]::Out.Flush()
while ($true) {
  $l = [Console]::In.ReadLine()
  if ($l -eq $null -or $l -eq 'quit') { break }
  try { $r = [TamaFullscreen]::Query() } catch { $r = 'err' }
  [Console]::Out.WriteLine($r); [Console]::Out.Flush()
}`;

/** Desktop, taskbar and shell surfaces fill the screen too, but they are not "a fullscreen app". */
const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow']);

/**
 * Decide from one helper line whether the foreground window is a fullscreen app. Pure.
 * Line: ok|class|isShell|pid|hasCaption|isMaximized|l,t,r,b (window)|l,t,r,b (monitor)
 * A maximized window with a title bar is just a big window (also with an auto-hide taskbar), not fullscreen.
 * @param {string} line @param {number} [selfPid]  our own windows never count
 * @returns {boolean}
 */
function isFullscreenLine(line, selfPid = -1) {
  const p = String(line || '').trim().split('|');
  if (p.length !== 8 || p[0] !== 'ok') return false;
  const [, cls, shell, pid, caption, zoomed, wRect, mRect] = p;
  if (shell === '1' || SHELL_CLASSES.has(cls) || Number(pid) === selfPid) return false;
  if (caption === '1' && zoomed === '1') return false;
  const w = wRect.split(',').map(Number);
  const m = mRect.split(',').map(Number);
  if (w.length !== 4 || m.length !== 4 || [...w, ...m].some((n) => !Number.isFinite(n))) return false;
  if (m[2] - m[0] <= 0 || m[3] - m[1] <= 0) return false;
  return w[0] <= m[0] && w[1] <= m[1] && w[2] >= m[2] && w[3] >= m[3];
}

/** PowerShell -EncodedCommand takes base64 of UTF-16LE, so no quoting problems. @param {string} s */
const encode = (s) => Buffer.from(s, 'utf16le').toString('base64');

/**
 * @param {{ platform?: string, spawn?: typeof nodeSpawn, timeoutMs?: number, firstTimeoutMs?: number,
 *   selfPid?: number, onError?: (msg: string) => void }} [opts]
 */
function createFullscreenDetector(opts = {}) {
  const {
    platform = process.platform, spawn = nodeSpawn, timeoutMs = 3000, firstTimeoutMs = 15000,
    selfPid = process.pid, onError = () => {},
  } = opts;
  /** @type {import('child_process').ChildProcessWithoutNullStreams | null} */
  let proc = null;
  let ready = false;
  let buf = '';
  let failures = 0;
  let stopped = false;
  /** @type {Array<(line: string) => void>} */
  let waiting = [];
  /** @type {Promise<boolean> | null} */
  let pending = null;

  const MAX_FAILURES = 3; // then give up for this run: DND by fullscreen is a nicety, not worth a respawn loop

  function kill() {
    const p = proc;
    proc = null; ready = false; buf = '';
    for (const w of waiting.splice(0)) w('');
    if (p) { try { p.stdin.end('quit\n'); } catch { /* already gone */ } try { p.kill(); } catch { /* already gone */ } }
  }

  /** @param {string} why */
  function fail(why) {
    failures += 1;
    onError(`fullscreen helper: ${why}${failures >= MAX_FAILURES ? ' (giving up)' : ''}`);
    kill();
  }

  function ensure() {
    if (proc) return proc;
    /** @type {import('child_process').ChildProcessWithoutNullStreams} */
    let p;
    try {
      p = /** @type {any} */ (spawn('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encode(SCRIPT)],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }));
    } catch (e) {
      fail(`spawn failed: ${(/** @type {any} */ (e)).message}`);
      throw e;
    }
    proc = p;
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (/** @type {string} */ chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!ready) { if (line === 'ready') ready = true; continue; }
        const w = waiting.shift();
        if (w) w(line);
      }
    });
    p.stderr.on('data', () => { /* compile warnings etc.; a broken helper shows up as a timeout */ });
    p.on('error', (e) => { if (proc === p) fail(`spawn failed: ${e.message}`); });
    p.on('exit', (code) => { if (proc === p) fail(`exited (${code})`); });
    return p;
  }

  async function ask() {
    const first = !proc;
    const p = ensure();
    const line = await new Promise((/** @type {(l: string) => void} */ resolve) => {
      const timer = setTimeout(() => { waiting = waiting.filter((w) => w !== done); resolve('\u0000timeout'); }, first ? firstTimeoutMs : timeoutMs);
      const done = (/** @type {string} */ l) => { clearTimeout(timer); resolve(l); };
      waiting.push(done);
      try { p.stdin.write('q\n'); } catch (e) { done(''); }
    });
    if (line === '\u0000timeout') { fail('no answer'); return false; }
    return isFullscreenLine(line, selfPid);
  }

  /** Is the foreground window fullscreen right now? Never throws; concurrent callers share one query. */
  function isFullscreen() {
    if (platform !== 'win32' || stopped || failures >= MAX_FAILURES) return Promise.resolve(false);
    if (!pending) pending = ask().catch(() => false).finally(() => { pending = null; });
    return pending;
  }

  function stop() { stopped = true; kill(); }

  return { isFullscreen, stop };
}

module.exports = { createFullscreenDetector, isFullscreenLine, SCRIPT };
