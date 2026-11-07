// @ts-check
// A normal framed window that loads one of our renderer pages (onboarding, dev gallery, later settings).
// Reuses the existing window if it's already open.
const path = require('path');
const { BrowserWindow } = require('electron');
const { attachDebug } = require('./debug');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');

/** @type {Map<string, BrowserWindow>} */
const open = new Map();

/**
 * @param {string} page  path under src/renderer, e.g. 'onboarding/onboarding.html'
 * @param {{ width?: number, height?: number, title?: string, query?: Record<string, string>, frame?: boolean }} [opts]
 */
function openPage(page, opts = {}) {
  const existing = open.get(page);
  if (existing && !existing.isDestroyed()) { existing.show(); existing.focus(); return existing; }
  const win = new BrowserWindow({
    width: opts.width || 900, height: opts.height || 640, title: opts.title || 'Tama', show: false,
    frame: opts.frame ?? false, backgroundColor: '#fffaf3', minWidth: 720, minHeight: 560,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(RENDERER, page), { query: opts.query || {} });
  // Dev live checks (TAMA_SHOT_OFFSCREEN): show without taking focus; debug.js already moved it off-screen.
  win.once('ready-to-show', () => { if (process.env.TAMA_SHOT_OFFSCREEN) win.showInactive(); else { win.show(); win.focus(); } });
  win.on('closed', () => open.delete(page));
  attachDebug(win, page.split('/')[0]);
  open.set(page, win);
  return win;
}

/** @param {string} page */
function closePage(page) {
  const w = open.get(page);
  if (w && !w.isDestroyed()) w.close();
}

/** Open framed pages (for live status pushes such as Google sign-in state). */
const openPages = () => [...open.values()].filter((w) => !w.isDestroyed());

module.exports = { openPage, closePage, openPages };
