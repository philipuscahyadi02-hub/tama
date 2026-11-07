# Tama 🥚

A chibi-anime desktop companion that is also a real agentic AI. You design her on first launch; she lives on your
desktop, chats with you, remembers you, speaks with an anime voice, codes with you through Claude Code, works with your
Gmail, Calendar and Drive, and talks to you on Telegram. No server: everything runs on your PC with your own accounts.

**Version 1.0.0** · Windows (macOS runs from source) · [Changelog](CHANGELOG.md) · [Documentation (Word)](docs/Tama-v1.0-Documentation.docx)

## What she does
| | |
|---|---|
| **Hatch & care** | Describe her in words and she is drawn from a parts rig in chibi style. Feed, play, nap, pat her head; her mood and your bond grow with care and with your productive work. Several Tamas, export/import as `.tama` files. |
| **Chat** | A chat window (Ctrl+Alt+J) with her personality, memory of you, web search and a diary. She starts little moments on her own and stays quiet in focus time, quiet hours, fullscreen apps and meetings. |
| **Terminal** | A Claude Code terminal themed after her (Ctrl+Alt+K). Asks before every change; plan mode, models, effort, resume. |
| **Productivity** | Todos, focus timer, reminders, notes, commit watcher. |
| **Google** | Calendar, Gmail (drafts; sending only after you confirm the full email), Drive, Docs, Sheets, Maps places, Drive backups. Your own OAuth client; tokens never leave the PC. |
| **Phone** | A Telegram bot paired to your chat only: talk to her, care for her, todos, and remote `/code` in folders you allowed (asks per tool). Voice notes. |
| **Voice** | Windows voice for English or a Japanese anime dub (AivisSpeech / VOICEVOX), mood-matched. |
| **Brains** | Settings → Brains: Gemini (Antigravity) for chat by default, Claude Code for coding; Claude can chat too if you opt in. |
| **Dashboard** | Usage per service, what's left of your Claude plan, account switching. |

## Requirements
- Windows 10/11 and [Node.js](https://nodejs.org) 22+ (to run from source).
- **For coding (terminal):** [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and signed in (`claude` once).
- **For chat and moments:** the Antigravity CLI (`agy`) installed and signed in. Without it you can let Claude chat (Settings → Brains).
- Optional: AivisSpeech Engine or VOICEVOX Engine (Japanese voice), a Google Cloud OAuth client (Google features), a Telegram bot token.

Tama uses each tool's own official sign-in; it never reads or reuses their tokens (D-006).

## Run
```
npm install          # if Electron didn't download: node node_modules/electron/install.js
npm start
```
Hotkeys: **Ctrl+Alt+P** bring her here · **Ctrl+Alt+J** chat · **Ctrl+Alt+K** terminal. Tray icon → Settings.
Data: `%APPDATA%\Tama` (a kero-pet save is imported on first run).

macOS: run from source with `npm start`. A signed installer for Windows and a macOS app are planned for 1.x
(see [PRD §4.3d](docs/PRD.md)). Builds are unsigned, so Windows shows "unknown publisher".

## Develop
```
npm run check        # types + architecture rules + tests
npm run coverage     # line coverage per layer
npm run perf         # idle CPU / memory
npm run arch         # architecture report
```
- [docs/PRD.md](docs/PRD.md): requirements and milestones · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): structure
- [docs/DECISIONS.md](docs/DECISIONS.md): the decision log (read before coding) · [AGENTS.md](AGENTS.md): rules for AI coding sessions
- Use `TAMA_DATA_DIR=<scratch folder>` for every test run so real saves are never touched.

## Roadmap
- **1.x:** Windows installer, setup wizard, features that adapt to what you have installed, voice engines on demand, updates.
- **2.0:** Tama's own agentic brain on official model APIs (your own keys or local models), so she no longer depends on one provider (AGT-1..6, D-056).

Built from kero-pet.
