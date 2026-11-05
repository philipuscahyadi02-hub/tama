// @ts-check
// Ported from kero-pet/agent.js — async queue used as the SDK's streaming-input prompt,
// so one Claude Code process handles many turns.

class InputQueue {
  constructor() {
    /** @type {any[]} */ this.items = [];
    /** @type {Array<(r: IteratorResult<any>) => void>} */ this.waiters = [];
    this.closed = false;
  }

  /** @param {any} v */
  push(v) {
    const w = this.waiters.shift();
    if (w) w({ value: v, done: false }); else this.items.push(v);
  }

  close() {
    this.closed = true;
    for (const w of this.waiters.splice(0)) w({ value: undefined, done: true });
  }

  [Symbol.asyncIterator]() {
    return {
      /** @returns {Promise<IteratorResult<any>>} */
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift(), done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((r) => this.waiters.push(r));
      },
    };
  }
}

module.exports = { InputQueue };
