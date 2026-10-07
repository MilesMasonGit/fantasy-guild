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
| Crunch prep | [crunch_prep_plan.md](crunch_prep_plan.md) | Doc cleanup, tickets, CLAUDE.md, GDD rebuild and the owner's GDD rulings and the comment-slimming pass done 2026-10-06 (leftovers T-103) |

## Next up

1. Owner to-dos at the top of [TICKETS](../reference/TICKETS.md) §1, especially
   the CMS fixes (T-001, T-002). Certification ran 2026-10-07: realistic
   board passes; results in [PERFORMANCE.md](../reference/PERFORMANCE.md).
2. **Crunch prep P3 done** 2026-10-07: tools merged and the baseline recorded in
   [PERFORMANCE.md](../reference/PERFORMANCE.md) (rings are over half the drawing cost;
   drag success 74–100 %, tickets T-104..T-107).
3. Crunch prep P4: ready-to-run crunch briefs, one per track. UI input: the
   owner's [ui_rework_list.md](ui_rework_list.md).

## Planned

- **Skill & class rework v2** (crunch track):
  [concept](concept_skill_and_class_rework_v2.md), approved, needs a roadmap.
  Brings the 4 Academies (Fighter, Wizard, Rogue, Ranger) on Wood or Stone
  Foundations.
- **Real offline progress** (crunch track): simulate time away on return;
  replaces the Time Bank. Decisions locked:
  [concept_offline_progress.md](concept_offline_progress.md).
- **Atlas** (crunch, after optimization): [concept_atlas.md](concept_atlas.md).
- **Terrain rework** (crunch, after the Atlas works): painted ground returns
  for Atlas Regions; currently switched off. Some
  uncommitted Atlas code sits in the working folder (T-005).
