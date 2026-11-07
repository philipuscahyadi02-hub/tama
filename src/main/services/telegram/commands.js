// @ts-check
// Telegram slash commands (TG-4..7; QC-4: split out of index.js): pet care, todos, focus, reminders, the brief, voice
// notes and remote coding. Plain text goes to the chat brain. Everything goes through bus requests, like the desktop.
const { TOPICS } = require('../../bus-topics');
const fmt = require('./format');

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   device: import('../../platform/store/device').DeviceSettings,
 *   send: (text: string, extra?: any) => Promise<any>,
 *   upload: (method: string, fields: any, field: string, data: Buffer, name: string, type: string) => Promise<any>,
 *   snapshot: () => Promise<Buffer | null>, announce: (text: string) => void, changed: () => void,
 *   remote: { start: (t: string) => any, stop: () => any, repos: () => any, cd: (d: string) => any },
 *   cfg: () => { voiceNotes?: boolean, remote: boolean },
 *   chat: (text: string) => Promise<any>, voiceNote: (text: string) => Promise<any>,
 * }} deps
 */
function createCommands({ bus, device, send, upload, snapshot, announce, changed, remote, cfg, chat, voiceNote }) {
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
        if (png) return upload('sendPhoto', { caption: fmt.statusText(pet) }, 'photo', png, 'tama.png', 'image/png');
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
      case 'voice': {
        // TG-3 voice (D-042): her replies also come as a voice note.
        if (!/^(on|off)$/i.test(a)) return send(`voice notes are ${cfg().voiceNotes ? 'on 🔊' : 'off'} · /voice on|off`);
        device.patch('telegram', { voiceNotes: /^on$/i.test(a) });
        changed();
        if (/^on$/i.test(a)) { await send("🔊 okay! I'll talk to you too~"); return voiceNote('Yay! Now you can hear me on your phone too.'); }
        return send('🔇 voice notes off');
      }
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

  async function briefText() {
    const b = await bus.request(TOPICS.GOOGLE_BRIEF).catch(() => null);
    if (b && b.text) return `☀️ ${b.text}`;
    const s = await bus.request(TOPICS.PROD_GET).catch(() => null);
    const open = ((s && s.todos) || []).filter((/** @type {any} */ x) => !x.done);
    return `☀️ ${open.length ? `${open.length} open todo${open.length > 1 ? 's' : ''}: ${open.slice(0, 5).map((/** @type {any} */ x) => x.text).join(' · ')}` : 'no open todos'}\n(connect Google on the PC for calendar + mail)`;
  }

  return { onText, briefText };
}

module.exports = { createCommands };
