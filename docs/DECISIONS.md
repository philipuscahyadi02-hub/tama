# Tama — Decision Log

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
| D-004 | Built-in TTS first | Accepted |
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
