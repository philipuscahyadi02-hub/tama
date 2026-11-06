// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pick, matches, validateDeck, GAP_MS } = require('./triggers');
const { createEvents } = require('.');
const { createMemory } = require('../memory');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const DECK = require('../../../../assets/events/deck.json');

/** @param {Partial<import('./triggers').Ctx>} o @returns {import('./triggers').Ctx} */
const ctx = (o = {}) => ({
  now: new Date(2026, 10, 6, 12, 30).getTime(), hour: 12, weekday: 5, md: '11-06',
  pet: { hunger: 80, energy: 80, asleep: false, streak: 0, level: 0 },
  hoursAway: 0, startup: false, levelUp: false, activeMinutes: 10, facts: 0, birthdayMd: '', diaryDone: true,
  random: () => 0.99, ...o,
});
const deck = validateDeck(DECK);
const fresh = () => ({ last: {}, lastAny: 0 });
const opts = { nudges: true, quiet: false };

test('deck: every event is valid and has a fallback line (except the diary)', () => {
  assert.equal(deck.length, DECK.events.length);
  for (const e of deck) if (e.kind !== 'diary') assert.ok(e.lines.length > 0, e.id);
  for (const e of deck) if (e.kind === 'choice') assert.ok(e.choices && e.choices.length >= 2 && e.choices.length <= 3, e.id);
});

test('triggers: time of day, weekday/weekend, late night, absence, stats, dates (EVT-1)', () => {
  assert.equal(pick(deck, ctx(), fresh(), opts)?.id, 'lunch-check');
  assert.equal(pick(deck, ctx({ hour: 8 }), fresh(), opts)?.id, 'good-morning');
  assert.equal(pick(deck, ctx({ hour: 2, activeMinutes: 30 }), fresh(), opts)?.id, 'late-night');
  assert.equal(pick(deck, ctx({ hour: 2, activeMinutes: 0 }), fresh(), opts), null); // asleep at the PC? no
  assert.equal(pick(deck, ctx({ startup: true, hoursAway: 12, hour: 19 }), fresh(), opts)?.id, 'welcome-back');
  assert.equal(pick(deck, ctx({ hour: 19, pet: { hunger: 10, energy: 80, asleep: false, streak: 0, level: 0 } }), fresh(), opts)?.id, 'hungry');
  assert.equal(pick(deck, ctx({ hour: 19, md: '12-25' }), fresh(), opts)?.id, 'christmas');
  assert.equal(matches({ type: 'time', hours: [10, 13], days: 'weekend' }, ctx({ weekday: 6, hour: 11 })), true);
  assert.equal(matches({ type: 'time', hours: [10, 13], days: 'weekend' }, ctx({ weekday: 3, hour: 11 })), false);
});

test('triggers: cooldowns, a 40-minute gap, minBond, quiet mode and nudges toggle', () => {
  const c = ctx();
  assert.equal(pick(deck, c, { last: { 'lunch-check': c.now - 3600000 }, lastAny: 0 }, opts), null);
  assert.equal(pick(deck, c, { last: {}, lastAny: c.now - GAP_MS / 2 }, opts), null);
  const slump = ctx({ hour: 15, weekday: 2 });
  assert.equal(pick(deck, slump, fresh(), opts), null); // afternoon-slump needs bond level 1
  assert.equal(pick(deck, { ...slump, pet: { ...slump.pet, level: 1 } }, fresh(), opts)?.id, 'afternoon-slump');
  assert.equal(pick(deck, c, fresh(), { nudges: true, quiet: true }), null); // focus / dnd / away
  const long = ctx({ hour: 19, activeMinutes: 130 });
  assert.equal(pick(deck, long, fresh(), opts)?.id, 'water');
  assert.notEqual(pick(deck, long, fresh(), { nudges: false, quiet: false })?.kind, 'nudge');
  // the diary is written quietly even in quiet mode
  assert.equal(pick(deck, ctx({ hour: 22, diaryDone: false }), fresh(), { nudges: true, quiet: true })?.id, 'diary');
});

// ---------------- service ----------------
function setup({ compose = /** @type {any} */ (null) } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-ev-'));
  const store = createStore(dir);
  const bus = new Bus();
  const T0 = new Date(2026, 10, 6, 12, 30).getTime();
  let t = T0;
  /** @type {any} */ const pet = { state: { hunger: 80, energy: 80, happy: 80, bornAt: T0 - 86400000, streak: { count: 0 } }, level: { index: 0, title: 'Stranger' }, hoursAway: 0 };
  /** @type {any[]} */ const calls = [];
  bus.handle('pet.get', () => pet);
  bus.handle('prod.get', () => ({ todos: [{ text: 'write tests', done: true, doneAt: T0 }], focus: { phase: 'idle' } }));
  bus.handle('ui.prefs.get', () => ({ dnd: false, nudges: true }));
  bus.handle('pet.award', (p) => { calls.push(['award', p.source]); return { gained: 1 }; });
  bus.handle('pet.act', (p) => { calls.push(['act', p.action]); return { ok: true }; });
  bus.handle('brain.compose', (p) => (compose ? compose(p) : null));
  /** @type {any[]} */ const chat = [];
  bus.handle('chat.push', (p) => { chat.push(p); });
  bus.handle('chat.history', () => ({ messages: [{ role: 'user', text: 'I have an exam friday', at: T0 }] }));
  const memory = createMemory({ bus, store, tamaId: 't1', now: () => t });
  const stopMem = memory.start();
  const ev = createEvents({ bus, store, tamaId: 't1', deck: DECK, now: () => t, random: () => 0.99 });
  const stopEv = ev.start();
  /** @type {any[]} */ const shown = [];
  bus.on('event.shown', (p) => shown.push(p));
  return { bus, ev, memory, shown, calls, chat, store, pet, setT: (/** @type {number} */ v) => { t = v; }, T0, stop: () => { stopEv(); stopMem(); } };
}

test('events: a choice shows on the pet and in chat; answering awards bond and can create a memory (EVT-2/4)', async () => {
  const s = setup({ compose: () => 'did you eat lunch yet, nya? 🍙' });
  await s.ev.tick();
  assert.equal(s.shown[0].id, 'lunch-check');
  assert.equal(s.shown[0].text, 'did you eat lunch yet, nya? 🍙');
  assert.deepEqual(s.shown[0].choices, ['Yes, I ate!', 'Not yet…']);
  assert.deepEqual(s.chat[0], { role: 'tama', text: 'did you eat lunch yet, nya? 🍙' });
  const r = await s.bus.request('events.answer', { id: 'lunch-check', choice: 0 });
  assert.equal(r.ok, true);
  assert.deepEqual(s.calls, [['award', 'event']]);
  assert.equal(s.shown[1].kind, 'reply');
  assert.equal((await s.bus.request('events.answer', { id: 'lunch-check', choice: 0 })).error, 'That moment has passed~');
  // a this-or-that answer is remembered
  const t2 = await s.bus.request('events.trigger', { id: 'random-question' });
  assert.equal(t2.ok, true);
  await s.bus.request('events.answer', { id: 'random-question', choice: 1 });
  assert.equal(s.memory.facts()[0].text, 'prefers dogs over cats');
  s.stop();
});

test('events: deck lines are the fallback when the chat brain is unavailable; quests run the pet action', async () => {
  const s = setup();
  s.pet.state.hunger = 5;
  s.setT(new Date(2026, 10, 6, 19, 0).getTime());
  await s.ev.tick();
  assert.equal(s.shown[0].id, 'hungry');
  assert.equal(s.shown[0].text, 'my tummy is rumbling so loud… food pls? 🍙🥺');
  assert.equal(s.shown[0].quest, 'Feed 🍙');
  await s.bus.request('events.answer', { id: 'hungry', choice: 0 });
  assert.deepEqual(s.calls, [['act', 'feed']]);
  s.stop();
});

test('diary: written once in the evening from the day, readable later; survives a restart', async () => {
  /** @type {any[]} */ const seeds = [];
  const s = setup({ compose: (/** @type {any} */ p) => { seeds.push(p); return 'Dear diary, we wrote tests today!'; } });
  s.setT(new Date(2026, 10, 6, 22, 0).getTime());
  s.pet.state.asleep = true; // quiet, but the diary is still written
  await s.ev.tick();
  assert.equal(seeds[0].kind, 'diary');
  assert.match(seeds[0].seed, /write tests/);
  assert.match(seeds[0].seed, /exam friday/);
  const page = await s.bus.request('diary.read', {});
  assert.equal(page.day, '2026-11-06');
  assert.match(page.text, /Dear diary/);
  await s.ev.tick();
  assert.equal(seeds.length, 1); // once per day
  s.stop();
  assert.equal(s.store.read('tamas/t1/events.json', 'events', () => ({})).diaryDay, '2026-11-06');
});

test('memory: add (deduped), list, forget by number or all (EVT-4, NFR-4)', async () => {
  const s = setup();
  assert.equal((await s.bus.request('memory.add', { text: 'Has a cat named Mochi' })).ok, true);
  assert.equal((await s.bus.request('memory.add', { text: 'has a cat named mochi!' })).duplicate, true);
  await s.bus.request('memory.add', { text: 'Works as a nurse' });
  assert.equal((await s.bus.request('memory.add', { text: 'x' })).error !== undefined, true);
  assert.deepEqual((await s.bus.request('memory.get')).facts.map((/** @type {any} */ f) => f.text), ['Has a cat named Mochi', 'Works as a nurse']);
  assert.equal((await s.bus.request('memory.forget', { ref: '1' })).fact.text, 'Has a cat named Mochi');
  assert.equal((await s.bus.request('memory.forget', { ref: 'all' })).removed, 1);
  assert.deepEqual(s.store.read('tamas/t1/memory/facts.json', 'memory', () => ({})).facts, []);
  s.stop();
});
