// @ts-check
// The transparent, click-through, always-on-top pet window (ported from kero-pet/main.js).
// Every move goes through clampToScreen so the pet can't be dragged or walk off-screen (SUM-3).
const path = require('path');
const { BrowserWindow } = require('electron');
const { workAreas, cursor } = require('../displays');
const geo = require('../summon/geometry');
const { attachDebug } = require('./debug');

const PET_W = 380;
const PET_H = 470;
const SIZE = { width: PET_W, height: PET_H };
const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');
const PRELOAD = path.join(__dirname, '..', '..', '..', 'preload', 'index.js');

/**
 * @param {{ savedPosition?: {x:number, y:number} | null, onMoved?: (pos: {x:number,y:number}) => void }} opts
 */
function createPetWindow({ savedPosition, onMoved = () => {} }) {
  const areas = workAreas();
  const start = savedPosition
    ? geo.clampToScreen({ ...savedPosition, ...SIZE }, areas) // validate against today's monitors
    : geo.homePosition(areas[0], SIZE);

  const win = new BrowserWindow({
    width: PET_W, height: PET_H, x: start.x, y: start.y,
    transparent: true, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true,
    hasShadow: false, backgroundColor: '#00000000', focusable: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(RENDERER, 'pet', 'pet.html'));
  attachDebug(win, 'pet');

  /** True only when the user chose "Hide" — the watchdog then leaves the window alone. */
  let hiddenByUser = false;

  const bounds = () => /** @type {import('../summon/geometry').Rect} */ ({ ...win.getBounds(), ...SIZE });

  /**
   * setBounds with a fixed size: on mixed-DPI setups setPosition alone can make Windows
   * resize a transparent window as it crosses monitors (NFR-2).
   * @param {{x:number, y:number}} p
   */
  function moveTo(p) {
    if (win.isDestroyed()) return;
    win.setBounds({ x: Math.round(p.x), y: Math.round(p.y), ...SIZE });
    onMoved({ x: Math.round(p.x), y: Math.round(p.y) });
  }

  return {
    win,
    SIZE,
    bounds,
    moveTo,
    /** @param {number} dx */
    walk(dx) {
      const b = bounds();
      const c = geo.clampToScreen({ ...b, x: b.x + dx }, workAreas());
      moveTo(c);
      return { atLeft: c.atLeft, atRight: c.atRight };
    },
    /** @param {number} dx @param {number} dy */
    dragBy(dx, dy) {
      const b = bounds();
      moveTo(geo.clampToScreen({ ...b, x: b.x + dx, y: b.y + dy }, workAreas()));
    },
    /** @param {boolean} capture */
    setCapture(capture) { if (!win.isDestroyed()) win.setIgnoreMouseEvents(!capture, { forward: true }); },
    hide() { hiddenByUser = true; win.hide(); },
    toggleVisible() { if (win.isVisible()) { hiddenByUser = true; win.hide(); } else { hiddenByUser = false; win.showInactive(); } },
    isHiddenByUser: () => hiddenByUser,
    /** PNG of the pet as she looks right now (ART-5: Telegram /status). Null when she's hidden. */
    async snapshot() {
      if (win.isDestroyed() || !win.isVisible()) return null;
      const r = { x: geo.BODY.x - 30, y: geo.BODY.y - 40, width: geo.BODY.width + 60, height: geo.BODY.height + 40 };
      const img = await win.webContents.capturePage(r);
      return img.isEmpty() ? null : img.toPNG();
    },
    clearHiddenByUser() { hiddenByUser = false; },
    cursor,
  };
}

/** @typedef {ReturnType<typeof createPetWindow>} PetWindow */

module.exports = { createPetWindow, PET_W, PET_H };
