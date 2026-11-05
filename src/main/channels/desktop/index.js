// @ts-check
// Desktop channel: translates between the two renderer windows and the bus. No business rules here.
const { TOPICS } = require('../../bus-topics');

/** Care actions a renderer may request. Others (e.g. 'focus-break') are core-only. */
const USER_ACTIONS = new Set(['feed', 'snack', 'play', 'clean', 'sleep', 'nap', 'pat']);

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   ipc: typeof import('../../platform/ipc'),
 *   shell: typeof import('../../platform/shell'),
 *   pet: import('../../platform/windows/pet-window').PetWindow,
 *   term: import('../../platform/windows/terminal-window').TerminalWindow,
 *   summon: (reason: string) => void,
 *   openOnboarding: (mode: 'hatch'|'restyle'|'rebirth') => void,
 *   openRoster: (importNow?: boolean) => unknown,
 * }} deps
 */
function createDesktopChannel({ bus, ipc, shell, pet, term, summon, openOnboarding, openRoster }) {
  /** The last .tama file the user picked; import only ever reads this path, never one sent by a page. */
  let pickedImport = /** @type {string | null} */ (null);
  const both = () => [pet.win, term.window()];
  /** Fire-and-forget request; failures surface on app.error instead of becoming unhandled rejections. @param {string} topic @param {any} [payload] */
  const fire = (topic, payload) => { bus.request(topic, payload).catch((e) => bus.emit(TOPICS.APP_ERROR, { topic, message: String(e.message || e) })); };
  /** @param {string} name @param {any} payload */
  const toAll = (name, payload) => { for (const w of both()) ipc.sendUi(w, name, payload); };

  function start() {
    // ---- bus → renderers ----
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
    bus.on(TOPICS.ENGINE_EVENT, ({ ev }) => {
      toAll('agent.event', ev);
      // Tell the user via Windows notifications when they can't see the terminal.
      if (!term.isHidden()) return;
      if (ev.t === 'permission') shell.notify('Tama needs permission 🥺', `${ev.name}: open the terminal to answer`);
      if (ev.t === 'result' && !ev.isError) shell.notify('Tama: done! ✨', String(ev.text || 'Done!').slice(0, 140));
    });

    // ---- pet window → core ----
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
    ipc.on('summon', () => summon('ui'));
    ipc.handle('character:get', () => bus.request(TOPICS.CHARACTER_GET));
    // ---- productivity (pet + terminal) ----
    ipc.handle('prod:get', () => bus.request(TOPICS.PROD_GET));
    ipc.handle('prod:todoAdd', (t) => bus.request(TOPICS.PROD_TODO_ADD, { text: String(t || '') }));
    ipc.handle('prod:todoDone', (ref) => bus.request(TOPICS.PROD_TODO_DONE, { ref }));
    ipc.handle('prod:todoRemove', (ref) => bus.request(TOPICS.PROD_TODO_REMOVE, { ref }));
    ipc.handle('prod:noteAdd', (t) => bus.request(TOPICS.PROD_NOTE_ADD, { text: String(t || '') }));
    ipc.handle('prod:remindAdd', (input) => bus.request(TOPICS.PROD_REMIND_ADD, { input: String(input || '') }));
    ipc.handle('prod:remindCancel', (id) => bus.request(TOPICS.PROD_REMIND_CANCEL, { id: String(id || '') }));
    ipc.handle('prod:focusStart', (m) => bus.request(TOPICS.PROD_FOCUS_START, { minutes: Number(m) || 25 }));
    ipc.handle('prod:focusStop', () => bus.request(TOPICS.PROD_FOCUS_STOP));
    ipc.handle('prod:watchAdd', (p) => bus.request(TOPICS.PROD_WATCH_ADD, { path: String(p || '') }));
    ipc.handle('prod:watchRemove', (p) => bus.request(TOPICS.PROD_WATCH_REMOVE, { path: String(p || '') }));
    ipc.handle('prod:watchList', () => bus.request(TOPICS.PROD_WATCH_LIST));
    ipc.on('onboarding:open', (mode) => openOnboarding(['restyle', 'rebirth'].includes(mode) ? mode : 'hatch'));
    // ---- onboarding window → core ----
    ipc.handle('designer:generate', (req) => bus.request(TOPICS.DESIGNER_GENERATE, {
      gender: String(req?.gender || 'girl'), prompt: String(req?.prompt || '').slice(0, 600), name: req?.name ? String(req.name).slice(0, 24) : undefined,
    }));
    ipc.handle('designer:refine', (req) => bus.request(TOPICS.DESIGNER_REFINE, { spec: req?.spec, instruction: String(req?.instruction || '').slice(0, 400) }));
    ipc.handle('designer:voice', (req) => bus.request(TOPICS.DESIGNER_VOICE, {
      voicePrompt: String(req?.voicePrompt || '').slice(0, 400), gender: String(req?.gender || 'girl'), personality: req?.personality,
    }));
    ipc.handle('character:save', (req) => bus.request(TOPICS.CHARACTER_SAVE, { spec: req?.spec, mode: String(req?.mode), keepBond: req?.keepBond !== false }));
    ipc.onFromWindow('win:closeSelf', (w) => w.close());
    // ---- My Tamas window → core (PORT-3..5) ----
    ipc.on('roster:open', (importNow) => openRoster(!!importNow));
    ipc.handle('roster:list', () => bus.request(TOPICS.ROSTER_GET));
    ipc.handle('roster:switch', (id) => bus.request(TOPICS.ROSTER_SWITCH, { id: String(id) }));
    ipc.handle('roster:hatchNew', () => bus.request(TOPICS.ROSTER_HATCH_NEW));
    ipc.handle('roster:graduate', (id) => bus.request(TOPICS.ROSTER_GRADUATE, { id: String(id) }));
    ipc.handle('roster:restore', (id) => bus.request(TOPICS.ROSTER_RESTORE, { id: String(id) }));
    ipc.handle('roster:delete', (id, confirmName) => bus.request(TOPICS.ROSTER_DELETE, { id: String(id), confirmName: String(confirmName || '') }));
    ipc.handle('roster:export', async (o) => {
      const list = (await bus.request(TOPICS.ROSTER_GET)).tamas;
      const t = list.find((/** @type {any} */ x) => x.id === String(o?.id));
      if (!t) return { error: 'No such Tama.' };
      const filePath = await shell.pickSaveTama(null, `${t.name.replace(/[^\w -]/g, '') || 'Tama'}.tama`);
      if (!filePath) return null;
      return bus.request(TOPICS.ROSTER_EXPORT, {
        id: t.id, filePath, password: String(o?.password || ''), includeUser: !!o?.includeUser, includeConnections: !!o?.includeConnections,
      });
    });
    ipc.handle('roster:importPick', async (includeUser) => {
      pickedImport = await shell.pickOpenTama(null);
      if (!pickedImport) return null;
      return bus.request(TOPICS.ROSTER_IMPORT, { filePath: pickedImport, includeUser: !!includeUser });
    });
    ipc.handle('roster:importPassword', (pw, includeUser) => {
      if (!pickedImport) return { error: 'Pick a file first.' };
      return bus.request(TOPICS.ROSTER_IMPORT, { filePath: pickedImport, password: String(pw || ''), includeUser: !!includeUser });
    });

    // ---- terminal window → core ----
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
    ipc.on('agent:permission', (id, choice, feedback) =>
      fire(TOPICS.ENGINE_ANSWER_PERMISSION, { id: Number(id), choice, feedback }));
    ipc.onFromWindow('win:minimize', (w) => w.minimize());
    ipc.onFromWindow('win:maximize', (w) => (w.isMaximized() ? w.unmaximize() : w.maximize()));
    ipc.onFromWindow('win:close', (w) => w.hide());
  }

  return { start };
}

module.exports = { createDesktopChannel };
