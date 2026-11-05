// @ts-check
// The terminal window (ported from kero-pet/main.js). Hides instead of closing.
const path = require('path');
const { BrowserWindow } = require('electron');
const { workAreas } = require('../displays');
const geo = require('../summon/geometry');
const { attachDebug } = require('./debug');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');

/**
 * @param {{
 *   savedBounds?: {x?:number, y?:number, width?:number, height?:number} | null,
 *   onBoundsChanged?: (b: import('electron').Rectangle) => void,
 *   isQuitting: () => boolean,
 * }} opts
 */
function createTerminalWindow({ savedBounds, onBoundsChanged = () => {}, isQuitting }) {
  /** @type {BrowserWindow | null} */
  let win = null;

  function create() {
    const b = savedBounds || {};
    const width = b.width || 820;
    const height = b.height || 580;
    // Only reuse a saved position if its title bar is still on a connected monitor.
    const titleBar = b.x != null && b.y != null ? { x: b.x, y: b.y, width, height: 40 } : null;
    const onScreen = !!titleBar && workAreas().some((a) => geo.overlapArea(titleBar, a) > 0);
    const w = new BrowserWindow({
      width, height, x: onScreen ? b.x : undefined, y: onScreen ? b.y : undefined,
      minWidth: 520, minHeight: 360, frame: false, show: false, backgroundColor: '#1d1a2b', title: 'Tama',
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    w.loadFile(path.join(RENDERER, 'terminal', 'terminal.html'));
    const remember = () => { if (!w.isMaximized() && !w.isMinimized()) onBoundsChanged(w.getBounds()); };
    w.on('resize', remember);
    w.on('move', remember);
    w.on('close', (e) => { if (!isQuitting()) { e.preventDefault(); w.hide(); } });
    attachDebug(w, 'term');
    win = w;
    return w;
  }

  function get() { return win && !win.isDestroyed() ? win : create(); }

  function show() {
    const w = get();
    const go = () => { if (w.isMinimized()) w.restore(); w.show(); w.focus(); w.webContents.send('ui', 'term.focus'); };
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', go); else go();
  }

  function toggle() {
    const w = win && !win.isDestroyed() ? win : null;
    if (w && w.isVisible() && w.isFocused()) w.hide(); else show();
  }

  /** True when the user can't see the terminal (used for notifications). */
  function isHidden() {
    const w = win && !win.isDestroyed() ? win : null;
    return !w || !w.isVisible() || w.isMinimized() || !w.isFocused();
  }

  return { create, get, show, toggle, isHidden, window: () => win };
}

/** @typedef {ReturnType<typeof createTerminalWindow>} TerminalWindow */

module.exports = { createTerminalWindow };
