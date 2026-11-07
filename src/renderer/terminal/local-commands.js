/* The terminal's own slash commands (/help, /cd, /model, /mode, …), merged with Tama's commands from
   tama-commands.js (QC-4: split out of terminal.js). Every other /command goes to Claude Code. */
/**
 * @param {any} K  window.tama
 * @param {{ info: (t: string) => void, error: (t: string) => void, st: any, modes: string[], tamaName: () => string,
 *   welcome: () => void, clearScreen: () => void, tama: { help: string[], commands: object } }} d
 */
window.makeLocalCommands = function makeLocalCommands(K, d) {
  const { info, error, st } = d;

  /** SAFE-4: accept-edits outside a git repo needs a second, deliberate step. */
  function setMode(m, confirmed) {
    if (m === 'acceptEdits' && st.cwd && !st.isGit && !confirmed) {
      st.modeConfirmUntil = Date.now() + 5000;
      error('⚠ This folder is not a git repo: accepted edits can\'t be undone with git. Press Shift+Tab again (or /mode acceptEdits confirm) to turn accept-edits on anyway.');
      return;
    }
    st.modeConfirmUntil = 0;
    if (m === 'acceptEdits' && st.mode === 'acceptEdits') return;
    K.setMode(m);
  }

  /** First-run tour: what this window is for, and where chat lives (shown once; /tour repeats it). */
  function tour() {
    const n = d.tamaName();
    info([
      `✨ Quick tour (${n} Code)`,
      '  1. This terminal is Claude Code: it reads, edits and runs things in your project, and asks before each change.',
      '  2. Pick the project first: /cd (folder picker) or /cd C:\\path\\to\\project. Then just describe the task.',
      '  3. Speed: /model sonnet (faster) or opus (smartest) · /effort low…max (how much it thinks) · Esc stops.',
      `  4. Just want to talk or search the web? Open the 💬 chat with ${n}: Ctrl+Alt+J or /chat.`,
      '  5. Productivity: /todo, /focus 25, /remind 5pm stretch, /watch (your commits grow the bond). /help lists everything.',
    ].join('\n'));
  }

  function help() {
    info([
      `${st.flavor ? st.flavor.title : 'Tama Code'} — works like Claude Code, with ${d.tamaName()} ${st.flavor ? st.flavor.emoji : ''}`,
      '  Chat, advice and web search with your Tama → the 💬 chat window (Ctrl+Alt+J or /chat).',
      '',
      '  Enter            send            Shift+Enter   new line',
      '  Esc              interrupt       Shift+Tab     cycle mode (default → accept edits → plan)',
      '  ↑ / ↓            history         Ctrl+L        clear screen',
      '  Ctrl+Alt+K       show/hide this window (global)',
      '',
      '  /cd [path]       pick the project folder (no path = folder picker)',
      '  /clear           start a fresh conversation',
      '  /resume          continue the last conversation',
      '  /model [name]    switch model (opus = smartest, sonnet = faster, haiku = fastest; empty = default)',
      '  /effort [level]  thinking effort: low (fast) · medium · high · xhigh · max (slow, deep) · default',
      '  /mode [m]        default | acceptEdits | plan',
      '  /theme [name]    terminal look: night, day, pastel, neon (unlocked by your bond)',
      '  /tour            show the quick tour again',
      '  /cost            show session cost',
      '  /summon          bring your Tama back on screen (also Ctrl+Alt+P)',
      '  /exit            hide this window',
      ...d.tama.help,
      '',
      'Any other /command (e.g. /init, /compact, /review, your skills) is passed to Claude Code.',
    ].join('\n'));
  }

  const commands = {
    help: ['Show help', help],
    cd: ['Change project folder', async (arg) => {
      const r = arg ? await K.setCwd(arg) : await K.pickCwd();
      if (!r) return;
      if (r.error) return error('✗ ' + r.error);
      d.clearScreen(); d.welcome();
      info(`⎿  Working in ${r.cwd}${r.isGit ? '' : ' (not a git repo — edits can\'t be undone with git!)'}`);
    }],
    clear: ['Start a new conversation', () => { K.clear(); d.clearScreen(); st.tools.clear(); d.welcome(); }],
    resume: ['Resume the last conversation', async (arg) => {
      const r = await K.resume(arg || null);
      if (r.error) error('✗ ' + r.error);
    }],
    model: ['Switch model', (arg) => { K.setModel(arg || null); info(`⎿  Model set to ${arg || 'default'}`); }],
    effort: ['Thinking effort: low (fast) … max (deep)', (arg) => {
      const a = String(arg || '').toLowerCase();
      if (!['low', 'medium', 'high', 'xhigh', 'max', 'default'].includes(a)) return info(`⎿  Effort: low | medium | high | xhigh | max | default (now: ${st.effort || 'default'}). Lower = less thinking = faster.`);
      K.setEffort(a === 'default' ? null : a);
      info(`⎿  Effort set to ${a}`);
    }],
    mode: ['Set permission mode', (arg) => {
      const [m, confirm] = String(arg || '').split(/\s+/);
      if (!d.modes.includes(m)) return info(`⎿  Modes: ${d.modes.join(', ')} (current: ${st.mode})`);
      setMode(m, confirm === 'confirm');
    }],
    tour: ['Show the quick tour', () => tour()],
    cost: ['Show session cost', () => info(`⎿  Session cost: $${st.totalCost.toFixed(4)}`)],
    summon: ['Bring your Tama back on screen', () => { K.summon(); info('⎿  Summoned! (Ctrl+Alt+P works anywhere)'); }],
    exit: ['Hide the terminal', () => K.win.close()],
    ...d.tama.commands,
  };

  return { commands, setMode, tour };
};
