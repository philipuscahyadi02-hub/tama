// @ts-check
// What is left of the Antigravity allowance (D-088): `agy -p /usage` prints one line per limit, e.g.
//   "Gemini Models<TAB>Weekly Limit Remaining<TAB>0%<TAB>2026-12-03T16:22:27Z". It is answered by agy itself (no model
// turn, no quota). It runs in Tama's own empty folder with the deny-all workspace guard and in plan mode, so even if a
// future agy sent the text to a model, that model could not touch anything (D-037).
const fs = require('fs');
const { execFile } = require('child_process');
const { ensureWorkspaceGuard, DENY_ALL } = require('./setup');

/** @typedef {{ used: number, resetsAt: number | null, label: string, bucket: string }} AgyWindow */

const slug = (/** @type {string} */ s) => s.toLowerCase().replace(/\b(models?|and|limit|remaining)\b/g, ' ').trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Pure: `agy -p /usage` output → windows keyed like "gemini.weekly" / "claude_gpt.five_hour". Lines that don't look like
 * "<bucket> TAB <window> TAB <n>% TAB <time>" are skipped.
 * @param {string} text @returns {Record<string, AgyWindow>}
 */
function parseAgyUsage(text) {
  /** @type {Record<string, AgyWindow>} */
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const cols = line.split('\t').map((c) => c.trim());
    if (cols.length < 3) continue;
    const m = /^(\d{1,3}(?:\.\d+)?)%$/.exec(cols[2]);
    if (!m || !cols[0] || !cols[1]) continue;
    const bucket = slug(cols[0]);
    const win = slug(cols[1]);
    if (!bucket || !win) continue;
    const left = Math.max(0, Math.min(100, Number(m[1]))) / 100;
    const t = cols[3] ? Date.parse(cols[3]) : NaN;
    const name = cols[0].replace(/\s*models?\s*$/i, '');
    out[`${bucket}.${win}`] = { used: 1 - left, resetsAt: Number.isFinite(t) ? t : null, label: `${name} · ${cols[1].replace(/\s*limit remaining\s*$/i, '').toLowerCase()}`, bucket };
  }
  return out;
}

/** Pure: which usage bucket a model id draws from ('gemini', 'claude_gpt', …), '' if none matches. @param {string} model @param {Record<string, AgyWindow>} windows */
function bucketOf(model, windows) {
  const m = String(model || '').toLowerCase();
  const family = m.startsWith('gemini') ? 'gemini' : m.startsWith('claude') ? 'claude' : m.startsWith('gpt') ? 'gpt' : '';
  if (!family) return '';
  const b = Object.values(windows || {}).map((w) => w.bucket).find((x) => x.split('_').includes(family));
  return b || '';
}

/** Pure: is this bucket used up right now (some window at 0 % that hasn't reset yet)? @param {string} bucket @param {Record<string, AgyWindow>} windows @param {number} now */
function bucketEmpty(bucket, windows, now) {
  if (!bucket) return false;
  return Object.values(windows || {}).some((w) => w.bucket === bucket && w.used >= 0.995 && (!w.resetsAt || w.resetsAt > now));
}

/** When the bucket is back: the latest reset among its used-up windows. @param {string} bucket @param {Record<string, AgyWindow>} windows */
function bucketBack(bucket, windows) {
  const ts = Object.values(windows || {}).filter((w) => w.bucket === bucket && w.used >= 0.995 && w.resetsAt).map((w) => Number(w.resetsAt));
  return ts.length ? Math.max(...ts) : null;
}

/** Fallback order when a bucket is used up: Gemini empty → Sonnet, other Claude, GPT, Opus last (slow, heavy);
 *  Claude/GPT empty → Gemini Flash. Ids come from the account's model list when known. */
const FALLBACK_IDS = { gemini: ['claude-sonnet-4-6', 'gpt-oss-120b-medium'], other: ['gemini-3.8-flash-low'] };
const rank = (/** @type {string} */ id) => (/sonnet/.test(id) ? 0 : /^claude/.test(id) && !/opus/.test(id) ? 1 : /^gpt/.test(id) ? 2 : /opus/.test(id) ? 3 : /flash-low/.test(id) ? 0 : /flash/.test(id) ? 1 : 2);

/**
 * Pure (D-088): the model a session should use. With autoSwitch on and the wanted model's bucket used up, the first
 * model from a bucket that still has room; otherwise the wanted model.
 * @param {{ wanted: string, windows: Record<string, AgyWindow>, models?: string[], now: number, autoSwitch: boolean }} o
 * @returns {{ model: string, switched: null | { from: string, to: string, back: number | null } }}
 */
function switchModel({ wanted, windows, models = [], now, autoSwitch }) {
  const b = bucketOf(wanted, windows);
  if (!autoSwitch || !bucketEmpty(b, windows, now)) return { model: wanted, switched: null };
  const gem = b === 'gemini';
  const pool = (models.length ? models : (gem ? FALLBACK_IDS.gemini : FALLBACK_IDS.other))
    .filter((id) => (gem ? !/^gemini/.test(id) : /^gemini/.test(id)))
    .filter((id) => !bucketEmpty(bucketOf(id, windows), windows, now))
    .sort((x, y) => rank(x) - rank(y));
  return pool.length ? { model: pool[0], switched: { from: wanted, to: pool[0], back: bucketBack(b, windows) } } : { model: wanted, switched: null };
}

/**
 * Read the allowance. Resolves null when agy is missing, fails or prints nothing usable.
 * @param {string | undefined} exe @param {string} dir  an empty Tama-owned folder (the guard is written there)
 * @returns {Promise<{ windows: Record<string, AgyWindow> } | null>}
 */
function readAgyUsage(exe, dir) {
  if (!exe) return Promise.resolve(null);
  try { fs.mkdirSync(dir, { recursive: true }); ensureWorkspaceGuard(dir, DENY_ALL); } catch { return Promise.resolve(null); } // no guard, no run
  return new Promise((resolve) => {
    execFile(exe, ['-p', '/usage', '--mode', 'plan', '--print-timeout', '30s'], { cwd: dir, timeout: 45000, windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout) => {
      const windows = err ? {} : parseAgyUsage(String(stdout));
      resolve(Object.keys(windows).length ? { windows } : null);
    });
  });
}

module.exports = { parseAgyUsage, bucketOf, bucketEmpty, bucketBack, switchModel, readAgyUsage };
