// @ts-check
// Calendar window and next-meeting card (D-084): events for a date range (month, week, agenda), the user's private
// notes on an event, and which meeting is coming up within the pop-up time (ui pref `calendarLead`, default 15 min).
// Creating events and inviting people stays in her chat, which shows the full invitation for confirmation (D-038, D-039).
const { TOPICS } = require('../../bus-topics');

const DAY = 86400000;
const MAX_RANGE = 62 * DAY; // a month view plus its leading and trailing weeks

/**
 * Pure: the next meeting to show on the card: a timed event that starts within `leadMin` (or is running and began less
 * than 5 minutes ago), not one the user declined or dismissed.
 * @param {Array<import('./calendar').CalEvent>} events @param {number} now @param {number} leadMin @param {Set<string>} dismissed
 */
function nextMeeting(events, now, leadMin, dismissed) {
  const upcoming = events
    .filter((e) => !e.allDay && e.myResponse !== 'declined' && !dismissed.has(e.id))
    .map((e) => ({ e, s: Date.parse(e.start), end: Date.parse(e.end) }))
    .filter(({ s, end }) => Number.isFinite(s) && s - now <= leadMin * 60000 && now - s < 5 * 60000 && end > now)
    .sort((a, b) => a.s - b.s);
  return upcoming.length ? upcoming[0].e : null;
}

/** Demo events for screenshots without a Google account (TAMA_CAL_DEMO=1). Pure. @param {number} from @param {number} to @param {number} [now] adds a meeting 10 min from now */
function demoEvents(from, to, now) {
  const out = [];
  if (now && now + 600000 >= from && now < to) out.push({ id: 'demo-soon', summary: 'Sprint planning', allDay: false, start: new Date(now + 600000).toISOString(), end: new Date(now + 2400000).toISOString(), meet: 'https://meet.google.com/abc-defg-hij', location: 'Room Sakura', guests: [{ email: 'you@example.com', self: true, response: 'accepted' }, { email: 'kai@example.com', name: 'Kai' }, { email: 'ana@example.com', name: 'Ana' }] });
  const titles = [['Stand-up', 15, true], ['Design review', 60, true], ['Lunch with Ana', 60, false], ['Focus time', 120, false], ['1:1 with Kai', 30, true]];
  for (let t = new Date(from).setHours(0, 0, 0, 0); t < to; t += DAY) {
    const d = new Date(t);
    if (d.getDay() === 0) continue;
    titles.forEach(([summary, mins, meet], i) => {
      if ((d.getDate() + i) % 3 === 0 && i > 1) return;
      const s = new Date(t); s.setHours([9, 11, 12, 14, 16][i], i === 0 ? 30 : 0, 0, 0);
      out.push({
        id: `demo-${t}-${i}`, summary: String(summary), allDay: false, start: s.toISOString(), end: new Date(s.getTime() + Number(mins) * 60000).toISOString(),
        meet: meet ? 'https://meet.google.com/abc-defg-hij' : undefined, location: i === 2 ? 'Kopi Kenangan, Jakarta' : undefined,
        guests: meet ? [{ email: 'you@example.com', self: true, response: 'accepted' }, { email: 'kai@example.com', name: 'Kai' }] : undefined,
      });
    });
    if (d.getDate() % 9 === 0) out.push({ id: `demo-${t}-all`, summary: 'Mom’s birthday', allDay: true, start: d.toISOString().slice(0, 10), end: new Date(t + DAY).toISOString().slice(0, 10) });
  }
  return out;
}

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   calendar: ReturnType<typeof import('./calendar').createCalendar>,
 *   signedIn: () => boolean,
 *   expired?: () => boolean,
 *   device: { get: () => any },
 *   now?: () => number,
 *   demo?: boolean,
 * }} deps
 */
function createCalView({ bus, calendar, signedIn, expired = () => false, device, now = Date.now, demo = false }) {
  const dismissed = new Set();
  /** @type {string} */ let shownId = '';
  const lead = () => { const v = Number((device.get().ui || {}).calendarLead); return [5, 10, 15, 30].includes(v) ? v : 15; };
  const popupOn = () => (device.get().ui || {}).calendarPopup !== false;

  /** @param {{ from?: number, to?: number }} p */
  async function range(p) {
    const from = Number(p.from) || now();
    const to = Math.min(Number(p.to) || from + 7 * DAY, from + MAX_RANGE);
    if (demo) return { events: demoEvents(from, to, now()), demo: true };
    if (!signedIn()) return expired() ? { error: 'Your Google sign-in expired.', fix: 'signin' } : { error: 'Connect Google to see your calendar.', fix: 'google' };
    try { return { events: await calendar.list({ from, to, max: 250 }) }; } catch (e) { return { error: String((/** @type {any} */ (e)).message || e).slice(0, 200) }; }
  }

  /** @param {{ eventId?: string, notes?: string }} p */
  async function notes(p) {
    const eventId = String(p.eventId || '');
    if (!/^[\w-]{3,1024}$/.test(eventId)) return { error: 'That event id does not look right.' };
    if (demo) return { ok: true, event: { id: eventId, notes: String(p.notes || '') } };
    if (!signedIn()) return { error: 'Connect Google first.' };
    try { return { ok: true, event: await calendar.setNotes({ eventId, notes: String(p.notes || '') }) }; } catch (e) { return { error: String((/** @type {any} */ (e)).message || e).slice(0, 200) }; }
  }

  /** From the minute calendar watch: tell the card what's coming (or that nothing is). @param {Array<import('./calendar').CalEvent>} events */
  function onWatch(events) {
    const next = popupOn() ? nextMeeting(events, now(), lead(), dismissed) : null;
    const id = next ? next.id : '';
    if (id === shownId) return;
    shownId = id;
    bus.emit(TOPICS.GOOGLE_MEETING_NEXT, { event: next });
  }

  function start() {
    const offs = [
      bus.handle(TOPICS.GOOGLE_CAL_RANGE, (/** @type {any} */ p) => range(p || {})),
      bus.handle(TOPICS.GOOGLE_CAL_NOTES, (/** @type {any} */ p) => notes(p || {})),
      bus.handle(TOPICS.GOOGLE_MEETING_DISMISS, (/** @type {any} */ p) => {
        const id = String((p && p.eventId) || '');
        if (id) dismissed.add(id);
        if (id === shownId) { shownId = ''; bus.emit(TOPICS.GOOGLE_MEETING_NEXT, { event: null }); }
        return { ok: true };
      }),
    ];
    // Screenshots without Google: the demo calendar feeds the card too.
    const timer = demo ? setInterval(() => onWatch(demoEvents(now() - 3 * 3600000, now() + DAY, now())), 60000) : null;
    if (demo) setTimeout(() => onWatch(demoEvents(now() - 3 * 3600000, now() + DAY, now())), 3000);
    return () => { if (timer) clearInterval(timer); for (const off of offs) off(); };
  }

  return { start, range, notes, onWatch, lead };
}

module.exports = { createCalView, nextMeeting, demoEvents, MAX_RANGE };
