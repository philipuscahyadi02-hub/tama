// @ts-check
// Voice engine manager (D-044, D-045): which local engines run, their voice catalogs (remembered per PC so the Voice
// page can list voices while an engine is off), and starting/stopping them. The selected voice's engine runs while
// Japanese dub is on; another engine is "leased" for a few minutes after a preview, then stopped again.

const BOOT_MS = 5 * 60000;
const POLL_MS = 3000;
const LEASE_MS = 3 * 60000;

/**
 * @typedef {{ start: () => { ok: boolean, reason?: string }, stop: () => void, find: () => string | null, owned: () => boolean }} EngineProc
 * @typedef {{ name: string, uuid: string, styles: Array<{ name: string, id: number }> }} Speaker
 */

/**
 * @param {{
 *   vv: ReturnType<typeof import('./vv-engine').createVvEngines>,
 *   procs: Record<string, EngineProc>, device: import('../../platform/store/device').DeviceSettings,
 *   wait?: (ms: number) => Promise<void>, now?: () => number, onChange?: () => void,
 * }} deps
 */
function createEngineManager({ vv, procs, device, wait = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now, onChange = () => {} }) {
  /** @type {Record<string, import('./vv-engine').Engine>} */ let running = {};
  /** @type {Record<string, Promise<import('./vv-engine').Engine | null>>} */ const booting = {};
  /** @type {Record<string, number>} */ const leases = {};
  let stopped = false;

  /** Remember each running engine's voices (device.json voice.catalog). */
  function remember() {
    const cur = (device.get().voice || {}).catalog || {};
    const next = { ...cur };
    let changed = false;
    for (const e of Object.values(running)) {
      const key = JSON.stringify(e.speakers);
      if (JSON.stringify(cur[e.id] && cur[e.id].speakers) !== key) { next[e.id] = { name: e.name, version: e.version, speakers: e.speakers }; changed = true; }
    }
    if (changed) device.patch('voice', { catalog: next });
  }

  async function detect() {
    const list = await vv.detect().catch(() => []);
    running = Object.fromEntries(list.map((e) => [e.id, e]));
    remember();
    return list;
  }

  /** The engine is up (start it hidden if it's installed and Tama may). @param {string} id */
  function ensure(id) {
    if (running[id]) return Promise.resolve(running[id]);
    if (id in booting) return booting[id];
    const p = (async () => {
      await detect();
      if (running[id]) return running[id];
      const proc = procs[id];
      if (!proc || !proc.start().ok) return null;
      onChange();
      for (let t = 0; t < BOOT_MS && !stopped; t += POLL_MS) {
        await wait(POLL_MS);
        await detect();
        if (running[id]) return running[id];
      }
      return null;
    })().finally(() => { delete booting[id]; onChange(); });
    booting[id] = p;
    return p;
  }

  /** Keep `id` running for a few minutes even if the selected voice doesn't need it (previews). @param {string} id */
  function lease(id) { leases[id] = now() + LEASE_MS; }

  /** Stop engines Tama started that nothing needs; start the needed one. @param {string | null} needed */
  async function sync(needed) {
    for (const [id, proc] of Object.entries(procs)) {
      if (id === needed || (leases[id] || 0) > now() || id in booting) continue;
      if (proc.owned()) { proc.stop(); delete running[id]; onChange(); }
    }
    if (needed) await ensure(needed);
  }

  /** Every engine Tama can launch, sees running, or remembers. */
  function ids() {
    const cat = (device.get().voice || {}).catalog || {};
    return [...new Set([...Object.keys(procs), ...Object.keys(running), ...Object.keys(cat)])];
  }

  function status() {
    const cat = (device.get().voice || {}).catalog || {};
    return ids().map((id) => ({
      id, name: (running[id] && running[id].name) || (cat[id] && cat[id].name) || (id === 'aivis' ? 'AivisSpeech' : 'VOICEVOX'),
      installed: !!running[id] || !!(procs[id] && procs[id].find()), running: !!running[id], startedByTama: !!(procs[id] && procs[id].owned()), booting: id in booting,
      version: (running[id] && running[id].version) || (cat[id] && cat[id].version) || null,
    }));
  }

  /** Every known voice, running or remembered. @returns {Array<Speaker & { engine: string }>} */
  function voices() {
    const cat = (device.get().voice || {}).catalog || {};
    /** @type {Array<Speaker & { engine: string }>} */ const out = [];
    for (const id of ids()) {
      const speakers = (running[id] && running[id].speakers) || (cat[id] && cat[id].speakers) || [];
      for (const s of speakers) out.push({ ...s, engine: id });
    }
    return out;
  }

  function stopAll() { stopped = true; for (const p of Object.values(procs)) p.stop(); running = {}; }

  return { detect, ensure, lease, sync, status, voices, stopAll, get: (/** @type {string} */ id) => running[id] || null, isBooting: (/** @type {string} */ id) => id in booting };
}

module.exports = { createEngineManager, LEASE_MS };
