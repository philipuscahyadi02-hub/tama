// @ts-check
// In-process event bus: fire-and-forget events + request/response handlers.
// Topic names and payloads are documented in ./bus-topics.js.

/** @typedef {(payload: any, topic: string) => void} Listener */
/** @typedef {(payload: any) => any} Handler */

class Bus {
  constructor() {
    /** @type {Map<string, Set<Listener>>} */
    this.listeners = new Map();
    /** @type {Set<Listener>} */
    this.anyListeners = new Set();
    /** @type {Map<string, Handler>} */
    this.handlers = new Map();
  }

  /**
   * Subscribe to an event topic. Returns an unsubscribe function.
   * @param {string} topic @param {Listener} fn
   */
  on(topic, fn) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    /** @type {Set<Listener>} */ (this.listeners.get(topic)).add(fn);
    return () => { this.listeners.get(topic)?.delete(fn); };
  }

  /** Subscribe to every event (used by channels that forward a filtered set). @param {Listener} fn */
  onAny(fn) {
    this.anyListeners.add(fn);
    return () => { this.anyListeners.delete(fn); };
  }

  /**
   * Publish an event. Listener errors are isolated so one bad listener can't break others.
   * @param {string} topic @param {any} [payload]
   */
  emit(topic, payload) {
    for (const fn of [...(this.listeners.get(topic) || []), ...this.anyListeners]) {
      try { fn(payload, topic); } catch (e) { this.reportError(topic, e); }
    }
  }

  /**
   * Register the single handler for a request topic.
   * @param {string} topic @param {Handler} fn
   */
  handle(topic, fn) {
    if (this.handlers.has(topic)) throw new Error(`bus: handler already registered for "${topic}"`);
    this.handlers.set(topic, fn);
    return () => { if (this.handlers.get(topic) === fn) this.handlers.delete(topic); };
  }

  /**
   * Call a request handler. Always async; rejects if nobody handles the topic.
   * @param {string} topic @param {any} [payload] @returns {Promise<any>}
   */
  async request(topic, payload) {
    const fn = this.handlers.get(topic);
    if (!fn) throw new Error(`bus: no handler for "${topic}"`);
    return fn(payload);
  }

  /** @param {string} topic @param {unknown} e */
  reportError(topic, e) {
    // Avoid recursion if an 'app.error' listener itself throws.
    if (topic === 'app.error') { console.error('[bus] app.error listener failed', e); return; }
    this.emit('app.error', { topic, message: String((e && /** @type {any} */ (e).message) || e) });
  }
}

/** @typedef {InstanceType<typeof Bus>} BusInstance */

module.exports = { Bus };
