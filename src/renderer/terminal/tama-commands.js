/* Tama's own terminal commands (PROD-1/2, PET-3): todos, focus, reminders, notes, git watch, care.
   Merged into terminal.js's LOCAL command table. Desktop and (in M7) Telegram call the same core. */
window.makeTamaCommands = function makeTamaCommands(K, { info, error, getCwd }) {
  const P = K.prod;
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const show = (r, ok) => (r && r.error ? error(`✗ ${r.error}`) : info(ok(r)));

  async function listTodos() {
    const s = await P.get();
    const open = s.todos.filter((t) => !t.done);
    const done = s.todos.filter((t) => t.done);
    if (!s.todos.length) return info('⎿  No todos yet. Add one: /todo write the README');
    info([
      ...open.map((t, i) => `  ${String(i + 1).padStart(2)}. ☐ ${t.text}`),
      ...done.map((t) => `      ☑ ${t.text}`),
      '', '  /done <n> to finish · /todel <n> to remove',
    ].join('\n'));
  }

  const HELP = [
    '',
    '  Tama',
    '  /todo [text]     add a todo (no text = list)        /done <n>  /todel <n>',
    '  /focus [min]     start a focus session (default 25) /focus stop',
    '  /remind <when> <text>   e.g. /remind in 10m stretch · /remind 3pm call mom · /reminders',
    '  /note [text]     jot a note (no text = recent notes)',
    '  /watch [here|path]   earn bond from your commits in a repo (no arg = list) · /unwatch <here|path>',
    '  /feed  /snack  /nap  take care of your Tama · /tama  My Tamas (switch, hatch, export, import)',
    '',
    '  Brain   ♡ chat brain (cheap)  ● Claude Code (edits, asks first)  ◆ agy (read-only review & plan)',
    '  /auto           chat brain answers, hands real work to a coding agent (default)',
    '  /chat  /code    always chat brain / always coding agent     @chat @code @claude @agy <msg>  one-off',
    '  /engine [auto|claude|agy]   work agent (auto = Claude; agy reviews/plans when Claude is tight)',
    '  /engine chat [auto|agy|claude]   chat brain engine · /engines  status · /budget [usd]  daily Claude budget',
  ];

  return {
    help: HELP,
    commands: {
      todo: ['Add a todo, or list todos', async (arg) => {
        if (!arg) return listTodos();
        show(await P.todoAdd(arg), (r) => `⎿  ☐ added: ${r.todo.text}`);
      }],
      todos: ['List todos', listTodos],
      done: ['Finish todo <n>', async (arg) => show(await P.todoDone(arg), (r) => `⎿  ☑ ${r.todo.text}${r.gained ? `  (+${r.gained} bond 💗)` : ''}`)],
      todel: ['Remove todo <n>', async (arg) => show(await P.todoRemove(arg), () => '⎿  removed')],
      focus: ['Start/stop a focus session', async (arg) => {
        if (arg === 'stop') return show(await P.focusStop(), () => '⎿  focus stopped');
        const s = await P.get();
        if (s.focus.phase === 'focus') return info(`⎿  already focusing until ${fmtTime(s.focus.endsAt)} (/focus stop)`);
        show(await P.focusStart(Number(arg) || 25), (r) => `⎿  ⏱️ focus ${r.focus.minutes} min, until ${fmtTime(r.focus.endsAt)}. ganbatte!`);
      }],
      remind: ['Set a reminder', async (arg) => {
        if (!arg) return info('⎿  e.g. /remind in 10m stretch · /remind 15:30 standup · /remind tomorrow 9am dentist');
        show(await P.remindAdd(arg), (r) => `⎿  ⏰ "${r.reminder.text}" ${r.when}`);
      }],
      reminders: ['List reminders', async () => {
        const s = await P.get();
        info(s.reminders.length ? s.reminders.map((r) => `  ⏰ ${fmtTime(r.at)}  ${r.text}`).join('\n') : '⎿  no pending reminders');
      }],
      note: ['Jot a note, or list notes', async (arg) => {
        if (arg) return show(await P.noteAdd(arg), () => '⎿  📝 noted');
        const s = await P.get();
        info(s.notes.length ? s.notes.slice(-10).map((n) => `  📝 ${n.text}`).join('\n') : '⎿  no notes yet');
      }],
      watch: ['Watch a git repo for your commits', async (arg) => {
        if (!arg) {
          const r = await P.watchList();
          return info(r.repos.length ? r.repos.map((x) => `  👀 ${x}`).join('\n') : '⎿  not watching any repo. /watch here (current folder) or /watch <path>');
        }
        const target = arg === 'here' ? getCwd() : arg;
        if (!target) return error('✗ No project folder yet. Use /cd first or give a path.');
        show(await P.watchAdd(target), (r) => `⎿  👀 watching ${r.repo}. Your new commits earn bond XP.`);
      }],
      unwatch: ['Stop watching a repo', async (arg) => {
        const target = arg === 'here' || !arg ? getCwd() : arg;
        show(await P.watchRemove(target), () => `⎿  stopped watching ${target}`);
      }],
      auto: ['Chat brain answers and hands real work to a coding agent', async () => { await K.brain.set({ chatMode: 'auto' }); info('⎿  ♡ auto: I chat, and hand real work to a coding agent'); }],
      chat: ['Always talk to the chat brain', async () => { await K.brain.set({ chatMode: 'chat' }); info('⎿  ♡ chat mode: just us talking (use @code for work)'); }],
      code: ['Always send to the coding agent', async () => { await K.brain.set({ chatMode: 'code' }); info('⎿  ● code mode: everything goes to the coding agent (use @chat to talk)'); }],
      engine: ['Pick the coding agent / chat engine', async (arg) => {
        const [a, b] = String(arg || '').split(/\s+/);
        if (a === 'chat' && ['auto', 'agy', 'claude'].includes(b)) { await K.brain.set({ liteEngine: b }); return info(`⎿  chat brain engine: ${b}`); }
        if (['auto', 'claude', 'agy'].includes(a)) { await K.brain.set({ codeEngine: a }); return info(`⎿  work agent: ${a}${a === 'agy' ? ' (read-only: reviews and plans; use @claude for edits)' : ''}`); }
        const s = await K.brain.status();
        info(`⎿  coding agent: ${s.codeEngine} · chat brain: ${s.liteEngine} · mode: ${s.chatMode}  (/engine auto|claude|agy · /engine chat auto|agy|claude)`);
      }],
      engines: ['Show brain status', async () => {
        const s = await K.brain.status();
        const u = s.usage;
        info([
          `  Claude Code   ${s.available.claude ? '✓ found' : '✗ not found'}    agy   ${s.available.agy ? '✓ found' : '✗ not found'}`,
          `  chat brain    ${s.liteEngine} (preference: ${s.litePreference})    coding agent: ${s.codeEngine}    mode: ${s.chatMode}`,
          `  today         Claude ${u.claudeTurns} turns ≈$${u.claudeUsd.toFixed(2)} / $${s.dailyClaudeUsd} · agy ${u.agyTurns} turns · chat ${u.liteTurns} turns`,
          s.claudeTight.tight ? `  ⚠ Claude is resting: ${s.claudeTight.reason} (auto mode lets agy review/plan, read-only)` : '',
        ].filter(Boolean).join('\n'));
      }],
      budget: ['Daily Claude budget (USD, API-equivalent)', async (arg) => {
        if (arg) { const s = await K.brain.set({ dailyClaudeUsd: Number(arg) }); return info(`⎿  daily Claude budget: $${s.dailyClaudeUsd}`); }
        const s = await K.brain.status();
        info(`⎿  Claude today ≈$${s.usage.claudeUsd.toFixed(2)} of $${s.dailyClaudeUsd} (API-equivalent estimate). /budget <usd> to change, 0 = no limit.`);
      }],
      tama: ['My Tamas: switch, hatch, graduate, export, import', () => { K.openRoster(false); info('⎿  opened My Tamas'); }],
      feed: ['Feed your Tama', async () => show(await K.act('feed'), (r) => (r.ok ? '⎿  🍙 itadakimasu!' : `⎿  (${r.reason})`))],
      snack: ['Energy snack (+25)', async () => show(await K.act('snack'), (r) => (r.ok ? '⎿  ⚡ energy +25' : r.reason === 'cooldown' ? `⎿  snack again in ${Math.ceil(r.retryInMs / 60000)} min` : `⎿  (${r.reason})`))],
      nap: ['10-minute power nap', async () => show(await K.act('nap'), (r) => (r.ok ? '⎿  💤 power nap, 10 min' : `⎿  (${r.reason})`))],
    },
  };
};
