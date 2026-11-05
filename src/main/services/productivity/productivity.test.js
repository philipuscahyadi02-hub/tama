// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseWhen, describe } = require('./when');
const { createProductivity } = require('.');
const { createGitWatcher } = require('./git-watcher');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const { createDeviceSettings } = require('../../platform/store/device');

const NOW = new Date(2026, 10, 5, 14, 0, 0).getTime(); // local 14:00
const at = (/** @type {number} */ d, /** @type {number} */ h, /** @type {number} */ m = 0) => new Date(2026, 10, d, h, m, 0).getTime();

// ---------------- when.js ----------------
test('parseWhen: relative times', () => {
  assert.deepEqual(parseWhen('in 10m stretch', NOW), { at: NOW + 600000, text: 'stretch' });
  assert.deepEqual(parseWhen('in 2 hours to call mom', NOW), { at: NOW + 7200000, text: 'call mom' });
  assert.equal(parseWhen('in 5 parsecs x', NOW), null);
});

test('parseWhen: clock times, am/pm, passed → tomorrow, tomorrow', () => {
  assert.deepEqual(parseWhen('at 15:30 standup', NOW), { at: at(5, 15, 30), text: 'standup' });
  assert.deepEqual(parseWhen('3pm tea', NOW), { at: at(5, 15), text: 'tea' });
  assert.deepEqual(parseWhen('9am gym', NOW), { at: at(6, 9), text: 'gym' }); // 9am already passed today
  assert.deepEqual(parseWhen('tomorrow 9am - dentist', NOW), { at: at(6, 9), text: 'dentist' });
  assert.deepEqual(parseWhen('tomorrow at 10 ship it', NOW), { at: at(6, 10), text: 'ship it' });
  assert.equal(parseWhen('12am midnight snack', NOW)?.at, at(6, 0));
});

test('parseWhen: rejects non-times', () => {
  for (const bad of ['2 cats', 'buy milk', '25:00 x', '13pm x', '']) assert.equal(parseWhen(bad, NOW), null, bad);
});

test('describe: human-friendly', () => {
  assert.equal(describe(NOW + 5 * 60000, NOW), 'in 5 min');
  assert.equal(describe(at(5, 18, 5), NOW), 'at 18:05');
  assert.equal(describe(at(6, 9), NOW), 'tomorrow 09:00');
});

// ---------------- service ----------------
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-prod-'));
  const bus = new Bus();
  const store = createStore(dir);
  /** @type {string[]} */ const awards = [];
  /** @type {string[]} */ const acts = [];
  bus.handle('pet.award', (/** @type {any} */ p) => { awards.push(p.source); return { gained: 1 }; });
  bus.handle('pet.act', (/** @type {any} */ p) => { acts.push(p.action); return { ok: true }; });
  let t = NOW;
  const prod = createProductivity({ bus, store, now: () => t });
  const stop = prod.start();
  return { bus, store, prod, stop, awards, acts, advance: (/** @type {number} */ ms) => { t += ms; } };
}

test('todos: add, finish by number (bond XP), remove, list hides old done items', async () => {
  const { bus, awards, advance, stop } = setup();
  await bus.request('prod.todo.add', { text: '  write   tests ' });
  await bus.request('prod.todo.add', { text: 'ship M2' });
  assert.deepEqual(await bus.request('prod.todo.add', { text: '   ' }), { error: 'Empty todo.' });
  const done = await bus.request('prod.todo.done', { ref: 2 });
  assert.equal(done.todo.text, 'ship M2');
  assert.deepEqual(awards, ['todo']);
  assert.match((await bus.request('prod.todo.done', { ref: 5 })).error, /No such/);
  await bus.request('prod.todo.remove', { ref: 1 });
  advance(25 * 3600000);
  assert.equal((await bus.request('prod.get')).todos.length, 0);
  stop();
});

test('reminders: natural input, fire once when due, past times refused', async () => {
  const { bus, prod, advance, stop } = setup();
  /** @type {any[]} */ const due = [];
  bus.on('prod.reminder.due', (r) => due.push(r));
  const r = await bus.request('prod.remind.add', { input: 'in 10m drink water' });
  assert.equal(r.when, 'in 10 min');
  assert.match((await bus.request('prod.remind.add', { input: 'whenever' })).error, /did not understand/);
  assert.match((await bus.request('prod.remind.add', { at: NOW - 1, text: 'x' })).error, /past/);
  advance(9 * 60000); await prod.check();
  assert.equal(due.length, 0);
  advance(2 * 60000); await prod.check(); await prod.check();
  assert.equal(due.length, 1);
  assert.equal(due[0].text, 'drink water');
  assert.equal((await bus.request('prod.get')).reminders.length, 0);
  stop();
});

test('focus: completes → bond XP + energy treat + break → idle; stop works', async () => {
  const { bus, prod, advance, awards, acts, stop } = setup();
  /** @type {any[]} */ const phases = [];
  bus.on('prod.focus.phase', (p) => phases.push(p));
  await bus.request('prod.focus.start', { minutes: 25 });
  advance(25 * 60000); await prod.check();
  assert.deepEqual(awards, ['focus']);
  assert.deepEqual(acts, ['focus-break']);
  assert.equal(phases[1].phase, 'break');
  assert.equal(phases[1].completed, true);
  advance(5 * 60000); await prod.check();
  assert.equal(phases[2].breakOver, true);
  await bus.request('prod.focus.start', { minutes: 999 });
  assert.equal((await bus.request('prod.get')).focus.minutes, 180); // clamped
  await bus.request('prod.focus.stop');
  assert.equal((await bus.request('prod.get')).focus.phase, 'idle');
  stop();
});

test('data persists across restarts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-prod-'));
  const store = createStore(dir);
  const b1 = new Bus();
  const stop1 = createProductivity({ bus: b1, store }).start();
  await b1.request('prod.note.add', { text: 'idea: tama karaoke' });
  stop1();
  const b2 = new Bus();
  const stop2 = createProductivity({ bus: b2, store }).start();
  assert.equal((await b2.request('prod.get')).notes[0].text, 'idea: tama karaoke');
  stop2();
});

// ---------------- git watcher ----------------
test('git watcher: baseline first, then only my new commits earn XP', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-git-'));
  const bus = new Bus();
  const device = createDeviceSettings(createStore(dir));
  /** @type {string[]} */ const awards = [];
  bus.handle('pet.award', (/** @type {any} */ p) => { awards.push(p.source); return { gained: 1 }; });
  let commits = [{ sha: 'a1', email: 'me@x.dev', time: 1, subject: 'init' }];
  const fakeGit = {
    isRepo: (/** @type {string} */ d) => d.includes('repo'),
    userEmail: async () => 'me@x.dev',
    recentCommits: async () => commits,
  };
  const w = createGitWatcher({ bus, device, git: fakeGit });
  const repo = path.resolve('/tmp/repo');
  assert.match((await w.add('/tmp/nope')).error || '', /Not a git repo/);
  assert.equal((await w.add('/tmp/repo')).ok, true);
  assert.equal(awards.length, 0); // baseline only
  commits = [
    { sha: 'c3', email: 'friend@x.dev', time: 3, subject: 'their fix' },
    { sha: 'c2', email: 'me@x.dev', time: 2, subject: 'my feature' },
    ...commits,
  ];
  assert.equal(await w.checkRepo(repo), 1);
  assert.deepEqual(awards, ['commit']);
  assert.equal(await w.checkRepo(repo), 0); // nothing new
  w.remove('/tmp/repo');
  assert.deepEqual(device.get().gitWatch.repos, []);
});
