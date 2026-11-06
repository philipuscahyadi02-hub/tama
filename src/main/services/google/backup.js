// @ts-check
// Drive backup + device lease (PORT-6, PORT-7, D-034). Backups are the same .tama bytes as a manual export, stored in
// Drive's hidden appDataFolder (only Tama can see them). Keeps the newest 7 per Tama.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TOPICS } = require('../../bus-topics');
const { dayOf } = require('../pet/bond');

const KEEP = 7;
const LEASE_FRESH_MS = 15 * 60000;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance, drive: ReturnType<typeof import('./drive').createDrive>,
 *   tamaId: () => string, tamaName: () => string, deviceId: string, deviceName: string, now?: () => number,
 * }} deps
 */
function createBackup({ bus, drive, tamaId, tamaName, deviceId, deviceName, now = Date.now }) {
  const tmp = (/** @type {string} */ name) => path.join(os.tmpdir(), `tama-${process.pid}-${name}`);

  /** Upload today's backup of the active Tama, prune old ones. */
  async function backupNow() {
    const id = tamaId();
    const file = tmp(`${id}.tama`);
    const r = await bus.request(TOPICS.ROSTER_EXPORT, { id, filePath: file, includeUser: true });
    if (!r || r.error) throw new Error(`backup export failed: ${(r && r.error) || 'unknown'}`);
    try {
      const data = fs.readFileSync(file);
      const name = `backup-${id}-${dayOf(now())}.tama`;
      const existing = (await drive.appList(`backup-${id}-`)).filter((f) => f.name.startsWith(`backup-${id}-`));
      const same = existing.find((f) => f.name === name);
      await drive.appPut(name, data, same && same.id);
      const old = existing.filter((f) => f.name !== name).sort((a, b) => b.name.localeCompare(a.name)).slice(KEEP - 1);
      for (const f of old) await drive.appRemove(f.id).catch(() => null);
      return { ok: true, name, size: data.length };
    } finally { fs.rmSync(file, { force: true }); }
  }

  /** All backups in this Google account, newest first. */
  async function list() {
    const files = (await drive.appList('backup-')).filter((f) => /^backup-.+-\d{4}-\d{2}-\d{2}\.tama$/.test(f.name));
    return files.map((f) => {
      const m = /^backup-(.+)-(\d{4}-\d{2}-\d{2})\.tama$/.exec(f.name) || [];
      return { id: f.id, tamaId: m[1], day: m[2], size: f.size };
    }).sort((a, b) => (b.day || '').localeCompare(a.day || ''));
  }

  /** Download a backup and import it as a new Tama (never overwrites). @param {string} fileId */
  async function restore(fileId) {
    const file = tmp(`restore-${fileId}.tama`);
    fs.writeFileSync(file, await drive.appGet(fileId));
    try { return await bus.request(TOPICS.ROSTER_IMPORT, { filePath: file, includeUser: false }); } finally { fs.rmSync(file, { force: true }); }
  }

  // ---- lease (PORT-7): who is looking after this Tama right now ----
  const leaseName = () => `lease-${tamaId()}.json`;
  async function readLease() {
    const f = (await drive.appList(leaseName())).find((x) => x.name === leaseName());
    if (!f) return { file: null, lease: null };
    try { return { file: f, lease: JSON.parse((await drive.appGet(f.id)).toString('utf8')) }; } catch { return { file: f, lease: null }; }
  }
  /** Heartbeat; returns another device's fresh lease if one exists (we still take over: it's a warning, not a lock). */
  async function heartbeat() {
    const { file, lease } = await readLease();
    const other = lease && lease.deviceId !== deviceId && now() - lease.at < LEASE_FRESH_MS ? lease : null;
    await drive.appPut(leaseName(), JSON.stringify({ deviceId, deviceName, tama: tamaName(), at: now() }), file ? file.id : undefined);
    return { other };
  }

  return { backupNow, list, restore, heartbeat, KEEP };
}

module.exports = { createBackup };
