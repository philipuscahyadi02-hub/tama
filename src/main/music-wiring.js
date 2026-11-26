// @ts-check
// M13 YouTube Music & DJ wiring (D-065, D-066), kept out of the bootstrap so index.js stays readable: the music
// service (Companion extension link + Windows media-session fallback) and the widget window beside the pet.
const path = require('path');
const { TOPICS } = require('./bus-topics');
const { createMusic } = require('./services/music');
const { createMediaSession } = require('./platform/media-session');
const { startWsServer } = require('./platform/ws-server');
const { createMusicWindow } = require('./platform/windows/music-window');
const geometry = require('./platform/summon/geometry');

/**
 * @param {{
 *   bus: import('./bus').BusInstance,
 *   ipc: typeof import('./platform/ipc'),
 *   shell: typeof import('./platform/shell'),
 *   secrets: { get: (k: string) => string | null, set: (k: string, v: string) => void, delete: (k: string) => void },
 *   dataDir: string,
 *   log?: (m: string) => void,
 * }} deps
 */
function createMusicWiring({ bus, ipc, shell, secrets, dataDir, log = () => {} }) {
  /** @type {import('./platform/windows/music-window').MusicWindow | null} */ let widget = null;

  return {
    /** The pet moved: the widget moves in the same step, so they walk together without trailing. */
    onPetMoved() { if (widget) widget.follow(); },

    /** Create the widget for this pet window. @param {import('./platform/windows/pet-window').PetWindow} pet */
    attach(pet) {
      const w = createMusicWindow({
        petBody: () => geometry.bodyRect(pet.bounds()),
        petHidden: () => !pet.win.isVisible() || pet.isHiddenByUser(),
        send: ipc.sendUi,
      });
      pet.win.on('hide', () => w.follow());
      pet.win.on('show', () => w.follow());
      widget = w;
      return w;
    },

    /** Start the music service and connect it to the widget. @returns {() => void} stop */
    start() {
      // The extension folder ships unpacked next to app.asar so browsers can "Load unpacked" it (MUS-10).
      const extensionDir = path.join(__dirname, '..', '..', 'extension').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
      const media = createMediaSession({ dir: path.join(dataDir, 'bin'), onError: (message) => bus.emit(TOPICS.APP_ERROR, { topic: 'media-session', message }) });
      const stops = [createMusic({ bus, secrets, media, startWs: startWsServer, openExternal: shell.openExternal, extensionDir, log }).start()];
      const w = widget;
      if (w) {
        const syncMode = () => bus.request(TOPICS.UI_PREFS_GET).then((ui) => w.setMode(ui && ui.musicWidget === 'off' ? 'off' : 'auto')).catch(() => null);
        syncMode();
        stops.push(bus.on(TOPICS.MUSIC_CHANGED, (/** @type {any} */ p) => w.update(p.state)), bus.on(TOPICS.UI_PREFS_CHANGED, syncMode), () => w.destroy());
      }
      return () => { for (const s of stops.reverse()) s(); };
    },
  };
}

module.exports = { createMusicWiring };
