// @ts-check
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { createMediaSession, pickSession } = require('./media-session');

const S = (/** @type {any} */ o) => ({ app: 'Spotify.exe', title: 'Song', artist: 'A', album: 'B', art: true, status: 4, pos: 1000, end: 200000, upd: 0, current: false, canSeek: true, canNext: true, canPrev: true, ...o });

test('pickSession: playing beats paused, browsers beat other apps, current breaks ties', () => {
  assert.equal(pickSession([], 0), null);
  assert.equal(pickSession([S({ status: 2 })], 0), null, 'stopped/closed sessions are ignored');
  assert.equal(pickSession([S({ title: '' })], 0), null, 'no title = nothing to show');
  assert.equal(pickSession([S({ app: 'Chrome', status: 5 }), S({ app: 'Foo', status: 4 })], 0)?.app, 'Foo');
  assert.equal(pickSession([S({ app: 'Foo' }), S({ app: 'Chrome' })], 0)?.app, 'Chrome');
  assert.equal(pickSession([S({ app: 'Foo' }), S({ app: 'Bar', current: true })], 0)?.app, 'Bar');
});

test('pickSession: a playing position is advanced to now and capped at the duration; paused stays', () => {
  assert.equal(pickSession([S({ pos: 1000, upd: 5000 })], 8000)?.position, 4000);
  assert.equal(pickSession([S({ pos: 1000, upd: 5000, status: 5 })], 8000)?.position, 1000);
  assert.equal(pickSession([S({ pos: 199000, upd: 1, end: 200000 })], 9e9)?.position, 200000);
  assert.equal(pickSession([S({ pos: 1000, upd: 0 })], 9e9)?.position, 1000, 'no update time = no guessing');
});

/** A fake helper process answering one JSON line per request. @param {(line: string) => any} answer */
function fakeSpawn(answer) {
  /** @type {string[]} */ const lines = [];
  const spawn = () => {
    const p = /** @type {any} */ (new EventEmitter());
    p.stdout = new EventEmitter(); p.stdout.setEncoding = () => {};
    p.stderr = new EventEmitter();
    p.kill = () => {};
    p.stdin = {
      write: (/** @type {string} */ l) => {
        lines.push(l.trim());
        const a = answer(l.trim());
        if (a !== undefined) setImmediate(() => p.stdout.emit('data', `${JSON.stringify(a)}\n`));
      },
      end: () => {},
    };
    setImmediate(() => p.stdout.emit('data', '{"ready":true}\n'));
    return p;
  };
  return { spawn: /** @type {any} */ (spawn), lines };
}

test('now/art/control talk the line protocol; app ids travel base64-encoded', async () => {
  const f = fakeSpawn((l) => (l === 'now' ? { sessions: [S({ app: 'Chrome' })] } : l.startsWith('art') ? { art: 'data:image/png;base64,AAAA' } : { ok: true }));
  const m = createMediaSession({ dir: '.', platform: 'win32', spawn: f.spawn, compile: () => 'helper.exe', now: () => 0 });
  assert.equal((await m.now())?.title, 'Song');
  assert.equal(await m.art('Chrome'), 'data:image/png;base64,AAAA');
  assert.equal(await m.control('Chrome', 'seek', 61500), true);
  assert.equal(await m.control('Chrome', /** @type {any} */ ('format-c'), 0), false, 'unknown actions never reach the helper');
  assert.deepEqual(f.lines, ['now', `art ${Buffer.from('Chrome').toString('base64')}`, `cmd ${Buffer.from('Chrome').toString('base64')} seek 61500`]);
  m.stop();
});

test('art that is not an image data URL is dropped', async () => {
  const f = fakeSpawn(() => ({ art: 'javascript:alert(1)' }));
  const m = createMediaSession({ dir: '.', platform: 'win32', spawn: f.spawn, compile: () => 'helper.exe' });
  assert.equal(await m.art('Chrome'), null);
  m.stop();
});

test('unavailable off Windows, without a compiler, and after repeated timeouts', async () => {
  assert.equal(createMediaSession({ dir: '.', platform: 'linux' }).available(), false);
  assert.equal(createMediaSession({ dir: '.', platform: 'win32', compile: () => null }).available(), false);
  /** @type {string[]} */ const errors = [];
  const f = fakeSpawn(() => undefined); // never answers
  const m = createMediaSession({ dir: '.', platform: 'win32', spawn: f.spawn, compile: () => 'x.exe', timeoutMs: 20, onError: (e) => errors.push(e) });
  for (let i = 0; i < 4; i++) assert.equal(await m.now(), null);
  assert.equal(m.available(), false);
  assert.match(errors.at(-1) || '', /giving up/);
});
