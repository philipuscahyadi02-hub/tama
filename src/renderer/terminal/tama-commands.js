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
      tama: ['My Tamas: switch, hatch, graduate, export, import', () => { K.openRoster(false); info('⎿  opened My Tamas'); }],
      feed: ['Feed your Tama', async () => show(await K.act('feed'), (r) => (r.ok ? '⎿  🍙 itadakimasu!' : `⎿  (${r.reason})`))],
      snack: ['Energy snack (+25)', async () => show(await K.act('snack'), (r) => (r.ok ? '⎿  ⚡ energy +25' : r.reason === 'cooldown' ? `⎿  snack again in ${Math.ceil(r.retryInMs / 60000)} min` : `⎿  (${r.reason})`))],
      nap: ['10-minute power nap', async () => show(await K.act('nap'), (r) => (r.ok ? '⎿  💤 power nap, 10 min' : `⎿  (${r.reason})`))],
    },
  };
};
