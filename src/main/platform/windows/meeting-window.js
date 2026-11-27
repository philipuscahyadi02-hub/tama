// @ts-check
// Next-meeting card (D-084): a small card that pops up before a meeting (ui pref `calendarLead`, default 15 minutes)
// with the time left, Join (the meeting's video link) and Open calendar. It floats above other windows (it's a heads-up
// you asked for), never takes focus, sits next to the pet, and hides when the meeting is underway or dismissed.
const path = require('path');
const { BrowserWindow } = require('electron');
const geo = require('../summon/geometry');
const { workAreas } = require('../displays');
const { attachDebug } = require('./debug');
const { followLook } = require('../look');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');
const SIZE = { width: 340, height: 132 };

/**
 * @param {{ petBody: () => import('../summon/geometry').Rect, send: (win: BrowserWindow, name: string, payload: any) => void }} deps
 */
function createMeetingWindow({ petBody, send }) {
  /** @type {BrowserWindow | null} */ let win = null;
  /** @type {any} */ let event = null;
  const alive = () => (win && !win.isDestroyed() ? win : null);

  function create() {
    const w = new BrowserWindow({
      ...SIZE, show: false, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
      skipTaskbar: true, alwaysOnTop: true, focusable: true, title: 'Tama · Next meeting', backgroundColor: '#00000000', roundedCorners: true,
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    w.setAlwaysOnTop(true, 'floating');
    followLook(w); // solid or Windows glass, like her other windows (D-078)
    w.loadFile(path.join(RENDERER, 'meeting', 'meeting.html'));
    w.webContents.on('did-finish-load', () => send(w, 'meeting', { event }));
    attachDebug(w, 'meeting');
    win = w;
    return w;
  }

  function place(w) {
    if (process.env.TAMA_SHOT_OFFSCREEN) { w.setBounds({ x: -4000, y: 300, ...SIZE }); return; }
    const p = geo.widgetPosition(petBody(), SIZE, workAreas());
    w.setBounds({ x: p.x, y: p.y, ...SIZE });
  }

  return {
    /** The meeting to show, or null to hide. @param {any} e */
    show(e) {
      event = e || null;
      if (!event) { const w = alive(); if (w && w.isVisible()) w.hide(); return; }
      const w = alive() || create();
      send(w, 'meeting', { event });
      if (!w.isVisible()) { place(w); w.showInactive(); }
    },
    hide() { const w = alive(); if (w) w.hide(); },
    window: alive,
    destroy() { const w = alive(); if (w) w.destroy(); win = null; },
  };
}

module.exports = { createMeetingWindow };
