// @ts-check
// Tama Companion extension: the pure helpers the content script uses to read YouTube Music (MUS-10).
const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('./shared');

test('byline: artist and album; years and view counts are not albums', () => {
  assert.deepEqual(Y.parseByline('YOASOBI • THE BOOK 2 • 2021'), { artist: 'YOASOBI', album: 'THE BOOK 2' });
  assert.deepEqual(Y.parseByline('Ado • 120M views • 3.1M likes'), { artist: 'Ado', album: '' });
  assert.deepEqual(Y.parseByline(''), { artist: '', album: '' });
});

test('repeat, like and duration parsing', () => {
  assert.equal(Y.parseRepeat('Repeat off'), 'off');
  assert.equal(Y.parseRepeat('Repeat all'), 'all');
  assert.equal(Y.parseRepeat('Repeat one'), 'one');
  assert.equal(Y.parseRepeat(''), null);
  assert.equal(Y.parseLike('LIKE'), 'like');
  assert.equal(Y.parseLike('INDIFFERENT'), 'none');
  assert.equal(Y.parseLike(null), null);
  assert.equal(Y.parseDuration('3:25'), 205000);
  assert.equal(Y.parseDuration('1:02:03'), 3723000);
  assert.equal(Y.parseDuration('live'), 0);
});

test('bigger covers from Google image URLs; only https survives', () => {
  assert.equal(Y.bigArt('https://lh3.googleusercontent.com/x=w60-h60-l90-rj'), 'https://lh3.googleusercontent.com/x=w544-h544-l90-rj');
  assert.equal(Y.bigArt('data:image/png;base64,AA'), '');
  assert.equal(Y.bigArt('http://lh3.googleusercontent.com/x'), '');
});

test('significant: position only when it jumped', () => {
  const a = { videoId: 'v', title: 't', playing: true, position: 1000, at: 0 };
  assert.equal(Y.significant(a, { ...a, position: 3000, at: 2000 }, 2000), false);
  assert.equal(Y.significant(a, { ...a, position: 90000, at: 2000 }, 2000), true);
  assert.equal(Y.significant(a, { ...a, title: 'u' }, 0), true);
  assert.equal(Y.significant(null, a, 0), true);
  assert.equal(Y.significant(null, null, 0), false);
});
