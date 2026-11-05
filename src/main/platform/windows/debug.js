// @ts-check
// Debug hooks (ported from kero-pet/main.js): TAMA_DEBUG logs renderer console,
// TAMA_SHOT=<dir> saves screenshots at TAMA_SHOT_TIMES (ms, comma-separated).
const fs = require('fs');
const path = require('path');

/** @param {import('electron').BrowserWindow} win @param {string} tag */
function attachDebug(win, tag) {
  if (process.env.TAMA_DEBUG) {
    win.webContents.on('console-message', (/** @type {any} */ e) => console.log(`[${tag}]`, e.message));
    win.webContents.on('render-process-gone', (_e, d) => console.log(`[${tag}] gone`, d));
  }
  const dir = process.env.TAMA_SHOT;
  if (dir) {
    const times = (process.env.TAMA_SHOT_TIMES || '2500,7000').split(',').map(Number);
    win.webContents.once('did-finish-load', () => {
      times.forEach((ms, i) => setTimeout(async () => {
        if (win.isDestroyed()) return;
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(dir, `${tag}${i + 1}.png`), img.toPNG());
      }, ms));
    });
  }
}

module.exports = { attachDebug };
