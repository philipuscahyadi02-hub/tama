// @ts-check
// Pure geometry for keeping the pet on screen (SUM-3, NFR-2). No Electron imports: unit-tested.

/** @typedef {{x:number, y:number, width:number, height:number}} Rect */

/**
 * The character's visible body inside the transparent pet window, relative to the window.
 * The window is 380x470; #pet is 170x204 at bottom-center (pet.css). Margins hold bubbles/menus.
 */
const BODY = { x: 105, y: 266, width: 170, height: 204 };

/** @param {Rect} win @returns {Rect} */
const bodyRect = (win) => ({ x: win.x + BODY.x, y: win.y + BODY.y, width: BODY.width, height: BODY.height });

/** @param {Rect} a @param {Rect} b */
function overlapArea(a, b) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** @param {Rect} r @param {{x:number,y:number}} p */
const contains = (r, p) => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;

/**
 * Work area that best holds the pet: the one with the most body overlap, else the nearest by center.
 * @param {Rect} win @param {Rect[]} areas @returns {Rect}
 */
function bestArea(win, areas) {
  if (!areas.length) throw new Error('geometry: no displays');
  const body = bodyRect(win);
  let best = areas[0];
  let bestOverlap = -1;
  for (const a of areas) {
    const o = overlapArea(body, a);
    if (o > bestOverlap) { best = a; bestOverlap = o; }
  }
  if (bestOverlap > 0) return best;
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  const dist = (/** @type {Rect} */ a) => Math.hypot(a.x + a.width / 2 - cx, a.y + a.height / 2 - cy);
  return areas.reduce((m, a) => (dist(a) < dist(m) ? a : m), areas[0]);
}

/**
 * Clamp a window position so the character's body is fully inside one work area.
 * Returns the new top-left and whether we hit the left/right edges (for walking).
 * @param {Rect} win @param {Rect[]} areas
 */
function clampToScreen(win, areas) {
  const a = bestArea(win, areas);
  const minX = a.x - BODY.x;
  const maxX = a.x + a.width - BODY.x - BODY.width;
  const minY = a.y - BODY.y;
  const maxY = a.y + a.height - BODY.y - BODY.height;
  const x = Math.round(Math.max(minX, Math.min(maxX, win.x)));
  const y = Math.round(Math.max(minY, Math.min(maxY, win.y)));
  return { x, y, atLeft: x <= minX, atRight: x >= maxX };
}

/**
 * True if at least `minFraction` of the body is visible on some display.
 * @param {Rect} win @param {Rect[]} areas @param {number} [minFraction]
 */
function isVisibleEnough(win, areas, minFraction = 0.9) {
  const body = bodyRect(win);
  const total = areas.reduce((s, a) => s + overlapArea(body, a), 0);
  return total >= body.width * body.height * minFraction;
}

/**
 * Home spot on a work area: bottom-right, 40px from the edge (kero-pet's default spot).
 * @param {Rect} area @param {{width:number,height:number}} size
 */
function homePosition(area, size) {
  return { x: Math.round(area.x + area.width - size.width - 40), y: Math.round(area.y + area.height - size.height) };
}

/**
 * Where summon() puts the pet: on the display under the cursor, near the cursor horizontally,
 * standing on the bottom of the work area.
 * @param {{x:number,y:number}} cursor @param {Rect[]} areas @param {{width:number,height:number}} size
 */
function summonPosition(cursor, areas, size) {
  const area = areas.find((a) => contains(a, cursor)) || areas[0];
  const want = { x: cursor.x - size.width / 2, y: area.y + area.height - size.height, ...size };
  const c = clampToScreen(want, [area]);
  return { x: c.x, y: c.y };
}

/**
 * Where the "out for a walk" marker docks (SUM-5, D-035): flush with the right edge of the work area,
 * a little above the bottom (where the pet usually stands), always fully inside the area.
 * @param {Rect} area @param {{width:number,height:number}} size
 */
function markerPosition(area, size) {
  const x = area.x + area.width - size.width;
  const y = Math.max(area.y, area.y + area.height - size.height - 160);
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * SET-5: a framed window (chat, terminal, Settings…) is reachable when at least 120 px of its title bar is on some
 * work area. If not (its monitor was unplugged), it gets centered on the display under the cursor, shrunk to fit.
 * Returns null when the window is fine. @param {Rect} win @param {Rect[]} areas @param {{x:number,y:number}} cursor
 * @returns {Rect | null}
 */
function rescueRect(win, areas, cursor) {
  if (!areas.length) return null;
  const bar = { x: win.x, y: win.y, width: win.width, height: 32 };
  const ok = areas.some((a) => {
    const w = Math.min(bar.x + bar.width, a.x + a.width) - Math.max(bar.x, a.x);
    return w >= 120 && bar.y >= a.y && bar.y + 20 <= a.y + a.height;
  });
  if (ok) return null;
  const area = areas.find((a) => contains(a, cursor)) || areas[0];
  const width = Math.min(win.width, area.width);
  const height = Math.min(win.height, area.height);
  return { x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + (area.height - height) / 2), width, height };
}

module.exports = { BODY, bodyRect, overlapArea, bestArea, clampToScreen, isVisibleEnough, homePosition, summonPosition, markerPosition, rescueRect };
