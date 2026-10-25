# NOW — start here

*Updated 2026-10-22. One screen: what is next and where the project stands.
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

## Next (owner, 2026-10-22)

The owner's Backlog Intake was triaged into brief 210 and five new sessions:

1. **Backlog director: brief 210 done 2026-10-24.** All six batches and the
   follow-ups the owner approved are on `main` (the wider mat and top bar,
   quieter Tokens, one item one hero, the Hall glide, the Atlas spread, pixel
   frames everywhere, the work plate). Left: T-251 (slow scanning tests).
   State: [HANDOFF_backlog.md](HANDOFF_backlog.md).
2. **Three planning agents**, interviewing the owner over several rounds,
   each in its own worktree and branch:
   combat ([concept_combat.md](concept_combat.md), "The detail pass"),
   skill loops ([concept_skill_loops.md](concept_skill_loops.md), "The next
   pass"), basic content ([concept_basic_content.md](concept_basic_content.md)).
3. **Systems director** (new): builds what those three plan, once briefed.
   **Waits for the owner's go.** Writes `HANDOFF_systems.md`.
4. Still in the backlog ([TICKETS.md](../reference/TICKETS.md)): the
   Envelope's optimisation tickets (T-197 to T-201), the quest board (brief
   170, postponed), T-193, T-119, T-195.
5. **Owner, before release:** ZapSplat needs an in-game credit
   (`CREDITS.md`); the background music is AI-generated placeholder, replaced
   in the music pass (owner 2026-10-22).

## Ground rules

- Content must not make a Region cost more than the reference board (GDD §14).
- The engine work check is `npm run bench -- --compare` after every merge.
- Rules for agents, tiers, benches and eye-checks are in `CLAUDE.md`.
