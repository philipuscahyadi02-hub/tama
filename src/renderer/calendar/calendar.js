/* Calendar window (D-084): month, week and agenda over the user's Google Calendar; click an event to join its meeting,
   open its place on the map or add private notes. New events, invitations and changes go through her chat, where
   she shows the full invitation for confirmation (D-038, D-039). A dumb view: data comes from the core. */
const K = window.tama;
const V = window.TamaCalViews;
const $ = (id) => document.getElementById(id);
const st = { view: 'month', cursor: new Date(), events: [], sel: null, demo: false };
try { const v = localStorage.getItem('calView'); if (['month', 'week', 'agenda'].includes(v)) st.view = v; } catch { /* storage may be unavailable */ }

const fmtDay = (d) => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

function label() {
  const c = st.cursor;
  if (st.view === 'month') return c.toLocaleDateString([], { month: 'long', year: 'numeric' });
  if (st.view === 'week') { const s = V.weekStart(c); const e = V.addDays(s, 6); return `${fmtDay(s)} – ${fmtDay(e)}`; }
  return `From ${fmtDay(c)}`;
}

function problem(text, fix) {
  const box = document.createElement('div'); box.className = 'empty'; box.textContent = text;
  if (fix === 'signin') { const b = document.createElement('button'); b.className = 'primary'; b.textContent = 'Sign in again'; b.addEventListener('click', async () => { b.disabled = true; b.textContent = 'Finish in your browser…'; const r = await K.google.login(); if (r && r.error) { b.disabled = false; b.textContent = 'Sign in again'; } load(); }); box.append(document.createElement('br'), b); }
  if (fix === 'google') { const b = document.createElement('button'); b.className = 'primary'; b.textContent = 'Connect Google'; b.addEventListener('click', () => K.google.open()); box.append(document.createElement('br'), b); }
  $('view').replaceChildren(box);
}

let ticket = 0;
async function load() {
  const my = ++ticket;
  $('label').textContent = label();
  for (const b of document.querySelectorAll('#views button')) b.classList.toggle('on', b.dataset.v === st.view);
  const r = V.rangeOf(st.view, st.cursor);
  const res = await K.calendar.range(r.from.getTime(), r.to.getTime());
  if (my !== ticket) return;
  if (!res || res.error) { problem((res && res.error) || 'Could not load the calendar.', res && res.fix); return; }
  st.events = res.events || [];
  st.demo = !!res.demo;
  render();
}

function render() {
  const ctx = { now: new Date(), open: select, plan, goto: (d, v) => { st.cursor = d; setView(v); } };
  V[st.view]($('view'), st.events, st.cursor, ctx);
  window.TamaIcons.fill($('view'));
}

function setView(v) { st.view = v; try { localStorage.setItem('calView', v); } catch { /* ignore */ } load(); }
function move(dir) {
  const c = st.cursor;
  st.cursor = st.view === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : V.addDays(c, dir * (st.view === 'week' ? 7 : 14));
  load();
}

/** Plan something with Tama: her chat opens with the request ready; she handles invites and places with your OK. */
function plan(at, withTime) {
  const when = withTime ? `${fmtDay(at)} at ${V.hm(at)}` : fmtDay(at);
  K.calendar.draft(`Set up an event on ${when}: `);
}

// ---- detail panel ----
function select(e) {
  st.sel = e;
  const t = V.span(e);
  $('detail').hidden = false;
  $('dTitle').textContent = e.summary;
  $('dWhen').textContent = e.allDay ? `${fmtDay(t.s)} · all day` : `${t.s.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · ${V.hm(t.s)}–${V.hm(t.e)}`;
  $('dPlaceRow').hidden = !e.location;
  $('dPlace').textContent = e.location || '';
  $('dJoin').hidden = !e.meet;
  $('dOpen').hidden = !(e.link && /^https:\/\//.test(e.link));
  const guests = e.guests || [];
  $('dGuestsRow').hidden = !guests.length;
  const RESP = { accepted: '✓', declined: '✗', tentative: '?', needsAction: '·' };
  $('dGuests').replaceChildren(...guests.map((g) => {
    const li = document.createElement('li');
    li.textContent = `${RESP[g.response] || '·'} ${g.name || g.email}${g.self ? ' (you)' : ''}${g.organizer ? ' · organizer' : ''}`;
    return li;
  }));
  $('dDesc').textContent = e.description || '';
  $('dDesc').hidden = !e.description;
  $('dNotes').value = e.notes || '';
  $('dMsg').textContent = st.demo ? 'Demo calendar: notes are not saved.' : '';
}
$('dClose').addEventListener('click', () => { $('detail').hidden = true; st.sel = null; });
$('dJoin').addEventListener('click', () => { if (st.sel && st.sel.meet) K.openLink(st.sel.meet); });
$('dOpen').addEventListener('click', () => { if (st.sel && st.sel.link) K.openLink(st.sel.link); });
$('dPlace').addEventListener('click', () => { if (st.sel && st.sel.location) K.openLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(st.sel.location)}`); });
$('dSave').addEventListener('click', async () => {
  if (!st.sel) return;
  $('dMsg').textContent = 'Saving…';
  const r = await K.calendar.notes(st.sel.id, $('dNotes').value);
  if (r && r.ok) { st.sel.notes = $('dNotes').value; $('dMsg').textContent = '✓ Saved (only you can see these notes).'; } else $('dMsg').textContent = `⚠ ${(r && r.error) || 'Not saved.'}`;
});
$('dAsk').addEventListener('click', () => { if (st.sel) K.calendar.draft(`About my event "${st.sel.summary}" on ${$('dWhen').textContent}: `); });

// ---- toolbar ----
$('today').addEventListener('click', () => { st.cursor = new Date(); load(); });
$('prev').addEventListener('click', () => move(-1));
$('next').addEventListener('click', () => move(1));
for (const b of document.querySelectorAll('#views button')) b.addEventListener('click', () => setView(b.dataset.v));
$('newEv').addEventListener('click', () => K.calendar.draft('Set up an event: '));
document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input')) return;
  if (e.key === 'ArrowLeft') move(-1); else if (e.key === 'ArrowRight') move(1); else if (e.key === 't') { st.cursor = new Date(); load(); }
  else if (e.key === 'm') setView('month'); else if (e.key === 'w') setView('week'); else if (e.key === 'a') setView('agenda');
});
window.addEventListener('focus', () => load()); // back from Google Calendar or her chat: show changes
setInterval(() => { if (st.view === 'week') render(); }, 60000); // the "now" line

window.TamaIcons.fill();
window.TamaLook.start();
load();
