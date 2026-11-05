# Tama — Product Requirements Document

> **Living document.** Update it whenever scope changes. Requirement IDs are stable — never reuse
> or renumber an ID; mark dropped ones `~~struck~~` with a note. Bump the version + changelog at the bottom.

| | |
|---|---|
| **Version** | 0.4 |
| **Status** | v0.2.0 released (M0, M1). M2 in progress on `m2-pet-loop` |
| **Owner** | philipuscahyadi02-hub |
| **Last updated** | 2026-11-05 |
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
| ONB-7 | Detect & smoke-test engines (`claude`, `agy`); show login instructions if missing. | P0 | M3 | ☐ |
| ONB-8 | Optional steps: Telegram pairing, Google sign-in. Skippable, available later in settings. | P1 | M6/M7 | ☐ |
| ONB-9 | First screen offers "Hatch new 🥚" or "Bring my Tama 📦" (import/restore). | P0 | M2 | ☐ |

### 4.2 Character & art (ART)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| ART-1 | Chibi anime style only. Layered SVG rig: base body (per gender), hair, motif headwear (hood/ears/tail), outfit, accessories, palette. | P0 | M1 | ☑ |
| ART-2 | The model **selects and recolors** parts from the library; it never free-draws the core body. | P0 | M1 | ☑ |
| ART-3 | Full expression set works for every design: happy, sparkle, blush, pout, teary, shock, dizzy, smug, sleep, focus (glasses), sad. | P0 | M1 | ☑ |
| ART-4 | Character palette/motif drives UI theme tokens (terminal, menus, bubbles). | P0 | M4 | ☐ |
| ART-5 | Render current expression to PNG (for Telegram status/stickers). | P1 | M7 | ☐ |
| ART-6 | Optional model-generated accessory SVG, sanitized and bounded. | P2 | later | ☐ |

### 4.3 Pet loop (PET)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| PET-1 | Stats: Tummy, Mood, Energy, Clean, Bond. Real-time decay incl. while closed (cap 48h). | P0 | M2 | ◐ |
| PET-2 | **Never dies.** Neglect → sad/sulky only. | P0 | M2 | ☐ |
| PET-3 | Easy energy: snack/energy drink (+25, cooldown), 10-min power nap (+50), charging when on AC power, auto-nap when PC idle >10 min (+30/h), focus-break recharge. | P0 | M2 | ☐ |
| PET-4 | Agent work drains little (−1 per coding task); chatting costs no energy. | P0 | M2 | ☐ |
| PET-5 | Interactions from kero-pet kept: click menu, head-pat rub, cheek poke, drag, wander, babble. | P0 | M1 | ☑ |
| PET-6 | Do-not-disturb: no babble during fullscreen apps, meetings (calendar), or focus sessions. | P1 | M5 | ☐ |
| PET-7 | Wellbeing nudges: water, stretch, late-night "go to sleep". Toggleable. | P2 | M5 | ☐ |
| PET-8 | Reduced-motion and mute options. | P1 | M8 | ☐ |

### 4.4 Bond & productivity (BOND / PROD)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| BOND-1 | Bond XP from productivity: agent task done +2, git commit in watched repo +1 (cap 10/day), focus session +3, todo done +1, daily streak +1 (bonus at 7/30), finished calendar focus block +2, pats/play small & capped. | P0 | M2 | ☐ |
| BOND-2 | Diminishing returns after a daily cap (anti-farming). | P0 | M2 | ☐ |
| BOND-3 | Levels: Stranger → Acquaintance → Buddy → Partner → Soulmate. Unlock outfits, themes, events, voice lines, proactive behaviors. | P1 | M2 | ☐ |
| BOND-4 | **Bond never unlocks permissions** or weakens safety. | P0 | M2 | ☐ |
| PROD-1 | Todos (`/todo`), focus timer (`/focus 25`), reminders (`/remind`), notes (`/note`). Shared across desktop & Telegram. | P0 | M2 | ☐ |
| PROD-2 | Git commit watcher for user-chosen repos. | P1 | M2 | ☐ |
| PROD-3 | Google Tasks sync for todos. | P2 | M6 | ☐ |

### 4.5 Events & conversations (EVT)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| EVT-1 | Event engine with triggers: time of day, weekday/weekend, holidays, Tama birthday, weather (Open-Meteo), stat states, productivity milestones, long absence, late-night coding, random. Per-event cooldowns and `minBond`. | P0 | M5 | ☐ |
| EVT-2 | Event types: chat topics, VN-style choices (2–3 options affecting mood/bond), mini-quests, memory callbacks, daily diary. | P0 | M5 | ☐ |
| EVT-3 | Events defined as data (deck JSON); lines generated in-character by the lite brain from a seed. | P0 | M5 | ☐ |
| EVT-4 | Memory: facts about the user, viewable ("what do you remember?") and forgettable. | P0 | M5 | ☐ |

### 4.6 Brain & engines (BRAIN / ENG)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| BRAIN-1 | Router: `/command` → local or forwarded; otherwise lite brain answers; lite brain can `escalate()` to a worker engine. Manual override `@code`, `@chat`, `@claude`, `@agy`. | P0 | M3 | ☐ |
| BRAIN-2 | Lite brain default: Gemini Flash via `agy`; fallback: Haiku via Claude login. | P0 | M3 | ☐ |
| BRAIN-3 | Editable routing policy (`/engine`, settings). Default: chat/events/diary → cheap; code → Claude. | P0 | M3 | ☐ |
| BRAIN-4 | Budget fallback: near Claude limits, auto-route to `agy` with an in-character notice. | P1 | M3 | ☐ |
| BRAIN-5 | Persona: cute in chat, **never** in code, commit messages, or file contents. | P0 | M3 | ☐ |
| ENG-1 | `ClaudeCodeEngine` via Claude Agent SDK (ported from kero-pet `agent.js`): streaming, permissions, interrupt, modes, model, resume. | P0 | M3 | ☐ |
| ENG-2 | `AgyEngine` drives `agy` CLI headless (`-p --output-format stream-json --input-format stream-json`), persistent process per session. | P0 | M3 | ☐ |
| ENG-3 | **`agy` must never run in `always-proceed`** (its headless default). Force ask/plan mode; all tool approvals go through Tama's PermissionGate. | P0 | M3 | ☐ |
| ENG-4 | Uniform engine event contract (`text-delta`, `tool`, `tool-result`, `permission`, `todo`, `result`, `status`, `error`). | P0 | M3 | ☐ |
| ENG-5 | Never extract or reuse another app's OAuth tokens; each engine uses its own CLI login. | P0 | M3 | ☐ |
| ENG-6 | Additional engines (Codex, Gemini CLI) via the same interface. | P2 | later | ☐ |

### 4.7 Terminal (TERM)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| TERM-1 | Claude-Code-style terminal (from kero-pet): streaming, tool lines, diffs, todo lists, permission prompts, Shift+Tab modes, Esc interrupt, history. | P0 | M4 | ☐ |
| TERM-2 | Themed from CharacterSpec: colors, prompt glyph, spinner frames, banner, corner avatar that reacts live. | P0 | M4 | ☐ |
| TERM-3 | Chat mode and code mode; engine badge on each reply. | P0 | M4 | ☐ |
| TERM-4 | Commands: `/chat /code /engine /todo /focus /remind /note /feed /nap /stats /diary /event /voice /summon /phone /theme /tama /wardrobe`; unknown `/x` forwarded to the active engine. | P0 | M4 | ☐ |

### 4.8 Summon & window reliability (SUM)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| SUM-1 | Single `summon()`: show + restore, re-assert always-on-top + moveTop, clamp to display under cursor, wake, "tadaa" animation. | P0 | M0 | ☑ |
| SUM-2 | Triggers: global hotkey `Ctrl+Alt+P`, tray left-click, tray menu, `/summon` (terminal & Telegram), second-instance launch. | P0 | M0 | ☑ |
| SUM-3 | Drag & walk clamped to visible work areas (all monitors). Saved position validated against current displays. | P0 | M0 | ☑ |
| SUM-4 | 30-s watchdog: if off-screen or lost topmost, fix it. | P0 | M0 | ☑ |
| SUM-5 | "Out for a walk" edge marker — click to recall. | P2 | M5 | ☐ |

### 4.9 Telegram / phone (TG)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| TG-1 | Bot API **long polling** from the PC; no webhook, no server. | P0 | M7 | ☐ |
| TG-2 | Pairing: paste BotFather token → QR / deep link with one-time code → bind to one chat ID; ignore all others. | P0 | M7 | ☐ |
| TG-3 | Chat with the Tama in character; voice notes both ways. | P0 / P1 | M7/M8 | ☐ |
| TG-4 | Productivity: `/todo /focus /remind`, morning brief, evening recap. | P0 | M7 | ☐ |
| TG-5 | Pet: `/feed /nap /status` (status replies with expression PNG). `/summon`. | P1 | M7 | ☐ |
| TG-6 | Remote control: `/code <task>` in allow-listed repos; progress updates; **permission prompts as inline buttons** (Yes / Always / No); diffs as file attachments; `/stop`. | P0 | M7 | ☐ |
| TG-7 | Remote sessions default to ask-every-tool; kill switch; desktop announces every remote action. | P0 | M7 | ☐ |
| TG-8 | On quit, bot bio set to "💤 sleeping"; optional keep-PC-awake while remote mode is on. | P2 | M7 | ☐ |

### 4.10 Google (GOOG)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| GOOG-1 | Desktop OAuth (loopback + PKCE) with the user's own Google Cloud client in **Production (unverified)** status (Testing expires tokens in 7 days). Tokens in `secrets` only. | P0 | M6 | ☐ |
| GOOG-2 | Google tools exposed as an MCP server, plugged into **every** engine. | P0 | M6 | ☐ |
| GOOG-3 | Calendar: read, create/edit events; meeting reminders (sleeve-tug 5 min before) and DND during meetings. | P0 | M6 | ☐ |
| GOOG-4 | Gmail: read/search, summarize, create drafts. **No sending** (D-014). | P0 | M6 | ☐ |
| GOOG-5 | Drive: `drive.file` by default (create/edit own files); optional `drive.readonly` toggle for search/read across Drive. | P0 | M6 | ☐ |
| GOOG-6 | Docs: create from Markdown, append, replace section. Sheets: create with tabs/headers/formulas, write range, append rows. | P0 | M6 | ☐ |
| GOOG-7 | All created files go to a "Tama Drafts" folder; creation auto-allowed + announced; edits of existing files require approval; **no delete/share tools exist**. | P0 | M6 | ☐ |
| GOOG-8 | Morning brief: today's events, important unread mail, todos (desktop + Telegram). | P1 | M6 | ☐ |

### 4.11 Voice (VOICE)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| VOICE-1 | `VoiceProvider` interface; main provider = **AivisSpeech** local engine (anime voices, D-022); fallback = built-in Windows / Web Speech TTS (pitch, rate from `VoiceSpec`). | P0 | M8 | ☐ |
| VOICE-2 | Speaking style (tics, catchphrase frequency) from the same voice prompt. | P0 | M1 | ☑ |
| VOICE-3 | Other providers pluggable later (e.g. ElevenLabs Voice Design, paid; Kokoro for English). | P2 | later | ☐ |
| VOICE-4 | STT for Telegram voice notes (local whisper.cpp, optional download). | P2 | later | ☐ |

### 4.12 Portability & lifecycle (PORT)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| PORT-1 | Storage split: Tama "soul" (`tamas/<id>/`) vs device config (`device.json`) vs secrets (`secrets.bin`, safeStorage). | P0 | M0 | ☑ |
| PORT-2 | Every persisted file has `schemaVersion`; forward migrations run on load. | P0 | M0 | ☑ |
| PORT-3 | Roster: multiple Tamas, one active; inactive ones pause decay. | P1 | M2 | ☐ |
| PORT-4 | Restyle (keep all), Rebirth (redesign; choose keep/clear memory & bond), Hatch another, Graduate (album; restorable), Delete (typed confirm). | P1 | M2 | ◐ |
| PORT-5 | `.tama` export/import: zip, password-encrypted by default; optional "include connections" (Telegram token). | P0 | M2 | ☐ |
| PORT-6 | Daily Drive backup to `appDataFolder` (`drive.appdata`); restore offer on new PC. | P1 | M6 | ☐ |
| PORT-7 | Single active device lock (lease file in Drive); "move her here?" takeover. | P1 | M6 | ☐ |
| PORT-8 | New-PC checklist: log in `claude`/`agy`, Google sign-in, Telegram re-pair if needed. | P1 | M6 | ☐ |

### 4.13 Safety, privacy & non-functional (SAFE / NFR)
| ID | Requirement | Pri | MS | Status |
|---|---|---|---|---|
| SAFE-1 | One `PermissionGate` for every tool approval from every engine and every channel. | P0 | M3 | ☐ |
| SAFE-2 | Secrets only via the secrets module; never logged, never in plain JSON, never in exports without password. | P0 | M0 | ☑ |
| SAFE-3 | Telegram accepts only the paired chat ID. | P0 | M7 | ☐ |
| SAFE-4 | Warn before accept-edits mode outside a git repo. | P1 | M4 | ☐ |
| SAFE-5 | Daily cost/token budget shown in `/stats`; Tama warns near the limit. | P1 | M3 | ☐ |
| NFR-1 | Idle CPU < 2%, RAM < 300 MB (excluding engine processes). | P1 | M8 | ☐ |
| NFR-2 | Multi-monitor & mixed-DPI safe. | P0 | M0 | ◐ |
| NFR-3 | Ships as a portable `.exe` (electron-builder), uses installed `claude`/`agy`. | P0 | M8 | ☐ |
| NFR-4 | Memory view + forget; local-only data except the user's own Drive backup. | P0 | M5 | ☐ |

## 5. Milestones

Check off when *all P0 rows* for that milestone are ☑. Update the "Status" line at the top.

- [x] **M0 — Foundation.** *(code complete; NFR-2 needs a real mixed-DPI check)* Scaffold from kero-pet, service split, event bus, store/secrets/migrations, summon fix (SUM-1..4, PORT-1..2, SAFE-2, NFR-2).
- [x] **M1 — Character & hatching.** *(code complete)* SVG rig, parts library, CharacterSpec, onboarding (ONB-1..6, ART-1..3, PET-5, VOICE-2).
- [ ] **M2 — Pet loop v2 & lifecycle.** Energy, bond, productivity, roster, export/import (PET-1..4, BOND-*, PROD-1..2, PORT-3..5, ONB-9).
- [ ] **M3 — Brain & engines.** Router, Claude + agy engines, PermissionGate, budget (BRAIN-*, ENG-1..5, SAFE-1, SAFE-5, ONB-7).
- [ ] **M4 — Terminal v2.** Theming, chat/code modes, commands (TERM-*, ART-4, SAFE-4).
- [ ] **M5 — Events & memory.** (EVT-*, PET-6..7, NFR-4, SUM-5).
- [ ] **M6 — Google.** OAuth, MCP tools, Gmail/Calendar/Drive/Docs/Sheets, Drive backup (GOOG-*, PORT-6..8, PROD-3).
- [ ] **M7 — Telegram.** (TG-*, ART-5, SAFE-3).
- [ ] **M8 — Voice & polish.** (VOICE-1, PET-8, NFR-1, NFR-3).

## 6. Open questions

| ID | Question | Default until answered |
|---|---|---|
| ~~Q1~~ | ~~Gmail sending?~~ | Resolved: drafts only (D-014) |
| Q2 | Final product name? | "Tama" (each Tama is named in onboarding) |
| Q3 | Git commit watcher: which repos by default? | None; user adds |

## 7. Changelog
- **0.4 — 2026-11-05** — M1 implemented: ONB-1..6, ART-1..3, VOICE-2 done; PORT-4 partial (restyle + rebirth; graduate/delete in M2).
- **0.3 — 2026-11-05** — M0 implemented: SUM-1..4, PORT-1..2, SAFE-2, PET-5 done; NFR-2 and PET-1 partial. SUM-2's Telegram trigger lands in M7.
- **0.2 — 2026-11-05** — Q1 resolved: Gmail drafts only (D-014).
- **0.1 — 2026-11-05** — Initial draft from planning sessions (requirements 1–9 + engines, Google incl. Drive, portability).
