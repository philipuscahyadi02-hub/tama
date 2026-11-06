// @ts-check
// Chat with your Tama (CHAT-1, D-029): the chat window, the pet bubble and (M7) Telegram talk to this.
// agy only: Gemini Flash in read-only plan mode (D-027), with web search. No Claude tokens, no fallback.
const fs = require('fs');
const { TOPICS } = require('../bus-topics');
const persona = require('./persona');

/** Keep this many messages for the chat window (in memory; long-term memory is M5). */
const HISTORY_MAX = 200;

/** @typedef {{ role: 'user'|'tama'|'note', text: string, at: number, tools?: string[] }} ChatMessage */

/**
 * @param {{
 *   bus: import('../bus').BusInstance,
 *   scratchDir: string,
 *   available: () => boolean,
 *   factory: (emit: (ev: any) => void, persona: string) => import('./index').Engine,
 *   onResult?: (ev: any) => void,
 *   now?: () => number,
 * }} deps
 */
function createChat({ bus, scratchDir, available, factory, onResult = () => {}, now = Date.now }) {
  /** @type {ChatMessage[]} */
  const history = [];
  /** @type {import('./index').Engine | null} */
  let engine = null;
  let personaText = '';
  let reply = { text: '', tools: /** @type {string[]} */ ([]) };

  /** @param {any} ev */
  const out = (ev) => bus.emit(TOPICS.CHAT_EVENT, ev);
  /** @param {ChatMessage} m */
  function push(m) {
    history.push(m);
    if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);
    out({ t: 'message', message: m });
  }

  /** @param {any} ev */
  function onEngineEvent(ev) {
    switch (ev.t) {
      case 'text-delta': reply.text += ev.text; out({ t: 'delta', text: ev.text }); break;
      case 'tool':
        // agy's web search shows as a little "searching…" line; nothing else should run in plan mode.
        reply.tools.push(describeTool(ev));
        out({ t: 'tool', text: describeTool(ev) });
        break;
      case 'status': out({ t: 'status', state: ev.state }); break;
      case 'error': out({ t: 'error', message: ev.message }); break;
      case 'result': {
        onResult(ev);
        const text = reply.text.trim()
          || (ev.isError ? 'uu… my brain glitched. Can you say that again? (agy error)' : 'hmm… I lost my words. Ask me again?');
        push({ role: 'tama', text, at: now(), tools: reply.tools.length ? reply.tools : undefined });
        reply = { text: '', tools: [] };
        out({ t: 'done', isError: !!ev.isError });
        break;
      }
      default: break; // session/init/mode/model housekeeping stays inside the engine
    }
  }

  function getEngine() {
    if (!engine) {
      fs.mkdirSync(scratchDir, { recursive: true });
      engine = factory(onEngineEvent, personaText);
      engine.setCwd(scratchDir);
    }
    return engine;
  }

  /** @param {string} raw */
  async function send(raw) {
    const text = String(raw || '').trim().slice(0, 4000);
    if (!text) return { ok: false };
    push({ role: 'user', text, at: now() });
    if (!available()) {
      push({ role: 'note', text: 'Chat needs the Antigravity CLI (agy). Install it and log in once, then restart Tama. Coding work still works in the terminal (Ctrl+Alt+K).', at: now() });
      out({ t: 'done', isError: true });
      return { ok: false, error: 'agy-missing' };
    }
    const e = getEngine();
    if (e.busy) { push({ role: 'note', text: 'one at a time~ I\'m still answering.', at: now() }); return { ok: false }; }
    reply = { text: '', tools: [] };
    const [pet, prod] = await Promise.all([
      bus.request(TOPICS.PET_GET).catch(() => null),
      bus.request(TOPICS.PROD_GET).catch(() => null),
    ]);
    e.send(`${persona.statusLine(pet, prod)}\n${text}`);
    return { ok: true };
  }

  function stopEngine() { if (engine) { engine.stop(); engine = null; } }

  function start() {
    const offs = [
      bus.handle(TOPICS.CHAT_SEND, (/** @type {string} */ t) => send(t)),
      bus.handle(TOPICS.CHAT_HISTORY, () => ({ messages: history.slice(), busy: !!(engine && engine.busy), available: available() })),
      bus.handle(TOPICS.CHAT_INTERRUPT, () => engine && engine.busy && engine.interrupt()),
      bus.handle(TOPICS.CHAT_CLEAR, () => { stopEngine(); history.length = 0; out({ t: 'cleared' }); }),
    ];
    return () => { for (const off of offs) off(); stopEngine(); };
  }

  /** @param {string} p */
  function setPersona(p) {
    personaText = p;
    if (engine && engine.setPersona) engine.setPersona(p);
  }

  return { start, send, setPersona, history: () => history.slice() };
}

/** @param {any} ev */
function describeTool(ev) {
  const i = ev.input || {};
  if (/search/i.test(ev.name)) return `🔎 searched the web: ${String(i.query || i.Query || '').slice(0, 80)}`;
  if (/read|view|fetch|url/i.test(ev.name)) return `📖 read ${String(i.url || i.Url || i.path || i.AbsolutePath || '').slice(0, 80)}`;
  return `🔧 ${ev.name}`;
}

module.exports = { createChat };
