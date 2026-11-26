// @ts-check
// Music widget rules (MUS-2): pure, so they are unit-tested without Electron.

/** A song's identity, for "closed for this song". @param {any} s */
const songKey = (s) => (s ? String(s.videoId || `${s.title}|${s.artist}`) : '');

/**
 * Should the widget be on screen? Pure.
 * @param {{ state: any, mode: 'auto'|'off', manual: boolean, dismissed: string, petHidden: boolean }} p
 * @returns {'show'|'hide-soon'|'hide'}
 */
function visibility({ state, mode, manual, dismissed, petHidden }) {
  if (petHidden) return 'hide';
  if (manual) return 'show'; // opened by hand (/music widget): stays until closed
  if (mode === 'off') return 'hide';
  if (!state) return 'hide-soon';
  if (songKey(state) === dismissed) return 'hide';
  return state.playing ? 'show' : 'hide-soon';
}

module.exports = { visibility, songKey };
