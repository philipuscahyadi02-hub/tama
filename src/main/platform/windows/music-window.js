// @ts-check
// Music widget window (MUS-2, D-066, D-068): a normal window (not always on top, in the taskbar) that the user can move
// anywhere; its position is remembered. The first time it opens next to the pet. It shows by itself while a song plays
// (setting `musicWidget: 'auto'`, without taking focus) and hides a while after the music stops.
// Looks (D-068): 'solid' (transparent window, card with a soft shadow) or 'glass' (Windows 11 acrylic behind a
// see-through card), plus an opacity (40–100 %) that goes back to 100 % while the mouse is over the card.
const path = require('path');
const { BrowserWindow } = require('electron');
const geo = require('../summon/geometry');
const { workAreas } = require('../displays');
const { attachDebug } = require('./debug');
const { visibility, songKey } = require('./music-rules');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');
/** Solid: 10 px of transparent margin on every side for the card's shadow. Glass: the window is the card. */
const SIZES = {
  solid: { compact: { width: 352, height: 172 }, expanded: { width: 352, height: 486 } },
  glass: { compact: { width: 332, height: 152 }, expanded: { width: 332, height: 466 } },
};
const HIDE_PAUSED_MS = 20000;
const HIDE_NONE_MS = 4000;

/**
 * @typedef {{ look: 'solid'|'glass', opacity: number }} Look
 * @param {{
 *   petBody: () => import('../summon/geometry').Rect,
 *   send: (win: BrowserWindow, name: string, payload: any) => void,
 *   savedPosition?: { x: number, y: number } | null,
 *   onMoved?: (pos: { x: number, y: number }) => void,
 * }} deps
 */
function createMusicWindow({ petBody, send, savedPosition = null, onMoved = () => {} }) {
  /** @type {BrowserWindow | null} */ let win = null;
  /** @type {any} */ let state = null;
  /** @type {'auto'|'off'} */ let mode = 'auto';
  /** @type {Look} */ let look = { look: 'solid', opacity: 100 };
  let expanded = false;
  let manual = false;
  let dismissed = '';
  let hovered = false;
  let movingUntil = 0;
  /** @type {{ x: number, y: number } | null} */ let pos = savedPosition;
  /** @type {ReturnType<typeof setTimeout> | null} */ let hideTimer = null;

  const alive = () => (win && !win.isDestroyed() ? win : null);
  const size = () => SIZES[look.look][expanded ? 'expanded' : 'compact'];

  function create() {
    const glass = look.look === 'glass';
    /** @type {import('electron').BrowserWindowConstructorOptions} */
    const opts = {
      ...size(), show: false, frame: false, resizable: false, maximizable: false, fullscreenable: false,
      skipTaskbar: false, title: 'Tama · Music', backgroundColor: '#00000000',
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
      ...(glass ? { backgroundMaterial: 'acrylic', roundedCorners: true } : { transparent: true, hasShadow: false }),
    };
    const w = new BrowserWindow(opts);
    w.loadFile(path.join(RENDERER, 'music', 'music.html'));
    attachDebug(w, 'music');
    // The user dragged it: remember where.
    w.on('moved', () => {
      if (Date.now() < movingUntil || w.isDestroyed()) return;
      const b = w.getBounds();
      pos = { x: b.x, y: b.y + b.height }; // bottom-left anchor: expanding grows upward from where they put it
      onMoved(pos);
    });
    w.webContents.on('did-finish-load', pushState);
    // Dev: TAMA_MUSIC_EVAL=<js> runs in the widget after load (e.g. open the Lyrics tab for a screenshot).
    if (process.env.TAMA_MUSIC_EVAL) w.webContents.once('did-finish-load', () => w.webContents.executeJavaScript(String(process.env.TAMA_MUSIC_EVAL)).catch(() => null));
    win = w;
    applyOpacity();
    return w;
  }

  /** Where it goes: the remembered spot (if still on a screen), else next to the pet. */
  function place() {
    const w = alive();
    if (!w) return;
    const s = size();
    movingUntil = Date.now() + 400;
    if (process.env.TAMA_SHOT_OFFSCREEN) { w.setBounds({ x: -4000, y: 40, ...s }); return; } // dev: off-screen
    const areas = workAreas();
    /** @type {import('../summon/geometry').Rect | null} */
    const want = pos ? { x: pos.x, y: pos.y - s.height, width: s.width, height: s.height } : null;
    let p;
    if (want && areas.some((a) => geo.overlapArea(want, a) >= s.width * s.height * 0.5)) {
      const a = areas.slice().sort((q, r) => geo.overlapArea(want, r) - geo.overlapArea(want, q))[0];
      p = { x: Math.max(a.x, Math.min(want.x, a.x + a.width - s.width)), y: Math.max(a.y, Math.min(want.y, a.y + a.height - s.height)) };
    } else p = geo.widgetPosition(petBody(), s, areas); // first time, or its monitor is gone
    w.setBounds({ x: p.x, y: p.y, width: s.width, height: s.height });
  }

  function applyOpacity() {
    const w = alive();
    if (w) w.setOpacity(hovered ? 1 : Math.max(0.4, Math.min(1, look.opacity / 100)));
  }

  function pushState() {
    const w = alive();
    if (w) send(w, 'music', { state, expanded, manual, look });
  }

  function apply() {
    const v = visibility({ state, mode, manual, dismissed });
    if (v === 'show') {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      const w = alive() || create();
      if (!w.isVisible()) { place(); w.showInactive(); } // never steals focus; a normal window, so others can cover it
    } else if (v === 'hide') {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      const w = alive(); if (w && w.isVisible()) w.hide();
    } else if (!hideTimer && alive()?.isVisible()) {
      hideTimer = setTimeout(() => { hideTimer = null; const w = alive(); if (w && visibility({ state, mode, manual, dismissed }) !== 'show') w.hide(); }, state ? HIDE_PAUSED_MS : HIDE_NONE_MS);
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
    /** Solid or glass, and the opacity. A different look rebuilds the window (acrylic is chosen at creation). @param {Look} l */
    setLook(l) {
      const next = { look: l.look === 'glass' ? /** @type {const} */ ('glass') : /** @type {const} */ ('solid'), opacity: Math.round(Math.max(40, Math.min(100, Number(l.opacity) || 100))) };
      const rebuild = next.look !== look.look;
      look = next;
      const w = alive();
      if (rebuild && w) {
        const wasVisible = w.isVisible();
        w.destroy(); win = null;
        if (wasVisible) { const n = create(); place(); n.showInactive(); }
      } else applyOpacity();
      pushState();
    },
    /** The mouse is over the card: fully visible while hovering. @param {boolean} on */
    setHover(on) { hovered = !!on; applyOpacity(); },
    /** @param {boolean} on */
    setExpanded(on) { expanded = !!on; place(); pushState(); },
    /** Put it next to the pet again (and remember that). */
    besideHer() {
      pos = null; place();
      const w = alive(); if (w) { const b = w.getBounds(); pos = { x: b.x, y: b.y + b.height }; onMoved(pos); }
    },
    /** ✕: closed for this song (or, opened by hand, closed until the next song). */
    dismiss() { manual = false; dismissed = songKey(state) || '-'; apply(); },
    /** /music widget: show it even when nothing plays. */
    open() { manual = true; dismissed = ''; apply(); const w = alive(); if (w) w.show(); },
    window: alive,
    destroy() { if (hideTimer) clearTimeout(hideTimer); const w = alive(); if (w) w.destroy(); win = null; },
  };
}

/** @typedef {ReturnType<typeof createMusicWindow>} MusicWindow */

module.exports = { createMusicWindow, SIZES };
