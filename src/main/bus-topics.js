// @ts-check
// Registry of every bus topic. Add a topic here BEFORE using it (AGENTS.md rule 5).
// Events:   <area>.<noun>.<verb-past>   (bus.emit / bus.on)
// Requests: <area>.<verb>               (bus.handle / bus.request)

/**
 * (PetState lives with its logic in services/pet/logic.js.)
 */

/** @typedef {import('./services/pet/logic').PetState} PetState */

/**
 * @typedef {Object} EngineEvent  Normalized engine output (ARCHITECTURE §5)
 * @property {string} t  'status'|'text-start'|'text-delta'|'text-end'|'tool'|'tool-result'|'permission'|
 *   'permission-done'|'result'|'error'|'session'|'init'|'info'|'mode'|'model'|'cwd'|'cleared'
 */

const TOPICS = {
  // ---- events ----
  /** { topic, message } — a listener or handler failed */
  APP_ERROR: 'app.error',
  /** PetSnapshot { tamaId, name, egg, state: PetState, hoursAway, level, charging } */
  PET_STATE_CHANGED: 'pet.state.changed',
  /** { source, gained, levelUp: null|Level, streak: null|{count, bonus} } — bond XP was awarded */
  PET_BOND_CHANGED: 'pet.bond.changed',
  /** { onAC: boolean } — laptop plugged in / unplugged (platform/power) */
  DEVICE_POWER_CHANGED: 'device.power.changed',
  /** { idle: boolean, idleSeconds: number } — user away from the PC for > IDLE_NAP_SECONDS (platform/power) */
  DEVICE_IDLE_CHANGED: 'device.idle.changed',
  /** ProductivitySnapshot { todos, notes, reminders (pending), focus } */
  PROD_CHANGED: 'prod.changed',
  /** { phase: 'focus'|'break'|'idle', endsAt?, minutes?, completed?, gained?, stopped?, breakOver? } */
  PROD_FOCUS_PHASE: 'prod.focus.phase',
  /** { id, text, late } — a reminder is due now */
  PROD_REMINDER_DUE: 'prod.reminder.due',
  /** { repo, subject } — a new commit by the user in a watched repo (bond XP awarded) */
  PROD_COMMIT_SEEN: 'prod.commit.seen',
  /** { engine: 'claude'|'agy'|'tama', role: 'worker'|'lite'|'brain', ev: EngineEvent } */
  ENGINE_EVENT: 'engine.event',
  /** Chat window events (D-029): { t: 'message', message } | { t: 'delta', text } | { t: 'tool', text } | { t: 'status', state }
   *  | { t: 'error', message } | { t: 'done', isError } | { t: 'cleared' } */
  CHAT_EVENT: 'chat.event',
  /** UiPrefs { termTheme, tourDone, unlocked, variants } — after a change (D-032) */
  UI_PREFS_CHANGED: 'ui.prefs.changed',
  /** { facts: Fact[] } — memories changed (EVT-4) */
  MEMORY_CHANGED: 'memory.changed',
  /** { id, kind: TamaEvent kind | 'reply', text, choices: string[], quest: string|null } — show an event on the pet (EVT-2) */
  EVENT_SHOWN: 'event.shown',
  /** GoogleStatus { configured, signedIn, email, readonly, backup, lastBackup, inMeeting, scopes } — after a change (D-034) */
  GOOGLE_CHANGED: 'google.changed',
  /** { summary, start, minutes } — a calendar event starts in ≤ 5 minutes (GOOG-3) */
  GOOGLE_MEETING_SOON: 'google.meeting.soon',
  /** { text, kind: 'info'|'warn' } — brain messages worth a pet bubble (budget, missing engines) */
  BRAIN_NOTICE: 'brain.notice',
  /** { reason: string } — pet window was brought back on screen by summon() */
  SUMMON_DONE: 'summon.done',
  /** { action: 'feed'|'play'|'snack'|'sleep' } — care action chosen from the tray menu */
  TRAY_ACTION: 'tray.action',
  /** { tamaId, spec: CharacterSpec, stage: 'egg'|'hatched' } — look/name/voice changed (restyle, rebirth, hatch) */
  CHARACTER_CHANGED: 'character.changed',

  // ---- requests ----
  /** () → PetSnapshot */
  PET_GET: 'pet.get',
  /** { action: 'feed'|'snack'|'play'|'clean'|'sleep'|'nap'|'pat' } → { ok, reason?, retryInMs?, state } */
  PET_ACT: 'pet.act',
  /** { source: 'agent'|'commit'|'focus'|'todo'|'calendar' } → { gained } — productivity bond XP (BOND-1) */
  PET_AWARD: 'pet.award',
  /** () → { activeTamaId, tamas: RosterEntry[] } */
  ROSTER_GET: 'roster.get',
  /** { id } → { ok, relaunching? } — make a Tama active (app relaunches) */
  ROSTER_SWITCH: 'roster.switch',
  /** () → { id, ok, relaunching } — new egg becomes active */
  ROSTER_HATCH_NEW: 'roster.hatchNew',
  /** { id } → { ok } — to the album (active one: a new egg is hatched first) */
  ROSTER_GRADUATE: 'roster.graduate',
  /** { id } → { ok } — back from the album to "home" */
  ROSTER_RESTORE: 'roster.restore',
  /** { id, confirmName } → { ok } | { error } — permanent */
  ROSTER_DELETE: 'roster.delete',
  /** { id, filePath, password?, includeUser?, includeConnections? } → { ok, filePath, encrypted } | { error } */
  ROSTER_EXPORT: 'roster.export',
  /** { filePath, password?, includeUser? } → { ok, id, name } | { error, code? } */
  ROSTER_IMPORT: 'roster.import',
  /** () → { tamaId, spec: CharacterSpec, stage } for the active Tama */
  CHARACTER_GET: 'character.get',
  /** { spec, mode: 'hatch'|'restyle'|'rebirth', keepBond?: boolean } → { tamaId, spec } */
  CHARACTER_SAVE: 'character.save',
  /** { gender, prompt, name? } → { variants: CharacterSpec[3], source: 'ai'|'offline', warning? } */
  DESIGNER_GENERATE: 'designer.generate',
  /** { spec, instruction } → { variants: CharacterSpec[3], source, warning? } */
  DESIGNER_REFINE: 'designer.refine',
  /** { voicePrompt, gender, personality? } → { voice, speech|null, source } */
  DESIGNER_VOICE: 'designer.voice',
  /** () → ProductivitySnapshot */
  PROD_GET: 'prod.get',
  /** { text } → { ok, todo } | { error } */
  PROD_TODO_ADD: 'prod.todo.add',
  /** { ref: id | 1-based number } → { ok, todo, gained } | { error } */
  PROD_TODO_DONE: 'prod.todo.done',
  /** { ref } → { ok } | { error } */
  PROD_TODO_REMOVE: 'prod.todo.remove',
  /** { text } → { ok, note } | { error } */
  PROD_NOTE_ADD: 'prod.note.add',
  /** { input } | { at, text } → { ok, reminder, when } | { error } */
  PROD_REMIND_ADD: 'prod.remind.add',
  /** { id } → { ok } | { error } */
  PROD_REMIND_CANCEL: 'prod.remind.cancel',
  /** { minutes?, breakMinutes? } → { ok, focus } */
  PROD_FOCUS_START: 'prod.focus.start',
  PROD_FOCUS_STOP: 'prod.focus.stop',
  /** { path } → { ok, repo, repos } | { error } */
  PROD_WATCH_ADD: 'prod.watch.add',
  /** { path } → { ok, repos } */
  PROD_WATCH_REMOVE: 'prod.watch.remove',
  /** () → { repos } */
  PROD_WATCH_LIST: 'prod.watch.list',
  /** () → terminal init info { cwd, mode, model, busy, lastSessionId, totalCost, commands } */
  ENGINE_INFO: 'engine.info',
  /** text → void */
  ENGINE_SEND: 'engine.send',
  ENGINE_INTERRUPT: 'engine.interrupt',
  ENGINE_CLEAR: 'engine.clear',
  /** mode → void */
  ENGINE_SET_MODE: 'engine.setMode',
  /** model|null → void */
  ENGINE_SET_MODEL: 'engine.setModel',
  /** 'low'|'medium'|'high'|'xhigh'|'max'|null → void — Claude Code reasoning effort */
  ENGINE_SET_EFFORT: 'engine.setEffort',
  /** dir → { t:'cwd', cwd, isGit } | { error } */
  ENGINE_SET_CWD: 'engine.setCwd',
  /** { id, choice: 'yes'|'always'|'no', feedback? } → boolean — answered by brain/PermissionGate (SAFE-1) */
  ENGINE_ANSWER_PERMISSION: 'engine.answerPermission',
  /** () → { terminal: 'claude', chat: 'agy', available, usage, dailyClaudeUsd, claudeTight } */
  BRAIN_STATUS: 'brain.status',
  /** { dailyClaudeUsd? } → status */
  BRAIN_SET: 'brain.set',
  /** text → { ok, error? } — talk to your Tama (agy, D-029) */
  CHAT_SEND: 'chat.send',
  /** () → { messages: ChatMessage[], busy, available } */
  CHAT_HISTORY: 'chat.history',
  CHAT_INTERRUPT: 'chat.interrupt',
  CHAT_CLEAR: 'chat.clear',
  /** () → UiPrefs */
  UI_PREFS_GET: 'ui.prefs.get',
  /** { termTheme?, tourDone? } → UiPrefs | { error, minLevel? } */
  UI_PREFS_SET: 'ui.prefs.set',
  /** () → { facts: Fact[] } */
  MEMORY_GET: 'memory.get',
  /** { text, source? } → { ok, fact?, duplicate?, facts } | { error } */
  MEMORY_ADD: 'memory.add',
  /** { ref: number (1-based) | id | 'all' } → { ok, removed, facts } | { error } */
  MEMORY_FORGET: 'memory.forget',
  /** { day: 'YYYY-MM-DD', text } → { ok } */
  DIARY_WRITE: 'diary.write',
  /** () → { days: string[] } newest first */
  DIARY_LIST: 'diary.list',
  /** { day? } → { day, text, days } | { error } — latest page when no day */
  DIARY_READ: 'diary.read',
  /** { kind: 'line'|'diary', seed } → string | null — in-character text from the chat brain (EVT-3) */
  BRAIN_COMPOSE: 'brain.compose',
  /** { role: 'user'|'tama'|'note', text } → void — add a line to the chat history (events) */
  CHAT_PUSH: 'chat.push',
  /** { id, choice?: number, dismiss?: boolean } → { ok, reply? } | { error } */
  EVENTS_ANSWER: 'events.answer',
  /** { id? } → { ok } | { error } — show an event now (/event) */
  EVENTS_TRIGGER: 'events.trigger',
  /** () → GoogleStatus */
  GOOGLE_STATUS: 'google.status',
  /** { clientId, clientSecret } → GoogleStatus | { error } — the user's own Desktop OAuth client (D-009) */
  GOOGLE_SET_CLIENT: 'google.setClient',
  /** () → GoogleStatus | { error } — browser sign-in (loopback + PKCE) */
  GOOGLE_LOGIN: 'google.login',
  /** () → GoogleStatus — revoke + delete tokens */
  GOOGLE_LOGOUT: 'google.logout',
  /** { readonly?, backup? } → GoogleStatus & { needsLogin } */
  GOOGLE_SET: 'google.set',
  /** () → { text, events, mail, todos } | { error } — morning brief (GOOG-8) */
  GOOGLE_BRIEF: 'google.brief',
  /** () → string — short read-only context line for the chat brain ('' when signed out) */
  GOOGLE_CONTEXT: 'google.context',
  /** () → { ok, name, size } — back up the active Tama to Drive appData (PORT-6) */
  GOOGLE_BACKUP_NOW: 'google.backupNow',
  /** () → { backups: [{ id, tamaId, day, size }] } */
  GOOGLE_BACKUPS: 'google.backups',
  /** { fileId } → roster import result — restore a backup as a new Tama */
  GOOGLE_RESTORE: 'google.restore',
  /** sessionId|null → { ok } | { error } */
  ENGINE_RESUME: 'engine.resume',
  /** { reason } → void — bring the pet back on screen */
  SUMMON: 'summon',

  // ---- M5 extras: weather, fullscreen do-not-disturb (D-035) ----
  /** () → { location: {city, lat, lon}|null, current: Weather|null, fetchedAt, summary } — refreshes at most every 30 min */
  WEATHER_GET: 'weather.get',
  /** { city } | { off: true } → { ok, location, current } | { error } — geocodes the city (Open-Meteo) */
  WEATHER_SET: 'weather.set',
  /** () → boolean — is the foreground window fullscreen (game, video, slides)? false on errors / non-Windows */
  DEVICE_FULLSCREEN_GET: 'device.fullscreen.get',
};

module.exports = { TOPICS };
