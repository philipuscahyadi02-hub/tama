---
name: log-decision
description: Append a key design/architecture decision to docs/DECISIONS.md (and update the index, PRD, or AGENTS.md if affected). Use whenever a real choice between alternatives is made, a decision is overridden, or the user states a lasting preference for the Tama project.
---

# Log a decision

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
6. Tell the user in one line: `Logged D-XXX — <title>` plus any other docs you updated.

Keep entries short (about 6–10 lines). Write plainly: no persona voice in docs.

Arguments, if given, describe the decision: $ARGUMENTS
