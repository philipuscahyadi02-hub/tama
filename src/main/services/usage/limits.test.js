// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLimits, dueAlerts } = require('./limits');
const { normalizeUsage, fromRateLimitEvent } = require('../../engines/claude/limits');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const { createDeviceSettings } = require('../../platform/store/device');

// Real shapes captured from the SDK on 2026-11-06.
const TURN_EVENT = { status: 'allowed', resetsAt: 1793965800, rateLimitType: 'five_hour', unifiedWindows: { five_hour: { utilization: 0.77, resetsAt: 1793965800, status: 'allowed' }, seven_day: { utilization: 0.38, resetsAt: 1794002400, status: 'allowed' } } };
const LIVE = {
  subscription_type: 'pro', rate_limits_available: true,
  rate_limits: {
    five_hour: { utilization: 80, resets_at: '2026-11-06T11:49:59.690359+00:00' }, seven_day: { utilization: 39, resets_at: '2026-11-06T21:59:59.690383+00:00' },
    seven_day_opus: null, extra_usage: { is_enabled: true, used_credits: 135, decimal_places: 2 },
    seven_day_breakdown: { rows: [{ display_name: 'Claude Code', percent: 100 }, { display_name: 'Chats', percent: 0 }] }, model_scoped: [],
  },
};

test('Claude limits: both sources normalize to { used 0..1, resetsAt ms }', () => {
  const t = fromRateLimitEvent(TURN_EVENT);
  assert.deepEqual(t.windows.five_hour, { used: 0.77, resetsAt: 1793965800000 });
  assert.equal(t.windows.seven_day.used, 0.38);
  const l = /** @type {any} */ (normalizeUsage(LIVE));
  assert.deepEqual(l.windows.five_hour, { used: 0.8, resetsAt: Date.parse('2026-11-06T11:49:59.690359+00:00') });
  assert.equal(l.windows.seven_day_opus, undefined); // null windows are skipped
  assert.deepEqual(l.extra, { enabled: true, usedUsd: 1.35 });
  assert.equal(l.breakdown[0].name, 'Claude Code');
  assert.equal(normalizeUsage({ rate_limits_available: false }), null); // API key users
});

test('warnings: the most severe threshold crossed, once per window reset', () => {
  const w = { five_hour: { used: 0.92, resetsAt: 60000 }, seven_day: { used: 0.5, resetsAt: 120000 } };
  const first = dueAlerts(w, {}, [0.25, 0.1]);
  assert.equal(first.length, 1);
  assert.equal(first[0].threshold, 0.1);
  assert.deepEqual(dueAlerts(w, { [first[0].key]: true }, [0.25, 0.1]), []);
  assert.equal(dueAlerts({ five_hour: { used: 0.92, resetsAt: 3600000 } }, { [first[0].key]: true }, [0.25, 0.1]).length, 1); // a new window
});

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-lim-'));
  const store = createStore(dir);
  const bus = new Bus();
  const device = createDeviceSettings(store);
  const T = new Date(2026, 10, 6, 15).getTime();
  /** @type {any[]} */ const entries = [
    { at: T - 1000, provider: 'gemini', surface: 'chat', op: 'turn', tokens: 9000, ok: true },
    { at: T - 900, provider: 'google', surface: 'api', op: 'gmail messages GET', ok: true },
    { at: T - 800, provider: 'google', surface: 'api', op: 'places.searchText (billable)', ok: true },
  ];
  bus.handle('google.status', () => ({ signedIn: true, clientId: '987654321-x.apps.googleusercontent.com' }));
  /** @type {string[]} */ const notices = [];
  bus.on('brain.notice', (n) => notices.push(n.text));
  const lim = createLimits({ bus, store, device, entries: () => entries, refreshClaude: async () => normalizeUsage(LIVE), now: () => T });
  const stop = lim.start();
  return { dir, bus, lim, notices, stop };
}

test('limits service: turn events + live check, history for the chart, one warning, Gemini tier/quota, Google month + cap', async (t) => {
  const s = setup();
  t.after(s.stop);
  s.bus.emit('usage.limit', { provider: 'claude', source: 'turn', ...fromRateLimitEvent(TURN_EVENT) });
  let L = await s.bus.request('usage.limits.get');
  assert.equal(Math.round(L.claude.windows.five_hour.left * 100), 23);
  assert.equal(L.claude.windows.five_hour.label, '5-hour');
  assert.equal(L.claude.history.length, 2);
  assert.equal(s.notices.length, 1); // 23 % left → the 25 % warning
  assert.match(s.notices[0], /5-hour limit: only 23% left/);
  L = await s.bus.request('usage.limits.refresh');
  assert.equal(L.claude.source, 'live');
  assert.equal(Math.round(L.claude.windows.five_hour.left * 100), 20);
  assert.equal(L.claude.extra.usedUsd, 1.35);
  assert.equal(s.notices.length, 1); // same window, same threshold: no repeat
  assert.equal(fs.readFileSync(path.join(s.dir, 'usage', 'limits.jsonl'), 'utf8').trim().split('\n').length, 4);
  s.bus.emit('usage.limit', { provider: 'gemini', tier: 'Google AI Plus' });
  s.bus.emit('usage.limit', { provider: 'gemini', hit: 'RESOURCE_EXHAUSTED: quota' });
  L = await s.bus.request('usage.limits.set', { placesCap: 100 });
  assert.equal(L.gemini.tier, 'Google AI Plus');
  assert.match(L.gemini.lastHit.message, /RESOURCE_EXHAUSTED/);
  assert.deepEqual(L.gemini.today, { turns: 1, tokens: 9000 });
  assert.deepEqual(L.google.month, { calls: 2, byApi: { gmail: 1, places: 1 }, places: 1 });
  assert.equal(L.google.placesCap, 100);
  assert.equal(L.google.project, '987654321');
});
