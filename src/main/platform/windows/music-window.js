// @ts-check
// Music widget window (MUS-2, D-066): a small card beside the pet while YouTube Music plays. It follows her when she
// walks or is dragged, unless the user dragged the card somewhere else (then it stays there: "pinned").
// Shows by itself while a song plays (setting `musicWidget: 'auto'`), hides a while after the music stops, and never
// takes focus. Compact (cover + controls) or expanded (Up next, Lyrics).
const path = require('path');
const { BrowserWindow } = require('electron');
const geo = require('../summon/geometry');
const { workAreas, onDisplaysChanged } = require('../displays');
const { attachDebug } = require('./debug');
const { visibility, songKey } = require('./music-rules');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');
/** Window sizes include 10 px of transparent margin on every side for the card's shadow. */
const SIZES = { compact: { width: 352, height: 172 }, expanded: { width: 352, height: 486 } };
const HIDE_PAUSED_MS = 20000;
const HIDE_NONE_MS = 4000;

/**
 * @param {{ petBody: () => import('../summon/geometry').Rect, petHidden: () => boolean, send: (win: BrowserWindow, name: string, payload: any) => void }} deps
 */
function createMusicWindow({ petBody, petHidden, send }) {
  /** @type {BrowserWindow | null} */ let win = null;
  /** @type {any} */ let state = null;
  /** @type {'auto'|'off'} */ let mode = 'auto';
  let expanded = false;
  let pinned = false;
  let manual = false;
  let dismissed = '';
  let movingUntil = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */ let hideTimer = null;
  let listening = false;

  const alive = () => (win && !win.isDestroyed() ? win : null);
  const size = () => (expanded ? SIZES.expanded : SIZES.compact);

  function create() {
    const w = new BrowserWindow({
      ...size(), show: false, transparent: true, frame: false, resizable: false, minimizable: false, maximizable: false,
      fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000', title: 'Tama · Music',
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    w.setAlwaysOnTop(true, 'floating');
    w.loadFile(path.join(RENDERER, 'music', 'music.html'));
    attachDebug(w, 'music');
    // A move we didn't make is the user dragging the card: from now on it stays where they put it.
    w.on('moved', () => { if (Date.now() > movingUntil) pinned = true; pushState(); });
    w.webContents.on('did-finish-load', pushState);
    // Dev: TAMA_MUSIC_EVAL=<js> runs in the widget after load (e.g. open the Lyrics tab for a screenshot).
    if (process.env.TAMA_MUSIC_EVAL) w.webContents.once('did-finish-load', () => w.webContents.executeJavaScript(String(process.env.TAMA_MUSIC_EVAL)).catch(() => null));
    win = w;
    if (!listening) { listening = true; onDisplaysChanged(() => { pinned = false; place(); }); }
    return w;
  }

  function place() {
    const w = alive();
    if (!w) return;
    const s = size();
    if (process.env.TAMA_SHOT_OFFSCREEN) { movingUntil = Date.now() + 400; w.setBounds({ x: -4000, y: 40, ...s }); return; } // dev: off-screen
    let pos;
    if (pinned) {
      // Growing or shrinking keeps the bottom edge where the user put it, inside that screen.
      const b = w.getBounds();
      const areas = workAreas();
      const a = areas.slice().sort((p, q) => geo.overlapArea(b, q) - geo.overlapArea(b, p))[0];
      const y = b.y + b.height - s.height;
      pos = {
        x: Math.max(a.x, Math.min(b.x, a.x + a.width - s.width)),
        y: Math.max(a.y, Math.min(y, a.y + a.height - s.height)),
      };
    } else pos = geo.widgetPosition(petBody(), s, workAreas());
    movingUntil = Date.now() + 400;
    w.setBounds({ ...pos, ...s });
  }

  function pushState() {
    const w = alive();
    if (w) send(w, 'music', { state, expanded, pinned, manual });
  }

  function apply() {
    const v = visibility({ state, mode, manual, dismissed, petHidden: petHidden() });
    if (v === 'show') {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      const w = alive() || create();
      if (!w.isVisible()) { place(); w.showInactive(); w.setAlwaysOnTop(true, 'floating'); }
    } else if (v === 'hide') {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      const w = alive(); if (w && w.isVisible()) w.hide();
    } else if (!hideTimer && alive()?.isVisible()) {
      hideTimer = setTimeout(() => { hideTimer = null; const w = alive(); if (w && visibility({ state, mode, manual, dismissed, petHidden: petHidden() }) !== 'show') w.hide(); }, state ? HIDE_PAUSED_MS : HIDE_NONE_MS);
    }
    pushState();
  }

  return {
    /** New music state from the music service. @param {any} s */
    update(s) {
      if (songKey(s) !== songKey(state) && dismissed && songKey(s) !== dismissed) dismissed = ''; // a new song brings it back
      state = s;
      apply();
    },
    /** @param {'auto'|'off'} m */
    setMode(m) { mode = m === 'off' ? 'off' : 'auto'; apply(); },
    /** The pet moved, was hidden or shown. */
    follow() {
      const w = alive();
      if (w && w.isVisible() && !pinned && !petHidden()) { place(); return; } // the common case while she walks: just move
      if (petHidden() || (w && !w.isVisible())) apply();
    },
    /** @param {boolean} on */
    setExpanded(on) { expanded = !!on; place(); pushState(); },
    /** Back beside her. */
    unpin() { pinned = false; place(); pushState(); },
    /** ✕: closed for this song (or, opened by hand, closed until the next song). */
    dismiss() { manual = false; dismissed = songKey(state) || '-'; apply(); },
    /** /music widget: show it even when nothing plays. */
    open() { manual = true; dismissed = ''; apply(); },
    window: alive,
    destroy() { if (hideTimer) clearTimeout(hideTimer); const w = alive(); if (w) w.destroy(); win = null; },
  };
}

/** @typedef {ReturnType<typeof createMusicWindow>} MusicWindow */

module.exports = { createMusicWindow, SIZES };
