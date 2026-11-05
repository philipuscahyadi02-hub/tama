// @ts-check
// ipcMain wrapper. Only accepts messages from our own windows (file:// pages loaded by Tama).
const { ipcMain, BrowserWindow } = require('electron');

/** @param {import('electron').IpcMainEvent | import('electron').IpcMainInvokeEvent} e */
function trusted(e) {
  const url = (e.senderFrame && e.senderFrame.url) || '';
  return url.startsWith('file://');
}

/** @param {string} channel @param {(...args: any[]) => any} fn */
function handle(channel, fn) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error(`ipc: untrusted sender for ${channel}`);
    return fn(...args);
  });
}

/** @param {string} channel @param {(...args: any[]) => void} fn */
function on(channel, fn) {
  ipcMain.on(channel, (e, ...args) => { if (trusted(e)) fn(...args); });
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

module.exports = { handle, on, onFromWindow, sendUi };
