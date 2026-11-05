// @ts-check
// Thin Electron `screen` adapter: current work areas + cursor. Geometry math lives in summon/geometry.js.
const { screen } = require('electron');

/** @returns {import('./summon/geometry').Rect[]} */
const workAreas = () => screen.getAllDisplays().map((d) => d.workArea);

const cursor = () => screen.getCursorScreenPoint();

/** @param {() => void} fn  called when monitors are added/removed/rearranged */
function onDisplaysChanged(fn) {
  screen.on('display-added', fn);
  screen.on('display-removed', fn);
  screen.on('display-metrics-changed', fn);
}

module.exports = { workAreas, cursor, onDisplaysChanged };
