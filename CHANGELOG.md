# Changelog

Every version of Tama: what changed, which decisions were made, and the exact commits.

**How this file works**
- **Top part (hand-written):** add a line under `## [Unreleased]` in every commit that changes
  behavior, docs or decisions. Sections: `Added` / `Changed` / `Fixed` / `Removed` / `Decisions` / `Docs`.
  Reference PRD IDs (`SUM-1`) and decision IDs (`D-014`).
- **Release:** rename `[Unreleased]` to `[x.y.z] — YYYY-MM-DD`, bump `package.json`, commit,
  tag `vx.y.z`, then run `npm run changelog` and commit the regenerated table.
- **Bottom part (generated):** `npm run changelog` rebuilds the commit table per version from
  `git log` and the `v*` tags. Don't edit it by hand. Run it before each commit; it lists every
  commit up to the previous one (a commit can't contain its own hash).
- **Versioning (D-015):** each finished milestone is a minor version (M0 → 0.1.0, M1 → 0.2.0, …).
  Fixes between milestones are patch versions. 1.0.0 = all P0 requirements done.

## [Unreleased]
### Added
- **M7 Telegram** (branch `m7-telegram`, D-036): your Tama on your phone, served from your PC (no server).
  - **Setup in 2 minutes:** create a bot with @BotFather, `/phone setup <token>`, open the link on your phone. Only that one chat is ever answered (SAFE-3).
  - **Chat** with her from anywhere (Gemini via agy, same conversation as the 💬 window).
  - **`/status`** with a picture of how she looks right now, `/feed /snack /nap /summon`, `/todo /done /focus /remind`, `/brief`.
  - **Remote coding:** `/code <task>` runs in the terminal's Claude Code session, only in folders you allowed on the PC (`/phone allow here`), always asking first: permission prompts arrive as ✅ / ♾️ / ❌ buttons. Live progress, the result, and the diff as a file. `/stop`, `/repos`, `/cd`, `/remote off` kill switch. Every remote action shows on the desktop.
  - **Good morning / good night:** a morning brief and tonight's diary page on your phone.
  - Bot says "sleeping" when the PC app quits; `/phone awake on` keeps the PC awake for remote use.

## [0.6.0] — 2026-11-06 — M6 Google (+ M5 extras)
### Added
- **M6 Google** (D-034):
  - **Connect Google** with your own Google app: a guided 5-minute setup page (tray → Google…, or `/google setup`), browser sign-in (loopback + PKCE). Tokens are stored only in Windows-encrypted secrets.
  - **In the terminal, Claude Code can now:** read your calendar, create events (no invitations are ever sent), edit events (asks first); search and read Gmail and write **drafts** (there is no send); search and read Drive; create Google **Docs** from Markdown and **Sheets** with tabs and formulas in a "Tama Drafts" folder; append to Docs and write/append Sheet rows (asks first). There are no delete or share tools.
  - **Meeting reminders:** a sleeve-tug bubble + notification 5 minutes before an event.
  - **Morning brief** (once each morning, and `/brief`): today's events, important unread mail, open todos. The 💬 chat knows today's schedule too (read-only).
  - **Drive backup:** daily, to Drive's hidden app folder (keeps 7). `/google backups`, `/google restore <n>`. After sign-in on a new PC she offers to restore missing Tamas; a warning if the same Tama is awake on another PC.
  - `/google` (status, login, logout, brief, backup, backups, restore, readonly on|off) and `/newpc` checklist.
- **M5 extras** (D-035):
  - **Weather moments** (EVT-1): tell your Tama where you live with `/weather <city>` (Open-Meteo, no account or key). She notices thunderstorms, rainy days, very hot days (with a water quest) and cold or snowy days, and the 💬 chat knows the weather too. `/weather` shows it now, `/weather off` forgets the city. Offline? She just skips the weather.
  - **Fullscreen = quiet time** (PET-6): no pop-up moments while a game, video or slideshow fills the screen (Windows).
  - **Out for a walk** (SUM-5): when you hide your Tama, a tiny tab with her face peeks out from the right edge of the screen; click it to call her back. `/marker on|off`.
### Changed
- PermissionGate supports rules (Google reads/creations auto-allowed and announced; edits ask).
- `zod` is now a declared dependency (it was already installed as the Agent SDK's peer); it is unpacked with the SDK in the portable build.

## [0.5.0] — 2026-11-06 — M5 Events & memory
### Added
- **M5 events & memory** (D-033):
  - **Events** (EVT-1..3): your Tama starts little moments on her own: good morning, lunch check, afternoon slump, weekend plans, late-night "go to sleep", welcome back after a long absence, hungry/sleepy quests, a 7-day-streak party, bond level-ups, New Year / Valentine / Halloween / Christmas, her hatch-day, this-or-that questions, and memory callbacks. Defined as data in `assets/events/deck.json`; each line is written in character by Gemini (agy), with deck lines as a fallback.
  - **Event box** on the pet with answer buttons (and "later"); events also show in the 💬 chat history, and as a Windows notification when she's hidden. Answers grow the bond a little and can become memories.
  - **Memory** (EVT-4, NFR-4): she remembers facts you tell her in chat (hidden `[[remember]]` markers) or via answers. `/memory`, `/remember <fact>`, `/forget <n|all>`. Stored only on your PC, in the Tama's folder (moves with `.tama` exports).
  - **Diary:** every evening she writes a short page about your day from what really happened; `/diary`, `/diary list`, `/diary 2026-11-06`.
  - **Quiet & wellbeing** (PET-6/7): no pop-ups during focus sessions, `/dnd`, when you're away or she sleeps. Water and stretch nudges (`/nudges on|off`).
  - `/event [id]` starts a moment right away.

## [0.4.0] — 2026-11-06 — M4 Terminal v2
### Added
- **M4 terminal v2:**
  - **Themed from your Tama** (TERM-2, ART-4, D-032): "<Name> Code" title, the real character as a live title-bar avatar (works, gets startled by permission prompts, sparkles when done, click to summon), welcome banner with the motif, spinner words from their tics and catchphrases, prompt caret from their personality, colors from their palette with guaranteed readable contrast. The chat window and pet menu use the same theme.
  - **`/theme`** night · day · pastel · neon, unlocked by bond level (BOND-3); unlocks are announced.
  - **First-run tour** (`/tour` to see it again): what the terminal is for, `/cd`, speed controls, where chat lives.
  - **Commands** (TERM-4): `/stats`, `/chat [msg]`, `/wardrobe`, `/theme`, `/tour`; `/diary /event /phone /voice` say which milestone brings them.
  - **SAFE-4:** turning on accept-edits outside a git repo needs a second Shift+Tab (or `/mode acceptEdits confirm`).
  - **Pet menu revamp:** the long 10-button pill became a compact 5×2 card about the pet's width: a care row (feed, snack, play, bath, nap) and a together row (chat, terminal, focus, stats, restyle), with a caption naming the hovered button and a speech-bubble tail.
### Fixed
- A brand-new kero-pet import skipped the bond migration (state stamped v2 with the old `bond` field), so bond showed "NaN". Existing saves were not affected.
### Decisions
- D-032 — UI theme from the CharacterSpec; terminal variants unlocked by bond; UI prefs per PC.

## [0.3.1] — 2026-11-06 — M3 Brain & engines
### Added
- **M3 brain & engines** (released as 0.3.1, D-030):
  - **Chat window** 💬 (CHAT-1): talk with your Tama in her own colors. Gemini Flash via `agy` (read-only plan mode), can **search the web**, knows her stats and your day, and can explain how to use Tama. No Claude tokens. Open it from the pet menu 💬, the tray, or **Ctrl+Alt+J**. Her replies also appear in her speech bubble.
  - **Terminal = Claude Code only** (D-029): everything you type goes to Claude Code, which asks before edits and commands. Tama's local commands (`/todo`, `/focus`, `/cd`, …) still work.
  - **Live progress** (D-031): the spinner shows "Thinking… 3.0k chars" and "Writing index.html… 15.1k chars", plus the elapsed time and the model, instead of a silent minute.
  - **`/effort low|medium|high|xhigh|max|default`**: less thinking = faster answers (saved per PC, shown in the status bar). `/model sonnet|haiku|opus` for speed vs. smarts.
  - **PermissionGate:** one place for every tool approval; the chat brain's tool requests are auto-denied.
  - **Budget:** daily Claude usage (≈USD), 75% warning, heads-up when tight; `/budget`, `/engines`.
  - Onboarding shows whether agy (chat) and Claude Code (terminal) were found (ONB-7).
  - `npm run probe:agy` re-checks agy's safety behavior against the real CLI.
  - Dev: `TAMA_OPEN_CHAT`, `TAMA_CHAT_EVAL`; `TAMA_DEBUG` logs terminal engine events.
### Changed
- The M0 engine host is replaced by `src/main/brain`. Claude Code permission prompts go through the gate.
- Test runs with `TAMA_DATA_DIR` use their own Electron profile.
- The pet menu has a 💬 chat button (buttons slightly smaller to fit).
### Fixed
- Pet tests could keep the test runner alive after a failure; `npm test` now has per-test timeouts.
### Decisions
- D-026 — agy via ACP with Tama-owned settings (worker part superseded).
- D-027 — agy is read-only (plan mode) everywhere; edits only via Claude Code.
- D-028 — Brain design (routing part superseded by D-029).
- D-029 — Terminal = Claude Code only; chat window = agy only.
- D-030 — M3 is released as 0.3.1.
- D-031 — Thinking/tool progress and `/effort`.

## [0.3.0] — 2026-11-05 — M2 Pet loop v2 & lifecycle
### Added
- **M2 pet loop v2 & lifecycle** (branch `m2-pet-loop`):
  - **Easy energy (PET-3/4):** ⚡ snack (+25, 20-min cooldown), 💤 10-min power nap (+50), bedtime sleep, auto-nap while you're away or the screen is locked, charging on AC, resting while the app is closed; agent tasks cost only 1 energy; gentler decay.
  - **Bond (BOND-1..3):** open-ended XP with levels Stranger → Acquaintance → Buddy → Partner → Soulmate; XP from agent tasks, git commits, focus sessions, todos (daily caps); productive-day streaks with day 7/30 bonuses; level-up and streak celebrations.
  - **Productivity (PROD-1/2):** todos, notes, natural-time reminders, pomodoro focus (pet goes quiet with glasses, break gives energy), git commit watcher; terminal commands `/todo /done /todel /focus /remind /reminders /note /watch /unwatch /feed /snack /nap /tama`; ⏱️ in the pet menu.
  - **My Tamas (PORT-3..5, ONB-9):** several Tamas (those at home are paused), switch, hatch another, graduate to an album, restore, delete (typed name), password-encrypted `.tama` export/import (optionally with todos and Telegram connection), "Bring my Tama" on the first onboarding screen; tray → My Tamas….
### Changed
- `tama-state.json` schema v2 (bond 0..100 → bondXp ×12). New `user/productivity.json`.
- Renderer care actions are limited to an allow-list.
### Decisions
- D-023 — Pet balance v2.
- D-024 — Productivity data location; git watch per PC.
- D-025 — Roster lifecycle via relaunch; .tama format.

## [0.2.0] — 2026-11-05 — M1 Character & hatching
### Added
- **M1 character & hatching** (branch `m1-character`):
  - Shared character rig (`src/shared`): 5 back-hair, 4 front-hair, 6 headwear (frog/bunny/bear hoods, cat/fox ears + tails), 5 outfits, 3 shoes, 7 accessories, 3 eye styles. Every design gets the full expression set (ART-1..3).
  - CharacterSpec + `normalizeSpec` gate; palette derivation from 6 base colors; Kero-chan becomes a preset with her exact original colors.
  - New users start with a wobbling **egg**; clicking it opens onboarding (ONB-1).
  - **Onboarding window:** gender → describe → 3 variants (reroll or "change something" by chat) → name, personality sliders and colors → voice prompt with ▶ preview → hatch (ONB-2..6).
  - **Restyle** (🪄 in the pet menu, tray) and **Rebirth** (tray, optional keep-bond) for existing Tamas, including your imported Kero-chan.
  - Designer service: Claude Haiku with tools disabled and a JSON schema, plus an offline keyword designer (D-021).
  - Pet lines use the character's own tics, catchphrases and emoji (VOICE-2).
  - Dev tools: rig gallery (`TAMA_GALLERY`), scripted onboarding walkthrough (`TAMA_ONBOARD_WALK`), `TAMA_OFFLINE_DESIGNER`, `TAMA_OPEN_ONBOARDING`.
### Changed
- `character.json` schema v2 (full spec); M0 files migrate automatically.
- Character CSS moved from `pet.css` to shared `renderer/shared/rig.css`.
### Fixed
- Spec gate: junk accessories could push out valid ones (found by tests).
- Onboarding: refine/voice results showed only after the next click (stale re-render).
### Decisions
- D-022 — M8 voice: AivisSpeech local engine, built-in TTS fallback.
- D-020 — Character rig architecture.
- D-021 — M1 designer model choice and fallback.

## [0.1.0] — 2026-11-05 — M0 Foundation
### Added
- **M0 foundation** (branch `m0-foundation`): Electron app ported from kero-pet into the layered layout (platform / services / engines / channels / renderer).
- Event bus + topic registry; atomic JSON store with `schemaVersion` migrations; single-writer `device.json`; safeStorage secrets module (SAFE-2, PORT-1, PORT-2).
- Pet service: stats and actions moved out of the renderer into the main process (same numbers as kero-pet).
- Roster: first run creates the active Tama and imports your kero-pet save (bond, xp, pats kept).
- Claude Code engine ported from `agent.js` (split into session / message mapping / exe finder), exposed on the bus.
- **Summon** (SUM-1..4): Ctrl+Alt+P, tray left-click, tray menu, `/summon`, second launch; drag/walk clamped to screen; 30 s watchdog + display-change/resume checks; "tadaa" animation.
- Tests (30, `node:test`) + `npm run check` (tsc on JS + tests); `TAMA_SELFTEST=1` live summon check; `TAMA_DATA_DIR`, `TAMA_NO_LEGACY` dev env vars.
- `CHANGELOG.md` + `npm run changelog` commit-table generator.
### Fixed
- kero-pet bug: the pet could be dragged off-screen or lost behind windows and "Bring back" didn't work.
### Changed
- `log-decision` skill is explicitly scoped to the Tama repo only.
### Decisions
- D-015 — Versioning scheme, changelog, and repo-scoped decision log.
- D-016 — First run imports the kero-pet save.
- D-017 — Pet stats live in the main-process pet service.
- D-018 — Type-check config for TypeScript 7 on plain JS.
- D-019 — Summon semantics and watchdog.

## [0.0.0] — 2026-11-05 — Planning
### Docs
- PRD (requirements by ID and milestone), ARCHITECTURE, DECISIONS (D-001..D-014, incl. Gmail drafts-only), AGENTS.md rulebook, CLAUDE.md, `log-decision` skill.

---

## Commit history (generated: `npm run changelog`)
<!-- commit-history:start -->
### Unreleased
_No commits._

### v0.6.0
| Commit | Date | Type | Subject |
|---|---|---|---|
| `b610493` | 2026-11-06 | chore(release) | 0.6.0 |
| `b7cb12e` | 2026-11-06 | docs(changelog) | regenerate commit table |
| `6415e4a` | 2026-11-06 | docs | add D-035, update PRD, architecture and changelog for M5 extras |
| `0b3c72b` | 2026-11-06 | feat(events) | weather moments, fullscreen quiet time, walk marker (M5 extras) |
| `02f258d` | 2026-11-06 | feat(google) | M6 Google sign-in, Gmail drafts, Calendar, Drive/Docs/Sheets, backup |
| `ffa9a51` | 2026-11-06 | docs(changelog) | regenerate commit table for 0.5.0 |

### v0.5.0
| Commit | Date | Type | Subject |
|---|---|---|---|
| `efff939` | 2026-11-06 | chore(release) | 0.5.0 |
| `ee6667b` | 2026-11-06 | docs(changelog) | regenerate commit table |
| `1e69f3a` | 2026-11-06 | feat(events) | M5 events, memory and diary |
| `029d157` | 2026-11-06 | docs(changelog) | regenerate commit table for 0.4.0 |

### v0.4.0
| Commit | Date | Type | Subject |
|---|---|---|---|
| `aeed428` | 2026-11-06 | chore(release) | 0.4.0 |
| `d8693db` | 2026-11-06 | feat(pet) | compact 5x2 action menu with hover caption |
| `bafe08a` | 2026-11-06 | docs(changelog) | regenerate commit table |
| `73bd25e` | 2026-11-06 | feat(terminal) | M4 terminal v2 themed from the CharacterSpec, bond-unlocked themes, tour, commands |
| `f7abed6` | 2026-11-06 | docs(changelog) | regenerate commit table for 0.3.1 |

### v0.3.1
| Commit | Date | Type | Subject |
|---|---|---|---|
| `bcddd06` | 2026-11-06 | chore(release) | 0.3.1 |
| `d136bf8` | 2026-11-06 | feat(brain) | terminal = Claude Code only, chat window = agy only; live progress and /effort |
| `8a0670a` | 2026-11-06 | docs(changelog) | regenerate commit table |
| `e71df33` | 2026-11-06 | feat(brain) | M3 lite chat brain, hand-off to Claude Code, read-only agy, budget |
| `e0aa9fa` | 2026-11-05 | test(engines) | fix JSDoc type in agy engine test |
| `096380c` | 2026-11-05 | feat(engines) | ACP client, agy engine and PermissionGate (M3a) |
| `677f2d5` | 2026-11-05 | docs(decisions) | D-026 agy via ACP with Tama-owned settings (supersedes D-007) |
| `7363bb4` | 2026-11-05 | docs(changelog) | regenerate commit table for v0.3.0 |

### v0.3.0
| Commit | Date | Type | Subject |
|---|---|---|---|
| `98298fa` | 2026-11-05 | chore(release) | 0.3.0 |
| `5fa9787` | 2026-11-05 | docs(changelog) | regenerate commit table |
| `48dcf7e` | 2026-11-05 | feat(roster) | M2c several Tamas, graduate/restore/delete, .tama export and import |
| `d333c50` | 2026-11-05 | feat(productivity) | M2b todos, focus timer, reminders, notes, git watcher |
| `2ce8864` | 2026-11-05 | feat(pet) | M2a easy energy, bond levels, daily caps and streaks |
| `57142a1` | 2026-11-05 | docs(changelog) | regenerate commit table for v0.2.0 |

### v0.2.0
| Commit | Date | Type | Subject |
|---|---|---|---|
| `847c821` | 2026-11-05 | chore(release) | 0.2.0 |
| `817a2a5` | 2026-11-05 | docs(decisions) | add D-022, AivisSpeech as the M8 voice engine |
| `9b8fab9` | 2026-11-05 | docs(changelog) | regenerate commit table |
| `17a22c0` | 2026-11-05 | feat | M1 character rig, hatching onboarding, restyle and rebirth |
| `f3757b4` | 2026-11-05 | docs(changelog) | regenerate commit table for v0.1.0 |

### v0.1.0
| Commit | Date | Type | Subject |
|---|---|---|---|
| `cdb2ff2` | 2026-11-05 | chore(release) | 0.1.0 |
| `e891597` | 2026-11-05 | docs(changelog) | regenerate commit table |
| `1a1a8bb` | 2026-11-05 | feat | M0 foundation, layered core ported from kero-pet with working summon |
| `6911a56` | 2026-11-05 | docs | add CHANGELOG with generated commit table, scope decision log to this repo |

### v0.0.0
| Commit | Date | Type | Subject |
|---|---|---|---|
| `e38f277` | 2026-11-05 | docs | PRD, architecture, decision log, agent rules |
<!-- commit-history:end -->
