# Tama 🥚

A chibi-anime tamagotchi that's also a real agentic AI. You design it on first launch, it lives on
your Windows desktop, codes with Claude Code / Antigravity, works with your Gmail, Calendar and
Drive, and talks to you on Telegram. No server: everything runs on your PC.

**Status:** planning. Nothing to run yet (milestone M0 is next).

## Docs
- [docs/PRD.md](docs/PRD.md): what we're building (requirements, milestones)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how it's structured
- [docs/DECISIONS.md](docs/DECISIONS.md): why: the decision log, read this before coding
- [AGENTS.md](AGENTS.md): rules for AI coding sessions (Claude Code reads it via CLAUDE.md)

## Vibe-coding loop
1. Open the repo in Claude Code (or `agy`). The rules and decision log load or get read automatically.
2. Ask for a milestone task by PRD ID, e.g. "do SUM-1..4".
3. Decisions get appended to `docs/DECISIONS.md` (`/log-decision` in Claude Code).
4. At the end, the PRD statuses are updated and `npm run check` passes.

Built from [kero-pet](../kero-pet).
