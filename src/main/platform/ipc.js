// @ts-check
// ipcMain wrapper. Only accepts messages from our own windows (file:// pages loaded by Tama).
const { ipcMain, BrowserWindow } = require('electron');

/** @param {import('electron').IpcMainEvent | import('electron').IpcMainInvokeEvent} e */
function trusted(e) {
  const url = (e.senderFrame && e.senderFrame.url) || '';
  return url.startsWith('file://');
}

/** QC-3: dev perf runs time every handler's synchronous part. @type {null | ((channel: string, ms: number) => void)} */
let probe = null;
/** @param {(channel: string, ms: number) => void} p */
const setProbe = (p) => { probe = p; };
/** @param {string} channel @param {(...args: any[]) => any} fn */
const timed = (channel, fn) => (/** @type {any[]} */ ...a) => {
  if (!probe) return fn(...a);
  const t = performance.now();
  try { return fn(...a); } finally { probe(channel, performance.now() - t); }
};

/** @param {string} channel @param {(...args: any[]) => any} fn */
function handle(channel, fn) {
  const f = timed(channel, fn);
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error(`ipc: untrusted sender for ${channel}`);
    return f(...args);
  });
}

/** @param {string} channel @param {(...args: any[]) => void} fn */
function on(channel, fn) {
  const f = timed(channel, fn);
  ipcMain.on(channel, (e, ...args) => { if (trusted(e)) f(...args); });
}

/** Like `on`, but also passes the sender's window (for minimize/maximize/close). @param {string} channel @param {(win: BrowserWindow) => void} fn */
function onFromWindow(channel, fn) {
  ipcMain.on(channel, (e) => {
    const w = trusted(e) && BrowserWindow.fromWebContents(e.sender);
    if (w) fn(w);
  });
}

/** Send a UI message to a window if it's alive. @param {BrowserWindow | null | undefined} win @param {string} name @param {any} [payload] */
function sendUi(win, name, payload) {
  if (win && !win.isDestroyed()) win.webContents.send('ui', name, payload);
}

module.exports = { handle, on, onFromWindow, sendUi, setProbe };
