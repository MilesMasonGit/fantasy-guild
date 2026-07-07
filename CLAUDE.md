# Fantasy Guild — Project Notes for Claude Code

## Active Major Rework: Playmat → Area Deck Loop System

This project is mid-planning on a large, multi-session rework replacing the 2D
spatial "Playmat" system with a linear "Area Deck Loop" system. **Before doing
any work related to areas, cards, the playmat, decks, or stations, read:**

1. [`playmat_rework_concept_v1.md`](playmat_rework_concept_v1.md) — the design vision (why we're doing this, what the end state looks like).
2. [`playmat_rework_roadmap_v3.md`](playmat_rework_roadmap_v3.md) — the authoritative implementation plan. This is the **current source of truth**; ignore `playmat_rework_roadmap.md` and `_v2.md` (earlier drafts, kept for history only).
   - Check the **Implementation Status** checklist near the top of this file first — it tracks which phase is in progress and what's already done. **Update it as you complete work.**
   - **Appendix A-1** ("Gap-Analysis Decisions Log") records locked design decisions and why — check it before re-deriving a decision that's already been made.

### Ground rules for this rework
- All implementation work happens on the **`deck-loop-rework`** branch, not `main` or `overhaul-dev`. Confirm your current branch before starting Phase 0+ work.
- The rework is gated behind a `USE_DECK_LOOP` feature flag (added in Phase 0) — `main`/production must keep working with the flag off at every phase.
- **Save compatibility is intentionally broken** by this rework (locked decision) — old saves will refuse to load post-Phase-2, by design. Do not spend effort writing save-migration logic for the old schema.
- There is a large, **unrelated, abandoned** set of uncommitted changes that may still be sitting in the working directory (an old 2D-grid-consolidation effort). These are intentionally left alone per the project owner's request — do not build on top of them, and do not delete them without asking first.
- The project owner does not code and is unfamiliar with git — explain git/GitHub actions in plain language before asking them to do something (e.g., what "merge" means, not just "merge the PR").

### Working practices for implementation sessions
- **Ask, don't assume.** If a phase requires a design decision the roadmap and concept doc don't answer, stop and ask the project owner rather than guessing. This is the established working pattern for this project — see Appendix A-1 in the roadmap for examples of decisions that were surfaced this way rather than assumed.
- **Verify before claiming a phase is done.** Each phase in the roadmap ends with a "✅ Smoke Test" section. Actually run through it — start the dev server and exercise the feature for UI-facing phases, don't just rely on the type checker or test suite passing. Report what you actually observed, not just that code was written.
- **One phase per session where practical.** Update the Implementation Status table and commit at the end of a phase before starting the next one, ideally in a fresh session — this keeps context focused and gives the project owner clean rollback points.
- **Don't bundle unrelated cleanup into phase work.** If something unrelated looks worth fixing while implementing a phase, flag it separately rather than folding it into the current change.
- **Periodically re-check the plan against reality.** Implementation sometimes reveals gaps the roadmap didn't anticipate. After a few phases land, it's worth a quick sanity check that later phases still make sense given what was actually built, not just pressing forward on the original plan.

## General
(Add general project conventions here as they come up — this file is currently focused on the active rework since that's the primary work in flight.)
