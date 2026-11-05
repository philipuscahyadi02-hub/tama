// @ts-check
// The renderer's only door to the core (ARCHITECTURE §7). Exposes an allow-list as window.tama.
// Runs sandboxed: only 'electron' (contextBridge, ipcRenderer) is available here.
const { contextBridge, ipcRenderer } = require('electron');

/** Main → renderer messages arrive on one 'ui' channel as (name, payload). */
const UI_NAMES = new Set(['pet.state', 'summon', 'tray', 'agent.event', 'term.focus']);
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
  onPetState: on('pet.state'),
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
});
