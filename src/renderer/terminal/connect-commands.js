/* Connection commands for the terminal (QC-4: split out of tama-commands.js): /phone (Telegram), /google, /brief,
   /usage and /newpc. Merged into the terminal's command table through makeTamaCommands. */
window.makeConnectCommands = function makeConnectCommands(K, { info, error, getCwd }) {
  const show = (r, ok) => (r && r.error ? error(`✗ ${r.error}`) : info(ok(r)));
  return {
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
        case 'maps-key': {
          const v2 = rest[0] || '';
          if (!v2) return info(`⎿  places: ${s.maps === 'google' ? 'Google Maps (key set)' : 'web search + Maps links'} · /google maps-key <AIza…> to use Google Places · /google maps-key off`);
          const r = await G.set({ mapsKey: v2 === 'off' ? null : v2 });
          return r.error ? error(`✗ ${r.error}`) : info(`⎿  places: ${r.maps === 'google' ? 'Google Maps 📍' : 'web search + Maps links'}`);
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
    usage: ['Usage & accounts dashboard (Claude, Gemini, Google, Telegram)', async (arg) => {
      if (arg !== 'here') { K.usage.open(); return info('⎿  opened Usage & accounts 📊 (/usage here for a quick summary)'); }
      const [r, L] = await Promise.all([K.usage.get({ days: 1 }), K.limits.get()]);
      const t = r.summary.totals;
      const usd = (n) => `$${(n || 0).toFixed(2)}`;
      const lim = Object.values((L.claude && L.claude.windows) || {}).map((v) => `${v.label} ${Math.round(v.left * 100)}% left`).join(' · ');
      info([
        '⎿  today',
        `    Claude    ${t.claude.calls} turns · ${t.claude.tokens.toLocaleString()} tokens · ≈${usd(t.claude.costUsd)} (API-equivalent)${lim ? ` · ${lim}` : ''}`,
        `    Gemini    ${t.gemini.calls} turns · ${t.gemini.tokens.toLocaleString()} tokens${L.gemini && L.gemini.tier ? ` · ${L.gemini.tier}` : ''}`,
        `    Google    ${t.google.calls} API calls${t.google.errors ? ` (${t.google.errors} errors)` : ''}`,
        `    Telegram  ${t.telegram.calls} messages/calls`,
      ].join('\n'));
    }],
    newpc: ['Checklist for setting up Tama on a new PC', async () => {
      const [b, g, t] = await Promise.all([K.brain.status(), K.google.status(), K.telegram.status()]);
      const ok = (v) => (v ? '✅' : '☐');
      info([
        '  New PC checklist',
        `  ${ok(b.available.claude)} Claude Code installed and logged in (run \`claude\` once)   → the terminal`,
        `  ${ok(b.available.agy)} Antigravity CLI (agy) installed and logged in                → 💬 chat, events, diary`,
        `  ${ok(g.signedIn)} Google connected (/google setup, same Google app works on every PC)`,
        `  ${ok(t.paired)} Telegram paired (/phone setup <bot token>, then send the code from your phone)`,
        '  Moving your Tama: My Tamas (/tama) → Export on the old PC → Import here, or /google backups + /google restore <n>.',
      ].join('\n'));
    }],
  };
};
