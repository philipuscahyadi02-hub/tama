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
  /** { engine: string, ev: EngineEvent } */
  ENGINE_EVENT: 'engine.event',
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
  /** () → { activeTamaId, tamas: {id,name}[] } */
  ROSTER_GET: 'roster.get',
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
  /** dir → { t:'cwd', cwd, isGit } | { error } */
  ENGINE_SET_CWD: 'engine.setCwd',
  /** { id, choice, feedback } → void   (moves to brain/PermissionGate in M3) */
  ENGINE_ANSWER_PERMISSION: 'engine.answerPermission',
  /** sessionId|null → { ok } | { error } */
  ENGINE_RESUME: 'engine.resume',
  /** { reason } → void — bring the pet back on screen */
  SUMMON: 'summon',
};

module.exports = { TOPICS };
