# NOW — start here

*Updated 2026-10-06. Update this page at the end of every session: what
changed, what's next. Keep it under one screen.*

## Where the project is

- **Version** 0.8.x on `main`. Code review round 3 is closed: 165 FPS reached on
  a realistic mat, ~4,000 tests. Its leftovers are tickets.
- **Phase: crunch prep.** Plan: [crunch_prep_plan.md](crunch_prep_plan.md).
  Crunch order: UI rework (fresh owner plans), skill & class rework v2 and real
  offline progress → deep optimization → Atlas → terrain rework → Performance
  Envelope.
- **Tests**: one known failure, `AssetManager` (Copper Rubble's missing art,
  ticket T-001). Anything else red is new.

## In flight

| Work | Doc | State |
|---|---|---|
| Crunch prep | [crunch_prep_plan.md](crunch_prep_plan.md) | Doc cleanup, tickets, CLAUDE.md, GDD rebuild and the owner's GDD rulings done 2026-10-06 |

## Next up

1. **Comment slimming pass**: running in another session on
   `chore/comment-slimming` ([brief](brief_comment_slimming.md)).
2. Owner to-dos at the top of [TICKETS](../reference/TICKETS.md) §1, especially
   the certification run (T-003) and the CMS fixes (T-001, T-002).
3. Crunch prep P3: drawing benchmark + per-system on/off switches.
4. Crunch prep P4: ready-to-run crunch briefs, one per track (owner writes the
   UI plans).

## Planned

- **Skill & class rework v2** (crunch track):
  [concept](concept_skill_and_class_rework_v2.md), approved, needs a roadmap.
  Brings the 4 Academies (Fighter, Wizard, Rogue, Ranger) on Wood or Stone
  Foundations.
- **Real offline progress** (crunch track): simulate time away on return;
  replaces the Time Bank. No design doc yet.
- **Atlas** (crunch, after optimization): [concept_atlas.md](concept_atlas.md).
- **Terrain rework** (crunch, after the Atlas works): painted ground returns
  for Atlas Regions; currently switched off. Some
  uncommitted Atlas code sits in the working folder (T-005).
