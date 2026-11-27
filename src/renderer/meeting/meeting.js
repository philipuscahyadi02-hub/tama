/* Next-meeting card (D-084): a dumb view of the meeting the core sends; Join opens its video link (allow-listed hosts
   only, platform/shell), Open calendar opens the calendar window, ✕ hides it for this meeting. */
const K = window.tama;
const $ = (id) => document.getElementById(id);
let ev = null;

function left(ms) {
  const m = Math.round(ms / 60000);
  if (m <= 0) return 'starting now';
  if (m < 60) return `in ${m} min`;
  return `in ${Math.floor(m / 60)} h ${m % 60} min`;
}
const hm = (s) => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function render() {
  if (!ev) return;
  const s = Date.parse(ev.start);
  const now = Date.now();
  $('when').textContent = now >= s ? 'Meeting now' : `Next meeting ${left(s - now)}`;
  $('title').textContent = ev.summary || '(no title)';
  const guests = (ev.guests || []).filter((g) => !g.self).length;
  $('sub').textContent = [`${hm(ev.start)}–${hm(ev.end)}`, ev.location, guests ? `${guests} guest${guests > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  $('join').hidden = !ev.meet;
}

K.calendar.onMeeting((p) => { ev = (p && p.event) || null; render(); });
$('join').addEventListener('click', () => { if (ev && ev.meet) K.openLink(ev.meet); });
$('open').addEventListener('click', () => K.calendar.open());
$('close').addEventListener('click', () => { if (ev) K.calendar.dismiss(ev.id); });
setInterval(render, 15000);
window.TamaIcons.fill();
window.TamaLook.start();
