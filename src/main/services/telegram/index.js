// @ts-check
// Telegram (TG-1..8, SAFE-3, D-008, D-036): your Tama on your phone, served from this PC by long polling (no server).
// Pairing binds exactly one chat with a one-time code; every other chat is ignored. Plain messages go to the chat brain
// (agy, D-029); /code goes to Claude Code via ./remote.js. Bot token + chat id live in platform/secrets only.
const crypto = require('crypto');
const { TOPICS } = require('../../bus-topics');
const { createBotApi } = require('./api');
const { createRemote } = require('./remote');
const fmt = require('./format');
const { dayOf } = require('../pet/bond');

const CODE_TTL_MS = 15 * 60000;
const CHAT_TIMEOUT_MS = 7 * 60000; // long enough for a Google confirm tap (D-037)

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   secrets: { get: (k: string) => string | null, set: (k: string, v: string) => void, delete: (k: string) => void },
 *   device: import('../../platform/store/device').DeviceSettings,
 *   git: { isRepo: (d: string) => boolean, diff: (d: string) => Promise<string> },
 *   snapshot: () => Promise<Buffer | null>, keepAwake: (on: boolean) => boolean,
 *   tama: { name: string }, desk: string, fetch?: typeof fetch, now?: () => number,
 * }} deps
 *   desk: Tama's own empty work folder; remote tasks that need no project (Google, questions) run there.
 */
function createTelegram({ bus, secrets, device, git, snapshot, keepAwake, tama, desk, fetch: f = fetch, now = Date.now }) {
  const cfg = () => ({ enabled: true, repos: /** @type {string[]} */ ([]), remote: true, awake: false, morningDay: '', eveningDay: '', bot: '', ...(device.get().telegram || {}) });
  const api = createBotApi({ token: () => secrets.get('telegram.token'), fetch: f });
  const chatId = () => { const v = secrets.get('telegram.chatId'); return v ? Number(v) : null; };
  /** @type {{ code: string, until: number } | null} */ let pairing = null;
  /** @type {(() => void) | null} */ let stopPoll = null;
  let ignored = 0;

  const send = (/** @type {string} */ text, /** @type {any} */ extra = {}) => api.call('sendMessage', { chat_id: chatId(), text: fmt.clip(text), ...extra });
  const edit = (/** @type {number} */ id, /** @type {string} */ text, /** @type {any} */ extra = {}) => api.call('editMessageText', { chat_id: chatId(), message_id: id, text: fmt.clip(text), ...extra });
  const sendDocument = (/** @type {Buffer} */ data, /** @type {string} */ name, /** @type {string} */ caption = '') => api.upload('sendDocument', { chat_id: chatId(), caption }, 'document', data, name, 'text/plain');
  /** Desktop sees every remote action (TG-7). @param {string} text */
  const announce = (text) => {
    bus.emit(TOPICS.ENGINE_EVENT, { engine: 'tama', role: 'brain', ev: { t: 'info', text: `⎿  ${text}` } });
    bus.emit(TOPICS.BRAIN_NOTICE, { text, kind: 'info' });
  };
  const remote = createRemote({ bus, send, edit, sendDocument, git, announce, now, desk, settings: () => ({ repos: cfg().repos, remote: cfg().remote }) });
  /** Tasks the chat brain offered to hand to Claude Code ("💻 Let Claude do it" buttons). */
  const offered = new Map();
  let offerSeq = 0;
  /** True while a phone message is with the chat brain: its confirm questions go to the phone (D-037). */
  let phoneTurn = false;
  /** confirm id → telegram message id */
  const confirms = new Map();

  function status() {
    const c = cfg();
    return {
      configured: !!secrets.get('telegram.token'), paired: !!chatId(), running: !!stopPoll, enabled: c.enabled, bot: c.bot || null,
      repos: c.repos, remote: c.remote, awake: c.awake, pairing: pairing && pairing.until > now() ? { code: pairing.code, link: c.bot ? `https://t.me/${c.bot}?start=${pairing.code}` : null } : null,
      ignored,
    };
  }
  const changed = () => bus.emit(TOPICS.TELEGRAM_CHANGED, status());

  // ---- setup & pairing (TG-2, SAFE-3) ----
  /** @param {{ token: string }} p */
  async function setup({ token }) {
    const t = String(token || '').trim();
    if (!/^\d{5,}:[\w-]{30,}$/.test(t)) return { error: 'That doesn\'t look like a bot token (it looks like 123456789:AA…). Get one from @BotFather.' };
    secrets.set('telegram.token', t);
    let me;
    try { me = await api.call('getMe'); } catch (e) { secrets.delete('telegram.token'); return { error: String(/** @type {Error} */ (e).message) }; }
    device.patch('telegram', { bot: me.username, enabled: true });
    secrets.delete('telegram.chatId');
    pairing = { code: crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6), until: now() + CODE_TTL_MS };
    restart();
    changed();
    return status();
  }
  function newCode() {
    if (!secrets.get('telegram.token')) return { error: 'Set up the bot first: /phone setup <token>' };
    pairing = { code: crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6), until: now() + CODE_TTL_MS };
    changed();
    return status();
  }
  async function unpair() {
    if (chatId()) await send('👋 This chat was disconnected from your Tama on the PC.').catch(() => null);
    secrets.delete('telegram.chatId');
    changed();
    return status();
  }

  // ---- updates ----
  /** @param {any} u */
  async function onUpdate(u) {
    const msg = u.message;
    const cb = u.callback_query;
    const from = msg ? msg.chat.id : cb ? cb.message && cb.message.chat.id : null;
    if (!from) return;
    const paired = chatId();
    if (!paired) {
      const text = String((msg && msg.text) || '').trim();
      const m = /^(?:\/start\s+)?([0-9A-F]{6})$/i.exec(text);
      if (msg && msg.chat.type === 'private' && pairing && pairing.until > now() && m && m[1].toUpperCase() === pairing.code) {
        secrets.set('telegram.chatId', String(from));
        pairing = null;
        await api.call('setMyCommands', { commands: fmt.COMMANDS }).catch(() => null);
        await send(`✨ Paired! I'm ${tama.name}, and this chat is now connected to your PC.\n\n${fmt.HELP}`);
        announce('📱 Telegram paired with your phone');
        changed();
      } else { ignored++; }
      return;
    }
    if (from !== paired) { ignored++; return; } // SAFE-3: everyone else is ignored
    if (cb) {
      await api.call('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => null);
      if (await remote.onCallback(String(cb.data || ''))) return;
      const c = /^cfm:(\d+):(y|n)$/.exec(String(cb.data || ''));
      if (c) { await bus.request(TOPICS.CHAT_CONFIRM, { id: Number(c[1]), yes: c[2] === 'y' }).catch(() => null); return; }
      const w = /^work:(\d+)$/.exec(String(cb.data || ''));
      if (w) {
        const task = offered.get(Number(w[1]));
        offered.delete(Number(w[1]));
        if (cb.message) await api.call('editMessageReplyMarkup', { chat_id: chatId(), message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => null);
        return task ? remote.start(task) : send('That button expired~ just ask me again, or use /code <task>.');
      }
      if (String(cb.data || '').startsWith('ev:')) {
        const [, id, choice] = String(cb.data).split(':');
        const r = await bus.request(TOPICS.EVENTS_ANSWER, { id, choice: Number(choice) }).catch(() => null);
        if (r && r.reply) await send(r.reply);
      }
      return;
    }
    if (msg.text) await onText(String(msg.text));
    else await send('I can only read text for now~ (voice notes come later!)');
  }

  /** @param {string} text */
  async function onText(text) {
    const m = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/.exec(text.trim());
    if (!m) return chat(text);
    const [, cmd, arg] = m;
    const a = arg.trim();
    const r = (/** @type {string} */ topic, /** @type {any} */ p = undefined) => bus.request(topic, p).catch((e) => ({ error: String(e.message || e) }));
    switch (cmd.toLowerCase()) {
      case 'start': case 'help': return send(fmt.HELP);
      case 'status': {
        const pet = await r(TOPICS.PET_GET);
        const png = await snapshot().catch(() => null);
        if (png) return api.upload('sendPhoto', { chat_id: chatId(), caption: fmt.statusText(pet) }, 'photo', png, 'tama.png', 'image/png');
        return send(fmt.statusText(pet));
      }
      case 'feed': case 'snack': case 'nap': {
        const res = await r(TOPICS.PET_ACT, { action: cmd.toLowerCase() });
        announce(`📱 ${cmd} from your phone`);
        const ok = { feed: 'itadakimasu~! 🍙', snack: 'power up! ⚡', nap: 'zzz… power nap 💤' }[cmd.toLowerCase()];
        return send(res && res.ok ? ok : `hmm, not now (${(res && res.reason) || 'busy'})${res && res.retryInMs ? ` · try again in ${Math.ceil(res.retryInMs / 60000)} min` : ''}`);
      }
      case 'summon': await r(TOPICS.SUMMON, { reason: 'telegram' }); announce('📱 summoned from your phone'); return send('✨ I\'m back on your screen!');
      case 'todo': case 'todos': {
        if (a && cmd === 'todo') { const t = await r(TOPICS.PROD_TODO_ADD, { text: a }); return send(t.error ? `✗ ${t.error}` : `☐ added: ${t.todo.text}`); }
        const s = await r(TOPICS.PROD_GET);
        const open = ((s && s.todos) || []).filter((/** @type {any} */ x) => !x.done);
        return send(open.length ? open.map((/** @type {any} */ x, /** @type {number} */ i) => `${i + 1}. ☐ ${x.text}`).join('\n') + '\n\n/done <n> to finish' : 'No open todos~ ✨');
      }
      case 'done': { const t = await r(TOPICS.PROD_TODO_DONE, { ref: a }); return send(t.error ? `✗ ${t.error}` : `☑ done: ${t.todo ? t.todo.text : a} ✨`); }
      case 'focus': {
        if (a === 'stop') { await r(TOPICS.PROD_FOCUS_STOP); return send('focus stopped. otsukare~'); }
        const t = await r(TOPICS.PROD_FOCUS_START, { minutes: Number(a) || 25 });
        return send(t.error ? `✗ ${t.error}` : `⏱️ focus ${Number(a) || 25} min! ganbatte~`);
      }
      case 'remind': { const t = await r(TOPICS.PROD_REMIND_ADD, { input: a }); return send(t.error ? `✗ ${t.error}` : `⏰ ok! ${new Date(t.reminder.at).toLocaleString()}: ${t.reminder.text}`); }
      case 'brief': return send(await briefText());
      case 'code': return remote.start(a);
      case 'stop': return remote.stop();
      case 'repos': return remote.repos();
      case 'cd': return remote.cd(a);
      case 'remote': {
        if (!/^(on|off)$/i.test(a)) return send(`remote coding is ${cfg().remote ? 'on' : 'off'} · /remote on|off`);
        device.patch('telegram', { remote: /^on$/i.test(a) });
        announce(`📱 remote coding switched ${a.toLowerCase()} from your phone`);
        changed();
        return send(`remote coding ${a.toLowerCase()} ${/^on$/i.test(a) ? '💻' : '🔒'}`);
      }
      default: return send(`I don't know /${cmd} yet~ /help`);
    }
  }

  /** Google create/edit questions from the chat brain → buttons on the phone (D-037). @param {any} ev */
  async function onChatConfirm(ev) {
    if (!chatId()) return;
    if (ev.t === 'confirm' && phoneTurn) {
      const m = await send(`🙋 ${ev.text}\nShall I?`, { reply_markup: { inline_keyboard: [[{ text: '✅ Yes, do it', callback_data: `cfm:${ev.id}:y` }, { text: '❌ No', callback_data: `cfm:${ev.id}:n` }]] } });
      confirms.set(ev.id, m.message_id);
    } else if (ev.t === 'confirm-done' && confirms.has(ev.id)) {
      const mid = confirms.get(ev.id);
      confirms.delete(ev.id);
      await edit(mid, ev.yes ? '✅ okay, doing it~' : '❌ cancelled', { reply_markup: { inline_keyboard: [] } });
    }
  }

  /** Talk to the chat brain; reply with its next message (TG-3). @param {string} text */
  async function chat(text) {
    await api.call('sendChatAction', { chat_id: chatId(), action: 'typing' }).catch(() => null);
    /** @type {Promise<any>} */
    const reply = new Promise((resolve) => {
      const timer = setTimeout(() => { off(); resolve(null); }, CHAT_TIMEOUT_MS);
      const off = bus.on(TOPICS.CHAT_EVENT, (/** @type {any} */ ev) => {
        if (ev.t === 'message' && ev.message.role !== 'user') { clearTimeout(timer); off(); resolve(ev.message); }
      });
    });
    phoneTurn = true;
    const r = await bus.request(TOPICS.CHAT_SEND, `📱 ${text}`).catch(() => ({ ok: false }));
    const answer = await reply.finally(() => { phoneTurn = false; });
    const body = String((answer && answer.text) || (r && r.ok === false ? 'I can\'t chat right now (is agy set up on the PC?)' : 'uu… I got lost. say that again?'));
    if (answer && answer.work) {
      // Real work: one tap hands it to Claude Code on the PC (which still asks before every change).
      const id = ++offerSeq;
      offered.set(id, answer.work);
      for (const k of [...offered.keys()]) if (k <= id - 20) offered.delete(k);
      return send(body, { reply_markup: { inline_keyboard: [[{ text: '💻 Let Claude do it', callback_data: `work:${id}` }]] } });
    }
    return send(body);
  }

  async function briefText() {
    const b = await bus.request(TOPICS.GOOGLE_BRIEF).catch(() => null);
    if (b && b.text) return `☀️ ${b.text}`;
    const s = await bus.request(TOPICS.PROD_GET).catch(() => null);
    const open = ((s && s.todos) || []).filter((/** @type {any} */ x) => !x.done);
    return `☀️ ${open.length ? `${open.length} open todo${open.length > 1 ? 's' : ''}: ${open.slice(0, 5).map((/** @type {any} */ x) => x.text).join(' · ')}` : 'no open todos'}\n(connect Google on the PC for calendar + mail)`;
  }

  /** Morning brief + evening recap (TG-4), once a day each. */
  async function daily() {
    if (!chatId() || !stopPoll) return;
    const c = cfg();
    const t = new Date(now());
    const today = dayOf(now());
    if (c.morningDay !== today && t.getHours() >= 8 && t.getHours() < 12) {
      device.patch('telegram', { morningDay: today });
      await send(`ohayou~! ${await briefText()}`).catch(() => null);
    }
    if (c.eveningDay !== today && (t.getHours() > 21 || (t.getHours() === 21 && t.getMinutes() >= 30))) {
      device.patch('telegram', { eveningDay: today });
      const page = await bus.request(TOPICS.DIARY_READ, { day: today }).catch(() => null);
      await send(page && page.text ? `📔 tonight's diary\n\n${page.text.replace(/^# .*\n+/, '')}` : '🌙 good night~ see you tomorrow!').catch(() => null);
    }
  }

  // ---- lifecycle ----
  function restart() {
    if (stopPoll) { stopPoll(); stopPoll = null; }
    if (!cfg().enabled || !secrets.get('telegram.token')) { changed(); return; }
    stopPoll = api.poll(onUpdate, { onError: (e) => bus.emit(TOPICS.APP_ERROR, { topic: 'telegram', message: e.message }) });
    api.call('setMyShortDescription', { short_description: `✨ ${tama.name} is awake on your PC` }).catch(() => null);
    changed();
  }

  /** @param {{ enabled?: boolean, remote?: boolean, awake?: boolean, allow?: string, disallow?: string }} p */
  function set(p) {
    const c = cfg();
    /** @type {Record<string, any>} */ const patch = {};
    if (typeof p.enabled === 'boolean') patch.enabled = p.enabled;
    if (typeof p.remote === 'boolean') patch.remote = p.remote;
    if (typeof p.awake === 'boolean') { patch.awake = p.awake; keepAwake(p.awake); }
    if (p.allow) patch.repos = [...new Set([...c.repos, String(p.allow)])];
    if (p.disallow) patch.repos = c.repos.filter((r) => r.toLowerCase() !== String(p.disallow).toLowerCase());
    device.patch('telegram', patch);
    if (typeof p.enabled === 'boolean') restart();
    changed();
    return status();
  }

  function start() {
    restart();
    if (cfg().awake) keepAwake(true);
    const timer = setInterval(() => { daily().catch(() => null); }, 10 * 60000);
    const offs = [
      bus.on(TOPICS.ENGINE_EVENT, (/** @type {any} */ e) => { if (chatId()) remote.onEngineEvent(e).catch(() => null); }),
      bus.on(TOPICS.CHAT_EVENT, (/** @type {any} */ ev) => { onChatConfirm(ev).catch(() => null); }),
      bus.handle(TOPICS.TELEGRAM_STATUS, () => status()),
      bus.handle(TOPICS.TELEGRAM_SETUP, (/** @type {any} */ p) => setup(p || {})),
      bus.handle(TOPICS.TELEGRAM_NEW_CODE, () => newCode()),
      bus.handle(TOPICS.TELEGRAM_UNPAIR, () => unpair()),
      bus.handle(TOPICS.TELEGRAM_SET, (/** @type {any} */ p) => set(p || {})),
    ];
    return () => {
      clearInterval(timer);
      for (const off of offs) off();
      if (stopPoll) {
        // TG-8: best effort "sleeping" bio on quit.
        api.call('setMyShortDescription', { short_description: `💤 ${tama.name} is sleeping (PC is off)` }).catch(() => null);
        stopPoll(); stopPoll = null;
      }
      keepAwake(false);
    };
  }

  return { start, status, setup, onUpdate, set, daily, remote };
}

module.exports = { createTelegram };
