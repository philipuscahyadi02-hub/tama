// @ts-check
// Music widget window (MUS-2, D-066, D-068): a desktop widget (not always on top, no taskbar button) that the user can move
// anywhere; its position is remembered. The first time it opens next to the pet. It shows by itself while a song plays
// (setting `musicWidget: 'auto'`, without taking focus) and hides a while after the music stops.
// Looks (D-068): 'solid' (transparent window, card with a soft shadow) or 'glass' (Windows 11 acrylic behind a
// see-through card), plus an opacity (40–100 %) that goes back to 100 % while the mouse is over the card.
// Up next / Lyrics (D-080) open inside the same box, like an accordion: the window grows downward (or shifts up when
// there's no room below, and back down when closed) and the list slides open. The card and the pet are separate, unless
// the user pins the card to her (it then keeps its spot relative to her as she moves).
const path = require('path');
const { BrowserWindow } = require('electron');
const geo = require('../summon/geometry');
const { workAreas } = require('../displays');
const { attachDebug } = require('./debug');
const { visibility, songKey } = require('./music-rules');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');
/** Solid: 10 px of transparent margin on every side for the card's shadow. Glass: the window is the card. */
const MORE = 300; // height of the Up next / Lyrics part when open
const SIZES = {
  solid: { compact: { width: 352, height: 172 }, expanded: { width: 352, height: 172 + MORE } },
  glass: { compact: { width: 332, height: 152 }, expanded: { width: 332, height: 152 + MORE } },
};
/** The list slides closed in the page first; then the window shrinks (matches the CSS transition). */
const COLLAPSE_MS = 200;
const HIDE_PAUSED_MS = 20000;
const HIDE_NONE_MS = 4000;

/**
 * @typedef {{ look: 'solid'|'glass', opacity: number }} Look
 * @param {{
 *   petBody: () => import('../summon/geometry').Rect,
 *   send: (win: BrowserWindow, name: string, payload: any) => void,
 *   savedPosition?: { x: number, y: number, top?: boolean } | null,
 *   onMoved?: (pos: { x: number, y: number, top?: boolean }) => void,
 *   pin?: { on: boolean, dx: number, dy: number } | null,
 *   onPin?: (pin: { on: boolean, dx: number, dy: number }) => void,
 * }} deps
 */
function createMusicWindow({ petBody, send, savedPosition = null, onMoved = () => {}, pin: savedPin = null, onPin = () => {} }) {
  /** @type {BrowserWindow | null} */ let win = null;
  /** @type {any} */ let state = null;
  /** @type {'auto'|'off'} */ let mode = 'auto';
  /** @type {Look} */ let look = { look: 'solid', opacity: 100 };
  let expanded = false;
  let manual = false;
  let dismissed = '';
  let hovered = false;
  let movingUntil = 0;
  /** The card's top-left on screen (saved with top: true; older saves stored its bottom-left). */
  /** @type {{ x: number, y: number, top?: boolean } | null} */ let pos = savedPosition;
  /** How far the open box was pushed up to fit on the screen; undone when it closes. */
  let shift = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */ let shrinkTimer = null;
  /** Pinned to the pet: the card's offset from her body (D-072). */
  let pin = savedPin && savedPin.on ? { on: true, dx: Number(savedPin.dx) || 0, dy: Number(savedPin.dy) || 0 } : { on: false, dx: 0, dy: 0 };
  /** @type {ReturnType<typeof setTimeout> | null} */ let hideTimer = null;

  const alive = () => (win && !win.isDestroyed() ? win : null);
  const size = () => SIZES[look.look][expanded ? 'expanded' : 'compact'];
  const compact = () => SIZES[look.look].compact;

  function create() {
    const glass = look.look === 'glass';
    /** @type {import('electron').BrowserWindowConstructorOptions} */
    const opts = {
      ...size(), show: false, frame: false, resizable: false, maximizable: false, fullscreenable: false,
      skipTaskbar: true, title: 'Tama · Music', backgroundColor: '#00000000', // a desktop widget: no taskbar button
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
      ...(glass ? { backgroundMaterial: 'acrylic', roundedCorners: true } : { transparent: true, hasShadow: false }),
    };
    const w = new BrowserWindow(opts);
    w.loadFile(path.join(RENDERER, 'music', 'music.html'));
    attachDebug(w, 'music');
    // The user dragged it: remember where (and, when pinned, the new spot relative to her).
    w.on('moved', () => {
      if (Date.now() < movingUntil || w.isDestroyed()) return;
      const b = w.getBounds();
      shift = 0; // dragged while open: it stays where the user put it when it closes
      pos = { x: b.x, y: b.y, top: true };
      onMoved(pos);
      if (pin.on) { const body = petBody(); pin = { on: true, dx: b.x - body.x, dy: b.y - body.y }; onPin(pin); }
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
    const want = pos ? { x: pos.x, y: pos.top ? pos.y : pos.y - compact().height, width: s.width, height: s.height } : null;
    let p;
    if (want && areas.some((a) => geo.overlapArea(want, a) >= s.width * s.height * 0.5)) {
      const a = areas.slice().sort((q, r) => geo.overlapArea(want, r) - geo.overlapArea(want, q))[0];
      p = { x: Math.max(a.x, Math.min(want.x, a.x + a.width - s.width)), y: Math.max(a.y, Math.min(want.y, a.y + a.height - s.height)) };
    } else p = geo.widgetPosition(petBody(), s, areas); // first time, or its monitor is gone
    if (pin.on) { const body = petBody(); p = clampTo({ x: body.x + pin.dx, y: body.y + pin.dy }, s); }
    w.setBounds({ x: p.x, y: p.y, width: s.width, height: s.height });
  }

  /** Keep a window of `s` fully inside the screen it's mostly on. @param {{x:number,y:number}} p @param {{width:number,height:number}} s */
  function clampTo(p, s) {
    const areas = workAreas();
    const r = { x: p.x, y: p.y, width: s.width, height: s.height };
    const a = areas.slice().sort((q, t) => geo.overlapArea(r, t) - geo.overlapArea(r, q))[0];
    return { x: Math.max(a.x, Math.min(p.x, a.x + a.width - s.width)), y: Math.max(a.y, Math.min(p.y, a.y + a.height - s.height)) };
  }

  function applyOpacity() {
    const w = alive();
    if (w) w.setOpacity(hovered ? 1 : Math.max(0.4, Math.min(1, look.opacity / 100)));
  }

  function pushState() {
    const payload = { state, expanded, manual, look, pinned: pin.on };
    const w = alive(); if (w) send(w, 'music', payload);
  }

  /** Grow the box for Up next / Lyrics: downward, pushed up only as much as the screen needs. */
  function grow() {
    const w = alive();
    if (!w) return;
    const b = w.getBounds();
    const s = SIZES[look.look].expanded;
    movingUntil = Date.now() + 400;
    if (process.env.TAMA_SHOT_OFFSCREEN) { w.setBounds({ x: b.x, y: b.y, ...s }); return; }
    const r = { x: b.x, y: b.y, width: s.width, height: s.height };
    const a = workAreas().slice().sort((q, t) => geo.overlapArea(r, t) - geo.overlapArea(r, q))[0];
    shift = a ? Math.max(0, b.y + s.height - (a.y + a.height)) : 0;
    w.setBounds({ x: b.x, y: b.y - shift, width: s.width, height: s.height });
  }

  /** Back to the compact card, where it was before it grew. */
  function shrink() {
    const w = alive();
    if (!w) { shift = 0; return; }
    const b = w.getBounds();
    const s = compact();
    movingUntil = Date.now() + 400;
    w.setBounds({ x: b.x, y: b.y + shift, width: s.width, height: s.height });
    shift = 0;
  }

  /** Closed right away (hidden, rebuilt): no slide. */
  function closeNow() {
    if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
    if (expanded) { expanded = false; shrink(); }
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
      closeNow();
    } else if (!hideTimer && alive()?.isVisible()) {
      hideTimer = setTimeout(() => { hideTimer = null; const w = alive(); if (w && visibility({ state, mode, manual, dismissed }) !== 'show') { w.hide(); closeNow(); } }, state ? HIDE_PAUSED_MS : HIDE_NONE_MS);
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
        closeNow();
        w.destroy(); win = null;
        if (wasVisible) { const n = create(); place(); n.showInactive(); }
      } else applyOpacity();
      pushState();
    },
    /** The mouse is over the card: fully visible while hovering. @param {boolean} on */
    setHover(on) { hovered = !!on; applyOpacity(); },
    /** Up next / Lyrics: open or close them inside the box (accordion). @param {boolean} on */
    setExpanded(on) {
      if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
      if (on && alive() && !expanded) { expanded = true; grow(); }
      else if (!on && expanded) {
        expanded = false;
        // The page slides the list closed first; then the window shrinks back.
        shrinkTimer = setTimeout(() => { shrinkTimer = null; if (!expanded) shrink(); }, COLLAPSE_MS);
      }
      pushState();
    },
    /** The pet moved: a pinned card moves with her. */
    follow() {
      const w = alive();
      if (!pin.on || !w || !w.isVisible() || process.env.TAMA_SHOT_OFFSCREEN) return;
      const body = petBody();
      const s = size();
      const p = clampTo({ x: body.x + pin.dx, y: body.y + pin.dy }, s);
      movingUntil = Date.now() + 400;
      w.setBounds({ x: p.x, y: p.y, width: s.width, height: s.height });
    },
    /** Pin the card to the pet (keeps today's offset) or set it free. @param {boolean} on */
    setPinned(on) {
      const w = alive();
      if (on && w) { const b = w.getBounds(); const body = petBody(); pin = { on: true, dx: b.x - body.x, dy: b.y - body.y }; }
      else pin = { ...pin, on: false };
      onPin(pin);
      pushState();
    },
    /** Put it next to the pet again (and remember that). */
    besideHer() {
      pos = null; place();
      const w = alive(); if (w) { const b = w.getBounds(); pos = { x: b.x, y: b.y, top: true }; onMoved(pos); }
    },
    /** ✕: closed for this song (or, opened by hand, closed until the next song). */
    dismiss() { manual = false; dismissed = songKey(state) || '-'; apply(); },
    /** /music widget: show it even when nothing plays. */
    open() { manual = true; dismissed = ''; apply(); const w = alive(); if (w) w.show(); },
    window: alive,
    destroy() {
      if (hideTimer) clearTimeout(hideTimer);
      if (shrinkTimer) clearTimeout(shrinkTimer);
      const w = alive(); if (w) w.destroy(); win = null;
    },
  };
}

/** @typedef {ReturnType<typeof createMusicWindow>} MusicWindow */

module.exports = { createMusicWindow, SIZES };
