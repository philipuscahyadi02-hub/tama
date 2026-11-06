// @ts-check
// Local tool bridge (D-037): lets an agent CLI's MCP relay (engines/agy/mcp-relay.js) list and call tools that live in
// Tama's main process, so secrets (Google tokens) never leave Tama. Listens on 127.0.0.1 only, on a random port, and
// every request must carry a random per-run key (handed to the relay through its environment only).
const http = require('http');
const crypto = require('crypto');

/**
 * @param {{ list: () => Promise<any[]> | any[], call: (name: string, args: any) => Promise<{ text: string, isError?: boolean }> }} handlers
 * @returns {Promise<{ url: string, key: string, close: () => void }>}
 */
function startToolBridge(handlers) {
  const key = crypto.randomBytes(32).toString('hex');
  const server = http.createServer((req, res) => {
    const auth = String(req.headers.authorization || '');
    const ok = auth.length === key.length + 7 && crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(`Bearer ${key}`));
    if (!ok || req.method !== 'POST') { res.writeHead(403).end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2_000_000) req.destroy(); });
    req.on('end', async () => {
      try {
        const msg = JSON.parse(body || '{}');
        const out = req.url === '/list' ? { tools: await handlers.list() }
          : req.url === '/call' ? await handlers.call(String(msg.name || ''), msg.arguments || {})
            : null;
        if (!out) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ text: `Error: ${String(/** @type {Error} */ (e).message || e)}`, isError: true }));
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = /** @type {import('net').AddressInfo} */ (server.address());
      resolve({ url: `http://127.0.0.1:${addr.port}`, key, close: () => server.close() });
    });
  });
}

module.exports = { startToolBridge };
