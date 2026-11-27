// @ts-check
// Calendar box (D-085): a desktop widget like the music card. Closed it shows today's date, the next event with a
// countdown and Join; ⌄ opens today's and tomorrow's agenda inside the same box (accordion, like D-080). It never takes
// focus and has no taskbar button; it follows the Look (D-078); its spot is remembered. ui pref `calendarWidget`:
// 'auto' (pops up before a meeting, D-084's lead time, and when opened by hand), 'always' (stays on the desktop) or
// 'off' (only when opened by hand).
const path = require('path');
const { BrowserWindow } = require('electron');
const geo = require('../summon/geometry');
const { workAreas } = require('../displays');
const { attachDebug } = require('./debug');
const { followLook } = require('../look');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');
const COMPACT = { width: 340, height: 150 };
const MORE = 300;
const COLLAPSE_MS = 200;

/**
 * @param {{
 *   send: (win: BrowserWindow, name: string, payload: any) => void,
 *   savedPosition?: { x: number, y: number } | null,
 *   onMoved?: (pos: { x: number, y: number }) => void,
 * }} deps
 */
function createCalendarBox({ send, savedPosition = null, onMoved = () => {} }) {
  /** @type {BrowserWindow | null} */ let win = null;
  /** @type {'auto'|'always'|'off'} */ let mode = 'auto';
  /** @type {any} */ let meeting = null;
  let manual = false;
  let expanded = false;
  let shift = 0;
  let movingUntil = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */ let shrinkTimer = null;
  let pos = savedPosition;
  const alive = () => (win && !win.isDestroyed() ? win : null);
  const size = () => ({ width: COMPACT.width, height: COMPACT.height + (expanded ? MORE : 0) });
  const push = () => { const w = alive(); if (w) send(w, 'calbox', { meeting, expanded, mode }); };

  function create() {
    const w = new BrowserWindow({
      ...size(), show: false, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
      skipTaskbar: true, title: 'Tama · Calendar', backgroundColor: '#00000000', roundedCorners: true,
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    followLook(w);
    w.loadFile(path.join(RENDERER, 'calbox', 'calbox.html'));
    w.webContents.on('did-finish-load', push);
    w.on('moved', () => {
      if (Date.now() < movingUntil || w.isDestroyed()) return;
      const b = w.getBounds(); shift = 0; pos = { x: b.x, y: b.y }; onMoved(pos);
    });
    attachDebug(w, 'calbox');
    if (process.env.TAMA_CALBOX_EVAL) w.webContents.once('did-finish-load', () => w.webContents.executeJavaScript(String(process.env.TAMA_CALBOX_EVAL)).catch(() => null));
    win = w;
    return w;
  }

  /** The remembered spot if it's still on a screen, else the top-right corner of the main screen. */
  function place(w) {
    const s = size();
    movingUntil = Date.now() + 400;
    if (process.env.TAMA_SHOT_OFFSCREEN) { w.setBounds({ x: -4000, y: 700, ...s }); return; }
    const areas = workAreas();
    const want = pos ? { x: pos.x, y: pos.y, ...s } : null;
    if (want && areas.some((a) => geo.overlapArea(want, a) >= s.width * s.height * 0.5)) { w.setBounds(want); return; }
    const a = areas[0];
    w.setBounds({ x: a.x + a.width - s.width - 16, y: a.y + 16, ...s });
  }

  function showIt() {
    const w = alive() || create();
    if (!w.isVisible()) { place(w); w.showInactive(); }
    push();
  }

  function hideIt() {
    const w = alive();
    if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
    if (expanded) { expanded = false; if (w) { const b = w.getBounds(); w.setBounds({ x: b.x, y: b.y + shift, ...size() }); } shift = 0; }
    if (w && w.isVisible()) w.hide();
  }

  function apply() {
    if (manual || mode === 'always' || (mode === 'auto' && meeting)) showIt();
    else hideIt();
  }

  return {
    /** @param {'auto'|'always'|'off'} m */
    setMode(m) { mode = m === 'always' || m === 'off' ? m : 'auto'; apply(); },
    /** The next-meeting rule fired (D-084): pop up (auto), or hide again when it's over. @param {any} e */
    setMeeting(e) {
      const was = meeting;
      meeting = e || null;
      apply();
      const w = alive();
      if (meeting && (!was || was.id !== meeting.id) && w && w.isVisible()) w.moveTop(); // in view once, not pinned on top
    },
    /** Accordion (D-080 style): grow downward, shifted up only as much as the screen needs. @param {boolean} on */
    setExpanded(on) {
      const w = alive();
      if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
      if (on && w && !expanded) {
        expanded = true;
        const b = w.getBounds(); const s = size();
        const a = workAreas().slice().sort((q, t) => geo.overlapArea({ ...b, ...s }, t) - geo.overlapArea({ ...b, ...s }, q))[0];
        shift = a && !process.env.TAMA_SHOT_OFFSCREEN ? Math.max(0, b.y + s.height - (a.y + a.height)) : 0;
        movingUntil = Date.now() + 400;
        w.setBounds({ x: b.x, y: b.y - shift, ...s });
      } else if (!on && expanded) {
        expanded = false;
        shrinkTimer = setTimeout(() => {
          shrinkTimer = null;
          const x = alive(); if (!x || expanded) return;
          const b = x.getBounds(); movingUntil = Date.now() + 400;
          x.setBounds({ x: b.x, y: b.y + shift, ...size() }); shift = 0;
        }, COLLAPSE_MS);
      }
      push();
    },
    /** /cal box, tray, Settings: show it even without a meeting. */
    open() { manual = true; apply(); },
    /** ✕: hide it (until the next meeting in auto, or until opened again). */
    dismiss() { manual = false; if (mode === 'always') mode = 'auto'; hideIt(); },
    window: alive,
    destroy() { if (shrinkTimer) clearTimeout(shrinkTimer); const w = alive(); if (w) w.destroy(); win = null; },
  };
}

module.exports = { createCalendarBox, COMPACT, MORE };
