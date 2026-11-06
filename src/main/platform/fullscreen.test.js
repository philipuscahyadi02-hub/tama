// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { createFullscreenDetector, isFullscreenLine } = require('./fullscreen');

const MON = '0,0,1920,1080';

test('fullscreen line parsing (table)', () => {
  /** @type {Array<[string, boolean, string]>} */
  const rows = [
    [`ok|UnityWndClass|0|100|0|0|0,0,1920,1080|${MON}`, true, 'borderless game'],
    [`ok|Chrome_WidgetWin_1|0|100|0|0|-1,-1,1921,1081|${MON}`, true, 'browser video fullscreen (slightly larger)'],
    [`ok|screenClass|0|100|0|0|1920,0,3840,1080|1920,0,3840,1080`, true, 'slideshow on the second monitor'],
    [`ok|Chrome_WidgetWin_1|0|100|1|1|-8,-8,1928,1088|${MON}`, false, 'maximized with a title bar (auto-hide taskbar)'],
    [`ok|Notepad|0|100|1|0|100,100,900,700|${MON}`, false, 'normal window'],
    [`ok|Chrome_WidgetWin_1|0|100|1|1|-7,-7,1543,823|0,0,1536,864`, false, 'maximized above the taskbar'],
    [`ok|WorkerW|0|100|0|0|0,0,1920,1080|${MON}`, false, 'desktop'],
    [`ok|Progman|0|100|0|0|0,0,1920,1080|${MON}`, false, 'desktop (Progman)'],
    [`ok|Whatever|1|100|0|0|0,0,1920,1080|${MON}`, false, 'shell window'],
    [`ok|Chrome_WidgetWin_1|0|4242|0|0|0,0,1920,1080|${MON}`, false, 'our own window'],
    ['none', false, 'no foreground window'],
    ['err', false, 'helper error'],
    ['', false, 'empty'],
    [`ok|X|0|100|0|0|a,b,c,d|${MON}`, false, 'garbage numbers'],
    [`ok|X|0|100|0|0|0,0,0,0|0,0,0,0`, false, 'empty monitor'],
  ];
  for (const [line, want, why] of rows) assert.equal(isFullscreenLine(line, 4242), want, why);
});

/** A fake PowerShell: answers each stdin line with `reply()`, after printing "ready". */
function fakeSpawn({ reply = () => `ok|Game|0|1|0|0|0,0,1920,1080|${MON}`, silent = false, throwOnSpawn = false } = {}) {
  const calls = { spawns: 0, killed: 0, args: /** @type {any[]} */ ([]) };
  const spawn = /** @type {any} */ ((/** @type {string} */ cmd, /** @type {string[]} */ args, /** @type {any} */ o) => {
    if (throwOnSpawn) throw new Error('ENOENT');
    calls.spawns += 1;
    calls.args.push({ cmd, args, o });
    const p = /** @type {any} */ (new EventEmitter());
    p.stdin = new PassThrough();
    p.stdout = new PassThrough();
    p.stderr = new PassThrough();
    p.kill = () => { calls.killed += 1; };
    if (!silent) {
      setImmediate(() => p.stdout.write('ready\r\n'));
      p.stdin.on('data', (/** @type {Buffer} */ d) => {
        for (const l of String(d).split('\n')) if (l && l !== 'quit') setImmediate(() => p.stdout.write(`${reply()}\r\n`));
      });
    }
    return p;
  });
  return { spawn, calls };
}

test('fullscreen detector: one long-lived hidden process answers every query', async () => {
  const f = fakeSpawn();
  const d = createFullscreenDetector({ platform: 'win32', spawn: f.spawn, selfPid: 999 });
  assert.equal(await d.isFullscreen(), true);
  assert.equal(await d.isFullscreen(), true);
  const [a, b] = await Promise.all([d.isFullscreen(), d.isFullscreen()]); // shared query
  assert.equal(a && b, true);
  assert.equal(f.calls.spawns, 1);
  assert.equal(f.calls.args[0].cmd, 'powershell.exe');
  assert.equal(f.calls.args[0].o.windowsHide, true);
  assert.ok(f.calls.args[0].args.includes('-EncodedCommand'));
  d.stop();
  assert.equal(f.calls.killed, 1);
  assert.equal(await d.isFullscreen(), false); // stopped
});

test('fullscreen detector: other OS, spawn errors and timeouts all mean "not fullscreen"', async () => {
  const mac = fakeSpawn();
  const m = createFullscreenDetector({ platform: 'darwin', spawn: mac.spawn });
  assert.equal(await m.isFullscreen(), false);
  assert.equal(mac.calls.spawns, 0);

  /** @type {string[]} */ const errs = [];
  const broken = fakeSpawn({ throwOnSpawn: true });
  const b = createFullscreenDetector({ platform: 'win32', spawn: broken.spawn, onError: (e) => errs.push(e) });
  assert.equal(await b.isFullscreen(), false);
  assert.match(errs[0], /spawn failed/);

  const silent = fakeSpawn({ silent: true });
  const s = createFullscreenDetector({ platform: 'win32', spawn: silent.spawn, firstTimeoutMs: 20, timeoutMs: 20, onError: (e) => errs.push(e) });
  for (let i = 0; i < 5; i++) assert.equal(await s.isFullscreen(), false);
  assert.equal(silent.calls.spawns, 3); // gives up after 3 failures instead of respawning forever
  assert.ok(errs.some((e) => /giving up/.test(e)));
  s.stop();
});
