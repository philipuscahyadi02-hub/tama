// @ts-check
// M13 YouTube Music & DJ wiring (D-065, D-066), kept out of the bootstrap so index.js stays readable: the music
// service (Companion extension link + Windows media-session fallback) and the widget window beside the pet.
const fs = require('fs');
const path = require('path');
const { TOPICS } = require('./bus-topics');
const { createMusic } = require('./services/music');
const { createMediaSession } = require('./platform/media-session');
const { startWsServer } = require('./platform/ws-server');
const { createMusicWindow } = require('./platform/windows/music-window');
const geometry = require('./platform/summon/geometry');
const { allowLoopback } = require('./platform/loopback');
const look = require('./platform/look');

/** DJ lines (MUS-3) from assets/music/dj-lines.json (data over code, AGENTS rule 12). */
function djLines() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'music', 'dj-lines.json'), 'utf8')); } catch { return {}; }
}
/** @param {string[] | undefined} list */
const pickLine = (list) => (Array.isArray(list) && list.length ? String(list[Math.floor(Math.random() * list.length)]) : '');
/** Fill {title} / {artist} (song data is shown as text, never as markup). @param {string} line @param {any} s */
const fill = (line, s) => line.replace(/\{title\}/g, String(s.title || '').slice(0, 40)).replace(/\{artist\}/g, String(s.artist || '').slice(0, 30));

/**
 * @param {{
 *   bus: import('./bus').BusInstance,
 *   ipc: typeof import('./platform/ipc'),
 *   shell: typeof import('./platform/shell'),
 *   secrets: { get: (k: string) => string | null, set: (k: string, v: string) => void, delete: (k: string) => void },
 *   device: import('./platform/store/device').DeviceSettings,
 *   dataDir: string,
 *   log?: (m: string) => void,
 * }} deps
 */
function createMusicWiring({ bus, ipc, shell, secrets, device, dataDir, log = () => {} }) {
  /** @type {import('./platform/windows/music-window').MusicWindow | null} */ let widget = null;
  /** @type {import('./platform/windows/pet-window').PetWindow | null} */ let petWin = null;
  const dj = djLines();
  let lastSong = '';

  return {
    /** The pet moved: a card pinned to her moves in the same step (D-072). */
    onPetMoved() { if (widget) widget.follow(); },

    /** Create the widget (D-068: a normal window; opens next to the pet the first time, then where the user left it). @param {import('./platform/windows/pet-window').PetWindow} pet */
    attach(pet) {
      const w = createMusicWindow({
        petBody: () => geometry.bodyRect(pet.bounds()),
        send: ipc.sendUi,
        savedPosition: (device.get().windows || {}).music || null,
        onMoved: (pos) => device.patch('windows', { music: pos }),
        pin: (device.get().windows || {}).musicPin || null,
        onPin: (pin) => device.patch('windows', { musicPin: pin }),
      });
      widget = w;
      petWin = pet;
      // DJ Tama's beat sync (MUS-4, D-069): only the pet window may capture the PC's audio output.
      allowLoopback(pet.win.webContents);
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
        const syncMode = () => bus.request(TOPICS.UI_PREFS_GET).then((ui) => {
          if (!ui) return;
          // The card follows the Look (D-078); glass only while Windows' transparency effects are on.
          w.setLook({ look: ui.musicLook === 'glass' && look.glassAllowed() ? 'glass' : 'solid', opacity: ui.musicOpacity });
          w.setMode(ui.musicWidget === 'off' ? 'off' : 'auto');
        }).catch(() => null);
        syncMode();
        stops.push(bus.on(TOPICS.MUSIC_CHANGED, (/** @type {any} */ p) => w.update(p.state)), bus.on(TOPICS.UI_PREFS_CHANGED, syncMode), look.onGlassChange(() => syncMode()), () => w.destroy());
      }
      // DJ Tama (MUS-3): the pet hears about the music; a new song brings a DJ line unless it's quiet time.
      if (petWin) {
        const pet = petWin;
        stops.push(bus.on(TOPICS.MUSIC_CHANGED, async (/** @type {any} */ p) => {
          const s = p.state;
          const key = s ? String(s.videoId || `${s.title}|${s.artist}`) : '';
          let line = '';
          if (s && s.playing && key !== lastSong) {
            const first = !lastSong;
            lastSong = key;
            const ui = await bus.request(TOPICS.UI_PREFS_GET).catch(() => null);
            if (ui && !ui.dnd && !ui.quietNow && ui.musicDj !== false) line = fill(pickLine(first ? dj.start : Math.random() < 0.5 ? dj.withTitle : dj.newSong), s);
          } else if (!s) lastSong = '';
          ipc.sendUi(pet.win, 'music', { state: s, djLine: line, drops: Array.isArray(dj.drop) ? dj.drop : [] });
        }));
      }
      return () => { for (const s of stops.reverse()) s(); };
    },
  };
}

module.exports = { createMusicWiring };
