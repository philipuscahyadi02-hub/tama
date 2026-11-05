// @ts-check
// Productivity (PROD-1): todos, notes, reminders and a focus timer (pomodoro), shared by every channel
// (desktop now, Telegram in M7) through the bus. Finishing things earns bond XP (BOND-1).
// Stored in user/productivity.json: it belongs to the user, not to a particular Tama (D-024).
const { TOPICS } = require('../../bus-topics');
const { parseWhen, describe } = require('./when');

const FILE = 'user/productivity.json';
const CHECK_MS = 5000;
const MAX_ITEMS = 500;

/**
 * @typedef {{ id: string, text: string, done: boolean, createdAt: number, doneAt: number }} Todo
 * @typedef {{ id: string, text: string, at: number }} Note
 * @typedef {{ id: string, text: string, at: number, firedAt: number }} Reminder
 * @typedef {{ phase: 'idle'|'focus'|'break', startedAt: number, endsAt: number, minutes: number, breakMinutes: number }} Focus
 */

/**
 * @param {{ bus: import('../../bus').BusInstance, store: import('../../platform/store').Store, now?: () => number }} deps
 */
function createProductivity({ bus, store, now = Date.now }) {
  /** @type {{ todos: Todo[], notes: Note[], reminders: Reminder[], focus: Focus }} */
  let data = store.read(FILE, 'productivity', () => ({}));
  data = {
    todos: data.todos || [], notes: data.notes || [], reminders: data.reminders || [],
    focus: data.focus || { phase: 'idle', startedAt: 0, endsAt: 0, minutes: 25, breakMinutes: 5 },
  };
  let seq = 0;
  const id = () => `${now().toString(36)}${(seq++).toString(36)}`;

  const snapshot = () => ({
    todos: data.todos.filter((t) => !t.done || now() - t.doneAt < 24 * 3600000), // done ones linger a day
    notes: data.notes.slice(-50),
    reminders: data.reminders.filter((r) => !r.firedAt).sort((a, b) => a.at - b.at),
    focus: data.focus,
  });
  function changed() {
    store.writeSoon(FILE, 'productivity', () => data, 800);
    bus.emit(TOPICS.PROD_CHANGED, snapshot());
  }
  /** @param {unknown} t @param {number} max */
  const text = (t, max) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, max);

  // ---------------- todos ----------------
  /** @param {{text: string}} p */
  function addTodo(p) {
    const t = text(p.text, 200);
    if (!t) return { error: 'Empty todo.' };
    const todo = { id: id(), text: t, done: false, createdAt: now(), doneAt: 0 };
    data.todos = [...data.todos, todo].slice(-MAX_ITEMS);
    changed();
    return { ok: true, todo };
  }
  /** Accepts an id or a 1-based number from the open list. @param {{ref: string|number}} p */
  async function doneTodo(p) {
    const open = data.todos.filter((t) => !t.done);
    const n = Number(p.ref);
    const todo = Number.isInteger(n) && n >= 1 && n <= open.length ? open[n - 1] : data.todos.find((t) => t.id === p.ref);
    if (!todo || todo.done) return { error: 'No such open todo.' };
    todo.done = true; todo.doneAt = now();
    changed();
    const award = await bus.request(TOPICS.PET_AWARD, { source: 'todo' });
    return { ok: true, todo, gained: award.gained };
  }
  /** @param {{ref: string|number}} p */
  function removeTodo(p) {
    const open = data.todos.filter((t) => !t.done);
    const n = Number(p.ref);
    const todo = Number.isInteger(n) && n >= 1 && n <= open.length ? open[n - 1] : data.todos.find((t) => t.id === p.ref);
    if (!todo) return { error: 'No such todo.' };
    data.todos = data.todos.filter((t) => t !== todo);
    changed();
    return { ok: true };
  }

  // ---------------- notes ----------------
  /** @param {{text: string}} p */
  function addNote(p) {
    const t = text(p.text, 1000);
    if (!t) return { error: 'Empty note.' };
    const note = { id: id(), text: t, at: now() };
    data.notes = [...data.notes, note].slice(-MAX_ITEMS);
    changed();
    return { ok: true, note };
  }

  // ---------------- reminders ----------------
  /** `input` is natural ("in 10m stretch", "3pm call mom"); or pass `at` + `text`. @param {{input?: string, at?: number, text?: string}} p */
  function addReminder(p) {
    const parsed = p.input != null ? parseWhen(p.input, now()) : (p.at ? { at: Number(p.at), text: text(p.text, 200) } : null);
    if (!parsed) return { error: 'I did not understand the time. Try "in 10m …", "at 15:30 …", "3pm …" or "tomorrow 9am …".' };
    if (parsed.at <= now()) return { error: 'That time is in the past.' };
    const r = { id: id(), text: text(parsed.text, 200) || 'reminder!', at: parsed.at, firedAt: 0 };
    data.reminders = [...data.reminders, r].slice(-MAX_ITEMS);
    changed();
    return { ok: true, reminder: r, when: describe(r.at, now()) };
  }
  /** @param {{id: string}} p */
  function cancelReminder(p) {
    const before = data.reminders.length;
    data.reminders = data.reminders.filter((r) => r.id !== p.id);
    if (data.reminders.length === before) return { error: 'No such reminder.' };
    changed();
    return { ok: true };
  }

  // ---------------- focus timer ----------------
  /** @param {{minutes?: number, breakMinutes?: number}} p */
  function startFocus(p = {}) {
    const minutes = Math.max(1, Math.min(180, Math.round(Number(p.minutes) || 25)));
    const breakMinutes = Math.max(0, Math.min(60, Math.round(Number(p.breakMinutes ?? 5))));
    data.focus = { phase: 'focus', startedAt: now(), endsAt: now() + minutes * 60000, minutes, breakMinutes };
    changed();
    bus.emit(TOPICS.PROD_FOCUS_PHASE, { phase: 'focus', endsAt: data.focus.endsAt, minutes });
    return { ok: true, focus: data.focus };
  }
  function stopFocus() {
    const was = data.focus.phase;
    data.focus = { ...data.focus, phase: 'idle', endsAt: 0 };
    changed();
    bus.emit(TOPICS.PROD_FOCUS_PHASE, { phase: 'idle', stopped: was !== 'idle' });
    return { ok: true };
  }

  /** Runs every few seconds: fire due reminders, advance the focus timer. */
  async function check() {
    const t = now();
    for (const r of data.reminders) {
      if (!r.firedAt && r.at <= t) {
        r.firedAt = t;
        changed();
        bus.emit(TOPICS.PROD_REMINDER_DUE, { id: r.id, text: r.text, late: t - r.at > 5 * 60000 });
      }
    }
    const f = data.focus;
    if (f.phase === 'focus' && t >= f.endsAt) {
      const award = await bus.request(TOPICS.PET_AWARD, { source: 'focus' });
      if (f.breakMinutes > 0) {
        data.focus = { ...f, phase: 'break', startedAt: t, endsAt: t + f.breakMinutes * 60000 };
        await bus.request(TOPICS.PET_ACT, { action: 'focus-break' }).catch(() => null); // energy treat (PET-3)
      } else data.focus = { ...f, phase: 'idle', endsAt: 0 };
      changed();
      bus.emit(TOPICS.PROD_FOCUS_PHASE, { phase: data.focus.phase, completed: true, gained: award.gained, endsAt: data.focus.endsAt });
    } else if (f.phase === 'break' && t >= f.endsAt) {
      data.focus = { ...f, phase: 'idle', endsAt: 0 };
      changed();
      bus.emit(TOPICS.PROD_FOCUS_PHASE, { phase: 'idle', breakOver: true });
    }
  }

  /** @type {NodeJS.Timeout | null} */
  let timer = null;
  function start() {
    const offs = [
      bus.handle(TOPICS.PROD_GET, () => snapshot()),
      bus.handle(TOPICS.PROD_TODO_ADD, addTodo),
      bus.handle(TOPICS.PROD_TODO_DONE, doneTodo),
      bus.handle(TOPICS.PROD_TODO_REMOVE, removeTodo),
      bus.handle(TOPICS.PROD_NOTE_ADD, addNote),
      bus.handle(TOPICS.PROD_REMIND_ADD, addReminder),
      bus.handle(TOPICS.PROD_REMIND_CANCEL, cancelReminder),
      bus.handle(TOPICS.PROD_FOCUS_START, startFocus),
      bus.handle(TOPICS.PROD_FOCUS_STOP, stopFocus),
    ];
    timer = setInterval(() => { check().catch((e) => bus.emit(TOPICS.APP_ERROR, { topic: 'productivity', message: String(e.message || e) })); }, CHECK_MS);
    return () => {
      if (timer) clearInterval(timer);
      for (const off of offs) off();
      store.write(FILE, 'productivity', data);
    };
  }

  return { start, check, snapshot };
}

module.exports = { createProductivity };
