// @ts-check
// Memory (EVT-4, NFR-4, D-033): facts the Tama remembers about the user, and her daily diary.
// Lives in tamas/<id>/memory/ so it travels with the Tama (.tama export) and stays local.
const { TOPICS } = require('../../bus-topics');

const MAX_FACTS = 100;
const MAX_FACT_LEN = 200;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @typedef {{ id: string, text: string, at: number, source: 'chat'|'user'|'event' }} Fact */

/**
 * @param {{ bus: import('../../bus').BusInstance, store: import('../../platform/store').Store, tamaId: string, now?: () => number }} deps
 */
function createMemory({ bus, store, tamaId, now = Date.now }) {
  const dir = `tamas/${tamaId}/memory`;
  const factsFile = `${dir}/facts.json`;
  /** @type {{ facts: Fact[] }} */
  let data = store.read(factsFile, 'memory', () => ({ facts: [] }));
  if (!Array.isArray(data.facts)) data = { facts: [] };
  let seq = 0;

  const save = () => { store.write(factsFile, 'memory', data); bus.emit(TOPICS.MEMORY_CHANGED, { facts: data.facts }); };
  const norm = (/** @type {string} */ t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  /** @param {{ text: string, source?: Fact['source'] }} p */
  function add({ text, source = 'user' }) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_FACT_LEN);
    if (clean.length < 3) return { error: 'Tell me a bit more than that~' };
    const n = norm(clean);
    if (data.facts.some((f) => norm(f.text) === n)) return { ok: true, duplicate: true, facts: data.facts };
    const fact = { id: `f${now().toString(36)}${(seq++).toString(36)}`, text: clean, at: now(), source };
    data = { facts: [...data.facts, fact].slice(-MAX_FACTS) };
    save();
    return { ok: true, fact, facts: data.facts };
  }

  /** @param {{ ref: string|number }} p  1-based index, fact id, or 'all' */
  function forget({ ref }) {
    if (ref === 'all') { const n = data.facts.length; data = { facts: [] }; save(); return { ok: true, removed: n, facts: [] }; }
    const i = typeof ref === 'number' || /^\d+$/.test(String(ref)) ? Number(ref) - 1 : data.facts.findIndex((f) => f.id === ref);
    if (i < 0 || i >= data.facts.length) return { error: 'No such memory.' };
    const [gone] = data.facts.splice(i, 1);
    data = { facts: [...data.facts] };
    save();
    return { ok: true, removed: 1, fact: gone, facts: data.facts };
  }

  // ---- diary ----
  /** @param {{ day: string, text: string }} p */
  function writeDiary({ day, text }) {
    if (!DAY_RE.test(day)) return { error: 'bad day' };
    store.writeText(`${dir}/diary/${day}.md`, `# ${day}\n\n${String(text).trim()}\n`);
    return { ok: true, day };
  }
  function listDiary() {
    return store.listFiles(`${dir}/diary`).map((f) => f.replace(/\.md$/, '')).filter((d) => DAY_RE.test(d)).sort().reverse();
  }
  /** @param {{ day?: string }} p */
  function readDiary({ day } = {}) {
    const days = listDiary();
    const d = day && DAY_RE.test(day) ? day : days[0];
    if (!d || !days.includes(d)) return { error: days.length ? 'No diary page for that day.' : 'No diary pages yet. I write one every evening~' };
    return { day: d, text: store.readText(`${dir}/diary/${d}.md`) || '', days };
  }

  function start() {
    const offs = [
      bus.handle(TOPICS.MEMORY_GET, () => ({ facts: data.facts })),
      bus.handle(TOPICS.MEMORY_ADD, (/** @type {any} */ p) => add(p || {})),
      bus.handle(TOPICS.MEMORY_FORGET, (/** @type {any} */ p) => forget(p || {})),
      bus.handle(TOPICS.DIARY_WRITE, (/** @type {any} */ p) => writeDiary(p || {})),
      bus.handle(TOPICS.DIARY_LIST, () => ({ days: listDiary() })),
      bus.handle(TOPICS.DIARY_READ, (/** @type {any} */ p) => readDiary(p || {})),
    ];
    return () => { for (const off of offs) off(); };
  }

  return { start, add, forget, facts: () => data.facts, writeDiary, listDiary, readDiary };
}

module.exports = { createMemory };
