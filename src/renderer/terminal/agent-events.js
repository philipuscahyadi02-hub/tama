/* Claude Code events → transcript, spinner, tool lines and the avatar's mood (QC-4: split out of terminal.js).
   Loaded after terminal.js and shares its globals (st, K, add, md, …). */
// ---------------- agent events ----------------
function endText() {
  if (st.textEl) { st.textEl = null; st.textBuf = ''; }
}
let rafPending = false;
function flushText() {
  rafPending = false;
  if (st.textEl) { st.textEl.querySelector('.body').innerHTML = md(st.textBuf); scroll(); }
}

/** The terminal is Claude Code only (D-029); chat with the Tama lives in the chat window. */
const dotFor = () => '●';
K.onAgent((ev) => {
  switch (ev.t) {
    case 'status':
      if (ev.state === 'idle') setBusy(false);
      else if (!st.busy) setBusy(true);
      break;
    case 'thinking-progress':
      st.progress = { verb: 'Thinking…', chars: ev.chars || 0 };
      if (!st.busy) setBusy(true);
      break;
    case 'tool-progress':
      st.progress = { verb: progressVerb(ev.name, ev.file), chars: ev.chars || 0 };
      if (!st.busy) setBusy(true);
      $('#spinVerb').textContent = st.progress.verb;
      break;
    case 'text-start':
      endText();
      st.progress = null;
      st.textEl = add(`<span class="dot">${dotFor()}</span><div class="body md"></div>`, 'msg');
      st.textBuf = '';
      break;
    case 'text-delta':
      if (!st.textEl) st.textEl = add(`<span class="dot">${dotFor()}</span><div class="body md"></div>`, 'msg');
      st.textBuf += ev.text;
      if (!rafPending) { rafPending = true; requestAnimationFrame(flushText); }
      break;
    case 'text-end':
      flushText(); endText();
      break;
    case 'tool': {
      endText();
      st.progress = null;
      const [n, arg] = toolLabel(ev.name, ev.input);
      const el = add(
        `<span class="dot">●</span><div class="body"><span class="tname">${esc(n)}</span>${arg ? `<span class="targ">(${esc(arg)})</span>` : ''}${toolExtra(ev.name, ev.input)}</div>`,
        'msg tool running',
      );
      st.tools.set(ev.id, { el, name: ev.name, input: ev.input || {} });
      break;
    }
    case 'tool-result': {
      const t = st.tools.get(ev.id);
      if (!t) break;
      t.el.classList.remove('running');
      if (ev.isError) t.el.classList.add('err');
      const s = toolSummary(t.name, t.input, ev.text, ev.isError);
      if (s) {
        const r = document.createElement('div');
        r.className = 'res' + (ev.isError ? ' err' : '');
        r.textContent = s;
        t.el.querySelector('.body').appendChild(r);
        scroll();
      }
      break;
    }
    case 'permission':
      avatarMood('shock', 2500);
      st.perms.push(ev);
      if (st.perms.length === 1) showPerm();
      break;
    case 'permission-done':
      st.perms = st.perms.filter((p) => p.id !== ev.id);
      if (curPerm && curPerm.id === ev.id) { curPerm = null; hidePerm(); if (st.perms.length) showPerm(); }
      break;
    case 'result': {
      endText();
      for (const t of st.tools.values()) t.el.classList.remove('running');
      st.totalCost = ev.totalCost || st.totalCost;
      if (ev.isError && ev.subtype !== 'success') {
        if (ev.subtype === 'error_during_execution') info('⎿  Interrupted by user');
        else error(`✗ ${ev.subtype}${ev.text ? ': ' + ev.text : ''}`);
      }
      const cost = typeof ev.cost === 'number' ? ` · $${ev.cost.toFixed(3)} (session $${(ev.totalCost || 0).toFixed(3)})` : '';
      add(`✻ ${ev.isError ? 'Stopped' : 'Done'} in ${fmtDur(ev.durationMs || 0)}${cost}`, 'done');
      avatarMood(ev.isError ? 'pout' : 'sparkle', 2500);
      setBusy(false);
      renderStatus();
      break;
    }
    case 'init':
      if (ev.commands) st.commands = ev.commands;
      if (ev.model) st.model = ev.model;
      renderStatus();
      break;
    case 'session': st.lastSessionId = ev.sessionId; break;
    case 'mode': st.mode = ev.mode; renderStatus(); break;
    case 'model': st.model = ev.model; renderStatus(); break;
    case 'effort': st.effort = ev.effort; renderStatus(); break;
    case 'cwd':
      st.cwd = ev.cwd; st.isGit = !!ev.isGit; renderStatus();
      document.querySelectorAll('.cwdline').forEach((e) => { e.textContent = 'cwd: ' + ev.cwd; });
      break;
    case 'cleared': st.totalCost = 0; renderStatus(); break;
    case 'info': info(ev.text); break;
    case 'error': error('✗ ' + ev.message); setBusy(false); avatarMood('dizzy', 3000); break;
  }
});
