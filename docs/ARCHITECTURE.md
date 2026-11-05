# Tama — Architecture

> The *how*. The *what* lives in [PRD.md](PRD.md); the *why* lives in [DECISIONS.md](DECISIONS.md).
> If code and this doc disagree, fix one of them in the same change.

## 1. Big picture

```
┌──────────────────────── Electron main process = "Core" ────────────────────────┐
│                                                                                │
│   services/            pure-ish domain logic, no Electron imports              │
│     pet/          stats, energy, bond, levels, unlocks                         │
│     events/       triggers → events, deck, cooldowns                           │
│     memory/       facts, diary                                                 │
│     productivity/ todos, focus, reminders, git watcher                         │
│     roster/       tamas, active tama, export/import                            │
│     brain/        router, persona, PermissionGate, budget                      │
│                                                                                │
│   engines/             one folder per AI backend, same interface               │
│     claude/  (Agent SDK)      agy/  (agy CLI subprocess)                       │
│                                                                                │
│   tools/               MCP servers handed to every engine                      │
│     tama/  (pet, todos, memory, reminders)    google/ (gmail, calendar, drive) │
│                                                                                │
│   platform/            the ONLY place that touches Electron / OS               │
│     store/ secrets/ windows/ tray/ hotkeys/ summon/ notify/ power/ ipc/        │
│                                                                                │
│   bus.js               typed in-process event bus  ◄── everything talks here   │
│                                                                                │
│   channels/            clients of the core                                     │
│     desktop/   (pet window + terminal window via IPC)                          │
│     telegram/  (long polling)                                                  │
└────────────────────────────────────────────────────────────────────────────────┘
        ▲ IPC (preload, allow-listed channels only)
┌───────┴────────────── Renderer processes (dumb views) ─────────────────────────┐
│  renderer/pet/   renderer/terminal/   renderer/onboarding/   renderer/shared/  │
│  (rig, theme tokens, UI components — no Node access, no business logic)        │
└────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Directory layout

```
tama/
  AGENTS.md  CLAUDE.md  README.md  package.json
  docs/       PRD.md  ARCHITECTURE.md  DECISIONS.md
  src/
    main/
      index.js              bootstrap: wire services, engines, channels
      bus.js
      services/<name>/      index.js + small modules + <name>.test.js
      engines/<name>/
      tools/<name>/
      platform/<name>/
      channels/<name>/
    preload/index.js
    renderer/{pet,terminal,onboarding,shared}/
  assets/rig/               SVG parts library (by layer)
  assets/events/            event deck JSON
  test/                     cross-module tests, fixtures
```

### 2.1 What exists today (M0)
```
src/main/
  index.js                 bootstrap (wiring only)
  bus.js  bus-topics.js    event bus + topic registry
  platform/
    app.js                 lifecycle, paths (TAMA_DATA_DIR override), single instance
    displays.js            screen adapter: work areas, cursor, display-change events
    ipc.js                 ipcMain wrapper, rejects non-file:// senders
    shell.js               notifications, folder picker, global hotkeys, tray
    store/                 atomic JSON + migrations/ + device.js (single-writer device.json)
    secrets/               safeStorage-encrypted secrets.bin
    summon/                geometry.js (pure) + index.js (summon + watchdog)
    windows/               pet-window, terminal-window, debug hooks
  services/pet/            logic.js (pure stat math) + index.js (tick, persist, react)
  services/roster/         active Tama, first-run hatch, kero-pet import
  engines/index.js         engine host (bus handlers, engine settings in device.json)
  engines/claude/          session (Agent SDK), map-message (pure), find-exe, input-queue
  channels/desktop/        renderer IPC ↔ bus
  dev/selftest.js          TAMA_SELFTEST live summon check
src/preload/index.js       window.tama allow-list
src/renderer/pet|terminal  ported kero-pet views (Kero art until M1)
```

## 3. Dependency rules (enforced by review; lint rule later)

```
renderer  ──IPC──►  channels/desktop  ──►  bus  ◄──  services
                    channels/telegram ──►  bus  ◄──  engines, tools
                                                     platform ◄── anyone in main
```
- `services/*` may import: other services' **public `index.js`**, `bus`, `platform/store`. **Never** `electron`, never `engines/*` directly (they ask the brain via the bus).
- `engines/*` may import: `platform/*`, `bus`. Never services, never channels.
- `channels/*` translate between the outside world and bus messages. No business rules in channels.
- `renderer/*` never imports Node; only `window.tama.*` from preload.
- Only `platform/*` imports `electron`, `fs`, `child_process` for app data. (Engines may spawn their CLI.)

## 4. The bus

In-process pub/sub plus request/response.

```js
bus.emit('pet.stats.changed', { tamaId, stats })          // fire-and-forget event
const res = await bus.request('brain.ask', { text, from })  // request/response
bus.on('engine.event', handler)
```
- Topic names: `<area>.<noun>.<verb-past>` for events, `<area>.<verb>` for requests.
- Every topic + payload shape is listed in `src/main/bus-topics.js` (JSDoc typedefs). Add new topics there first.
- Channels forward a filtered set of topics to renderers / Telegram.

### Topics in use (M0)
Events: `app.error`, `pet.state.changed`, `engine.event`, `summon.done`, `tray.action`.
Requests: `pet.get`, `pet.act`, `roster.get`, `engine.{info,send,interrupt,clear,setMode,setModel,setCwd,answerPermission,resume}`, `summon`.
Renderer messages arrive on one `ui` IPC channel: `pet.state`, `summon`, `tray`, `agent.event`, `term.focus`.

## 5. Engine contract

```js
/** @interface Engine */
start(opts: { cwd, mode, model, resumeId? }): Promise<void>
send(text: string): void
interrupt(): void
setMode(mode: 'default'|'accept-edits'|'plan'): void
setModel(model: string|null): void
stop(): void
// emits on bus 'engine.event' with { engine, sessionId, ev } where ev.t ∈
// 'status'|'text-delta'|'text'|'tool'|'tool-result'|'permission'|'todo'|'result'|'error'|'session'
```
- **All tool approvals** go out as `ev.t = 'permission'` and come back through `brain/PermissionGate`. An engine must not auto-approve on its own.
- `agy`: headless default is `always-proceed` — the engine **must** start it in a mode that requires approval (see DECISIONS).

## 6. Storage

```
%APPDATA%\tama\
  tamas\<tamaId>\ character.json state.json events.json memory\facts.json memory\diary\*.md
  device.json      engines, routing, hotkeys, window positions (this PC only)
  secrets.bin      safeStorage-encrypted (Telegram token, Google tokens)
  active.json      { activeTamaId }
  logs\
```
- Read/write only through `platform/store` (atomic write: tmp file + rename; debounced saves).
- Every file has `schemaVersion`; migrations live in `platform/store/migrations/<file>/<n>.js` and are forward-only.
- `secrets` is a separate module with `get/set/delete` only. No other code reads `secrets.bin`.

## 7. Security model
- Engines: approval-required by default; PermissionGate is the single authority; per-channel policy (remote/Telegram = stricter).
- Telegram: one paired chat ID; everything else dropped and logged.
- Google: minimal scopes; no delete/share tools; edits to existing files need approval.
- Renderer: `contextIsolation: true`, `nodeIntegration: false`, CSP in every HTML file, preload exposes an allow-list.
- Logs never contain secrets, tokens, or email bodies.

## 8. Character rig
- `CharacterSpec` (JSON) → rig composes layers from `assets/rig/<layer>/<part>.svg` and applies palette via CSS variables.
- Expressions are rig-level (eyes/mouth/brows/effects), so every design gets all expressions.
- Theme tokens (`--tama-primary`, `--tama-accent`, …) are derived from the spec and shared with terminal/onboarding.
