// @ts-check
// Minimal WebSocket server (RFC 6455) for the Tama Companion browser extension (MUS-10, D-066). 127.0.0.1 only, text
// frames only, size-capped. No npm dependency: the protocol subset Tama needs is small. Any web page can reach
// localhost, so the handshake asks `verifyOrigin` first (the music service only accepts chrome-extension:// origins)
// and the music service then checks the pairing key on the first message.
const http = require('http');
const crypto = require('crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 1_000_000;

/** @typedef {{ origin: string, send: (obj: any) => void, close: (code?: number) => void,
 *   onMessage: (fn: (msg: any) => void) => void, onClose: (fn: () => void) => void }} WsConnection */

/**
 * Encode one unmasked server frame. @param {number} opcode @param {Buffer} payload
 * @returns {Buffer}
 */
function frame(opcode, payload) {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | opcode, n])
    : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255])
      : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | opcode; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([head, payload]);
}

/**
 * Parse as many complete client frames as `buf` holds. Pure. Client frames must be masked (RFC 6455 §5.1).
 * @param {Buffer} buf
 * @returns {{ frames: Array<{ fin: boolean, opcode: number, payload: Buffer }>, rest: Buffer, error?: string }}
 */
function parseFrames(buf) {
  /** @type {Array<{ fin: boolean, opcode: number, payload: Buffer }>} */
  const frames = [];
  let off = 0;
  while (buf.length - off >= 2) {
    const b0 = buf[off]; const b1 = buf[off + 1];
    if (!(b1 & 0x80)) return { frames, rest: Buffer.alloc(0), error: 'unmasked client frame' };
    let len = b1 & 0x7f; let p = off + 2;
    if (len === 126) { if (buf.length - p < 2) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) {
      if (buf.length - p < 8) break;
      const big = buf.readBigUInt64BE(p); p += 8;
      if (big > BigInt(MAX_MESSAGE)) return { frames, rest: Buffer.alloc(0), error: 'frame too large' };
      len = Number(big);
    }
    if (len > MAX_MESSAGE) return { frames, rest: Buffer.alloc(0), error: 'frame too large' };
    if (buf.length - p < 4 + len) break;
    const mask = buf.subarray(p, p + 4); p += 4;
    const payload = Buffer.alloc(len);
    for (let i = 0; i < len; i++) payload[i] = buf[p + i] ^ mask[i & 3];
    frames.push({ fin: !!(b0 & 0x80), opcode: b0 & 0x0f, payload });
    off = p + len;
  }
  return { frames, rest: buf.subarray(off) };
}

/**
 * Start listening on the first free port of `ports` (the extension tries the same list).
 * @param {{ ports: number[], verifyOrigin: (origin: string) => boolean, onConnection: (c: WsConnection) => void,
 *   onError?: (msg: string) => void }} opts
 * @returns {Promise<{ port: number, close: () => void }>}
 */
async function startWsServer({ ports, verifyOrigin, onConnection, onError = () => {} }) {
  /** @type {Set<import('stream').Duplex>} */
  const sockets = new Set();
  const server = http.createServer((_req, res) => { res.writeHead(426, { 'content-type': 'text/plain' }).end('Tama: WebSocket only'); });

  server.on('upgrade', (req, socket) => {
    const origin = String(req.headers.origin || '');
    const key = String(req.headers['sec-websocket-key'] || '');
    if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key || !verifyOrigin(origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    sockets.add(socket);

    /** @type {Array<(msg: any) => void>} */ const onMsg = [];
    /** @type {Array<() => void>} */ const onEnd = [];
    let buf = Buffer.alloc(0);
    /** @type {Buffer[]} */ let parts = [];
    let closed = false;
    const end = () => {
      if (closed) return;
      closed = true; sockets.delete(socket);
      try { socket.destroy(); } catch { /* gone */ }
      for (const f of onEnd) { try { f(); } catch (e) { onError(String(e)); } }
    };
    /** @type {WsConnection} */
    const conn = {
      origin,
      send: (obj) => { if (!closed) socket.write(frame(1, Buffer.from(JSON.stringify(obj)))); },
      close: (code = 1000) => {
        if (closed) return;
        const b = Buffer.alloc(2); b.writeUInt16BE(code);
        try { socket.write(frame(8, b)); } catch { /* gone */ }
        end();
      },
      onMessage: (fn) => { onMsg.push(fn); },
      onClose: (fn) => { onEnd.push(fn); },
    };

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const r = parseFrames(buf);
      buf = Buffer.from(r.rest);
      for (const f of r.frames) {
        if (f.opcode === 8) { conn.close(); return; }
        if (f.opcode === 9) { socket.write(frame(10, f.payload)); continue; }
        if (f.opcode === 10) continue;
        if (f.opcode !== 1 && f.opcode !== 0) { conn.close(1003); return; } // text only
        parts.push(f.payload);
        if (parts.reduce((n, b) => n + b.length, 0) > MAX_MESSAGE) { conn.close(1009); return; }
        if (!f.fin) continue;
        const text = Buffer.concat(parts).toString('utf8'); parts = [];
        let msg;
        try { msg = JSON.parse(text); } catch { conn.close(1007); return; }
        for (const fn of onMsg) { try { fn(msg); } catch (e) { onError(String(e)); } }
      }
      if (r.error) conn.close(1002);
    });
    socket.on('close', end);
    socket.on('error', end);
    try { onConnection(conn); } catch (e) { onError(String(e)); conn.close(1011); }
  });

  for (const port of ports) {
    const ok = await new Promise((resolve) => {
      const fail = () => { server.removeListener('listening', win); resolve(false); };
      const win = () => { server.removeListener('error', fail); resolve(true); };
      server.once('error', fail);
      server.once('listening', win);
      server.listen(port, '127.0.0.1');
    });
    if (ok) {
      return {
        port,
        close: () => { for (const s of sockets) { try { s.destroy(); } catch { /* gone */ } } server.close(); },
      };
    }
  }
  throw new Error(`no free port in ${ports.join(', ')}`);
}

module.exports = { startWsServer, parseFrames, frame };
