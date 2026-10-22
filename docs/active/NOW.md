# NOW — start here

*Updated 2026-10-21. One screen: what is next and where the project stands.
The features director resumes from [HANDOFF_features.md](HANDOFF_features.md),
the terrain director from [HANDOFF.md](HANDOFF.md); the living table and
summaries are [STATUS.md](STATUS.md); finished work lives in git, the
changelog and `docs/archive/`.*

## Where the project is

- **The crunch is done.** Every brief in the queue is built or parked, and the
  Performance Envelope is measured and written as rules in
  [GDD §14](../reference/GDD.md). The outstanding list was wrapped up
  2026-10-20/21 (two rounds of four agents).
- **Version** 0.8.x on `main`. **Tests:** ~5,750, all green (a few file-scan
  tests time out only when several suites run at once; T-208).
- **Bench baselines:** engine retaken 2026-10-21 13:00, draw 2026-10-22 01:00,
  both on a quiet machine.

## Next

1. **Planning the next batch** (owner with the planning agent): the backlog is
   [TICKETS.md](../reference/TICKETS.md). Ready to brief: the optimisation pass
   from the Envelope (T-197 loot hover, T-198 bubbles, T-199 catch-up at 256,
   T-200 enemies, T-201 drags at 4×), the refinement-pass notes (T-196
   afterimages, the Atlas and eye-check look questions in
   `docs/archive/eyecheck/`), and the parked designs: the quest board (brief
   170, postponed), the notification log (T-193), converting old screens to
   the strings file (T-119), the camera glide for the Guild Hall upgrade
   screen (T-194).
2. **Terrain director** ([HANDOFF.md](HANDOFF.md)): its own queue, plus T-195
   (three one-line leftovers in its files).
3. **Owner, before release:** the background music's source and licence
   (STATUS "Questions for the owner"); ZapSplat needs an in-game credit
   (`CREDITS.md`).

## Ground rules

- Content must not make a Region cost more than the reference board (GDD §14).
- The engine work check is `npm run bench -- --compare` after every merge.
- Rules for agents, tiers, benches and eye-checks are in `CLAUDE.md`.
