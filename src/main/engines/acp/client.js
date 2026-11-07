// @ts-check
// Minimal Agent Client Protocol client: newline-delimited JSON-RPC 2.0 over a child's stdio.
// Engine-agnostic (agy today; any ACP agent later, ENG-6).

/**
 * @typedef {{ stdin: NodeJS.WritableStream, stdout: NodeJS.ReadableStream, stderr?: NodeJS.ReadableStream | null,
 *   on: (ev: string, fn: (...a: any[]) => void) => any, kill: () => any }} ChildLike
 */

/**
 * @param {ChildLike} child
 * @param {{ onStderr?: (s: string) => void, requestTimeoutMs?: number }} [opts]
 */
function createAcpClient(child, opts = {}) {
  let buf = '';
  let nextId = 1;
  let closed = false;
  /** @type {Map<number, { resolve: (v: any) => void, reject: (e: any) => void, timer: NodeJS.Timeout | null }>} */
  const pending = new Map();
  /** @type {Map<string, (params: any) => void>} */
  const notificationHandlers = new Map();
  /** @type {Map<string, (params: any) => Promise<any> | any>} */
  const requestHandlers = new Map();
  /** @type {Array<(err: Error | null) => void>} */
  const closeHandlers = [];

  /** @param {object} msg */
  const write = (msg) => { if (!closed) child.stdin.write(`${JSON.stringify(msg)}\n`); };

  function failAll(/** @type {Error} */ err) {
    for (const [, p] of pending) { if (p.timer) clearTimeout(p.timer); p.reject(err); }
    pending.clear();
  }

  /** @param {any} msg */
  async function dispatch(msg) {
    if (msg.id != null && (Object.prototype.hasOwnProperty.call(msg, 'result') || msg.error)) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (p.timer) clearTimeout(p.timer);
      if (msg.error) p.reject(Object.assign(new Error(msg.error.message || 'ACP error'), { code: msg.error.code, data: msg.error.data }));
      else p.resolve(msg.result);
    } else if (msg.method && msg.id != null) {
      const h = requestHandlers.get(msg.method);
      if (!h) return write({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Tama does not support ${msg.method}` } });
      try { write({ jsonrpc: '2.0', id: msg.id, result: await h(msg.params) }); } catch (e) {
        write({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String(/** @type {Error} */ (e).message || e) } });
      }
    } else if (msg.method) {
      const h = notificationHandlers.get(msg.method);
      if (h) h(msg.params);
    }
  }

  child.stdout.on('data', (/** @type {Buffer|string} */ d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; } // agents may log non-JSON lines; ignore them
      // A handler that throws (or a write after the agent exited) must not become an unhandled rejection.
      dispatch(msg).catch((/** @type {Error} */ e) => opts.onStderr && opts.onStderr(`tama: ACP message handling failed: ${e.message}`));
    }
  });
  if (child.stderr && opts.onStderr) child.stderr.on('data', (/** @type {Buffer} */ d) => opts.onStderr && opts.onStderr(d.toString()));
  child.on('exit', (/** @type {number|null} */ code) => {
    closed = true;
    const err = new Error(`agent process exited (${code})`);
    failAll(err);
    for (const fn of closeHandlers) fn(code === 0 ? null : err);
  });
  child.on('error', (/** @type {Error} */ e) => { closed = true; failAll(e); for (const fn of closeHandlers) fn(e); });

  return {
    /** @param {string} method @param {any} params @param {number} [timeoutMs] @returns {Promise<any>} */
    request(method, params, timeoutMs = opts.requestTimeoutMs ?? 0) {
      if (closed) return Promise.reject(new Error('agent process is not running'));
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = timeoutMs ? setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, timeoutMs) : null;
        pending.set(id, { resolve, reject, timer });
        write({ jsonrpc: '2.0', id, method, params });
      });
    },
    /** @param {string} method @param {any} params */
    notify(method, params) { write({ jsonrpc: '2.0', method, params }); },
    /** @param {string} method @param {(params: any) => void} fn */
    onNotification(method, fn) { notificationHandlers.set(method, fn); },
    /** @param {string} method @param {(params: any) => any} fn */
    onRequest(method, fn) { requestHandlers.set(method, fn); },
    /** @param {(err: Error | null) => void} fn */
    onClose(fn) { closeHandlers.push(fn); },
    get closed() { return closed; },
    close() { if (!closed) { closed = true; failAll(new Error('closed')); try { child.kill(); } catch { /* already gone */ } } },
  };
}

/** @typedef {ReturnType<typeof createAcpClient>} AcpClient */

module.exports = { createAcpClient };
