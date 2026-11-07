// @ts-check
// "Out for a walk" marker (SUM-5, D-035): while the user has hidden the pet (Show / Hide), a tiny always-on-top
// tab with her face peeks out from the right edge of the primary work area. Clicking it summons her.
// Created lazily on first show; moves with display changes; uses setBounds with a fixed size (mixed DPI, D-019).
const path = require('path');
const { BrowserWindow, screen } = require('electron');
const geo = require('../summon/geometry');
const { onDisplaysChanged } = require('../displays');
const { attachDebug } = require('./debug');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');
const SIZE = { width: 44, height: 44 };

function createWalkMarker() {
  /** @type {BrowserWindow | null} */
  let win = null;
  let listening = false;

  const alive = () => (win && !win.isDestroyed() ? win : null);

  function create() {
    const w = new BrowserWindow({
      ...SIZE, show: false, transparent: true, frame: false, resizable: false, movable: false,
      minimizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: true,
      hasShadow: false, focusable: false, backgroundColor: '#00000000', title: 'Tama',
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    w.loadFile(path.join(RENDERER, 'marker', 'marker.html'));
    attachDebug(w, 'marker');
    win = w;
    if (!listening) {
      listening = true;
      onDisplaysChanged(() => { const m = alive(); if (m && m.isVisible()) place(m); });
    }
    return w;
  }

  /** @param {BrowserWindow} w */
  function place(w) {
    const area = screen.getPrimaryDisplay().workArea;
    w.setBounds({ ...geo.markerPosition(area, SIZE), ...SIZE });
  }

  function show() {
    const w = alive() || create();
    place(w);
    if (!w.isVisible()) w.showInactive(); // never steal focus from what the user is doing
    w.setAlwaysOnTop(true, 'screen-saver');
    w.moveTop();
  }

  function hide() { const w = alive(); if (w && w.isVisible()) w.hide(); }

  function destroy() { const w = alive(); if (w) w.destroy(); win = null; }

  return { show, hide, destroy, isVisible: () => !!(alive() && /** @type {BrowserWindow} */ (win).isVisible()) };
}

/** @typedef {ReturnType<typeof createWalkMarker>} WalkMarker */

module.exports = { createWalkMarker };
