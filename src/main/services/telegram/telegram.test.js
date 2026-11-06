// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTelegram } = require('.');
const { createBotApi } = require('./api');
const fmt = require('./format');
const { Bus } = require('../../bus');

const TOKEN = '123456789:AAAbbbCCCdddEEEfffGGGhhhIIIjjjKKKlll';

/** Fake Telegram Bot API: records calls; getUpdates serves a queue. */
function fakeTelegram() {
  /** @type {Array<{ method: string, body: any }>} */ const calls = [];
  /** @type {any[]} */ const queue = [];
  let msgId = 100;
  /** @param {any} url @param {any} [init] */
  async function f(url, init = {}) {
    const method = String(url).split('/').pop() || '';
    let body = {};
    if (typeof init.body === 'string') body = JSON.parse(init.body);
    else if (init.body && typeof init.body.get === 'function') body = { form: Object.fromEntries([...init.body.keys()].map((k) => [k, init.body.get(k)])) };
    calls.push({ method, body });
    const ok = (/** @type {any} */ result) => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
    if (method === 'getMe') return ok({ id: 1, username: 'tama_test_bot' });
    if (method === 'getUpdates') {
      if (init.signal && init.signal.aborted) throw new Error('aborted');
      const out = queue.splice(0);
      if (!out.length) await new Promise((r) => setTimeout(r, 5));
      return ok(out);
    }
    if (method === 'sendMessage' || method === 'sendPhoto' || method === 'sendDocument') return ok({ message_id: ++msgId });
    return ok(true);
  }
  const sent = () => calls.filter((c) => c.method === 'sendMessage').map((c) => c.body.text);
  return { fetch: /** @type {any} */ (f), calls, queue, sent };
}

function setup() {
  const tg = fakeTelegram();
  const bus = new Bus();
  /** @type {Record<string, string>} */ const secrets = {};
  let dev = /** @type {Record<string, any>} */ ({});
  const device = { get: () => dev, patch: (/** @type {string|null} */ s, /** @type {any} */ p) => { dev = s ? { ...dev, [s]: { ...(dev[s] || {}), ...p } } : { ...dev, ...p }; } };
  /** @type {any[]} */ const seen = [];
  const cwd = { value: 'C:\\code\\app', mode: 'acceptEdits' };
  bus.handle('engine.info', () => ({ cwd: cwd.value, mode: cwd.mode }));
  bus.handle('engine.setMode', (m) => { seen.push(['mode', m]); cwd.mode = m; });
  bus.handle('engine.send', (t) => { seen.push(['send', t]); });
  bus.handle('engine.setCwd', (d) => { cwd.value = d; return { t: 'cwd', cwd: d }; });
  bus.handle('engine.interrupt', () => { seen.push(['interrupt']); });
  bus.handle('engine.answerPermission', (a) => { seen.push(['answer', a.id, a.choice]); return true; });
  bus.handle('pet.get', () => ({ name: 'Kero-chan', state: { hunger: 50, happy: 80, energy: 60, clean: 90, streak: { count: 3 } }, level: { title: 'Buddy', emoji: '✌️' } }));
  bus.handle('pet.act', (p) => { seen.push(['act', p.action]); return { ok: true }; });
  bus.handle('prod.todo.add', (p) => ({ ok: true, todo: { text: p.text } }));
  bus.handle('chat.send', (t) => {
    seen.push(['chat', t]);
    setTimeout(() => {
      bus.emit('chat.event', { t: 'message', message: { role: 'user', text: t } });
      bus.emit('chat.event', { t: 'message', message: { role: 'tama', text: 'hi from Gemini~' } });
    }, 5);
    return { ok: true };
  });
  /** @type {any[]} */ const notices = [];
  bus.on('brain.notice', (n) => notices.push(n.text));
  const telegram = createTelegram({
    bus, secrets: { get: (k) => secrets[k] ?? null, set: (k, v) => { secrets[k] = v; }, delete: (k) => { delete secrets[k]; } },
    device: /** @type {any} */ (device), git: { isRepo: () => true, diff: async () => 'diff --git a/x b/x\n+hello' },
    snapshot: async () => null, keepAwake: (on) => on, tama: { name: 'Kero-chan' }, fetch: tg.fetch,
  });
  const stop = telegram.start();
  const msg = (/** @type {number} */ chat, /** @type {string} */ text) => ({ update_id: 1, message: { chat: { id: chat, type: 'private' }, text } });
  return { tg, bus, telegram, secrets, seen, notices, cwd, stop, msg, dev: () => dev };
}

test('pairing: token checked, one-time code binds exactly one chat; everyone else is ignored (TG-2, SAFE-3)', async () => {
  const s = setup();
  assert.match((await s.bus.request('telegram.setup', { token: 'nope' })).error, /bot token/);
  const st = await s.bus.request('telegram.setup', { token: TOKEN });
  assert.equal(st.bot, 'tama_test_bot');
  assert.match(st.pairing.link, /^https:\/\/t\.me\/tama_test_bot\?start=[0-9A-F]{6}$/);
  await s.telegram.onUpdate(s.msg(666, '/start WRONG1'));
  assert.equal(s.secrets['telegram.chatId'], undefined);
  await s.telegram.onUpdate(s.msg(42, `/start ${st.pairing.code}`));
  assert.equal(s.secrets['telegram.chatId'], '42');
  assert.ok(s.tg.sent().some((t) => /Paired!/.test(t)));
  assert.ok(s.tg.calls.some((c) => c.method === 'setMyCommands'));
  const before = s.tg.calls.length;
  await s.telegram.onUpdate(s.msg(666, '/feed'));      // a stranger, after pairing
  await s.telegram.onUpdate(s.msg(666, st.pairing.code)); // and the old code is spent
  assert.equal(s.tg.calls.slice(before).filter((c) => c.method !== 'getUpdates').length, 0);
  assert.equal(s.secrets['telegram.chatId'], '42');
  assert.equal((await s.bus.request('telegram.status')).ignored, 3);
  s.stop();
});

async function paired() {
  const s = setup();
  const st = await s.bus.request('telegram.setup', { token: TOKEN });
  await s.telegram.onUpdate(s.msg(42, st.pairing.code));
  return s;
}

test('chat goes to the chat brain and the reply comes back (TG-3); pet + todo commands work and are announced (TG-4/5)', async () => {
  const s = await paired();
  await s.telegram.onUpdate(s.msg(42, 'how are you?'));
  assert.deepEqual(s.seen.find((x) => x[0] === 'chat'), ['chat', '📱 how are you?']);
  assert.equal(s.tg.sent().at(-1), 'hi from Gemini~');
  await s.telegram.onUpdate(s.msg(42, '/feed'));
  assert.ok(s.seen.some((x) => x[0] === 'act' && x[1] === 'feed'));
  assert.ok(s.notices.some((n) => /feed from your phone/.test(n)));
  await s.telegram.onUpdate(s.msg(42, '/todo buy milk'));
  assert.equal(s.tg.sent().at(-1), '☐ added: buy milk');
  await s.telegram.onUpdate(s.msg(42, '/status'));
  assert.match(s.tg.sent().at(-1), /Kero-chan · Buddy/);
  s.stop();
});

test('/code: only in allowed folders, forces ask-every-tool, permission buttons, result + diff file (TG-6, TG-7)', async () => {
  const s = await paired();
  await s.telegram.onUpdate(s.msg(42, '/code fix the test'));
  assert.match(s.tg.sent().at(-1), /isn't allowed for remote work/);
  assert.equal(s.seen.filter((x) => x[0] === 'send').length, 0);
  await s.bus.request('telegram.set', { allow: 'C:\\code\\app' });
  await s.telegram.onUpdate(s.msg(42, '/code fix the test'));
  assert.deepEqual(s.seen.filter((x) => x[0] !== 'chat').slice(0, 2), [['mode', 'default'], ['send', 'fix the test']]);
  assert.ok(s.notices.some((n) => /from your phone: \/code fix the test/.test(n)));
  // permission prompt → inline buttons → answered from the phone
  s.bus.emit('engine.event', { engine: 'claude', role: 'worker', ev: { t: 'permission', id: 7, name: 'Edit', tool: 'Edit', input: { file_path: 'a.js', old_string: 'x', new_string: 'y' } } });
  await new Promise((r) => setTimeout(r, 10));
  const prompt = s.tg.calls.filter((c) => c.method === 'sendMessage').at(-1);
  assert.match(prompt?.body.text, /Claude wants to use Edit/);
  assert.deepEqual(prompt?.body.reply_markup.inline_keyboard[0].map((b) => b.callback_data), ['perm:7:yes', 'perm:7:always', 'perm:7:no']);
  await s.telegram.onUpdate({ update_id: 2, callback_query: { id: 'cb1', data: 'perm:7:yes', message: { chat: { id: 42 } } } });
  assert.deepEqual(s.seen.find((x) => x[0] === 'answer'), ['answer', 7, 'yes']);
  // a stranger's button press is ignored
  await s.telegram.onUpdate({ update_id: 3, callback_query: { id: 'cb2', data: 'perm:7:always', message: { chat: { id: 666 } } } });
  assert.equal(s.seen.filter((x) => x[0] === 'answer').length, 1);
  // result + diff
  s.bus.emit('engine.event', { engine: 'claude', role: 'worker', ev: { t: 'text-start' } });
  s.bus.emit('engine.event', { engine: 'claude', role: 'worker', ev: { t: 'text-delta', text: 'Fixed it.' } });
  s.bus.emit('engine.event', { engine: 'claude', role: 'worker', ev: { t: 'result', isError: false } });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(s.tg.sent().some((t) => /done!\n\nFixed it\./.test(t)));
  assert.ok(s.tg.calls.some((c) => c.method === 'sendDocument'));
  // kill switch
  await s.telegram.onUpdate(s.msg(42, '/remote off'));
  await s.telegram.onUpdate(s.msg(42, '/code again'));
  assert.match(s.tg.sent().at(-1), /switched off/);
  s.stop();
});

test('poll loop: delivers updates in order, advances the offset, stops on a bad token', async () => {
  const tg = fakeTelegram();
  tg.queue.push({ update_id: 10, message: { chat: { id: 1 }, text: 'a' } }, { update_id: 11, message: { chat: { id: 1 }, text: 'b' } });
  const api = createBotApi({ token: () => TOKEN, fetch: tg.fetch });
  /** @type {string[]} */ const got = [];
  const stop = api.poll((u) => { got.push(u.message.text); }, { timeout: 0 });
  await new Promise((r) => setTimeout(r, 40));
  stop();
  assert.deepEqual(got, ['a', 'b']);
  assert.ok(tg.calls.filter((c) => c.method === 'getUpdates').some((c) => c.body.offset === 12));
  const bad = createBotApi({ token: () => TOKEN, fetch: /** @type {any} */ (async () => ({ ok: false, status: 401, json: async () => ({ ok: false, error_code: 401, description: `Unauthorized ${TOKEN}` }) })) });
  /** @type {string[]} */ const errs = [];
  bad.poll(() => {}, { onError: (e) => errs.push(e.message), sleep: async () => {} });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(errs.length, 1); // stopped instead of retrying
  assert.doesNotMatch(errs[0], /AAAbbb/); // token redacted
});

test('format helpers', () => {
  assert.equal(fmt.toolLine({ name: 'Edit', input: { file_path: 'C:\\x\\app.js' } }), '✏️ edit app.js');
  assert.equal(fmt.toolLine({ name: 'mcp__google__docs_create' }), '🔧 google · docs_create');
  assert.match(fmt.permissionText({ name: 'Bash', input: { command: 'npm test' } }), /\$ npm test/);
  assert.equal(fmt.clip('x'.repeat(5000)).length, fmt.MAX);
});
