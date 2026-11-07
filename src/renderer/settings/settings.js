/* Settings window (M10, D-048): one place for every preference. A dumb view over window.tama; each control
   sends one intent and re-renders from the returned state. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const K = window.tama;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let msgTimer = null;
const say = (t, err) => {
  $('#msg').textContent = t || ''; $('#msg').classList.toggle('err', !!err);
  clearTimeout(msgTimer); if (t && !err) msgTimer = setTimeout(() => say(''), 2500);
};
const saved = (r) => { if (r && r.error) say(r.error, true); else say('saved ✓'); return r; };
const seg = (el, v) => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));

// ---- tabs ----
function showTab(tab) {
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $$('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
  try { localStorage.setItem('settingsTab', tab); } catch { /* storage may be unavailable */ }
}
$$('#nav button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ---- open other windows ----
$$('[data-open]').forEach((b) => b.addEventListener('click', () => {
  const what = b.dataset.open;
  if (what === 'roster') K.openRoster(false);
  else if (what === 'restyle' || what === 'rebirth') K.openOnboarding(what);
  else K.openPage(what);
}));

// ---- UI prefs (her, talking, quiet) ----
function renderUi(u) {
  if (!u) return;
  $$('.seg[data-pref]').forEach((el) => seg(el, u[el.dataset.pref]));
  $$('input[data-pref]').forEach((el) => { el.checked = !!u[el.dataset.pref]; });
  $('#termTheme').innerHTML = u.variants.map((v) => `<option value="${esc(v.id)}" ${v.unlocked ? '' : 'disabled'} ${v.id === u.termTheme ? 'selected' : ''}>${esc(v.label)}${v.unlocked ? '' : ' 🔒'}</option>`).join('');
  $('#qOn').checked = u.quiet.on; $('#qFrom').value = u.quiet.from; $('#qTo').value = u.quiet.to;
  $('#qNow').textContent = u.quiet.on ? (u.quietNow ? 'quiet right now' : 'not now') : '';
}
const setUi = async (p) => { const r = saved(await K.ui.setPrefs(p)); if (r && !r.error) renderUi(r); };
$$('.seg[data-pref]').forEach((el) => el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setUi({ [el.dataset.pref]: b.dataset.v }))));
$$('input[data-pref]').forEach((el) => el.addEventListener('change', () => setUi({ [el.dataset.pref]: el.checked })));
$('#termTheme').addEventListener('change', (e) => setUi({ termTheme: e.target.value }));
const setQuiet = () => setUi({ quiet: { on: $('#qOn').checked, from: $('#qFrom').value, to: $('#qTo').value } });
['#qOn', '#qFrom', '#qTo'].forEach((s) => $(s).addEventListener('change', setQuiet));

// ---- voice ----
const LANG_INFO = { en: 'The Windows voice reads her English text.', ja: 'She speaks a Japanese dub of what she writes (AivisSpeech / VOICEVOX).', off: 'She only talks in bubbles.' };
function renderVoice(v) {
  if (!v) return;
  seg($('#voiceLang'), v.lang);
  const who = v.pick ? ` Voice: ${v.pick.nameEn || v.pick.name}${v.pick.styleNameEn ? ` · ${v.pick.styleNameEn}` : ''}.` : '';
  $('#voiceInfo').textContent = (LANG_INFO[v.lang] || '') + (v.lang === 'ja' ? who : '');
  $$('input[data-voice]').forEach((el) => { el.checked = v[el.dataset.voice] !== false; });
}
const setVoice = async (p) => { const r = saved(await K.voice.set(p)); renderVoice(await K.voice.status()); return r; };
$('#voiceLang').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setVoice({ lang: b.dataset.v })));
$$('input[data-voice]').forEach((el) => el.addEventListener('change', () => setVoice({ [el.dataset.voice]: el.checked })));
$('#voiceTest').addEventListener('click', async () => {
  say('speaking…');
  const r = await K.voice.say('Hi hi! This is how I sound right now~');
  say(r && r.ok ? `spoken (${r.engine})` : `not spoken: ${(r && r.reason) || 'error'}`, !(r && r.ok));
});

// ---- weather ----
async function renderWeather() {
  const w = await K.weather.get().catch(() => null);
  const loc = w && w.location;
  $('#city').value = loc ? loc.city : '';
  $('#cityInfo').textContent = loc ? (w.current ? `Now in ${loc.city}: ${w.current.kind}, ${Math.round(w.current.tempC)}°C` : `Location: ${loc.city}`) : 'Off. Set a city and she reacts to rain, storms, heat and cold.';
}
$('#citySave').addEventListener('click', async () => { const r = saved(await K.weather.set($('#city').value.trim())); if (!r.error) renderWeather(); });
$('#cityOff').addEventListener('click', async () => { saved(await K.weather.off()); renderWeather(); });

// ---- phone (Telegram) ----
function renderTg(t) {
  if (!t) return;
  $('#tgBadge').textContent = !t.configured ? 'not set up' : t.paired ? (t.running ? 'connected' : 'off') : 'waiting for pairing';
  $('#tgBadge').classList.toggle('off', !t.paired || !t.running);
  const pair = t.pairing ? `<br>Pairing code: <b>${esc(t.pairing.code)}</b>${t.pairing.link ? ` · <a class="lnk" data-link="${esc(t.pairing.link)}">open in Telegram</a>` : ''} (valid 15 minutes)` : '';
  $('#tgInfo').innerHTML = (t.configured ? `Bot <b>@${esc(t.bot || '?')}</b>.` : 'Talk to her and give Claude work from your phone. Make a bot with @BotFather and paste its token.') + pair;
  $('#tgSetup').hidden = t.configured; $('#tgOpts').hidden = !t.configured;
  $$('input[data-tg]').forEach((el) => { el.checked = !!t[el.dataset.tg]; });
  $$('#tgInfo [data-link]').forEach((a) => a.addEventListener('click', () => K.openLink(a.dataset.link)));
}
$$('input[data-tg]').forEach((el) => el.addEventListener('change', async () => renderTg(saved(await K.telegram.set({ [el.dataset.tg]: el.checked })))));
$('#tgSave').addEventListener('click', async () => { say('checking the token…'); const r = saved(await K.telegram.setup($('#tgToken').value)); if (!r.error) { $('#tgToken').value = ''; renderTg(r); } });
$('#tgCode').addEventListener('click', async () => renderTg(saved(await K.telegram.newCode())));
$('#tgUnpair').addEventListener('click', async () => renderTg(saved(await K.telegram.unpair())));

// ---- Google ----
function renderGoogle(g) {
  if (!g) return;
  $('#gBadge').textContent = g.signedIn ? 'signed in' : g.configured ? 'signed out' : 'not set up';
  $('#gBadge').classList.toggle('off', !g.signedIn);
  $('#gInfo').innerHTML = g.signedIn ? `Signed in as <b>${esc(g.email || '?')}</b>. Drive backup ${g.backup ? 'on' : 'off'}${g.lastBackup ? ` (last ${new Date(g.lastBackup).toLocaleString()})` : ''}.`
    : 'Calendar, Gmail drafts, Drive, Docs and Sheets, with your own Google project.';
}

// ---- accounts ----
async function renderBrain() { const b = await K.brain.status().catch(() => null); if (b) $('#budget').value = String(b.dailyClaudeUsd ?? ''); }
$('#budgetSave').addEventListener('click', async () => { saved(await K.brain.set({ dailyClaudeUsd: Number($('#budget').value) })); renderBrain(); });

// ---- her ----
async function renderHer() {
  const ch = await K.getCharacter().catch(() => null);
  if (!ch) return;
  const name = (ch.spec && ch.spec.name) || 'Her';
  $('#navName').textContent = name; $('#herName').textContent = name;
  document.title = `Settings · ${name}`;
  const pet = await K.getPet().catch(() => null);
  $('#herInfo').textContent = [ch.spec && ch.spec.motif, ch.stage === 'egg' ? 'still an egg' : null, pet && pet.level ? `bond: ${pet.level.title}` : null].filter(Boolean).join(' · ');
  if (ch.stage !== 'egg') for (const [k, v] of Object.entries(window.TamaShared.theme.chatVars(ch.spec))) document.documentElement.style.setProperty(k, v);
}

async function init() {
  const q = new URLSearchParams(location.search).get('tab');
  let tab = q;
  if (!tab) { try { tab = localStorage.getItem('settingsTab'); } catch { tab = null; } }
  showTab($(`#nav [data-tab="${tab}"]`) ? tab : 'her');
  renderHer();
  renderUi(await K.ui.prefs());
  renderVoice(await K.voice.status().catch(() => null));
  renderTg(await K.telegram.status().catch(() => null));
  renderGoogle(await K.google.status().catch(() => null));
  renderWeather(); renderBrain();
  K.ui.onPrefs(renderUi);
  K.voice.onChanged(() => K.voice.status().then(renderVoice));
  K.telegram.onChange(renderTg);
  K.google.onChange(renderGoogle);
  K.onCharacter(renderHer);
}
init();
