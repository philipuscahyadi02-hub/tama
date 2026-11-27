// @ts-check
// Chat sessions (D-089): a long or stale conversation starts fresh with a short recap.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Bus } = require('../bus');
const { createChat, recapLine } = require('./chat');

function setup(/** @type {{ tokens?: number }} */ o = {}) {
  const bus = new Bus();
  let t = new Date(2026, 10, 27, 10).getTime();
  /** @type {{ sent: string[], stopped: boolean }[]} */ const engines = [];
  const factory = (/** @type {any} */ emit) => {
    const rec = { sent: /** @type {string[]} */ ([]), stopped: false };
    engines.push(rec);
    return /** @type {any} */ ({
      busy: false, setCwd() {}, setPersona() {}, stop() { rec.stopped = true; }, interrupt() {},
      send(/** @type {string} */ text) {
        rec.sent.push(text);
        setImmediate(() => { emit({ t: 'text-delta', text: 'hi~' }); emit({ t: 'result', tokens: o.tokens || 1000 }); });
      },
    });
  };
  const chat = createChat({ bus, scratchDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tama-chat-')), available: () => true, factory, now: () => t });
  const stop = chat.start();
  const turn = async (/** @type {string} */ m) => { await bus.request('chat.send', m); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); };
  return { chat, engines, turn, stop, later: (/** @type {number} */ ms) => { t += ms; } };
}

test('a turn that re-read 30k+ tokens makes the next message start a fresh session with a recap', async () => {
  const s = setup({ tokens: 31000 });
  await s.turn('first question');
  assert.equal(s.engines.length, 1);
  await s.turn('second question');
  assert.equal(s.engines.length, 2);
  assert.ok(s.engines[0].stopped);
  assert.match(s.engines[1].sent[0], /\[recent chat\][^\n]*User: first question \| You: hi~/);
  assert.match(s.engines[1].sent[0], /second question$/);
  s.stop();
});

test('short chats keep their session; two idle hours start fresh', async () => {
  const s = setup();
  await s.turn('a'); await s.turn('b');
  assert.equal(s.engines.length, 1);
  assert.doesNotMatch(s.engines[0].sent[1], /recent chat/);
  s.later(2 * 60 * 60 * 1000 + 1);
  await s.turn('c');
  assert.equal(s.engines.length, 2);
  assert.match(s.engines[1].sent[0], /\[recent chat\]/);
  s.stop();
});

test('recapLine: last 6 user/her messages, long ones cut, notes skipped', () => {
  const h = /** @type {any[]} */ ([{ role: 'note', text: 'n' }, ...Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'tama' : 'user', text: `m${i}` })), { role: 'user', text: 'x'.repeat(300) }]);
  const r = recapLine(h);
  assert.doesNotMatch(r, /m0|m1|m2|: n/);
  assert.match(r, /You: m3/);
  assert.match(r, /User: x{200}…\n$/);
  assert.equal(recapLine([]), '');
});
