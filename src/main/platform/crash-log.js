// @ts-check
// Crash safety (SET-6, D-050): a small daily log of errors and crashes, and a "running" marker that tells the next
// start whether the last run ended without a clean quit. Plain fs, no Electron, so it is unit-tested directly.
// Logs hold error messages and stack lines only, with secrets redacted; never chat text, emails or files.
const fs = require('fs');
const path = require('path');

const KEEP_DAYS = 7;
const MAX_LINE = 2000;
const MAX_FILE = 2 * 1024 * 1024;

/** Remove things that look like secrets from a log line. Pure. @param {string} s */
function redact(s) {
  return String(s)
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, '<telegram-token>')
    .replace(/(Bearer|token|key|secret|password|access_token|refresh_token)(["'=:\s]+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1$2<redacted>')
    .replace(/ya29\.[A-Za-z0-9._-]+/g, '<google-token>')
    .replace(/GOCSPX-[A-Za-z0-9_-]+/g, '<google-secret>')
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, '<anthropic-key>');
}

/**
 * @param {{ dir: string, now?: () => number }} o  dir = <data>/logs
 */
function createCrashLog({ dir, now = Date.now }) {
  const marker = path.join(dir, 'running.json');
  const day = () => new Date(now()).toISOString().slice(0, 10);
  const file = () => path.join(dir, `tama-${day()}.log`);

  /** @param {'info'|'warn'|'error'|'crash'} level @param {string} tag @param {unknown} msg */
  function write(level, tag, msg) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const f = file();
      if (fs.existsSync(f) && fs.statSync(f).size > MAX_FILE) return; // a runaway error loop must not fill the disk
      const text = msg instanceof Error ? `${msg.message}\n${(msg.stack || '').split('\n').slice(1, 6).join('\n')}` : String(msg);
      fs.appendFileSync(f, `${new Date(now()).toISOString()} ${level.toUpperCase()} [${tag}] ${redact(text).slice(0, MAX_LINE)}\n`);
    } catch { /* logging must never crash the app */ }
  }

  /** Delete logs older than KEEP_DAYS. */
  function prune() {
    try {
      const cutoff = now() - KEEP_DAYS * 86400000;
      for (const f of fs.readdirSync(dir)) {
        const m = /^tama-(\d{4}-\d{2}-\d{2})\.log$/.exec(f);
        if (m && Date.parse(m[1]) < cutoff) fs.rmSync(path.join(dir, f), { force: true });
      }
    } catch { /* no folder yet */ }
  }

  /**
   * Call once at start: returns what the last run left behind (null = it quit cleanly or this is the first run),
   * then marks this run as running. @param {{ version?: string }} [info]
   * @returns {{ startedAt: number, version?: string } | null}
   */
  function begin(info = {}) {
    let last = /** @type {any} */ (null);
    try { last = JSON.parse(fs.readFileSync(marker, 'utf8')); } catch { last = null; }
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(marker, JSON.stringify({ startedAt: now(), pid: process.pid, version: info.version || '' }));
    } catch { /* read-only disk: no crash detection this run */ }
    prune();
    if (last) write('crash', 'app', `the last run (started ${new Date(last.startedAt || 0).toISOString()}) did not quit cleanly`);
    return last;
  }

  /** Call on a clean quit. */
  function end() { try { fs.rmSync(marker, { force: true }); } catch { /* fine */ } }

  return { write, begin, end, prune, dir: () => dir };
}

module.exports = { createCrashLog, redact };
