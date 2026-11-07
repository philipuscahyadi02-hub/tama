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
    '  /settings        every setting in one window',
    '  /quiet 23:00-08:00  quiet hours every night (/quiet off) · /lang auto|en|id|ja  her reply language',
    '  /voice pick      choose & tune her voice · /voice en|ja|off · /voice test · /mute · /motion auto|reduced|full',
    '  /google [setup|status|login|logout|brief|backup|backups|restore <n>|readonly on|off|maps-key <key|off>]   Gmail, Calendar, Drive, Docs, Sheets',
    '  /brief           morning brief (calendar, important mail, todos) · /newpc  checklist for a new PC',
    '  /usage [here]    Usage & accounts dashboard: Claude, Gemini, Google, Telegram usage + switch accounts',
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
      // ---- M10 (D-048) ----
      settings: ['Open the Settings window', async (arg) => { K.openSettings(String(arg || '').trim()); info('⎿  ⚙️ opening Settings~'); }],
      quiet: ['Quiet hours: /quiet 23:00-08:00 | on | off', async (arg) => {
        const a = String(arg || '').trim().toLowerCase();
        const m = a.match(/^(\d{1,2}:\d{2})\s*[-–to ]+\s*(\d{1,2}:\d{2})$/);
        const pad = (/** @type {string} */ t) => t.padStart(5, '0');
        let r;
        if (m) r = await K.ui.setPrefs({ quiet: { on: true, from: pad(m[1]), to: pad(m[2]) } });
        else if (/^(on|off)$/.test(a)) r = await K.ui.setPrefs({ quiet: { on: a === 'on' } });
        else r = await K.ui.prefs();
        if (r.error) return info(`⎿  ${r.error}`);
        const q = r.quiet;
        info(q.on ? `⎿  🌙 quiet hours ${q.from}–${q.to}: no voice, moments or phone messages${r.quietNow ? ' (quiet right now)' : ''} · /quiet off` : '⎿  quiet hours off · /quiet 23:00-08:00 to set them');
      }],
      lang: ['Her reply language: /lang auto|en|id|ja', async (arg) => {
        const NAMES = { auto: 'same as yours', en: 'English', id: 'Bahasa Indonesia', ja: 'Japanese' };
        const a = String(arg || '').trim().toLowerCase();
        const r = a ? await K.ui.setPrefs({ replyLang: a }) : await K.ui.prefs();
        if (r.error) return info(`⎿  ${r.error}`);
        info(`⎿  🗣️ she replies in: ${NAMES[r.replyLang] || r.replyLang}${a ? ' (from her next message)' : ''} · /lang auto|en|id|ja`);
      }],
      nudges: ['Water & stretch reminders on/off', async (arg) => {
        const p = await K.ui.prefs();
        const on = arg ? /^(on|1|yes)$/i.test(arg) : !p.nudges;
        await K.ui.setPrefs({ nudges: on });
        info(on ? '⎿  💧 wellbeing nudges on' : '⎿  wellbeing nudges off');
      }],
      // ---- voice & polish (M9, D-042) ----
      mute: ['Voice off/on: /mute [on|off]', async (arg) => {
        const p = await K.ui.prefs();
        const on = arg ? /^(on|1|yes)$/i.test(arg) : !p.mute;
        await K.ui.setPrefs({ mute: on });
        info(on ? '⎿  🔇 muted. I will only talk in bubbles~' : '⎿  🔊 voice back on');
      }],
      motion: ['Animations: /motion auto|reduced|full', async (arg) => {
        const m = String(arg || '').trim().toLowerCase();
        if (!['auto', 'reduced', 'full'].includes(m)) { const p = await K.ui.prefs(); return info(`⎿  motion: ${p.motion || 'auto'} (auto follows Windows' "Animation effects" setting) · /motion auto|reduced|full`); }
        await K.ui.setPrefs({ motion: m });
        info(`⎿  motion: ${m}${m === 'reduced' ? ' (no wandering, no bouncing)' : ''}`);
      }],
      voice: ['Voice: /voice [pick|en|ja|off|test [text]|mood on|off|chat on|off|events on|off|gpu on|off|speakers|speaker <id>]', async (arg) => {
        const a = String(arg || '').trim();
        const [cmd, val] = a.split(/\s+/, 2).map((x) => (x || '').toLowerCase());
        const onOff = (v) => /^(on|1|yes)$/i.test(v);
        const LANG = { en: 'English (Windows voice)', ja: 'Japanese dub', off: 'no voice' };
        let st;
        if (cmd === 'pick' || cmd === 'choose') { K.voice.open(); return info('⎿  🎙️ opening the Voice page~'); }
        if (!cmd) st = await K.voice.detect();
        else if (cmd === 'test') {
          const r = await K.voice.say(a.slice(4).trim() || 'Hi hi! This is my voice. Do you like it?');
          return r.ok ? info(`⎿  🔊 ${r.engine}${r.style ? ` (${r.style})` : ''} · mood: ${r.mood}${r.lang === 'ja' ? ` · 「${r.text}」` : ''}`) : error(`✗ couldn't speak (${r.reason})`);
        } else if (cmd in LANG) st = await K.voice.set({ lang: cmd });
        else if (cmd === 'mood') st = await K.voice.set({ moodStyles: onOff(val) });
        else if (cmd === 'chat' || cmd === 'events' || cmd === 'gpu') st = await K.voice.set({ [cmd]: onOff(val) });
        else if (cmd === 'speaker') st = await K.voice.set({ speaker: val === 'default' ? null : Number(val) });
        else if (cmd === 'speakers') {
          st = await K.voice.detect();
          if (!st.voices.length) return info('⎿  No AivisSpeech / VOICEVOX voices known yet. Choose Japanese dub once (/voice ja) so the engine starts.');
          return info(st.voices.map((v) => `⎿  [${v.engine}] ${v.name}: ${v.styles.map((x) => `${x.name} #${x.id}`).join(', ')}`).join('\n') + '\n   Easier: /voice pick opens the Voice page with previews.');
        } else return error('✗ /voice [pick|en|ja|off|test|mood on|off|chat on|off|events on|off|gpu on|off|speakers|speaker <id>]');
        const eng = st.engines.map((e) => `${e.name}: ${e.running ? `running${e.startedByTama ? ` (by me, ${st.gpu ? 'GPU' : 'CPU'})` : ''}` : e.booting ? 'warming up…' : e.installed ? 'installed' : 'not installed'}`).join(' · ');
        info(`⎿  voice: ${LANG[st.lang]}${st.pick ? ` · ${st.pick.name} (${st.pick.styleName})` : ''} · mood styles ${st.moodStyles ? 'on' : 'off'} · chat ${st.chat ? 'on' : 'off'} · moments ${st.events ? 'on' : 'off'}\n   ${eng}\n   Choose and tune her voice: /voice pick (or tray → Voice → Choose her voice…)`);
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
      ...window.makeConnectCommands(K, { info, error, getCwd }),
      feed: ['Feed your Tama', async () => show(await K.act('feed'), (r) => (r.ok ? '⎿  🍙 itadakimasu!' : `⎿  (${r.reason})`))],
      snack: ['Energy snack (+25)', async () => show(await K.act('snack'), (r) => (r.ok ? '⎿  ⚡ energy +25' : r.reason === 'cooldown' ? `⎿  snack again in ${Math.ceil(r.retryInMs / 60000)} min` : `⎿  (${r.reason})`))],
      nap: ['10-minute power nap', async () => show(await K.act('nap'), (r) => (r.ok ? '⎿  💤 power nap, 10 min' : `⎿  (${r.reason})`))],
    },
  };
};
