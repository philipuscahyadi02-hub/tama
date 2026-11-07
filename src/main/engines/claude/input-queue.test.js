// @ts-check
// The Agent SDK's streaming-input queue (QC-5): one Claude Code process handles many turns.
const test = require('node:test');
const assert = require('node:assert/strict');
const { InputQueue } = require('./input-queue');

test('items pushed before and after the reader starts arrive in order; close ends the stream', async () => {
  const q = new InputQueue();
  q.push('a');
  /** @type {any[]} */ const got = [];
  const reader = (async () => { for await (const v of q) got.push(v); })();
  await new Promise((r) => setImmediate(r));
  q.push('b'); // a waiting reader gets it directly
  q.push('c');
  await new Promise((r) => setImmediate(r));
  q.close();
  await reader;
  assert.deepEqual(got, ['a', 'b', 'c']);
  assert.deepEqual(await q[Symbol.asyncIterator]().next(), { value: undefined, done: true });
});

test('items queued before close are still delivered', async () => {
  const q = new InputQueue();
  q.push(1); q.push(2); q.close();
  /** @type {any[]} */ const got = [];
  for await (const v of q) got.push(v);
  assert.deepEqual(got, [1, 2]);
});
