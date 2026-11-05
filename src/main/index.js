// @ts-check
// Bootstrap: wire platform → services → engines → channels. No logic of its own.
const { Bus } = require('./bus');
const { TOPICS } = require('./bus-topics');
const appShell = require('./platform/app');
const { createStore } = require('./platform/store');
const { createDeviceSettings } = require('./platform/store/device');
const { createSecrets, electronCipher } = require('./platform/secrets');
const { createPetWindow } = require('./platform/windows/pet-window');
const { createTerminalWindow } = require('./platform/windows/terminal-window');
const { createSummoner } = require('./platform/summon');
const ipc = require('./platform/ipc');
const shell = require('./platform/shell');
const { createRoster } = require('./services/roster');
const { createPetService } = require('./services/pet');
const { createEngineHost } = require('./engines');
const { createDesktopChannel } = require('./channels/desktop');

const HOTKEYS = { summon: 'CommandOrControl+Alt+P', terminal: 'CommandOrControl+Alt+K' };
const debug = (/** @type {string} */ m) => { if (process.env.TAMA_DEBUG) console.log('[tama]', m); };

/** @type {Array<() => void>} */
const stoppers = [];

function boot() {
  const bus = new Bus();
  bus.on(TOPICS.APP_ERROR, (e) => console.error('[bus error]', e.topic, e.message));
  const store = createStore(appShell.paths.data());
  createSecrets(appShell.paths.data(), electronCipher()); // ready for M6/M7; nothing stored in M0

  // ---- services ----
  const roster = createRoster({ bus, store, legacySaveFiles: appShell.paths.legacyKeroSaves() });
  const active = roster.ensureActive();
  stoppers.push(roster.start(active));
  const petService = createPetService({ bus, store, tama: active });
  const device = createDeviceSettings(store);
  const engines = createEngineHost({ bus, device, tamaName: active.name });

  // ---- windows ----
  const win = device.get().windows || {};
  const pet = createPetWindow({ savedPosition: win.pet, onMoved: (pos) => device.patch('windows', { pet: pos }) });
  const term = createTerminalWindow({
    savedBounds: win.terminal, onBoundsChanged: (b) => device.patch('windows', { terminal: b }), isQuitting: appShell.isQuitting,
  });
  term.create();
  const summoner = createSummoner({ pet, log: debug, onSummoned: (reason) => bus.emit(TOPICS.SUMMON_DONE, { reason }) });
  const summon = (/** @type {string} */ reason) => summoner.summon(reason);
  bus.handle(TOPICS.SUMMON, (/** @type {{reason?: string}} */ p) => summon((p && p.reason) || 'bus'));

  // ---- channels ----
  createDesktopChannel({ bus, ipc, shell, pet, term, summon }).start();
  shell.createTray({
    tooltip: `${active.name} (Tama)`,
    onClick: () => summon('tray-click'),
    items: [
      { label: `Summon ${active.name}  (Ctrl+Alt+P)`, click: () => summon('tray-menu') },
      { label: 'Open terminal  (Ctrl+Alt+K)', click: () => term.show() },
      { label: 'Show / Hide', click: () => pet.toggleVisible() },
      { type: 'separator' },
      { label: 'Feed', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'feed' }) },
      { label: 'Play', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'play' }) },
      { type: 'separator' },
      { label: 'Quit', click: appShell.quit },
    ],
  });
  const failed = shell.registerHotkeys({ [HOTKEYS.summon]: () => summon('hotkey'), [HOTKEYS.terminal]: () => term.toggle() });
  if (failed.length) shell.notify('Tama', `Hotkey already in use by another app: ${failed.join(', ')}`);

  petService.start();
  engines.start();
  summoner.startWatchdog();
  stoppers.push(() => summoner.stop(), () => engines.stop(), () => petService.stop(), () => store.flush(), shell.unregisterHotkeys);

  secondInstance = () => summon('second-instance');
  if (process.env.TAMA_SHOW_TERM) term.show();
  if (process.env.TAMA_SELFTEST) {
    require('./dev/selftest').runSelfTest({ pet, summoner, workAreas: require('./platform/displays').workAreas, quit: appShell.quit });
  }
}

let secondInstance = () => {};

appShell.run({
  boot,
  onSecondInstance: () => secondInstance(),
  beforeQuit: () => {
    for (const stop of stoppers.splice(0).reverse()) {
      try { stop(); } catch (e) { console.error('[tama] shutdown step failed', e); }
    }
  },
});
