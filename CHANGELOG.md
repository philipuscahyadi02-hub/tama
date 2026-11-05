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
_Nothing yet._

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
| Commit | Date | Type | Subject |
|---|---|---|---|
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
