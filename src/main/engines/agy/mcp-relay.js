// @ts-check
// MCP stdio relay (D-037). agy starts this as an MCP server (ACP session/new mcpServers); it forwards tools/list and
// tools/call to Tama's local tool bridge (platform/tool-bridge.js). It holds no secrets except the per-run bridge key,
// and it has no tools of its own. Run with Electron's node (ELECTRON_RUN_AS_NODE=1) or plain node.
const http = require('http');

const BRIDGE = process.env.TAMA_BRIDGE_URL || '';
const KEY = process.env.TAMA_BRIDGE_KEY || '';

/** @param {string} path @param {any} body @returns {Promise<any>} */
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BRIDGE}${path}`, {
      method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
      timeout: 10 * 60000, // a confirmation may wait for the user
    }, (res) => {
      let out = '';
      res.on('data', (c) => { out += c; });
      res.on('end', () => { try { resolve(JSON.parse(out)); } catch { reject(new Error(`bridge HTTP ${res.statusCode}`)); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('bridge timeout')));
    req.end(data);
  });
}

/** @param {any} msg @param {any} result */
const reply = (msg, result) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n`);
/** @param {any} msg @param {string} message */
const fail = (msg, message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message } })}\n`);

/** @param {any} msg */
async function handle(msg) {
  if (msg.id === undefined || msg.id === null) return; // notifications
  switch (msg.method) {
    case 'initialize':
      return reply(msg, { protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'tama', version: '1' } });
    case 'tools/list': {
      const r = await post('/list', {});
      return reply(msg, { tools: r.tools || [] });
    }
    case 'tools/call': {
      const r = await post('/call', { name: msg.params && msg.params.name, arguments: (msg.params && msg.params.arguments) || {} });
      return reply(msg, { content: [{ type: 'text', text: String(r.text || '') }], isError: !!r.isError });
    }
    case 'ping': return reply(msg, {});
    default: return reply(msg, {});
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    /** @type {any} */ let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    handle(msg).catch((e) => fail(msg, String(e.message || e)));
  }
});
process.stdin.on('end', () => process.exit(0));
