/* Calendar box (D-085): a dumb view. It loads today's and tomorrow's events, shows the next one with a countdown and
   Join, and the agenda in the accordion. New events go through her chat (D-084). Event text: textContent only. */
const K = window.tama;
const $ = (id) => document.getElementById(id);
const DAY = 86400000;
let view = { meeting: null, expanded: false };
let events = [];
let problem = null;

const day0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const when = (e) => (e.allDay ? { s: new Date(`${e.start}T00:00`), e: new Date(`${e.end || e.start}T00:00`) } : { s: new Date(e.start), e: new Date(e.end || e.start) });
const mins = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim(); };

async function load() {
  const from = day0(new Date()).getTime();
  const r = await K.calendar.range(from, from + 2 * DAY);
  if (!r || r.error) { problem = r || { error: 'Could not load the calendar.' }; events = []; }
  else { problem = null; events = r.events || []; }
  render();
}

/** The event to show: the meeting the core flagged, else the next (or current) timed event today. */
function nextEvent(now) {
  if (view.meeting) return view.meeting;
  const today = day0(now).getTime() + DAY;
  return events.filter((e) => !e.allDay && e.myResponse !== 'declined').map((e) => ({ e, t: when(e) }))
    .filter(({ t }) => t.e > now && t.s.getTime() < today).sort((a, b) => a.t.s - b.t.s).map((x) => x.e)[0] || null;
}

function render() {
  const now = new Date();
  $('card').className = view.expanded ? 'expanded' : '';
  $('expand').dataset.i = view.expanded ? 'up' : 'down'; $('expand').innerHTML = window.TamaIcon($('expand').dataset.i);
  $('date').textContent = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  $('msg').replaceChildren();
  if (problem) {
    $('kicker').textContent = ''; $('title').textContent = 'Calendar'; $('sub').textContent = problem.error; $('join').hidden = true;
    if (problem.fix === 'google') { const b = document.createElement('button'); b.textContent = 'Connect Google'; b.addEventListener('click', () => K.google.open()); $('msg').append(b); }
    renderAgenda(now);
    return;
  }
  const e = nextEvent(now);
  if (!e) {
    const tomorrow = events.filter((x) => !x.allDay && when(x).s >= new Date(day0(now).getTime() + DAY)).sort((a, b) => when(a).s - when(b).s)[0];
    $('kicker').className = ''; $('kicker').textContent = 'Nothing else today';
    $('title').textContent = 'Free for the rest of the day~';
    $('sub').textContent = tomorrow ? `Tomorrow ${hm(when(tomorrow).s)}: ${tomorrow.summary}` : 'Nothing tomorrow either.';
    $('join').hidden = true;
  } else {
    const t = when(e);
    const running = t.s <= now;
    $('kicker').className = running || t.s - now < 15 * 60000 ? 'now' : '';
    $('kicker').textContent = running ? `Now · ends in ${mins(t.e - now)}` : `Next · in ${mins(t.s - now)}`;
    $('title').textContent = e.summary;
    const guests = (e.guests || []).filter((g) => !g.self).length;
    $('sub').textContent = [`${hm(t.s)}–${hm(t.e)}`, e.location, guests ? `${guests} guest${guests > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
    $('join').hidden = !e.meet;
    $('join').onclick = () => K.openLink(e.meet);
  }
  renderAgenda(now);
}

function renderAgenda(now) {
  const ol = $('agenda');
  ol.replaceChildren();
  for (let i = 0; i < 2; i++) {
    const d0 = day0(now).getTime() + i * DAY;
    const head = document.createElement('li'); head.className = 'day'; head.textContent = i ? 'Tomorrow' : 'Today'; ol.append(head);
    const list = events.filter((e) => { const t = when(e); return t.s.getTime() < d0 + DAY && (t.e.getTime() > d0 || t.s.getTime() === d0); }).sort((a, b) => (b.allDay - a.allDay) || (when(a).s - when(b).s));
    if (!list.length) { const n = document.createElement('li'); n.className = 'none'; n.textContent = i ? 'Nothing planned.' : 'Nothing today.'; ol.append(n); continue; }
    for (const e of list) {
      const t = when(e);
      const li = document.createElement('li');
      li.className = `ev${t.e < now ? ' past' : ''}${!e.allDay && t.s <= now && t.e > now ? ' now' : ''}`;
      const a = document.createElement('span'); a.className = 't'; a.textContent = e.allDay ? 'all day' : `${hm(t.s)}–${hm(t.e)}`;
      const b = document.createElement('span'); b.className = 'n'; b.textContent = e.summary;
      li.append(a, b);
      if (e.meet && t.e > now) { const j = document.createElement('button'); j.className = 'j'; j.textContent = 'Join'; j.addEventListener('click', (ev) => { ev.stopPropagation(); K.openLink(e.meet); }); li.append(j); }
      li.title = e.location ? `${e.summary} · ${e.location}` : e.summary;
      li.addEventListener('click', () => K.calendar.open());
      ol.append(li);
    }
  }
}

$('expand').addEventListener('click', () => K.calendar.box(view.expanded ? 'collapse' : 'expand'));
$('close').addEventListener('click', () => { if (view.meeting) K.calendar.dismiss(view.meeting.id); K.calendar.box('dismiss'); });
for (const id of ['openCal', 'openCal2']) $(id).addEventListener('click', () => K.calendar.open());
$('newEv').addEventListener('click', () => K.calendar.draft('Set up an event: '));
K.calendar.onBox((v) => { const was = view.meeting && view.meeting.id; view = v || view; render(); if ((view.meeting && view.meeting.id) !== was) load(); });
setInterval(render, 30000);
setInterval(load, 5 * 60000);
window.TamaIcons.fill();
window.TamaLook.start();
load();
