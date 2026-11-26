// Tama Companion, background (MUS-10, D-066): one WebSocket to the Tama app on this PC (127.0.0.1 only), paired once
// with the code Tama shows (/music pair). Forwards the controlled YouTube Music tab's state to Tama and Tama's commands
// to that tab. Never contacts any other server.
const PORTS = [47821, 47822, 47823, 47824, 47825];
const PING_MS = 20000; // traffic keeps the service worker alive (Chrome 116+)

/** @type {WebSocket|null} */ let ws = null;
let status = 'searching'; // searching | needs-code | connected | denied
let connecting = false;
let pingTimer = 0;
/** tabId → { port, state, seen } */
const tabs = new Map();
/** cmd id → tabId */
const waitingCmd = new Map();
/** @type {((r: any) => void) | null} */ let pairReply = null;

const store = {
  get: () => chrome.storage.local.get(['key', 'port']),
  set: (o) => chrome.storage.local.set(o),
  clear: () => chrome.storage.local.remove(['key', 'port']),
};

/** The tab Tama controls: the playing one, else the one seen most recently. */
function controlled() {
  let best = null;
  for (const [id, t] of tabs) {
    if (!best || (t.state && t.state.playing && !(best.t.state && best.t.state.playing)) || (!!(t.state && t.state.playing) === !!(best.t.state && best.t.state.playing) && t.seen > best.t.seen)) best = { id, t };
  }
  return best;
}

function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }

function sendState() {
  if (status !== 'connected') return;
  const c = controlled();
  send({ t: 'state', tabs: tabs.size, state: c ? c.t.state : null });
}

/** Tama went away (restart, quit): look again after 2 s, 5 s, 10 s, then every 30 s (the alarm). */
let retryStep = 0;
let retryTimer = 0;
function retrySoon() {
  clearTimeout(retryTimer);
  const delay = [2000, 5000, 10000][retryStep];
  if (delay === undefined) return;
  retryStep += 1;
  retryTimer = setTimeout(async () => { await connect(); if (status !== 'connected') retrySoon(); }, delay);
}

/** Try each port until a Tama answers hello. */
async function connect() {
  if (connecting || (ws && ws.readyState <= WebSocket.OPEN)) return;
  connecting = true;
  const saved = await store.get();
  const order = saved.port ? [saved.port, ...PORTS.filter((p) => p !== saved.port)] : PORTS;
  for (const port of order) {
    const ok = await tryPort(port, saved.key);
    if (ok) break;
  }
  connecting = false;
}

/** @param {number} port @param {string|null} key @param {string|null} [code] @param {boolean} [ask] one-click pairing (D-070) */
function tryPort(port, key, code, ask) {
  return new Promise((resolve) => {
    let sock;
    try { sock = new WebSocket(`ws://127.0.0.1:${port}/`); } catch (e) { resolve(false); return; }
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => { try { sock.close(); } catch (e) { /* closed */ } done(false); }, 3000);
    sock.onopen = () => sock.send(JSON.stringify({ t: 'hello', v: 1, app: 'tama-companion', ext: chrome.runtime.getManifest().version, key: key || undefined, code: code || undefined, ask: ask || undefined }));
    sock.onerror = () => { clearTimeout(timer); done(false); };
    sock.onclose = () => {
      clearTimeout(timer);
      if (ws === sock) { ws = null; clearInterval(pingTimer); if (status === 'connected') { status = 'searching'; retrySoon(); } }
      done(false);
    };
    sock.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!settled) {
        clearTimeout(timer);
        if (m.t === 'waiting') {
          // Tama asks the user on the desktop: keep the line open until they answer (or 70 s).
          status = 'waiting';
          setTimeout(() => { if (!settled) { try { sock.close(); } catch (e) { /* closed */ } } }, 70000);
          return;
        }
        if (m.t === 'welcome' || m.t === 'paired') {
          ws = sock; status = 'connected'; retryStep = 0; clearTimeout(retryTimer);
          if (m.t === 'paired') store.set({ key: m.key, port });
          else store.set({ port });
          clearInterval(pingTimer);
          pingTimer = setInterval(() => send({ t: 'ping' }), PING_MS);
          for (const t of tabs.values()) { try { t.port.postMessage({ t: 'resend' }); } catch (e) { /* gone */ } }
          if (pairReply) { pairReply({ ok: true }); pairReply = null; }
          done(true);
        } else if (m.t === 'need-code' || m.t === 'denied') {
          // A Tama is here but doesn't know us (yet): remember the port, wait for a code from the popup.
          status = m.t === 'denied' && code ? 'denied' : 'needs-code';
          if (m.t === 'denied' && key) store.set({ key: null, port });
          else store.set({ port });
          if (pairReply) { pairReply({ ok: false, error: m.reason || 'That code did not work.' }); pairReply = null; }
          try { sock.close(); } catch (e) { /* closed */ }
          done(true); // stop scanning: this is the Tama
        } else done(false);
        return;
      }
      onTama(m);
    };
  });
}

/** Messages from Tama after the handshake. */
function onTama(m) {
  if (m.t === 'cmd') {
    const c = controlled();
    if (!c) { send({ t: 'result', id: m.id, ok: false, error: 'No YouTube Music tab is open.' }); return; }
    waitingCmd.set(m.id, c.id);
    try { c.t.port.postMessage({ t: 'cmd', id: m.id, action: m.action, value: m.value }); } catch (e) {
      waitingCmd.delete(m.id);
      send({ t: 'result', id: m.id, ok: false, error: 'The tab went away.' });
    }
  } else if (m.t === 'open-new') {
    // Tama asks for a new YouTube Music tab (no tab open yet).
    if (typeof m.url === 'string' && /^https:\/\/music\.youtube\.com\//.test(m.url)) chrome.tabs.create({ url: m.url });
  } else if (m.t === 'unpaired') {
    store.clear(); status = 'needs-code';
    try { ws && ws.close(); } catch (e) { /* closed */ }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ytm' || !port.sender || !port.sender.tab) return;
  const id = port.sender.tab.id;
  tabs.set(id, { port, state: null, seen: Date.now() });
  port.onMessage.addListener((m) => {
    const t = tabs.get(id);
    if (!t) return;
    if (m.t === 'state') { t.state = m.state; t.seen = Date.now(); if (status === 'searching') connect(); else sendState(); }
    else if (m.t === 'result') {
      if (waitingCmd.get(m.id) === id) { waitingCmd.delete(m.id); const { t: _t, ...rest } = m; send({ t: 'result', ...rest }); }
    }
  });
  port.onDisconnect.addListener(() => { tabs.delete(id); sendState(); });
  connect();
});

// Popup: status, pair with a code, forget the pairing.
chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.t === 'status') { reply({ status, tabs: tabs.size, playing: !!(controlled() && controlled().t.state && controlled().t.state.title) }); return; }
  if (m.t === 'pair') {
    const code = String(m.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (!code) { reply({ ok: false, error: 'Type the code Tama shows.' }); return; }
    (async () => {
      try { ws && ws.close(); } catch (e) { /* closed */ }
      ws = null;
      pairReply = reply;
      const saved = await store.get();
      const order = saved.port ? [saved.port, ...PORTS.filter((p) => p !== saved.port)] : PORTS;
      for (const port of order) if (await tryPort(port, null, code)) break;
      if (pairReply) { pairReply({ ok: false, error: 'Tama is not running on this PC.' }); pairReply = null; }
    })();
    return true; // async reply
  }
  if (m.t === 'connect') {
    (async () => {
      try { ws && ws.close(); } catch (e) { /* closed */ }
      ws = null;
      pairReply = reply;
      const saved = await store.get();
      const order = saved.port ? [saved.port, ...PORTS.filter((p) => p !== saved.port)] : PORTS;
      for (const port of order) if (await tryPort(port, null, null, true)) break;
      if (status === 'waiting') status = 'needs-code';
      if (pairReply) { pairReply({ ok: false, error: 'Tama is not running on this PC.' }); pairReply = null; }
    })();
    return true; // async reply
  }
  if (m.t === 'unpair') {
    send({ t: 'bye' });
    store.clear(); status = 'needs-code';
    try { ws && ws.close(); } catch (e) { /* closed */ }
    reply({ ok: true });
  }
  return undefined;
});

chrome.alarms.create('tama-reconnect', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'tama-reconnect' && status !== 'needs-code') connect(); });
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
