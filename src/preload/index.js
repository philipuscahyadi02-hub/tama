// @ts-check
// The renderer's only door to the core (ARCHITECTURE §7). Exposes an allow-list as window.tama.
// Runs sandboxed: only 'electron' (contextBridge, ipcRenderer) is available here.
const { contextBridge, ipcRenderer } = require('electron');

/** Main → renderer messages arrive on one 'ui' channel as (name, payload). */
const UI_NAMES = new Set(['brain.notice', 'pet.state', 'pet.bond', 'prod', 'focus', 'reminder', 'commit', 'summon', 'tray', 'agent.event', 'term.focus', 'character', 'chat.event', 'chat.focus', 'ui.prefs', 'event', 'google', 'telegram', 'usage', 'accounts', 'voice', 'encode', 'voice.changed', 'providers']);
/** @type {Map<string, Set<(p: any) => void>>} */
const subs = new Map();
ipcRenderer.on('ui', (_e, name, payload) => {
  for (const cb of subs.get(name) || []) cb(payload);
});
/** @param {string} name */
const on = (name) => (/** @type {(p: any) => void} */ cb) => {
  if (!UI_NAMES.has(name)) throw new Error(`unknown ui event ${name}`);
  if (!subs.has(name)) subs.set(name, new Set());
  /** @type {Set<(p: any) => void>} */ (subs.get(name)).add(cb);
};

contextBridge.exposeInMainWorld('tama', {
  // ---- pet window ----
  setCapture: (/** @type {boolean} */ v) => ipcRenderer.send('mouse:capture', v),
  walk: (/** @type {number} */ dx) => ipcRenderer.invoke('pet:walk', dx),
  dragBy: (/** @type {number} */ dx, /** @type {number} */ dy) => ipcRenderer.send('pet:dragBy', dx, dy),
  getPet: () => ipcRenderer.invoke('pet:get'),
  act: (/** @type {string} */ action) => ipcRenderer.invoke('pet:act', action),
  notify: (/** @type {string} */ t, /** @type {string} */ b) => ipcRenderer.send('notify', t, b),
  showTerminal: () => ipcRenderer.send('term:show'),
  showChat: () => ipcRenderer.send('chat:show'),
  summon: () => ipcRenderer.send('summon'),
  getCharacter: () => ipcRenderer.invoke('character:get'),
  /** App icon page (D-047): the face is drawn, capture it. */
  iconReady: () => ipcRenderer.send('icon:ready'),
  openOnboarding: (/** @type {string} */ mode) => ipcRenderer.send('onboarding:open', mode || 'hatch'),
  /** Settings window (M10) and the pages it links to: voice, google, dashboard, limits, settings. */
  openSettings: (/** @type {string|undefined} */ tab) => ipcRenderer.send('settings:open', tab || ''),
  openPage: (/** @type {string} */ name) => ipcRenderer.send('page:open', String(name)),
  openLogs: () => ipcRenderer.send('logs:open'),

  // ---- onboarding window ----
  designerGenerate: (/** @type {any} */ req) => ipcRenderer.invoke('designer:generate', req),
  designerRefine: (/** @type {any} */ req) => ipcRenderer.invoke('designer:refine', req),
  designerVoice: (/** @type {any} */ req) => ipcRenderer.invoke('designer:voice', req),
  characterSave: (/** @type {any} */ req) => ipcRenderer.invoke('character:save', req),
  closeSelf: () => ipcRenderer.send('win:closeSelf'),
  openRoster: (/** @type {boolean} */ importNow) => ipcRenderer.send('roster:open', !!importNow),

  // ---- My Tamas window ----
  roster: {
    list: () => ipcRenderer.invoke('roster:list'),
    switchTo: (/** @type {string} */ id) => ipcRenderer.invoke('roster:switch', id),
    hatchNew: () => ipcRenderer.invoke('roster:hatchNew'),
    graduate: (/** @type {string} */ id) => ipcRenderer.invoke('roster:graduate', id),
    restore: (/** @type {string} */ id) => ipcRenderer.invoke('roster:restore', id),
    remove: (/** @type {string} */ id, /** @type {string} */ confirmName) => ipcRenderer.invoke('roster:delete', id, confirmName),
    exportTama: (/** @type {any} */ opts) => ipcRenderer.invoke('roster:export', opts),
    importPick: (/** @type {boolean} */ includeUser) => ipcRenderer.invoke('roster:importPick', includeUser),
    importPassword: (/** @type {string} */ pw, /** @type {boolean} */ includeUser) => ipcRenderer.invoke('roster:importPassword', pw, includeUser),
  },
  onCharacter: on('character'),
  onPetState: on('pet.state'),
  onBond: on('pet.bond'),
  onSummon: on('summon'),
  onTray: on('tray'),

  // ---- terminal window ----
  termInit: () => ipcRenderer.invoke('term:init'),
  pickCwd: () => ipcRenderer.invoke('agent:pickCwd'),
  setCwd: (/** @type {string} */ d) => ipcRenderer.invoke('agent:setCwd', d),
  send: (/** @type {string} */ text) => ipcRenderer.send('agent:send', text),
  interrupt: () => ipcRenderer.send('agent:interrupt'),
  clear: () => ipcRenderer.send('agent:clear'),
  setMode: (/** @type {string} */ m) => ipcRenderer.send('agent:setMode', m),
  setModel: (/** @type {string|null} */ m) => ipcRenderer.send('agent:setModel', m),
  setEffort: (/** @type {string|null} */ v) => ipcRenderer.send('agent:setEffort', v),
  answerPermission: (/** @type {number} */ id, /** @type {string} */ choice, /** @type {string} */ feedback) =>
    ipcRenderer.send('agent:permission', id, choice, feedback),
  resume: (/** @type {string|null} */ id) => ipcRenderer.invoke('agent:resume', id),
  onFocus: on('term.focus'),
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
  },

  // ---- chat window (agy, D-029) ----
  chat: {
    send: (/** @type {string} */ t) => ipcRenderer.invoke('chat:send', t),
    history: () => ipcRenderer.invoke('chat:history'),
    interrupt: () => ipcRenderer.send('chat:interrupt'),
    clear: () => ipcRenderer.send('chat:clear'),
    confirm: (/** @type {number} */ id, /** @type {boolean} */ yes) => ipcRenderer.invoke('chat:confirm', id, yes),
    onEvent: on('chat.event'),
    onFocus: on('chat.focus'),
  },

  // ---- UI preferences (terminal theme, tour) ----
  ui: {
    prefs: () => ipcRenderer.invoke('ui:prefs'),
    setPrefs: (/** @type {any} */ p) => ipcRenderer.invoke('ui:setPrefs', p),
    onPrefs: on('ui.prefs'),
  },

  // ---- events & memory (M5) ----
  events: {
    answer: (/** @type {string} */ id, /** @type {number} */ choice) => ipcRenderer.invoke('events:answer', { id, choice }),
    dismiss: (/** @type {string} */ id) => ipcRenderer.invoke('events:answer', { id, dismiss: true }),
    trigger: (/** @type {string|undefined} */ id) => ipcRenderer.invoke('events:trigger', id),
    onShow: on('event'),
  },
  memory: {
    get: () => ipcRenderer.invoke('memory:get'),
    add: (/** @type {string} */ t) => ipcRenderer.invoke('memory:add', t),
    forget: (/** @type {string|number} */ ref) => ipcRenderer.invoke('memory:forget', ref),
  },
  diary: {
    read: (/** @type {string|undefined} */ day) => ipcRenderer.invoke('diary:read', day),
    list: () => ipcRenderer.invoke('diary:list'),
  },

  // ---- voice (M9) ----
  voice: {
    status: () => ipcRenderer.invoke('voice:status'),
    set: (/** @type {any} */ p) => ipcRenderer.invoke('voice:set', p),
    say: (/** @type {string} */ t) => ipcRenderer.invoke('voice:say', t),
    detect: () => ipcRenderer.invoke('voice:detect'),
    preview: (/** @type {string} */ t, /** @type {any} */ v) => ipcRenderer.invoke('voice:preview', t, v),
    onPlay: on('voice'),
    try: (/** @type {any} */ p) => ipcRenderer.invoke('voice:try', p),
    info: (/** @type {any} */ p) => ipcRenderer.invoke('voice:info', p),
    open: () => ipcRenderer.send('voice:open'),
    onChanged: on('voice.changed'),
    onEncode: on('encode'),
    encoded: (/** @type {number} */ id, /** @type {any} */ r) => ipcRenderer.send('voice:encoded', id, r),
  },
  // ---- Usage & accounts (M8) ----
  usage: {
    open: () => ipcRenderer.send('dashboard:open'),
    get: (/** @type {any} */ p) => ipcRenderer.invoke('usage:get', p),
    onChange: on('usage'),
  },
  limits: {
    get: () => ipcRenderer.invoke('limits:get'),
    refresh: () => ipcRenderer.invoke('limits:refresh'),
    set: (/** @type {any} */ p) => ipcRenderer.invoke('limits:set', p),
  },
  accounts: {
    get: (/** @type {boolean} */ refresh) => ipcRenderer.invoke('accounts:get', !!refresh),
    switchTo: (/** @type {string} */ kind) => ipcRenderer.invoke('accounts:switch', kind),
    onChange: on('accounts'),
  },
  // ---- Telegram (M7) ----
  telegram: {
    status: () => ipcRenderer.invoke('telegram:status'),
    setup: (/** @type {string} */ token) => ipcRenderer.invoke('telegram:setup', token),
    newCode: () => ipcRenderer.invoke('telegram:newCode'),
    unpair: () => ipcRenderer.invoke('telegram:unpair'),
    set: (/** @type {any} */ p) => ipcRenderer.invoke('telegram:set', p),
    onChange: on('telegram'),
  },
  // ---- Google (M6) ----
  google: {
    open: () => ipcRenderer.send('google:open'),
    status: () => ipcRenderer.invoke('google:status'),
    setClient: (/** @type {any} */ p) => ipcRenderer.invoke('google:setClient', p),
    login: () => ipcRenderer.invoke('google:login'),
    logout: () => ipcRenderer.invoke('google:logout'),
    set: (/** @type {any} */ p) => ipcRenderer.invoke('google:set', p),
    brief: () => ipcRenderer.invoke('google:brief'),
    backupNow: () => ipcRenderer.invoke('google:backupNow'),
    backups: () => ipcRenderer.invoke('google:backups'),
    restore: (/** @type {string} */ id) => ipcRenderer.invoke('google:restore', id),
    onChange: on('google'),
  },
  openLink: (/** @type {string} */ url) => ipcRenderer.invoke('link:open', url),
  // ---- M5 extras: weather (D-035) ----
  weather: {
    get: () => ipcRenderer.invoke('weather:get'),
    set: (/** @type {string} */ city) => ipcRenderer.invoke('weather:set', { city }),
    off: () => ipcRenderer.invoke('weather:set', { off: true }),
  },

  // ---- both ----
  onAgent: on('agent.event'),
  onBrainNotice: on('brain.notice'),
  brain: {
    status: () => ipcRenderer.invoke('brain:status'),
    set: (/** @type {any} */ p) => ipcRenderer.invoke('brain:set', p),
  },
  /** Settings → Brains (SHIP-8): which provider serves chat, moments, design and coding. */
  providers: {
    get: () => ipcRenderer.invoke('providers:get'),
    set: (/** @type {any} */ p) => ipcRenderer.invoke('providers:set', p),
    onChange: on('providers'),
  },
  prod: {
    get: () => ipcRenderer.invoke('prod:get'),
    todoAdd: (/** @type {string} */ t) => ipcRenderer.invoke('prod:todoAdd', t),
    todoDone: (/** @type {string|number} */ ref) => ipcRenderer.invoke('prod:todoDone', ref),
    todoRemove: (/** @type {string|number} */ ref) => ipcRenderer.invoke('prod:todoRemove', ref),
    noteAdd: (/** @type {string} */ t) => ipcRenderer.invoke('prod:noteAdd', t),
    remindAdd: (/** @type {string} */ input) => ipcRenderer.invoke('prod:remindAdd', input),
    focusStart: (/** @type {number} */ m) => ipcRenderer.invoke('prod:focusStart', m),
    focusStop: () => ipcRenderer.invoke('prod:focusStop'),
    watchAdd: (/** @type {string} */ p) => ipcRenderer.invoke('prod:watchAdd', p),
    watchRemove: (/** @type {string} */ p) => ipcRenderer.invoke('prod:watchRemove', p),
    watchList: () => ipcRenderer.invoke('prod:watchList'),
    onChange: on('prod'),
    onFocus: on('focus'),
    onReminder: on('reminder'),
    onCommit: on('commit'),
  },
});
