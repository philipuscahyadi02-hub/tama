// @ts-check
// The chat window (CHAT-1, D-029): a small frameless window next to the pet for talking with your Tama.
// Hides instead of closing; opens beside the pet the first time.
const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { workAreas } = require('../displays');
const geo = require('../summon/geometry');
const { attachDebug } = require('./debug');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');
const W = 380;
const H = 560;

/**
 * @param {{
 *   savedBounds?: {x?:number, y?:number, width?:number, height?:number} | null,
 *   onBoundsChanged?: (b: import('electron').Rectangle) => void,
 *   isQuitting: () => boolean,
 *   anchor: () => import('electron').Rectangle,
 * }} opts
 */
function createChatWindow({ savedBounds, onBoundsChanged = () => {}, isQuitting, anchor }) {
  /** @type {BrowserWindow | null} */
  let win = null;
  let placed = false;

  function create() {
    const b = savedBounds || {};
    const width = b.width || W;
    const height = b.height || H;
    const titleBar = b.x != null && b.y != null ? { x: b.x, y: b.y, width, height: 40 } : null;
    placed = !!titleBar && workAreas().some((a) => geo.overlapArea(titleBar, a) > 0);
    const w = new BrowserWindow({
      width, height, x: placed ? b.x : undefined, y: placed ? b.y : undefined,
      minWidth: 300, minHeight: 360, frame: false, show: false, backgroundColor: '#fff7fb', title: 'Chat',
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    w.loadFile(path.join(RENDERER, 'chat', 'chat.html'));
    const remember = () => { if (!w.isMaximized() && !w.isMinimized()) onBoundsChanged(w.getBounds()); };
    w.on('resize', remember);
    w.on('move', remember);
    w.on('close', (e) => { if (!isQuitting()) { e.preventDefault(); w.hide(); } });
    attachDebug(w, 'chat');
    win = w;
    return w;
  }

  function get() { return win && !win.isDestroyed() ? win : create(); }

  /** First open: sit beside the pet, on the side with more room. @param {BrowserWindow} w */
  function placeNearPet(w) {
    const p = anchor();
    const area = screen.getDisplayMatching(p).workArea;
    const [width, height] = w.getSize();
    const right = p.x + p.width + 8;
    const x = right + width <= area.x + area.width ? right : Math.max(area.x, p.x - width - 8);
    const y = Math.min(Math.max(area.y, p.y + p.height - height), area.y + area.height - height);
    w.setPosition(Math.round(x), Math.round(y));
    placed = true;
  }

  function show() {
    const w = get();
    if (!placed) placeNearPet(w);
    const go = () => { if (w.isMinimized()) w.restore(); w.show(); w.focus(); w.webContents.send('ui', 'chat.focus'); };
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', go); else go();
  }

  function toggle() {
    const w = win && !win.isDestroyed() ? win : null;
    if (w && w.isVisible() && w.isFocused()) w.hide(); else show();
  }

  return { show, toggle, window: () => win };
}

/** @typedef {ReturnType<typeof createChatWindow>} ChatWindow */

module.exports = { createChatWindow };
