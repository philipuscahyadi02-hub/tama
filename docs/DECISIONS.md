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
| D-007 | `agy` headless must never run `always-proceed` | Accepted |
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
- **Date:** 2026-11-05 · **Status:** Accepted
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
