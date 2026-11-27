// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLibrary, playUrl, searchUrl } = require('./library');
const L = require('./logic');
const { Bus } = require('../../bus');
const { TOPICS } = require('../../bus-topics');

test('library: play links are YouTube Music links the control check accepts', () => {
  assert.equal(playUrl({ videoId: 'abc123' }), 'https://music.youtube.com/watch?v=abc123');
  assert.equal(playUrl({ videoId: 'abc123', playlistId: 'PL9' }), 'https://music.youtube.com/watch?v=abc123&list=PL9');
  assert.equal(playUrl({ playlistId: 'liked' }), 'https://music.youtube.com/watch?list=LM');
  assert.equal(playUrl({ videoId: 'a&b=c' }), '');
  assert.equal(playUrl({}), '');
  const u = searchUrl("Don't (stop) me now!*");
  assert.ok(!('error' in L.cleanControl({ action: 'open', value: u })), u);
  assert.ok(!('error' in L.cleanControl({ action: 'open', value: playUrl({ videoId: 'abc123', playlistId: 'PL9' }) })));
});

/** @param {{ signedIn?: boolean, songs?: any, needsLogin?: boolean }} o */
function setup(o = {}) {
  const bus = new Bus();
  /** @type {any[]} */ const opened = [];
  /** @type {any[]} */ const asked = [];
  let logins = 0;
  bus.handle(TOPICS.GOOGLE_STATUS, () => ({ signedIn: o.signedIn !== false }));
  bus.handle(TOPICS.GOOGLE_SET, (p) => { asked.push(p); return { needsLogin: !!o.needsLogin }; });
  bus.handle(TOPICS.GOOGLE_LOGIN, () => { logins += 1; return { signedIn: true }; });
  bus.handle(TOPICS.GOOGLE_YOUTUBE, (p) => { asked.push(p); return o.songs ? { songs: o.songs } : { error: 'Connect YouTube to see your playlists.', fix: 'connect' }; });
  const lib = createLibrary({ bus, control: async (p) => { opened.push(p); return { ok: true }; } });
  return { lib, opened, asked, logins: () => logins };
}

test('library: play a search picks the first match; without YouTube it opens the search page', async () => {
  const a = setup({ songs: [{ videoId: 'vid111', title: 'Idol', artist: 'YOASOBI' }] });
  const r = await a.lib.play({ query: 'idol' });
  assert.equal(r.song.title, 'Idol');
  assert.deepEqual(a.opened, [{ action: 'open', value: 'https://music.youtube.com/watch?v=vid111' }]);
  const none = setup({ songs: [] });
  assert.match((await none.lib.play({ query: 'zzz' })).error, /Nothing found/);
  assert.equal(none.opened.length, 0);
  const off = setup();
  const r2 = await off.lib.play({ query: 'idol' });
  assert.equal(r2.opened, 'search');
  assert.match(off.opened[0].value, /^https:\/\/music\.youtube\.com\/search\?q=idol$/);
  assert.equal((await off.lib.play({ videoId: '<x>' })).ok, false);
});

test('library: connect turns the YouTube switch on and signs in again only when needed', async () => {
  const a = setup({ needsLogin: true });
  assert.deepEqual(await a.lib.library({ op: 'connect' }), { ok: true });
  assert.deepEqual(a.asked[0], { youtube: true });
  assert.equal(a.logins(), 1);
  const b = setup({ needsLogin: false });
  await b.lib.library({ op: 'connect' });
  assert.equal(b.logins(), 0);
  const c = setup({ signedIn: false });
  assert.equal((await c.lib.library({ op: 'connect' })).fix, 'google');
  assert.match((await c.lib.library({ op: 'nope' })).error, /unknown/);
  assert.deepEqual(await c.lib.library({ op: 'items', id: 'PL1' }), { error: 'Connect YouTube to see your playlists.', fix: 'connect' });
});
