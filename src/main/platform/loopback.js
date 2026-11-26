// @ts-check
// PC-audio loopback for DJ Tama's beat sync (MUS-4, D-069). Windows can hand Chromium the system audio output
// ("loopback") through getDisplayMedia. Only windows registered here (the pet window) may ask; every other request,
// and every request without audio, is refused. The audio is analysed in the pet window's memory and never recorded,
// saved or sent. The screen video Chromium insists on is stopped by the pet window right away.
const { session, desktopCapturer, webContents } = require('electron');

/** @type {Set<number>} */ const allowed = new Set();
let installed = false;

/** May this window capture loopback audio? (used by the permission handlers in platform/app). @param {number} id */
const captureAllowed = (id) => allowed.has(id);

/** Let one window (the pet) ask for the PC's audio output. @param {import('electron').WebContents} wc */
function allowLoopback(wc) {
  const id = wc.id;
  allowed.add(id);
  wc.once('destroyed', () => allowed.delete(id));
  if (installed) return;
  installed = true;
  session.defaultSession.setDisplayMediaRequestHandler(async (req, callback) => {
    try {
      const from = req.frame ? webContents.fromFrame(req.frame) : null;
      if (!from || !allowed.has(from.id) || !req.audioRequested) { callback({}); return; }
      const [screen] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      callback(screen ? { video: screen, audio: 'loopback' } : {});
    } catch { callback({}); }
  });
}

module.exports = { allowLoopback, captureAllowed };
