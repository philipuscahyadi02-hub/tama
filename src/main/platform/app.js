// @ts-check
// Electron app lifecycle + paths. The bootstrap (src/main/index.js) only talks to Electron through here.
const path = require('path');
const { app } = require('electron');

let quitting = false;

const paths = {
  /** %APPDATA%\Tama, or TAMA_DATA_DIR (dev/test runs that must not touch real saves). */
  data: () => process.env.TAMA_DATA_DIR || app.getPath('userData'),
  /** kero-pet save locations (packaged "Kero-chan" and dev "kero-pet"), for the one-time import. */
  legacyKeroSaves: () => (process.env.TAMA_NO_LEGACY ? [] : ['Kero-chan', 'kero-pet'].map((d) => path.join(app.getPath('appData'), d, 'pet-state.json'))),
};

/**
 * Run `boot` once Electron is ready, as the only instance. A second launch calls `onSecondInstance`.
 * @param {{ boot: () => void, onSecondInstance: () => void, beforeQuit: () => void }} hooks
 */
function run({ boot, onSecondInstance, beforeQuit }) {
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  app.whenReady().then(boot);
  app.on('second-instance', onSecondInstance);
  app.on('before-quit', () => { quitting = true; beforeQuit(); });
  app.on('window-all-closed', () => app.quit());
}

function quit() { quitting = true; app.quit(); }
const isQuitting = () => quitting;

module.exports = { paths, run, quit, isQuitting };
