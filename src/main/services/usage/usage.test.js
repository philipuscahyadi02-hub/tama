// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createUsageLog, summarize, clean } = require('.');
const { createAccounts } = require('../accounts');
const { geminiStatus } = require('../../engines/accounts');
const { apiOp } = require('../google');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const { createDeviceSettings } = require('../../platform/store/device');

function setup(now = () => new Date(2026, 10, 6, 15).getTime()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-usage-'));
  const store = createStore(dir);
  const bus = new Bus();
  const device = createDeviceSettings(store);
  const log = createUsageLog({ bus, store, device, now });
  const stop = log.start();
  return { dir, store, bus, device, log, stop };
}

test('clean(): numbers and short labels only; unknown fields (like text) are dropped', () => {
  const e = clean({ provider: 'gemini', surface: 'chat', op: 'turn', tokens: 1234, text: 'my secret message', body: 'email body', prompt: 'x' }, 5);
  assert.deepEqual(Object.keys(e).sort(), ['at', 'ok', 'op', 'provider', 'surface', 'tokens']);
  assert.equal(clean({ provider: 'evil', op: 'a\nb' }, 1).provider, 'claude');
  assert.equal(clean({ op: 'a\nb' }, 1).op, 'a b');
});

test('usage log: records to YYYY-MM.jsonl, survives a restart, summarizes per day and provider (D-040)', async () => {
  const s = setup();
  s.bus.emit('usage.record', { provider: 'claude', surface: 'terminal', op: 'turn', tokensIn: 100, tokensOut: 50, cacheRead: 1000, costUsd: 0.12, model: 'claude-opus' });
  s.bus.emit('usage.record', { provider: 'gemini', surface: 'chat', op: 'turn', tokens: 3000 });
  s.bus.emit('usage.record', { provider: 'google', surface: 'api', op: 'gmail messages GET', ok: false });
  const text = fs.readFileSync(path.join(s.dir, 'usage', '2026-11.jsonl'), 'utf8');
  assert.equal(text.trim().split('\n').length, 3);
  s.stop();
  // A fresh instance on the same store (= app restart) reads the log back.
  const s2bus = new Bus();
  const log2 = createUsageLog({ bus: s2bus, store: s.store, device: s.device, now: () => new Date(2026, 10, 6, 16).getTime() });
  log2.start();
  const r = await s2bus.request('usage.get', { days: 7 });
  assert.equal(r.entries.length, 3);
  assert.equal(r.entries[0].provider, 'google'); // newest first
  assert.equal(r.summary.totals.claude.tokens, 1150);
  assert.equal(r.summary.totals.claude.costUsd, 0.12);
  assert.equal(r.summary.totals.gemini.tokens, 3000);
  assert.equal(r.summary.totals.google.errors, 1);
  assert.deepEqual(r.summary.totals.google.ops, { 'gmail messages GET': 1 });
  assert.equal(r.summary.byDay['2026-11-06'].claude.calls, 1);
  assert.equal(Object.keys(r.summary.byDay).length, 7);
});

test('usage log: keeps 3 months; claude plan limits are stored per window', async () => {
  const s = setup();
  fs.mkdirSync(path.join(s.dir, 'usage'), { recursive: true });
  fs.writeFileSync(path.join(s.dir, 'usage', '2026-06.jsonl'), '{"at":1}\n');
  fs.writeFileSync(path.join(s.dir, 'usage', '2026-10.jsonl'), `${JSON.stringify({ at: new Date(2026, 9, 30).getTime(), provider: 'gemini', surface: 'chat', op: 'turn', ok: true })}\n`);
  s.log.load();
  assert.equal(fs.existsSync(path.join(s.dir, 'usage', '2026-06.jsonl')), false);
  assert.equal(fs.existsSync(path.join(s.dir, 'usage', '2026-10.jsonl')), true);
  s.bus.emit('usage.limit', { info: { status: 'allowed', rateLimitType: 'five_hour', utilization: 0.42, resetsAt: 1793960000 } });
  s.bus.emit('usage.limit', { info: { status: 'allowed_warning', rateLimitType: 'seven_day', utilization: 0.81 } });
  const r = await s.bus.request('usage.get', {});
  assert.equal(r.claudeLimits.five_hour.utilization, 0.42);
  assert.equal(r.claudeLimits.seven_day.status, 'allowed_warning');
  s.stop();
});

test('summarize: empty days are present, older entries ignored', () => {
  const now = new Date(2026, 10, 6, 12).getTime();
  const s = summarize([{ at: new Date(2026, 9, 1).getTime(), provider: 'claude', surface: 't', op: 'turn', ok: true }], 3, now);
  assert.deepEqual(Object.keys(s.byDay), ['2026-11-04', '2026-11-05', '2026-11-06']);
  assert.equal(s.totals.claude.calls, 0);
});

test('accounts: overview from all four; switching Claude starts the official sign-in and a changed account clears the session', async () => {
  const bus = new Bus();
  let email = 'old@example.com';
  let switched = 0;
  /** @type {any[]} */ const seen = [];
  bus.handle('google.status', () => ({ signedIn: true, email: 'g@example.com', clientId: '123456789-abc.apps.googleusercontent.com', scopes: ['gmail.compose'], maps: 'web-search' }));
  bus.handle('telegram.status', () => ({ configured: true, bot: 'KeroTamaBot', paired: true, running: true }));
  bus.handle('engine.clear', () => { seen.push('clear'); });
  bus.on('accounts.changed', () => seen.push('changed'));
  const acc = createAccounts({
    bus,
    claude: { status: async () => ({ loggedIn: true, email, plan: 'pro' }), switch: () => { switched++; } },
    gemini: { status: () => ({ email: 'agy@example.com', method: 'consumer' }), switch: () => {} },
  });
  const stop = acc.start();
  const a = await bus.request('accounts.get', {});
  assert.equal(a.claude.email, 'old@example.com');
  assert.equal(a.gemini.email, 'agy@example.com');
  assert.equal(a.google.project, '123456789');
  assert.equal(a.telegram.bot, 'KeroTamaBot');
  const r = await bus.request('accounts.switch', { kind: 'claude' });
  assert.equal(r.ok, true);
  assert.equal(switched, 1);
  email = 'new@example.com';
  await bus.request('accounts.get', { refresh: true });
  await new Promise((res) => setTimeout(res, 5));
  assert.deepEqual(seen, ['changed', 'clear']);
  assert.match((await bus.request('accounts.switch', { kind: 'nope' })).error, /Unknown/);
  stop();
});

test('geminiStatus reads the account agy logged (latest log first); apiOp names Google calls without ids', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-home-'));
  const d = path.join(home, '.gemini', 'antigravity-cli', 'tama-acp', 'log');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'acp-server-1.log'), 'I1106 server_oauth.go:220] applyAuthResult: email=first@example.com, authMethod=consumer, quotaProject=\n');
  const later = path.join(d, 'acp-server-2.log');
  fs.writeFileSync(later, 'I1106 server_oauth.go:220] applyAuthResult: email=second@example.com, authMethod=consumer, quotaProject=\n');
  fs.utimesSync(later, new Date(), new Date(Date.now() + 1000));
  assert.deepEqual({ ...geminiStatus(home), seenAt: null }, { email: 'second@example.com', method: 'consumer', seenAt: null });
  assert.equal(geminiStatus(fs.mkdtempSync(path.join(os.tmpdir(), 'tama-empty-'))).email, null);
  assert.equal(apiOp('GET', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/1a2b3c'), 'gmail messages GET');
  assert.equal(apiOp('POST', 'https://www.googleapis.com/upload/drive/v3/files'), 'drive upload files POST');
});
