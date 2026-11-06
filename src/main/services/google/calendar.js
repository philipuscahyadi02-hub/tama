// @ts-check
// Google Calendar (GOOG-3). Events are created without attendees, so Tama never sends invitations.
const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** @typedef {{ id: string, summary: string, start: string, end: string, allDay: boolean, location?: string, description?: string, link?: string }} CalEvent */

/** @param {any} e @returns {CalEvent} */
function slim(e) {
  return {
    id: e.id, summary: e.summary || '(no title)', allDay: !!(e.start && e.start.date),
    start: (e.start && (e.start.dateTime || e.start.date)) || '', end: (e.end && (e.end.dateTime || e.end.date)) || '',
    location: e.location || undefined, description: e.description ? String(e.description).slice(0, 500) : undefined, link: e.htmlLink,
  };
}

/**
 * A Google Calendar "add this event" link for OTHER people (Tama never sends invitations, D-014/D-034): put it in a
 * Gmail draft so the recipient can add the event with one click.
 * @param {{ summary: string, start: string, end: string, location?: string, description?: string }} e
 */
function addLink(e) {
  const fmt = (/** @type {string} */ s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replace(/-/g, '') : new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''));
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.summary || '', dates: `${fmt(e.start)}/${fmt(e.end)}` });
  if (e.location) q.set('location', e.location);
  if (e.description) q.set('details', e.description);
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** A date or date-time string → Calendar's { date } or { dateTime }. @param {string} s */
function when(s) {
  const v = String(s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { date: v };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Not a date/time: ${s}`);
  return { dateTime: d.toISOString() };
}

/** @param {ReturnType<typeof import('./api').createApi>} api @param {() => number} [now] */
function createCalendar(api, now = Date.now) {
  return {
    /** @param {{ from?: number, to?: number, query?: string, max?: number }} o @returns {Promise<CalEvent[]>} */
    async list({ from = now(), to = now() + 86400000, query, max = 25 } = {}) {
      const r = await api.request(BASE, {
        query: { timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: Math.min(max, 100), q: query },
      });
      return (r.items || []).filter((/** @type {any} */ e) => e.status !== 'cancelled').map(slim);
    },
    /** @param {{ summary: string, start: string, end: string, description?: string, location?: string }} p */
    async create(p) {
      if (!p.summary) throw new Error('An event needs a summary.');
      const r = await api.request(BASE, {
        query: { sendUpdates: 'none' },
        json: { summary: p.summary, start: when(p.start), end: when(p.end), description: p.description, location: p.location },
      });
      const ev = slim(r);
      return { ...ev, shareLink: addLink({ ...p, start: ev.start, end: ev.end }) };
    },
    /** @param {{ eventId: string, summary?: string, start?: string, end?: string, description?: string, location?: string }} p */
    async update(p) {
      /** @type {Record<string, any>} */
      const patch = {};
      for (const k of ['summary', 'description', 'location']) if (/** @type {any} */ (p)[k] !== undefined) patch[k] = /** @type {any} */ (p)[k];
      if (p.start) patch.start = when(p.start);
      if (p.end) patch.end = when(p.end);
      const r = await api.request(`${BASE}/${encodeURIComponent(p.eventId)}`, { method: 'PATCH', query: { sendUpdates: 'none' }, json: patch });
      return slim(r);
    },
  };
}

module.exports = { createCalendar, slim, when, addLink };
