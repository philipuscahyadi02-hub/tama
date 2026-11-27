// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCalView, nextMeeting, demoEvents } = require('./cal-view');
const { slim, meetLink } = require('./calendar');
const { Bus } = require('../../bus');
const { TOPICS } = require('../../bus-topics');

const T0 = Date.parse('2026-11-27T09:50:00+07:00');
const ev = (/** @type {string} */ id, /** @type {number} */ startMin, /** @type {number} */ mins, /** @type {any} */ extra = {}) => ({
  id, summary: id, allDay: false, start: new Date(T0 + startMin * 60000).toISOString(), end: new Date(T0 + (startMin + mins) * 60000).toISOString(), ...extra,
});

test('cal-view: next meeting within the pop-up time; not all-day, declined, dismissed or long started', () => {
  const list = [ev('later', 40, 30), ev('soon', 10, 15), ev('declined', 5, 30, { myResponse: 'declined' }), { ...ev('all', 0, 0), allDay: true }];
  assert.equal(/** @type {any} */ (nextMeeting(list, T0, 15, new Set())).id, 'soon');
  assert.equal(nextMeeting(list, T0, 5, new Set()), null, '5 min ahead: nothing yet (declined skipped)');
  assert.equal(nextMeeting(list, T0, 15, new Set(['soon'])), null);
  assert.equal(/** @type {any} */ (nextMeeting([ev('running', -3, 30)], T0, 15, new Set())).id, 'running', 'just started still shows');
  assert.equal(nextMeeting([ev('old', -10, 30)], T0, 15, new Set()), null, 'underway for 10 min: hidden');
});

test('calendar: meeting links (Meet/Zoom/Teams only) and private notes come through', () => {
  const e = slim({ id: 'a', summary: 'S', start: { dateTime: '2026-11-27T10:00:00Z' }, end: { dateTime: '2026-11-27T10:30:00Z' },
    conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' }] },
    attendees: [{ email: 'me@x.com', self: true, responseStatus: 'declined' }], extendedProperties: { private: { tamaNotes: 'bring slides' } } });
  assert.equal(e.meet, 'https://meet.google.com/abc-defg-hij');
  assert.equal(e.myResponse, 'declined');
  assert.equal(e.notes, 'bring slides');
  assert.equal(meetLink({ description: 'link: https://acme.zoom.us/j/1 thanks' }), 'https://acme.zoom.us/j/1');
  assert.equal(meetLink({ location: 'https://evil.example/meet.google.com/' }), undefined);
});

test('cal-view: range needs Google (demo works without), notes check the id, dismiss hides the card', async () => {
  const bus = new Bus();
  /** @type {any[]} */ const next = [];
  bus.on(TOPICS.GOOGLE_MEETING_NEXT, (p) => next.push(p.event && p.event.id));
  /** @type {any[]} */ const saved = [];
  const calendar = /** @type {any} */ ({ list: async () => [ev('soon', 10, 15)], setNotes: async (/** @type {any} */ p) => { saved.push(p); return { id: p.eventId, notes: p.notes }; } });
  let signed = false;
  const v = createCalView({ bus, calendar, signedIn: () => signed, device: { get: () => ({ ui: { calendarLead: 15 } }) }, now: () => T0 });
  const stop = v.start();
  assert.equal((await bus.request(TOPICS.GOOGLE_CAL_RANGE, { from: T0, to: T0 + 86400000 })).fix, 'google');
  signed = true;
  assert.equal((await bus.request(TOPICS.GOOGLE_CAL_RANGE, { from: T0, to: T0 + 86400000 })).events.length, 1);
  assert.match((await bus.request(TOPICS.GOOGLE_CAL_NOTES, { eventId: '../x', notes: 'n' })).error, /id/);
  assert.equal((await bus.request(TOPICS.GOOGLE_CAL_NOTES, { eventId: 'evt_123', notes: 'agenda' })).ok, true);
  assert.deepEqual(saved, [{ eventId: 'evt_123', notes: 'agenda' }]);
  v.onWatch([ev('soon', 10, 15)]);
  v.onWatch([ev('soon', 10, 15)]);
  await bus.request(TOPICS.GOOGLE_MEETING_DISMISS, { eventId: 'soon' });
  v.onWatch([ev('soon', 10, 15)]);
  assert.deepEqual(next, ['soon', null], 'shown once, hidden after dismiss, not shown again');
  stop();
  assert.ok(demoEvents(T0, T0 + 7 * 86400000).length > 10);
});
