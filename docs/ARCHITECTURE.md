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
    windows/               pet-window, terminal-window, chat-window (D-029), debug hooks
  services/pet/            logic.js (needs/energy) + bond.js (XP, levels, caps, streaks) + index.js (M2)
  services/roster/         active Tama, first-run hatch, kero-pet import; lifecycle.js + bundle.js (.tama) (M2)
  services/productivity/   todos, notes, reminders (when.js parser), focus timer, git-watcher.js (M2)
  services/ui/             per-PC UI prefs: terminal theme variant (bond-unlocked), tour flag, dnd, nudges (M4/M5, D-032)
  services/memory/         facts.json + diary/*.md in tamas/<id>/memory (M5, D-033)
  services/events/         triggers.js (pure) + index.js (tick, fire, answers, diary) over assets/events/deck.json (M5, D-033)
  services/google/         index (sign-in state, calendar watch, brief, chat context), api (token refresh), calendar, gmail (no send),
                           drive (+ Docs/Sheets, appData), markdown, tools (+ gate policy), backup (appData + lease) (M6, D-034),
                           maps (pasted Maps links, Google Places lookup, D-039)
  platform/google-oauth.js loopback + PKCE desktop OAuth (M6)
  services/telegram/       api (long polling, uploads), format (pure), remote (/code bridge), commands (the phone's /commands),
                           index (pairing, routing, daily) (M7, D-036)
  services/voice/          her voice: language, pick + tuning, quiet rules (index.js); engines.js = start/stop/catalog of the local
                           engines; emotion.js = mood → style/prosody (pure); vv-engine.js = AivisSpeech/VOICEVOX HTTP (D-042..D-045);
                           chunks.js = sentence split + audio cache for a fast first sound (D-049); text.js = speakable() + the dub cache
  services/usage/          numbers-only usage log (usage/YYYY-MM.jsonl), summaries (M8, D-040); limits.js: what's left,
                           history (usage/limits.jsonl), warnings (D-041)
  engines/claude/limits.js live Claude plan limits without a message + rate-limit event normalizer (D-041)
  services/accounts/       accounts overview + switching (official sign-ins) (M8, D-040)
  engines/accounts.js      claude auth status, agy account from its log, switch scripts (M8)
  platform/power.js        AC/battery + idle/lock → bus (easy energy)
  platform/git.js          read-only git log / user.email
  platform/files.js        whole-file read/write for user-picked paths
  brain/                   M3: index.js (terminal → Claude Code, engine.* requests), chat.js (chat window → agy, chat.*),
                           persona.js (persona + app guide), budget.js, permission-gate.js (SAFE-1)   (D-029)
                           compose.js: one-shot in-character lines + diary via its own agy session (D-033)
  engines/claude/          session (Agent SDK), map-message (pure; text/tool/thinking progress), find-exe, input-queue, oneshot,
                           mcp.js (tool descriptions → in-process MCP server, D-034)
  engines/acp/client.js    generic Agent Client Protocol JSON-RPC client
  engines/agy/             AgyEngine (ACP, plan mode locked), map-update (pure), setup (exe + Tama-owned settings + workspace guard),
                           guard.js (PreToolUse hard lock), mcp-relay.js (stdio MCP → tool bridge) (D-037)
  platform/tool-bridge.js  localhost tool bridge for agent CLIs (random key per run) (D-037)
  brain/chat-tools.js      Google tools for the chat brain with Tama-side confirmations (D-037)
  providers/               provider registry: capability → provider, preference + fallback + opt-in (M12, D-054, D-057)
  channels/desktop/        renderer IPC ↔ bus: index.js (pushes to windows, pet/voice/chat/terminal/productivity IPC),
                           pages.js (usage, Telegram, Google, events, weather, onboarding, My Tamas pages)
  dev/hooks.js             every dev-only TAMA_* switch (open windows, *_EVAL, voice test/trace, perf, quit-after), called once from the bootstrap
  dev/selftest.js          TAMA_SELFTEST live summon check
  dev/onboarding-walk.js   TAMA_ONBOARD_WALK scripted onboarding run with screenshots (M1)
  services/designer/       prompt.js (schemas) + fallback.js (keyword designer) + index.js (M1)
  engines/claude/oneshot.js  tool-less structured call for the designer (D-021)
  platform/windows/page-window.js  framed pages (onboarding, dev gallery)
src/shared/                pure modules for main AND renderer (D-020): palette, catalog, spec, theme (UI tokens + flavor, D-032),
                           rig/{kit,face,hair,headwear,outfit,accessories,compose}
src/preload/index.js       window.tama allow-list
src/renderer/shared/       rig.css (animations + expressions), rig-view.js (renderRig/renderEgg)
src/renderer/onboarding/   hatch / restyle / rebirth flow (M1)
src/renderer/roster/       My Tamas: switch, hatch, graduate, restore, delete, export, import (M2)
src/renderer/pet/          pet.js (state, mood, wandering, boot) + care.js (buttons, panels) + pointer.js (click, drag, pats)
                           + reactions.js (Claude/chat reactions) + voice.js; plain scripts sharing one global scope, loaded in order
src/renderer/terminal/     terminal.js (state, status, input, boot) + format.js (pure: markdown, diffs, tool lines; unit-tested)
                           + permission.js + agent-events.js + local-commands.js (/help /cd /model …) + tama-commands.js
                           (/todo /focus /remind /note /watch /tama …) + connect-commands.js (/phone /google /usage /newpc)
src/renderer/dev/          rig gallery (TAMA_GALLERY=designs|moods)
src/renderer/settings/     Settings window (M10, D-048): one view over ui/voice/telegram/google/weather/brain requests; opens other pages via page:open
```
M5 extras (D-035):
```
src/main/services/weather/        logic.js (pure: WMO code → kind, hot/cold, parsers) + index.js (/weather city in device.json,
                                  Open-Meteo fetch at most every 30 min, quiet failures)
src/main/platform/perf.js         dev performance probe for npm run perf (TAMA_PERF): idle CPU/memory, loop lag, slow callbacks, IPC (D-053)
src/main/platform/crash-log.js    daily error/crash log in <data>/logs (redacted, 7 days) + clean-quit marker (D-050)
src/main/platform/crash-guard.js  uncaught errors → log; crashed renderers reload; helper crashes logged (D-050)
src/main/platform/app-icon.js     app icon = the Tama's face: renders renderer/icon off-screen, applies to tray + windows, caches per Tama (D-047)
src/main/platform/tts-sapi.js     Windows built-in speech (System.Speech via PowerShell) → WAV (D-042)
src/main/platform/voice-engine-process.js  starts/stops the headless AivisSpeech / VOICEVOX engines when a voice needs them; PID files for crash leftovers (D-044, D-045)
src/main/platform/fullscreen.js   fullscreen-foreground check via one hidden long-lived PowerShell + user32 helper (Windows only)
src/main/platform/windows/walk-marker.js  44x44 "out for a walk" edge tab while the pet is hidden (SUM-5)
src/renderer/marker/              the walk tab view (Tama's face; click = summon)
```

### 2.2 Shared code rule
`src/shared/**` must stay pure: no Node or Electron APIs and no DOM, only data in and strings out. Each file uses the
UMD wrapper (`module.exports` in Node, `globalThis.TamaShared.<name>` in the renderer). Renderers load them
with `<script>` tags in dependency order (see `onboarding.html`).

## 3. Dependency rules (enforced by review; lint rule later)

```
renderer  ──IPC──►  channels/desktop  ──►  bus  ◄──  services
                    channels/telegram ──►  bus  ◄──  engines, tools
                                                     platform ◄── anyone in main
```
- `services/*` may import: other services' **public `index.js`**, `bus`, `platform/store`. **Never** `electron`, never `engines/*` directly (they ask the brain via the bus).
- `engines/*` may import: `platform/*`, `bus`, `brain/permission-gate` (type only). Never services, never channels.
- `brain/*` may import `engines/*`, `platform/*`, `bus`. Services and channels reach the brain only via bus topics.
- `providers/` imports only `bus-topics`; provider descriptors are built in `engines/<name>/provider.js` and handed in by the bootstrap.
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
Events: `app.error`, `pet.state.changed`, `pet.bond.changed`, `engine.event`, `chat.event`, `brain.notice`, `ui.prefs.changed`, `memory.changed`, `event.shown`, `google.changed`, `google.meeting.soon`, `telegram.changed`, `usage.{record,changed,limit}`, `accounts.changed`, `summon.done`, `tray.action`, `character.changed`, `device.{power,idle}.changed`, `prod.{changed,focus.phase,reminder.due,commit.seen}`.
Requests: `pet.{get,act,award}`, `roster.{get,switch,hatchNew,graduate,restore,delete,export,import}`, `prod.*`, `character.{get,save}`, `designer.{generate,refine,voice}`, `engine.{info,send,interrupt,clear,setMode,setModel,setEffort,setCwd,answerPermission,resume}`, `chat.{send,history,interrupt,clear,push,confirm}`, `ui.prefs.{get,set}`, `memory.{get,add,forget}`, `diary.{write,list,read}`, `events.{answer,trigger}`, `brain.compose`, `google.{status,setClient,login,logout,set,brief,context,backupNow,backups,restore}`, `telegram.{status,setup,newCode,unpair,set}`, `usage.get`, `usage.limits.{get,refresh,set}`, `voice.{say,render,status,set,detect,encode,preview,info}` + `voice.play` / `voice.changed` / `voice.skipped`, `accounts.{get,switch}`, `brain.{status,set}`, `summon`.
M5 extras (D-035): requests `weather.{get,set}`, `device.fullscreen.get`.
Renderer messages arrive on one `ui` IPC channel: `pet.state`, `pet.bond`, `prod`, `focus`, `reminder`, `commit`, `summon`, `tray`, `agent.event`, `term.focus`, `character`.

## 5. Engine contract

Terminal events reach the bus as `{ engine: 'claude'|'tama', role: 'worker'|'brain', ev }` (D-028/D-029); the agy chat engine's events
are turned into `chat.event`s by `brain/chat.js` and never reach the terminal. Permission requests
are raised by `brain/permission-gate`, not by engines.

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
- **Provider layer (M12, D-054, D-057):** `src/main/providers/` keeps a registry of providers, each declaring capabilities
  (`chat`, `compose`, `json`, `code`), features (`webSearch`, `googleTools`), `available()` and engine factories. `pick(cap)`
  walks the user's order (device.json `providers.order`, default = D-029: chat/compose → agy, json/code → Claude) and skips
  providers that are missing or need an opt-in (`providers.allow`, e.g. `claude:chat`). Providers live next to their engine
  (`engines/claude/provider.js`, `engines/agy/provider.js`) and are wired in the bootstrap; the brain and the designer only see
  the registry. Bus: `providers.get`, `providers.set`, `providers.changed` (the brain rebuilds the persona and restarts chat).
- **All tool approvals** go out as `ev.t = 'permission'` and come back through `brain/PermissionGate`. An engine must not auto-approve on its own.
- `agy`: headless default is `always-proceed` — the engine **must** start it in a mode that requires approval (see DECISIONS).

## 6. Storage

```
%APPDATA%\tama\
  tamas\<tamaId>\ character.json state.json events.json memory\facts.json memory\diary\*.md
  user/productivity.json  todos, notes, reminders, focus (the user's, not a Tama's; D-024)
  device.json      engines, routing, hotkeys, window positions, watched git repos, weather city (this PC only)
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
- Renderer: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP in every HTML file, preload exposes an allow-list.
  IPC is only accepted from file:// frames (`platform/ipc`), and the desktop channel coerces or allow-lists every argument (D-055).
- Windows never navigate away from file://, never open new windows and get no browser permissions (`platform/app` `harden()`, D-055).
  Links go through `link:open` → `platform/shell` (allow-listed https hosts only).
- Untrusted content (mail, Drive files, calendar, Maps places, the `[google]` context line) reaches models labeled as data, never as instructions.
- Logs never contain secrets, tokens, or email bodies (`platform/crash-log` `redact()`: Telegram, Google OAuth/API, Anthropic patterns).

## 8. Character rig (see D-020)
- `CharacterSpec` (JSON) → rig composes layers from `assets/rig/<layer>/<part>.svg` and applies palette via CSS variables.
- Expressions are rig-level (eyes/mouth/brows/effects), so every design gets all expressions.
- Theme tokens (`--tama-primary`, `--tama-accent`, …) are derived from the spec and shared with terminal/onboarding.
