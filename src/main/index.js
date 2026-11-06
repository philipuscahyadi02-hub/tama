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
const { createChatWindow } = require('./platform/windows/chat-window');
const { createSummoner } = require('./platform/summon');
const ipc = require('./platform/ipc');
const shell = require('./platform/shell');
const files = require('./platform/files');
const { watchPower } = require('./platform/power');
const { createRoster } = require('./services/roster');
const { createDesigner } = require('./services/designer');
const { createProductivity } = require('./services/productivity');
const { createGitWatcher } = require('./services/productivity/git-watcher');
const git = require('./platform/git');
const { askJson } = require('./engines/claude/oneshot');
const { openPage } = require('./platform/windows/page-window');
const { createPetService } = require('./services/pet');
const { createBrain } = require('./brain');
const { createPermissionGate } = require('./brain/permission-gate');
const { ClaudeCodeEngine, CLAUDE_EXE } = require('./engines/claude/session');
const { AgyEngine } = require('./engines/agy/session');
const { findAgyExecutable } = require('./engines/agy/setup');
const pathMod = require('path');

const { createDesktopChannel } = require('./channels/desktop');

const HOTKEYS = { summon: 'CommandOrControl+Alt+P', terminal: 'CommandOrControl+Alt+K', chat: 'CommandOrControl+Alt+J' };
const debug = (/** @type {string} */ m) => { if (process.env.TAMA_DEBUG) console.log('[tama]', m); };

/** @type {Array<() => void>} */
const stoppers = [];

function boot() {
  const bus = new Bus();
  bus.on(TOPICS.APP_ERROR, (e) => console.error('[bus error]', e.topic, e.message));
  if (process.env.TAMA_DEBUG) {
    bus.on(TOPICS.ENGINE_EVENT, ({ engine, ev }) => { if (ev.t !== 'text-delta') debug(`engine ${engine} ${ev.t} ${ev.t === 'tool-progress' ? ev.chars : ev.state || ev.name || ''}`); });
  }
  const store = createStore(appShell.paths.data());

  // ---- services ----
  const secrets = createSecrets(appShell.paths.data(), electronCipher());
  const roster = createRoster({
    bus, store, legacySaveFiles: appShell.paths.legacyKeroSaves(),
    relaunch: appShell.relaunch, files, secrets, appVersion: appShell.version(),
  });
  const active = roster.ensureActive();
  stoppers.push(roster.start(active));
  const petService = createPetService({ bus, store, tama: active });
  const device = createDeviceSettings(store);
  // Brain: terminal = Claude Code, chat = agy (D-029), every tool approval through one PermissionGate.
  const gate = createPermissionGate({ bus });
  const brain = createBrain({
    bus, device, gate, git, scratchDir: pathMod.join(appShell.paths.data(), 'agy-workspace'),
    available: { claude: !!CLAUDE_EXE, agy: !!findAgyExecutable() },
    factories: {
      claudeWorker: (emit) => new ClaudeCodeEngine(emit, { role: 'worker', gate, tamaName: active.name }),
      // agy always runs in read-only PLAN mode (verified: no commands, no file writes; npm run probe:agy, D-027).
      agyChat: (emit, persona) => new AgyEngine(emit, { role: 'lite', gate, persona, model: 'gemini-3.8-flash-low', thoughtLevel: 'low', mode: 'plan', lockMode: true }),
    },
  });

  // ---- windows ----
  const win = device.get().windows || {};
  const pet = createPetWindow({ savedPosition: win.pet, onMoved: (pos) => device.patch('windows', { pet: pos }) });
  const term = createTerminalWindow({
    savedBounds: win.terminal, onBoundsChanged: (b) => device.patch('windows', { terminal: b }), isQuitting: appShell.isQuitting,
  });
  term.create();
  const chatWin = createChatWindow({
    savedBounds: win.chat, onBoundsChanged: (b) => device.patch('windows', { chat: b }), isQuitting: appShell.isQuitting,
    anchor: () => pet.win.getBounds(),
  });
  const summoner = createSummoner({ pet, log: debug, onSummoned: (reason) => bus.emit(TOPICS.SUMMON_DONE, { reason }) });
  const summon = (/** @type {string} */ reason) => summoner.summon(reason);
  bus.handle(TOPICS.SUMMON, (/** @type {{reason?: string}} */ p) => summon((p && p.reason) || 'bus'));

  // ---- channels ----
  // Designer: Claude Haiku with tools disabled, keyword fallback (D-021). Moves to the M3 lite brain.
  stoppers.push(createDesigner({ bus, askJson: process.env.TAMA_OFFLINE_DESIGNER ? null : askJson, log: debug }).start());
  const openOnboarding = (/** @type {string} */ mode) =>
    openPage('onboarding/onboarding.html', { width: 940, height: 700, title: 'Hatch your Tama', query: { mode } });

  const openRoster = (/** @type {boolean | undefined} */ importNow) =>
    openPage('roster/roster.html', { width: 900, height: 660, title: 'My Tamas', query: importNow ? { import: '1' } : {} });
  createDesktopChannel({ bus, ipc, shell, pet, term, chat: chatWin, summon, openOnboarding, openRoster }).start();
  shell.createTray({
    tooltip: `${active.name} (Tama)`,
    onClick: () => summon('tray-click'),
    items: [
      { label: `Summon ${active.name}  (Ctrl+Alt+P)`, click: () => summon('tray-menu') },
      { label: `Chat with ${active.name}  (Ctrl+Alt+J)`, click: () => chatWin.show() },
      { label: 'Open terminal  (Ctrl+Alt+K)', click: () => term.show() },
      { label: 'Show / Hide', click: () => pet.toggleVisible() },
      { label: 'My Tamas…', click: () => openRoster(false) },
      { label: 'Restyle…', click: () => openOnboarding('restyle') },
      { label: 'Rebirth…', click: () => openOnboarding('rebirth') },
      { type: 'separator' },
      { label: 'Feed', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'feed' }) },
      { label: 'Play', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'play' }) },
      { label: 'Energy snack', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'snack' }) },
      { label: 'Bedtime (sleep / wake)', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'sleep' }) },
      { type: 'separator' },
      { label: 'Quit', click: appShell.quit },
    ],
  });
  const failed = shell.registerHotkeys({ [HOTKEYS.summon]: () => summon('hotkey'), [HOTKEYS.terminal]: () => term.toggle(), [HOTKEYS.chat]: () => chatWin.toggle() });
  if (failed.length && !process.env.TAMA_DATA_DIR) shell.notify('Tama', `Hotkey already in use by another app: ${failed.join(', ')}`);

  petService.start();
  // Productivity (PROD-1/2): todos, focus timer, reminders, notes, git commit watcher.
  stoppers.push(createProductivity({ bus, store }).start(), createGitWatcher({ bus, device, git }).start());
  // Easy energy (PET-3): charging on AC, auto-nap while you're away.
  stoppers.push(watchPower({
    onPower: (onAC) => bus.emit(TOPICS.DEVICE_POWER_CHANGED, { onAC }),
    onIdle: (idle, idleSeconds) => bus.emit(TOPICS.DEVICE_IDLE_CHANGED, { idle, idleSeconds }),
  }));
  stoppers.push(brain.start());
  summoner.startWatchdog();
  stoppers.push(() => summoner.stop(), () => petService.stop(), () => store.flush(), shell.unregisterHotkeys);

  secondInstance = () => summon('second-instance');
  if (process.env.TAMA_SHOW_TERM) term.show();
  if (process.env.TAMA_GALLERY) {
    openPage('dev/gallery.html', { width: 1000, height: 760, frame: true, query: { set: process.env.TAMA_GALLERY } });
  }
  if (process.env.TAMA_PET_EVAL) {
    // Dev: run JS in the pet window after load (e.g. "actions.stats()") for screenshots.
    pet.win.webContents.once('did-finish-load', () => setTimeout(() => pet.win.webContents.executeJavaScript(String(process.env.TAMA_PET_EVAL)).catch(console.error), 1500));
  }
  if (process.env.TAMA_TERM_EVAL) {
    // Dev: run JS in the terminal window after load (e.g. type commands) for screenshots.
    const tw = term.get();
    tw.webContents.once('did-finish-load', () => setTimeout(() => tw.webContents.executeJavaScript(String(process.env.TAMA_TERM_EVAL)).catch(console.error), 1500));
  }
  if (process.env.TAMA_CHAT_EVAL || process.env.TAMA_OPEN_CHAT) {
    // Dev: open the chat window, optionally run JS in it after load (e.g. send a message) for screenshots.
    chatWin.show();
    const cw = chatWin.window();
    if (cw && process.env.TAMA_CHAT_EVAL) {
      cw.webContents.once('did-finish-load', () => setTimeout(() => cw.webContents.executeJavaScript(String(process.env.TAMA_CHAT_EVAL)).catch(console.error), 1500));
    }
  }
  if (process.env.TAMA_OPEN_ROSTER) openRoster(false);
  if (process.env.TAMA_OPEN_ONBOARDING) openOnboarding(process.env.TAMA_OPEN_ONBOARDING);
  if (process.env.TAMA_ONBOARD_WALK) {
    require('./dev/onboarding-walk').runOnboardingWalk({
      openOnboarding, petWin: pet.win, outDir: process.env.TAMA_ONBOARD_WALK, quit: appShell.quit, log: console.log,
      prompt: process.env.TAMA_WALK_PROMPT || 'a sleepy cat boy with headphones who loves coffee',
    });
  }
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
