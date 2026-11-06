// @ts-check
// Runs the AivisSpeech Engine (headless run.exe) only while the Japanese dub is on (D-044). Tama only stops an
// engine it started itself; an engine the user runs (AivisSpeech app, their own run.exe) is used and left alone.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/** Where the engine is usually installed (the Tama-installed headless engine first, then the AivisSpeech app). */
function defaultPaths() {
  const local = process.env.LOCALAPPDATA || '';
  return [
    path.join(local, 'Programs', 'AivisSpeech-Engine', 'Windows-x64', 'run.exe'),
    path.join(local, 'Programs', 'AivisSpeech', 'AivisSpeech-Engine', 'run.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'AivisSpeech', 'AivisSpeech-Engine', 'run.exe'),
  ];
}

/** Is `pid` a running AivisSpeech run.exe? (Windows) @param {number} pid */
function isEngine(pid) {
  try {
    const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { windowsHide: true, encoding: 'utf8', timeout: 5000 });
    return /^"run\.exe"/i.test(out.trim());
  } catch { return false; }
}

/** @param {number} pid */
function killTree(pid) {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(pid); } catch { /* gone */ } }
}

/**
 * @param {{ exePath?: () => string | null | undefined, gpu?: () => boolean, onExit?: (code: number | null) => void, pidFile?: string }} [o]
 *   pidFile: remembers the engine Tama started, so one left behind by a crash is stopped on the next start.
 */
function createVoiceEngineProcess({ exePath = () => null, gpu = () => true, onExit = () => {}, pidFile } = {}) {
  /** @type {import('child_process').ChildProcess | null} */ let child = null;

  /** Stop an engine a previous (crashed or killed) Tama run started and never stopped. */
  function cleanupStale() {
    if (!pidFile || !fs.existsSync(pidFile)) return false;
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    fs.rmSync(pidFile, { force: true });
    if (!Number.isInteger(pid) || pid <= 0 || process.platform !== 'win32' || !isEngine(pid)) return false;
    killTree(pid);
    return true;
  }

  function find() {
    const custom = exePath();
    for (const p of [custom, ...defaultPaths()]) if (p && fs.existsSync(p)) return p;
    return null;
  }

  /** Start it hidden. @returns {{ ok: boolean, reason?: string, path?: string }} */
  function start() {
    if (child) return { ok: true, path: find() || undefined };
    const exe = find();
    if (!exe) return { ok: false, reason: 'not installed' };
    const args = ['--host', '127.0.0.1', '--port', '10101', '--output_log_utf8'];
    if (gpu()) args.push('--use_gpu');
    child = spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true, stdio: 'ignore', env: { ...process.env, PYTHONUTF8: '1' } });
    const me = child;
    if (pidFile && me.pid) fs.writeFileSync(pidFile, String(me.pid));
    me.on('exit', (code) => { if (child === me) { child = null; if (pidFile) fs.rmSync(pidFile, { force: true }); } onExit(code); });
    me.on('error', () => { if (child === me) child = null; });
    return { ok: true, path: exe };
  }

  function stop() {
    if (!child) return;
    const c = child;
    child = null;
    if (pidFile) fs.rmSync(pidFile, { force: true });
    // run.exe is a PyInstaller launcher with a child process: end the whole tree.
    if (c.pid) killTree(c.pid);
  }

  return { start, stop, find, cleanupStale, owned: () => !!child };
}

module.exports = { createVoiceEngineProcess, defaultPaths };
