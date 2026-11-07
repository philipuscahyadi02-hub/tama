// @ts-check
// Dev-only switches read from the environment (see AGENTS.md §6): open windows, run JS in them, voice tests and traces,
// the perf probe, scripted onboarding, self-test and timed quit. QC-4: moved out of the bootstrap. Never used by users.
const { TOPICS } = require('../bus-topics');

/**
 * @param {{
 *   env: NodeJS.ProcessEnv, bus: import('../bus').BusInstance, pet: any, term: any, chatWin: any, summoner: any,
 *   quit: () => void, ipc: { setProbe: (p: (channel: string, ms: number) => void) => void },
 *   open: { page: (f: string, o: any) => any, roster: (b: boolean) => any, google: () => any, voice: () => any,
 *     settings: (tab?: string) => any, dashboard: (tab?: string) => any, onboarding: (mode: string) => any, setup: () => any },
 *   perf: { startedAt: number, bootMs: () => number, slowCallbacks: () => any[], ipcPerf: null | { add: (c: string, ms: number) => void, top: () => any[] } },
 * }} ctx
 */
function runDevHooks({ env, bus, pet, term, chatWin, summoner, quit, ipc, open, perf }) {
  if (env.TAMA_SHOW_TERM) term.show();
  if (env.TAMA_GALLERY) {
    open.page('dev/gallery.html', { width: 1000, height: 760, frame: true, query: { set: env.TAMA_GALLERY } });
  }
  if (env.TAMA_VOICE_TEST) {
    // Dev: speak once on the desktop, then render + encode a Telegram voice note and report sizes (D-042).
    pet.win.webContents.once('did-finish-load', () => setTimeout(async () => {
      // Several lines separated by "||" are spoken one after another; each logs how soon it started (SET-4).
      let said = /** @type {any} */ (null);
      for (const line of String(env.TAMA_VOICE_TEST).split('||')) {
        said = await bus.request(TOPICS.VOICE_SAY, { text: line, purpose: 'test' }).catch((e) => ({ error: String(e) }));
        console.log('[voice-test] said', JSON.stringify({ line: line.slice(0, 40), engine: said.engine, firstMs: said.firstMs, totalMs: said.totalMs, text: said.text }));
      }
      const r = await bus.request(TOPICS.VOICE_RENDER, { text: String(env.TAMA_VOICE_TEST) }).catch(() => null);
      const enc = r ? await bus.request(TOPICS.VOICE_ENCODE, { wav: r.wav }).catch((e) => ({ error: String(e) })) : null;
      const tDub = Date.now();
      const dubbed = await bus.request(TOPICS.BRAIN_COMPOSE, { kind: 'translate', seed: `${String(env.TAMA_VOICE_TEST).split('||')[0]} (again)` }).catch((e) => String(e));
      console.log('[voice-test] translate only', Date.now() - tDub, 'ms');
      console.log('[voice-test]', JSON.stringify({ dubbed, said, engine: r && r.engine, wavBytes: r && Buffer.from(r.wav, 'base64').length, m4aBytes: enc && enc.data ? Buffer.from(enc.data, 'base64').length : 0, m4aHead: enc && enc.data ? Buffer.from(enc.data, 'base64').subarray(4, 8).toString() : enc && enc.error }));
    }, Number(env.TAMA_VOICE_TEST_AT) || 2000));
  }
  if (env.TAMA_VOICE_TRACE) {
    // Dev (SET-4): log when a chat message is sent, when the reply text is done, and when each voice part plays.
    const t0 = Date.now();
    const at = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
    bus.on(TOPICS.CHAT_EVENT, (/** @type {any} */ ev) => { if (ev.t === 'message') console.log('[voice-trace]', at(), ev.message.role, JSON.stringify(ev.message.text).slice(0, 60), ev.message.ja ? `ja=${ev.message.ja.slice(0, 40)}` : ''); });
    // A skipped reply (e.g. she's asleep at night) is spoken through the test path, which ignores the quiet rules.
    let lastTama = '';
    bus.on(TOPICS.CHAT_EVENT, (/** @type {any} */ ev) => { if (ev.t === 'message' && ev.message.role === 'tama') lastTama = ev.message.text; });
    bus.on(TOPICS.VOICE_SKIPPED, (/** @type {any} */ p) => {
      console.log('[voice-trace]', at(), 'skipped:', p.reason, '→ speaking it via the test path');
      bus.request(TOPICS.VOICE_SAY, { text: lastTama, purpose: 'test' }).catch(() => null);
    });
    bus.on(TOPICS.VOICE_PLAY, (/** @type {any} */ p) => console.log('[voice-trace]', at(), 'play', p.engine, `${(p.part ?? 0) + 1}/${p.parts ?? 1}`, String(p.text).slice(0, 30)));
  }
  if (perf.ipcPerf) ipc.setProbe(perf.ipcPerf.add);
  if (env.TAMA_PERF) {
    // Dev (QC-3): measure idle cost, print it and quit (npm run perf).
    pet.win.webContents.once('did-finish-load', () => require('../platform/perf').runPerfProbe({
      seconds: Number(env.TAMA_PERF) || 30, startedAt: perf.startedAt, quit: quit,
      extra: () => ({ timers: process.getActiveResourcesInfo().filter((x) => x === 'Timeout').length, bootMs: perf.bootMs(), slowCallbacks: perf.slowCallbacks(), ipc: perf.ipcPerf ? perf.ipcPerf.top() : [] }),
    }));
  }
  if (env.TAMA_PET_EVAL) {
    // Dev: run JS in the pet window after load (e.g. "actions.stats()") for screenshots.
    pet.win.webContents.once('did-finish-load', () => setTimeout(() => pet.win.webContents.executeJavaScript(String(env.TAMA_PET_EVAL)).catch(console.error), 1500));
  }
  if (env.TAMA_TERM_EVAL) {
    // Dev: run JS in the terminal window after load (e.g. type commands) for screenshots.
    const tw = term.get();
    tw.webContents.once('did-finish-load', () => setTimeout(() => tw.webContents.executeJavaScript(String(env.TAMA_TERM_EVAL)).catch(console.error), 1500));
  }
  if (env.TAMA_CHAT_EVAL || env.TAMA_OPEN_CHAT) {
    // Dev: open the chat window, optionally run JS in it after load (e.g. send a message) for screenshots.
    chatWin.show();
    const cw = chatWin.window();
    if (cw && env.TAMA_CHAT_EVAL) {
      cw.webContents.once('did-finish-load', () => setTimeout(() => cw.webContents.executeJavaScript(String(env.TAMA_CHAT_EVAL)).catch(console.error), 1500));
    }
  }
  if (env.TAMA_OPEN_ROSTER) open.roster(false);
  if (env.TAMA_OPEN_SETUP) open.setup();
  if (env.TAMA_OPEN_GOOGLE) open.google();
  if (env.TAMA_OPEN_VOICE) open.voice();
  if (env.TAMA_OPEN_SETTINGS) open.settings(env.TAMA_OPEN_SETTINGS === '1' ? '' : env.TAMA_OPEN_SETTINGS);
  if (env.TAMA_OPEN_DASHBOARD) open.dashboard(env.TAMA_OPEN_DASHBOARD === 'limits' ? 'limits' : undefined);
  if (env.TAMA_OPEN_ONBOARDING) open.onboarding(env.TAMA_OPEN_ONBOARDING);
  if (env.TAMA_ONBOARD_WALK) {
    require('./onboarding-walk').runOnboardingWalk({
      openOnboarding: open.onboarding, petWin: pet.win, outDir: env.TAMA_ONBOARD_WALK, quit: quit, log: console.log,
      prompt: env.TAMA_WALK_PROMPT || 'a sleepy cat boy with headphones who loves coffee',
    });
  }
  // Dev: quit cleanly after N ms (stoppers run, so voice engines Tama started are stopped too).
  if (env.TAMA_QUIT_AFTER) setTimeout(() => quit(), Number(env.TAMA_QUIT_AFTER) || 60000);
  if (env.TAMA_SELFTEST) {
    require('./selftest').runSelfTest({ pet, summoner, workAreas: require('../platform/displays').workAreas, quit: quit });
  }
}

module.exports = { runDevHooks };
