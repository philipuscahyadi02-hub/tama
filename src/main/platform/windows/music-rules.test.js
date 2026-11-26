// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { visibility, songKey } = require('./music-rules');

const song = { videoId: 'abc', title: 'Idol', artist: 'YOASOBI', playing: true };
const base = { state: song, mode: /** @type {'auto'} */ ('auto'), manual: false, dismissed: '', petHidden: false };

test('music widget visibility (table)', () => {
  /** @type {Array<[string, any, string]>} */
  const rows = [
    ['playing → show', {}, 'show'],
    ['paused → hide after a while', { state: { ...song, playing: false } }, 'hide-soon'],
    ['nothing playing → hide soon', { state: null }, 'hide-soon'],
    ['setting off → hide', { mode: 'off' }, 'hide'],
    ['closed for this song → hide', { dismissed: 'abc' }, 'hide'],
    ['closed for another song → show', { dismissed: 'xyz' }, 'show'],
    ['pet hidden → hide, even when opened by hand', { petHidden: true, manual: true }, 'hide'],
    ['opened by hand → show, even with nothing playing or the setting off', { manual: true, state: null, mode: 'off' }, 'show'],
  ];
  for (const [name, over, want] of rows) assert.equal(visibility({ ...base, ...over }), want, name);
});

test('songKey: the video id, else title and artist', () => {
  assert.equal(songKey(song), 'abc');
  assert.equal(songKey({ title: 'A', artist: 'B' }), 'A|B');
  assert.equal(songKey(null), '');
});
