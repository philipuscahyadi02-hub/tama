// @ts-check
// Tools for the chat brain (agy/Gemini), D-037/D-038. agy never asks permission for MCP tools (probe 2026-11-06), so the
// rules live HERE: reads and email drafts run; new items, edits and anything that SENDS (email, invitations) wait for
// the user's tap (chat window or Telegram) on the full content, because the chat brain may have just read an untrusted
// email. There are no delete/share tools (GOOG-7).
const { TOPICS } = require('../bus-topics');
/** A tool's policy for these arguments (e.g. an event with guests = send). @param {any} t @param {any} args */
const policyOf = (t, args) => (t.policyFor ? t.policyFor(args || {}) : t.policy);

/** Must stay below agy's 3-minute MCP tool timeout (verified 2026-11-06), so Tama answers first. */
const CONFIRM_MS = 150000;

/** Plain param spec → JSON Schema (MCP inputSchema). @param {Record<string, any>} params */
function jsonSchema(params) {
  const cell = { type: ['string', 'number', 'boolean', 'null'] };
  /** @type {Record<string, any>} */ const props = {};
  const required = [];
  for (const [k, p] of Object.entries(params)) {
    let s;
    if (p.type === 'number') s = { type: 'number' };
    else if (p.type === 'boolean') s = { type: 'boolean' };
    else if (p.type === 'rows') s = { type: 'array', items: { type: 'array', items: cell } };
    else if (p.type === 'tabs') s = { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: cell } } }, required: ['name'] } };
    else s = { type: 'string' };
    props[k] = { ...s, description: p.desc };
    if (!p.optional) required.push(k);
  }
  return { type: 'object', properties: props, required };
}

/** One human sentence for the confirm card. @param {string} name @param {any} a */
function describe(name, a) {
  const q = (/** @type {any} */ s) => `"${String(s || '').slice(0, 80)}"`;
  const when = (/** @type {string} */ s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  switch (name) {
    case 'gmail_create_draft': return `✉️ Gmail draft to ${a.to}: ${q(a.subject)} (not sent)`;
    case 'gmail_send_draft': return '✉️ Send an email draft';
    case 'calendar_create_event': return `📅 Add ${q(a.summary)} to your calendar, ${when(a.start)} → ${when(a.end)}${a.location ? ` at ${a.location}` : ''}`
      + (String(a.attendees || '').trim() ? `\n✉️ Google will EMAIL AN INVITATION to: ${a.attendees}` : '');
    case 'calendar_update_event': return `📅 Change a calendar event${a.summary ? ` to ${q(a.summary)}` : ''}${a.start ? `, ${when(a.start)}` : ''}`;
    case 'docs_create': return `📄 Create a Google Doc ${q(a.title)} in "Tama Drafts"`;
    case 'docs_append': return '📄 Add text to the end of an existing Doc';
    case 'sheets_create': return `📊 Create a Google Sheet ${q(a.title)} with ${(a.sheets || []).length || 1} tab(s) in "Tama Drafts"`;
    case 'sheets_write_range': return `📊 Overwrite cells ${a.range} in an existing Sheet`;
    case 'sheets_append_rows': return `📊 Add ${(a.rows || []).length} row(s) to an existing Sheet`;
    default: return `🔧 ${name}`;
  }
}

/**
 * @param {{ bus: import('../bus').BusInstance, tools: () => Array<import('../services/google/tools').GoogleTool>, now?: () => number }} deps
 */
function createChatTools({ bus, tools, now = Date.now }) {
  let seq = 0;
  /** @type {Map<number, (yes: boolean) => void>} */
  const waiting = new Map();

  /** Ask the user; resolves false on "no" or after 2.5 minutes. @param {string} text @param {'confirm'|'send'} [kind] */
  function confirm(text, kind = 'confirm') {
    const id = ++seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { waiting.delete(id); bus.emit(TOPICS.CHAT_EVENT, { t: 'confirm-done', id, yes: false }); resolve(false); }, CONFIRM_MS);
      waiting.set(id, (yes) => { clearTimeout(timer); waiting.delete(id); bus.emit(TOPICS.CHAT_EVENT, { t: 'confirm-done', id, yes }); resolve(yes); });
      bus.emit(TOPICS.CHAT_EVENT, { t: 'confirm', id, text, kind, at: now() });
    });
  }

  async function list() {
    return tools().map((t) => ({
      name: t.name,
      description: `${t.description}${t.policy === 'read' || t.policy === 'draft' ? '' : ' Tama shows the user a confirm button and only runs it after a yes; the result tells you whether it was done.'}`,
      inputSchema: jsonSchema(t.params),
      annotations: { readOnlyHint: t.policy === 'read' },
    }));
  }

  /** @param {string} name @param {any} args */
  async function call(name, args) {
    const t = tools().find((x) => x.name === name);
    if (!t) return { text: `Unknown tool ${name} (is Google still connected?)`, isError: true };
    const policy = policyOf(t, args);
    if (policy === 'create' || policy === 'edit' || policy === 'send') {
      let text = describe(name, args);
      if (t.preview) {
        try { text = await t.preview(args); } catch (e) { return { text: `Error: ${String(/** @type {Error} */ (e).message || e)}`, isError: true }; }
      }
      const yes = await confirm(text, policy === 'send' ? 'send' : 'confirm');
      if (!yes) return { text: `The user declined (or did not answer)${policy === 'send' ? '; nothing was sent' : ''}. Do not retry unless they ask again.` };
    }
    bus.emit(TOPICS.CHAT_EVENT, { t: 'tool', text: `${policy === 'read' ? '🔎' : '✨'} ${t.title}` });
    try {
      const r = await t.run(args);
      if (policy !== 'read') bus.emit(TOPICS.BRAIN_NOTICE, { text: `done: ${describe(name, args).split('\n')[0].replace(/^\S+ /, '')} ✨`, kind: 'info' });
      return { text: typeof r === 'string' ? r : JSON.stringify(r, null, 2) };
    } catch (e) {
      return { text: `Error: ${String(/** @type {Error} */ (e).message || e)}`, isError: true };
    }
  }

  /** @param {{ id: number, yes: boolean }} p */
  function answer(p) {
    const fn = waiting.get(Number(p.id));
    if (!fn) return { error: 'That question has expired.' };
    fn(!!p.yes);
    return { ok: true };
  }

  function start() {
    const off = bus.handle(TOPICS.CHAT_CONFIRM, (/** @type {any} */ p) => answer(p || {}));
    return () => { off(); for (const fn of [...waiting.values()]) fn(false); };
  }

  return { list, call, answer, confirm, start, pending: () => waiting.size };
}

module.exports = { createChatTools, jsonSchema, describe };
