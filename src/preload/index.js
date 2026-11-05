// @ts-check
// The renderer's only door to the core (ARCHITECTURE §7). Exposes an allow-list as window.tama.
// Runs sandboxed: only 'electron' (contextBridge, ipcRenderer) is available here.
const { contextBridge, ipcRenderer } = require('electron');

/** Main → renderer messages arrive on one 'ui' channel as (name, payload). */
const UI_NAMES = new Set(['pet.state', 'pet.bond', 'prod', 'focus', 'reminder', 'commit', 'summon', 'tray', 'agent.event', 'term.focus', 'character']);
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
  summon: () => ipcRenderer.send('summon'),
  getCharacter: () => ipcRenderer.invoke('character:get'),
  openOnboarding: (/** @type {string} */ mode) => ipcRenderer.send('onboarding:open', mode || 'hatch'),

  // ---- onboarding window ----
  designerGenerate: (/** @type {any} */ req) => ipcRenderer.invoke('designer:generate', req),
  designerRefine: (/** @type {any} */ req) => ipcRenderer.invoke('designer:refine', req),
  designerVoice: (/** @type {any} */ req) => ipcRenderer.invoke('designer:voice', req),
  characterSave: (/** @type {any} */ req) => ipcRenderer.invoke('character:save', req),
  closeSelf: () => ipcRenderer.send('win:closeSelf'),
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
  answerPermission: (/** @type {number} */ id, /** @type {string} */ choice, /** @type {string} */ feedback) =>
    ipcRenderer.send('agent:permission', id, choice, feedback),
  resume: (/** @type {string|null} */ id) => ipcRenderer.invoke('agent:resume', id),
  onFocus: on('term.focus'),
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
  },

  // ---- both ----
  onAgent: on('agent.event'),
  prod: {
    get: () => ipcRenderer.invoke('prod:get'),
    todoAdd: (/** @type {string} */ t) => ipcRenderer.invoke('prod:todoAdd', t),
    todoDone: (/** @type {string|number} */ ref) => ipcRenderer.invoke('prod:todoDone', ref),
    todoRemove: (/** @type {string|number} */ ref) => ipcRenderer.invoke('prod:todoRemove', ref),
    noteAdd: (/** @type {string} */ t) => ipcRenderer.invoke('prod:noteAdd', t),
    remindAdd: (/** @type {string} */ input) => ipcRenderer.invoke('prod:remindAdd', input),
    remindCancel: (/** @type {string} */ id) => ipcRenderer.invoke('prod:remindCancel', id),
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
