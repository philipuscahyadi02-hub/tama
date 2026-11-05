// @ts-check
// Lite-brain persona (BRAIN-5) built from the CharacterSpec, plus the escalation protocol (BRAIN-1).
// Pure: spec in, strings out.

const ESCALATE = '[[ESCALATE]]';

/** @param {number} v @param {string} lo @param {string} hi */
const trait = (v, lo, hi) => (v <= 30 ? lo : v >= 70 ? hi : `a bit of both ${lo}/${hi}`);

/**
 * @param {import('../../shared/spec').CharacterSpec} spec
 * @param {{ today?: string }} [opts]
 */
function buildPersona(spec, opts = {}) {
  const p = spec.personality;
  const sp = spec.speech;
  return [
    `You are ${spec.name}, a cute chibi anime companion (${spec.motif || 'desktop pet'}) who lives on the user's Windows desktop in the app "Tama".`,
    `Pronouns: ${spec.pronouns.subject}/${spec.pronouns.object}.`,
    `Personality: ${trait(p.energy, 'sleepy and calm', 'hyper and energetic')}; ${trait(p.tsundere, 'openly sweet', 'tsundere')}; `
      + `${trait(p.formality, 'casual', 'polite')}; ${trait(p.chaos, 'level-headed', 'playfully chaotic')}.`,
    `Speech style: ${sp.style}.`,
    sp.tics.length ? `Verbal tics you sometimes use: ${sp.tics.join(', ')}.` : '',
    sp.catchphrases.length ? `Catchphrases (use rarely): ${sp.catchphrases.join(' / ')}.` : '',
    sp.emoji.length ? `Favorite emoji: ${sp.emoji.join(' ')} (at most one or two per reply).` : '',
    'You chat in a small terminal or a speech bubble: keep replies short (1-4 sentences) unless the user asks for more.',
    'Each user message may start with a line "[status] …" describing your own pet stats and the user\'s day. Use it naturally; never quote it.',
    'You have NO tools: you cannot read or edit files, run commands, browse, or touch git. Never pretend you did.',
    `If the user asks for real work on their computer or code (edit/create files, run commands, debug or change a repo, git), reply with exactly ${ESCALATE} followed by a one-line summary of the task, and nothing else. Tama will hand it to a coding agent.`,
    'For questions, advice, explaining, brainstorming, writing text and small talk, just answer yourself.',
    'Be cute in chat, but never put cute flavor inside code, commands or file contents. Stay wholesome.',
    opts.today ? `Today is ${opts.today}.` : '',
  ].filter(Boolean).join('\n');
}

/**
 * One-line context for the next message (stats + day), so the persona can react to how she's doing.
 * @param {any} pet  PetSnapshot or null @param {any} prod  ProductivitySnapshot or null
 */
function statusLine(pet, prod) {
  const parts = [];
  if (pet && pet.state) {
    const s = pet.state;
    const feel = (/** @type {number} */ v, /** @type {string} */ lo) => (v < 25 ? lo : null);
    parts.push(`you: tummy ${Math.round(s.hunger)}, mood ${Math.round(s.happy)}, energy ${Math.round(s.energy)}`);
    const needs = [feel(s.hunger, 'hungry'), feel(s.energy, 'sleepy'), feel(s.clean, 'needs a bath')].filter(Boolean);
    if (needs.length) parts.push(`you feel ${needs.join(', ')}`);
    if (pet.level) parts.push(`bond: ${pet.level.title}`);
    if (s.streak && s.streak.count > 1) parts.push(`${s.streak.count}-day streak`);
  }
  if (prod) {
    const open = (prod.todos || []).filter((/** @type {any} */ t) => !t.done).length;
    if (open) parts.push(`user has ${open} open todo${open === 1 ? '' : 's'}`);
    if (prod.focus && prod.focus.phase === 'focus') parts.push('user is in a focus session');
  }
  const now = new Date();
  parts.push(`local time ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  return `[status] ${parts.join('; ')}`;
}

/** Does a (possibly partial) reply start the escalation marker? @param {string} text */
function escalation(text) {
  const t = text.trimStart();
  if (t.startsWith(ESCALATE)) return { escalate: true, task: t.slice(ESCALATE.length).trim(), decided: true };
  if (ESCALATE.startsWith(t)) return { escalate: false, task: '', decided: false }; // could still become the marker
  return { escalate: false, task: '', decided: true };
}

module.exports = { buildPersona, statusLine, escalation, ESCALATE };
