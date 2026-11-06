/* Usage & accounts dashboard (M8, D-040). A dumb view over window.tama.usage / window.tama.accounts. */
const $ = (s) => document.querySelector(s);
const K = window.tama;
const st = { days: 14, metric: 'calls', data: null, accounts: null, limits: null, tab: 'overview' };
const NAMES = { claude: 'Claude', gemini: 'Gemini (agy)', google: 'Google', telegram: 'Telegram' };
const COLORS = { claude: 'var(--c-claude)', gemini: 'var(--c-gemini)', google: 'var(--c-google)', telegram: 'var(--c-telegram)' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n || 0)));
const usd = (n) => `$${(n || 0).toFixed(2)}`;
const when = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const say = (text, err) => { $('#acctMsg').textContent = text || ''; $('#acctMsg').classList.toggle('err', !!err); };

// ---------------- accounts ----------------
function limitBars() {
  const w = st.limits && st.limits.claude && st.limits.claude.windows;
  if (!w || !Object.keys(w).length) return '<div class="kv dim">Limits: see the Limits tab.</div>';
  return `<div class="kv">${Object.values(w).slice(0, 2).map((v) => `${esc(v.label)} <b>${Math.round(v.left * 100)}% left</b>`).join(' · ')}</div>`;
}

function renderAccounts(a) {
  st.accounts = a;
  const c = a.claude || {};
  const g = a.gemini || {};
  const go = a.google;
  const tg = a.telegram;
  const card = (key, body, btns) => `<div class="card acct"><h3><span class="dot" style="background:${COLORS[key]}"></span>${NAMES[key]}</h3>${body}<div class="btns">${btns}</div></div>`;
  $('#accounts').innerHTML = [
    card('claude', c.loggedIn
      ? `<div class="kv"><b>${esc(c.email)}</b> <span class="badge">${esc(c.plan || c.method || '')}</span></div>
         <div class="kv dim">${esc(c.org || '')}${c.expiresAt ? ` · login valid until ${esc(when(Date.parse(c.expiresAt)))}` : ''}</div>${limitBars()}`
      : `<div class="kv"><span class="badge off">signed out</span></div><div class="kv dim">${esc(c.error || 'Sign in to use the terminal.')}</div>`,
    '<button data-switch="claude">Switch account</button>'),
    card('gemini', g.email
      ? `<div class="kv"><b>${esc(g.email)}</b> <span class="badge">${esc(g.method || 'google')}</span></div><div class="kv dim">Chat, events and diary. Shared with your own agy CLI.</div>`
      : '<div class="kv"><span class="badge off">unknown</span></div><div class="kv dim">Chat once, or sign in to agy.</div>',
    '<button data-switch="gemini">Switch account</button>'),
    card('google', go && go.signedIn
      ? `<div class="kv"><b>${esc(go.email || 'connected')}</b></div>
         <div class="kv dim">Project ${esc(go.project || '?')} · places: ${go.maps === 'google' ? 'Google Maps key' : 'web search'}</div>
         <div class="kv dim">${esc((go.scopes || []).join(', '))}</div>`
      : `<div class="kv"><span class="badge off">${go && go.configured ? 'signed out' : 'not set up'}</span></div><div class="kv dim">Gmail, Calendar, Drive, Docs, Sheets.</div>`,
    `${go && go.signedIn ? '<button data-switch="google">Switch account</button>' : '<button data-switch="google" class="primary">Sign in</button>'}<button data-switch="google-project">Change project</button>`),
    card('telegram', tg && tg.configured
      ? `<div class="kv"><b>@${esc(tg.bot)}</b> <span class="badge ${tg.running ? '' : 'off'}">${tg.running ? 'running' : 'stopped'}</span></div><div class="kv dim">${tg.paired ? 'paired with your phone' : 'not paired yet'}</div>`
      : '<div class="kv"><span class="badge off">not set up</span></div><div class="kv dim">/phone setup in the terminal.</div>',
    '<button data-switch="telegram">Change</button>'),
  ].join('');
  document.querySelectorAll('[data-switch]').forEach((b) => b.addEventListener('click', () => switchTo(b.dataset.switch)));
}

async function switchTo(kind) {
  const warn = kind === 'gemini' ? 'This also switches the account of your own agy CLI. Continue?' : kind === 'claude' ? 'This signs Claude Code out on this PC (also outside Tama) and opens the sign-in. Continue?' : null;
  if (warn && !window.confirm(warn)) return;
  say(kind === 'google' ? 'A browser window opened: pick the Google account…' : 'Working…');
  const r = await K.accounts.switchTo(kind);
  if (r.error) return say(`✗ ${r.error}`, true);
  say(r.message || 'Done.');
  if (r.openGoogleSetup) K.google.open();
  renderAccounts(await K.accounts.get(true));
}

// ---------------- usage ----------------
function renderTotals(s) {
  const t = s.totals;
  const box = (key, big, rows) => `<div class="card tot"><h3><span class="dot" style="background:${COLORS[key]}"></span>${NAMES[key]}</h3><div class="big">${big}</div>${rows}</div>`;
  const ops = (o, n = 4) => `<ul class="ops">${Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `<li>${esc(k)} · ${v}</li>`).join('')}</ul>`;
  const err = (x) => (x.errors ? ` · <span style="color:var(--c-bad)">${x.errors} errors</span>` : '');
  $('#totals').innerHTML = [
    box('claude', `${t.claude.calls} turns`, `<div class="kv">${fmtN(t.claude.tokens)} tokens · ≈${usd(t.claude.costUsd)}${err(t.claude)}</div><div class="kv dim">≈$ = API price estimate; your Claude plan is a flat subscription.</div>`),
    box('gemini', `${t.gemini.calls} turns`, `<div class="kv">${fmtN(t.gemini.tokens)} tokens${err(t.gemini)}</div><div class="kv dim">Counts against your agy/Gemini quota.</div>`),
    box('google', `${t.google.calls} calls`, `${err(t.google) ? `<div class="kv">${err(t.google).slice(3)}</div>` : ''}${ops(t.google.ops)}`),
    box('telegram', `${t.telegram.calls} calls`, ops(t.telegram.ops, 3)),
  ].join('');
}

function renderChart(s) {
  const days = Object.keys(s.byDay).sort();
  const provs = st.metric === 'costUsd' ? ['claude'] : ['claude', 'gemini', 'google', 'telegram'];
  const val = (d, p) => ((s.byDay[d] || {})[p] || {})[st.metric] || 0;
  const max = Math.max(1e-9, ...days.map((d) => provs.reduce((a, p) => a + val(d, p), 0)));
  const W = 1000, H = 190, padB = 22, padL = 44;
  const bw = (W - padL) / days.length;
  let bars = '';
  days.forEach((d, i) => {
    let y = H - padB;
    for (const p of provs) {
      const h = (val(d, p) / max) * (H - padB - 10);
      if (h > 0) { y -= h; bars += `<rect x="${padL + i * bw + bw * 0.15}" y="${y}" width="${bw * 0.7}" height="${h}" rx="3" style="fill:${COLORS[p]}"><title>${esc(d)} ${NAMES[p]}: ${st.metric === 'costUsd' ? usd(val(d, p)) : fmtN(val(d, p))}</title></rect>`; }
    }
    if (days.length <= 16 || i % Math.ceil(days.length / 15) === 0) bars += `<text x="${padL + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" style="font-size:11px;fill:var(--tama-dim)">${esc(d.slice(5))}</text>`;
  });
  const top = st.metric === 'costUsd' ? usd(max) : fmtN(max);
  $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="${padL}" y1="${H - padB}" x2="${W}" y2="${H - padB}" style="stroke:var(--tama-line)"/>
    <text x="4" y="14" style="font-size:11px;fill:var(--tama-dim)">${esc(top)}</text>${bars}</svg>`;
  $('#legend').innerHTML = provs.map((p) => `<span><span class="dot" style="background:${COLORS[p]}"></span> ${NAMES[p]}</span>`).join('');
}

function shownRows() {
  const p = $('#fProvider').value;
  const q = $('#fText').value.trim().toLowerCase();
  return (st.data ? st.data.entries : []).filter((e) => (!p || e.provider === p) && (!q || `${e.op} ${e.model || ''} ${e.surface}`.toLowerCase().includes(q)));
}
function renderLog() {
  $('#log tbody').innerHTML = shownRows().slice(0, 500).map((e) => `<tr class="${e.ok ? '' : 'err'}">
    <td>${esc(when(e.at))}</td><td><span class="dot" style="background:${COLORS[e.provider]}"></span> ${esc(NAMES[e.provider])}</td><td>${esc(e.surface)}</td>
    <td>${esc(e.op)}</td><td>${esc(e.model || '')}</td><td class="n">${e.tokensIn != null ? fmtN(e.tokensIn) : e.tokens != null ? fmtN(e.tokens) : ''}</td>
    <td class="n">${e.tokensOut != null ? fmtN(e.tokensOut) : ''}</td><td class="n">${e.cacheRead != null ? fmtN((e.cacheRead || 0) + (e.cacheWrite || 0)) : ''}</td>
    <td class="n">${e.costUsd != null ? e.costUsd.toFixed(3) : ''}</td><td class="n">${e.ms != null ? Math.round(e.ms) : ''}</td><td>${e.ok ? '' : '✗'}</td></tr>`).join('')
    || '<tr><td colspan="11" class="dim">Nothing logged yet.</td></tr>';
}

function exportCsv() {
  const cols = ['at', 'provider', 'surface', 'op', 'model', 'tokensIn', 'tokensOut', 'cacheRead', 'cacheWrite', 'tokens', 'costUsd', 'ms', 'ok'];
  const q = (v) => (v === undefined || v === null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [cols.join(','), ...shownRows().map((e) => cols.map((c) => (c === 'at' ? new Date(e.at).toISOString() : q(e[c]))).join(','))];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = `tama-usage-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

async function loadUsage() {
  st.data = await K.usage.get({ days: st.days, limit: 1000 });
  $('#rangeLabel').textContent = st.days === 1 ? '· today' : `· last ${st.days} days`;
  renderTotals(st.data.summary);
  renderChart(st.data.summary);
  renderLog();
  if (st.accounts) renderAccounts(st.accounts); // refresh plan-limit bars
}

// ---------------- limits (D-041) ----------------
const ORDER = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet'];
const LINE = { five_hour: 'var(--c-claude)', seven_day: 'var(--c-gemini)', seven_day_opus: 'var(--c-telegram)', seven_day_sonnet: 'var(--c-google)' };
function inTime(t) {
  if (!t) return '';
  const ms = t - Date.now();
  if (ms <= 0) return 'reset now (check again)';
  const h = Math.floor(ms / 3600000); const m = Math.round((ms % 3600000) / 60000);
  const at = new Date(t).toLocaleString([], { weekday: h >= 20 ? 'short' : undefined, hour: '2-digit', minute: '2-digit' });
  return `resets in ${h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m`} (${at})`;
}
function renderLimits(L) {
  st.limits = L;
  const c = L.claude || {};
  const wins = Object.entries(c.windows || {}).sort((a, b) => (ORDER.indexOf(a[0]) + 99) % 99 - (ORDER.indexOf(b[0]) + 99) % 99);
  $('#limSub').textContent = c.subscription || '';
  $('#limUpdated').textContent = c.updatedAt ? `updated ${when(c.updatedAt)} (${c.source === 'live' ? 'live check' : 'after a turn'})` : '';
  $('#limWindows').innerHTML = wins.length ? wins.map(([k, v]) => {
    const pct = Math.round(v.left * 100);
    const cls = v.expired ? '' : pct <= 10 ? 'bad' : pct <= 25 ? 'warn' : '';
    return `<div class="limw"><div class="kv"><b>${esc(v.label)}</b></div>
      <div class="left">${v.expired ? '100' : pct}%<small> left</small></div>
      <div class="bar"><i class="${cls}" style="width:${v.expired ? 100 : pct}%"></i></div>
      <div class="kv dim">${Math.round(v.used * 100)}% used · ${esc(inTime(v.resetsAt))}</div></div>`;
  }).join('') : '<div class="kv dim">No data yet: press "Check now" (no message is sent, it costs nothing).</div>';
  const ex = c.extra;
  const br = (c.breakdown || []).filter((b) => b.percent > 0).map((b) => `${esc(b.name)} ${b.percent}%`).join(' · ');
  $('#limExtra').innerHTML = [ex && ex.enabled ? `Extra usage credits used this month: <b>$${(ex.usedUsd || 0).toFixed(2)}</b>` : '', br ? `This week by app: ${br}` : ''].filter(Boolean).join('<br>');
  renderLimitChart(c.history || []);
  const g = L.gemini || {};
  $('#limGemini').innerHTML = `<div class="kv">Plan: <b>${esc(g.tier || 'unknown (chat once)')}</b></div>
    <div class="kv">Today: <b>${g.today ? g.today.turns : 0}</b> turns · ${fmtN(g.today ? g.today.tokens : 0)} tokens</div>
    <div class="kv">${g.lastHit ? `⚠️ Quota used up at ${esc(when(g.lastHit.at))}` : '✅ No quota warnings'}</div>
    <div class="kv dim">agy doesn't share how much quota is left with other apps, so Tama shows your usage and warns when Gemini reports the quota is used up.</div>`;
  const go = L.google || {};
  const cap = go.placesCap;
  const apis = Object.entries((go.month && go.month.byApi) || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join(' · ');
  $('#limGoogle').innerHTML = `<div class="kv">This month: <b>${go.month ? go.month.calls : 0}</b> API calls${apis ? ` (${apis})` : ''}</div>
    <div class="kv">Gmail, Calendar, Drive, Docs, Sheets: free with generous per-user limits.</div>
    <div class="kv">Maps Places (billable with a key): <b>${go.month ? go.month.places : 0}</b>${cap ? ` of your ${cap} cap · <b>${Math.max(0, cap - (go.month ? go.month.places : 0))} left</b>` : ''}
      · cap <input id="placesCap" type="number" min="0" class="num" value="${cap || ''}" placeholder="none" /> <button id="capSave">Save</button></div>
    ${go.project ? `<div class="kv"><a class="lnk" data-href="https://console.cloud.google.com/apis/dashboard?project=${encodeURIComponent(go.project)}">Quotas in Google Cloud ↗</a><a class="lnk" data-href="https://console.cloud.google.com/billing?project=${encodeURIComponent(go.project)}">Billing ↗</a></div>` : '<div class="kv dim">Connect Google to see your project links.</div>'}`;
  document.querySelectorAll('#limGoogle a[data-href]').forEach((a) => a.addEventListener('click', () => K.openLink(a.dataset.href)));
  $('#capSave').addEventListener('click', async () => { const v = $('#placesCap').value.trim(); renderLimits(await K.limits.set({ placesCap: v ? Number(v) : null })); });
  const [a, b] = (L.alertAt || [0.25, 0.1]).slice().sort((x, y) => y - x);
  $('#alertA').value = String(Math.round((a || 0.25) * 100));
  $('#alertB').value = String(Math.round((b || 0.1) * 100));
  if (st.accounts) renderAccounts(st.accounts);
}
function renderLimitChart(hist) {
  const W = 1000, H = 170, padL = 40, padB = 20, now = Date.now(), from = now - 7 * 86400000;
  const x = (t) => padL + ((t - from) / (now - from)) * (W - padL - 6);
  const y = (left) => 8 + (1 - left) * (H - padB - 14);
  const byWin = {};
  for (const h of hist) (byWin[h.window] = byWin[h.window] || []).push(h);
  let paths = '';
  for (const [w, pts] of Object.entries(byWin)) {
    // Remaining is a step line; at a window reset it jumps back to 100 %.
    let d = ''; let prev = null;
    for (const p of pts.sort((m, n) => m.at - n.at)) {
      if (prev && prev.resetsAt && p.at > prev.resetsAt) d += ` L${x(prev.resetsAt)},${y(1 - prev.used)} L${x(prev.resetsAt)},${y(1)}`;
      d += `${d ? ' L' : 'M'}${x(p.at)},${y(1 - p.used)}`;
      prev = p;
    }
    if (prev) d += ` L${x(now)},${y(prev.resetsAt && prev.resetsAt < now ? 1 : 1 - prev.used)}`;
    paths += `<path d="${d}" style="fill:none;stroke:${LINE[w] || 'var(--tama-dim)'};stroke-width:2.5"/>`;
  }
  const grid = [1, 0.5, 0.25, 0.1].map((l) => `<line x1="${padL}" x2="${W}" y1="${y(l)}" y2="${y(l)}" style="stroke:var(--tama-line);stroke-dasharray:${l === 1 ? 0 : 4}"/><text x="4" y="${y(l) + 4}" style="font-size:11px;fill:var(--tama-dim)">${l * 100}%</text>`).join('');
  const days = [...Array(8)].map((_, i) => { const t = from + i * 86400000; return `<text x="${x(t)}" y="${H - 4}" text-anchor="middle" style="font-size:11px;fill:var(--tama-dim)">${new Date(t).toLocaleDateString([], { weekday: 'short' })}</text>`; }).join('');
  $('#limChart').innerHTML = hist.length ? `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${days}${paths}</svg>` : '<div class="kv dim">The trend fills in as Tama checks (every 20 minutes and after each Claude turn).</div>';
  $('#limLegend').innerHTML = Object.keys(byWin).map((w) => `<span><span class="dot" style="background:${LINE[w] || 'var(--tama-dim)'}"></span> ${esc(((st.limits && st.limits.claude.windows[w]) || {}).label || w)}</span>`).join('');
}
async function loadLimits() { renderLimits(await K.limits.get()); }

function showTab(tab) {
  st.tab = tab;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $('#tabOverview').classList.toggle('hidden', tab !== 'overview');
  $('#tabLimits').classList.toggle('hidden', tab !== 'limits');
  document.querySelectorAll('.ov').forEach((e) => e.classList.toggle('hidden', tab !== 'overview'));
  if (tab === 'limits') loadLimits();
}
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('#limRefresh').addEventListener('click', async () => { $('#limUpdated').textContent = 'asking Claude…'; renderLimits(await K.limits.refresh()); });
$('#alertSave').addEventListener('click', async () => {
  const v = [Number($('#alertA').value), Number($('#alertB').value)].filter((n) => n > 0 && n < 100).map((n) => n / 100);
  renderLimits(await K.limits.set({ alertAt: v }));
});

// ---------------- wiring ----------------
document.querySelectorAll('#range button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#range button').forEach((x) => x.classList.toggle('on', x === b));
  st.days = Number(b.dataset.days); loadUsage();
}));
document.querySelectorAll('#metric button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#metric button').forEach((x) => x.classList.toggle('on', x === b));
  st.metric = b.dataset.m; if (st.data) renderChart(st.data.summary);
}));
$('#fProvider').addEventListener('change', renderLog);
$('#fText').addEventListener('input', renderLog);
$('#csv').addEventListener('click', exportCsv);
$('#refresh').addEventListener('click', async () => { say('Checking accounts…'); renderAccounts(await K.accounts.get(true)); say(''); loadUsage(); });
let pending = null;
K.usage.onChange((p) => { clearTimeout(pending); pending = setTimeout(() => { if (p && p.limits) loadLimits(); else loadUsage(); }, 1500); });
K.accounts.onChange((a) => renderAccounts(a));

(async function boot() {
  const ch = await K.getCharacter().catch(() => null);
  if (ch && ch.stage !== 'egg') for (const [k, v] of Object.entries(window.TamaShared.theme.chatVars(ch.spec))) document.documentElement.style.setProperty(k, v);
  await loadUsage();
  st.limits = await K.limits.get().catch(() => null);
  renderAccounts(await K.accounts.get(false));
  if (/[?&]tab=limits/.test(location.search)) showTab('limits');
  // A live check when the dashboard opens (no message, $0), so the numbers are fresh.
  K.limits.refresh().then((L) => { if (L) { st.limits = L; if (st.tab === 'limits') renderLimits(L); else if (st.accounts) renderAccounts(st.accounts); } }).catch(() => {});
})();
