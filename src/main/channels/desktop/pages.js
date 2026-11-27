// @ts-check
// Desktop channel, part 2 (QC-4): IPC for the page windows (usage dashboard, Telegram and Google setup, events and
// memory, weather, onboarding, My Tamas). Like index.js: translation only, no business rules.
const { TOPICS } = require('../../bus-topics');

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   ipc: typeof import('../../platform/ipc'),
 *   shell: typeof import('../../platform/shell'),
 *   fire: (topic: string, payload?: any) => void,
 *   summon: (reason: string) => void,
 *   openOnboarding: (mode: 'hatch'|'restyle'|'rebirth') => void,
 *   openRoster: (importNow?: boolean) => unknown,
 *   openGoogle: () => unknown,
 *   openDashboard: (tab?: string) => unknown,
 *   openVoice: () => unknown,
 *   openSettings: (tab?: string) => unknown,
 *   openSetup?: () => unknown,
 *   openCalendar?: () => unknown,
 * }} d
 */
function wirePageIpc({ bus, ipc, shell, fire, summon, openOnboarding, openRoster, openGoogle, openDashboard, openVoice, openSettings, openSetup = () => null, openCalendar = () => null }) {
  /** Settings → Brains (SHIP-8): who serves chat, moments, design and coding. The registry validates the names. */
  function providersIpc() {
    const pair = (/** @type {any} */ x) => ({ cap: String(x?.cap || '').slice(0, 20), id: String(x?.id || '').slice(0, 40) });
    ipc.handle('providers:get', () => bus.request(TOPICS.PROVIDERS_GET));
    ipc.handle('providers:set', (p) => bus.request(TOPICS.PROVIDERS_SET, {
      prefer: p?.prefer ? pair(p.prefer) : undefined,
      allow: p?.allow ? { ...pair(p.allow), on: !!p.allow.on } : undefined,
    }));
  }

  /** Setup wizard (SHIP-4): the service checks the item and action against its own list. */
  function setupIpc() {
    ipc.handle('setup:status', (recheck) => bus.request(TOPICS.SETUP_STATUS, { recheck: !!recheck }));
    ipc.handle('setup:action', (item, action) => bus.request(TOPICS.SETUP_ACTION, { item: String(item || '').slice(0, 20), action: String(action || '').slice(0, 20) })
      .catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('setup:seen', () => bus.request(TOPICS.SETUP_SEEN));
  }

  /** The last .tama file the user picked; import only ever reads this path, never one sent by a page. */
  let pickedImport = /** @type {string | null} */ (null);

  /** Usage & accounts (M8, D-040) */
  function usageIpc() {
    ipc.on('dashboard:open', () => openDashboard());
    // Settings window (M10): it opens the other pages by name; only these names are accepted.
    ipc.on('settings:open', (tab) => openSettings(typeof tab === 'string' ? tab.slice(0, 20) : ''));
    ipc.on('page:open', (name) => {
      /** @type {Record<string, () => unknown>} */
      const PAGES = { calendar: () => openCalendar(), voice: () => openVoice(), google: () => openGoogle(), dashboard: () => openDashboard(), limits: () => openDashboard('limits'), settings: () => openSettings(), setup: () => openSetup() };
      const fn = Object.hasOwn(PAGES, String(name)) ? PAGES[String(name)] : null;
      if (fn) fn();
    });
    ipc.handle('usage:get', (p) => bus.request(TOPICS.USAGE_GET, { days: Number(p?.days) || 14, provider: p?.provider ? String(p.provider) : undefined, limit: Number(p?.limit) || 300 }));
    ipc.handle('accounts:get', (refresh) => bus.request(TOPICS.ACCOUNTS_GET, { refresh: !!refresh }));
    ipc.handle('limits:get', () => bus.request(TOPICS.USAGE_LIMITS_GET));
    ipc.handle('limits:refresh', () => bus.request(TOPICS.USAGE_LIMITS_REFRESH));
    ipc.handle('limits:set', (p) => bus.request(TOPICS.USAGE_LIMITS_SET, {
      placesCap: p?.placesCap === null ? null : p?.placesCap === undefined ? undefined : Number(p.placesCap),
      alertAt: Array.isArray(p?.alertAt) ? p.alertAt.map(Number) : undefined,
    }));
    ipc.handle('accounts:switch', (kind) => bus.request(TOPICS.ACCOUNTS_SWITCH, { kind: String(kind || '') }).catch((e) => ({ error: String(e.message || e) })));
  }

  /** Telegram (M7, D-036) */
  function telegramIpc() {
    ipc.handle('telegram:status', () => bus.request(TOPICS.TELEGRAM_STATUS));
    ipc.handle('telegram:setup', (t) => bus.request(TOPICS.TELEGRAM_SETUP, { token: String(t || '') }).catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('telegram:newCode', () => bus.request(TOPICS.TELEGRAM_NEW_CODE));
    ipc.handle('telegram:unpair', () => bus.request(TOPICS.TELEGRAM_UNPAIR));
    ipc.handle('telegram:set', (p) => bus.request(TOPICS.TELEGRAM_SET, {
      enabled: typeof p?.enabled === 'boolean' ? p.enabled : undefined, remote: typeof p?.remote === 'boolean' ? p.remote : undefined,
      awake: typeof p?.awake === 'boolean' ? p.awake : undefined,
      voiceNotes: typeof p?.voiceNotes === 'boolean' ? p.voiceNotes : undefined,
      allow: p?.allow ? String(p.allow) : undefined, disallow: p?.disallow ? String(p.disallow) : undefined,
    }));
  }

  /** Google (M6, D-034) */
  function googleIpc() {
    ipc.on('google:open', () => openGoogle());
    ipc.handle('google:status', () => bus.request(TOPICS.GOOGLE_STATUS));
    ipc.handle('google:setClient', (p) => bus.request(TOPICS.GOOGLE_SET_CLIENT, { clientId: String(p?.clientId || ''), clientSecret: String(p?.clientSecret || '') }));
    ipc.handle('google:login', () => bus.request(TOPICS.GOOGLE_LOGIN).catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('google:logout', () => bus.request(TOPICS.GOOGLE_LOGOUT));
    ipc.handle('google:set', (p) => bus.request(TOPICS.GOOGLE_SET, {
      readonly: typeof p?.readonly === 'boolean' ? p.readonly : undefined, youtube: typeof p?.youtube === 'boolean' ? p.youtube : undefined, backup: typeof p?.backup === 'boolean' ? p.backup : undefined,
      mapsKey: p?.mapsKey === null ? null : typeof p?.mapsKey === 'string' ? p.mapsKey : undefined,
    }));
    ipc.handle('google:brief', () => bus.request(TOPICS.GOOGLE_BRIEF).catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('google:backupNow', () => bus.request(TOPICS.GOOGLE_BACKUP_NOW).catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('google:backups', () => bus.request(TOPICS.GOOGLE_BACKUPS).catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('google:restore', (id) => bus.request(TOPICS.GOOGLE_RESTORE, { fileId: String(id || '') }).catch((e) => ({ error: String(e.message || e) })));
    // Only allow-listed https sites (platform/shell.EXTERNAL_HOSTS).
    ipc.handle('link:open', async (url) => { try { await shell.openExternal(String(url)); return { ok: true }; } catch (e) { return { error: String(/** @type {Error} */ (e).message) }; } });
  }

  /** events & memory (M5) */
  function eventsIpc() {
    ipc.handle('events:answer', (p) => bus.request(TOPICS.EVENTS_ANSWER, { id: String(p?.id || ''), choice: Number(p?.choice), dismiss: !!p?.dismiss }));
    ipc.handle('events:trigger', (id) => bus.request(TOPICS.EVENTS_TRIGGER, { id: id ? String(id) : undefined }));
    ipc.handle('memory:get', () => bus.request(TOPICS.MEMORY_GET));
    ipc.handle('memory:add', (t) => bus.request(TOPICS.MEMORY_ADD, { text: String(t || ''), source: 'user' }));
    ipc.handle('memory:forget', (ref) => bus.request(TOPICS.MEMORY_FORGET, { ref: ref === 'all' ? 'all' : String(ref || '') }));
    ipc.handle('diary:read', (day) => bus.request(TOPICS.DIARY_READ, { day: day ? String(day) : undefined }));
    ipc.handle('diary:list', () => bus.request(TOPICS.DIARY_LIST));
    ipc.handle('ui:setPrefs', (p) => bus.request(TOPICS.UI_PREFS_SET, {
      termTheme: p?.termTheme == null ? undefined : String(p.termTheme), tourDone: p?.tourDone == null ? undefined : !!p.tourDone,
      dnd: p?.dnd == null ? undefined : !!p.dnd, nudges: p?.nudges == null ? undefined : !!p.nudges,
      mute: p?.mute == null ? undefined : !!p.mute, motion: p?.motion == null ? undefined : String(p.motion),
      walkMarker: p?.walkMarker == null ? undefined : !!p.walkMarker, // M5 extras (D-035)
      lookMaterial: p?.lookMaterial == null ? undefined : String(p.lookMaterial).slice(0, 8), lookMode: p?.lookMode == null ? undefined : String(p.lookMode).slice(0, 8), keepAwake: p?.keepAwake == null ? undefined : String(p.keepAwake).slice(0, 8), calendarPopup: typeof p?.calendarPopup === 'boolean' ? p.calendarPopup : undefined, calendarLead: p?.calendarLead == null ? undefined : Number(p.calendarLead), calendarWidget: p?.calendarWidget == null ? undefined : String(p.calendarWidget).slice(0, 8), // D-078, D-081, D-084
      musicWidget: p?.musicWidget == null ? undefined : String(p.musicWidget).slice(0, 8), // M13 (MUS-2)
      musicLook: p?.musicLook == null ? undefined : String(p.musicLook).slice(0, 8), // D-068
      musicDj: p?.musicDj == null ? undefined : !!p.musicDj, musicBeat: p?.musicBeat == null ? undefined : !!p.musicBeat, // MUS-3/4
      musicOpacity: p?.musicOpacity == null ? undefined : Number(p.musicOpacity),
      replyLang: p?.replyLang == null ? undefined : String(p.replyLang), // M10 (D-048)
      quiet: p?.quiet && typeof p.quiet === 'object' ? {
        on: p.quiet.on == null ? undefined : !!p.quiet.on,
        from: p.quiet.from == null ? undefined : String(p.quiet.from).slice(0, 5), to: p.quiet.to == null ? undefined : String(p.quiet.to).slice(0, 5),
      } : undefined,
    }));
  }

  /** M5 extras: weather (D-035) */
  function weatherIpc() {
    ipc.handle('weather:get', () => bus.request(TOPICS.WEATHER_GET));
    ipc.handle('weather:set', (p) => bus.request(TOPICS.WEATHER_SET, p?.off ? { off: true } : { city: String(p?.city || '').slice(0, 80) }));
  }

  /** M13 YouTube Music (D-066): status, controls (validated again by the music service), pairing, folder */
  function musicIpc() {
    // Calendar window (D-084): read a range, private notes, and the next-meeting card.
    ipc.handle('calendar:range', (p) => bus.request(TOPICS.GOOGLE_CAL_RANGE, { from: Number(p?.from) || 0, to: Number(p?.to) || 0 }).catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('calendar:notes', (p) => bus.request(TOPICS.GOOGLE_CAL_NOTES, { eventId: String(p?.eventId || '').slice(0, 1024), notes: String(p?.notes || '').slice(0, 4000) }).catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('calendar:dismiss', (id) => bus.request(TOPICS.GOOGLE_MEETING_DISMISS, { eventId: String(id || '').slice(0, 1024) }));
    ipc.on('calendar:draft', (t) => { bus.emit(TOPICS.CHAT_SHOW, {}); bus.emit(TOPICS.CHAT_DRAFT, { text: String(t || '').slice(0, 500) }); });
    ipc.handle('music:get', () => bus.request(TOPICS.MUSIC_GET));
    ipc.handle('music:control', (p) => bus.request(TOPICS.MUSIC_CONTROL, {
      action: String(p?.action || '').slice(0, 20),
      value: typeof p?.value === 'number' && Number.isFinite(p.value) ? p.value : typeof p?.value === 'string' ? p.value.slice(0, 500) : undefined,
    }));
    ipc.handle('music:library', (p) => bus.request(TOPICS.MUSIC_LIBRARY, {
      op: String(p?.op || '').slice(0, 20), id: typeof p?.id === 'string' ? p.id.slice(0, 64) : undefined,
      q: typeof p?.q === 'string' ? p.q.slice(0, 120) : undefined, fresh: p?.fresh === true,
    }).catch((e) => ({ error: String(e.message || e) })));
    ipc.handle('music:play', (p) => bus.request(TOPICS.MUSIC_PLAY, {
      videoId: typeof p?.videoId === 'string' ? p.videoId.slice(0, 64) : undefined,
      playlistId: typeof p?.playlistId === 'string' ? p.playlistId.slice(0, 64) : undefined,
      query: typeof p?.query === 'string' ? p.query.slice(0, 120) : undefined,
    }).catch((e) => ({ ok: false, error: String(e.message || e) })));
    ipc.handle('music:pair', () => bus.request(TOPICS.MUSIC_PAIR));
    ipc.handle('music:unpair', () => bus.request(TOPICS.MUSIC_UNPAIR));
    ipc.handle('music:openFolder', async () => {
      const st = await bus.request(TOPICS.MUSIC_GET);
      if (st?.extension?.dir) await shell.openFolder(st.extension.dir);
      return { ok: !!st?.extension?.dir };
    });
  }

  /** onboarding window → core */
  function onboardingIpc() {
    ipc.handle('designer:generate', (req) => bus.request(TOPICS.DESIGNER_GENERATE, {
      gender: String(req?.gender || 'girl'), prompt: String(req?.prompt || '').slice(0, 600), name: req?.name ? String(req.name).slice(0, 24) : undefined,
    }));
    ipc.handle('designer:refine', (req) => bus.request(TOPICS.DESIGNER_REFINE, { spec: req?.spec, instruction: String(req?.instruction || '').slice(0, 400) }));
    ipc.handle('designer:voice', (req) => bus.request(TOPICS.DESIGNER_VOICE, {
      voicePrompt: String(req?.voicePrompt || '').slice(0, 400), gender: String(req?.gender || 'girl'), personality: req?.personality,
    }));
    ipc.handle('character:save', (req) => bus.request(TOPICS.CHARACTER_SAVE, { spec: req?.spec, mode: String(req?.mode), keepBond: req?.keepBond !== false }));
    ipc.onFromWindow('win:closeSelf', (w) => w.close());
  }

  /** My Tamas window → core (PORT-3..5) */
  function rosterIpc() {
    ipc.on('roster:open', (importNow) => openRoster(!!importNow));
    ipc.handle('roster:list', () => bus.request(TOPICS.ROSTER_GET));
    ipc.handle('roster:switch', (id) => bus.request(TOPICS.ROSTER_SWITCH, { id: String(id) }));
    ipc.handle('roster:hatchNew', () => bus.request(TOPICS.ROSTER_HATCH_NEW));
    ipc.handle('roster:graduate', (id) => bus.request(TOPICS.ROSTER_GRADUATE, { id: String(id) }));
    ipc.handle('roster:restore', (id) => bus.request(TOPICS.ROSTER_RESTORE, { id: String(id) }));
    ipc.handle('roster:delete', (id, confirmName) => bus.request(TOPICS.ROSTER_DELETE, { id: String(id), confirmName: String(confirmName || '') }));
    ipc.handle('roster:export', async (o) => {
      const list = (await bus.request(TOPICS.ROSTER_GET)).tamas;
      const t = list.find((/** @type {any} */ x) => x.id === String(o?.id));
      if (!t) return { error: 'No such Tama.' };
      const filePath = await shell.pickSaveTama(null, `${t.name.replace(/[^\w -]/g, '') || 'Tama'}.tama`);
      if (!filePath) return null;
      return bus.request(TOPICS.ROSTER_EXPORT, {
        id: t.id, filePath, password: String(o?.password || ''), includeUser: !!o?.includeUser, includeConnections: !!o?.includeConnections,
      });
    });
    ipc.handle('roster:importPick', async (includeUser) => {
      pickedImport = await shell.pickOpenTama(null);
      if (!pickedImport) return null;
      return bus.request(TOPICS.ROSTER_IMPORT, { filePath: pickedImport, includeUser: !!includeUser });
    });
    ipc.handle('roster:importPassword', (pw, includeUser) => {
      if (!pickedImport) return { error: 'Pick a file first.' };
      return bus.request(TOPICS.ROSTER_IMPORT, { filePath: pickedImport, password: String(pw || ''), includeUser: !!includeUser });
    });
  }

  usageIpc(); telegramIpc(); googleIpc(); eventsIpc(); weatherIpc(); musicIpc(); onboardingIpc(); rosterIpc(); providersIpc(); setupIpc();
}

module.exports = { wirePageIpc };
