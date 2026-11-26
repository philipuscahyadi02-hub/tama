// @ts-check
const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const crypto = require('crypto');
const { startWsServer, parseFrames, frame } = require('./ws-server');

/** A masked client frame. @param {number} opcode @param {Buffer} payload @param {boolean} [fin] */
function clientFrame(opcode, payload, fin = true) {
  const mask = crypto.randomBytes(4);
  const n = payload.length;
  const head = n < 126 ? Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | n]) : Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | 126, n >> 8, n & 255]);
  const body = Buffer.alloc(n);
  for (let i = 0; i < n; i++) body[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([head, mask, body]);
}

/** Open a raw WebSocket with a chosen Origin. @param {number} port @param {string} origin */
function connect(port, origin) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    let data = Buffer.alloc(0);
    /** @type {any[]} */ const messages = [];
    let upgraded = false;
    s.on('data', (/** @type {Buffer} */ c) => {
      data = Buffer.concat([data, c]);
      if (!upgraded) {
        const i = data.indexOf('\r\n\r\n');
        if (i < 0) return;
        const head = data.subarray(0, i).toString();
        data = data.subarray(i + 4);
        upgraded = true;
        resolve({ status: Number(head.split(' ')[1]), socket: s, messages });
      }
      // server frames are unmasked: parse them by hand
      while (data.length >= 2) {
        const len = data[1] & 0x7f;
        if (len >= 126 || data.length < 2 + len) break;
        if ((data[0] & 0x0f) === 1) messages.push(JSON.parse(data.subarray(2, 2 + len).toString()));
        data = data.subarray(2 + len);
      }
    });
    s.on('connect', () => s.write(
      `GET / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\nOrigin: ${origin}\r\n\r\n`));
  });
}

const until = async (/** @type {() => boolean} */ f) => { for (let i = 0; i < 100 && !f(); i++) await new Promise((r) => setTimeout(r, 10)); };

test('parseFrames: masked text frame, partial input waits, unmasked is an error', () => {
  const f = clientFrame(1, Buffer.from('{"a":1}'));
  assert.equal(parseFrames(f).frames[0].payload.toString(), '{"a":1}');
  const part = parseFrames(f.subarray(0, 5));
  assert.equal(part.frames.length, 0);
  assert.equal(part.rest.length, 5);
  assert.ok(parseFrames(frame(1, Buffer.from('x'))).error);
});

test('only allowed origins get the upgrade; messages flow both ways, fragmented too', async () => {
  /** @type {any[]} */ const got = [];
  const port = 40000 + Math.floor(Math.random() * 20000);
  const s2 = await startWsServer({
    ports: [port, port + 1],
    verifyOrigin: (o) => o.startsWith('chrome-extension://'),
    onConnection: (c) => c.onMessage((m) => { got.push(m); c.send({ echo: m }); }),
  });
  try {
    const bad = /** @type {any} */ (await connect(s2.port, 'https://evil.example'));
    assert.equal(bad.status, 403);
    bad.socket.destroy();

    const ok = /** @type {any} */ (await connect(s2.port, 'chrome-extension://abc'));
    assert.equal(ok.status, 101);
    ok.socket.write(clientFrame(1, Buffer.from('{"t":"hi"}')));
    ok.socket.write(clientFrame(1, Buffer.from('{"t":'), false));
    ok.socket.write(clientFrame(0, Buffer.from('"two"}')));
    await until(() => ok.messages.length >= 2);
    assert.deepEqual(got, [{ t: 'hi' }, { t: 'two' }]);
    assert.deepEqual(ok.messages[0], { echo: { t: 'hi' } });
    ok.socket.destroy();
  } finally { s2.close(); }
});

test('the next port is used when the first is taken', async () => {
  const port = 40000 + Math.floor(Math.random() * 20000);
  const blocker = net.createServer().listen(port, '127.0.0.1');
  await new Promise((r) => blocker.once('listening', r));
  const srv = await startWsServer({ ports: [port, port + 1], verifyOrigin: () => true, onConnection: () => {} });
  try { assert.equal(srv.port, port + 1); } finally { srv.close(); blocker.close(); }
});
