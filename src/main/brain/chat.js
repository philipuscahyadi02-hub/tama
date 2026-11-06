// @ts-check
// Chat with your Tama (CHAT-1, D-029): the chat window, the pet bubble and (M7) Telegram talk to this.
// agy only: Gemini Flash in read-only plan mode (D-027), with web search. No Claude tokens, no fallback.
const fs = require('fs');
const { TOPICS } = require('../bus-topics');
const persona = require('./persona');

/** Keep this many messages for the chat window (in memory; facts worth keeping go to memory, D-033). */
const HISTORY_MAX = 200;
/** `[[remember: …]]` markers in a reply become memories and are never shown (EVT-4). */
const REMEMBER_RE = /\[\[\s*remember\s*:\s*([^\]]+?)\s*\]\]/gi;

/** Streaming filter that hides `[[…]]` markers, even when they arrive split across chunks. */
function markerFilter() {
  let hold = '';
  return {
    /** @param {string} t @returns {string} visible text */
    push(t) {
      hold += t;
      let out = '';
      for (;;) {
        const i = hold.indexOf('[[');
        if (i < 0) {
          if (hold.endsWith('[')) { out += hold.slice(0, -1); hold = '['; } else { out += hold; hold = ''; }
          return out;
        }
        out += hold.slice(0, i);
        const j = hold.indexOf(']]', i + 2);
        if (j < 0) { hold = hold.slice(i); return out; }
        hold = hold.slice(j + 2);
      }
    },
    end() { const h = hold; hold = ''; return h.startsWith('[[') ? '' : h; },
  };
}

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
  let reply = { text: '', tools: /** @type {string[]} */ ([]), filter: markerFilter() };
  /** Which memories this agy session already knows (sent as a [memory] line when they change). */
  let memorySig = /** @type {string | null} */ (null); // null = this session hasn't been told yet
  /** Last [google] context line sent to this session (calendar/mail summary, read-only, D-034). */
  let googleSent = '';

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
      case 'text-delta': {
        reply.text += ev.text;
        const visible = reply.filter.push(ev.text);
        if (visible) out({ t: 'delta', text: visible });
        break;
      }
      case 'tool':
        // agy's web search shows as a little "searching…" line; nothing else should run in plan mode.
        reply.tools.push(describeTool(ev));
        out({ t: 'tool', text: describeTool(ev) });
        break;
      case 'status': out({ t: 'status', state: ev.state }); break;
      case 'error': out({ t: 'error', message: ev.message }); break;
      case 'result': {
        onResult(ev);
        const tail = reply.filter.end();
        if (tail) out({ t: 'delta', text: tail });
        const learned = [...reply.text.matchAll(REMEMBER_RE)].map((m) => m[1]).slice(0, 2);
        for (const f of learned) {
          bus.request(TOPICS.MEMORY_ADD, { text: f, source: 'chat' }).catch(() => null);
          reply.tools.push(`📝 I'll remember: ${f}`);
          out({ t: 'tool', text: `📝 I'll remember: ${f}` });
        }
        const text = reply.text.replace(REMEMBER_RE, '').replace(/\[\[[^\]]*\]\]/g, '').trim()
          || (ev.isError ? 'uu… my brain glitched. Can you say that again? (agy error)' : 'hmm… I lost my words. Ask me again?');
        push({ role: 'tama', text, at: now(), tools: reply.tools.length ? reply.tools : undefined });
        reply = { text: '', tools: [], filter: markerFilter() };
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
      memorySig = null;
      googleSent = '';
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
    reply = { text: '', tools: [], filter: markerFilter() };
    const [pet, prod, mem, gctx] = await Promise.all([
      bus.request(TOPICS.PET_GET).catch(() => null),
      bus.request(TOPICS.PROD_GET).catch(() => null),
      bus.request(TOPICS.MEMORY_GET).catch(() => null),
      bus.request(TOPICS.GOOGLE_CONTEXT).catch(() => ''),
    ]);
    let googleLine = '';
    if (gctx && gctx !== googleSent) { googleSent = gctx; googleLine = `${gctx}\n`; }
    const facts = (mem && mem.facts) || [];
    const sig = facts.map((/** @type {any} */ f) => f.id).join(',');
    let memLine = '';
    if (sig !== memorySig) {
      memorySig = sig;
      memLine = facts.length
        ? `[memory] What you remember about the user: ${facts.slice(-30).map((/** @type {any} */ f, /** @type {number} */ i) => `${i + 1}) ${f.text}`).join('; ')}\n`
        : '[memory] You don\'t remember anything about the user yet.\n';
    }
    e.send(`${persona.statusLine(pet, prod)}\n${googleLine}${memLine}${text}`);
    return { ok: true };
  }

  function stopEngine() { if (engine) { engine.stop(); engine = null; } }

  function start() {
    const offs = [
      bus.handle(TOPICS.CHAT_SEND, (/** @type {string} */ t) => send(t)),
      bus.handle(TOPICS.CHAT_HISTORY, () => ({ messages: history.slice(), busy: !!(engine && engine.busy), available: available() })),
      bus.handle(TOPICS.CHAT_INTERRUPT, () => engine && engine.busy && engine.interrupt()),
      bus.handle(TOPICS.CHAT_CLEAR, () => { stopEngine(); history.length = 0; out({ t: 'cleared' }); }),
      // Events and their answers also land in the chat history, so the conversation reads naturally (D-033).
      bus.handle(TOPICS.CHAT_PUSH, (/** @type {any} */ p) => {
        const role = p && (p.role === 'user' || p.role === 'tama') ? p.role : 'note';
        push({ role, text: String((p && p.text) || '').slice(0, 2000), at: now() });
      }),
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

module.exports = { createChat, markerFilter };
