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

### Session Kickoff Prompt

The project owner uses this prompt (or a close paraphrase of it) to start each new implementation session on this rework. If you're an agent picking up this project and something like this brought you here, follow it as written.

> I'm resuming work on the Playmat → Area Deck Loop rework for this game. Before we do anything else, get oriented:
>
> 1. Read `CLAUDE.md` at the repo root — it has the ground rules and working practices for this project.
> 2. Read `playmat_rework_concept_v1.md` — the design vision for what we're building.
> 3. Read `playmat_rework_roadmap_v3.md` in full — this is the authoritative implementation plan. Pay particular attention to:
>    - The **Implementation Status** table near the top — tell me what phase we're actually on.
>    - **Appendix A-1** (Gap-Analysis Decisions Log) — these are locked decisions; don't re-litigate them.
> 4. Confirm you're on the `deck-loop-rework` branch. If not, check it out (don't switch branches destructively — there are unrelated uncommitted files in the working tree from an abandoned effort that must be left alone; see the ground rules above).
> 5. Do a quick sanity check of the current codebase against what the roadmap assumes for the phase we're about to start — confirm the files the roadmap references still exist and look the way the roadmap describes. Flag anything that's drifted since the roadmap was written.
>
> Once you've done that, **stop and report back to me**: summarize what phase we're starting, what that phase involves, and any open questions or ambiguities you found — either in the roadmap itself or between the roadmap and the current code. I don't code myself, so explain anything technical in plain terms.
>
> **Do not write any code yet.** I want to confirm your understanding and answer any questions first, the same way we worked through the planning phase. Once I give the go-ahead, implement that phase, then stop again before moving to the next one — verify against the phase's smoke test criteria before telling me it's done, and update the Implementation Status table when it's actually verified working.

## General
(Add general project conventions here as they come up — this file is currently focused on the active rework since that's the primary work in flight.)
