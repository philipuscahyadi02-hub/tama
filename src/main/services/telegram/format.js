// @ts-check
// Pure text helpers for the Telegram bridge (TG-4..6). Plain text only (no parse_mode), so nothing needs escaping.

const MAX = 3800; // Telegram allows 4096; leave room

/** @param {string} s @param {number} [n] */
const clip = (s, n = MAX) => { const t = String(s || ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
/** @param {string} p */
const base = (p) => String(p || '').split(/[\\/]/).pop() || '';

/** One short progress line for a Claude Code tool call. @param {{ name: string, input?: any }} ev */
function toolLine(ev) {
  const i = ev.input || {};
  switch (ev.name) {
    case 'Read': return `📖 read ${base(i.file_path)}`;
    case 'Edit': case 'MultiEdit': return `✏️ edit ${base(i.file_path)}`;
    case 'Write': return `📝 write ${base(i.file_path)}`;
    case 'Bash': return `💻 ${clip(String(i.command || ''), 80)}`;
    case 'Grep': return `🔍 search "${clip(String(i.pattern || ''), 40)}"`;
    case 'Glob': return `🔎 find ${clip(String(i.pattern || ''), 40)}`;
    case 'WebFetch': return `🌐 ${clip(String(i.url || ''), 60)}`;
    case 'WebSearch': return `🌐 search "${clip(String(i.query || ''), 40)}"`;
    case 'TodoWrite': return '📋 plan';
    case 'Task': case 'Agent': return `👯 ${clip(String(i.description || 'sub-task'), 50)}`;
    default: return `🔧 ${String(ev.name || 'tool').replace(/^mcp__(\w+)__/, '$1 · ')}`;
  }
}

/** Permission prompt text for the phone. @param {{ name: string, tool?: string, input?: any }} ev */
function permissionText(ev) {
  const i = ev.input || {};
  const name = ev.tool || ev.name;
  let detail = '';
  if (name === 'Bash') detail = `$ ${i.command || ''}`;
  else if (name === 'Edit' || name === 'MultiEdit') detail = `${i.file_path || ''}\n- ${clip(String(i.old_string || ''), 400)}\n+ ${clip(String(i.new_string || ''), 400)}`;
  else if (name === 'Write') detail = `${i.file_path || ''}\n${clip(String(i.content || ''), 600)}`;
  else detail = clip(JSON.stringify(i, null, 1), 700);
  return clip(`🔐 Claude wants to use ${ev.name}:\n\n${detail}\n\nAllow it?`);
}

/** @param {number} v */
const bar = (v) => `${'█'.repeat(Math.round((v || 0) / 20))}${'░'.repeat(5 - Math.round((v || 0) / 20))}`;

/** @param {any} pet  PetSnapshot */
function statusText(pet) {
  if (!pet || !pet.state) return 'Hmm, I can\'t see myself right now…';
  const s = pet.state;
  const lv = pet.level || {};
  return [
    `${pet.name} · ${lv.title || ''} ${lv.emoji || ''}${s.streak && s.streak.count > 1 ? ` · 🔥 ${s.streak.count}-day streak` : ''}`,
    `🍙 tummy  ${bar(s.hunger)} ${Math.round(s.hunger)}`,
    `💗 mood   ${bar(s.happy)} ${Math.round(s.happy)}`,
    `⚡ energy ${bar(s.energy)} ${Math.round(s.energy)}`,
    `🛁 clean  ${bar(s.clean)} ${Math.round(s.clean)}`,
    s.asleep ? '💤 sleeping' : pet.charging ? '🔌 charging' : '',
  ].filter(Boolean).join('\n');
}

const HELP = [
  'Just talk to me! (Gemini, using your Google login) ✨',
  'Google things (calendar, email drafts, Docs, Sheets) I do myself: you just confirm with ✅.',
  'Code on your PC: I\'ll show a 💻 button to hand it to Claude Code.',
  '',
  '/status · how I\'m doing (with a picture)',
  '/feed /snack /nap · take care of me',
  '/summon · bring me back on your PC screen',
  '/todo [text] · /done <n> · /todos',
  '/focus [min|stop] · /remind <when> <text>',
  '/brief · today\'s calendar, mail and todos',
  '',
  'Work on your PC (Claude Code):',
  '/code <task> · do it (I ask before every change)',
  '/repos · where it can work (0 = my desk, for Google tasks) · /cd <n>',
  '/stop · interrupt',
  '/remote off · kill switch for /code',
].join('\n');

/** Bot command menu (setMyCommands). */
const COMMANDS = [
  ['status', 'How your Tama is doing'], ['feed', 'Feed'], ['snack', 'Energy snack'], ['nap', 'Power nap'], ['summon', 'Bring them back on screen'],
  ['todo', 'Add or list todos'], ['done', 'Finish todo <n>'], ['focus', 'Focus timer'], ['remind', 'Reminder: /remind 5pm stretch'],
  ['brief', 'Calendar, mail and todos'], ['code', 'Ask Claude Code to do something'], ['stop', 'Interrupt Claude'],
  ['repos', 'Allowed project folders'], ['cd', 'Switch project'], ['remote', 'on/off: remote coding'], ['help', 'All commands'],
].map(([command, description]) => ({ command, description }));

module.exports = { clip, toolLine, permissionText, statusText, HELP, COMMANDS, MAX };
