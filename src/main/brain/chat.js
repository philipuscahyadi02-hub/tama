// @ts-check
// Chat with your Tama (CHAT-1, D-029): the chat window, the pet bubble and (M7) Telegram talk to this.
// The `chat` provider (SHIP-8): agy by default (Gemini Flash, read-only plan mode, D-027, with web search); Claude Haiku
// without tools only when the user opted in. The brain passes the factory; this module doesn't know which one it is.
const fs = require('fs');
const { TOPICS } = require('../bus-topics');
const persona = require('./persona');

/** Keep this many messages for the chat window (in memory; facts worth keeping go to memory, D-033). */
const HISTORY_MAX = 200;
/** Start a fresh agy session (with a short recap) once a turn re-reads this many tokens, or after this long idle (D-089).
 *  Every turn re-sends the whole conversation, so a long chat costs more and more per message. */
const FRESH_AT_TOKENS = 30000;
const FRESH_AFTER_IDLE_MS = 2 * 60 * 60 * 1000;
const RECAP_MESSAGES = 6;
/** `[[remember: …]]` markers in a reply become memories and are never shown (EVT-4). */
const REMEMBER_RE = /\[\[\s*remember\s*:\s*([^\]]+?)\s*\]\]/gi;
/** `[[work: …]]` = a task the chat brain suggests handing to Claude Code (phone button, D-036). */
const WORK_RE = /\[\[\s*work\s*:\s*([^\]]+?)\s*\]\]/i;
/** `[[ja: <feeling> | <Japanese>]]` = the voice dub, written with the reply while the Japanese voice is on (SET-4). */
const JA_RE = /\[\[\s*ja\s*:\s*([^\]]+?)\s*\]\]/i;
/** What she says when the model's allowance is used up (the real numbers go to Limits and a notice, D-088). */
const QUOTA_LINE = 'uu… my brain for this model is out of allowance for now 💤 Pick another model in Settings → Brains (or turn on the auto-switch there) and ask me again~';

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

/** quiet: already spoken elsewhere (e.g. a moment via event.shown), so the voice skips it. @typedef {{ role: 'user'|'tama'|'note', text: string, at: number, tools?: string[], work?: string, ja?: string, quiet?: boolean }} ChatMessage */

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
  let reply = { text: '', tools: /** @type {string[]} */ ([]), filter: markerFilter(), done: '' };
  /** Which memories this agy session already knows (sent as a [memory] line when they change). */
  let memorySig = /** @type {string | null} */ (null); // null = this session hasn't been told yet
  /** Last [google] context line sent to this session (calendar/mail summary, read-only, D-034). */
  let googleSent = '';
  /** How much the last turn re-read, and when the user last wrote (D-089). */
  let ctxTokens = 0;
  let lastAt = 0;

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
      case 'context': ctxTokens = Math.max(ctxTokens, Number(ev.used) || 0); break;
      case 'init': if (ev.tier) bus.emit(TOPICS.USAGE_LIMIT, { provider: 'gemini', tier: ev.tier }); break; // plan tier for Limits (D-041)
      case 'error':
        if (/quota|RESOURCE_EXHAUSTED|rate.?limit|429/i.test(String(ev.message))) bus.emit(TOPICS.USAGE_LIMIT, { provider: 'gemini', hit: ev.message });
        if (!ev.quota) out({ t: 'error', message: ev.message }); // a used-up allowance gets her own line at the result
        break;
      case 'result': {
        onResult(ev);
        ctxTokens = Math.max(ctxTokens, typeof ev.tokens === 'number' ? ev.tokens : 0);
        const tail = reply.filter.end();
        if (tail) out({ t: 'delta', text: tail });
        const learned = [...reply.text.matchAll(REMEMBER_RE)].map((m) => m[1]).slice(0, 2);
        for (const f of learned) {
          bus.request(TOPICS.MEMORY_ADD, { text: f, source: 'chat' }).catch(() => null);
          reply.tools.push(`📝 I'll remember: ${f}`);
          out({ t: 'tool', text: `📝 I'll remember: ${f}` });
        }
        if (ev.subtype === 'quota') reply.text = ''; // agy's "quota reached" text is not her reply (D-088)
        const text = (ev.subtype === 'quota' ? QUOTA_LINE : '') || reply.text.replace(REMEMBER_RE, '').replace(/\[\[[^\]]*\]\]/g, '').trim()
          // Gemini sometimes ends a turn right after a music tool without a word: say what the tool did instead.
          || (reply.done ? `Okay~ ${reply.done} ♪` : '')
          || (ev.isError ? 'uu… my brain glitched. Can you say that again? (agy error)' : 'hmm… I lost my words. Ask me again?');
        const work = WORK_RE.exec(reply.text);
        const ja = JA_RE.exec(reply.text);
        push({ role: 'tama', text, at: now(), tools: reply.tools.length ? reply.tools : undefined, work: work ? work[1].slice(0, 1000) : undefined, ja: ja ? ja[1].slice(0, 1000) : undefined });
        reply = { text: '', tools: [], filter: markerFilter(), done: '' };
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
      ctxTokens = 0;
    }
    return engine;
  }

  /** @param {string} raw */
  async function send(raw) {
    const text = String(raw || '').trim().slice(0, 4000);
    if (!text) return { ok: false };
    // A long or stale conversation starts over with a recap: much cheaper than re-reading all of it each turn (D-089).
    let recap = '';
    if (engine && !engine.busy && (ctxTokens >= FRESH_AT_TOKENS || (lastAt && now() - lastAt >= FRESH_AFTER_IDLE_MS))) {
      recap = recapLine(history);
      stopEngine();
    }
    lastAt = now();
    push({ role: 'user', text, at: now() });
    if (!available()) {
      push({ role: 'note', text: 'Chat needs Gemini (the Antigravity CLI, agy): install it and log in once, then restart Tama. Or let Claude chat instead: Settings → Brains (uses your Claude quota). Coding work still works in the terminal (Ctrl+Alt+K).', at: now() });
      out({ t: 'done', isError: true });
      return { ok: false, error: 'agy-missing' };
    }
    const e = getEngine();
    if (e.busy) { push({ role: 'note', text: 'one at a time~ I\'m still answering.', at: now() }); return { ok: false }; }
    reply = { text: '', tools: [], filter: markerFilter(), done: '' };
    const [pet, prod, mem, gctx, wx] = await Promise.all([
      bus.request(TOPICS.PET_GET).catch(() => null),
      bus.request(TOPICS.PROD_GET).catch(() => null),
      bus.request(TOPICS.MEMORY_GET).catch(() => null),
      bus.request(TOPICS.GOOGLE_CONTEXT).catch(() => ''),
      bus.request(TOPICS.WEATHER_GET).catch(() => null), // D-035: null without a location
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
    e.send(`${persona.statusLine(pet, prod, wx)}\n${googleLine}${memLine}${recap}${text}`);
    return { ok: true };
  }

  function stopEngine() { if (engine) { engine.stop(); engine = null; } }

  function start() {
    const offs = [
      bus.handle(TOPICS.CHAT_SEND, (/** @type {string} */ t) => send(t)),
      bus.on(TOPICS.CHAT_EVENT, (/** @type {any} */ e) => { if (e && e.t === 'tool-done' && engine && engine.busy) reply.done = String(e.text || '').slice(0, 300); }),
      bus.handle(TOPICS.CHAT_HISTORY, () => ({ messages: history.slice(), busy: !!(engine && engine.busy), available: available() })),
      bus.handle(TOPICS.CHAT_INTERRUPT, () => engine && engine.busy && engine.interrupt()),
      bus.handle(TOPICS.CHAT_CLEAR, () => { stopEngine(); history.length = 0; out({ t: 'cleared' }); }),
      // Events and their answers also land in the chat history, so the conversation reads naturally (D-033).
      bus.handle(TOPICS.CHAT_PUSH, (/** @type {any} */ p) => {
        const role = p && (p.role === 'user' || p.role === 'tama') ? p.role : 'note';
        push({ role, text: String((p && p.text) || '').slice(0, 2000), at: now(), ...(p && p.voice === false ? { quiet: true } : {}) });
      }),
    ];
    return () => { for (const off of offs) off(); stopEngine(); };
  }

  /** @param {string} p */
  function setPersona(p) {
    personaText = p;
    if (engine && engine.setPersona) engine.setPersona(p);
  }

  /** Start a fresh agy session next time (e.g. Google tools appeared or went away); the visible history stays. */
  function reset() { stopEngine(); }

  return { start, send, setPersona, reset, history: () => history.slice() };
}

/** @param {any} ev */
function describeTool(ev) {
  const i = ev.input || {};
  if (/search/i.test(ev.name)) return `🔎 searched the web: ${String(i.query || i.Query || '').slice(0, 80)}`;
  if (/read|view|fetch|url/i.test(ev.name)) return `📖 read ${String(i.url || i.Url || i.path || i.AbsolutePath || '').slice(0, 80)}`;
  return `🔧 ${ev.name}`;
}

/** The last few messages as one context line for a fresh session (D-089). @param {ChatMessage[]} h */
function recapLine(h) {
  const msgs = h.filter((m) => m.role === 'user' || m.role === 'tama').slice(-RECAP_MESSAGES);
  if (!msgs.length) return '';
  const cut = (/** @type {string} */ s) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > 200 ? `${t.slice(0, 200)}…` : t; };
  return `[recent chat] (a fresh session; this is how your conversation went just before) ${msgs.map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${cut(m.text)}`).join(' | ')}\n`;
}

module.exports = { createChat, markerFilter, recapLine };
