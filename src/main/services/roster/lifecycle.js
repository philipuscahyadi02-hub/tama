// @ts-check
// Tama lifecycle (PORT-3..5): list, switch, hatch another, graduate, restore, delete, export, import.
// Inactive Tamas are "at home": their stats are paused, by resetting lastSeen when they come back.
// Switching the active Tama relaunches the app (simplest way to rebuild every service for the new one).
const specMod = require('../../../shared/spec');
const bundle = require('./bundle');
const { levelOf } = require('../pet/bond');

/**
 * @param {{
 *   store: import('../../platform/store').Store,
 *   activeId: () => string,
 *   relaunch: () => void,
 *   files: { readBuffer: (p: string) => Buffer, writeBuffer: (p: string, b: Buffer) => void },
 *   secrets?: { keys: () => string[], get: (k: string) => string | null, set: (k: string, v: string) => void } | null,
 *   now?: () => number,
 *   newId: () => string,
 *   appVersion?: string,
 * }} deps
 */
function createLifecycle({ store, activeId, relaunch, files, secrets = null, now = Date.now, newId, appVersion = '0' }) {
  const charFile = (/** @type {string} */ id) => `tamas/${id}/character.json`;
  const ids = () => store.listDirs('tamas').filter((id) => store.exists(charFile(id)));
  const readChar = (/** @type {string} */ id) => store.read(charFile(id), 'character', () => ({}));
  /** @param {string} id */
  function need(id) {
    if (typeof id !== 'string' || !ids().includes(id)) throw new Error('No such Tama.');
    return readChar(id);
  }

  function list() {
    const active = activeId();
    return ids().map((id) => {
      const raw = readChar(id);
      const st = store.read(`tamas/${id}/state.json`, 'tama-state', () => null);
      return {
        id,
        name: specMod.normalizeSpec(raw).name,
        spec: specMod.normalizeSpec(raw),
        stage: raw.stage === 'egg' ? 'egg' : 'hatched',
        status: id === active ? 'active' : raw.graduatedAt ? 'graduated' : 'home',
        level: st ? levelOf(st.bondXp || 0) : levelOf(0),
        createdAt: raw.createdAt || 0,
        graduatedAt: raw.graduatedAt || 0,
      };
    }).sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Coming back from home: no decay for the time away (PORT-3). @param {string} id */
  function unpause(id) {
    const f = `tamas/${id}/state.json`;
    if (store.exists(f)) store.write(f, 'tama-state', { ...store.read(f, 'tama-state', () => ({})), lastSeen: now() });
  }

  /** @param {{ id: string }} p */
  function switchTo({ id }) {
    const raw = need(id);
    if (id === activeId()) return { ok: true, unchanged: true };
    if (raw.graduatedAt) store.write(charFile(id), 'character', { ...raw, graduatedAt: 0 });
    unpause(id);
    store.write('active.json', 'active', { activeTamaId: id });
    relaunch();
    return { ok: true, relaunching: true };
  }

  function hatchNew() {
    const id = newId();
    store.write(charFile(id), 'character', { ...specMod.normalizeSpec({ name: 'Tama' }), createdAt: now(), importedFrom: null, stage: 'egg' });
    return { id, ...switchTo({ id }) };
  }

  /** Graduate to the album. Graduating the active Tama hatches a new egg first. @param {{ id: string }} p */
  function graduate({ id }) {
    const raw = need(id);
    store.write(charFile(id), 'character', { ...raw, graduatedAt: now() });
    if (id === activeId()) return { graduated: id, ...hatchNew() };
    return { ok: true };
  }

  /** @param {{ id: string }} p */
  function restore({ id }) {
    const raw = need(id);
    store.write(charFile(id), 'character', { ...raw, graduatedAt: 0 });
    return { ok: true };
  }

  /** Permanent. The caller must type the Tama's exact name (PORT-4). @param {{ id: string, confirmName: string }} p */
  function remove({ id, confirmName }) {
    const raw = need(id);
    if (id === activeId()) return { error: 'Switch to another Tama before deleting this one.' };
    const name = specMod.normalizeSpec(raw).name;
    if (String(confirmName || '').trim() !== name) return { error: `Type the name exactly ("${name}") to delete.` };
    store.removeDir(`tamas/${id}`);
    return { ok: true };
  }

  /**
   * @param {{ id: string, filePath: string, password?: string, includeUser?: boolean, includeConnections?: boolean }} p
   */
  function exportTama({ id, filePath, password, includeUser = false, includeConnections = false }) {
    const raw = need(id);
    if (includeConnections && !password) return { error: 'Connections can only be exported with a password.' };
    store.flush(); // make sure the latest stats are on disk
    /** @type {Record<string, string>} */
    const tamaFiles = {};
    for (const f of store.listFiles(`tamas/${id}`)) if (bundle.SAFE_NAME.test(f)) tamaFiles[f] = store.readText(`tamas/${id}/${f}`);
    /** @type {import('./bundle').Bundle} */
    const b = {
      format: 'tama-bundle', version: 1, exportedAt: now(), app: `tama ${appVersion}`,
      tama: { name: specMod.normalizeSpec(raw).name, files: tamaFiles },
    };
    if (includeUser) {
      /** @type {Record<string, string>} */
      const u = {};
      for (const f of store.listFiles('user')) if (bundle.SAFE_NAME.test(f)) u[f] = store.readText(`user/${f}`);
      b.user = u;
    }
    if (includeConnections && secrets) {
      /** @type {Record<string, string>} */
      const c = {};
      for (const k of secrets.keys()) if (k.startsWith('telegram.')) c[k] = /** @type {string} */ (secrets.get(k));
      b.connections = c;
    }
    files.writeBuffer(filePath, bundle.encode(b, password || undefined));
    return { ok: true, filePath, encrypted: !!password };
  }

  /**
   * Import as a new Tama "at home" (new id, so it never overwrites anything).
   * @param {{ filePath: string, password?: string, includeUser?: boolean }} p
   */
  function importTama({ filePath, password, includeUser = false }) {
    let b;
    try { b = bundle.decode(files.readBuffer(filePath), password || undefined); } catch (e) {
      return { error: /** @type {Error} */ (e).message, code: /** @type {any} */ (e).code || null };
    }
    const id = newId();
    for (const [name, content] of Object.entries(b.tama.files)) store.writeText(`tamas/${id}/${name}`, content);
    const raw = readChar(id);
    store.write(charFile(id), 'character', {
      ...raw, ...specMod.normalizeSpec(raw), stage: raw.stage === 'egg' ? 'egg' : 'hatched',
      importedFrom: 'tama-file', importedAt: now(), graduatedAt: 0,
    });
    unpause(id);
    if (includeUser && b.user) for (const [name, content] of Object.entries(b.user)) store.writeText(`user/${name}`, content);
    let connections = 0;
    if (b.connections && secrets) for (const [k, v] of Object.entries(b.connections)) { secrets.set(k, v); connections++; }
    return { ok: true, id, name: specMod.normalizeSpec(raw).name, hadUser: !!b.user, connections };
  }

  /** @param {Buffer} buf */
  const needsPassword = (buf) => bundle.isEncrypted(buf);

  return { list, switchTo, hatchNew, graduate, restore, remove, exportTama, importTama, needsPassword };
}

module.exports = { createLifecycle };
