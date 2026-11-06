// @ts-check
// Regression tests for the kero-pet "can't bring her back" bug (SUM-3, NFR-2).
const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('./geometry');

const SIZE = { width: 380, height: 470 };
const MAIN = { x: 0, y: 0, width: 1920, height: 1040 };            // 1080p minus taskbar
const RIGHT = { x: 1920, y: -200, width: 2560, height: 1400 };     // taller monitor, offset up

test('dragging far off the left edge keeps the whole body on screen', () => {
  const c = geo.clampToScreen({ x: -5000, y: 300, ...SIZE }, [MAIN]);
  assert.equal(c.x, MAIN.x - geo.BODY.x);
  assert.ok(c.atLeft);
  assert.ok(geo.isVisibleEnough({ x: c.x, y: c.y, ...SIZE }, [MAIN], 1));
});

test('dragging below the taskbar or above the top is clamped vertically too (kero-pet only clamped x)', () => {
  const low = geo.clampToScreen({ x: 500, y: 5000, ...SIZE }, [MAIN]);
  assert.equal(low.y, MAIN.y + MAIN.height - geo.BODY.y - geo.BODY.height);
  const high = geo.clampToScreen({ x: 500, y: -5000, ...SIZE }, [MAIN]);
  assert.equal(high.y, MAIN.y - geo.BODY.y);
});

test('pet on a monitor that was unplugged is pulled back to the nearest remaining one', () => {
  const savedOnRight = { x: 3000, y: 400, ...SIZE };
  assert.equal(geo.isVisibleEnough(savedOnRight, [MAIN]), false);
  const c = geo.clampToScreen(savedOnRight, [MAIN]);
  assert.ok(geo.isVisibleEnough({ x: c.x, y: c.y, ...SIZE }, [MAIN], 1));
});

test('pet can live on a second monitor with a negative-y offset', () => {
  const onRight = { x: 2500, y: 400, ...SIZE };
  const c = geo.clampToScreen(onRight, [MAIN, RIGHT]);
  assert.deepEqual({ x: c.x, y: c.y }, { x: 2500, y: 400 });
});

test('summon lands on the display under the cursor, standing on its bottom edge', () => {
  const p = geo.summonPosition({ x: 3000, y: 100 }, [MAIN, RIGHT], SIZE);
  assert.ok(geo.isVisibleEnough({ ...p, ...SIZE }, [RIGHT], 1));
  assert.equal(p.y + geo.BODY.y + geo.BODY.height, RIGHT.y + RIGHT.height);
});

test('summon with the cursor in a corner still keeps the body fully visible', () => {
  const p = geo.summonPosition({ x: 2, y: 2 }, [MAIN], SIZE);
  assert.ok(geo.isVisibleEnough({ ...p, ...SIZE }, [MAIN], 1));
});

test('home position is bottom-right of the work area', () => {
  assert.deepEqual(geo.homePosition(MAIN, SIZE), { x: 1920 - 380 - 40, y: 1040 - 470 });
});

test('walk marker docks at the right edge of the work area, fully inside it (SUM-5)', () => {
  const M = { width: 48, height: 48 };
  assert.deepEqual(geo.markerPosition(MAIN, M), { x: 1920 - 48, y: 1040 - 48 - 160 });
  const p = geo.markerPosition(RIGHT, M);
  assert.equal(geo.overlapArea({ ...p, ...M }, RIGHT), 48 * 48);
  const tiny = { x: 0, y: 0, width: 300, height: 100 };
  assert.equal(geo.markerPosition(tiny, M).y, 0); // never above the top
});
