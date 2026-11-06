// @ts-check
// Small OS adapters: notifications, folder picker, global hotkeys, tray. (Ported from kero-pet/main.js.)
const { Notification, dialog, globalShortcut, Tray, Menu, nativeImage } = require('electron');

/** @param {string} title @param {string} body */
function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

/** @param {import('electron').BrowserWindow | null} parent @returns {Promise<string | null>} */
async function pickFolder(parent) {
  const opts = /** @type {import('electron').OpenDialogOptions} */ ({ properties: ['openDirectory'], title: 'Pick a project folder for Tama' });
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
}

/** @param {import('electron').BrowserWindow | null} parent @param {string} defaultName @returns {Promise<string | null>} */
async function pickSaveTama(parent, defaultName) {
  /** @type {import('electron').SaveDialogOptions} */
  const opts = { title: 'Export your Tama', defaultPath: defaultName, filters: [{ name: 'Tama', extensions: ['tama'] }] };
  const r = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts);
  return r.canceled || !r.filePath ? null : r.filePath;
}

/** @param {import('electron').BrowserWindow | null} parent @returns {Promise<string | null>} */
async function pickOpenTama(parent) {
  /** @type {import('electron').OpenDialogOptions} */
  const opts = { title: 'Bring a Tama in', properties: ['openFile'], filters: [{ name: 'Tama', extensions: ['tama'] }] };
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
}

/**
 * Register global hotkeys. Returns the accelerators that failed (already taken by another app).
 * @param {Record<string, () => void>} map  accelerator → handler
 */
function registerHotkeys(map) {
  const failed = [];
  for (const [accel, fn] of Object.entries(map)) {
    if (!globalShortcut.register(accel, fn)) failed.push(accel);
  }
  return failed;
}
const unregisterHotkeys = () => globalShortcut.unregisterAll();

/** 16x16 frog-ish tray icon drawn in code (no asset needed). */
function trayIcon() {
  const s = 16;
  const buf = Buffer.alloc(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      const eye = Math.hypot(x - 4.5, y - 3.5) < 2.2 || Math.hypot(x - 10.5, y - 3.5) < 2.2;
      const face = Math.hypot(x - 7.5, y - 10) < 4.2;
      let c = [0, 0, 0, 0];
      if (eye) c = [255, 255, 255, 255];
      else if (face) c = [255, 226, 210, 255];
      else if (Math.hypot(x - 7.5, y - 8.5) < 7.2) c = [124, 207, 106, 255];
      buf[i] = c[2]; buf[i + 1] = c[1]; buf[i + 2] = c[0]; buf[i + 3] = c[3];
    }
  }
  return nativeImage.createFromBitmap(buf, { width: s, height: s });
}

/**
 * @param {{ tooltip: string, onClick: () => void,
 *   items: Array<{label: string, click: () => void} | {type: 'separator'}> }} opts
 */
function createTray({ tooltip, onClick, items }) {
  const tray = new Tray(trayIcon());
  tray.setToolTip(tooltip);
  tray.setContextMenu(Menu.buildFromTemplate(/** @type {any} */ (items)));
  tray.on('click', onClick);
  return tray;
}

/** Hosts Tama may open in the user's browser (Google sign-in, setup help, links Tama created). */
const EXTERNAL_HOSTS = ['accounts.google.com', 'console.cloud.google.com', 'myaccount.google.com', 'docs.google.com', 'drive.google.com', 'mail.google.com', 'calendar.google.com', 'support.google.com', 'developers.google.com', 't.me'];
/** @param {string} url */
function openExternal(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !EXTERNAL_HOSTS.includes(u.hostname)) throw new Error(`Not opening ${u.hostname}: not an allowed site.`);
  return require('electron').shell.openExternal(u.toString());
}

module.exports = { notify, pickFolder, pickSaveTama, pickOpenTama, registerHotkeys, unregisterHotkeys, createTray, openExternal, EXTERNAL_HOSTS };
