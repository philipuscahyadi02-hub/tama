# Tama — Decision Log

> **Scope: the Tama repo only.** Decisions here apply to this repository; never log Tama decisions elsewhere or other projects' decisions here.
>
> **Every AI coding session reads this file before changing code, and appends to it when a key decision is made.**
> Append-only: never rewrite history. To change a decision, add a new entry that says
> `Supersedes D-00X`, and mark the old one's status `Superseded by D-00Y`.

## What counts as a "key decision"?
Log it if any of these is true:
- It picks between real alternatives (library, protocol, data format, provider, UX pattern).
- It's hard or costly to reverse (storage format, IPC/bus contract, engine interface, permissions model).
- It changes or adds a rule in AGENTS.md / ARCHITECTURE.md, or a requirement in PRD.md.
- It's a workaround for a bug/limitation someone will otherwise "fix" later.
- The user stated a preference that should hold in future sessions.

Don't log: routine refactors, naming, bug fixes with no design impact.

## Entry template
```md
### D-XXX — <short title>
- **Date:** YYYY-MM-DD · **Status:** Accepted | Superseded by D-YYY | Revisit at <milestone>
- **Context:** what problem / question
- **Decision:** what we chose
- **Alternatives:** what we didn't choose and why (1 line each)
- **Consequences:** what this implies for code / users
- **Refs:** PRD IDs, files, links
```

## Index
| ID | Title | Status |
|---|---|---|
| D-001 | New repo `tama`, built from kero-pet | Accepted |
| D-002 | Chibi anime style only; parameterized SVG rig | Accepted |
| D-003 | Lite brain: Gemini Flash via `agy`, fallback Haiku via Claude login | Accepted |
| D-004 | Built-in TTS first | Accepted (M1–M7); M8 voice in D-022 |
| D-005 | Plain JavaScript + JSDoc + `// @ts-check`, no build step | Revisit at M3 |
| D-006 | Engines run official CLIs/SDKs with their own logins; never reuse OAuth tokens | Accepted |
| D-007 | `agy` headless must never run `always-proceed` | Superseded by D-026 |
| D-008 | Telegram via long polling, no server | Accepted |
| D-009 | Google via user's own Desktop OAuth client, Production (unverified) status | Accepted |
| D-010 | Google scopes: minimal; Drive via `drive.file` + optional `drive.readonly` + `drive.appdata` | Accepted |
| D-011 | Storage split: soul / device / secrets, with schemaVersion migrations | Accepted |
| D-012 | Gmail sending | Superseded by D-014 |
| D-013 | Docs: PRD + ARCHITECTURE + DECISIONS, AGENTS.md as the shared rulebook | Accepted |
| D-014 | Gmail: drafts only, no send tool | Accepted |
| D-015 | Versioning, CHANGELOG with commit table, repo-scoped decision log | Accepted |
| D-016 | First run imports the kero-pet save as the first Tama | Accepted |
| D-017 | Pet stats live in the main-process pet service from M0 | Accepted |
| D-018 | Type-check config for TypeScript 7 on plain JS | Accepted |
| D-019 | Summon = show + raise + place on cursor's display; watchdog respects user-hide | Accepted |
| D-020 | Character rig: shared pure modules, slot-based SVG parts, palette CSS variables | Accepted |
| D-021 | M1 designer: Claude Haiku with tools disabled + JSON schema, keyword fallback | Revisit at M3 |
| D-022 | M8 voice: AivisSpeech local engine (anime voices), built-in TTS fallback | Accepted |
| D-023 | Pet balance v2: easy energy, open-ended bond XP with levels, daily caps, streaks | Accepted |
| D-024 | Productivity data is the user's (user/), git watch is per PC (device.json) | Accepted |
| D-025 | Roster lifecycle via relaunch; .tama = gzip JSON, AES-256-GCM + scrypt when password-protected | Accepted |
| D-026 | agy via ACP with Tama-owned settings; lite brain sandboxed; agy coding only in git repos | Superseded by D-027 (worker part) |
| D-027 | agy runs only read-only (plan mode): chat brain + review/plan worker; all edits via Claude Code | Accepted · Supersedes D-026 · worker part superseded by D-029; its "plan mode is enough" premise superseded by D-037 (hard guard) |
| D-028 | Brain: lite chat brain with [[ESCALATE]] hand-off, status line, budget fallback, designer stays on Haiku | Partly superseded by D-029 (routing) |
| D-029 | Two surfaces: terminal = Claude Code only, chat window = agy only (with web search) | Accepted · Supersedes D-028 routing |
| D-030 | M3 ships as 0.3.1; milestone = minor resumes with M4 = 0.4.0 | Accepted |
| D-031 | Claude Code sessions stream summarized thinking + tool-input progress; `/effort` per PC | Accepted |
| D-032 | UI theme from the CharacterSpec (shared/theme.js); terminal variants unlocked by bond; UI prefs in device.json | Accepted |
| D-033 | Events & memory: deck JSON + pure triggers, agy composer, hidden [[remember]] markers, facts + diary in the Tama's folder | Accepted |
| D-034 | Google: own OAuth client (loopback+PKCE), plain-fetch APIs, MCP tools for Claude Code with a gate policy, read-only context for chat, appData backups | Accepted |
| D-035 | M5 extras: Open-Meteo weather per PC, fullscreen DND via one hidden PowerShell helper, "out for a walk" edge marker | Accepted |
| D-036 | Telegram: long polling, one-time-code pairing to one chat, chat → agy, /code → shared Claude session in allow-listed folders with inline permission buttons | Accepted |
| D-037 | Chat brain does Google itself: MCP relay → local bridge, Tama-side confirmations, and a hard PreToolUse guard (plan mode is only advisory) | Accepted · Supersedes D-027 ("plan mode = no side effects") |

---

### D-001 — New repo `tama`, built from kero-pet
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** kero-pet (Electron + Claude Agent SDK + SVG pet + Claude-Code-style terminal) works but has everything in a few large files and a hard-coded character.
- **Decision:** New repo at `Documents/Random/tama`, fresh git history. Port code from kero-pet module by module into the new layout; kero-pet stays untouched.
- **Alternatives:** v2 inside kero-pet (would drag along the hard-coded Kero identity and history).
- **Consequences:** Keep a "ported from kero-pet" note at the top of ported modules for traceability.
- **Refs:** ARCHITECTURE §2

### D-002 — Chibi anime style only; parameterized SVG rig
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** The user wants to design the character from a prompt, but every design must animate and express emotions well.
- **Decision:** Chibi anime only. Layered SVG parts library; the model selects + recolors parts into a `CharacterSpec`. No image generation for the body.
- **Alternatives:** Non-human creatures (more art, user declined); image-gen sprites (inconsistent, can't animate expressions).
- **Consequences:** Quality depends on the parts library; invest in parts in M1.
- **Refs:** ART-1..3

### D-003 — Lite brain: Gemini Flash via `agy`, fallback Haiku via Claude login
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** Chatter/events/diary are frequent and shouldn't burn Claude tokens. User first chose Claude login over Ollama, then asked to use Antigravity to save Claude tokens.
- **Decision:** Lite brain prefers `agy` with `gemini-3.8-flash-*`; falls back to Haiku through the Claude Agent SDK. No Ollama.
- **Alternatives:** Ollama local (big download, weaker); Haiku only (spends Claude quota).
- **Consequences:** `agy` cold start ≈4 s → keep a persistent `--input-format stream-json` process for the lite brain.
- **Refs:** BRAIN-2, ENG-2

### D-004 — Built-in TTS first
- **Date:** 2026-11-05 · **Status:** Accepted
- **Decision:** v1 voice uses Windows / Web Speech TTS; the `VoiceSpec` maps to voice + pitch + rate. Premium providers behind the `VoiceProvider` interface later.
- **Refs:** VOICE-1, VOICE-3

### D-005 — Plain JavaScript + JSDoc + `// @ts-check`, no build step
- **Date:** 2026-11-05 · **Status:** Revisit at M3
- **Context:** kero-pet is plain CommonJS JS with no build step; we want types for good architecture without slowing iteration.
- **Decision:** JS (CommonJS in main, plain scripts in renderer), `// @ts-check` + JSDoc types on all module boundaries, `tsc --noEmit --checkJs` as the type check.
- **Alternatives:** Full TypeScript (build step + Electron packaging complexity now).
- **Consequences:** If boundary typedefs get painful in M3 (engines/bus), revisit and log a superseding decision.

### D-006 — Engines run official CLIs/SDKs with their own logins
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** User wants to use Antigravity's quota. Third-party reuse of Antigravity OAuth tokens has led to account bans.
- **Decision:** Tama spawns `agy` / uses the Claude Agent SDK; each keeps its own login. Tama never reads, copies, or proxies their tokens.
- **Refs:** ENG-5

### D-007 — `agy` headless must never run `always-proceed`
- **Date:** 2026-11-05 · **Status:** Superseded by D-026
- **Context:** Tested `agy` 1.4.12: `-p --output-format stream-json` reports `"permission_mode":"always-proceed"` in its init event.
- **Decision:** `AgyEngine` must start in an approval-requiring mode (or `plan` + read-only tools) and route approvals through PermissionGate. Add a startup assertion: if the init event says `always-proceed`, abort the session.
- **Consequences:** M3 task: discover how `agy` surfaces permission requests in stream-json and how to answer them.
- **Refs:** ENG-3, SAFE-1

### D-008 — Telegram via long polling, no server
- **Date:** 2026-11-05 · **Status:** Accepted
- **Decision:** `getUpdates` long polling from the PC; one paired chat ID; bot token in secrets.
- **Alternatives:** Webhook (needs public URL/hosting); Telegram Mini App (needs hosting).
- **Consequences:** Bot is offline when the PC is off/asleep.
- **Refs:** TG-1, TG-2, SAFE-3

### D-009 — Google via user's own Desktop OAuth client, Production (unverified)
- **Date:** 2026-11-05 · **Status:** Accepted
- **Decision:** Loopback + PKCE desktop flow with the user's own Cloud project. Publishing status "In production" (unverified) to avoid Testing's 7-day refresh-token expiry; user clicks through the unverified warning once.
- **Refs:** GOOG-1

### D-010 — Google scopes minimal
- **Date:** 2026-11-05 · **Status:** Accepted
- **Decision:** Calendar events read/write; Gmail read + compose (drafts); Drive `drive.file` (create/edit own files) + optional `drive.readonly` toggle + `drive.appdata` for backups. No delete/share tools. All created files in "Tama Drafts" folder.
- **Refs:** GOOG-3..7, PORT-6

### D-011 — Storage split with schemaVersion migrations
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** User wants to change characters and move the Tama to another PC.
- **Decision:** `tamas/<id>/` (portable soul) vs `device.json` (this PC) vs `secrets.bin` (safeStorage, device-bound). Every file carries `schemaVersion`; forward-only migrations.
- **Consequences:** Export = zip of `tamas/<id>/` (+ optional password-encrypted connections). Never put device or secret data inside a tama folder.
- **Refs:** PORT-1..5, ARCHITECTURE §6

### D-012 — Gmail sending
- **Date:** 2026-11-05 · **Status:** Superseded by D-014
- **Context:** Asked the user; not yet answered.
- **Decision:** Until answered, only `gmail_create_draft` exists; no send tool.
- **Refs:** GOOG-4, PRD Q1

### D-013 — Docs and rulebook structure
- **Date:** 2026-11-05 · **Status:** Accepted
- **Decision:** `docs/PRD.md` (what), `docs/ARCHITECTURE.md` (how), `docs/DECISIONS.md` (why, append-only). `AGENTS.md` is the single rulebook for every AI tool; `CLAUDE.md` imports it with `@AGENTS.md` so Claude Code and `agy` follow the same rules.
- **Refs:** AGENTS.md

### D-014 — Gmail: drafts only, no send tool
- **Date:** 2026-11-05 · **Status:** Accepted · Supersedes D-012
- **Context:** User answered PRD Q1.
- **Decision:** The Google MCP server exposes `gmail_create_draft` only. No send tool exists in any engine or channel; the user sends from Gmail themselves.
- **Alternatives:** Send after explicit approval (declined by user).
- **Consequences:** Telegram/desktop replies link to the draft. Adding sending later needs a new decision.
- **Refs:** GOOG-4, PRD Q1

### D-015 — Versioning, CHANGELOG with commit table, repo-scoped decision log
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** User wants a per-version record of changes including which commit made them, and wants decision logging locked to this repo.
- **Decision:** SemVer with milestone = minor (M0 → 0.1.0 …), fixes = patch, 1.0.0 = all P0 done; release = tag `vX.Y.Z`. `CHANGELOG.md` has hand-written sections per version plus a generated commit table (`npm run changelog`, from `git log` grouped by tags). The `log-decision` skill and DECISIONS.md are scoped to this repo only (the skill checks the git root).
- **Alternatives:** Hand-written hashes (drift, a commit can't contain its own hash); git hooks (not shared by clones).
- **Consequences:** The generated table lags one commit until the next run; release steps are in CHANGELOG.md.
- **Refs:** CHANGELOG.md, scripts/changelog.js, .claude/skills/log-decision

### D-016 — First run imports the kero-pet save as the first Tama
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** The user already has a Kero-chan with bond/xp in kero-pet (`%APPDATA%\Kero-chan` or `\kero-pet`).
- **Decision:** When no Tama exists, the roster creates one with the built-in `kero` preset and copies the newest kero-pet `pet-state.json` (read-only, never modified) as its state; `character.json` records `importedFrom: "kero-pet"`. Later runs never re-import.
- **Alternatives:** Always start fresh (loses bond); keep reading kero-pet's file live (couples the apps).
- **Consequences:** M1 onboarding must offer to restyle/rebirth this imported Tama instead of forcing a new hatch. `TAMA_NO_LEGACY=1` disables the import for tests.
- **Refs:** PORT-1, src/main/services/roster

### D-017 — Pet stats live in the main-process pet service from M0
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** kero-pet computed decay and actions inside the pet renderer. Telegram (M7) and other channels need the same state.
- **Decision:** Ported the stat math unchanged into `services/pet/logic.js` (pure) + `services/pet/index.js` (ticks every 5 s, saves every 10 s, listens to engine results). The renderer is a read-only copy: it calls `tama.act()` and picks lines/animations from the returned `reason`.
- **Alternatives:** Keep the logic in the renderer until M2 (would break AGENTS rule 3 and need a second rewrite).
- **Consequences:** Balance changes (PET-3/4) only touch `logic.js` + its table tests.
- **Refs:** PET-1, PET-5, ARCHITECTURE §3

### D-018 — Type-check config for TypeScript 7 on plain JS
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** TS 7 removed `moduleResolution: node`; `jsconfig.json` also type-checks JS inside node_modules by default.
- **Decision:** `module`/`moduleResolution: node16`, `maxNodeModuleJsDepth: 0`, `strict` with `noImplicitAny: false`. Cross-file class types are exported as JSDoc typedefs (e.g. `BusInstance`), because `import('x').Class` doesn't resolve for CommonJS object exports. `store.read` returns untyped JSON (`any`); callers annotate.
- **Alternatives:** Pin TypeScript 5 (ages badly); full TS build (D-005).
- **Refs:** jsconfig.json, D-005

### D-019 — Summon semantics and watchdog
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** Root causes of kero-pet's broken "bring back": no vertical/any drag clamp, reset only moved the window (never re-showed or re-raised it), tray click opened the terminal, saved positions not checked against current monitors.
- **Decision:** All moves go through `geometry.clampToScreen` (the 170x204 body must be fully inside one work area) using `setBounds` with a fixed size (mixed-DPI safety). `summon()` clears user-hide, restores, places the pet on the cursor's display, `showInactive()` (doesn't steal focus), re-asserts `screen-saver` always-on-top + `moveTop`. A watchdog (every 30 s, on display changes, resume and unlock) fixes off-screen or lost-topmost, but leaves a pet the user hid via "Show / Hide" alone. Triggers: Ctrl+Alt+P, tray left-click, tray menu, `/summon`, second launch.
- **Alternatives:** Re-show on every watchdog tick (would fight the user's Hide).
- **Consequences:** If the body rect changes with the M1 rig, update `geometry.BODY`. Real mixed-DPI hardware test still pending (NFR-2).
- **Refs:** SUM-1..4, NFR-2, src/main/platform/summon, src/main/dev/selftest.js

### D-020 — Character rig: shared pure modules, slot-based SVG parts, palette CSS variables
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** M1 needs prompt-designed characters that keep every expression and animation from kero-pet (D-002, ART-1..3).
- **Decision:** `src/shared/` holds pure, dependency-free modules (palette, catalog, spec, rig/*) that run in Node (tests, validation) and in renderers via plain `<script>` (each file registers on `globalThis.TamaShared`). Parts return SVG fragments per **slot** (`kit.SLOTS`), composed in a fixed order inside shared `bodyGroup`/`headGroup` groups on Kero-chan's skeleton, so hit areas and animations work for every design. Colors are `style="fill:var(--token)"`; 6 base colors derive ~30 tokens (`palette.derive`), and presets may pin exact tokens (`paletteOverrides`). Gradient ids are prefixed per rig. Expression visibility stays in CSS (`renderer/shared/rig.css`). `character.json` v2 = full CharacterSpec + meta (`stage`, `createdAt`, `importedFrom`).
- **Alternatives:** Per-character hand-drawn SVG (no prompt design); image generation (inconsistent, no expressions).
- **Consequences:** New part = draw it in `src/shared/rig/*` + list it in `catalog.js` (+ gallery check with `TAMA_GALLERY=designs`). `normalizeSpec` is the only way a spec enters the system.
- **Refs:** ART-1..3, ONB-3, src/shared, src/renderer/shared

### D-021 — M1 designer: Claude Haiku with tools disabled + JSON schema, keyword fallback
- **Date:** 2026-11-05 · **Status:** Revisit at M3
- **Context:** D-003 makes `agy` the lite brain, but `agy`'s headless mode auto-approves tools (D-007) and its permission handling is M3 research. M1 still needs a model to design characters.
- **Decision:** `engines/claude/oneshot.askJson` runs the Agent SDK with `tools: []`, `settingSources: []`, `persistSession: false`, model `haiku`, and `outputFormat: json_schema` whose part fields are catalog **enums**. Output always goes through `normalizeSpec`. If the call fails (offline, not logged in, timeout), `services/designer/fallback.js` designs from keywords, and the UI shows a warning. `TAMA_OFFLINE_DESIGNER=1` forces the fallback.
- **Alternatives:** `agy` now (unsafe until D-007 is solved); no AI at all (designs too samey).
- **Consequences:** About 26 s and a few cents of Claude usage per "hatch ideas" call. M3 moves this onto the router's lite brain (Gemini Flash via `agy`).
- **Refs:** ONB-3..6, D-003, D-007

### D-022 — M8 voice: AivisSpeech local engine (anime voices), built-in TTS fallback
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** The user wants a free anime-style voice. ElevenLabs is a monthly subscription (about $22/month for Tama's likely usage). Free anime voice engines (VOICEVOX, AivisSpeech, Style-Bert-VITS2) are Japanese-focused; Kokoro has good English but isn't anime-styled.
- **Decision:** M8's main voice provider is **AivisSpeech**: free, runs locally on CPU, anime voice models, called through its local HTTP engine (no internet). Built-in Windows/Web Speech stays as the fallback when AivisSpeech isn't installed or running. Only voice models whose license allows our use are offered, and any required credit is shown in an About screen.
- **Alternatives:** ElevenLabs (paid monthly, stays a possible optional add-on); VOICEVOX (similar, per-character credit terms); Kokoro (English, not anime; possible English fallback if needed).
- **Consequences:** M8 must first test how AivisSpeech handles English text. If English sounds bad, use AivisSpeech for Japanese interjections and the fallback for English sentences. VoiceSpec gains an `engine` + `speakerId`, and the voice prompt maps to the closest AivisSpeech model/style.
- **Refs:** VOICE-1, VOICE-3, D-004

### D-023 — Pet balance v2: easy energy, open-ended bond XP with levels, daily caps, streaks
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** Requirement: easier energy than kero-pet, and productivity should grow the bond (PET-3/4, BOND-1..3). kero-pet decayed fast and its bond was a 0..100 bar.
- **Decision:**
  - Awake decay per hour: hunger 6, mood 4, clean 3, energy 3 (was 8/6/4/5).
  - Energy refills: snack +25 (20-min cooldown); 10-min power nap +50; bedtime sleep +25/h; auto-nap while the PC is idle ≥10 min or locked +30/h; +12/h while charging on AC; while the app is closed she "rests": +10/h energy, other needs at half speed (cap 48 h). A finished agent task costs only 1 energy.
  - Bond is open-ended `bondXp` with levels Stranger 0 · Acquaintance 60 · Buddy 240 · Partner 600 · Soulmate 1200. XP per source with a daily cap: full XP up to the cap, 25% up to 2× the cap, then 0. Productive sources (agent, commit, focus, todo, calendar) keep a daily streak: +1/day, +5 on day 7, +15 on day 30.
  - Migration: old bond × 12 (old 100 = Soulmate).
- **Alternatives:** Keep 0..100 bond (no room for long-term growth); unlimited XP (farmable).
- **Consequences:** Balance numbers live only in `services/pet/logic.js` + `bond.js` with table tests. Power and idle signals come from `platform/power.js` over the bus.
- **Refs:** PET-1..4, BOND-1..3, src/main/services/pet

### D-024 — Productivity data is the user's (user/), git watch is per PC (device.json)
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** Todos, notes, reminders and the focus timer (PROD-1) must survive switching or graduating a Tama, and be shared by desktop and Telegram. Watched git repos (PROD-2) are local folder paths.
- **Decision:** Productivity lives in `user/productivity.json` (store kind `productivity`), separate from any `tamas/<id>/`. Watched repos and the last-seen commit per repo live in `device.json` (`gitWatch`), because paths only exist on this PC. The watcher is read-only (`git log`, `git config user.email`), records a baseline on first sight, and only counts commits whose author email matches the repo's `user.email`. `focus-break` is a core-only pet action; the desktop channel accepts only an allow-list of user care actions.
- **Alternatives:** Per-Tama todos (lost on switch); global git hook (needs writing into the user's repos).
- **Consequences:** `.tama` export (M2c) may optionally include `user/`. The Telegram bot (M7) reuses the same `prod.*` bus requests.
- **Refs:** PROD-1, PROD-2, BOND-1, src/main/services/productivity

### D-025 — Roster lifecycle via relaunch; .tama = gzip JSON, AES-256-GCM + scrypt when password-protected
- **Date:** 2026-11-05 · **Status:** Accepted
- **Context:** PORT-3..5 and ONB-9: several Tamas, switch / hatch another / graduate / delete, and moving a Tama to another PC.
- **Decision:**
  - **Switching** writes `active.json` and **relaunches the app**, so every service starts cleanly for the new Tama. "At home" Tamas are paused: switching to one sets its `lastSeen = now`, so no decay is counted.
  - **Graduate** sets `graduatedAt` (album, restorable); graduating the active Tama hatches a new egg first. **Delete** is permanent, needs the exact name typed, and never applies to the active Tama.
  - **`.tama` file:** `"TAMA"` + version + flags + gzip'd JSON bundle of `tamas/<id>/` files (+ optional `user/`, + optional `telegram.*` secrets only when password-protected). With a password: scrypt (N=2^15) → AES-256-GCM (authenticated, so tampering is detected).
  - **Import** always creates a new id (never overwrites), validates every file name (no `..`, no absolute paths, only .json/.md/.txt), and runs everything through the normal migrations and `normalizeSpec`. The desktop channel only imports the path the user picked in the OS dialog.
- **Alternatives:** Hot-swap services without relaunch (more code paths, more bugs); a zip library (extra dependency; one bundle file is enough).
- **Consequences:** PRD PORT-5 says "zip"; the file is a single gzip'd bundle instead (same user-facing result). Drive backup (PORT-6, M6) can upload the same `.tama` bytes.
- **Refs:** PORT-3..5, ONB-9, src/main/services/roster/{lifecycle,bundle}.js

### D-026 — agy via ACP with Tama-owned settings; lite brain sandboxed; agy coding only in git repos
- **Date:** 2026-11-05 · **Status:** Superseded by D-027 (worker part; ACP + Tama-owned settings still apply) · Supersedes D-007
- **Context:** M3 research on `agy` 1.5.1 (probes kept in `scripts/agy-permission-probe.js`):
  - The user's own `~/.gemini/antigravity-cli/settings.json` has `toolPermission: always-proceed` + `agentMode: accept-edits`, so headless/ACP `agy` normally asks for nothing.
  - `agy acp` (Agent Client Protocol over stdio) sends real `session/request_permission` requests for **shell commands** when `toolPermission` is `request-review`; rejecting them really blocks them.
  - `agy acp --cli_dir_name tama-acp` reads settings from `~/.gemini/antigravity-cli/tama-acp/settings.json` while keeping the user's login. Verified: same command auto-ran with the user's settings, and asked with Tama's.
  - Valid values: `toolPermission` ∈ {request-review, always-proceed, agent-decides}; `agentMode` ∈ {accept-edits, plan} (unset = default). An invalid value makes agy ignore the file.
  - **Writes inside the session's working folder are never gated** (even when the client offers `fs/write_text_file`); writes outside it are blocked by agy.
- **Decision:**
  - `AgyEngine` speaks ACP to `agy acp --cli_dir_name tama-acp`. On every start Tama (re)writes that file to exactly `{"toolPermission": "request-review"}`. The user's own agy settings are never modified.
  - Every `session/request_permission` goes through `brain/PermissionGate`.
  - **Lite brain** (chat, events, diary) runs agy in an empty Tama-owned folder (`<data>/agy-workspace`) with policy **deny-all tools**.
  - **agy coding work** (user's choice, 2026-11-05): only when the working folder is a **git repo**. The UI warns that agy edits files without per-edit approval, shows a changed-files summary (`git status`) after each task, and shell commands still need the user's ✅.
- **Alternatives:** agy chat/plan only (safer, more Claude tokens); a per-task confirmation; print mode with `--settings` (no way to answer permission requests).
- **Consequences:** After every agy update, re-run `npm run probe:agy` to check these guarantees still hold. Login stays with agy (D-006).
- **Refs:** ENG-2, ENG-3, SAFE-1, BRAIN-2

### D-027 — agy runs only read-only (plan mode): chat brain + review/plan worker; all edits via Claude Code
- **Date:** 2026-11-06 · **Status:** Accepted · Supersedes D-026 (worker part) · Its `@agy` / budget-fallback worker and git-status check are superseded by D-029 (agy is chat-only); read-only plan mode still applies
- **Context:** `npm run probe:agy` (now a repo script) showed that D-026's assumption was wrong: in agy's default mode, **file writes are never gated, anywhere on disk** (outside the working folder too, also with `--sandbox`). Shell commands are gated. In **plan** mode, agy ran no command and wrote no file, inside or outside. The user re-decided with the corrected facts.
- **Decision:**
  - Every agy session runs in **plan mode, locked** (`lockMode`): the chat brain and the `@agy` / budget-fallback worker ("review & plan"). agy reviews, explains and proposes plans; real edits always go through Claude Code, which asks per edit.
  - Defense in depth: before an agy turn in a git repo Tama snapshots `git status`, and warns if new changes appear after the turn.
  - ACP + Tama-owned settings (`--cli_dir_name tama-acp`, `toolPermission: request-review`) stay as in D-026.
- **Alternatives:** Full agy worker in git repos (D-026; unsafe: writes anywhere); opt-in full worker (user declined).
- **Consequences:** BRAIN-4's budget fallback means "agy reviews/plans while Claude rests", not "agy edits". `npm run probe:agy` must PASS (plan mode has no side effects; commands gated) after every agy update.
- **Refs:** ENG-2, ENG-3, BRAIN-4, SAFE-1, scripts/agy-permission-probe.js

### D-028 — Brain: lite chat brain with [[ESCALATE]] hand-off, status line, budget fallback, designer stays on Haiku
- **Date:** 2026-11-06 · **Status:** Partly superseded by D-029 (routing, hand-off, agy fallback worker; status line, budget tracking, quests and designer still apply)
- **Context:** BRAIN-1..5: cheap everyday chat, real work to a coding agent, editable routing, budget awareness, persona.
- **Decision:**
  - `src/main/brain/` (may import `engines/`; services talk to it only over the bus) owns all engines, answers the terminal's `engine.*` requests, and emits `engine.event` as `{ engine, role: 'worker'|'lite'|'brain', ev }`.
  - **Routing:** `/x` → coding agent; `@claude/@agy/@code/@chat` one-offs; `/auto` (default: lite brain answers and hands off), `/chat`, `/code`.
  - **Lite brain:** agy Gemini Flash (plan mode, scratch folder `<data>/agy-workspace`, persona via ACP `_meta.antigravity.systemPrompt.append`); falls back to Claude Haiku (no tools, no settings, not saved) when agy isn't available or fails.
  - **Hand-off:** the persona instructs the model to reply `[[ESCALATE]] <task>` for real work. The brain holds back the streamed text until it knows whether the reply starts with the marker; if it does, the marker is never shown and the user's **original** message goes to the coding agent.
  - **Status line:** every lite message starts with `[status] …` (pet stats, bond, streak, todos, focus, local time) so the persona reacts to the day.
  - **Budget:** daily usage in `device.json` (Claude ≈USD from the SDK, turns, agy tokens). Claude is "tight" at ≥90% of `dailyClaudeUsd` (default $10, `/budget`) or for 1 h after a usage-limit error. A warning at 75%. In `auto`, tight → agy review/plan (D-027).
  - **Quests:** only `role: worker` results count for pet XP; chat does not.
  - **Designer** (D-021) stays on Claude Haiku: it needs strict JSON-schema output, which agy's ACP doesn't offer.
  - Dev: a run with `TAMA_DATA_DIR` also gets its own Electron profile, so tests never clash with the user's running Tama.
- **Alternatives:** A classifier call before every message (slower, costs twice); always-Claude (no savings).
- **Consequences:** M4's terminal badges and chat/code toggle build on `role`/`engine`. Telegram (M7) sends `engine.send` the same way.
- **Refs:** BRAIN-1..5, ENG-1, ENG-4, ENG-5, SAFE-5, ONB-7, src/main/brain

### D-029 — Two surfaces: terminal = Claude Code only, chat window = agy only (with web search)
- **Date:** 2026-11-06 · **Status:** Accepted · Supersedes D-028 (routing, `[[ESCALATE]]` hand-off, `@agy` / budget-fallback worker)
- **Context:** The user found the mixed terminal (♡ chat brain, ● Claude, ◆ agy, auto hand-off) hard to understand. Their model: "productivity and code = Claude; chatting and googling with Tama = agy/Gemini".
- **Decision:**
  - **Terminal = Claude Code only.** Every message (and every unknown `/command`) goes to Claude Code. Tama's local commands (`/todo`, `/focus`, `/cd`, …) still run locally. No routing modes, no `@` prefixes, no agy worker. When Claude is over budget, the terminal only warns; it never switches engine.
  - **Chat window = agy only** (`brain/chat.js`, `platform/windows/chat-window.js`, `renderer/chat/`): Gemini Flash in read-only plan mode (D-027) with its `search_web` tool, the persona + `[status]` line, and a short built-in guide to the app so she can explain how to use the terminal. No Claude fallback: without agy the chat says how to install it. Replies also show in the pet's speech bubble. Opened from the pet menu 💬, the tray or **Ctrl+Alt+J**. Themed from the CharacterSpec palette (`--tama-*` tokens).
  - Bus: `chat.send`, `chat.history`, `chat.interrupt`, `chat.clear` requests and `chat.event`. History is kept in memory (long-term memory is M5). Telegram (M7) will use `chat.*` for talking and `engine.*` for work.
- **Alternatives:** Keep auto-routing (confusing; the user asked to separate); a Haiku fallback for chat (spends Claude tokens; the user wants chat on agy only).
- **Consequences:** PRD BRAIN-1/3/4 and TERM-3 change meaning; new CHAT-1. agy-only chat means no chat if agy is missing or logged out.
- **Refs:** BRAIN-1..5, CHAT-1, ENG-2, ENG-3, TERM-3, D-027, src/main/brain/{index,chat}.js

### D-030 — M3 ships as 0.3.1; milestone = minor resumes with M4 = 0.4.0
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** D-015 maps each milestone to a minor version (M3 → 0.4.0). The user asked to release M3 (with the D-029 split) as v0.3.1.
- **Decision:** Tag M3 as `v0.3.1`. M4 is `0.4.0`, M5 `0.5.0`, and so on, as in D-015.
- **Consequences:** CHANGELOG has `[0.3.1]` for M3; the generated commit table follows the tags as usual.
- **Refs:** D-015, CHANGELOG.md

### D-031 — Claude Code sessions stream summarized thinking + tool-input progress; `/effort` per PC
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** Traced a "very slow" terminal answer: Claude Code (Opus, adaptive thinking) thought for about 65 s, then streamed an 18k-token Write for about 80 s, and the terminal showed nothing but a spinner. Native Claude Code shows progress. In Tama, thinking arrived with its text omitted, and tool input that was still streaming was not forwarded.
- **Decision:** Worker sessions pass `thinking: { type: 'adaptive', display: 'summarized' }`. `map-message` emits `thinking-progress` and `tool-progress` (with the file name) every 1,500 characters. The terminal spinner shows "Thinking… 3.0k chars" or "Writing index.html… 15.1k chars", the elapsed time and the model. New `/effort low|medium|high|xhigh|max|default` (SDK `effort`, live via `applyFlagSettings`), saved in `device.json` `engine.effort`; it's shown in the status bar.
- **Alternatives:** Disable thinking (worse results); pick a faster default model for the user (their choice: `/model`, `/effort`).
- **Consequences:** More IPC traffic during long turns (throttled). The status bar and help mention `/model` and `/effort` as the speed controls.
- **Refs:** TERM-1, src/main/engines/claude/{session,map-message}.js

### D-032 — UI theme from the CharacterSpec (shared/theme.js); terminal variants unlocked by bond; UI prefs in device.json
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** M4 (ART-4, TERM-2, BOND-3): the terminal was hard-coded to Kero-chan (title, frog avatar, pink/green colors, "Kero-ing" spinner words, permission text). Every Tama should get her own look, and a better bond should unlock something visible.
- **Decision:**
  - `src/shared/theme.js` (pure UMD, D-020) turns a CharacterSpec into `--tama-*` tokens for the terminal (`terminalVars`), the chat window (`chatVars`) and the pet menu (`petVars`), plus flavor text (`flavor`: "<Name> Code", subtitle from the motif, spinner verbs from the name/tics/catchphrases, prompt caret from personality).
  - Accent colors are the two most colorful base colors; every text/accent token is pushed until it reaches WCAG contrast 4.5 on its background (dim text 3.2). Table-tested with extreme palettes.
  - Terminal variants: **night** (always), **day** (Acquaintance), **pastel** (Partner), **neon** (Soulmate). Chosen with `/theme`; locked ones show 🔒 and the level needed; a level-up that unlocks one is announced.
  - `services/ui` keeps per-PC UI preferences in `device.json` `ui` (`termTheme`, `tourDone`) behind `ui.prefs.get/set` and emits `ui.prefs.changed`. A look is a device preference, not part of the portable soul.
  - Terminal CSS uses only `--tama-*` tokens (AGENTS §3). The title-bar avatar is the real rig and reacts live (focus while working, shock on permission, sparkle when done, dizzy on error; click = summon).
- **Alternatives:** Per-Tama theme stored in the soul (moving PCs would carry a display preference); hand-picked palettes per preset (doesn't scale to prompt-designed Tamas).
- **Consequences:** New UI surfaces take their colors from `theme.js`. More unlocks (outfits, events, voice lines) come in M5/M8 (BOND-3 stays ◐).
- **Refs:** ART-4, TERM-1..4, BOND-3, SAFE-4, src/shared/theme.js, src/main/services/ui

### D-033 — Events & memory: deck JSON + pure triggers, agy composer, hidden [[remember]] markers, facts + diary in the Tama's folder
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** M5 (EVT-1..4, PET-6/7, NFR-4): the Tama should start little moments on her own, remember things about the user, and keep a diary, without spending Claude tokens or nagging.
- **Decision:**
  - **Deck as data:** `assets/events/deck.json` (shipped via `build.files`). Each event has a trigger (time [+ weekday/weekend], lateNight, absence, stat, streak, date, birthday = hatch anniversary, random, memory, diary, active minutes, levelUp), `cooldownH`, `minBond`, a `seed` for the chat brain, fallback `lines`, and optional `choices` (2–3, bond XP, optional `remember`) or a `quest` (button that runs a pet action or a wellbeing nudge).
  - **Triggers are pure** (`services/events/triggers.js`): deck order = priority; a 40-minute gap between non-nudge events; one open event at a time (expires after 5 minutes); `chance` is per hour (ticks every minute).
  - **Quiet (PET-6):** no pop-ups during a focus session, `/dnd`, while the user is idle/away, while she sleeps, or while she's an egg. The diary is still written quietly. Nudges (PET-7: water, stretch) can be turned off with `/nudges`.
  - **Lines (EVT-3):** `brain/compose.js` asks agy (read-only plan mode, its own session, restarted every 15 turns) for one in-character line from the seed; for choice/quest events the seed lists the button labels so the line matches them. On failure or after 40 s, the deck's fallback line is used. No Claude tokens.
  - **Events appear** in a pet event box with answer buttons ("later" dismisses), in the chat history (`chat.push`), and as a Windows notification if the pet is hidden. Answers award bond (`event`/`nudge` sources with small daily caps) and may store a memory.
  - **Memory (EVT-4, NFR-4):** `tamas/<id>/memory/facts.json` (max 100, deduped). The chat brain adds facts by ending a reply with `[[remember: …]]`; a streaming filter hides markers, even when they arrive split across chunks. Memories reach the agy session as a `[memory]` line when they change. `/memory`, `/remember`, `/forget <n|all>`. Local only; travels with `.tama` exports.
  - **Diary:** once per evening (from 21:00) the composer writes a 60–120-word entry from real facts (stats, finished todos, what the user said, today's moments) into `tamas/<id>/memory/diary/YYYY-MM-DD.md`; `/diary [date|list]`.
- **Alternatives:** Hard-coded event code (not data-driven, AGENTS rule 12); LLM-generated choices (buttons could not be trusted to map to effects); a separate memory model call per message (slower, costs more).
- **Consequences:** Weather (needs a location) and fullscreen/meeting detection are not done yet (EVT-1/PET-6 ◐; meetings come with Calendar in M6). New events = a deck entry plus a test row. Telegram (M7) will relay `event.shown` and `events.answer`.
- **Refs:** EVT-1..4, PET-6, PET-7, NFR-4, BOND-3, assets/events/deck.json, src/main/services/{events,memory}, src/main/brain/compose.js

### D-034 — Google: own OAuth client (loopback+PKCE), plain-fetch APIs, MCP tools for Claude Code with a gate policy, read-only context for chat, appData backups
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** M6 (GOOG-1..8, PORT-6..8): Gmail (drafts only, D-014), Calendar, Drive/Docs/Sheets, Drive backup, without a server and without reusing anyone's tokens (D-006, D-009, D-010).
- **Decision:**
  - **Sign-in:** `platform/google-oauth.js` runs the desktop flow: loopback redirect on `127.0.0.1:<random port>`, PKCE S256, `state` check, `access_type=offline` + `prompt=consent`. The user's own Desktop OAuth client (id + secret) and the tokens are stored only in `platform/secrets`. A guided setup page (`renderer/google/`, tray "Google…", `/google setup`) walks through creating the client and publishing it to Production (D-009).
  - **Scopes:** `calendar.events`, `gmail.readonly`, `gmail.compose`, `drive.file`, `drive.appdata`; `drive.readonly` only when the user turns on "read all of Drive" (then signs in again). Google Tasks (PROD-3) is not requested yet.
  - **APIs:** plain `fetch` wrappers (`services/google/{api,calendar,gmail,drive,markdown}.js`), with no googleapis dependency. Access tokens refresh automatically, with one retry on 401. Calendar events are created with `sendUpdates=none` and no attendees, so Tama never sends invitations. Gmail has no send function. Drive has no delete or share function, except pruning Tama's own hidden backups in appData. New Docs (Markdown → HTML conversion) and Sheets (USER_ENTERED, so formulas work) go into a "Tama Drafts" folder that is created once.
  - **Tools for the coding agent (GOOG-2):** `services/google/tools.js` describes 13 tools; `engines/claude/mcp.js` turns them into an in-process MCP server (`mcp__google__*`) passed to Claude Code sessions while signed in. zod (the SDK's peer dependency, now listed in package.json and unpacked with the SDK) builds the schemas. Mail/file/calendar content is returned as `UNTRUSTED …` data (AGENTS §4).
  - **Policy (GOOG-7):** `PermissionGate.addRule`: Google reads and creations (drafts, new Docs/Sheets/events) are auto-allowed and announced; edits to existing items (`calendar_update_event`, `docs_append`, `sheets_write_range`, `sheets_append_rows`) ask the user. Rules never apply to the chat brain.
  - **Chat (agy) gets no Google tools:** agy stays read-only (D-027) and can't use in-process MCP. Instead the chat gets a cached `[google]` context line (today's events, important unread mail, todos) and tells the user to ask the terminal for drafts, docs and changes. This is a deliberate deviation from "plugged into every engine" (GOOG-2).
  - **Calendar watch (GOOG-3):** every minute: a sleeve-tug bubble + Windows notification 5 minutes before an event; `status.inMeeting` while one is running, which the events service treats as quiet time (PET-6).
  - **Morning brief (GOOG-8):** once a day between 07:00 and 12:00 (bubble + chat history) and on demand (`/brief`).
  - **Backup (PORT-6):** about once a day, the active Tama's `.tama` bytes (same as a manual export, including `user/`) go to the hidden appDataFolder; the newest 7 per Tama are kept. `/google backups`, `/google restore <n>` (always imported as a new Tama). After sign-in on a PC that lacks some backed-up Tamas, she offers a restore.
  - **Lease (PORT-7):** a 5-minute heartbeat file per Tama in appData. If another PC was active in the last 15 minutes, Tama warns once. It is a warning, not a hard lock (◐).
  - **New PC (PORT-8):** `/newpc` checklist.
- **Alternatives:** googleapis npm (large dependency); a Google MCP server process per engine (more moving parts; agy plan mode can't use tools anyway); a hosted OAuth proxy (needs a server, breaks D-008/D-009 spirit).
- **Consequences:** The live sign-in can only be tested with the user's own client; everything else is tested against a fake Google. Docs "replace section" (GOOG-6) and Google Tasks (PROD-3) remain open.
- **Refs:** GOOG-1..8, PORT-6..8, D-006, D-009, D-010, D-014, D-027, src/main/services/google, src/main/platform/google-oauth.js, src/main/engines/claude/mcp.js
### D-035 — M5 extras: Open-Meteo weather per PC, fullscreen DND via one hidden PowerShell helper, "out for a walk" edge marker
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** M5 left three items open (D-033): weather events (EVT-1), quiet time during fullscreen apps (PET-6) and the "out for a walk" marker (SUM-5).
- **Decision:**
  - **Weather (EVT-1):** `services/weather` uses Open-Meteo (no API key, no account). `/weather <city>` geocodes once (`geocoding-api.open-meteo.com`, first match) and stores `{ city, lat, lon }` in `device.json` `weather` (a location is per PC, never in the soul). `/weather` shows the current weather, `/weather off` clears it. Current weather (`temperature_2m, weather_code, is_day`) is fetched at most every 30 minutes and only while a location is set; concurrent callers share one request; a reading older than 3 h is dropped. Failures only emit `app.error` and never retry before 30 minutes. `logic.js` maps WMO codes to `clear|cloudy|rain|snow|storm` plus `hot` (≥30 °C) and `cold` (≤3 °C). Bus: `weather.get`, `weather.set`.
  - **Weather events:** a pure `weather` trigger (`is: [...]` of those kinds or `hot`/`cold`, optional `hours` window) and four deck events (thunderstorm, rainy day, hot day with a water quest, cold/snow), 12 h cooldown. No location or no network = no weather events. The chat status line includes the weather in a few words (`statusLine(pet, prod, weather)` stays pure).
  - **Fullscreen DND (PET-6):** `platform/fullscreen.js` keeps one hidden PowerShell process (spawned lazily with `windowsHide`, script passed with `-EncodedCommand`) that compiles a tiny user32 helper once and answers one line per stdin query (~1 s startup, then ~1 ms per query). The foreground window counts as fullscreen when its rect covers its whole monitor, it is not the desktop/shell/taskbar or one of Tama's own windows, and it is not a maximized window with a title bar. The events service asks `device.fullscreen.get` once per tick and treats `true` as quiet. Non-Windows, spawn errors, timeouts or odd output mean "not fullscreen"; after 3 failures the helper gives up for the run. Stopped on quit.
  - **Walk marker (SUM-5):** while the user has hidden the pet (Show / Hide), `platform/windows/walk-marker.js` shows a 44x44 frameless, always-on-top, non-focusable tab with the Tama's face (`renderer/marker/`, colors from `theme.chatVars`), docked at the right edge of the primary work area (`geometry.markerPosition`, `setBounds` with a fixed size, D-019). Clicking it runs the normal `summon()`; showing the pet hides the tab. `/marker on|off` (device `ui.walkMarker`, default on). Desktop-only.
- **Alternatives:** OpenWeatherMap and similar (need an API key); IP-based location (imprecise, sends the IP to another service); a native addon or `ffi` for user32 (new native dependency); spawning PowerShell per query (about 1 s and a console flash risk each minute); `SHQueryUserNotificationState` (misses borderless games and browser video).
- **Consequences:** Weather events only appear after the user sets a city. A maximized window without a title bar, on a monitor with an auto-hide taskbar, can read as fullscreen (it also hides the pet's moments, which is acceptable). Meetings (calendar) as quiet time arrive with M6. Telegram (M7) can reuse `weather.*`; the walk marker has no Telegram equivalent.
- **Refs:** EVT-1, PET-6, SUM-5, D-019, D-033, src/main/services/weather, src/main/platform/fullscreen.js, src/main/platform/windows/walk-marker.js, src/renderer/marker, assets/events/deck.json

### D-036 — Telegram: long polling, one-time-code pairing to one chat, chat → agy, /code → shared Claude session in allow-listed folders with inline permission buttons
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** M7 (TG-1..8, SAFE-3, ART-5): talk to the Tama and give Claude Code work from the phone, with no server (D-008) and stricter rules for remote sessions (AGENTS §4).
- **Decision:**
  - **Transport:** `services/telegram/api.js` uses plain `fetch` `getUpdates` long polling (50 s) from the PC, with exponential backoff, `retry_after`, and a full stop on 401/404. The bot token is redacted from every error. There is no webhook and no extra dependency (multipart uses Node's FormData/Blob).
  - **Pairing (TG-2, SAFE-3):** `/phone setup <token>` checks the token with `getMe`, then shows a deep link `t.me/<bot>?start=<code>` and the 6-character one-time code (valid 15 minutes). The first private chat that sends the code becomes the only paired chat (`telegram.chatId` in secrets). Every other chat and button press is ignored and counted. `/phone code` makes a new code; `/phone unpair` forgets the chat.
  - **Routing:** plain text → the chat brain (`chat.send`, prefixed 📱 so the desktop chat shows where it came from), and the bot replies with the next Tama message. Commands: `/status` (stats + a PNG of how she looks right now, ART-5: `pet-window.snapshot()` via capturePage), `/feed /snack /nap /summon`, `/todo /todos /done /focus /remind`, `/brief`, `/code /stop /repos /cd /remote`.
  - **Remote coding (TG-6/7):** `/code` uses the **same** Claude Code session as the terminal (one conversation, visible on the desktop). It only runs when the current folder is on the allow-list, and the allow-list is only editable on the PC (`/phone allow here`). Each remote turn switches the session to `default` mode (ask before every tool). Permission prompts become inline Yes / Always / No buttons, answered on the phone or the desktop, whichever comes first; the message is then edited to show the outcome. Progress is one message edited every 3 s. The result text comes with `git diff` (read-only) as `changes.diff`. `/stop` interrupts. `/remote off` (phone) or `/phone remote off` (PC) is the kill switch. Every remote action is announced in the terminal and the pet bubble.
  - **Hand-off button (user feedback, same day):** plain phone messages that ask for real work (code, Google drafts/Docs/Sheets/calendar) make the chat brain add a hidden `[[work: <task>]]` marker; the bot shows a "💻 Let Claude do it" button that runs it as `/code` (one use, last 20 kept). The terminal still never auto-escalates (D-029); this is an explicit tap.
  - **Tama's desk:** `<data>/desk`, an empty folder that is always allowed. If the current folder isn't allow-listed, a remote task moves there (announced), so Google tasks and questions work from the phone without exposing any project. Projects still need `/phone allow here` on the PC.
  - **Daily:** a morning brief (Google brief if connected, else todos) after 08:00, and an evening recap after 21:30 (tonight's diary page), once a day each.
  - **TG-8:** the bot's short description is set to "awake" on start and "sleeping" on quit (best effort). `/phone awake on` keeps the PC from sleeping (`powerSaveBlocker`).
- **Alternatives:** A separate remote Claude session (would hide remote work from the desktop and duplicate context); allowing any folder (too risky from a phone); QR code pairing (needs a QR encoder dependency; the deep link + code covers the same need).
- **Consequences:** The bot only answers while the PC is on and Tama runs. Voice notes are M8 (TG-3 voice part). Telegram secrets travel in `.tama` exports only when password-protected (D-025).
- **Refs:** TG-1..8, SAFE-3, ART-5, D-008, D-025, D-029, src/main/services/telegram, src/main/platform/{git,power}.js, src/main/platform/windows/pet-window.js

### D-037 — Chat brain does Google itself: MCP relay → local bridge, Tama-side confirmations, and a hard PreToolUse guard (plan mode is only advisory)
- **Date:** 2026-11-06 · **Status:** Accepted · Supersedes D-027's premise that plan mode alone is a safe lock; supersedes D-034's "chat gets no Google tools"
- **Context:** The user found it redundant that Google tasks from the chat/phone were handed to Claude. Probes (now in `npm run probe:agy`) showed:
  - agy accepts MCP servers in ACP `session/new` (stdio only) and calls their tools in plan mode. It never asks permission for MCP tools.
  - **Plan mode is advisory, not a lock.** With a persuasive system prompt ("act directly, don't plan"), agy in plan mode wrote files inside and outside its folder without asking; commands stayed gated. The old probe only used polite prompts.
  - agy runs `PreToolUse` hooks from `<working folder>/.agent/hooks.json` (not from the Tama-owned settings folder). A `deny` decision hard-blocks the tool before any permission step; a failing hook also blocks (fail-closed). It runs the command through cmd.exe with escaped quotes and not from the hooks.json folder, so the launcher path must be absolute and space-free.
  - `permissions.deny` in settings.json had no effect on file writes.
- **Decision:**
  - **Hard guard:** every Tama agy session gets `<its scratch folder>/.agent/hooks.json` → `guard.cmd` (Electron in node mode) → `engines/agy/guard.js`, which allows only `^(mcp_tama_…|search_web|read_url_content)$` for chat and **nothing** for the events/diary composer (its own session now). Plan mode stays on as a second layer. The guard is only ever written into Tama's own folders.
  - **Google for the chat brain:** `platform/tool-bridge.js` serves the Google tools on 127.0.0.1 with a random per-run key; agy starts `engines/agy/mcp-relay.js` (stdio MCP) which forwards to it, so tokens never leave Tama. Tools appear while Google is signed in; the chat session restarts when that flips.
  - **Confirmations live in Tama** (`brain/chat-tools.js`): reads run; every create/edit waits for a tap ("✅ Yes, do it") in the chat window, or on Telegram when the message came from the phone; no answer in 5 minutes = no. Still no send/delete/share tools. The chat persona tells Gemini to act with its tools instead of handing Google tasks to Claude; the 💻 hand-off button remains for code.
- **Alternatives:** Gemini CLI with its tool allow-list (needs another install/login; agy works); agy default mode (writes ungated); Tama-only HTTP MCP (agy declares no HTTP MCP support).
- **Consequences:** `npm run probe:agy` now also checks "pushy prompt + guard = no writes/commands" and "guard + Tama tools = tool works". If a future agy changes hook loading, the probe fails and the chat must not be used until fixed. Google use from chat costs agy/Gemini quota instead of Claude.
- **Refs:** GOOG-2, GOOG-7, BRAIN-2, ENG-3, TG-3, D-014, D-027, D-029, D-034, src/main/engines/agy/{guard,mcp-relay,setup}.js, src/main/platform/tool-bridge.js, src/main/brain/chat-tools.js
