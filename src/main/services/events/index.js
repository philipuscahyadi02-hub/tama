// @ts-check
// Events (EVT-1..3, PET-6/7, D-033): once a minute, look at the day, her stats and your activity, pick an event
// from the deck (assets/events/deck.json), ask the chat brain for an in-character line, and show it on the pet
// (and in the chat history). Answers can grow the bond, feed her, or become memories. Also writes the daily diary.
const { TOPICS } = require('../../bus-topics');
const { pick, validateDeck } = require('./triggers');
const { dayOf } = require('../pet/bond');

const TICK_MS = 60000;
const SHOW_MS = 5 * 60000; // an unanswered event expires after this
const LOG_MAX = 40;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance, store: import('../../platform/store').Store, tamaId: string,
 *   deck: any, now?: () => number, random?: () => number,
 * }} deps
 */
function createEvents({ bus, store, tamaId, deck: rawDeck, now = Date.now, random = Math.random }) {
  const deck = validateDeck(rawDeck);
  const file = `tamas/${tamaId}/events.json`;
  /** @type {{ last: Record<string, number>, lastAny: number, diaryDay: string, log: Array<{ day: string, text: string }> }} */
  let st = { last: {}, lastAny: 0, diaryDay: '', log: [], ...store.read(file, 'events', () => ({})) };
  const save = () => store.writeSoon(file, 'events', () => st, 1000);

  let startup = true;
  let levelUp = false;
  let idle = false;
  let activeSince = now();
  let busy = false;
  /** @type {{ event: import('./triggers').TamaEvent, shownAt: number } | null} */
  let active = null;

  /** @param {string} text */
  const logLine = (text) => { st.log = [...st.log, { day: dayOf(now()), text }].slice(-LOG_MAX); save(); };
  const req = (/** @type {string} */ topic, /** @type {any} */ p = undefined) => bus.request(topic, p).catch(() => null);

  async function context() {
    const [pet, prod, mem, ui] = await Promise.all([req(TOPICS.PET_GET), req(TOPICS.PROD_GET), req(TOPICS.MEMORY_GET), req(TOPICS.UI_PREFS_GET)]);
    // M5 extras (D-035): weather (cached, may be null) and fullscreen DND, one query each per tick.
    const [wx, fullscreen] = await Promise.all([req(TOPICS.WEATHER_GET), req(TOPICS.DEVICE_FULLSCREEN_GET)]);
    const t = now();
    const d = new Date(t);
    const s = (pet && pet.state) || {};
    const born = s.bornAt ? new Date(s.bornAt) : null;
    /** @type {import('./triggers').Ctx} */
    const ctx = {
      now: t, hour: d.getHours(), weekday: d.getDay(), md: dayOf(t).slice(5),
      pet: { hunger: s.hunger ?? 100, energy: s.energy ?? 100, asleep: !!s.asleep, streak: (s.streak && s.streak.count) || 0, level: (pet && pet.level && pet.level.index) || 0 },
      hoursAway: (pet && pet.hoursAway) || 0, startup, levelUp,
      activeMinutes: idle ? 0 : (t - activeSince) / 60000,
      facts: ((mem && mem.facts) || []).length,
      birthdayMd: born && born.getFullYear() < d.getFullYear() ? dayOf(born.getTime()).slice(5) : '',
      diaryDone: st.diaryDay === dayOf(t), random,
      weather: (wx && wx.current) || null,
    };
    const quiet = !!(ui && ui.dnd) || idle || !!(prod && prod.focus && prod.focus.phase === 'focus') || ctx.pet.asleep || !!(pet && pet.egg)
      || fullscreen === true; // PET-6: a game, video or slideshow fills the screen
    return { ctx, quiet, nudges: !(ui && ui.nudges === false), pet, prod, mem };
  }

  async function tick() {
    if (busy) return;
    if (active && now() - active.shownAt > SHOW_MS) active = null;
    if (active) return; // one open event at a time
    busy = true;
    try {
      const c = await context();
      const e = pick(deck, c.ctx, st, { nudges: c.nudges, quiet: c.quiet });
      startup = false;
      if (e) await fire(e, c);
    } finally { busy = false; }
  }

  /** @param {import('./triggers').TamaEvent} e @param {any} c */
  async function fire(e, c) {
    st.last = { ...st.last, [e.id]: now() };
    if (e.kind !== 'nudge' && e.kind !== 'diary') st.lastAny = now();
    if (e.trigger.type === 'levelUp') levelUp = false;
    save();
    if (e.kind === 'diary') return writeDiary(c);
    let seed = e.seed;
    if (e.kind === 'callback') {
      const facts = (c.mem && c.mem.facts) || [];
      if (!facts.length) return;
      seed += `\nWhat you remember: "${facts[Math.floor(random() * facts.length)].text}"`;
    }
    // Choice/quest buttons are fixed, so the line must ask exactly the question the buttons answer.
    const buttons = e.choices ? e.choices.map((ch) => ch.label) : e.quest ? [e.quest.label] : [];
    if (buttons.length) seed += `
The user will answer with these buttons: ${buttons.join(' / ')}. Your line must fit them exactly (same question, same options).`;
    const fallback = e.lines.length ? e.lines[Math.floor(random() * e.lines.length)] : '…';
    const text = (await req(TOPICS.BRAIN_COMPOSE, { kind: 'line', seed })) || fallback;
    active = { event: e, shownAt: now() };
    const show = {
      id: e.id, kind: e.kind, text,
      choices: (e.choices || []).map((ch) => ch.label),
      quest: e.quest ? e.quest.label : null,
    };
    bus.emit(TOPICS.EVENT_SHOWN, show);
    bus.request(TOPICS.CHAT_PUSH, { role: 'tama', text }).catch(() => null);
    logLine(`${e.kind === 'nudge' ? 'nudged' : 'said'}: ${text}`);
  }

  /** @param {{ id: string, choice?: number, dismiss?: boolean }} p */
  async function answer(p) {
    if (!active || active.event.id !== p.id) return { error: 'That moment has passed~' };
    const e = active.event;
    active = null;
    if (p.dismiss) { logLine('(you were busy)'); return { ok: true }; }
    /** @type {{ label: string, reply: string, bond?: number, remember?: string, action?: string, source?: string } | undefined} */
    const opt = e.choices ? e.choices[Number(p.choice)] : e.quest;
    if (!opt) return { error: 'No such choice.' };
    if (opt.action) await req(TOPICS.PET_ACT, { action: opt.action });
    if ((opt.bond || 0) > 0) await req(TOPICS.PET_AWARD, { source: opt.source || (e.kind === 'nudge' ? 'nudge' : 'event') });
    if (opt.remember) await req(TOPICS.MEMORY_ADD, { text: opt.remember, source: 'event' });
    bus.request(TOPICS.CHAT_PUSH, { role: 'user', text: opt.label }).catch(() => null);
    bus.request(TOPICS.CHAT_PUSH, { role: 'tama', text: opt.reply }).catch(() => null);
    bus.emit(TOPICS.EVENT_SHOWN, { id: e.id, kind: 'reply', text: opt.reply, choices: [], quest: null });
    logLine(`you answered "${opt.label}"`);
    return { ok: true, reply: opt.reply };
  }

  /** The diary: a short first-person entry about the day, written by the chat brain from what happened. */
  async function writeDiary(/** @type {any} */ c) {
    const today = dayOf(now());
    const s = (c.pet && c.pet.state) || {};
    const todos = ((c.prod && c.prod.todos) || []).filter((/** @type {any} */ t) => t.done && t.doneAt && dayOf(t.doneAt) === today);
    const chat = (await req(TOPICS.CHAT_HISTORY)) || { messages: [] };
    const talked = chat.messages.filter((/** @type {any} */ m) => m.role === 'user' && dayOf(m.at) === today).map((/** @type {any} */ m) => m.text.slice(0, 80));
    const facts = [
      `my stats tonight: tummy ${Math.round(s.hunger || 0)}, mood ${Math.round(s.happy || 0)}, energy ${Math.round(s.energy || 0)}`,
      c.pet && c.pet.level ? `our bond: ${c.pet.level.title}${s.streak && s.streak.count > 1 ? `, ${s.streak.count}-day streak` : ''}` : '',
      todos.length ? `todos the user finished today: ${todos.map((/** @type {any} */ t) => t.text).slice(0, 6).join('; ')}` : 'no todos finished today',
      talked.length ? `things the user said to me today: ${talked.slice(-6).join(' | ')}` : 'we did not chat much today',
      ...st.log.filter((l) => l.day === today).slice(-8).map((l) => `moment: ${l.text}`),
    ].filter(Boolean).join('\n');
    const text = (await req(TOPICS.BRAIN_COMPOSE, { kind: 'diary', seed: facts }))
      || `Today was a ${todos.length ? 'busy' : 'quiet'} day. ${todos.length ? `You finished ${todos.length} todo${todos.length === 1 ? '' : 's'}! ` : ''}I'm glad we're together~`;
    await req(TOPICS.DIARY_WRITE, { day: today, text });
    st.diaryDay = today;
    save();
    bus.emit(TOPICS.BRAIN_NOTICE, { text: 'I wrote in my diary tonight~ 📔 (/diary)', kind: 'info' });
  }

  /** /event: show an event now (ignores cooldowns). @param {{ id?: string }} p */
  async function trigger(p) {
    const pool = deck.filter((e) => (p.id ? e.id === p.id : ['chat', 'choice'].includes(e.kind) && e.trigger.type === 'random'));
    if (!pool.length) return { error: `No such event. Try one of: ${deck.map((e) => e.id).join(', ')}` };
    if (active) return { error: 'One thing at a time~ answer my last question first!' };
    const c = await context();
    await fire(pool[Math.floor(random() * pool.length)], c);
    return { ok: true };
  }

  function start() {
    const timer = setInterval(() => { tick().catch((e) => bus.emit(TOPICS.APP_ERROR, { topic: 'events.tick', message: String(e.message || e) })); }, TICK_MS);
    const offs = [
      bus.handle(TOPICS.EVENTS_ANSWER, (/** @type {any} */ p) => answer(p || {})),
      bus.handle(TOPICS.EVENTS_TRIGGER, (/** @type {any} */ p) => trigger(p || {})),
      bus.on(TOPICS.PET_BOND_CHANGED, (/** @type {any} */ b) => { if (b && b.levelUp) levelUp = true; }),
      bus.on(TOPICS.DEVICE_IDLE_CHANGED, (/** @type {any} */ p) => { idle = !!(p && p.idle); if (!idle) activeSince = now(); }),
    ];
    // First look shortly after start, so "welcome back" greets you on launch.
    const first = setTimeout(() => { tick().catch(() => null); }, 15000);
    return () => { clearInterval(timer); clearTimeout(first); for (const off of offs) off(); store.flush(); };
  }

  return { start, tick, answer, trigger, writeDiary: async () => writeDiary(await context()), state: () => st };
}

module.exports = { createEvents };
