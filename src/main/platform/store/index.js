// @ts-check
// The only way to persist data (AGENTS.md rule 8): atomic JSON writes, schemaVersion, migrations.
const fs = require('fs');
const path = require('path');
const { migrate } = require('./migrations');

/**
 * @param {string} rootDir  e.g. %APPDATA%\Tama
 */
function createStore(rootDir) {
  /** @type {Map<string, NodeJS.Timeout>} */
  const timers = new Map();
  /** @type {Map<string, () => void>} */
  const pending = new Map();

  /** @param {string} rel */
  const abs = (rel) => {
    const root = path.resolve(rootDir);
    const p = path.resolve(root, rel);
    if (p !== root && !p.startsWith(root + path.sep)) throw new Error(`store: path escapes root: ${rel}`);
    return p;
  };

  /**
   * Read + migrate a JSON file. Returns `fallback()` if missing or unreadable.
   * A corrupt file is kept aside as <name>.corrupt-<ts> instead of being silently overwritten.
   * Returns untyped JSON; callers annotate the shape they expect.
   * @param {string} rel @param {string} kind @param {() => any} fallback @returns {any}
   */
  function read(rel, kind, fallback) {
    const file = abs(rel);
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch { return fallback(); }
    try {
      return migrate(kind, JSON.parse(raw));
    } catch (e) {
      try { fs.renameSync(file, `${file}.corrupt-${Date.now()}`); } catch { /* ignore */ }
      console.error(`[store] could not read ${rel}:`, /** @type {Error} */ (e).message);
      return fallback();
    }
  }

  /**
   * Atomic write: tmp file + rename. Stamps the current schemaVersion for `kind`.
   * @param {string} rel @param {string} kind @param {object} data
   */
  function write(rel, kind, data) {
    const file = abs(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body = JSON.stringify(migrate(kind, data, { stampOnly: true }), null, 2);
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, file);
  }

  /**
   * Debounced write; the latest `getData()` wins. Call flush() on quit.
   * @param {string} rel @param {string} kind @param {() => object} getData @param {number} [ms]
   */
  function writeSoon(rel, kind, getData, ms = 2000) {
    const run = () => { timers.delete(rel); pending.delete(rel); write(rel, kind, getData()); };
    pending.set(rel, run);
    if (!timers.has(rel)) timers.set(rel, setTimeout(run, ms));
  }

  function flush() {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    for (const run of [...pending.values()]) {
      try { run(); } catch (e) { console.error('[store] flush failed', e); }
    }
    pending.clear();
  }

  /** @param {string} rel */
  const exists = (rel) => fs.existsSync(abs(rel));

  /** List sub-directory names. @param {string} rel */
  function listDirs(rel) {
    try { return fs.readdirSync(abs(rel), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  }

  /** Read a JSON file outside the store root (e.g. a legacy kero-pet save). Never throws. @param {string} file */
  function readExternal(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }

  /** All files under a folder, as paths relative to that folder ('/' separators). @param {string} rel */
  function listFiles(rel) {
    /** @type {string[]} */
    const out = [];
    const walk = (/** @type {string} */ dir, /** @type {string} */ prefix) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}${e.name}/`);
        else if (e.isFile() && !e.name.includes('.tmp-') && !e.name.includes('.corrupt-')) out.push(`${prefix}${e.name}`);
      }
    };
    walk(abs(rel), '');
    return out;
  }

  /** Raw text read/write for bundling files the store doesn't parse (e.g. diary .md). */
  const readText = (/** @type {string} */ rel) => fs.readFileSync(abs(rel), 'utf8');
  /** @param {string} rel @param {string} text */
  function writeText(rel, text) {
    const file = abs(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  }

  /** Append one line to a text file (logs, D-040). @param {string} rel @param {string} line */
  function appendLine(rel, line) {
    const file = abs(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${line.replace(/\n/g, ' ')}\n`);
  }

  /** Delete one file inside the store (no-op if missing). @param {string} rel */
  function removeFile(rel) { fs.rmSync(abs(rel), { force: true }); }

  /** Delete a folder inside the store (never the root itself). @param {string} rel */
  function removeDir(rel) {
    const dir = abs(rel);
    if (dir === path.resolve(rootDir)) throw new Error('store: refusing to delete the store root');
    for (const k of [...pending.keys()]) {
      if (abs(k).startsWith(dir + path.sep)) { clearTimeout(/** @type {NodeJS.Timeout} */ (timers.get(k))); timers.delete(k); pending.delete(k); }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { rootDir, read, write, writeSoon, flush, exists, listDirs, listFiles, readText, writeText, appendLine, removeFile, removeDir, readExternal };
}

/** @typedef {ReturnType<typeof createStore>} Store */

module.exports = { createStore };
