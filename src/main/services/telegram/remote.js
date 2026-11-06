// @ts-check
// Remote coding from the phone (TG-6, TG-7, D-036): /code runs in the same Claude Code session as the terminal, only in
// allow-listed folders, in ask-every-tool mode. Progress is one edited message; permission prompts become inline buttons
// (answered here or on the desktop, whichever is first); the result comes with the git diff as a file. The desktop
// announces every remote action.
const { TOPICS } = require('../../bus-topics');
const fmt = require('./format');

const FLUSH_MS = 3000;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   send: (text: string, extra?: any) => Promise<any>, edit: (messageId: number, text: string, extra?: any) => Promise<any>,
 *   sendDocument: (data: Buffer, filename: string, caption?: string) => Promise<any>,
 *   git: { isRepo: (d: string) => boolean, diff: (d: string) => Promise<string> },
 *   settings: () => { repos: string[], remote: boolean }, announce: (text: string) => void, now?: () => number,
 *   desk?: string,
 * }} deps
 *   desk: Tama's own empty folder, always allowed; used when the current folder isn't on the allow-list.
 */
function createRemote({ bus, send, edit, sendDocument, git, settings, announce, desk, now = Date.now }) {
  /** @type {{ cwd: string, progress: { id: number, lines: string[], dirty: boolean, at: number } | null, text: string } | null} */
  let turn = null;
  /** permission id → telegram message id */
  const prompts = new Map();
  /** @type {NodeJS.Timeout | null} */ let flushTimer = null;

  const norm = (/** @type {string} */ p) => String(p || '').replace(/[\\/]+$/, '').toLowerCase();
  const allowed = (/** @type {string|null} */ cwd) => !!cwd && ((!!desk && norm(desk) === norm(cwd)) || settings().repos.some((r) => norm(r) === norm(cwd)));

  async function flush() {
    flushTimer = null;
    const p = turn && turn.progress;
    if (!p || !p.dirty) return;
    p.dirty = false;
    const text = `⏳ working…\n${p.lines.slice(-12).join('\n')}`;
    if (p.id) await edit(p.id, text).catch(() => null);
    else p.id = (await send(text).catch(() => ({ message_id: 0 }))).message_id;
  }
  function progress(/** @type {string} */ line) {
    if (!turn) return;
    turn.progress = turn.progress || { id: 0, lines: [], dirty: false, at: now() };
    turn.progress.lines.push(line);
    turn.progress.dirty = true;
    if (!flushTimer) flushTimer = setTimeout(() => { flush().catch(() => null); }, FLUSH_MS);
  }

  /** @param {string} task */
  async function start(task) {
    if (!settings().remote) return send('🔒 Remote coding is switched off. Turn it on with /remote on (or /phone remote on on the PC).');
    if (!task.trim()) return send('Tell me what to do: /code fix the failing test');
    if (turn) return send('I\'m still working on the last task~ /stop to interrupt.');
    let info = await bus.request(TOPICS.ENGINE_INFO);
    if (!allowed(info.cwd)) {
      if (!desk) {
        return send(`🔒 The current folder isn't allowed for remote work${info.cwd ? ` (${info.cwd})` : ''}.\nPick one with /repos and /cd <n>. Folders are allowed on the PC with /phone allow here.`);
      }
      // Not a project the user allowed: work at Tama's own desk (fine for Google tasks and questions).
      const r = await bus.request(TOPICS.ENGINE_SET_CWD, desk);
      if (r && r.error) return send(`✗ ${r.error}`);
      announce(`📱 remote task moved to Tama's desk (${desk}); allowed projects: /phone allow here`);
      info = await bus.request(TOPICS.ENGINE_INFO);
    }
    // TG-7: remote turns always ask before every tool.
    if (info.mode !== 'default') await bus.request(TOPICS.ENGINE_SET_MODE, 'default');
    turn = { cwd: info.cwd, progress: null, text: '' };
    announce(`📱 from your phone: /code ${task}`);
    const where = desk && norm(desk) === norm(info.cwd) ? 'at my desk (no project folder)' : `in ${info.cwd.split(/[\\/]/).pop()}`;
    await send(`👍 on it, ${where}. I'll ask before every change.`);
    bus.request(TOPICS.ENGINE_SEND, task).catch((e) => send(`✗ ${e.message || e}`));
    return null;
  }

  /** Engine events of the shared Claude session. @param {{ engine: string, role: string, ev: any }} e */
  async function onEngineEvent({ engine, role, ev }) {
    if (engine !== 'claude' || role !== 'worker' || !turn) return;
    if (ev.t === 'tool') progress(fmt.toolLine(ev));
    else if (ev.t === 'text-delta') turn.text += ev.text;
    else if (ev.t === 'text-start') turn.text = '';
    else if (ev.t === 'permission') {
      const m = await send(fmt.permissionText(ev), {
        reply_markup: { inline_keyboard: [[
          { text: '✅ Yes', callback_data: `perm:${ev.id}:yes` },
          { text: '♾️ Always (this session)', callback_data: `perm:${ev.id}:always` },
          { text: '❌ No', callback_data: `perm:${ev.id}:no` },
        ]] },
      }).catch(() => null);
      if (m) prompts.set(ev.id, m.message_id);
    } else if (ev.t === 'permission-done') {
      const mid = prompts.get(ev.id);
      prompts.delete(ev.id);
      if (mid) await edit(mid, `🔐 ${ev.choice === 'no' || !ev.choice ? '❌ denied' : '✅ allowed'}`, { reply_markup: { inline_keyboard: [] } }).catch(() => null);
    } else if (ev.t === 'result') {
      const t = turn;
      turn = null;
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (t.progress) { t.progress.dirty = true; turn = t; await flush(); turn = null; }
      const head = ev.isError ? `⚠️ stopped${ev.subtype === 'error_during_execution' ? ' (interrupted)' : ''}` : '✨ done!';
      await send(fmt.clip(`${head}\n\n${(t.text || ev.text || '').trim()}`)).catch(() => null);
      if (git.isRepo(t.cwd)) {
        const d = await git.diff(t.cwd).catch(() => '');
        if (d.trim()) await sendDocument(Buffer.from(d, 'utf8'), 'changes.diff', 'Changes in the working tree (not committed)').catch(() => null);
      }
      announce(`📱 remote task finished${ev.isError ? ' (stopped)' : ''}`);
    }
  }

  /** Inline button press. @param {string} data */
  async function onCallback(data) {
    const m = /^perm:(\d+):(yes|always|no)$/.exec(data);
    if (!m) return false;
    await bus.request(TOPICS.ENGINE_ANSWER_PERMISSION, { id: Number(m[1]), choice: m[2], feedback: m[2] === 'no' ? 'Denied from the phone.' : undefined });
    announce(`📱 permission ${m[2] === 'no' ? 'denied' : 'allowed'} from your phone`);
    return true;
  }

  async function stop() {
    await bus.request(TOPICS.ENGINE_INTERRUPT);
    announce('📱 /stop from your phone');
    return send('⏹ stopping…');
  }

  async function repos() {
    const list = settings().repos;
    const info = await bus.request(TOPICS.ENGINE_INFO);
    const cur = (/** @type {string} */ r) => (norm(r) === norm(info.cwd) ? '  ← current' : '');
    return send([
      'Where Claude can work from your phone:',
      desk ? `0. Tama's desk (no project; Google, questions)${cur(desk)}` : '',
      ...list.map((r, i) => `${i + 1}. ${r}${cur(r)}`),
      list.length ? '' : '(no projects yet: on the PC, /cd into one, then /phone allow here)',
      '/cd <n> to switch',
    ].filter((l, i, a) => l || i < a.length - 1).join('\n'));
  }

  /** @param {string} arg */
  async function cd(arg) {
    const list = settings().repos;
    const i = Number(arg) - 1;
    const target = (String(arg).trim() === '0' || /^desk$/i.test(String(arg).trim())) && desk ? desk
      : list[i] || list.find((r) => r.split(/[\\/]/).pop()?.toLowerCase() === String(arg).trim().toLowerCase());
    if (!target) return repos();
    if (turn) return send('Not while I\'m working~ /stop first.');
    const r = await bus.request(TOPICS.ENGINE_SET_CWD, target);
    if (r && r.error) return send(`✗ ${r.error}`);
    announce(`📱 switched project from your phone: ${target}`);
    return send(`📁 now in ${target}`);
  }

  return { start, stop, repos, cd, onEngineEvent, onCallback, busy: () => !!turn, allowed };
}

module.exports = { createRemote };
