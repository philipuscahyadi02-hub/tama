/* Voice page (D-045): pick and tune the Tama's voice. A dumb view over window.tama.voice. */
const $ = (s) => document.querySelector(s);
const K = window.tama;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ENGINE_NAMES = { aivis: 'AivisSpeech', voicevox: 'VOICEVOX' };
const MOOD_LABEL = { normal: 'normal', happy: 'happy', excited: 'excited', sweet: 'sweet', tease: 'teasing', sad: 'sad', sleepy: 'sleepy', calm: 'calm', angry: 'angry' };
let st = null;
let tuneTimer = null;
const say = (t, err) => { $('#msg').textContent = t || ''; $('#msg').classList.toggle('err', !!err); };

/** Credit line each engine's terms ask for. */
function credit(engine, name) {
  if (engine === 'voicevox') return `Credit: VOICEVOX:${name} · free for personal use; see the character's terms below.`;
  if (engine === 'aivis') return 'AivisSpeech voice model · see its license below.';
  return '';
}

async function showInfo(engine, uuid) {
  const box = $('#portrait');
  box.style.backgroundImage = '';
  box.textContent = '🎙️';
  $('#terms') && $('#terms').remove();
  if (!engine || !uuid) return;
  const info = await K.voice.info({ engine, uuid }).catch(() => null);
  if (!info) return;
  if (info.portrait) { box.style.backgroundImage = `url("${info.portrait}")`; box.textContent = ''; }
  if (info.policy) {
    const d = document.createElement('details');
    d.className = 'terms';
    d.id = 'terms';
    d.innerHTML = `<summary>Terms of use</summary><pre>${esc(info.policy)}</pre>`;
    $('#credit').after(d);
  }
}

function renderNow() {
  const p = st.pick;
  $('#nowName').textContent = p ? p.name : 'No anime voice yet';
  $('#nowEngine').textContent = p ? ENGINE_NAMES[p.engine] || p.engine : '';
  $('#nowStyle').textContent = p ? p.styleName : '';
  $('#credit').textContent = p ? credit(p.engine, p.name) : 'Choose Japanese dub once so an engine starts and its voices appear here.';
  const t = st.tune;
  $('#tPitch').value = String(t.pitch); $('#vPitch').textContent = `${t.pitch > 0 ? '+' : ''}${Math.round(t.pitch * 100)}`;
  $('#tSpeed').value = String(t.speed); $('#vSpeed').textContent = `${t.speed.toFixed(2)}×`;
  $('#tInto').value = String(t.intonation); $('#vInto').textContent = `${t.intonation.toFixed(2)}×`;
  $('#moodStyles').checked = st.moodStyles;
  $('#gpu').checked = st.gpu;
  $('#moodMap').innerHTML = p && p.moodMap ? Object.entries(p.moodMap).map(([m, s]) => `<span>${esc(MOOD_LABEL[m] || m)} → <b>${esc(s)}</b></span>`).join('') : '';
  $('#moodMap').style.opacity = st.moodStyles ? '1' : '.45';
}

function renderEngines() {
  $('#engines').innerHTML = st.engines.map((e) => {
    const state = e.running ? `running${e.startedByTama ? ' (by Tama)' : ''}` : e.booting ? 'starting… (first start can take a few minutes)' : e.installed ? 'installed · sleeping' : 'not installed';
    const btn = !e.running && !e.booting && e.installed ? ` <button data-load="${esc(e.id)}">Start to list voices</button>` : '';
    return `<div class="eng"><b>${esc(e.name)}</b>${e.version ? ` ${esc(e.version)}` : ''} · ${esc(state)}${btn}</div>`;
  }).join('');
  document.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', async () => {
    say(`starting ${ENGINE_NAMES[b.dataset.load]}…`);
    const r = await K.voice.try({ engine: b.dataset.load });
    say(r.ok ? '' : `✗ ${r.reason}`, !r.ok);
  }));
}

function renderVoices() {
  const groups = {};
  for (const v of st.voices) (groups[v.engine] = groups[v.engine] || []).push(v);
  const p = st.pick;
  $('#voices').innerHTML = Object.entries(groups).map(([engine, list]) => `<div class="group"><h4>${esc(ENGINE_NAMES[engine] || engine)} · ${list.length} voices</h4><div class="vgrid">${
    list.map((v) => {
      const sel = p && p.engine === engine && p.uuid === v.uuid;
      return `<div class="vcard${sel ? ' sel' : ''}"><div class="top"><span class="name">${esc(v.name)}</span>
        <button data-use="${esc(engine)}|${esc(v.uuid)}|${v.styles[0] ? v.styles[0].id : 0}">${sel ? '✓ Her voice' : 'Use'}</button></div>
        <div class="chips">${v.styles.map((s) => `<span class="chip${sel && p.style === s.id ? ' on' : ''}" data-try="${esc(engine)}|${esc(v.uuid)}|${s.id}" title="Hear it; double-click to use this style">${esc(s.name)}</span>`).join('')}</div></div>`;
    }).join('')}</div></div>`).join('') || '<div class="kv dim">No voices known yet.</div>';
  document.querySelectorAll('[data-try]').forEach((c) => {
    c.addEventListener('click', () => { const [engine, , style] = c.dataset.try.split('|'); preview(engine, Number(style)); });
    c.addEventListener('dblclick', () => { const [engine, uuid, style] = c.dataset.try.split('|'); use(engine, uuid, Number(style)); });
  });
  document.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
    const [engine, uuid, style] = b.dataset.use.split('|');
    // Keep the chosen style when re-using the selected character.
    const keep = p && p.engine === engine && p.uuid === uuid ? p.style : Number(style);
    use(engine, uuid, keep);
  }));
}

let shownKey = '';
function render(s) {
  st = s;
  // Portrait + terms follow the chosen voice, also when it changes elsewhere (terminal, tray, another window).
  const key = st.pick ? `${st.pick.engine}:${st.pick.uuid}` : '';
  const running = st.pick && st.engines.some((e) => e.id === st.pick.engine && e.running);
  if (key !== shownKey && (running || !key)) { shownKey = key; showInfo(st.pick && st.pick.engine, st.pick && st.pick.uuid); }
  document.querySelectorAll('#lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === st.lang));
  $('#langNote').textContent = st.lang === 'ja' ? 'She writes in your language; her voice speaks a Japanese dub of it (translated by Gemini, read by the voice below).'
    : st.lang === 'en' ? 'English uses the Windows voice. Switch to Japanese dub to hear the anime voices below in chat.' : 'She stays quiet (previews still work).';
  renderNow();
  renderEngines();
  renderVoices();
}

async function preview(engine, style, mood) {
  say('🔊 preparing… (an engine that was asleep needs ~30 s to start)');
  const r = await K.voice.try({ engine, style, mood: mood || 'normal', tune: st.tune });
  say(r.ok ? '' : `✗ ${r.reason}`, !r.ok);
}

async function use(engine, uuid, style) {
  render(await K.voice.set({ pick: { engine, uuid, style } }));
  preview(engine, style);
}

function tuneFromSliders() {
  return { pitch: Number($('#tPitch').value), speed: Number($('#tSpeed').value), intonation: Number($('#tInto').value) };
}

for (const id of ['#tPitch', '#tSpeed', '#tInto']) {
  $(id).addEventListener('input', () => {
    st.tune = tuneFromSliders();
    renderNow();
    clearTimeout(tuneTimer);
    tuneTimer = setTimeout(async () => { st = await K.voice.set({ tune: st.tune }); }, 300);
  });
}
$('#tryNow').addEventListener('click', () => { if (st.pick) preview(st.pick.engine, st.pick.style, $('#tryMood').value); });
$('#resetTune').addEventListener('click', async () => render(await K.voice.set({ tune: { pitch: 0, speed: 1, intonation: 1 } })));
$('#moodStyles').addEventListener('change', async (e) => render(await K.voice.set({ moodStyles: e.target.checked })));
$('#gpu').addEventListener('change', async (e) => render(await K.voice.set({ gpu: e.target.checked })));
document.querySelectorAll('#lang button').forEach((b) => b.addEventListener('click', async () => render(await K.voice.set({ lang: b.dataset.lang }))));
K.voice.onChanged((s) => { if (s) render(s); });

(async function boot() {
  const ch = await K.getCharacter().catch(() => null);
  if (ch && ch.spec) {
    $('#who').textContent = `${ch.spec.name}'s`;
    if (ch.stage !== 'egg') for (const [k, v] of Object.entries(window.TamaShared.theme.chatVars(ch.spec))) document.documentElement.style.setProperty(k, v);
  }
  render(await K.voice.detect());
}());
