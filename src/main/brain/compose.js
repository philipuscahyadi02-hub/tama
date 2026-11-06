// @ts-check
// Composer (EVT-3, D-033): one-shot in-character text for events and the diary. Uses its own agy session
// (read-only plan mode, like chat) so event prompts never clutter the user's chat conversation.
// Returns null when agy is unavailable or slow; callers then use the deck's fallback lines.
const fs = require('fs');

const TIMEOUT_MS = 40000;
/** Restart the session now and then so its context stays small. */
const MAX_TURNS = 15;

const PROMPTS = {
  line: (/** @type {string} */ seed) => `[event] Write ONE short line (max 30 words) that you say to the user right now, in character.
Situation: ${seed}
Reply with the line only: no quotes, no stage directions, no tools.`,
  diary: (/** @type {string} */ seed) => `[diary] Write tonight's diary entry in first person, in character: 60-120 words, warm and cute,
about the day with the user. Use only these facts (don't invent big events):
${seed}
Reply with the entry text only (no title, no date, no tools).`,
};

/**
 * @param {{
 *   factory: (emit: (ev: any) => void, persona: string) => import('./index').Engine,
 *   scratchDir: string, available: () => boolean, persona: () => string,
 * }} deps
 */
function createComposer({ factory, scratchDir, available, persona }) {
  /** @type {import('./index').Engine | null} */
  let engine = null;
  let turns = 0;
  /** @type {{ text: string, done: (t: string | null) => void } | null} */
  let pending = null;
  let queue = Promise.resolve();

  /** @param {any} ev */
  function onEvent(ev) {
    if (!pending) return;
    if (ev.t === 'text-delta') pending.text += ev.text;
    else if (ev.t === 'result') { const p = pending; pending = null; p.done(ev.isError ? null : clean(p.text)); }
  }

  function get() {
    if (engine && turns >= MAX_TURNS) { engine.stop(); engine = null; }
    if (!engine) {
      fs.mkdirSync(scratchDir, { recursive: true });
      engine = factory(onEvent, persona()); engine.setCwd(scratchDir); turns = 0;
    }
    return engine;
  }

  /** @param {{ kind?: 'line'|'diary', seed: string }} p @returns {Promise<string | null>} */
  function compose({ kind = 'line', seed }) {
    if (!available()) return Promise.resolve(null);
    const run = () => new Promise((resolve) => {
      const e = get();
      turns++;
      const timer = setTimeout(() => { if (pending) { pending = null; e.interrupt(); resolve(null); } }, TIMEOUT_MS);
      pending = { text: '', done: (t) => { clearTimeout(timer); resolve(t); } };
      Promise.resolve(e.send((PROMPTS[kind] || PROMPTS.line)(String(seed || '').slice(0, 2000)))).catch(() => {
        if (pending) { pending = null; clearTimeout(timer); resolve(null); }
      });
    });
    // One composition at a time on the shared session.
    const p = queue.then(run, run);
    queue = p.then(() => undefined, () => undefined);
    return /** @type {Promise<string | null>} */ (p);
  }

  /** @param {string} p */
  function setPersona(p) { if (engine && engine.setPersona) engine.setPersona(p); }
  function stop() { if (engine) { engine.stop(); engine = null; } }

  return { compose, setPersona, stop };
}

/** Strip wrapping quotes and any marker lines the model may add. @param {string} t */
function clean(t) {
  const s = String(t || '').replace(/\[\[[^\]]*\]\]/g, '').trim().replace(/^["“'](.*)["”']$/s, '$1').trim();
  return s || null;
}

module.exports = { createComposer, clean };
