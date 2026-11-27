// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('./youtube');
const { createYoutube, explain, quotaUnits } = Y;
const slimPlaylist = /** @type {(p: any) => any} */ (Y.slimPlaylist);
const slimSong = /** @type {(p: any) => any} */ (Y.slimSong);

/** A fake api.request that answers from a table and records calls. @param {Record<string, any>} pages */
function fakeApi(pages) {
  /** @type {Array<{ url: string, query: any }>} */ const calls = [];
  return {
    calls,
    api: /** @type {any} */ ({
      request: async (/** @type {string} */ url, /** @type {any} */ o = {}) => {
        calls.push({ url, query: o.query });
        const key = `${url.split('/').pop()}${o.query.pageToken ? `#${o.query.pageToken}` : ''}`;
        if (pages[key] instanceof Error) throw pages[key];
        return pages[key] || { items: [] };
      },
    }),
  };
}

test('youtube: slim rows keep only safe, short fields; deleted and private videos are dropped', () => {
  assert.deepEqual(slimPlaylist({ id: 'PL1', snippet: { title: 'Gym\u0007 mix', thumbnails: { medium: { url: 'https://i.ytimg.com/a.jpg' } } }, contentDetails: { itemCount: 12 } }),
    { id: 'PL1', title: 'Gym  mix', count: 12, art: 'https://i.ytimg.com/a.jpg' });
  assert.equal(slimPlaylist({ id: 'bad id!' }), null);
  assert.equal(slimPlaylist({ id: 'PL2', snippet: { thumbnails: { medium: { url: 'https://evil.example/x.jpg' } } } }).art, '');
  // playlist item, search result and video shapes
  assert.equal(slimSong({ snippet: { title: 'A', resourceId: { videoId: 'vid111' }, videoOwnerChannelTitle: 'Yoasobi - Topic' } }).artist, 'Yoasobi');
  assert.equal(slimSong({ id: { videoId: 'vid222' }, snippet: { title: 'B', channelTitle: 'Ch' } }).videoId, 'vid222');
  assert.equal(slimSong({ id: 'vid333', snippet: { title: 'C' } }).videoId, 'vid333');
  assert.equal(slimSong({ snippet: { title: 'Deleted video', resourceId: { videoId: 'vid444' } } }), null);
  assert.equal(slimSong({ snippet: { title: 'D', resourceId: { videoId: '"><script>' } } }), null);
});

test('youtube: playlists page through and start with Liked music; lists and searches are cached', async () => {
  let t = 0;
  const f = fakeApi({
    playlists: { items: [{ id: 'PL1', snippet: { title: 'One' } }], nextPageToken: 'p2' },
    'playlists#p2': { items: [{ id: 'PL2', snippet: { title: 'Two' } }] },
    search: { items: [{ id: { videoId: 'vid555' }, snippet: { title: 'Idol', channelTitle: 'YOASOBI' } }] },
    videos: { items: [{ id: 'vid666', snippet: { title: 'Song', categoryId: '10' } }, { id: 'vid777', snippet: { title: 'Vlog', categoryId: '22' } }] },
  });
  const yt = createYoutube(f.api, { now: () => t });
  const pl = await yt.playlists();
  assert.deepEqual(pl.map((p) => p.id), ['liked', 'PL1', 'PL2']);
  assert.equal(f.calls[0].query.mine, true);
  await yt.playlists();
  assert.equal(f.calls.length, 2, 'second call served from the cache');
  t = 11 * 60000;
  await yt.playlists();
  assert.equal(f.calls.length, 4, 'refetched after 10 minutes');

  const s1 = await yt.search('  Idol ');
  assert.deepEqual(s1, [{ videoId: 'vid555', title: 'Idol', artist: 'YOASOBI', art: '' }]);
  await yt.search('idol');
  assert.equal(f.calls.filter((c) => c.url.endsWith('/search')).length, 1, 'one paid search for the same words');
  assert.equal(/** @type {any} */ (f.calls.find((c) => c.url.endsWith('/search'))).query.videoCategoryId, '10');
  assert.deepEqual(await yt.search('   '), []);

  const liked = await yt.items('liked');
  assert.deepEqual(liked.map((x) => x.videoId), ['vid666'], 'liked videos: music only');
  await assert.rejects(yt.items('../x'), /does not look right/);
});

test('youtube: readable errors and quota units', () => {
  assert.equal(explain(new Error('Google API 403: YouTube Data API v3 has not been used in project 123')).fix, 'enable-api');
  assert.equal(explain(new Error('Google API 403: quotaExceeded')).fix, 'quota');
  assert.equal(explain(new Error('Google: permission missing (insufficient)')).fix, 'connect');
  assert.equal(explain(new Error('boom')).error, 'boom');
  assert.equal(quotaUnits('youtube search GET'), 100);
  assert.equal(quotaUnits('youtube playlistItems GET'), 1);
  assert.equal(quotaUnits('gmail messages GET'), 0);
});
