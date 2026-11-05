// @ts-check
// Desktop channel: translates between the two renderer windows and the bus. No business rules here.
const { TOPICS } = require('../../bus-topics');

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   ipc: typeof import('../../platform/ipc'),
 *   shell: typeof import('../../platform/shell'),
 *   pet: import('../../platform/windows/pet-window').PetWindow,
 *   term: import('../../platform/windows/terminal-window').TerminalWindow,
 *   summon: (reason: string) => void,
 * }} deps
 */
function createDesktopChannel({ bus, ipc, shell, pet, term, summon }) {
  const both = () => [pet.win, term.window()];
  /** Fire-and-forget request; failures surface on app.error instead of becoming unhandled rejections. @param {string} topic @param {any} [payload] */
  const fire = (topic, payload) => { bus.request(topic, payload).catch((e) => bus.emit(TOPICS.APP_ERROR, { topic, message: String(e.message || e) })); };
  /** @param {string} name @param {any} payload */
  const toAll = (name, payload) => { for (const w of both()) ipc.sendUi(w, name, payload); };

  function start() {
    // ---- bus → renderers ----
    bus.on(TOPICS.PET_STATE_CHANGED, (p) => ipc.sendUi(pet.win, 'pet.state', p));
    bus.on(TOPICS.SUMMON_DONE, (p) => ipc.sendUi(pet.win, 'summon', p));
    bus.on(TOPICS.TRAY_ACTION, (p) => ipc.sendUi(pet.win, 'tray', p.action));
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
    ipc.handle('pet:act', (action) => bus.request(TOPICS.PET_ACT, { action: String(action) }));
    ipc.on('notify', (title, body) => shell.notify(String(title), String(body)));
    ipc.on('term:show', () => term.show());
    ipc.on('summon', () => summon('ui'));

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
