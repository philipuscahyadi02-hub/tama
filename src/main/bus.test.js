// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { Bus } = require('./bus');

test('emit reaches topic and any-listeners; off unsubscribes', () => {
  const bus = new Bus();
  /** @type {string[]} */ const seen = [];
  const off = bus.on('a.b.done', (p) => seen.push(`on:${p}`));
  bus.onAny((p, t) => seen.push(`any:${t}:${p}`));
  bus.emit('a.b.done', 1);
  off();
  bus.emit('a.b.done', 2);
  assert.deepEqual(seen, ['on:1', 'any:a.b.done:1', 'any:a.b.done:2']);
});

test('a throwing listener does not stop others and is reported as app.error', () => {
  const bus = new Bus();
  /** @type {any[]} */ const errors = [];
  let reached = false;
  bus.on('app.error', (e) => errors.push(e));
  bus.on('x.y.z', () => { throw new Error('boom'); });
  bus.on('x.y.z', () => { reached = true; });
  bus.emit('x.y.z');
  assert.equal(reached, true);
  assert.equal(errors[0].message, 'boom');
});

test('request/handle: single handler, async result, missing handler rejects', async () => {
  const bus = new Bus();
  bus.handle('math.double', (n) => n * 2);
  assert.equal(await bus.request('math.double', 21), 42);
  assert.throws(() => bus.handle('math.double', () => 0), /already registered/);
  await assert.rejects(bus.request('nobody.home'), /no handler/);
});
