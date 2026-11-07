// @ts-check
// Composer (EVT-3, D-033, D-043; QC-5): one shared agy session for event lines, diary pages and dubs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createComposer } = require('./compose');

/** A fake engine that answers each send with `reply(text)` (string → text + result; null → error result; 'hang' → nothing). */
function fakeFactory(/** @type {(t: string) => string | null | 'hang' | Error} */ reply) {
  const made = { engines: 0, sends: /** @type {string[]} */ ([]), stops: 0, interrupts: 0, personas: /** @type {string[]} */ ([]) };
  const factory = (/** @type {(ev: any) => void} */ emit, /** @type {string} */ persona) => {
    made.engines++;
    made.personas.push(persona);
    return /** @type {any} */ ({
      setCwd: () => {},
      setPersona: (/** @type {string} */ p) => made.personas.push(p),
      interrupt: () => { made.interrupts++; },
      stop: () => { made.stops++; },
      send: (/** @type {string} */ t) => {
        made.sends.push(t);
        const r = reply(t);
        if (r instanceof Error) return Promise.reject(r);
        if (r === 'hang') return undefined;
        setImmediate(() => {
          if (r === null) emit({ t: 'result', isError: true });
          else { emit({ t: 'text-delta', text: r.slice(0, 3) }); emit({ t: 'text-delta', text: r.slice(3) }); emit({ t: 'result', isError: false }); }
        });
        return undefined;
      },
    });
  };
  return { made, factory };
}
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tama-compose-'));

test('composes a cleaned line from the streamed text', async () => {
  const { made, factory } = fakeFactory(() => '"Ohayou~ [[remember: x]]"');
  /** @type {any[]} */ const results = [];
  const c = createComposer({ factory, scratchDir: dir(), available: () => true, persona: () => 'P', onResult: (ev) => results.push(ev) });
  assert.equal(await c.compose({ seed: 'morning' }), 'Ohayou~');
  assert.match(made.sends[0], /morning/);
  assert.equal(results.length, 1);
  c.stop();
  assert.equal(made.stops, 1);
});

test('unavailable, error results and failed sends all give null', async () => {
  const off = createComposer({ factory: fakeFactory(() => 'x').factory, scratchDir: dir(), available: () => false, persona: () => '' });
  assert.equal(await off.compose({ seed: 'a' }), null);
  const err = createComposer({ factory: fakeFactory(() => null).factory, scratchDir: dir(), available: () => true, persona: () => '' });
  assert.equal(await err.compose({ seed: 'a' }), null);
  const rej = createComposer({ factory: fakeFactory(() => new Error('dead')).factory, scratchDir: dir(), available: () => true, persona: () => '' });
  assert.equal(await rej.compose({ seed: 'a' }), null);
  // The session still works after a failure.
  const once = { n: 0 };
  const mixed = createComposer({ factory: fakeFactory(() => (once.n++ ? 'second' : new Error('x'))).factory, scratchDir: dir(), available: () => true, persona: () => '' });
  assert.equal(await mixed.compose({ seed: 'a' }), null);
  assert.equal(await mixed.compose({ seed: 'b' }), 'second');
});

test('one composition at a time, in order', async () => {
  const { made, factory } = fakeFactory((t) => (t.includes('first') ? 'one' : 'two'));
  const c = createComposer({ factory, scratchDir: dir(), available: () => true, persona: () => '' });
  const [a, b] = await Promise.all([c.compose({ seed: 'first' }), c.compose({ kind: 'translate', seed: 'second' })]);
  assert.deepEqual([a, b], ['one', 'two']);
  assert.match(made.sends[0], /first/);
  assert.match(made.sends[1], /second/);
});

test('the session restarts after 15 turns and takes the current persona', async () => {
  const { made, factory } = fakeFactory(() => 'ok');
  let persona = 'v1';
  const c = createComposer({ factory, scratchDir: dir(), available: () => true, persona: () => persona });
  for (let i = 0; i < 15; i++) await c.compose({ seed: String(i) });
  assert.equal(made.engines, 1);
  persona = 'v2';
  await c.compose({ seed: 'again' });
  assert.equal(made.engines, 2);
  assert.equal(made.stops, 1);
  assert.deepEqual(made.personas, ['v1', 'v2']);
  c.setPersona('v3');
  assert.equal(made.personas.at(-1), 'v3');
});

test('a reply that never comes times out after 40 s, interrupts, and frees the session', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const replies = ['hang', 'late but fine'];
  const { made, factory } = fakeFactory(() => /** @type {any} */ (replies.shift()));
  const c = createComposer({ factory, scratchDir: dir(), available: () => true, persona: () => '' });
  const first = c.compose({ seed: 'a' });
  await new Promise((r) => setImmediate(r));
  t.mock.timers.tick(40000);
  assert.equal(await first, null);
  assert.equal(made.interrupts, 1);
  t.mock.timers.reset();
  assert.equal(await c.compose({ seed: 'b' }), 'late but fine');
});
