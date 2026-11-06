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
    '  /feed  /snack  /nap  take care of your Tama · /stats  how they are doing · /wardrobe  restyle',
    '  /chat [msg]      open the 💬 chat (and send msg)    /tama  My Tamas (switch, hatch, export, import)',
    '  /theme [name]    terminal look (night · day · pastel · neon; unlocked by bond)',
    '  /memory          what your Tama remembers about you · /remember <fact> · /forget <n|all>',
    '  /diary [date]    read their diary (they write one every evening) · /diary list',
    '  /event [id]      start a little moment now · /dnd [on|off] quiet mode · /nudges [on|off] water & stretch',
    '  /google [setup|status|login|logout|brief|backup|backups|restore <n>|readonly on|off]   Gmail drafts, Calendar, Drive, Docs, Sheets',
    '  /brief           morning brief (calendar, important mail, todos) · /newpc  checklist for a new PC',
    '  /weather <city>  set your city for weather moments (no arg = now · /weather off) · /marker [on|off] walk tab',
    '  /phone [setup <token>|code|status|on|off|unpair|allow here|disallow here|remote on|off|awake on|off]   Telegram on your phone',
    '  coming soon: /voice (M8)',
    '',
    '  This terminal = Claude Code (asks before edits/commands).  Chat with your Tama = 💬 window (Ctrl+Alt+J, free via agy).',
    '  /engines  status · /budget [usd]  daily Claude budget (API-equivalent estimate)',
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
      engines: ['Show engine status', async () => {
        const s = await K.brain.status();
        const u = s.usage;
        info([
          `  terminal   Claude Code ${s.available.claude ? '✓ found' : '✗ not found (install + log in: claude)'}`,
          `  chat 💬    agy (Gemini) ${s.available.agy ? '✓ found' : '✗ not found (install the Antigravity CLI + log in)'}`,
          `  today      Claude ${u.claudeTurns} turns ≈$${u.claudeUsd.toFixed(2)} / $${s.dailyClaudeUsd} · chat ${u.liteTurns} messages`,
          s.claudeTight.tight ? `  ⚠ ${s.claudeTight.reason}` : '',
        ].filter(Boolean).join('\n'));
      }],
      budget: ['Daily Claude budget (USD, API-equivalent)', async (arg) => {
        if (arg) { const s = await K.brain.set({ dailyClaudeUsd: Number(arg) }); return info(`⎿  daily Claude budget: $${s.dailyClaudeUsd}`); }
        const s = await K.brain.status();
        info(`⎿  Claude today ≈$${s.usage.claudeUsd.toFixed(2)} of $${s.dailyClaudeUsd} (API-equivalent estimate). /budget <usd> to change, 0 = no limit.`);
      }],
      tama: ['My Tamas: switch, hatch, graduate, export, import', () => { K.openRoster(false); info('⎿  opened My Tamas'); }],
      stats: ['How your Tama is doing', async () => {
        const p = await K.getPet();
        const s = p.state;
        const bar = (v) => `${'█'.repeat(Math.round(v / 10))}${'░'.repeat(10 - Math.round(v / 10))} ${Math.round(v)}`;
        const lv = p.level;
        info([
          `  ${p.name} · ${lv.title} ${lv.emoji}${lv.next ? ` (${Math.floor(lv.xp)} / ${lv.next} bond)` : ' (max!)'}${s.streak && s.streak.count ? ` · 🔥 ${s.streak.count}-day streak` : ''}`,
          `  tummy  ${bar(s.hunger)}    mood   ${bar(s.happy)}`,
          `  energy ${bar(s.energy)}    clean  ${bar(s.clean)}${s.asleep ? '    💤 asleep' : ''}${p.charging ? '    🔌 charging' : ''}`,
        ].join('\n'));
      }],
      wardrobe: ['Restyle your Tama', () => { K.openOnboarding('restyle'); info('⎿  opened the wardrobe ✨'); }],
      chat: ['Open the 💬 chat with your Tama (optionally send a message)', async (arg) => {
        K.showChat();
        if (arg) await K.chat.send(arg);
        info(arg ? '⎿  sent to the chat window 💬' : '⎿  opened the chat window 💬 (Ctrl+Alt+J)');
      }],
      theme: ['Terminal look: night, day, pastel, neon', async (arg) => {
        const prefs = await K.ui.prefs();
        if (!arg) {
          return info([
            `⎿  theme: ${prefs.termTheme}`,
            ...prefs.variants.map((v) => `    ${v.unlocked ? (v.id === prefs.termTheme ? '●' : '○') : '🔒'} ${v.id.padEnd(7)} ${v.label}${v.unlocked ? '' : ` (unlocks at bond level ${v.minLevel + 1})`}`),
          ].join('\n'));
        }
        const r = await K.ui.setPrefs({ termTheme: arg.trim().toLowerCase() });
        if (r.error === 'locked') return info(`⎿  🔒 not yet! that look unlocks at bond level ${r.minLevel + 1}. Keep being productive together~`);
        show(r, () => `⎿  theme: ${r.termTheme} ✨`);
      }],
      memory: ['What your Tama remembers about you', async () => {
        const { facts } = await K.memory.get();
        if (!facts.length) return info('⎿  Nothing yet. Tell them about yourself in the 💬 chat, or /remember <fact>.');
        info([...facts.map((f, i) => `  ${String(i + 1).padStart(2)}. ${f.text}  (${f.source}, ${new Date(f.at).toLocaleDateString()})`),
          '', '  /forget <n> to remove one · /forget all to clear'].join('\n'));
      }],
      remember: ['Tell your Tama a fact to remember', async (arg) => {
        if (!arg) return info('⎿  Usage: /remember my birthday is March 3');
        show(await K.memory.add(arg), (r) => (r.duplicate ? '⎿  I already remember that~' : `⎿  📝 I'll remember: ${r.fact.text}`));
      }],
      forget: ['Forget a memory (number from /memory, or all)', async (arg) => {
        const a = String(arg || '').trim().toLowerCase();
        if (!a) return info('⎿  Usage: /forget <n> (see /memory) or /forget all');
        show(await K.memory.forget(a === 'all' ? 'all' : a), (r) => (a === 'all' ? `⎿  forgot ${r.removed} memories. a fresh start~` : `⎿  forgot: ${r.fact.text}`));
      }],
      diary: ["Read your Tama's diary", async (arg) => {
        if (arg === 'list') {
          const { days } = await K.diary.list();
          return info(days.length ? `⎿  diary pages: ${days.slice(0, 30).join(', ')}` : '⎿  No pages yet. I write one every evening~');
        }
        const r = await K.diary.read(arg || undefined);
        if (r.error) return info(`⎿  ${r.error}`);
        info(`📔 ${r.text.trim()}` + (r.days.length > 1 ? '\n\n  (/diary list for older pages)' : ''));
      }],
      event: ['Start a little moment with your Tama now', async (arg) => {
        const r = await K.events.trigger(arg || undefined);
        show(r, () => '⎿  look at your Tama~ 💭');
      }],
      dnd: ['Do not disturb: no events or babble', async (arg) => {
        const p = await K.ui.prefs();
        const on = arg ? /^(on|1|yes)$/i.test(arg) : !p.dnd;
        await K.ui.setPrefs({ dnd: on });
        info(on ? '⎿  🤫 quiet mode on: no events until /dnd off' : '⎿  quiet mode off~');
      }],
      nudges: ['Water & stretch reminders on/off', async (arg) => {
        const p = await K.ui.prefs();
        const on = arg ? /^(on|1|yes)$/i.test(arg) : !p.nudges;
        await K.ui.setPrefs({ nudges: on });
        info(on ? '⎿  💧 wellbeing nudges on' : '⎿  wellbeing nudges off');
      }],
      // ---- M5 extras (D-035) ----
      weather: ['Weather where you are: /weather <city>, /weather off', async (arg) => {
        const a = String(arg || '').trim();
        if (a.toLowerCase() === 'off') { await K.weather.off(); return info('⎿  weather off. I forgot your city~'); }
        const r = a ? await K.weather.set(a) : await K.weather.get();
        if (r.error) return error(`✗ ${r.error}`);
        if (!r.location) return info('⎿  No city set. /weather Tokyo (uses Open-Meteo, no account needed)');
        info(`⎿  ${a ? '📍 saved: ' : '📍 '}${r.location.city} · ${r.summary || 'weather unavailable right now'}`);
      }],
      marker: ['"Out for a walk" tab on the screen edge while hidden: on/off', async (arg) => {
        const p = await K.ui.prefs();
        const on = arg ? /^(on|1|yes)$/i.test(arg) : !p.walkMarker;
        await K.ui.setPrefs({ walkMarker: on });
        info(on ? '⎿  🚶 walk tab on: when you hide your Tama, a little tab on the right edge calls them back' : '⎿  walk tab off');
      }],
      phone: ['Your Tama on your phone (Telegram)', async (arg) => {
        const T = K.telegram;
        const [cmd, ...rest] = String(arg || 'status').trim().split(/\s+/);
        const v = (rest[0] || '').toLowerCase();
        const pairInfo = (s) => (s.pairing
          ? `⎿  📱 Open ${s.pairing.link || `your bot @${s.bot}`} on your phone and press Start, or send it this code: ${s.pairing.code} (valid 15 min)`
          : '');
        switch (cmd) {
          case 'setup': {
            if (!rest[0]) {
              return info([
                '⎿  Telegram setup (2 minutes):',
                '    1. In Telegram, open @BotFather → /newbot → pick a name → copy the token (123456:AA…)',
                '    2. Here: /phone setup <token>',
                '    3. Open the link I show on your phone and press Start. Only that chat will ever be answered.',
              ].join('\n'));
            }
            const r = await T.setup(rest[0]);
            if (r.error) return error(`✗ ${r.error}`);
            return info(`⎿  ✅ bot @${r.bot} is running on this PC.\n${pairInfo(r)}`);
          }
          case 'code': { const r = await T.newCode(); return r.error ? error(`✗ ${r.error}`) : info(pairInfo(r)); }
          case 'unpair': await T.unpair(); return info('⎿  phone disconnected. /phone code to pair again');
          case 'on': case 'off': await T.set({ enabled: cmd === 'on' }); return info(`⎿  Telegram bot ${cmd === 'on' ? 'running 📱' : 'stopped 💤'}`);
          case 'allow': case 'disallow': {
            const path = !rest.length || v === 'here' ? getCwd() : rest.join(' ');
            if (!path) return error('✗ /cd into a project first, then /phone allow here');
            const r = await T.set(cmd === 'allow' ? { allow: path } : { disallow: path });
            return info(`⎿  remote /code folders: ${r.repos.length ? r.repos.join(', ') : '(none)'}`);
          }
          case 'remote': await T.set({ remote: v === 'on' }); return info(`⎿  remote coding from the phone: ${v === 'on' ? 'on 💻' : 'off 🔒'}`);
          case 'awake': await T.set({ awake: v === 'on' }); return info(`⎿  keep the PC awake for your phone: ${v === 'on' ? 'on ☕' : 'off'}`);
          default: {
            const s = await T.status();
            if (!s.configured) return info('⎿  Telegram isn\'t set up yet. /phone setup shows the 2-minute steps 📱');
            return info([
              `⎿  📱 bot @${s.bot} · ${s.running ? 'running' : 'stopped'} · ${s.paired ? 'paired with your phone ✅' : 'not paired yet'}`,
              `    remote /code: ${s.remote ? 'on' : 'off'} · folders: ${s.repos.length ? s.repos.join(', ') : '(none: /phone allow here)'}`,
              `    keep PC awake: ${s.awake ? 'on' : 'off'}${s.ignored ? ` · ignored ${s.ignored} message(s) from other chats` : ''}`,
              pairInfo(s),
            ].filter(Boolean).join('\n'));
          }
        }
      }],
      voice: ['(M8) Voice settings', () => info('⎿  Voice (AivisSpeech) arrives in M8.')],
      google: ['Connect Google: Gmail drafts, Calendar, Drive, Docs, Sheets', async (arg) => {
        const G = K.google;
        const [cmd, ...rest] = String(arg || 'status').trim().split(/\s+/);
        const s = await G.status();
        switch (cmd) {
          case 'setup': G.open(); return info('⎿  opened the Google setup window 🔗');
          case 'login': {
            if (!s.configured) { G.open(); return info('⎿  first time: follow the steps in the Google window 🔗'); }
            info('⎿  a browser window opened: pick your account and allow access~');
            return show(await G.login(), (r) => `⎿  ✅ connected as ${r.email || 'your account'}`);
          }
          case 'logout': await G.logout(); return info('⎿  disconnected from Google');
          case 'brief': return show(await G.brief(), (r) => r.text);
          case 'backup': info('⎿  backing up…'); return show(await G.backupNow(), (r) => `⎿  ☁️ saved ${r.name} (${Math.round(r.size / 1024)} KB)`);
          case 'backups': {
            const r = await G.backups();
            if (r.error) return error(`✗ ${r.error}`);
            if (!r.backups.length) return info('⎿  no backups yet. /google backup makes one now');
            return info(r.backups.map((b, i) => `  ${String(i + 1).padStart(2)}. ${b.day}  ${b.tamaId}  ${Math.round(b.size / 1024)} KB`).join('\n') + '\n  /google restore <n> brings one back as a new Tama');
          }
          case 'restore': {
            const r = await G.backups();
            const b = r.backups && r.backups[Number(rest[0]) - 1];
            if (!b) return info('⎿  Usage: /google restore <n> (see /google backups)');
            return show(await G.restore(b.id), (x) => `⎿  restored "${x.name}" as a new Tama. Switch to them in /tama`);
          }
          case 'readonly': {
            const r = await G.set({ readonly: /^(on|1|yes)$/i.test(rest[0] || '') });
            return info(`⎿  read all of Drive: ${r.readonly ? 'on' : 'off'}${r.needsLogin ? ' (needs /google login once more)' : ''}`);
          }
          default:
            if (!s.configured) return info('⎿  Google is not set up yet. /google setup opens a 5-minute guide 🔗');
            if (!s.signedIn) return info('⎿  Google app saved but not signed in: /google login');
            return info([
              `⎿  ✅ Google: ${s.email || 'connected'}${s.inMeeting ? ` · 📅 in a meeting (${s.inMeeting})` : ''}`,
              `    access: ${s.scopes.join(', ')}`,
              `    daily backup: ${s.backup ? 'on' : 'off'} (last: ${s.lastBackup ? new Date(s.lastBackup).toLocaleString() : 'never'}) · read all Drive: ${s.readonly ? 'on' : 'off'}`,
              '    ask in plain words: "draft a reply to…", "what\'s on my calendar?", "make a sheet for…"',
            ].join('\n'));
        }
      }],
      brief: ['Morning brief: calendar, important mail, todos', async () => {
        const r = await K.google.brief();
        if (r.error) return info('⎿  connect Google first (/google setup) for the brief~');
        info(`☀️ ${r.text}`);
      }],
      newpc: ['Checklist for setting up Tama on a new PC', async () => {
        const [b, g] = await Promise.all([K.brain.status(), K.google.status()]);
        const ok = (v) => (v ? '✅' : '☐');
        info([
          '  New PC checklist',
          `  ${ok(b.available.claude)} Claude Code installed and logged in (run \`claude\` once)   → the terminal`,
          `  ${ok(b.available.agy)} Antigravity CLI (agy) installed and logged in                → 💬 chat, events, diary`,
          `  ${ok(g.signedIn)} Google connected (/google setup, same Google app works on every PC)`,
          '  ☐ Telegram: comes in M7',
          '  Moving your Tama: My Tamas (/tama) → Export on the old PC → Import here, or /google backups + /google restore <n>.',
        ].join('\n'));
      }],
      feed: ['Feed your Tama', async () => show(await K.act('feed'), (r) => (r.ok ? '⎿  🍙 itadakimasu!' : `⎿  (${r.reason})`))],
      snack: ['Energy snack (+25)', async () => show(await K.act('snack'), (r) => (r.ok ? '⎿  ⚡ energy +25' : r.reason === 'cooldown' ? `⎿  snack again in ${Math.ceil(r.retryInMs / 60000)} min` : `⎿  (${r.reason})`))],
      nap: ['10-minute power nap', async () => show(await K.act('nap'), (r) => (r.ok ? '⎿  💤 power nap, 10 min' : `⎿  (${r.reason})`))],
    },
  };
};
