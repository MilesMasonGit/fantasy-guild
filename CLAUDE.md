# Fantasy Guild — Project Notes for Claude Code

## Major Rework: Playmat → Area Deck Loop System — ✅ COMPLETE (2026-07-17)

**All phases (0–9) of this rework are implemented and verified.** The deck
loop is the only system; the old playmat/grid code, the `USE_DECK_LOOP`
feature flag, and their tests were deleted in the Phase 9 sweep. The section
below is kept for orientation and history. **Next up: the code-review fix
waves (see below), then the post-rework polish backlogs**
(`rework_cleanup_todo.md`, `deck_loop_task_list.md`, `ui_bugfix_tracker.md`).

**Before doing any work related to areas, cards, decks, or stations, read:**

1. [`playmat_rework_concept_v1.md`](playmat_rework_concept_v1.md) — the design vision (why we're doing this, what the end state looks like).
2. [`playmat_rework_roadmap_v3.md`](playmat_rework_roadmap_v3.md) — the authoritative implementation plan. This is the **current source of truth**; ignore `playmat_rework_roadmap.md` and `_v2.md` (earlier drafts, kept for history only).
   - Check the **Implementation Status** checklist near the top of this file first — it tracks which phase is in progress and what's already done. **Update it as you complete work.**
   - **Appendix A-1** ("Gap-Analysis Decisions Log") records locked design decisions and why — check it before re-deriving a decision that's already been made.

### Ground rules for this rework
- All implementation work happens on the **`deck-loop-rework`** branch, not `main` or `overhaul-dev`. Confirm your current branch before starting Phase 0+ work.
- The rework is gated behind a `USE_DECK_LOOP` feature flag (added in Phase 0) — `main`/production must keep working with the flag off at every phase.
- **Save compatibility is intentionally broken** by this rework (locked decision) — old saves will refuse to load post-Phase-2, by design. Do not spend effort writing save-migration logic for the old schema.
- ~~There is a large, **unrelated, abandoned** set of uncommitted changes sitting in the working directory (an old 2D-grid-consolidation effort).~~ **Resolved 2026-07-07:** these were discarded with the project owner's approval during Phase 0 (§-1 pre-phase cleanup). The working tree is clean; if you see large unexplained uncommitted changes now, something new is wrong — ask before touching them.
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

## Code Review — ✅ COMPLETE (2026-07-17) → Fix Waves in progress

The full 8-session codebase review is **done**: 53 tickets
(CR-001–CR-054), zero P0s, all filed in
[`code_review_findings.md`](code_review_findings.md). Its **FINAL
SYNTHESIS** section is the authoritative fix plan — six prioritized waves.
[`code_review_guide.md`](code_review_guide.md) is kept for methodology
history. Verdict: the rework is sound; the debt is overwhelmingly orphaned
pre-rework code, so fixing is mostly deletion plus small corrections.

### Ground rules for fix sessions
- Work stays on **`deck-loop-rework`**; one wave (or a coherent slice of
  one) per session; commit per ticket or small related groups.
- **Update ticket Status lines** in `code_review_findings.md` as you go
  (`Fixed (date, commit)`), never delete tickets.
- **Wave order matters**: CR-035 lands first (missing imports that crash
  once later waves re-wire mastery/projects); CR-053's engine tests land
  **before** Wave 4 (the big deletion sweep).
- Decisions already locked 2026-07-17: instant combat escape is
  intentional (CR-020); hero food/drink retired (CR-029); ALL features
  scale under banked time (CR-002/022/033); single active-area concept
  retired, per-area music deferred (CR-005); bank slot capacity is a
  real enforced limit (CR-039); Area Mastery shelved — dormant, §J
  (CR-036); Projects retired outright, Guild Hall upgrades are the
  replacement (CR-038).
- Verify UI-facing fixes in the running game (`npm run dev`), and run
  `npm test` (baseline: 81/81 green) before each commit.
- `tools/reachability.mjs` re-checks for unreachable files after
  deletions (`node tools/reachability.mjs`).

### Fix Session Kickoff Prompt

> I'm starting a code-review fix session. Get oriented first:
>
> 1. Read `CLAUDE.md` (this file) — ground rules for fix sessions.
> 2. Open `code_review_findings.md`: read the FINAL SYNTHESIS wave plan,
>    then the full ticket text for every ticket in the wave I name below
>    (follow their Related links too).
> 3. Confirm you're on `deck-loop-rework` with a clean working tree.
> 4. **Stop and report back**: list the wave's tickets in the order you'd
>    fix them, what each fix involves in plain language, and any conflicts
>    or open questions you see. I don't code — keep it plain.
>
> After my go-ahead: fix one ticket at a time, run the tests, verify
> UI-facing changes in the running game, update each ticket's Status line,
> and commit as you go. Stop and show me anything that turns out bigger
> than its ticket suggested rather than improvising.

## General
(Add general project conventions here as they come up — this file is currently focused on the active rework since that's the primary work in flight.)
