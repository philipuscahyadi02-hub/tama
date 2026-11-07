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
| D-014 | Gmail: drafts only, no send tool | Superseded by D-038 |
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
| D-038 | Sending allowed after the user confirms the full draft/invitation (only Tama's own drafts; never automatic) | Accepted · Supersedes D-014 |
| D-039 | Event places: resolve pasted Maps links; otherwise look the place up and ask the user to confirm it before creating the event | Accepted |
| D-040 | M8 = usage & accounts dashboard (voice → M9): numbers-only usage log, plan limits, account switching via official sign-ins | Accepted |
| D-041 | Limits tab: Claude windows from the SDK (live /usage without a message + per-turn events), Gemini tier + quota-hit only, Google counts vs user cap | Accepted |
| D-042 | Voice: AivisSpeech/VOICEVOX HTTP for Japanese lines, Windows SAPI (via PowerShell) for English; audio plays in the pet window; Telegram voice notes as M4A; calm-idle animation bursts | Accepted · engine choice superseded by D-043 |
| D-043 | Voice language setting: English (Windows voice) / Japanese dub (Gemini translates in character, AivisSpeech reads) / off; tray Voice menu + `/voice en\|ja\|off` | Accepted · Supersedes D-042 (engine choice) |
| D-044 | Headless AivisSpeech Engine (GPU) started by Tama only while Japanese dub is on; stopped on switch/quit; crash leftovers cleaned via a PID file | Accepted |
| D-045 | Voice page: VOICEVOX added (headless engine, 44 licensed TTS characters), per-Tama voice pick + tuning, mood-matched styles from the dub's feeling tag; no cloning of real people's voices | Accepted |
| D-046 | Voice page readability: English labels from assets/voice/names.json (kana → romaji fallback); separate ▶ listen and ✓ use per style; off-screen test windows | Accepted |
| D-047 | App icon = the active Tama's face (rendered off-screen, cached per Tama, re-rendered on restyle); tray menu grouped into submenus | Accepted |
| D-048 | M10 = settings & polish: one Settings window over the existing services, reply language in the persona, quiet hours as scheduled DND | Accepted |
| D-049 | Faster Japanese voice: the chat reply carries its own dub (`[[ja: …]]` while the Japanese voice is on), sentence-by-sentence synthesis, audio cache | Accepted · Refines D-043 |
| D-050 | Reliability: window rescue from unplugged monitors; crash log + clean-quit marker + renderer reload | Accepted |
| D-051 | Roadmap: M11 = quality control; M12 = installers (Windows + macOS) with modular capabilities instead of a portable exe | Accepted |
| D-052 | Architecture rules enforced by `scripts/arch-check.js` in `npm run check`; engines get public index.js files; shared day helpers in `src/main/day.js` | Accepted |
| D-053 | `npm run perf` measures idle cost the same way every time; mood/sleep effects rest between alive bursts; shorter, rarer bursts | Accepted · Refines D-042 (calm idle) |
| D-054 | M12 provider layer: features ask for capabilities, providers register what they can do, per-capability preference with fallback; D-029's split stays the default | Accepted · Refines D-029 (routing becomes a default, not a hard-wire) |
| D-055 | Security pass: no navigation, new windows or browser permissions; every IPC input coerced; more secret patterns redacted; Maps and [google] context marked untrusted | Accepted |
| D-056 | M12 shipping = v1.0.0; v2 = Tama's own agentic brain over official model APIs (own keys or local models), not a single provider's SDK | Accepted · Refines D-015 (what 1.0.0 means) |
| D-057 | Provider layer built: registry + per-engine descriptors; Claude chats as Haiku without tools, only after an opt-in (choosing it counts); Settings → Brains | Accepted · Implements D-054 |
| D-058 | Release v1.0.0 now (M11 + provider layer), before the installer; the rest of M12 ships as 1.x; unsigned builds accepted | Accepted · Refines D-056 (what v1.0.0 contains), D-051 (signing) |
| D-059 | Installer = NSIS per-user (uninstaller asks about data); setup wizard runs the vendors' official one-line installers visibly and re-detects tools without a restart | Accepted |
| D-060 | v2 positioning: "the work buddy who grows when you ship"; USP-1..6 (work → bond loop, day plan + stand-up, undo, shareable character, body-doubling, voice input) join the v2 roadmap | Accepted |
| D-061 | 1.x "Voice & hands": push-to-talk Ctrl+Alt+Space, local Whisper, safe PC actions (play music, media keys, open URL/app); API-key models (AGT-2) deferred for cost | Accepted (plan) |

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
- **Date:** 2026-11-05 · **Status:** Superseded by D-038 (user decision 2026-11-06) · Supersedes D-012
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
  - **Confirmations live in Tama** (`brain/chat-tools.js`): reads run; every create/edit waits for a tap ("✅ Yes, do it") in the chat window, or on Telegram when the message came from the phone; no answer in 2.5 minutes = no (agy itself abandons MCP calls after 3 minutes). Still no send/delete/share tools. The chat persona tells Gemini to act with its tools instead of handing Google tasks to Claude; the 💻 hand-off button remains for code.
- **Alternatives:** Gemini CLI with its tool allow-list (needs another install/login; agy works); agy default mode (writes ungated); Tama-only HTTP MCP (agy declares no HTTP MCP support).
- **Consequences:** `npm run probe:agy` now also checks "pushy prompt + guard = no writes/commands" and "guard + Tama tools = tool works". If a future agy changes hook loading, the probe fails and the chat must not be used until fixed. Google use from chat costs agy/Gemini quota instead of Claude.
- **Refs:** GOOG-2, GOOG-7, BRAIN-2, ENG-3, TG-3, D-014, D-027, D-029, D-034, src/main/engines/agy/{guard,mcp-relay,setup}.js, src/main/platform/tool-bridge.js, src/main/brain/chat-tools.js

### D-038 — Sending allowed after the user confirms the full draft/invitation (only Tama's own drafts; never automatic)
- **Date:** 2026-11-06 · **Status:** Accepted · Supersedes D-014 (drafts only)
- **Context:** The user asked to remove "never send to other people" and replace it with: Tama drafts, shows the draft to the user, and sends after the user confirms it from the chat (desktop or Telegram). Trigger: inviting a friend to tennis from the phone.
- **Decision:**
  - New tool `gmail_send_draft` (policy **send**): it only sends drafts Tama itself created (`device.json` `google.tamaDrafts`, newest 200), never other drafts in the mailbox. Before sending, the user sees the **full** email (To/Cc/Bcc/Subject/body) and taps "✅ Send it" (chat window card or Telegram buttons). No answer or "Don't send" = nothing is sent.
  - `gmail_create_draft` is policy **draft**: it runs without a tap (a draft only sits in the user's Gmail) and is announced.
  - `calendar_create_event` takes optional `attendees`; with guests it is policy **send** (`sendUpdates=all`, Google emails the invitations), and the confirm card says so explicitly. Without guests it stays **create**.
  - Policies are computed per call (`policyFor`). Claude Code (PermissionGate rule): **send** and **edit** always ask; read/draft/create auto + announced. Chat brain (chat-tools): **create/edit/send** ask. There is no mode that sends without a tap. Still no delete/share tools.
  - Scopes are unchanged (`gmail.compose` already covers sending drafts).
- **Alternatives:** Keep drafts only (the user explicitly declined); let the model send directly after a "yes" in text (a free-text "yes" is easier to fake via prompt injection than a button on the exact content).
- **Consequences:** Prompt injection from an untrusted email could try to make the chat brain send mail; the confirm card always shows the real recipient and body, so the user is the final check. PRD GOOG-4 changes; AGENTS §4 updated.
- **Refs:** GOOG-3, GOOG-4, GOOG-7, D-014, D-034, D-037, src/main/services/google/{gmail,calendar,tools}.js, src/main/brain/chat-tools.js

### D-039 — Event places: resolve pasted Maps links; otherwise look the place up and ask the user to confirm it before creating the event
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** The user wants Tama to double-check a typed location against Google Maps before invitations go out, and to use a pasted Google Maps link directly.
- **Decision:**
  - `services/google/maps.js`:
    - **`maps_resolve_link`** follows a pasted Maps link (including `maps.app.goo.gl`) only through Google hosts, and reads the place name and pin coordinates. The place is used directly; the user's own link is kept.
    - **`maps_find_place`** uses Google Places API (New) Text Search when the user sets an optional Maps Platform key (`/google maps-key`, stored in secrets), biased to the weather city (D-035).
    - Without a key it returns a Google Maps search link plus the city, and the chat brain finds the official name and address with `search_web`. OpenStreetMap was tested and rejected: it returned sports venues in Russia and Brazil for a Jakarta venue.
  - The persona requires: typed place → look up → show name, address and map link → **ask "is this the right place?"** → only then create the event, with `location` = "Name, full address" and `placeLink` = the map link (stored in the event notes; only Google links are accepted).
  - The event confirm card always shows 📍 the place and 🗺️ the link, or "⚠️ place not checked on a map".
- **Alternatives:** Always use OpenStreetMap (poor coverage for local venues); require a Maps key (billing setup for every user).
- **Consequences:** The live test caught a real mix-up ("Grand Sport Central" → "Grand Central Sport Center", with its address) before anything was created. Without a key, accuracy depends on web search; the user verifies by tapping the map link.
- **Refs:** GOOG-3, D-035, D-038, src/main/services/google/maps.js

### D-040 — M8 = usage & accounts dashboard (voice → M9): numbers-only usage log, plan limits, account switching via official sign-ins
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** The user moved voice to M9 and asked for a dashboard of everything Tama uses (Claude, Gemini/agy, the Google project, Telegram), with log details and a way to change each account.
- **Decision:**
  - **Usage log** (`services/usage`): `<data>/usage/YYYY-MM.jsonl` per PC, 3 months kept. Entries are built by `clean()` from whitelisted numeric/label fields only (provider, surface, op, model, tokens in/out/cache, API-equivalent $, ms, ok), so message, email or file contents can't end up there. Sources: brain (Claude terminal turns with SDK `usage` and cost; Gemini chat turns), composer (events/diary), Google `api.js`/`maps.js` call hooks (op like "gmail messages GET"; Places marked billable), Telegram Bot API calls and incoming messages (long polling excluded).
  - **Claude plan limits:** the SDK's `rate_limit_event` (claude.ai subscriptions) is mapped to `rate-limit` and stored per window (`device.json` `usageLimits.claude`): 5-hour / weekly utilization, status, reset time.
  - **Accounts** (`services/accounts` + `engines/accounts.js`): Claude via `claude auth status --json` (email, plan, org, login expiry); Gemini via agy's own log line (`applyAuthResult: email=…`); Google from its status (email, OAuth client → project number, scopes, places mode); Telegram from its status. Tama never reads or copies CLI tokens (D-006).
  - **Switching:** Claude and agy open a visible console window running the official sign-in (`claude auth logout/login`; `agy` with `/logout`), with a warning that this is the same sign-in their own CLI uses. Google switches through the browser account picker (`prompt=select_account consent`) or "Change project" (sign out, open the setup page). Telegram points to `/phone setup` / `/phone code`. After a switch Tama re-checks every 10 s for 5 minutes. A changed Claude account clears the Claude session; a changed Gemini account restarts the agy chat and composer sessions.
  - **UI:** `renderer/dashboard` (tray "Usage & accounts…", `/usage`, `/usage here` for a text summary): account cards with plan-limit bars, totals per service, per-day stacked chart (calls / tokens / Claude $), filterable log, CSV export.
- **Alternatives:** Reading token files to show accounts (violates D-006); a cloud dashboard (data would leave the PC); logging full prompts (privacy).
- **Consequences:** Claude $ is an API-price estimate; the user pays a flat plan. Gemini has no $ (quota-based). Account switching for agy relies on its interactive `/logout`. M9 now holds voice and polish.
- **Refs:** USE-1..4, D-006, D-028, D-034, D-036, src/main/services/{usage,accounts}, src/main/engines/accounts.js, src/renderer/dashboard

### D-041 — Limits tab: Claude windows from the SDK (live /usage without a message + per-turn events), Gemini tier + quota-hit only, Google counts vs user cap
- **Date:** 2026-11-06 · **Status:** Accepted
- **Context:** The user wants to keep an eye on what is LEFT (e.g. "24 % left for Claude") for Claude, Gemini and the Google Cloud project.
- **Findings (probes 2026-11-06):**
  - Claude's per-turn `rate_limit_event` carries `unifiedWindows` (5-hour and weekly utilization 0..1 plus reset times).
  - The SDK's experimental `usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET()` works on a session that never receives a message (about 2.6 s, $0). It returns the 5-hour and weekly windows (and per-model ones when present) as 0..100, plus extra-usage credits and the per-app weekly breakdown.
  - agy shows its plan tier in `session/new` `_meta.antigravity.tier` ("Google AI Plus"). Its remaining quota (`retrieveUserQuotaSummary`, status-line buckets) is internal: not in ACP, not logged, and the status-line command is not run in ACP mode (tested in Tama's own settings, then restored).
  - Reading Google Cloud quota or billing numbers would need the broad `cloud-platform` scope.
- **Decision:**
  - `engines/claude/limits.js`: `fetchClaudeLimits()` (live, experimental API wrapped in try/catch with a 30 s timeout; null on any failure) and `fromRateLimitEvent()`, both producing `{ windows: { name: { used 0..1, resetsAt ms } } }`.
  - `services/usage/limits.js`: merges both sources (live on dashboard open, "Check now", and every 20 minutes; per-turn events otherwise). History goes to `usage/limits.jsonl` (90 days) for a step chart of % left. Warnings fire at user thresholds (default 25 % and 10 % left), once per window, keyed on the reset time rounded to the minute because the two sources differ by milliseconds.
  - Gemini: tier plus today's usage; a "quota used up" warning when agy errors mention quota/RESOURCE_EXHAUSTED/429. No invented percentage.
  - Google: calls this month per API from Tama's own log. Billable Places calls are counted against a monthly cap the user sets. Links open the project's quota and billing pages in Google Cloud (project number from the OAuth client ID). No `cloud-platform` scope.
  - Dashboard: "Overview" and "Limits" tabs; tray "Limits left…"; `/usage here` includes % left.
- **Alternatives:** Scraping agy's interactive UI for quota (brittle); `cloud-platform` scope for Google quotas (too much access for a pet app); polling Claude more often (each check starts a Claude process).
- **Consequences:** If Anthropic renames the experimental API, live checks quietly stop and the per-turn events keep the numbers current. If agy ever exposes quota over ACP, add it to `USAGE_LIMIT` `provider: 'gemini'`.
- **Refs:** USE-5..7, D-040, src/main/engines/claude/limits.js, src/main/services/usage/limits.js, src/renderer/dashboard

### D-042 — Voice: AivisSpeech/VOICEVOX HTTP for Japanese lines, Windows SAPI (via PowerShell) for English; audio plays in the pet window; Telegram voice notes as M4A; calm-idle animation bursts
- **Date:** 2026-11-07 · **Status:** Accepted · Engine choice (`/voice anime auto|always|never`) superseded by D-043
- **Context:** M9 (VOICE-1, TG-3 voice, PET-8, NFR-1). Probes:
  - Chromium's `speechSynthesis` has **no voices inside Electron**, so the old onboarding preview (D-004) was silent.
  - Windows SAPI (`System.Speech`) has David and Zira and renders SSML with pitch/rate to WAV.
  - AivisSpeech and VOICEVOX are not on winget (VOICEVOX is), and neither was running on this PC.
  - Electron's MediaRecorder records `audio/mp4` (AAC) but not OGG.
  - agy's ACP reports `promptCapabilities.audio: false`, so Gemini can't listen to voice notes through it.
  - The idle pet used about 5.8 % CPU, mostly continuous SVG animations (including an invisible tear loop).
- **Decision:**
  - `services/voice` picks the engine for each line:
    - **AivisSpeech** (`127.0.0.1:10101`) or **VOICEVOX** (`:50021`) via their shared HTTP API, detected every 5 minutes, for lines with Japanese text. With `/voice anime always`, English lines use them too.
    - Otherwise **Windows SAPI**, run by `platform/tts-sapi.js` (PowerShell with an encoded script) using the VoiceSpec gender, pitch and rate.
    - Speakers are chosen per Tama (`/voice speakers`, `/voice speaker <id>`).
  - `speakable()` strips emoji, kaomoji, markdown, links and `[[…]]` markers, and caps lines at about 280 characters.
  - **What speaks:**
    - Chat replies and event lines on the desktop. Replies to phone messages are not spoken on the desktop.
    - Quiet when `/mute`, `/dnd`, in a focus session, or while she sleeps.
    - `/voice chat|events on|off`.
  - **Playback:** the WAV goes to the pet window (Web Audio). The mouth opens with the audio loudness (`.talk-open`), and new lines queue (max 3).
  - **Telegram (`/voice on`):** each reply also comes as a voice note. The pet window converts WAV to M4A with MediaRecorder, and Tama sends it with `sendVoice`. Incoming voice notes get an honest "can't listen yet" reply; speech-to-text stays VOICE-4.
  - **Onboarding preview** uses the same rendering (`voice.render`).
  - **PET-8:**
    - `/motion auto|reduced|full`: auto follows Windows' animation setting; reduced also stops wandering.
    - `/mute`.
    - Both are stored in `device.json` `ui`.
  - **NFR-1:**
    - The pet sets `.calm` between short "alive" bursts (6–9 s every 18–28 s). Idle sway pauses, and blinks are one-shots.
    - Tears only animate while sad.
    - Walking moves the window 3 px every 45 ms (same speed, fewer moves).
    - Result: about 2.0 % CPU and about 200 MB private memory at idle.
- **Alternatives:** Web Speech (no voices in Electron); an npm TTS or opus encoder (new dependency, D-005 spirit); ffmpeg (large download); ElevenLabs (paid, D-022).
- **Consequences:**
  - Without AivisSpeech/VOICEVOX running, she sounds like the Windows voice with a higher pitch.
  - The anime engines read English poorly, so they're only used for Japanese lines by default (D-022).
  - Each SAPI line starts PowerShell (about 1 s).
  - Phone → Tama voice needs VOICE-4 (local whisper).
- **Refs:** VOICE-1, VOICE-4, TG-3, PET-8, NFR-1, D-004, D-022, src/main/services/voice, src/main/platform/tts-sapi.js, src/renderer/pet/voice.js

### D-043 — Voice language setting: English (Windows voice) / Japanese dub (Gemini translates in character, AivisSpeech reads) / off
- **Date:** 2026-11-07 · **Status:** Accepted · Supersedes D-042 (engine choice)
- **Context:** The user wants AivisSpeech to speak what Tama writes in English as a **Japanese dub**, with a setting to choose English, Japanese or no voice.
- **Decision:**
  - The voice has one setting, `lang` (`device.json` `voice.lang`, default `en`):
    - **`en`**: the Windows voice reads the English text. Kana/kanji are removed first, because the installed voices are English-only.
    - **`ja`**: the line is dubbed into Japanese by the composer (`brain.compose` kind `translate`). That is agy/Gemini in its own read-only session, so the dub is in character ("えへへ、…しよっか〜") and costs no Claude tokens. AivisSpeech/VOICEVOX then reads the Japanese. Lines that are already Japanese skip translation. Dubs are cached (last 60), so a phone voice note of the same reply doesn't translate again.
    - **`off`**: no voice on the desktop.
  - The chat bubble and chat window keep the English text; only the voice is Japanese.
  - **Fallbacks:** if `ja` is chosen but no engine is running, or agy is unavailable, she speaks English with the Windows voice and says once why. She is never silent by accident.
  - **Where to set it:** the tray menu **Voice ▸ English / Japanese dub / No voice** (radio items, rebuilt on `voice.changed`) and `/voice en|ja|off`. Telegram voice notes (`/voice on` on the phone) use the same language, with `off` meaning English there.
  - Older saves (`enabled`, `anime`) map to the new setting (`enabled: false` → off, `anime: always` → ja).
- **Alternatives:**
  - Having the chat brain add a hidden `[[ja: …]]` to every reply: no extra call, but it doesn't cover event lines or diary-free paths, and it costs every chat turn even with voice off.
  - Claude Haiku translation: spends Claude quota.
  - Reading English with AivisSpeech: it mangles English (D-022).
- **Consequences:**
  - A dubbed line starts a few seconds after the text, because of the translation.
  - Japanese needs AivisSpeech (or VOICEVOX) installed and running.
  - The meaning comes from Gemini's translation and could drift slightly from the text shown.
- **Refs:** VOICE-1, TG-3, D-022, D-033, D-042, src/main/services/voice/index.js, src/main/brain/compose.js, src/main/index.js (tray)

### D-044 — Headless AivisSpeech Engine (GPU) started by Tama only while Japanese dub is on
- **Date:** 2026-11-07 · **Status:** Accepted
- **Context:** The user asked whether AivisSpeech has to be an app and what it costs. They then asked to have it installed.
- **Findings (measured on the user's laptop: Ryzen 5 3550H, GTX 1650):**
  - **Install:** AivisSpeech Engine 1.2.0 is a headless server (`run.exe`, `127.0.0.1:10101`). Its Windows build from the official GitHub release (216 MB 7z) was extracted to `%LOCALAPPDATA%\Programs\AivisSpeech-Engine` (814 MB). `run.exe` is not code-signed. It ships two voices (まお, コハク).
  - **First start:** about 2.5 minutes, one-time setup. Later starts take 20–40 s.
  - **CPU mode:** about 1.2–1.5 GB RAM; a 40-character sentence took about 9 s.
  - **GPU mode (`--use_gpu`, DirectML):** a 40-character sentence took about 3.4 s once warm; it uses about 0.7 GB RAM plus about 1.1 GB of GPU memory.
  - **Idle CPU:** about 0 % in both modes.
  - **First synthesis** after a start loads the model (about 15 s).
- **Decision:**
  - **Running the engine** (`platform/voice-engine-process.js`):
    - Finds `run.exe` in the Tama install path, the AivisSpeech app's folder, or `device.json` `voice.enginePath`.
    - Starts it hidden (`windowsHide`, `--use_gpu` unless `/voice gpu off`) only while `voice.lang === 'ja'`.
    - Stops its whole process tree on a switch to English or off, and on quit.
    - An engine Tama didn't start (the user's AivisSpeech app) is used but never stopped.
  - **Crash safety:** the PID of the engine Tama started is stored in `<data>/voice-engine.pid`. On the next start Tama stops that PID only if it is still a `run.exe`; a reused PID that belongs to another program is left alone (tested).
  - **Warm-up:** after the engine comes up, one tiny synthesis loads the model, so her first real line isn't 15 s late. While the engine is starting, lines are spoken in English without a warning.
  - `/voice` shows engine state (not installed / starts with Japanese dub / warming up / started by me, GPU|CPU); `/voice gpu on|off` restarts it.
- **Alternatives:** Keeping the engine always running (about 1 GB of RAM all the time); running the AivisSpeech app (an extra window, more memory); CPU mode by default (about 3× slower on this PC).
- **Consequences:**
  - A dubbed line arrives about 6–9 s after the text (Gemini translation plus synthesis).
  - The engine is unsigned third-party software from the official repo, installed at the user's request.
  - On PCs with only an integrated GPU, the README says `--use_gpu` is slower: use `/voice gpu off` there.
- **Refs:** VOICE-1, D-022, D-043, src/main/platform/voice-engine-process.js, src/main/services/voice/index.js

### D-045 — Voice page: VOICEVOX added, per-Tama voice pick + tuning, mood-matched styles; no cloning of real people's voices
- **Date:** 2026-11-07 · **Status:** Accepted
- **Context:**
  - The user asked for a page to pick her voice, with the voice tuned to the emotion of each chat line.
  - They also asked to clone a real voice actress's voice (Sora Amamiya) and anime characters' voices. Declined: cloning a real person's voice without consent is impersonation, whatever the use; ElevenLabs' terms also require rights to the voice.
  - Offered instead: VOICEVOX's TTS characters, whose voice actors and owners allow this use.
- **Findings:**
  - **Install:** VOICEVOX Engine 0.26.1 (DirectML, official GitHub release, 1.9 GB download) was extracted to `%LOCALAPPDATA%\Programs\VOICEVOX-Engine\windows-directml` (2.2 GB) at the user's request. Its first start took about 7 s, and it lists 44 characters.
  - **Style types:** VOICEVOX 0.26 marks styles `streaming_talk`; singing and frame-decode styles must be filtered out.
  - **Portraits and terms:** both engines serve `/speaker_info` with a portrait and terms text.
- **Decision:**
  - **Engines:** `platform/voice-engine-process.js` handles both (`ENGINE_DEFS`: AivisSpeech `:10101`, VOICEVOX `:50021`), each with its own PID file for crash leftovers. `services/voice/engines.js` manages them:
    - It remembers each engine's voices in `device.json` `voice.catalog`, so the page lists voices while an engine is off.
    - It runs the chosen voice's engine while Japanese dub is on.
    - A preview "leases" another engine for 3 minutes, after which it is stopped again.
    - Engines Tama didn't start are never stopped.
  - **Pick and tuning per Tama:** `voice.pickByTama[id] = { engine, uuid, style }` and `voice.tuneByTama[id] = { pitch (±0.15), speed, intonation }`. The old `speakerByTama` style IDs map to a pick.
  - **Emotion** (`services/voice/emotion.js`, pure, table-tested):
    - The composer's dub prompt now returns `<feeling> | <Japanese line>` with one of normal, happy, excited, sweet, tease, sad, sleepy, calm, angry. A keyword/emoji guess covers English lines and missing tags.
    - `styleFor()` maps the feeling to the chosen character's best style by name (e.g. sad → なみだめ/せつなめ, tease/angry → ツンツン/からかい, sleepy → ヘロヘロ/ねむたい) and otherwise keeps the user's base style.
    - `prosodyFor()` nudges speed, pitch and intonation; the English Windows voice gets the same nudges.
    - `/voice mood on|off` (`moodStyles`) turns it off.
  - **Voice page** (`renderer/voice/`; tray Voice ▸ Choose her voice…, `/voice pick`):
    - Language (English / Japanese dub / No voice).
    - The current voice with portrait, credit line ("VOICEVOX:<name>") and terms.
    - Pitch, Speed and Expression sliders, and a mood "Try".
    - The mood → style map, and a GPU switch.
    - All voices grouped by engine: click a style to hear it (played by the pet, so her mouth moves), "Use" to choose it.
  - Dev: `TAMA_OPEN_VOICE=1`, and `TAMA_QUIT_AFTER=<ms>` for clean quits in live tests (killing Electron left engines running).
- **Alternatives:**
  - Cloning real voices (declined, see Context).
  - Asking the model for the emotion in a separate call (extra cost); it rides along with the dub instead.
  - Always running both engines (about 2 GB of RAM).
- **Consequences:**
  - VOICEVOX characters each have their own terms; credit is shown on the page, and personal use is free for the shipped ones.
  - Voice notes and the desktop use the same pick and mood.
  - Live check: three lines were spoken with ずんだもん in ノーマル/なみだめ/ツンツン from the tags excited/sad/tease, in 4.6–9 s each (translation plus synthesis).
- **Refs:** VOICE-1, VOICE-3, D-022, D-043, D-044, src/main/services/voice/{index,engines,emotion,vv-engine}.js, src/main/platform/voice-engine-process.js, src/renderer/voice

### D-046 — Voice page readability: English labels, separate listen/use controls, off-screen test windows
- **Date:** 2026-11-07 · **Status:** Accepted
- **Context:** The user found the Voice page hard to read (Japanese-only names) and wanted listening and choosing as separate controls instead of one "Use" button.
- **Decision:**
  - `assets/voice/names.json` (data, AGENTS rule 12) holds English labels for the 46 shipped characters and 67 style names. `services/voice/names.js` adds them (`en`) to the voice list, the pick and the mood map. Unknown kana-only names are romanized; names with kanji show only the original.
  - The page shows English first with the Japanese smaller beside it. Each style row has **▶** (listen) and a round **✓** (make it her voice); the chosen style is filled.
  - The mood matcher knows the extra VOICEVOX style names (うきうき, 不機嫌, 低血圧, けだるげ, びえーん, …).
  - Dev: `TAMA_SHOT_OFFSCREEN=1` opens page windows off-screen without focus, so live checks don't pop up over the user's work (one did before).
- **Consequences:** Name readings are best effort; new engine voices without an entry appear romanized or in Japanese.
- **Refs:** VOICE-5, D-045, assets/voice/names.json, src/main/services/voice/names.js, src/renderer/voice

### D-047 — App icon = the active Tama's face; tray menu grouped
- **Date:** 2026-11-07 · **Status:** Accepted
- **Context:**
  - The tray menu had 17 entries.
  - Icons were a generic hand-drawn frog bitmap (tray) and Electron's default (windows/taskbar). The user wanted the icon to be the Tama and to update by itself for new Tamas.
  - The user also asked whether "kero" applies to all Tamas. It does not: `kero~` is only a verbal tic in the Kero-chan preset's speech; designed Tamas get their own tics.
- **Decision:**
  - **Icon** (`platform/app-icon.js` + `renderer/icon/`):
    - An off-screen, transparent 256 px window draws the face with the shared rig (head crop in a round badge, ring and background from the Tama's theme colors; animations off so it never catches a blink) and is captured.
    - The result is applied to the tray (32 px) and to every window (`setIcon`, also for windows created later), so the taskbar shows her too.
    - Cached as `<data>/icons/<tamaId>.png` (a device cache, not part of the soul) and used right away at the next start.
    - Re-rendered 2.5 s after start and on every `character.changed` (restyle, hatch, rebirth). Switching Tama relaunches the app, so it follows too.
  - **Tray:**
    - Top level: Summon, Chat, Terminal (with their shortcuts shown), Show / Hide.
    - Submenus: Take care (Feed, Play, Energy snack, Bedtime), Voice, *<her name>* (My Tamas, Restyle, Rebirth), Accounts & usage (Usage & accounts, Limits left, Google).
    - Then Quit.
- **Consequences:** The packaged exe's file icon stays static (set at build time; the exe is postponed). An egg shows the egg.
- **Refs:** ART-4, SUM-*, src/main/platform/app-icon.js, src/renderer/icon, src/main/index.js (tray)

### D-048 — M10 = settings & polish: one Settings window, reply language, quiet hours
- **Date:** 2026-11-07 · **Status:** Accepted
- **Context:** After M9 the user asked for quality-of-life ideas and chose a settings-and-polish milestone. Settings were spread over the tray, the Voice, Usage and Google pages and terminal commands. The chat also answered in Bahasa Indonesia when the user wrote in it, with no way to choose.
- **Decision:**
  - **Settings window** (`renderer/settings/`, tray "Settings…", `/settings [tab]`, `TAMA_OPEN_SETTINGS=<tab>`): tabs for her (look, motion, edge tab, terminal theme), talking & voice, quiet & moments (quiet hours, DND, nudges, weather city), phone (Telegram setup, pairing, voice notes, remote, keep awake), Google (status + the setup page), accounts & usage (Claude daily budget + the dashboard). It is a view over the existing services' bus requests; no new settings store. Detailed pages (Voice, Google setup, dashboard) open from it through `page:open`, which only accepts a fixed list of names.
  - **Reply language** (`device.json` `ui.replyLang`: `auto` | `en` | `id` | `ja`, default `auto` = the current behavior, answering in the user's language). It is one line in the persona, so it covers chat and moments; a change rebuilds the persona, which restarts the agy sessions. `/lang`.
  - **Quiet hours** (`ui.quiet = { on, from, to }`, HH:MM local, may cross midnight; pure `inQuietHours`). `ui.prefs.get` reports `quietNow`; events, voice and Telegram's daily messages treat it like `/dnd`. Reminders the user set still ring. `/quiet 23:00-08:00|on|off`.
  - Page windows now also receive the `ui.prefs`, `character` and `telegram` pushes, so open pages stay in sync.
- **Alternatives:** A separate settings store (two sources of truth); per-Tama reply language in the soul (it is the user's preference, not hers); quiet hours as a timer that flips `/dnd` (would overwrite the user's manual DND).
- **Consequences:** New preferences get a control in the Settings window as well as a command. The remaining M10 items are SET-4..6.
- **Refs:** SET-1..3, ONB-8, PET-6, src/renderer/settings, src/main/services/ui, src/main/brain/persona.js

### D-049 — Faster Japanese voice: the reply carries its own dub, sentence-by-sentence synthesis, audio cache
- **Date:** 2026-11-07 · **Status:** Accepted · Refines D-043 (where the dub comes from for chat replies)
- **Context:** SET-4. Measured on the user's laptop (AivisSpeech on the GTX 1650): a dubbed chat reply started speaking 7–12 s after its text. About 4.2 s of that was the separate translation call to the composer (agy), about 3 s was synthesizing the whole line, and the composer's agy session was cold on the first line.
- **Decision:**
  - **Dub with the reply:** while the voice language is Japanese, the chat persona asks Gemini to end each reply with a hidden `[[ja: <feeling> | <spoken Japanese>]]` marker (short sentences of about 20 characters). The chat strips it like the other markers and attaches it to the message (`ja`); the voice service uses it directly and caches it, so the phone voice note reuses it too. The persona switches with `voice.changed`, so with English or no voice the replies cost nothing extra. Event lines and lines without a marker still use the composer translation (D-043), which is warmed once when the Japanese voice starts.
  - **Sentence by sentence:** `services/voice/chunks.js` splits the Japanese line into sentences (very short pieces join the next; a long first sentence is cut at its first comma). Each part is sent to the pet as soon as it is synthesized, while the next one is made. The pet keeps every part of a line in order and still drops older lines.
  - **Audio cache:** the last 40 rendered clips (engine, style, tuning, text; and the Windows voice's) are kept in memory, so repeated lines play at once.
  - Dev: `TAMA_VOICE_TRACE=1` logs message, reply and each played part with times; `TAMA_VOICE_TEST` takes several lines separated by `||` and `TAMA_VOICE_TEST_AT=<ms>` delays it until the engine is up. `voice.skipped` reports why a chat line was not spoken.
- **Alternatives:** Translating sentence by sentence (several agy calls on one serialized session; slower); a second agy session just for dubs (another process and login use); keeping the separate translation for chat (the 4 s we wanted gone).
- **Consequences:** Measured: 2.4–2.6 s from the finished reply to the first sound, then the rest follows without gaps. With the Japanese voice on, each chat reply is a little longer for Gemini to write (the marker), and the Japanese may differ slightly from a separate translation. AivisSpeech needs about 2.5 s even for a short clip on this GPU; VOICEVOX is faster if the user wants less.
- **Refs:** SET-4, VOICE-1, D-043, D-045, src/main/services/voice/{index,chunks}.js, src/main/brain/{chat,persona,compose}.js, src/renderer/pet/voice.js

### D-050 — Reliability: window rescue from unplugged monitors; crash log, clean-quit marker, renderer reload
- **Date:** 2026-11-07 · **Status:** Accepted
- **Context:** SET-5/SET-6. The pet already came back from a missing monitor (D-019), but the chat, terminal and page windows could stay on a monitor that was unplugged. Errors only went to the console, so a crash left no trace and Tama said nothing afterwards. AGENTS.md mentions `platform/log`, which never existed.
- **Decision:**
  - **Window rescue:** pure `geometry.rescueRect` (a window is reachable when ≥ 120 px of its title bar is on a work area; otherwise it is centered on the cursor's display, shrunk to fit). `summoner.rescueWindows()` runs on display changes and on every summon. Windows parked off-screen by dev runs (x ≤ −3000) are left alone.
  - **Crash log** (`platform/crash-log.js`, plain fs, unit-tested): `<data>/logs/tama-YYYY-MM-DD.log`, kept 7 days, max 2 MB per day, error messages and the top of stack traces only, with Telegram/Google/Anthropic tokens and `token=`/`Bearer` values redacted. Every `app.error` goes there too.
  - **Clean-quit marker:** `logs/running.json` is written at start and removed after the shutdown steps on a clean quit. If it is still there at the next start, the crash is logged and she says once that she "tripped last time".
  - **Crash guard** (`platform/crash-guard.js`): uncaught exceptions and unhandled rejections in main are logged instead of killing the app; a crashed renderer (pet, chat, terminal, pages) reloads after 1 s, at most 3 times a minute per window; crashed helper processes are logged. A short in-character note appears at most every 10 minutes.
  - Settings: "Bring her here", "Open My Tamas…" (file backup), "Back up now" (Drive), "Open logs".
- **Alternatives:** A logging library (new dependency for a few lines); sending crash reports online (data would leave the PC); restarting the whole app on any error (loses state; one window reload is enough).
- **Consequences:** `platform/crash-log` is the `platform/log` that AGENTS.md refers to. Keeping the app alive after an uncaught exception can leave a service in a bad state; the log makes it visible. The renderer reload was not forced in a live test (it needs a real renderer crash); the clean-quit detection was tested live.
- **Refs:** SET-5, SET-6, SUM-2, NFR-2, D-019, src/main/platform/{crash-log,crash-guard}.js, src/main/platform/summon

### D-051 — Roadmap: M11 quality control; M12 installers for Windows and macOS with modular capabilities
- **Date:** 2026-11-07 · **Status:** Accepted · Replaces NFR-3's portable exe (postponed since 2026-11-06)
- **Context:** The user asked for M11 to be quality control and an architecture review (remove what slows Tama down or is unused), and for M12 to ship with an installer instead of an instant exe, because users have to install Claude Code, agy and the voice engines themselves. Tama should be modular (e.g. someone with only an Antigravity account), and ship for Windows and macOS.
- **Decision:**
  - **M11 (QC-1..6):** an architecture check script in `npm run check`, dead-code removal, a repeatable performance run (`npm run perf`) with fixes, a module-by-module review against AGENTS rules, a coverage report with new tests, and a security pass.
  - **M12 (SHIP-1..7):** a Windows installer (per-user, Start menu, uninstaller that asks about her data) and a macOS `.dmg`; a capability model where each feature declares what it needs (Claude Code, agy, a voice engine, Google, Telegram) and explains itself when that is missing; a first-run setup wizard (also in Settings) that detects and guides each install with official links and sign-ins; optional components (voice engines) downloaded on demand with checksums, never bundled; updates; signing decided before release.
- **Alternatives:** A portable exe (users still have to find and install every dependency by hand); bundling Claude Code, agy or the voice engines in the installer (their own licenses and sign-ins, several GB, and they update separately).
- **Consequences:** M12 needs mac versions of the Windows-only parts (SAPI voice, PowerShell fullscreen helper, `run.exe` engines, `%LOCALAPPDATA%` paths, tray icon sizes). Windows code signing and Apple notarization need paid certificates or accounts; the user decides before release. The terminal stays Claude-only (D-029), so with only agy the coding terminal is hidden or explains how to add Claude Code.
- **Refs:** QC-1..6, SHIP-1..7, NFR-1, NFR-3, D-005, D-006, D-029

### D-052 — Architecture rules enforced by a script; engine public indexes; shared day helpers
- **Date:** 2026-11-07 · **Status:** Accepted
- **Context:** QC-1 (M11). The AGENTS §1 rules were only checked by reading. The first run of a checker found 11 deep imports (six services reached into `services/pet/bond.js` for `dayOf`; `brain` and `engines/accounts` into engine internals; `agy/session` into `acp/client`).
- **Decision:**
  - `scripts/arch-check.js` runs in `npm run check` (between tsc and the tests) and fails on: `electron` outside `platform/` and the preload; a deep import into another module under `services/`, `engines/` or `channels/` (only its `index.js`; the bootstrap, tests and `dev/` are exempt); any `require` in a renderer; a `TOPICS.X` that is used but not declared, or declared but never used; a preload IPC channel without a main handler, or the reverse. `npm run arch` also lists files over ~300 lines as warnings.
  - `engines/claude`, `engines/agy` and `engines/acp` get an `index.js` with lazy getters (importing the limits helper doesn't load the Agent SDK).
  - `dayOf`/`prevDay` move to `src/main/day.js` (top-level shared helpers, like `bus.js`); `pet/index.js` re-exports `levelOf` for the roster.
- **Alternatives:** ESLint with import rules (new dev dependencies and config for rules a 100-line script covers); dependency-cruiser (same).
- **Consequences:** New code that breaks a layer rule fails `npm run check`. Files over 300 lines (bootstrap, telegram, voice, pet.js, terminal.js, tama-commands.js) are QC-4 work.
- **Refs:** QC-1, AGENTS §1, scripts/arch-check.js, src/main/day.js, src/main/engines/*/index.js

### D-053 — Repeatable performance run; mood and sleep effects rest; shorter alive bursts
- **Date:** 2026-11-07 · **Status:** Accepted · Refines D-042 (calm idle)
- **Context:** QC-3. NFR-1 asks for idle CPU < 2 % and RAM < 300 MB, but each earlier number was measured a different way. A first repeatable run on the user's laptop gave 3.5 % CPU and 297 MB.
- **Findings** (all Tama processes from `app.getAppMetrics()`, CPU as % of one core):
  - Reduced motion idles at 0.5 %. Wandering alone (window moves, CSS animations off) costs almost nothing (0.6 % with 171 steps); all the cost is SVG animation repaint.
  - Mood and sleep effects (tears, gloom, nose bubble, floating z's) looped forever and were not paused between bursts. A sad (hungry) or sleeping pet, which is common, cost about 1.8 % more.
  - Main-process timer callbacks and IPC handlers are cheap: the slowest timer callback is the first Claude limits check (about 61 ms, every 20 minutes), and 90 walk steps cost 119 ms in total. The rare ~200 ms event-loop maximum is not in Tama's callbacks (likely Chromium or GC); the ~31 ms mean "lag" is Windows' 15.6 ms timer granularity.
- **Decision:**
  - `npm run perf` (`scripts/perf.js` + `platform/perf.js`, `TAMA_PERF=<s>`): starts Tama in a scratch folder (or `--data <dir>`), lets it settle for 15 s, then samples CPU and memory per process type each second, plus event-loop delay, slow (> 40 ms) timer callbacks with where they were scheduled, IPC calls per channel, active timers and boot time. It prints JSON and an NFR-1 verdict. The pet is shown (small, never focused) because hidden windows are throttled and would hide the cost.
  - The mood and sleep effects also pause during `.calm`, so they play in bursts like the idle sway.
  - Alive bursts: 5–7 s every 28–40 s (was 6–9 s every 18–28 s).
- **Result:** 1.6 % CPU (two 60-second runs: 1.60 % and 1.65 %) and about 262 MB; ready about 0.8 s after launch.
- **Alternatives:** Capping the pet window's frame rate (Electron only supports this for offscreen rendering); stepped CSS animations (choppy); turning wandering off (it costs almost nothing).
- **Consequences:** She sways a little less often; walking, blinks, talk and expressions are unchanged. Use `npm run perf` before and after any animation or timer change.
- **Refs:** QC-3, NFR-1, D-042, scripts/perf.js, src/main/platform/perf.js, src/main/platform/ipc.js, src/renderer/pet/{pet.js,pet.css}

### D-054 — M12 provider layer: capabilities instead of named engines
- **Date:** 2026-11-07 · **Status:** Accepted (plan; built in M12) · Refines D-029 (its split becomes the default routing)
- **Context:** The user asked whether the service and provider layers depend on Claude. Findings:
  - **Services don't.** None of the 13 services imports an engine (enforced by `scripts/arch-check.js`, D-052); they use bus requests or injected functions.
  - **The routing is hard-wired** in `brain/` (D-029: terminal = Claude Code, chat = agy). There is no shared provider interface; the bootstrap passes fixed factories (`claudeWorker`, `agyChat`, `agyCompose`) and `available: { claude, agy }`.
  - Without agy most of her personality is gone (chat, moments, Japanese dub, Telegram chat). Without Claude only the terminal, `/code` from the phone and the AI designer are lost.
  - Claude-specific knowledge also sits in `services/usage/limits.js` (Claude windows), `services/accounts` (fixed claude/gemini slots), `services/telegram/remote.js` (`engine === 'claude'`) and `brain/index.js` (imports the Claude rate-limit helper).
  - The user then asked to put a provider layer in the M12 plan.
- **Decision (M12, SHIP-8, built before SHIP-3/4):**
  - **Capabilities:** `chat` (persona conversation, streaming, hidden markers), `compose` (short one-shot lines: events, diary, dubs), `json` (structured output against a schema: designer), `code` (agentic work in a folder, every tool through PermissionGate), `tools` (Tama's MCP tools: Google), `webSearch`, plus optional `limits` and `account` reporting.
  - **Providers** (`src/main/providers/` or `engines/<name>/provider.js`) register `{ id, name, capabilities, status(): { installed, signedIn, email?, plan? }, create(capability, opts) }`. Claude Code offers chat (opt-in), compose, json, code, tools, limits, account; agy offers chat, compose, tools, webSearch, account, never `code` (D-027, D-037).
  - **Routing:** the brain asks `providers.pick(capability)`, which takes the user's preference order per capability (Settings; defaults = D-029: chat/compose → agy, json/code → Claude) and falls back to the next provider that is installed and signed in. Using Claude for chat or moments is **opt-in** (it spends Claude quota; D-029's reason), shown with the budget.
  - **Safety travels with the provider**, not the feature: agy keeps plan mode + the workspace guard; Claude keeps PermissionGate; a provider without a safe mode for a capability simply doesn't declare it.
  - **Services stay unaware.** Usage, limits and accounts get their rows from the registry (`provider` field already exists in the usage log), so a new provider shows up without service changes. Telegram `/code` asks for `code`.
  - **Contract tests:** one shared test file that every provider (and a fake one) must pass: streaming, interrupt, stop, persona, permission round-trip.
  - New providers later (e.g. other coding CLIs) each need their own decision about login (D-006) and safety.
- **Alternatives:** Keep the hard-wired split and only hide missing features (SHIP-3 alone; a Claude-only user would get no chat); always fall back to Claude for chat (spends Claude quota without asking; the user chose agy-only chat in D-029).
- **Consequences:** `brain/index.js` and `brain/chat.js` take a provider instead of factories; ARCHITECTURE §5 (Engine contract) gains the provider/capability contract; the setup wizard (SHIP-4) shows what each provider unlocks from the same registry. AGENTS rule 6 ("no `engine === 'agy'` outside engines") extends to providers.
- **Refs:** SHIP-3, SHIP-4, SHIP-8, D-006, D-027, D-029, D-037, D-052, src/main/brain, src/main/services/{usage,accounts,telegram}

### D-055 — Security pass: windows stay on Tama's pages, no browser permissions, IPC inputs coerced, more redaction
- **Date:** 2026-11-07 · **Status:** Accepted
- **Context:** QC-6 (M11). Already in place: CSP on all 12 pages, `sandbox` + `contextIsolation` + no `nodeIntegration` on every window, IPC accepted only from `file://` frames, HTML escaping in every renderer that shows model or user text, `UNTRUSTED …` labels on mail/Drive/calendar tool results, the tool bridge on 127.0.0.1 with a random key. Gaps found:
  - Nothing stopped a window from navigating to a website or opening a new window (e.g. a link inside a reply). The `file://` check would still block its IPC calls, but the window would be lost.
  - Browser permissions (camera, microphone, location, …) used Electron's defaults.
  - A few IPC arguments reached the bus as sent (todo refs, the resume id, the permission answer's choice/feedback); `page:open` looked names up on a plain object, so `constructor` resolved to a function.
  - The crash log's `redact()` missed Google API keys (`AIza…`, the Maps key) and refresh tokens (`1//0…`) when no "key=" word came before them.
  - Maps results (place names anyone can write) and the chat's `[google]` line (mail subjects, event titles) reached the model without an "untrusted" note.
  - The tool bridge compared header lengths in characters before `timingSafeEqual`, which throws when byte lengths differ.
- **Decision:**
  - `platform/app.js` `harden()`: every web contents denies `window.open`, cancels navigation and redirects away from `file://`, refuses `<webview>`; the default session grants no permission and answers every permission check with no. No page needs one (checked: voice playback and M4A encoding still work).
  - The desktop channel coerces every argument (numbers, short strings, booleans) or checks it against a list; page names by own property only. `desktop.test.js` covers it.
  - `redact()` gains Google API key and refresh-token patterns (tested).
  - Maps tool results use the same `untrusted()` wrapper (source "Google Maps"); the persona says mail subjects and event titles in `[google]` are other people's data.
  - Tool bridge: compare byte lengths, then `timingSafeEqual` (tested with a multi-byte header).
- **Alternatives:** A separate Electron session/partition per window (no benefit with one origin); stripping links from replies (users like links; navigation is blocked anyway).
- **Consequences:** A future page that needs a browser permission (e.g. a microphone for VOICE-4 speech-to-text) must allow exactly that permission for that page in `harden()`, with a decision entry.
- **Refs:** QC-6, AGENTS §1.9, §4, D-034, D-037, D-050, src/main/platform/{app,crash-log,tool-bridge}.js, src/main/channels/desktop, src/main/services/google/tools.js, src/main/brain/persona.js

### D-056 — v1.0.0 = M12 shipping; v2 = Tama's own agentic brain
- **Date:** 2026-11-07 · **Status:** Accepted · Refines D-015 ("1.0.0 = all P0 requirements done")
- **Context:** The user asked to ship M12 as version 1, and to continue later with v2: set up Tama's own agentic brain, cut the dependency on a single provider, and build Tama's own SDK instead of using Claude's.
- **Decision:**
  - **v1.0.0** is the M12 release (installers, provider layer, modular capabilities, setup wizard). M12 also closes the two open P0 rows (GOOG-6 replace section, NFR-2 mixed-DPI check) or lists them as known gaps in the release notes.
  - **v2 (2.0.0)** is Tama's own agent loop (AGT-1..6): planning, tool calls, streaming, sessions and compaction in `src/main/agent/`, with Tama's own tools behind PermissionGate, running on the SHIP-8 provider layer.
  - **How v2 reaches models:** through official model APIs with the user's **own API keys** (Anthropic Messages API, Gemini API, OpenAI-compatible endpoints) or **local models**. A Claude.ai or Antigravity **subscription can't be used directly**: subscriptions are only for their own apps (Claude Code / agy), and reusing their logins or tokens is ruled out (D-006). Claude Code and agy stay available as optional adapters (AGT-5) for users who want to use their subscriptions.
  - The provider layer built in M12 (D-054) is the seam: v2 adds "Tama agent" providers next to the Claude Code and agy ones, so features don't change.
- **Alternatives:** Keep depending on the Claude Agent SDK for coding (the user wants independence); use subscription tokens from the CLIs in Tama's own loop (violates D-006 and the providers' terms).
- **Consequences:** v2 costs the user per-token API usage (or local compute) instead of a flat subscription; the dashboard (USE-*) must show that clearly. Local models (D-003 had declined Ollama for v1) get a fresh decision in v2. The safety work done for agy (guard hooks, probes) is redone for Tama's own loop (AGT-6).
- **Refs:** SHIP-8, AGT-1..6, D-003, D-006, D-015, D-029, D-054

### D-057 — Provider layer built: registry, descriptors, Claude chat opt-in, Settings → Brains
- **Date:** 2026-11-07 · **Status:** Accepted · Implements D-054 (first part of SHIP-8)
- **Context:** M12 starts with the provider layer (D-054, D-056). Choices made while building it.
- **Decision:**
  - `src/main/providers/index.js`: capabilities `chat`, `compose`, `json`, `code`; `pick(cap)` = first provider in the user's order (then the D-029 default, then any other) that offers the capability, is available, and, for an opt-in capability, was allowed. A throwing `available()` counts as unavailable. Preferences in device.json `providers` (`order`, `allow`); `providers.changed` makes the brain rebuild the persona and restart the chat and composer sessions.
  - Descriptors live next to their engines: `claudeProvider` (code = the worker session with Google MCP tools; json = `askJson`; chat/compose = the existing `lite` profile: Haiku, `tools: []`, no user settings, not saved, and PermissionGate denies every tool to non-worker roles) and `agyProvider` (chat with web search and the Google MCP relay, compose with no tools; always plan mode + guard, D-027/D-037). agy is looked up once per run, as before.
  - **Claude for chat/moments is opt-in per capability** (`claude:chat`, `claude:compose`). Picking Claude in Settings → Brains counts as the opt-in; the checkboxes there turn it on or off. Claude chat has no web search or Google tools, and the persona says so (`buildPersona` `provider` option: who powers her, web search yes/no, Google tools yes/no).
  - The terminal still always shows Claude's state: without a `code` provider it explains how to add Claude Code instead of failing.
  - Usage records name the provider that actually served the turn, so a Claude chat counts toward the daily Claude budget.
- **Verified live (2026-11-07):** default chat answered via agy ("powered by Google's Gemini models via the Antigravity CLI"); with `claude:chat` allowed and preferred it answered via Claude Haiku ("powered by Claude Code running Claude Haiku") and logged a Claude turn.
- **Alternatives:** A global "Claude fallback" switch (less control; moments and chat have different costs); giving Claude chat Tama's Google tools now (needs the chat-tools confirmations wired into the Claude lite profile; later in SHIP-8 or v2).
- **Consequences:** New providers (v2's own agent, D-056) are one descriptor each. Still to do for SHIP-8: usage limits and the accounts page driven by the registry, and a shared contract test every provider must pass.
- **Refs:** SHIP-8, D-027, D-029, D-037, D-054, D-056, src/main/providers, src/main/engines/{claude,agy}/provider.js, src/main/brain/{index,persona,chat}.js, src/renderer/settings

### D-058 — v1.0.0 released now; the rest of M12 as 1.x; unsigned builds
- **Date:** 2026-11-07 · **Status:** Accepted · Refines D-056 (v1.0.0 = all of M12) and D-051 (signing decided before release)
- **Context:** After the provider layer (D-057) the user asked to update the README, write a Word/PowerPoint document about the tech and the business/user flows, and push to GitHub as **v1.0.0 stable**. The installer, setup wizard and modular capabilities (SHIP-1..7, SHIP-3/4) are not built yet. The user also accepted the "unknown publisher" warning (no code signing) and said Mac users will run from source with `npm start`.
- **Decision:**
  - Tag **v1.0.0** from `m12-shipping` merged into `main`: everything through M11 plus SHIP-8 so far. A GitHub release carries the notes and the Word documentation.
  - The remaining M12 items ship as **1.x** minor releases (1.1 installer + setup wizard, …). 2.0 stays Tama's own agentic brain (D-056).
  - **No code signing** for now (SHIP-7 decided: unsigned; Windows shows "unknown publisher"). macOS is supported from source until the mac app (SHIP-2) exists.
- **Alternatives:** Wait for the installer before 1.0.0 (the user wanted the stable tag now); call it 1.0.0-rc (the user asked for stable).
- **Consequences:** Release notes list the known gaps plainly (no installer, run from source; open P0 rows GOOG-6 replace section and NFR-2 mixed-DPI check). D-015's "1.0.0 = all P0 done" no longer holds.
- **Refs:** SHIP-1..8, NFR-3, GOOG-6, NFR-2, D-015, D-051, D-056, D-057

### D-059 — Windows installer (NSIS, per-user) and a setup wizard with official installers and live re-detection
- **Date:** 2026-11-08 · **Status:** Accepted
- **Context:** M12 for 1.1: SHIP-1 (installer, not a bare exe) and SHIP-4 (setup wizard). Users must install Claude Code and/or agy themselves; neither may be bundled (D-051). Claude Code and agy were each looked up once at start, and a tool installed while Tama runs isn't on this process's PATH.
- **Decision:**
  - **Installer:** electron-builder NSIS, per-user (no admin), assisted (choose the folder), Start menu and desktop shortcuts, run after install, `Tama-Setup-<version>.exe` (`npm run dist`; the portable exe stays as `npm run dist:portable`). `build/installer.nsh` makes the uninstaller ask "also delete your Tamas and settings?" (default No; never during an update, and a silent uninstall keeps the data). Unsigned (D-058).
  - **Start with Windows** is a Settings switch (`app.setLoginItemSettings`), only in the installed app: in a dev run it would register a bare electron.exe.
  - **Setup wizard** (`services/setup` + `renderer/setup`): one card per part (Claude Code, Gemini/agy, anime voice, Google, Telegram) with its state (ready / sign in / not installed / optional), what it unlocks, and the next step. It opens by itself once when chat or coding has nothing installed, and from the tray, Settings → Brains and `/setup`.
  - **Installing** runs the vendor's official one-line installer in a visible PowerShell window, with the exact command shown on the card first: `irm https://claude.ai/install.ps1 | iex` (Claude Code) and `irm https://antigravity.google/cli/install.ps1 | iex` (agy), followed by the official sign-in. Official pages are linked next to them. (The commands match the vendors' published instructions as found on 2026-11-08; the official pages could not be fetched from here, so the links are shown for the user to check.) Tama never handles their tokens (D-006).
  - **Re-detection:** `platform/env.refreshPath()` merges the registry's user and machine PATH into the process; `providers.recheck()` looks for each tool again (Claude's executable is now looked up through `claudeExe()`/`recheckClaude()`, agy also in `%LOCALAPPDATA%\Antigravity`) and emits `providers.changed`, so chat and the terminal switch over without a restart. The wizard re-checks when its window gets focus back (after an installer window).
- **Alternatives:** Bundling the CLIs (licenses, sign-ins, separate updates; D-051); a one-click NSIS installer (no folder choice); running installers hidden (the user should see what runs); per-machine install (needs admin).
- **Consequences:** The installer test needs a real install on a Windows PC (the unpacked build was tested with a scratch data folder). If a vendor changes its install command, update `services/setup` `INSTALL` and `engines/accounts` `installScript`. macOS still runs from source (SHIP-2).
- **Refs:** SHIP-1, SHIP-3, SHIP-4, SHIP-8, D-006, D-051, D-054, D-058, build/installer.nsh, src/main/services/setup, src/renderer/setup, src/main/platform/{env,app}.js, src/main/engines/{accounts,claude/find-exe}.js

### D-060 — v2 positioning and USP roadmap: "the work buddy who grows when you ship"
- **Date:** 2026-11-08 · **Status:** Accepted
- **Context:** The user asked for a CEO-level review of Tama's USP (run without gstack at their request). Findings: Tama is the only product in the overlap of desktop pets (cute, no real work), AI companions (cloud chat, no tools) and work agents (no personality or memory). The v1 pitch lists features; the setup is heavy before the first delight; and the strongest differentiator, bond XP earned from real work (commits, todos, focus, finished tasks), is already built but hidden in the pitch and only lightly visible in the UI.
- **Decision:** v2 is positioned as **"the work buddy who grows when you ship"**, and six USP requirements join the v2 roadmap next to AGT-1..6 (user's choice: all of them into v2): USP-1 work → bond loop as the hero (daily shipped card, growth tied to output, weekly report card), USP-2 morning plan and evening stand-up draft, USP-3 checkpoint + one-click undo for agent work, USP-4 shareable character, USP-5 focus body-doubling, USP-6 voice input (VOICE-4).
- **Alternatives:** Putting USP-1..3 into 1.x (faster story, but the user chose to keep 1.x for shipping work); positioning as a coding tool (crowded, loses the companion edge) or as a pure companion (loses the "does real work" edge).
- **Consequences:** 1.x stays focused on shipping (installer, modular capabilities, voice on demand, updates, macOS). v2 planning should order USP-1..3 early, since they reuse what exists (bond, events, Google, git watcher, PermissionGate) and AGT work can follow behind the provider layer. README and release notes switch to the new positioning when v2 starts.
- **Refs:** USP-1..6, AGT-1..6, BOND-1..3, EVT-*, GOOG-*, PROD-2, VOICE-4, D-038, D-054, D-056

### D-061 — 1.x "Voice & hands" planned; API-key models deferred
- **Date:** 2026-11-08 · **Status:** Accepted (plan; not built yet)
- **Context:** The user wants to dictate to Tama and have her act, e.g. "open YouTube Music in the browser and play this anime song". They also asked to drop switching to API keys (AGT-2) for now and review it later, because per-token usage costs money.
- **Decision:**
  - **Push-to-talk on Ctrl+Alt+Space** (user agreed) or the 🎙️ on her; the transcript goes to the chat brain like a typed message.
  - **Local Whisper** (whisper.cpp) for speech-to-text: free, offline, multilingual; model downloaded on demand. Chromium's Web Speech API doesn't work in Electron, Windows' recognizer is English-only, and agy's ACP takes no audio (D-042).
  - **PC actions** as Tama-owned tools served through the existing tool bridge (D-037), with per-action rules: `play_music` (find the track via web search, open its YouTube Music page, announce what was picked), `media_control` (media keys), `open_url` (known sites direct, others ask), `open_app` (allow-list, others ask). The chat brain stays read-only otherwise; no general shell.
  - The microphone permission is granted to the pet window only, amending D-055's "no browser permissions".
  - **AGT-2 deferred** ("review later"): no API-key models until the user revisits the cost.
- **Alternatives:** Letting agy run commands (breaks D-027/D-037); full desktop control (much larger risk surface); cloud speech-to-text (costs money and sends audio off the PC).
- **Consequences:** Browsers may block autoplay; she then says the page is open and `media_control play` can start it. Song lookup depends on web search accuracy, so she names the track she picked.
- **Refs:** VH-1..4, VOICE-4, AGT-2, AGT-3, SHIP-5, D-027, D-037, D-042, D-055, D-056
