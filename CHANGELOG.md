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
- M0 in progress on branch `m0-foundation`.
- `CHANGELOG.md` + `npm run changelog` commit-table generator.
### Changed
- `log-decision` skill is explicitly scoped to the Tama repo only.
### Decisions
- D-015 — Versioning scheme, changelog, and repo-scoped decision log.

## [0.0.0] — 2026-11-05 — Planning
### Docs
- PRD (requirements by ID and milestone), ARCHITECTURE, DECISIONS (D-001..D-014, incl. Gmail drafts-only), AGENTS.md rulebook, CLAUDE.md, `log-decision` skill.

---

## Commit history (generated: `npm run changelog`)
<!-- commit-history:start -->
### Unreleased
_No commits._

### v0.0.0
| Commit | Date | Type | Subject |
|---|---|---|---|
| `e38f277` | 2026-11-05 | docs | PRD, architecture, decision log, agent rules |
<!-- commit-history:end -->
