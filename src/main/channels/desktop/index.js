// @ts-check
// Desktop channel: translates between the two renderer windows and the bus. No business rules here.
const { TOPICS } = require('../../bus-topics');
const { wirePageIpc } = require('./pages');

/** Care actions a renderer may request. Others (e.g. 'focus-break') are core-only. */
const USER_ACTIONS = new Set(['feed', 'snack', 'play', 'clean', 'sleep', 'nap', 'pat']);

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   ipc: typeof import('../../platform/ipc'),
 *   shell: typeof import('../../platform/shell'),
 *   pet: import('../../platform/windows/pet-window').PetWindow,
 *   term: import('../../platform/windows/terminal-window').TerminalWindow,
 *   chat: import('../../platform/windows/chat-window').ChatWindow,
 *   summon: (reason: string) => void,
 *   openOnboarding: (mode: 'hatch'|'restyle'|'rebirth') => void,
 *   openRoster: (importNow?: boolean) => unknown,
 *   openGoogle: () => unknown,
 *   openDashboard: (tab?: string) => unknown,
 *   openVoice: () => unknown,
 *   openSettings?: (tab?: string) => unknown,
 *   pages?: () => Array<import('electron').BrowserWindow>,
 * }} deps
 */
function createDesktopChannel({ bus, ipc, shell, pet, term, chat, summon, openOnboarding, openRoster, openGoogle, openDashboard, openVoice, openSettings = () => null, pages }) {
  const both = () => [pet.win, term.window(), chat.window()];
  /** Framed pages (Google setup) that also want live status. */
  const pageWindows = () => (pages ? pages() : []);
  /** Fire-and-forget request; failures surface on app.error instead of becoming unhandled rejections. @param {string} topic @param {any} [payload] */
  const fire = (topic, payload) => { bus.request(topic, payload).catch((e) => bus.emit(TOPICS.APP_ERROR, { topic, message: String(e.message || e) })); };
  /** @param {string} name @param {any} payload */
  const toAll = (name, payload) => { for (const w of [...both(), ...pageWindows()]) ipc.sendUi(w, name, payload); };

  /** bus → renderers */
  function pushToRenderers() {
    bus.on(TOPICS.PET_STATE_CHANGED, (p) => ipc.sendUi(pet.win, 'pet.state', p));
    bus.on(TOPICS.PET_BOND_CHANGED, (p) => ipc.sendUi(pet.win, 'pet.bond', p));
    bus.on(TOPICS.SUMMON_DONE, (p) => ipc.sendUi(pet.win, 'summon', p));
    bus.on(TOPICS.TRAY_ACTION, (p) => ipc.sendUi(pet.win, 'tray', p.action));
    bus.on(TOPICS.CHARACTER_CHANGED, (p) => toAll('character', { spec: p.spec, stage: p.stage }));
    bus.on(TOPICS.PROD_CHANGED, (p) => toAll('prod', p));
    bus.on(TOPICS.PROD_FOCUS_PHASE, (p) => toAll('focus', p));
    bus.on(TOPICS.PROD_COMMIT_SEEN, (p) => ipc.sendUi(pet.win, 'commit', p));
    bus.on(TOPICS.PROD_REMINDER_DUE, (p) => {
      toAll('reminder', p);
      shell.notify('⏰ Reminder', String(p.text));
    });
    bus.on(TOPICS.BRAIN_NOTICE, (p) => ipc.sendUi(pet.win, 'brain.notice', p));
    bus.on(TOPICS.UI_PREFS_CHANGED, (p) => toAll('ui.prefs', p));
    bus.on(TOPICS.GOOGLE_CHANGED, (p) => { toAll('google', p); for (const w of pageWindows()) ipc.sendUi(w, 'google', p); });
    bus.on(TOPICS.TELEGRAM_CHANGED, (p) => toAll('telegram', p));
    bus.on(TOPICS.USAGE_CHANGED, (p) => { for (const w of pageWindows()) ipc.sendUi(w, 'usage', p); });
  }

  /** voice (M9, D-042): the pet window plays lines and encodes Telegram voice notes */
  function voiceIpc() {
    bus.on(TOPICS.VOICE_PLAY, (p) => ipc.sendUi(pet.win, 'voice', p));
    /** @type {Map<number, (r: any) => void>} */ const encodes = new Map();
    let encSeq = 0;
    bus.handle(TOPICS.VOICE_ENCODE, (/** @type {any} */ p) => new Promise((resolve) => {
      const id = ++encSeq;
      const t = setTimeout(() => { encodes.delete(id); resolve({ error: 'encode timeout' }); }, 60000);
      encodes.set(id, (r) => { clearTimeout(t); encodes.delete(id); resolve(r); });
      ipc.sendUi(pet.win, 'encode', { id, wav: p && p.wav });
    }));
    ipc.on('voice:encoded', (id, r) => { const fn = encodes.get(Number(id)); if (fn) fn(r && typeof r === 'object' ? { data: r.data ? String(r.data) : undefined, mime: r.mime ? String(r.mime) : undefined, error: r.error ? String(r.error) : undefined } : { error: 'bad reply' }); });
    ipc.handle('voice:status', () => bus.request(TOPICS.VOICE_STATUS));
    ipc.handle('voice:set', (p) => bus.request(TOPICS.VOICE_SET, {
      lang: p?.lang ? String(p.lang) : undefined, chat: typeof p?.chat === 'boolean' ? p.chat : undefined,
      events: typeof p?.events === 'boolean' ? p.events : undefined, gpu: typeof p?.gpu === 'boolean' ? p.gpu : undefined,
      moodStyles: typeof p?.moodStyles === 'boolean' ? p.moodStyles : undefined,
      pick: p?.pick && typeof p.pick === 'object' ? { engine: String(p.pick.engine), uuid: String(p.pick.uuid), style: Number(p.pick.style) } : undefined,
      tune: p?.tune && typeof p.tune === 'object' ? { pitch: Number(p.tune.pitch), speed: Number(p.tune.speed), intonation: Number(p.tune.intonation) } : undefined,
      speaker: p?.speaker === null ? null : Number.isInteger(p?.speaker) ? p.speaker : undefined,
    }));
    ipc.handle('voice:say', (t) => bus.request(TOPICS.VOICE_SAY, { text: String(t || '').slice(0, 500), purpose: 'test' }));
    ipc.handle('voice:detect', () => bus.request(TOPICS.VOICE_DETECT));
    ipc.handle('voice:try', (p) => bus.request(TOPICS.VOICE_PREVIEW, {
      engine: String(p?.engine || ''), style: Number(p?.style), mood: p?.mood ? String(p.mood) : undefined,
      tune: p?.tune && typeof p.tune === 'object' ? { pitch: Number(p.tune.pitch), speed: Number(p.tune.speed), intonation: Number(p.tune.intonation) } : undefined,
      text: p?.text ? String(p.text).slice(0, 200) : undefined,
    }).catch((e) => ({ ok: false, reason: String(e.message || e) })));
    ipc.handle('voice:info', (p) => bus.request(TOPICS.VOICE_INFO, { engine: String(p?.engine || ''), uuid: String(p?.uuid || '') }).catch(() => null));
    ipc.on('voice:open', () => openVoice());
    bus.on(TOPICS.VOICE_CHANGED, (st) => { for (const w of pageWindows()) ipc.sendUi(w, 'voice.changed', st); });
    ipc.handle('voice:preview', (t, v) => bus.request(TOPICS.VOICE_RENDER, { text: String(t || '').slice(0, 300), voice: v && typeof v === 'object' ? {
      pitch: Number(v.pitch) || 1, rate: Number(v.rate) || 1, voiceGender: ['female', 'male', 'neutral'].includes(v.voiceGender) ? v.voiceGender : 'female',
    } : undefined }).catch((e) => ({ error: String(e.message || e) })));
    bus.on(TOPICS.ACCOUNTS_CHANGED, (p) => { for (const w of pageWindows()) ipc.sendUi(w, 'accounts', p); });
    bus.on(TOPICS.GOOGLE_MEETING_SOON, (p) => shell.notify(`📅 ${p.summary}`, `starts in ${p.minutes} min`));
    bus.on(TOPICS.EVENT_SHOWN, (p) => {
      ipc.sendUi(pet.win, 'event', p);
      // A hidden pet can't show the bubble: tell the user with a Windows notification instead.
      if (p.kind !== 'reply' && pet.isHiddenByUser()) shell.notify('💭 Your Tama wants to talk', String(p.text).slice(0, 140));
    });
    bus.on(TOPICS.PET_BOND_CHANGED, (p) => { if (p.levelUp) ipc.sendUi(term.window(), 'pet.bond', p); });
    // Chat (agy) → chat window + pet bubble; terminal (Claude Code) → terminal + pet reactions (D-029).
    bus.on(TOPICS.CHAT_EVENT, (ev) => { ipc.sendUi(chat.window(), 'chat.event', ev); ipc.sendUi(pet.win, 'chat.event', ev); });
    bus.on(TOPICS.ENGINE_EVENT, ({ ev, engine, role }) => {
      for (const w of [pet.win, term.window()]) ipc.sendUi(w, 'agent.event', { ...ev, engine, role });
      if (role !== 'worker') return;
      // Tell the user via Windows notifications when they can't see the terminal.
      if (!term.isHidden()) return;
      if (ev.t === 'permission') shell.notify('Tama needs permission 🥺', `${ev.name}: open the terminal to answer`);
      if (ev.t === 'result' && !ev.isError) shell.notify('Tama: done! ✨', String(ev.text || 'Done!').slice(0, 140));
    });
  }

  /** pet window → core */
  function petIpc() {
    ipc.on('mouse:capture', (on) => pet.setCapture(!!on));
    ipc.handle('pet:walk', (dx) => pet.walk(Number(dx) || 0));
    ipc.on('pet:dragBy', (dx, dy) => pet.dragBy(Number(dx) || 0, Number(dy) || 0));
    ipc.handle('pet:get', () => bus.request(TOPICS.PET_GET));
    ipc.handle('pet:act', (action) => {
      if (!USER_ACTIONS.has(String(action))) return { ok: false, reason: 'unknown-action' };
      return bus.request(TOPICS.PET_ACT, { action: String(action) });
    });
    ipc.on('notify', (title, body) => shell.notify(String(title), String(body)));
    ipc.on('term:show', () => term.show());
    ipc.on('chat:show', () => chat.show());
    ipc.handle('ui:prefs', () => bus.request(TOPICS.UI_PREFS_GET));
  }

  /** chat window → core (agy, D-029) */
  function chatIpc() {
    ipc.handle('chat:send', (t) => bus.request(TOPICS.CHAT_SEND, String(t || '')));
    ipc.handle('chat:history', () => bus.request(TOPICS.CHAT_HISTORY));
    ipc.on('chat:interrupt', () => fire(TOPICS.CHAT_INTERRUPT));
    ipc.on('chat:clear', () => fire(TOPICS.CHAT_CLEAR));
    ipc.handle('chat:confirm', (id, yes) => bus.request(TOPICS.CHAT_CONFIRM, { id: Number(id), yes: !!yes }));
    ipc.on('summon', () => summon('ui'));
    ipc.handle('character:get', () => bus.request(TOPICS.CHARACTER_GET));
  }

  /** productivity (pet + terminal) */
  function productivityIpc() {
    ipc.handle('brain:status', () => bus.request(TOPICS.BRAIN_STATUS));
    ipc.handle('brain:set', (p) => bus.request(TOPICS.BRAIN_SET, {
      dailyClaudeUsd: p?.dailyClaudeUsd == null ? undefined : Number(p.dailyClaudeUsd),
    }));
    ipc.handle('prod:get', () => bus.request(TOPICS.PROD_GET));
    ipc.handle('prod:todoAdd', (t) => bus.request(TOPICS.PROD_TODO_ADD, { text: String(t || '') }));
    ipc.handle('prod:todoDone', (ref) => bus.request(TOPICS.PROD_TODO_DONE, { ref }));
    ipc.handle('prod:todoRemove', (ref) => bus.request(TOPICS.PROD_TODO_REMOVE, { ref }));
    ipc.handle('prod:noteAdd', (t) => bus.request(TOPICS.PROD_NOTE_ADD, { text: String(t || '') }));
    ipc.handle('prod:remindAdd', (input) => bus.request(TOPICS.PROD_REMIND_ADD, { input: String(input || '') }));
    ipc.handle('prod:focusStart', (m) => bus.request(TOPICS.PROD_FOCUS_START, { minutes: Number(m) || 25 }));
    ipc.handle('prod:focusStop', () => bus.request(TOPICS.PROD_FOCUS_STOP));
    ipc.handle('prod:watchAdd', (p) => bus.request(TOPICS.PROD_WATCH_ADD, { path: String(p || '') }));
    ipc.handle('prod:watchRemove', (p) => bus.request(TOPICS.PROD_WATCH_REMOVE, { path: String(p || '') }));
    ipc.handle('prod:watchList', () => bus.request(TOPICS.PROD_WATCH_LIST));
    ipc.on('onboarding:open', (mode) => openOnboarding(['restyle', 'rebirth'].includes(mode) ? mode : 'hatch'));
  }

  /** terminal window → core */
  function terminalIpc() {
    ipc.handle('term:init', () => bus.request(TOPICS.ENGINE_INFO));
    ipc.handle('agent:pickCwd', async () => {
      const dir = await shell.pickFolder(term.window());
      return dir ? bus.request(TOPICS.ENGINE_SET_CWD, dir) : null;
    });
    ipc.handle('agent:setCwd', (dir) => bus.request(TOPICS.ENGINE_SET_CWD, String(dir)));
    ipc.handle('agent:resume', (id) => bus.request(TOPICS.ENGINE_RESUME, id || null));
    ipc.on('agent:send', (text) => fire(TOPICS.ENGINE_SEND, String(text)));
    ipc.on('agent:interrupt', () => fire(TOPICS.ENGINE_INTERRUPT));
    ipc.on('agent:clear', () => fire(TOPICS.ENGINE_CLEAR));
    ipc.on('agent:setMode', (m) => fire(TOPICS.ENGINE_SET_MODE, String(m)));
    ipc.on('agent:setModel', (m) => fire(TOPICS.ENGINE_SET_MODEL, m ? String(m) : null));
    ipc.on('agent:setEffort', (v) => fire(TOPICS.ENGINE_SET_EFFORT, v ? String(v) : null));
    ipc.on('agent:permission', (id, choice, feedback) =>
      fire(TOPICS.ENGINE_ANSWER_PERMISSION, { id: Number(id), choice: String(choice), feedback: feedback == null ? undefined : String(feedback).slice(0, 2000) }));
    ipc.onFromWindow('win:minimize', (w) => w.minimize());
    ipc.onFromWindow('win:maximize', (w) => (w.isMaximized() ? w.unmaximize() : w.maximize()));
    ipc.onFromWindow('win:close', (w) => w.hide());
  }

  function start() {
    pushToRenderers();
    voiceIpc();
    petIpc();
    chatIpc();
    productivityIpc();
    terminalIpc();
    wirePageIpc({ bus, ipc, shell, fire, summon, openOnboarding, openRoster, openGoogle, openDashboard, openVoice, openSettings });
  }

  return { start };
}

module.exports = { createDesktopChannel };
