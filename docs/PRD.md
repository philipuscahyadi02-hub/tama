# Tama — Product Requirements Document

> **Living document.** Update it whenever scope changes. Requirement IDs are stable — never reuse
> or renumber an ID; mark dropped ones `~~struck~~` with a note. Bump the version + changelog at the bottom.

| | |
|---|---|
| **Version** | 0.16 |
| **Status** | v0.8.0 released (M0–M8). M9 (voice & polish) in progress on `m9-voice`; portable .exe postponed |
| **Owner** | philipuscahyadi02-hub |
| **Last updated** | 2026-11-06 |
| **Related** | [ARCHITECTURE.md](ARCHITECTURE.md) · [DECISIONS.md](DECISIONS.md) · [../AGENTS.md](../AGENTS.md) · [../CHANGELOG.md](../CHANGELOG.md) |

---

## 1. Vision

A **cute chibi-anime tamagotchi that is also a real agentic AI**. You design it on first launch
(gender, look, voice), it lives on your Windows desktop, and it does real work: coding through
Claude Code, cheap everyday tasks through Antigravity (`agy`), your Gmail/Calendar/Drive, and
reachable from your phone over Telegram — with **no server**, everything running on your PC.

The more productive you are together, the closer your bond gets.

*Elevator pitch:* "Claude Code's remote-control power, wearing a tamagotchi you designed yourself."

## 2. Goals & non-goals

**Goals**
- G1. A companion you *want* to keep open: charming, reactive, never punishing.
- G2. A real agent: code, files, email, calendar, docs — from desktop or phone.
- G3. Cheap to run: everyday chatter never burns Claude tokens.
- G4. Local-first & private: no hosted backend; data lives on your PC (+ optional your own Drive).
- G5. Portable & durable: the Tama survives app updates, character changes, and PC moves.

**Non-goals (for now)**
- Multi-user / public distribution, app-store releases, code signing.
- macOS/Linux support (keep code portable, but only Windows is tested).
- Non-anime / non-human character styles.
- A hosted web or mobile app (Telegram *is* the mobile client).
- Image-generation-based character art (we use a parameterized SVG rig).

## 3. User

Single user: a developer on Windows 11 who uses Claude Code and Antigravity, has a Google
account, and uses Telegram on their phone. Wants fun + productivity, comfortable with a
5-minute one-time setup (BotFather token, Google OAuth client).

## 4. Requirements

Priority: **P0** must-have for the milestone · **P1** should · **P2** nice-to-have.
Status: ☐ todo · ◐ in progress · ☑ done.

### 4.1 Onboarding — "Hatching" (ONB)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| ONB-1 | First launch shows a wobbling egg on the desktop; clicking starts onboarding. | P0 | M1 | ☑ |
| ONB-2 | Choose gender: Girl / Boy / Non-binary / Surprise me. Drives body/hair base, pronouns, default voice range. | P0 | M1 | ☑ |
| ONB-3 | Free-text **design prompt** ("describe your companion") with example chips; the lite brain turns it into a `CharacterSpec`. | P0 | M1 | ☑ |
| ONB-4 | Show 3 variants; pick / reroll / refine by chat ("make hair blue"). | P1 | M1 | ☑ |
| ONB-5 | Name + personality sliders (energy, tsundere, formality, chaos), prefilled from spec. | P0 | M1 | ☑ |
| ONB-6 | Free-text **voice prompt**; produces a `VoiceSpec` + playable preview; can regenerate. | P0 | M1 | ☑ |
| ONB-7 | Detect & smoke-test engines (`claude`, `agy`); show login instructions if missing. | P0 | M3 | ☑ |
| ONB-8 | Optional steps: Telegram pairing, Google sign-in. Skippable, available later in settings. | P1 | M6/M7 | ◐ |
| ONB-9 | First screen offers "Hatch new 🥚" or "Bring my Tama 📦" (import/restore). | P0 | M2 | ☑ |

### 4.2 Character & art (ART)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| ART-1 | Chibi anime style only. Layered SVG rig: base body (per gender), hair, motif headwear (hood/ears/tail), outfit, accessories, palette. | P0 | M1 | ☑ |
| ART-2 | The model **selects and recolors** parts from the library; it never free-draws the core body. | P0 | M1 | ☑ |
| ART-3 | Full expression set works for every design: happy, sparkle, blush, pout, teary, shock, dizzy, smug, sleep, focus (glasses), sad. | P0 | M1 | ☑ |
| ART-4 | Character palette/motif drives UI theme tokens (terminal, menus, bubbles). | P0 | M4 | ☑ |
| ART-5 | Render current expression to PNG (for Telegram status/stickers). | P1 | M7 | ☑ |
| ART-6 | Optional model-generated accessory SVG, sanitized and bounded. | P2 | later | ☐ |

### 4.3 Pet loop (PET)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| PET-1 | Stats: Tummy, Mood, Energy, Clean, Bond. Real-time decay incl. while closed (cap 48h). | P0 | M2 | ☑ |
| PET-2 | **Never dies.** Neglect → sad/sulky only. | P0 | M2 | ☑ |
| PET-3 | Easy energy: snack/energy drink (+25, cooldown), 10-min power nap (+50), charging when on AC power, auto-nap when PC idle >10 min (+30/h), focus-break recharge. | P0 | M2 | ☑ |
| PET-4 | Agent work drains little (−1 per coding task); chatting costs no energy. | P0 | M2 | ☑ |
| PET-5 | Interactions from kero-pet kept: click menu, head-pat rub, cheek poke, drag, wander, babble. | P0 | M1 | ☑ |
| PET-6 | Do-not-disturb: no babble during fullscreen apps, meetings (calendar), or focus sessions. *(Focus, `/dnd`, away, asleep, fullscreen (D-035) and calendar meetings (D-034) all done.)* | P1 | M5 | ☑ |
| PET-7 | Wellbeing nudges: water, stretch, late-night "go to sleep". Toggleable. | P2 | M5 | ☑ |
| PET-8 | Reduced-motion and mute options. | P1 | M9 | ☐ |

### 4.4 Bond & productivity (BOND / PROD)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| BOND-1 | Bond XP from productivity: agent task done +2, git commit in watched repo +1 (cap 10/day), focus session +3, todo done +1, daily streak +1 (bonus at 7/30), finished calendar focus block +2, pats/play small & capped. | P0 | M2 | ☑ |
| BOND-2 | Diminishing returns after a daily cap (anti-farming). | P0 | M2 | ☑ |
| BOND-3 | Levels: Stranger → Acquaintance → Buddy → Partner → Soulmate. Unlock outfits, themes, events, voice lines, proactive behaviors. *(Terminal themes done in M4, D-032.)* | P1 | M2 | ◐ |
| BOND-4 | **Bond never unlocks permissions** or weakens safety. | P0 | M2 | ☑ |
| PROD-1 | Todos (`/todo`), focus timer (`/focus 25`), reminders (`/remind`), notes (`/note`). Shared across desktop & Telegram. | P0 | M2 | ☑ |
| PROD-2 | Git commit watcher for user-chosen repos. | P1 | M2 | ☑ |
| PROD-3 | Google Tasks sync for todos. | P2 | M6 | ☐ |

### 4.5 Events & conversations (EVT)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| EVT-1 | Event engine with triggers: time of day, weekday/weekend, holidays, Tama birthday, weather (Open-Meteo), stat states, productivity milestones, long absence, late-night coding, random. Per-event cooldowns and `minBond`. *(D-033; weather via a per-PC city set with `/weather <city>`, D-035.)* | P0 | M5 | ☑ |
| EVT-2 | Event types: chat topics, VN-style choices (2–3 options affecting mood/bond), mini-quests, memory callbacks, daily diary. | P0 | M5 | ☑ |
| EVT-3 | Events defined as data (deck JSON); lines generated in-character by the lite brain from a seed. | P0 | M5 | ☑ |
| EVT-4 | Memory: facts about the user, viewable ("what do you remember?") and forgettable. | P0 | M5 | ☑ |

### 4.6 Brain & engines (BRAIN / ENG)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| BRAIN-1 | Two surfaces (D-029): the **terminal** sends everything to Claude Code (Tama's own `/commands` run locally, unknown `/x` forwarded); the **chat window** talks to the chat brain. | P0 | M3 | ☑ |
| BRAIN-2 | Chat brain: Gemini Flash via `agy` only (no files/commands: hard guard hook; web search; Google tools with confirmations); no Claude fallback (D-029, D-037). | P0 | M3 | ☑ |
| BRAIN-3 | Fixed policy (D-029): chat/events/diary → agy; code & productivity work → Claude Code. Speed controls in the terminal: `/model`, `/effort` (D-031). | P0 | M3 | ☑ |
| BRAIN-4 | Budget: daily Claude usage estimate, 75% warning and an in-character heads-up when tight; no automatic engine switch (D-029). | P1 | M3 | ☑ |
| BRAIN-5 | Persona: cute in chat, **never** in code, commit messages, or file contents. | P0 | M3 | ☑ |
| ENG-1 | `ClaudeCodeEngine` via Claude Agent SDK (ported from kero-pet `agent.js`): streaming, permissions, interrupt, modes, model, resume. | P0 | M3 | ☑ |
| ENG-2 | `AgyEngine` drives `agy acp` (Agent Client Protocol over stdio), one persistent process per session (D-026). | P0 | M3 | ☑ |
| ENG-3 | `agy` via ACP with Tama-owned settings; **always read-only plan mode**, used only for chat (D-026, D-027, D-029); its tool requests are auto-denied by the PermissionGate. | P0 | M3 | ☑ |
| CHAT-1 | Chat window with the Tama (pet menu 💬, tray, Ctrl+Alt+J): streaming replies, web-search lines, themed from the CharacterSpec, replies also in the pet bubble; she can explain how to use Tama. | P0 | M3 | ☑ |
| ENG-4 | Uniform engine event contract (`text-delta`, `tool`, `tool-result`, `permission`, `todo`, `result`, `status`, `error`). | P0 | M3 | ☑ |
| ENG-5 | Never extract or reuse another app's OAuth tokens; each engine uses its own CLI login. | P0 | M3 | ☑ |
| ENG-6 | Additional engines (Codex, Gemini CLI) via the same interface. | P2 | later | ☐ |

### 4.7 Terminal (TERM)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| TERM-1 | Claude-Code-style terminal (from kero-pet): streaming, tool lines, diffs, todo lists, permission prompts, Shift+Tab modes, Esc interrupt, history. | P0 | M4 | ☑ |
| TERM-2 | Themed from CharacterSpec: colors, prompt glyph, spinner frames, banner, corner avatar that reacts live. | P0 | M4 | ☑ |
| TERM-3 | ~~Chat mode and code mode; engine badge~~ → replaced by the separate chat window (D-029). Terminal shows live thinking / writing progress (D-031) and a first-run tour (`/tour`). | P0 | M4 | ☑ |
| TERM-4 | Commands: `/chat /todo /focus /remind /note /feed /snack /nap /stats /theme /tour /tama /wardrobe /summon /model /effort /mode /budget`; `/memory /remember /forget /diary /event /dnd /nudges` (M5), `/phone` (M7), `/voice` (M8) says when it arrives; unknown `/x` forwarded to Claude Code. | P0 | M4 | ☑ |

### 4.8 Summon & window reliability (SUM)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| SUM-1 | Single `summon()`: show + restore, re-assert always-on-top + moveTop, clamp to display under cursor, wake, "tadaa" animation. | P0 | M0 | ☑ |
| SUM-2 | Triggers: global hotkey `Ctrl+Alt+P`, tray left-click, tray menu, `/summon` (terminal & Telegram), second-instance launch. | P0 | M0 | ☑ |
| SUM-3 | Drag & walk clamped to visible work areas (all monitors). Saved position validated against current displays. | P0 | M0 | ☑ |
| SUM-4 | 30-s watchdog: if off-screen or lost topmost, fix it. | P0 | M0 | ☑ |
| SUM-5 | "Out for a walk" edge marker — click to recall. *(Desktop-only; shown while the pet is hidden, `/marker on` / `off`, D-035.)* | P2 | M5 | ☑ |

### 4.9 Telegram / phone (TG)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| TG-1 | Bot API **long polling** from the PC; no webhook, no server. | P0 | M7 | ☑ |
| TG-2 | Pairing: paste BotFather token → QR / deep link with one-time code → bind to one chat ID; ignore all others. | P0 | M7 | ☑ |
| TG-3 | Chat with the Tama in character; voice notes both ways. *(Text chat done in M7; voice notes in M9.)* | P0 / P1 | M7/M9 | ◐ |
| TG-4 | Productivity: `/todo /focus /remind`, morning brief, evening recap. | P0 | M7 | ☑ |
| TG-5 | Pet: `/feed /nap /status` (status replies with expression PNG). `/summon`. | P1 | M7 | ☑ |
| TG-6 | Remote control: `/code <task>` in allow-listed repos; progress updates; **permission prompts as inline buttons** (Yes / Always / No); diffs as file attachments; `/stop`. | P0 | M7 | ☑ |
| TG-7 | Remote sessions default to ask-every-tool; kill switch; desktop announces every remote action. | P0 | M7 | ☑ |
| TG-8 | On quit, bot bio set to "💤 sleeping"; optional keep-PC-awake while remote mode is on. | P2 | M7 | ☑ |

### 4.10 Google (GOOG)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| GOOG-1 | Desktop OAuth (loopback + PKCE) with the user's own Google Cloud client in **Production (unverified)** status (Testing expires tokens in 7 days). Tokens in `secrets` only. | P0 | M6 | ☑ |
| GOOG-2 | Google tools exposed as an MCP server, plugged into **every** engine. *(Claude Code in-process; the agy chat brain via a local relay with Tama-side confirmations, D-034, D-037.)* | P0 | M6 | ☑ |
| GOOG-3 | Calendar: read, create/edit events (places checked against Google Maps / pasted Maps links, D-039); meeting reminders (sleeve-tug 5 min before) and DND during meetings. | P0 | M6 | ☑ |
| GOOG-4 | Gmail: read/search, summarize, create drafts; **send only after the user confirms the full draft** (D-038, was drafts-only D-014). | P0 | M6 | ☑ |
| GOOG-5 | Drive: `drive.file` by default (create/edit own files); optional `drive.readonly` toggle for search/read across Drive. | P0 | M6 | ☑ |
| GOOG-6 | Docs: create from Markdown, append, replace section. Sheets: create with tabs/headers/formulas, write range, append rows. *(All but "replace section".)* | P0 | M6 | ◐ |
| GOOG-7 | All created files go to a "Tama Drafts" folder; creation announced (chat brain: confirmed); edits and anything that sends (email, invitations) require approval; **no delete/share tools exist** (D-038). | P0 | M6 | ☑ |
| GOOG-8 | Morning brief: today's events, important unread mail, todos (desktop + Telegram). | P1 | M6 | ☑ |

### 4.10b Usage & accounts (USE)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| USE-1 | Usage log of every AI turn and service call Tama makes (Claude, Gemini/agy, Google APIs, Telegram): time, where, operation, model, tokens (in/out/cache), API-equivalent $, duration, ok. **Numbers only**, never contents; local, 3 months. | P0 | M8 | ☑ |
| USE-2 | Dashboard (tray "Usage & accounts…", `/usage`): accounts, totals per service, per-day chart (calls/tokens/$), filterable log, CSV export. | P0 | M8 | ☑ |
| USE-3 | Claude plan limits (5-hour / weekly utilization, reset time) from the Agent SDK. | P1 | M8 | ☑ |
| USE-5 | **Limits tab:** Claude plan windows as % **left** (5-hour, weekly, per model), reset countdowns, extra-usage credits, 7-day trend; live check on demand (no message, $0) + after each turn. | P0 | M8 | ☑ |
| USE-6 | Gemini: plan tier, today's usage, warning when Gemini reports the quota used up (agy shares no remaining-quota number). Google: calls this month per API; billable Places calls vs a user-set monthly cap; links to the project's quota and billing pages. | P1 | M8 | ☑ |
| USE-7 | Warnings (pet bubble) when a Claude window falls below user-set thresholds (default 25 % and 10 % left), once per window. | P1 | M8 | ☑ |
| USE-4 | Accounts: show who is signed in (Claude: email + plan + login expiry; Gemini/agy: email; Google: email + project + scopes + places mode; Telegram: bot + paired) and switch each via the official sign-in (Claude/agy console window, Google account picker, Google project change, Telegram re-setup); sessions restart on the new account. | P0 | M8 | ☑ |

### 4.11 Voice (VOICE)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| VOICE-1 | `VoiceProvider` interface; main provider = **AivisSpeech** local engine (anime voices, D-022); fallback = built-in Windows / Web Speech TTS (pitch, rate from `VoiceSpec`). | P0 | M9 | ☐ |
| VOICE-2 | Speaking style (tics, catchphrase frequency) from the same voice prompt. | P0 | M1 | ☑ |
| VOICE-3 | Other providers pluggable later (e.g. ElevenLabs Voice Design, paid; Kokoro for English). | P2 | later | ☐ |
| VOICE-4 | STT for Telegram voice notes (local whisper.cpp, optional download). | P2 | later | ☐ |

### 4.12 Portability & lifecycle (PORT)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| PORT-1 | Storage split: Tama "soul" (`tamas/<id>/`) vs device config (`device.json`) vs secrets (`secrets.bin`, safeStorage). | P0 | M0 | ☑ |
| PORT-2 | Every persisted file has `schemaVersion`; forward migrations run on load. | P0 | M0 | ☑ |
| PORT-3 | Roster: multiple Tamas, one active; inactive ones pause decay. | P1 | M2 | ☑ |
| PORT-4 | Restyle (keep all), Rebirth (redesign; choose keep/clear memory & bond), Hatch another, Graduate (album; restorable), Delete (typed confirm). | P1 | M2 | ☑ |
| PORT-5 | `.tama` export/import: single bundle file (D-025), password-encrypted by default; optional "include connections" (Telegram token). | P0 | M2 | ☑ |
| PORT-6 | Daily Drive backup to `appDataFolder` (`drive.appdata`); restore offer on new PC. | P1 | M6 | ☑ |
| PORT-7 | Single active device lock (lease file in Drive); "move her here?" takeover. *(Lease + warning, not a hard lock, D-034.)* | P1 | M6 | ◐ |
| PORT-8 | New-PC checklist: log in `claude`/`agy`, Google sign-in, Telegram re-pair if needed. | P1 | M6 | ☑ |

### 4.13 Safety, privacy & non-functional (SAFE / NFR)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| SAFE-1 | One `PermissionGate` for every tool approval from every engine and every channel. | P0 | M3 | ☑ |
| SAFE-2 | Secrets only via the secrets module; never logged, never in plain JSON, never in exports without password. | P0 | M0 | ☑ |
| SAFE-3 | Telegram accepts only the paired chat ID. | P0 | M7 | ☑ |
| SAFE-4 | Warn before accept-edits mode outside a git repo. | P1 | M4 | ☑ |
| SAFE-5 | Daily cost/token budget shown in `/stats`; Tama warns near the limit. | P1 | M3 | ☑ |
| NFR-1 | Idle CPU < 2%, RAM < 300 MB (excluding engine processes). | P1 | M9 | ☐ |
| NFR-2 | Multi-monitor & mixed-DPI safe. | P0 | M0 | ◐ |
| NFR-3 | Ships as a portable `.exe` (electron-builder), uses installed `claude`/`agy`. *(Postponed by the user, 2026-11-06.)* | P0 | later | ☐ |
| NFR-4 | Memory view + forget; local-only data except the user's own Drive backup. | P0 | M5 | ☑ |

## 5. Milestones

Check off when *all P0 rows* for that milestone are ☑. Update the "Status" line at the top.

- [x] **M0 — Foundation.** *(code complete; NFR-2 needs a real mixed-DPI check)* Scaffold from kero-pet, service split, event bus, store/secrets/migrations, summon fix (SUM-1..4, PORT-1..2, SAFE-2, NFR-2).
- [x] **M1 — Character & hatching.** *(code complete)* SVG rig, parts library, CharacterSpec, onboarding (ONB-1..6, ART-1..3, PET-5, VOICE-2).
- [x] **M2 — Pet loop v2 & lifecycle.** *(code complete; BOND-3 unlock effects arrive with themes in M4 and events in M5)* Energy, bond, productivity, roster, export/import (PET-1..4, BOND-*, PROD-1..2, PORT-3..5, ONB-9).
- [x] **M3 — Brain & engines.** *(released as 0.3.1)* Claude Code terminal + agy chat window, PermissionGate, budget (BRAIN-*, ENG-1..5, CHAT-1, SAFE-1, SAFE-5, ONB-7).
- [x] **M4 — Terminal v2.** *(released as 0.4.0)* Theming from the CharacterSpec (no more hard-coded Kero), commands, first-run tour (TERM-*, ART-4, SAFE-4).
- [x] **M5 — Events & memory.** *(released as 0.5.0; weather, fullscreen DND and SUM-5 deferred)* (EVT-*, PET-6..7, NFR-4, SUM-5).
- [x] **M6 — Google.** *(released as 0.6.0; Tasks sync, Docs replace-section and a hard device lock deferred)* OAuth, MCP tools, Gmail/Calendar/Drive/Docs/Sheets, Drive backup (GOOG-*, PORT-6..8, PROD-3).
- [x] **M7 — Telegram.** *(released as 0.7.0; voice notes in M9)* (TG-*, ART-5, SAFE-3).
- [x] **M8 — Usage & accounts dashboard.** *(released as 0.8.0)* Usage log, dashboard, Limits tab (what's left), account switching (USE-1..7, D-040, D-041).
- [ ] **M9 — Voice & polish.** AivisSpeech voice, voice notes on Telegram, reduced motion/mute, performance (VOICE-1, VOICE-4, TG-3 voice, PET-8, NFR-1). Portable .exe postponed.

## 6. Open questions

| ID | Question | Default until answered |
|---|---|---|
| ~~Q1~~ | ~~Gmail sending?~~ | Resolved: drafts only (D-014) |
| Q2 | Final product name? | "Tama" (each Tama is named in onboarding) |
| Q3 | Git commit watcher: which repos by default? | None; user adds |

## 7. Changelog
- **0.16 — 2026-11-06** — Limits tab: what's left per service, trend, warnings (USE-5..7, D-041).
- **0.15 — 2026-11-06** — M8 is now the usage & accounts dashboard (USE-1..4, D-040); voice and polish moved to M9.
- **0.14 — 2026-11-06** — Event places verified on Google Maps before creating (D-039).
- **0.13 — 2026-11-06** — Sending email and calendar invitations allowed after the user confirms the full content (D-038 supersedes D-014).
- **0.12 — 2026-11-06** — Chat brain does Google itself with confirmations; hard read-only guard for agy (D-037). GOOG-2 done.
- **0.11 — 2026-11-06** — M7 implemented: TG-1,2,4..8, SAFE-3, ART-5 done; TG-3 text done (voice in M8) (D-036).
- **0.10 — 2026-11-06** — M6 implemented: GOOG-1,3,4,5,7,8, PORT-6, PORT-8 done; GOOG-2, GOOG-6, PORT-7 partial; PROD-3 open (D-034).
- **0.9 — 2026-11-06** — M5 implemented: EVT-2..4, NFR-4, PET-7 done; EVT-1 and PET-6 partial (D-033).
- **0.8 — 2026-11-06** — M4 implemented: TERM-1..4, ART-4, SAFE-4; BOND-3 terminal themes (D-032).
- **0.7 — 2026-11-06** — Terminal = Claude Code only, chat window = agy only (D-029, CHAT-1); M3 ships as 0.3.1 (D-030); progress + `/effort` (D-031).
- **0.6 — 2026-11-06** — M3 implemented: BRAIN-1..5, ENG-1..5, SAFE-1, SAFE-5, ONB-7. agy is read-only (D-027).
- **0.5 — 2026-11-05** — M2 implemented: PET-1..4, BOND-1/2/4, PROD-1/2, PORT-3..5, ONB-9 done; BOND-3 levels done, unlock effects in M4/M5.
- **0.4 — 2026-11-05** — M1 implemented: ONB-1..6, ART-1..3, VOICE-2 done; PORT-4 partial (restyle + rebirth; graduate/delete in M2).
- **0.3 — 2026-11-05** — M0 implemented: SUM-1..4, PORT-1..2, SAFE-2, PET-5 done; NFR-2 and PET-1 partial. SUM-2's Telegram trigger lands in M7.
- **0.2 — 2026-11-05** — Q1 resolved: Gmail drafts only (D-014).
- **0.1 — 2026-11-05** — Initial draft from planning sessions (requirements 1–9 + engines, Google incl. Drive, portability).
