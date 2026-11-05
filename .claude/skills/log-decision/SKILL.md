---
name: log-decision
description: Tama repo only. Append a key design/architecture decision for the Tama project to this repo's docs/DECISIONS.md (and update the index, PRD, AGENTS.md or CHANGELOG if affected). Use when a real choice is made, a decision is overridden, or the user states a lasting preference about Tama. Never use it for other repos.
---

# Log a decision (Tama repo only)

**Scope guard.** This skill only edits files inside the Tama repository: the git root that
contains `docs/DECISIONS.md`, `AGENTS.md` and a `package.json` with `"name": "tama"`.
- Run `git rev-parse --show-toplevel` and confirm that root has those files. If not, stop and tell the user this skill only applies to the Tama repo.
- Never write decisions to other repos, to global/user memory, or to files outside this repo.

## Steps
1. Read `docs/DECISIONS.md`. Find the highest `D-XXX` and use the next number.
2. Check that this isn't already covered. If it changes an existing decision, the new entry says
   `Supersedes D-00X`, and the old entry's **Status** and its index row become `Superseded by D-00Y`.
   Never delete or rewrite an old entry's body.
3. Append the entry using the template in the file. Fill in:
   - Date: today (absolute date)
   - Context, Decision, Alternatives (1 line each, with why not), Consequences, Refs (PRD IDs and files)
4. Add a row to the **Index** table.
5. Update any doc the decision touches in the same change:
   - Scope or requirements changed → `docs/PRD.md` (rows, open questions, changelog, version bump)
   - Structure, bus topics, engine contract or storage changed → `docs/ARCHITECTURE.md`
   - New or changed rule → `AGENTS.md`
   - Always add a line under `## [Unreleased]` in `CHANGELOG.md` → `### Decisions` (e.g. `D-016 — <title>`).
6. Tell the user in one line: `Logged D-XXX — <title>` plus any other docs you updated.

Keep entries short (about 6–10 lines). Write plainly: no persona voice in docs.

Arguments, if given, describe the decision: $ARGUMENTS
