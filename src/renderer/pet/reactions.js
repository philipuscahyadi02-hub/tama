/* How the pet reacts to Claude Code work and chat replies (QC-4: split out of pet.js). Loaded after pet.js and
   shares its globals. */
// ---------------- reacting to the agent ----------------
const TOOL_LINES = {
  Read: '📖 reading', Glob: '🔎 looking for', Grep: '🔍 searching', Edit: '✏️ editing', MultiEdit: '✏️ editing',
  Write: '📝 writing', Bash: '💻 running', WebFetch: '🌐 reading', WebSearch: '🌐 searching', TodoWrite: '📋 planning',
  Task: '👯 asking a friend', Agent: '👯 asking a friend',
};
const short = (s) => String(s || '').split(/[\\/]/).pop().slice(0, 28);
let lastToolSay = 0;
T.onBrainNotice((n) => { if (!isEgg) { emote(n.kind === 'warn' ? '💭' : '✨', 1800); say(n.text, 6000); } });
// Chat (agy, D-029): her replies also appear in the speech bubble. Chat is not a quest (PET-4).
T.chat.onEvent((ev) => {
  if (isEgg) return;
  if (ev.t === 'status' && ev.state !== 'idle') express('focus', 1500);
  if (ev.t === 'message' && ev.message.role === 'tama') {
    const t = ev.message.text.trim();
    say(t.length > 220 ? `${t.slice(0, 217)}…` : t, Math.min(14000, 4000 + t.length * 45), { force: true });
  }
});
T.onAgent((ev) => {
  if (ev.role === 'brain') return;
  switch (ev.t) {
    case 'status':
      if (ev.state !== agentState) {
        const was = agentState;
        agentState = ev.state;
        if (was === 'idle' && ev.state !== 'idle') { stopWalking(); say(pick(['yosh, ganbaru! 💪', 'hmm hmm… 🤓', 'leave it to me~!']), 2000); }
        renderMood();
      }
      break;
    case 'tool':
      if (Date.now() - lastToolSay > 2500) {
        lastToolSay = Date.now();
        const i = ev.input || {};
        say(`${TOOL_LINES[ev.name] || '🔧 ' + ev.name} ${short(i.file_path || i.pattern || i.command || i.url || i.query || i.description || '')}`.trim(), 2200);
      }
      break;
    case 'permission':
      emote('❗'); hop();
      say(`ano… may I use ${ev.name}? 🥺\n(click to answer)`, 15000, { force: true, onClick: () => T.showTerminal() });
      break;
    case 'result':
      if (ev.isError) { express('dizzy', 2500); emote('💧', 2000, 'left'); say('hawawa… something went wrong 😵‍💫'); }
      else {
        express('sparkle', 2600); hop(); particles(['✨', '⭐', '🎉'], 6);
        say(pick(['yatta~! done! ✨', 'mission complete! (ง •̀_•́)ง', 'sugoi desho? ✨', 'kanpeki! perfect~ 💯']), 3000);
      }
      break;
    case 'mode':
      if (ev.mode === 'acceptEdits') henshin(`HENSHIN! ✨ Edit-mode ${petName}!`);
      else if (ev.mode === 'plan') henshin('Strategy mode… 📋 fufu~');
      else if (ev.mode === 'default') { express('happy', 1200); say(`back to normal~${tic()}`); }
      break;
    case 'error':
      express('dizzy', 2200); emote('💧', 2000, 'left');
      break;
    case 'cwd':
      express('sparkle', 1500); say(ev.isGit ? `ooh, ${short(ev.cwd)}! a new adventure~ 🗺️` : `${short(ev.cwd)}… no git here, but ok!`);
      break;
  }
});

