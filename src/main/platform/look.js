// @ts-check
// The Look (D-078), window side: Windows 11 acrylic behind the chat window and Tama's pages when the Look is "glass",
// and the app's light/dark theme (nativeTheme.themeSource) for "light", "dark" or "auto" (follow Windows). Renderers
// read the same signals through CSS media queries (prefers-color-scheme, prefers-reduced-transparency), so a window
// and its page always agree. When Windows' transparency effects are off, glass falls back to solid.
const { nativeTheme } = require('electron');

/** @typedef {{ material: 'solid'|'glass', mode: 'light'|'dark'|'auto' }} Look */

/** @type {Set<import('electron').BrowserWindow>} */
const windows = new Set();
/** @type {Look} */
let look = { material: 'solid', mode: 'light' };
/** @type {Set<(glass: boolean) => void>} */
const listeners = new Set();
let lastGlass = false;

/** Glass only when chosen and Windows' transparency effects are on. */
function glassAllowed() {
  return look.material === 'glass' && !nativeTheme.prefersReducedTransparency;
}

/** @param {import('electron').BrowserWindow} win */
function paint(win) {
  if (win.isDestroyed()) { windows.delete(win); return; }
  const glass = glassAllowed();
  try {
    win.setBackgroundMaterial(glass ? 'acrylic' : 'none');
    // Transparent so the page's see-through surfaces show the blur; otherwise a color close to the page's own.
    win.setBackgroundColor(glass ? '#00000000' : nativeTheme.shouldUseDarkColors && look.mode !== 'light' ? '#221a24' : '#fff8fb');
  } catch { /* older Windows: no materials, the page still renders solid */ }
}

/** Apply a new Look to every registered window. @param {{ lookMaterial?: string, lookMode?: string }} prefs */
function setLook(prefs) {
  const next = /** @type {Look} */ ({
    material: prefs.lookMaterial === 'glass' ? 'glass' : 'solid',
    mode: prefs.lookMode === 'dark' || prefs.lookMode === 'auto' ? prefs.lookMode : 'light',
  });
  const changed = next.material !== look.material || next.mode !== look.mode;
  look = next;
  nativeTheme.themeSource = look.mode === 'auto' ? 'system' : look.mode;
  if (!changed) return;
  for (const w of [...windows]) paint(w);
  lastGlass = glassAllowed();
  for (const f of listeners) f(lastGlass);
}

/** A window that follows the Look (chat, pages). Painted now and on every change. @param {import('electron').BrowserWindow} win */
function followLook(win) {
  windows.add(win);
  win.once('closed', () => windows.delete(win));
  paint(win);
}

/** Called when glass turns on or off (e.g. the music card rebuilds its window). @param {(glass: boolean) => void} f */
function onGlassChange(f) { listeners.add(f); return () => listeners.delete(f); }

// Windows' transparency or dark-mode setting changed: repaint.
nativeTheme.on('updated', () => {
  for (const w of [...windows]) paint(w);
  const g = glassAllowed();
  if (g !== lastGlass) { lastGlass = g; for (const f of listeners) f(g); }
});

module.exports = { setLook, followLook, glassAllowed, onGlassChange };
