// @ts-check
// The app icon is the active Tama's face (D-047). renderer/icon draws it off-screen; this captures it at 256 px and
// applies it to the tray and every window (taskbar). A cached PNG per Tama is used right away at start, then
// refreshed; restyles and hatches re-render it.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');

const RENDERER = path.join(__dirname, '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', 'preload', 'index.js');
const TIMEOUT_MS = 15000;

/**
 * @param {{ cacheFile: () => string, getTray: () => import('electron').Tray | null }} o
 */
function createAppIcon({ cacheFile, getTray }) {
  /** @type {import('electron').NativeImage | null} */ let current = null;
  let busy = false;

  function apply(/** @type {import('electron').NativeImage} */ img) {
    current = img;
    const tray = getTray();
    // The tray wants 16 px (32 px on HiDPI); windows take the large image and scale it themselves.
    if (tray && !tray.isDestroyed()) tray.setImage(img.resize({ width: 32, height: 32, quality: 'best' }));
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.setIcon(img);
  }

  app.on('browser-window-created', (_e, w) => { if (current) w.setIcon(current); });

  /** Use the cached icon for this Tama, if any. */
  function loadCached() {
    try {
      const f = cacheFile();
      if (!fs.existsSync(f)) return false;
      const img = nativeImage.createFromPath(f);
      if (img.isEmpty()) return false;
      apply(img);
      return true;
    } catch { return false; }
  }

  /** Draw the face off-screen, capture it, apply and cache it. @returns {Promise<boolean>} */
  async function render() {
    if (busy) return false;
    busy = true;
    const win = new BrowserWindow({
      width: 256, height: 256, show: false, frame: false, transparent: true, skipTaskbar: true, focusable: false,
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true },
    });
    try {
      const ready = new Promise((resolve) => {
        const onReady = (/** @type {any} */ e) => { if (e.sender === win.webContents) { ipcMain.removeListener('icon:ready', onReady); resolve(true); } };
        ipcMain.on('icon:ready', onReady);
        setTimeout(() => { ipcMain.removeListener('icon:ready', onReady); resolve(false); }, TIMEOUT_MS);
      });
      await win.loadFile(path.join(RENDERER, 'icon', 'icon.html'));
      if (!(await ready)) return false;
      const img = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
      if (img.isEmpty()) return false;
      const sized = img.resize({ width: 256, height: 256, quality: 'best' });
      fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
      fs.writeFileSync(cacheFile(), sized.toPNG());
      apply(sized);
      return true;
    } catch { return false; } finally {
      busy = false;
      if (!win.isDestroyed()) win.destroy();
    }
  }

  return { loadCached, render, current: () => current };
}

module.exports = { createAppIcon };
