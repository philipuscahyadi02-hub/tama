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
const { watchPower, keepAwake } = require('./platform/power');
const { createRoster } = require('./services/roster');
const { createDesigner } = require('./services/designer');
const { createProductivity } = require('./services/productivity');
const { createUiPrefs } = require('./services/ui');
const { createMemory } = require('./services/memory');
const { createEvents } = require('./services/events');
const EVENT_DECK = require('../../assets/events/deck.json');
const { createGoogle } = require('./services/google');
const googleOAuth = require('./platform/google-oauth');
const { createTelegram } = require('./services/telegram');
const { createUsageLog } = require('./services/usage');
const { createAccounts } = require('./services/accounts');
const engineAccounts = require('./engines/accounts');
const { createLimits } = require('./services/usage/limits');
const { fetchClaudeLimits } = require('./engines/claude/limits');
const { createVoice } = require('./services/voice');
const { createVvEngines } = require('./services/voice/vv-engine');
const sapi = require('./platform/tts-sapi');
const { createVoiceEngineProcess } = require('./platform/voice-engine-process');
const { createChatTools } = require('./brain/chat-tools');
const { startToolBridge } = require('./platform/tool-bridge');
const os = require('os');
const { createGitWatcher } = require('./services/productivity/git-watcher');
const git = require('./platform/git');
const { askJson } = require('./engines/claude/oneshot');
const { openPage, openPages } = require('./platform/windows/page-window');
const { createPetService } = require('./services/pet');
const { createBrain } = require('./brain');
const { createPermissionGate } = require('./brain/permission-gate');
const { ClaudeCodeEngine, CLAUDE_EXE } = require('./engines/claude/session');
const { AgyEngine } = require('./engines/agy/session');
const { CHAT_ALLOW, DENY_ALL } = require('./engines/agy/setup');
const { findAgyExecutable } = require('./engines/agy/setup');
const pathMod = require('path');
// M5 extras (D-035): weather, fullscreen do-not-disturb, "out for a walk" marker.
const { createWeather } = require('./services/weather');
const { createFullscreenDetector } = require('./platform/fullscreen');
const { createWalkMarker } = require('./platform/windows/walk-marker');

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
  // Usage log first, so every service's calls are recorded from the start (M8, D-040).
  const usageLog = createUsageLog({ bus, store, device });
  stoppers.push(usageLog.start());
  // What's left (D-041): Claude plan windows live (no message, $0) + from each turn; Gemini tier; Google month counts.
  stoppers.push(createLimits({ bus, store, device, entries: () => usageLog.entries(), refreshClaude: fetchClaudeLimits }).start());
  const gate = createPermissionGate({ bus });
  // Google (M6, D-034): the user's own OAuth client; tools reach Claude Code as an MCP server while signed in.
  const google = createGoogle({
    bus, secrets, device, oauth: googleOAuth, openExternal: shell.openExternal, tama: active, deviceName: os.hostname(),
  });
  gate.addRule(google.gateRule);
  // Google tools for the chat brain (D-037): served by a localhost bridge; agy reaches it through a tiny MCP relay.
  const chatTools = createChatTools({ bus, tools: () => (google.status().signedIn ? google.tools : []) });
  /** @type {{ url: string, key: string, close: () => void } | null} */
  let bridge = null;
  const relay = pathMod.join(__dirname, 'engines', 'agy', 'mcp-relay.js').replace(`app.asar${pathMod.sep}`, `app.asar.unpacked${pathMod.sep}`);
  const chatMcp = () => (bridge && google.status().signedIn ? [{
    name: 'tama', command: process.execPath, args: [relay],
    env: [{ name: 'ELECTRON_RUN_AS_NODE', value: '1' }, { name: 'TAMA_BRIDGE_URL', value: bridge.url }, { name: 'TAMA_BRIDGE_KEY', value: bridge.key }],
  }] : []);
  const brain = createBrain({
    bus, device, gate, git, scratchDir: pathMod.join(appShell.paths.data(), 'agy-workspace'),
    available: { claude: !!CLAUDE_EXE, agy: !!findAgyExecutable() },
    factories: {
      claudeWorker: (emit) => new ClaudeCodeEngine(emit, { role: 'worker', gate, tamaName: active.name, mcp: () => google.mcpServers() }),
      // agy always runs in read-only PLAN mode (verified: no commands, no file writes; npm run probe:agy, D-027).
      // Hard lock (D-037): a PreToolUse hook in the session folder denies every tool except Tama's own + web search.
      agyChat: (emit, persona) => new AgyEngine(emit, {
        role: 'lite', gate, persona, model: 'gemini-3.8-flash-low', thoughtLevel: 'low', mode: 'plan', lockMode: true, mcpServers: chatMcp, guard: CHAT_ALLOW,
      }),
      // Events + diary text: no tools at all.
      agyCompose: (emit, persona) => new AgyEngine(emit, {
        role: 'lite', gate, persona, model: 'gemini-3.8-flash-low', thoughtLevel: 'low', mode: 'plan', lockMode: true, guard: DENY_ALL,
      }),
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

  const openGoogle = () => openPage('google/google.html', { width: 780, height: 720, title: 'Connect Google', frame: true });
  const openDashboard = (tab = '') => openPage('dashboard/dashboard.html', { width: 1060, height: 780, title: 'Usage & accounts', frame: true, query: tab ? { tab } : {} });
  const openRoster = (/** @type {boolean | undefined} */ importNow) =>
    openPage('roster/roster.html', { width: 900, height: 660, title: 'My Tamas', query: importNow ? { import: '1' } : {} });
  createDesktopChannel({ bus, ipc, shell, pet, term, chat: chatWin, summon, openOnboarding, openRoster, openGoogle, openDashboard, pages: openPages }).start();
  // Voice (M9, D-042/D-043): created before the tray, whose Voice submenu shows its setting; started with the services.
  const engineProc = createVoiceEngineProcess({
    exePath: () => (device.get().voice || {}).enginePath, gpu: () => (device.get().voice || {}).gpu !== false,
    pidFile: pathMod.join(appShell.paths.data(), 'voice-engine.pid'),
  });
  if (engineProc.cleanupStale()) debug('voice: stopped an AivisSpeech engine left over from a previous run');
  const voice = createVoice({ bus, device, sapi, vv: createVvEngines(), tamaId: active.id, engineProc });
  /** Tray menu; the Voice submenu shows the current choice (D-043). @param {string} lang */
  const trayItems = (lang) => [
      { label: `Summon ${active.name}  (Ctrl+Alt+P)`, click: () => summon('tray-menu') },
      { label: `Chat with ${active.name}  (Ctrl+Alt+J)`, click: () => chatWin.show() },
      { label: 'Open terminal  (Ctrl+Alt+K)', click: () => term.show() },
      { label: 'Show / Hide', click: () => pet.toggleVisible() },
      { label: 'Voice', submenu: [
        { label: 'English (Windows voice)', type: 'radio', checked: lang === 'en', click: () => bus.request(TOPICS.VOICE_SET, { lang: 'en' }).catch(() => null) },
        { label: 'Japanese dub (AivisSpeech)', type: 'radio', checked: lang === 'ja', click: () => bus.request(TOPICS.VOICE_SET, { lang: 'ja' }).catch(() => null) },
        { label: 'No voice', type: 'radio', checked: lang === 'off', click: () => bus.request(TOPICS.VOICE_SET, { lang: 'off' }).catch(() => null) },
      ] },
      { label: 'My Tamas…', click: () => openRoster(false) },
      { label: 'Google…', click: () => openGoogle() },
      { label: 'Usage & accounts…', click: () => openDashboard() },
      { label: 'Limits left…', click: () => openDashboard('limits') },
      { label: 'Restyle…', click: () => openOnboarding('restyle') },
      { label: 'Rebirth…', click: () => openOnboarding('rebirth') },
      { type: 'separator' },
      { label: 'Feed', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'feed' }) },
      { label: 'Play', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'play' }) },
      { label: 'Energy snack', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'snack' }) },
      { label: 'Bedtime (sleep / wake)', click: () => bus.emit(TOPICS.TRAY_ACTION, { action: 'sleep' }) },
      { type: 'separator' },
      { label: 'Quit', click: appShell.quit },
  ];
  const tray = shell.createTray({
    tooltip: `${active.name} (Tama)`,
    onClick: () => summon('tray-click'),
    items: trayItems(voice.status().lang),
  });
  bus.on(TOPICS.VOICE_CHANGED, (/** @type {any} */ st) => shell.setTrayItems(tray, trayItems(st.lang)));
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
  stoppers.push(brain.start(), createUiPrefs({ bus, device }).start(), google.start(), chatTools.start());
  startToolBridge(chatTools).then((b) => { bridge = b; stoppers.push(() => b.close()); }).catch((e) => console.error('[tama] tool bridge failed', e));
  // Telegram (M7, D-008, D-036): long polling from this PC; one paired chat; /code via the same Claude session.
  // Tama's desk: an empty folder of her own, so phone tasks that need no project (Google, questions) have a safe place to run.
  const desk = pathMod.join(appShell.paths.data(), 'desk');
  require('fs').mkdirSync(desk, { recursive: true });
  stoppers.push(createTelegram({ bus, secrets, device, git, snapshot: () => pet.snapshot(), keepAwake, tama: active, desk }).start());
  // Voice (M9, D-042): AivisSpeech / VOICEVOX when running, Windows' built-in voice otherwise.
  stoppers.push(voice.start());
  // Accounts (M8, D-040): sign-ins stay in the official tools; switching opens their sign-in in a console window.
  stoppers.push(createAccounts({
    bus,
    claude: { status: engineAccounts.claudeStatus, switch: () => shell.runConsoleScript('switch-claude', engineAccounts.switchScript('claude')) },
    gemini: { status: () => engineAccounts.geminiStatus(), switch: () => shell.runConsoleScript('switch-agy', engineAccounts.switchScript('gemini')) },
  }).start());
  // Events & memory (M5, D-033): facts + diary per Tama, event deck from assets/events.
  stoppers.push(createMemory({ bus, store, tamaId: active.id }).start(), createEvents({ bus, store, tamaId: active.id, deck: EVENT_DECK }).start());
  // ---- M5 extras (D-035) ----
  // Weather (EVT-1): Open-Meteo for the per-PC city set with /weather. Fullscreen DND (PET-6): asked once per events tick.
  const fullscreen = createFullscreenDetector({ onError: (message) => bus.emit(TOPICS.APP_ERROR, { topic: 'fullscreen', message }) });
  const offFullscreen = bus.handle(TOPICS.DEVICE_FULLSCREEN_GET, () => fullscreen.isFullscreen());
  stoppers.push(createWeather({ bus, device }).start(), offFullscreen, () => fullscreen.stop());
  // "Out for a walk" (SUM-5): a small edge tab while the user has hidden the pet; clicking it summons her.
  const walkMarker = createWalkMarker();
  const syncMarker = () => bus.request(TOPICS.UI_PREFS_GET).catch(() => null).then((ui) => {
    if (pet.isHiddenByUser() && !(ui && ui.walkMarker === false)) walkMarker.show(); else walkMarker.hide();
  }).catch((e) => bus.emit(TOPICS.APP_ERROR, { topic: 'walk-marker', message: String(e.message || e) }));
  pet.win.on('hide', syncMarker);
  pet.win.on('show', syncMarker);
  stoppers.push(bus.on(TOPICS.UI_PREFS_CHANGED, syncMarker), () => walkMarker.destroy());
  if (process.env.TAMA_HIDE_PET) setTimeout(() => pet.hide(), 1500); // dev: start hidden (walk-marker screenshots)

  summoner.startWatchdog();
  stoppers.push(() => summoner.stop(), () => petService.stop(), () => store.flush(), shell.unregisterHotkeys);

  secondInstance = () => summon('second-instance');
  if (process.env.TAMA_SHOW_TERM) term.show();
  if (process.env.TAMA_GALLERY) {
    openPage('dev/gallery.html', { width: 1000, height: 760, frame: true, query: { set: process.env.TAMA_GALLERY } });
  }
  if (process.env.TAMA_VOICE_TEST) {
    // Dev: speak once on the desktop, then render + encode a Telegram voice note and report sizes (D-042).
    pet.win.webContents.once('did-finish-load', () => setTimeout(async () => {
      const said = await bus.request(TOPICS.VOICE_SAY, { text: String(process.env.TAMA_VOICE_TEST), purpose: 'test' }).catch((e) => ({ error: String(e) }));
      const r = await bus.request(TOPICS.VOICE_RENDER, { text: String(process.env.TAMA_VOICE_TEST) }).catch(() => null);
      const enc = r ? await bus.request(TOPICS.VOICE_ENCODE, { wav: r.wav }).catch((e) => ({ error: String(e) })) : null;
      const dubbed = await bus.request(TOPICS.BRAIN_COMPOSE, { kind: 'translate', seed: String(process.env.TAMA_VOICE_TEST) }).catch((e) => String(e));
      console.log('[voice-test]', JSON.stringify({ dubbed, said, engine: r && r.engine, wavBytes: r && Buffer.from(r.wav, 'base64').length, m4aBytes: enc && enc.data ? Buffer.from(enc.data, 'base64').length : 0, m4aHead: enc && enc.data ? Buffer.from(enc.data, 'base64').subarray(4, 8).toString() : enc && enc.error }));
    }, 2000));
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
  if (process.env.TAMA_OPEN_GOOGLE) openGoogle();
  if (process.env.TAMA_OPEN_DASHBOARD) openDashboard(process.env.TAMA_OPEN_DASHBOARD === 'limits' ? 'limits' : undefined);
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
