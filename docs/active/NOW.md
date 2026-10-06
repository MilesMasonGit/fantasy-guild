# NOW — start here

*Updated 2026-10-06. Update this page at the end of every session: what
changed, what's next. Keep it under one screen.*

## Where the project is

- **Version** 0.8.x on `main`. Code review round 3 is closed: 165 FPS reached on
  a realistic mat, ~4,000 tests. Its leftovers are tickets.
- **Phase: crunch prep.** Plan: [crunch_prep_plan.md](crunch_prep_plan.md).
  After prep comes the crunch month: UI rework (measure the cost of every
  change), then deep optimization, then a written Performance Envelope.
- **Tests**: one known failure, `AssetManager` (Copper Rubble's missing art,
  ticket T-001). Anything else red is new.

## In flight

| Work | Doc | State |
|---|---|---|
| Crunch prep | [crunch_prep_plan.md](crunch_prep_plan.md) | Doc cleanup, tickets and CLAUDE.md done 2026-10-06; GDD review next; then P3 measurement tools, P4 crunch briefs |

## Next up

1. Finish the GDD review ([GDD](../reference/GDD.md)).
2. Owner to-dos at the top of [TICKETS](../reference/TICKETS.md) §1, especially
   the certification run (T-003) and the CMS fixes (T-001).
3. Crunch prep P3: drawing benchmark + per-system on/off switches.
4. Crunch prep P4: ready-to-run crunch briefs (UI rework track + optimization
   track).

## Planned, not started

- **Atlas** (after the crunch): [concept_atlas.md](concept_atlas.md). Some
  uncommitted Atlas code sits in the working folder (T-005).
- **Skill and class rework v2**: [concept](concept_skill_and_class_rework_v2.md),
  approved, needs a roadmap.

## Open owner decisions (not tickets)

- **UI rework source docs**: `ui_overhaul_spec.md` and `ui_bugfix_tracker.md`
  were archived by the doc triage, but the crunch plan names them as inputs for
  the UI rework. Bring them back to `active/`, or write fresh UI plans?
- **History comments in code**: many source files carry long ticket and
  decision histories in comments, which every agent reads. Slim them to short
  "why" comments? (crunch plan §5.2)
