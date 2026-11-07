// @ts-check
// Setup wizard (SHIP-4, D-059): what Tama can use on this PC, what each thing unlocks, and the next step for each
// (install with the official installer, sign in with the official CLI, or open the right page). Shown on first run when
// chat or coding has nothing behind it, and any time from Settings, the tray or /setup. Electron-free: installing and
// signing in run through injected functions (visible console windows from the bootstrap).
const { TOPICS } = require('../../bus-topics');

/**
 * @typedef {'ready'|'signin'|'missing'|'optional'} SetupState
 * @typedef {{ id: string, name: string, state: SetupState, detail: string, unlocks: string, core: boolean,
 *   actions: Array<{ id: string, label: string, primary?: boolean, command?: string, link?: string }> }} SetupItem
 */

/** Official pages, opened with the user's browser through platform/shell's allow-list. */
const LINKS = {
  claude: 'https://docs.claude.com/en/docs/claude-code/setup',
  agy: 'https://antigravity.google/',
  aivis: 'https://aivis-project.com/',
  voicevox: 'https://voicevox.hiroshiba.jp/',
};
/** The official one-line installers (shown to the user before they run, in a visible window). */
const INSTALL = {
  claude: 'irm https://claude.ai/install.ps1 | iex',
  agy: 'irm https://antigravity.google/cli/install.ps1 | iex',
};

/**
 * Pure: turn the status of every part into wizard items.
 * @param {{ providers: any, accounts: any, voice: any }} s
 * @returns {SetupItem[]}
 */
function buildItems({ providers, accounts, voice }) {
  const avail = (/** @type {string} */ id) => !!((providers && providers.providers) || []).find((p) => p.id === id && p.available);
  const acc = accounts || {};
  const items = /** @type {SetupItem[]} */ ([]);

  const c = acc.claude || {};
  const claudeIn = avail('claude');
  items.push({
    id: 'claude', name: 'Claude Code', core: true,
    unlocks: 'The terminal (coding with her), designing new looks. Can also chat if you allow it (Settings → Brains).',
    state: !claudeIn ? 'missing' : c.loggedIn ? 'ready' : 'signin',
    detail: !claudeIn ? 'Not installed.' : c.loggedIn ? `Signed in${c.email ? ` as ${c.email}` : ''}${c.plan ? ` (${c.plan})` : ''}.` : 'Installed, not signed in yet.',
    actions: !claudeIn
      ? [{ id: 'install', label: 'Install Claude Code', primary: true, command: INSTALL.claude }, { id: 'link', label: 'Official guide', link: LINKS.claude }]
      : c.loggedIn ? [] : [{ id: 'signin', label: 'Sign in', primary: true }],
  });

  const g = acc.gemini || {};
  const agyIn = avail('agy');
  items.push({
    id: 'agy', name: 'Gemini (Antigravity CLI)', core: true,
    unlocks: 'Chatting with her, her moments and diary, the Japanese voice dub, Google and Telegram chat. Uses your Google AI plan, not Claude.',
    state: !agyIn ? 'missing' : g.email ? 'ready' : 'signin',
    detail: !agyIn ? 'Not installed.' : g.email ? `Signed in as ${g.email}.` : 'Installed. Sign in once if you haven\'t yet.',
    actions: !agyIn
      ? [{ id: 'install', label: 'Install agy', primary: true, command: INSTALL.agy }, { id: 'link', label: 'Official site', link: LINKS.agy }]
      : g.email ? [] : [{ id: 'signin', label: 'Sign in', primary: true }],
  });

  const engines = (voice && voice.engines) || [];
  const anyVoice = engines.some((/** @type {any} */ e) => e.installed);
  items.push({
    id: 'voice', name: 'Anime voice (AivisSpeech or VOICEVOX)', core: false,
    unlocks: 'Her Japanese anime voice with moods. Without it she speaks English with the Windows voice.',
    state: anyVoice ? 'ready' : 'optional',
    detail: anyVoice ? `Installed: ${engines.filter((/** @type {any} */ e) => e.installed).map((/** @type {any} */ e) => e.name || e.id).join(', ')}.` : 'Optional. Free, runs on this PC.',
    actions: anyVoice ? [{ id: 'open', label: 'Choose her voice' }]
      : [{ id: 'link-aivis', label: 'AivisSpeech', link: LINKS.aivis }, { id: 'link-voicevox', label: 'VOICEVOX', link: LINKS.voicevox }, { id: 'open', label: 'Voice page' }],
  });

  const go = acc.google || {};
  items.push({
    id: 'google', name: 'Google (Calendar, Gmail, Drive)', core: false,
    unlocks: 'Calendar, email drafts, Drive, Docs and Sheets from chat and the terminal, plus daily Drive backups of her.',
    state: go.signedIn ? 'ready' : 'optional',
    detail: go.signedIn ? `Connected${go.email ? ` as ${go.email}` : ''}.` : go.configured ? 'Your Google app is saved; sign in to finish.' : 'Optional. About 5 minutes with your own Google Cloud app.',
    actions: go.signedIn ? [] : [{ id: 'open', label: go.configured ? 'Sign in' : 'Set up Google', primary: !go.configured ? false : true }],
  });

  const tg = acc.telegram || {};
  items.push({
    id: 'telegram', name: 'Telegram (her on your phone)', core: false,
    unlocks: 'Chat, care, todos and voice notes from your phone; coding on the PC from the phone in folders you allow.',
    state: tg.paired ? 'ready' : 'optional',
    detail: tg.paired ? `Paired${tg.bot ? ` with @${tg.bot}` : ''}.` : 'Optional. Needs a bot from @BotFather (2 minutes).',
    actions: tg.paired ? [] : [{ id: 'open', label: 'Set up phone' }],
  });
  return items;
}

/** Is anything she needs for chat or coding missing? Pure. @param {SetupItem[]} items */
const needsSetup = (items) => !items.some((i) => i.id === 'agy' && i.state !== 'missing') || !items.some((i) => i.id === 'claude' && i.state !== 'missing');

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   device: { get: () => any, patch: (s: string | null, p: any) => void },
 *   run: { install: (id: 'claude'|'agy') => void, signIn: (id: 'claude'|'agy') => void, open: (id: string) => void, link: (url: string) => unknown },
 *   now?: () => number,
 * }} deps
 */
function createSetup({ bus, device, run, now = Date.now }) {
  /** @param {{ recheck?: boolean }} [o] */
  async function status(o = {}) {
    const [providers, accounts, voice] = await Promise.all([
      bus.request(o.recheck ? TOPICS.PROVIDERS_RECHECK : TOPICS.PROVIDERS_GET).catch(() => null),
      bus.request(TOPICS.ACCOUNTS_GET, { refresh: !!o.recheck }).catch(() => null),
      bus.request(TOPICS.VOICE_STATUS).catch(() => null),
    ]);
    const items = buildItems({ providers, accounts, voice });
    const brains = providers ? Object.fromEntries(Object.entries(providers.caps || {}).map(([k, v]) => [k, /** @type {any} */ (v).using])) : {};
    return { items, brains, needsSetup: needsSetup(items), seenAt: (device.get().setup || {}).seenAt || null };
  }

  /** @param {{ item?: string, action?: string }} p */
  async function act(p) {
    const item = String((p && p.item) || '');
    const action = String((p && p.action) || '');
    const st = await status();
    const it = st.items.find((i) => i.id === item);
    const a = it && it.actions.find((x) => x.id === action);
    if (!it || !a) return { error: 'That step is not available right now.' };
    if (a.link) { await run.link(a.link); return { ok: true, message: 'Opened in your browser.' }; }
    if (action === 'install' && (item === 'claude' || item === 'agy')) {
      run.install(item);
      return { ok: true, message: 'A window opened with the official installer. When it says done, press "Check again".' };
    }
    if (action === 'signin' && (item === 'claude' || item === 'agy')) {
      run.signIn(item);
      return { ok: true, message: 'A window opened to sign in. When you are done, press "Check again".' };
    }
    if (action === 'open') { run.open(item); return { ok: true }; }
    return { error: 'Unknown step.' };
  }

  function start() {
    const offs = [
      bus.handle(TOPICS.SETUP_STATUS, (/** @type {any} */ p) => status({ recheck: !!(p && p.recheck) })),
      bus.handle(TOPICS.SETUP_ACTION, (/** @type {any} */ p) => act(p)),
      bus.handle(TOPICS.SETUP_SEEN, () => { device.patch('setup', { seenAt: now() }); return { ok: true }; }),
    ];
    return () => { for (const off of offs) off(); };
  }

  return { start, status, act };
}

module.exports = { createSetup, buildItems, needsSetup, LINKS, INSTALL };
