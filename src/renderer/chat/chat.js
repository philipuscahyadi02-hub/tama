/* Chat with your Tama (CHAT-1, D-029). A dumb view: history and replies come from the chat brain (agy) over IPC.
   Themed from the CharacterSpec palette, so every Tama gets her own colors. */
const $ = (s) => document.querySelector(s);
const K = window.tama;
const log = $('#log');
const input = $('#input');
const sendBtn = $('#send');

const st = { busy: false, live: null, liveText: '', name: 'Tama', tools: null };

// ---------------- theme (shared with the terminal, src/shared/theme.js) ----------------
function applyTheme(spec) {
  for (const [k, v] of Object.entries(window.TamaShared.theme.chatVars(spec))) document.documentElement.style.setProperty(k, v);
}

function applyCharacter(ch) {
  const avatar = $('#avatar');
  if (ch.stage === 'egg') {
    window.TamaShared.renderEgg(avatar, avatar.querySelector('svg'));
    st.name = 'Egg';
  } else {
    const spec = window.TamaShared.renderRig(avatar, avatar.querySelector('svg'), ch.spec, 'chat-');
    st.name = spec.name;
    applyTheme(spec);
  }
  $('#name').textContent = st.name;
  document.title = `Chat with ${st.name}`;
  input.placeholder = `Talk to ${st.name}~`;
  input.title = 'Enter to send · Shift+Enter for a new line';
}

// ---------------- messages ----------------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Tiny markdown: code blocks, inline code, bold, italics. Links stay plain text (no navigation from this window). */
function md(src) {
  return String(src).split('```').map((p, i) => {
    if (i % 2) { const nl = p.indexOf('\n'); return `<pre>${esc((nl >= 0 ? p.slice(nl + 1) : p).replace(/\n$/, ''))}</pre>`; }
    return esc(p)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  }).join('');
}
const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
function scroll(force) { if (force || nearBottom()) requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; }); }

function addMessage(m) {
  if (m.role === 'tama' && m.tools && m.tools.length && !st.tools) addTools(m.tools);
  st.tools = null;
  const d = document.createElement('div');
  d.className = `msg ${m.role}`;
  d.innerHTML = m.role === 'user' ? esc(m.text) : md(m.text);
  log.appendChild(d);
  scroll(m.role === 'user');
  return d;
}
function addTools(lines) {
  const d = document.createElement('div');
  d.className = 'tools';
  d.textContent = lines.join('\n');
  log.appendChild(d);
  return d;
}

function setBusy(b, text) {
  st.busy = b;
  $('#typing').classList.toggle('hidden', !b);
  $('#typingText').textContent = text || `${st.name} is typing…`;
  sendBtn.textContent = b ? '■' : '➤';
  sendBtn.classList.toggle('stop', b);
  sendBtn.title = b ? 'Stop' : 'Send';
  if (b) scroll();
}

K.chat.onEvent((ev) => {
  switch (ev.t) {
    case 'message':
      if (ev.message.role === 'tama' && st.live) { st.live.remove(); st.live = null; st.liveText = ''; }
      if (ev.message.role !== 'user') addMessage(ev.message); // user messages are drawn when sent
      break;
    case 'delta':
      if (!st.live) { st.live = document.createElement('div'); st.live.className = 'msg tama'; log.appendChild(st.live); }
      st.liveText += ev.text;
      st.live.innerHTML = md(st.liveText);
      $('#typing').classList.add('hidden');
      scroll();
      break;
    case 'tool':
      if (!st.tools) st.tools = addTools([]);
      st.tools.textContent += (st.tools.textContent ? '\n' : '') + ev.text;
      $('#typingText').textContent = `${st.name} is looking it up…`;
      scroll();
      break;
    case 'status': if (ev.state !== 'idle' && !st.busy) setBusy(true); break;
    case 'done': setBusy(false); input.focus(); break;
    case 'cleared': log.innerHTML = ''; hello(); break;
    case 'confirm': addConfirm(ev); break;
    case 'confirm-done': {
      const card = log.querySelector(`.confirm[data-id="${ev.id}"]`);
      if (card) {
        card.classList.add('answered');
        card.querySelector('.cbtns').textContent = ev.yes ? '✅ okay, doing it~' : '❌ cancelled (nothing was sent)';
      }
      break;
    }
    default: break;
  }
});

/** Google create/edit from the chat brain waits for your tap (D-037). */
function addConfirm(ev) {
  const d = document.createElement('div');
  d.className = 'confirm';
  d.dataset.id = String(ev.id);
  d.innerHTML = `<div class="ctext"></div><div class="cbtns"><button class="yes">${ev.kind === 'send' ? '✅ Send it' : '✅ Yes, do it'}</button><button class="no">${ev.kind === 'send' ? 'Don\'t send' : 'No'}</button></div>`;
  d.querySelector('.ctext').textContent = ev.text;
  d.querySelector('.yes').addEventListener('click', () => K.chat.confirm(ev.id, true));
  d.querySelector('.no').addEventListener('click', () => K.chat.confirm(ev.id, false));
  log.appendChild(d);
  $('#typingText').textContent = `${st.name} is waiting for your OK…`;
  scroll(true);
}

// ---------------- input ----------------
function autosize() { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; }
async function submit() {
  if (st.busy) { K.chat.interrupt(); return; }
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; autosize();
  addMessage({ role: 'user', text });
  setBusy(true);
  const r = await K.chat.send(text);
  if (!r || !r.ok) setBusy(false);
}
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  if (e.key === 'Escape') { if (st.busy) K.chat.interrupt(); else K.win.close(); }
});
sendBtn.addEventListener('click', submit);
$('#wClose').addEventListener('click', K.win.close);
$('#wTerm').addEventListener('click', K.showTerminal);
$('#wClear').addEventListener('click', () => K.chat.clear());
K.chat.onFocus(() => input.focus());
K.onCharacter(applyCharacter);

function hello() {
  addMessage({ role: 'note', text: `This is your chat with ${st.name} (Gemini via agy, your Google login · web search · your Google calendar, mail drafts, Docs & Sheets when connected).\nCode and files → the terminal 💻 (Ctrl+Alt+K).` });
}

(async function boot() {
  applyCharacter(await K.getCharacter());
  const h = await K.chat.history();
  hello();
  for (const m of h.messages) addMessage(m);
  if (!h.available) addMessage({ role: 'note', text: '⚠ agy (Antigravity CLI) was not found, so I can\'t chat yet. Install it, log in once, then restart Tama.' });
  if (h.busy) setBusy(true);
  scroll(true);
  input.focus();
})();
