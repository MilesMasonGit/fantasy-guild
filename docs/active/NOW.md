# NOW — start here

*Updated 2026-10-07. Update this page at the end of every session. Keep it
under one screen: what's next first, finished work gone (it lives in git, the
changelog and `docs/archive/`).*

## Next

1. **Environment cleanup** (in progress, branch `chore/hygiene`): waves W1–W5
   in [hygiene_plan.md](hygiene_plan.md).
2. **The crunch**: start with [briefs/README.md](briefs/README.md), brief 00
   (quick fixes T-104, T-101). The owner hasn't upgraded to Max yet; the
   crunch can start on the current plan.
3. **Owner to-dos**: the CMS fixes at the top of
   [TICKETS](../reference/TICKETS.md) §1 (T-001, T-002), and T-096.

## Where the project is

- **Version** 0.8.x on `main`. Crunch prep is done: GDD, tickets, measuring
  tools and baseline ([PERFORMANCE.md](../reference/PERFORMANCE.md)), design
  interviews, and the briefs.
- **Crunch order:** UI rework → class rework v2 → hero bar and panel →
  offline progress → drag deep-dive → deep optimization → Atlas → terrain →
  Performance Envelope ([briefs](briefs/README.md)).
- **Tests:** one known failure, `AssetManager` (Copper Rubble's missing art,
  T-001). Anything else red is new.

## Ground rules during the crunch

- **Measure, don't fix** during the UI rework: one line per phase in
  PERFORMANCE.md's "UI rework cost log"; optimization comes later (brief 60).
- **Don't add expensive effects** to the mat (background blur, layout-shifting
  animation, heavy transparency over animation) without logging their cost.
- **Don't invest in what the Atlas replaces**: the bin, and resource spawners
  in the Shop.

## Design docs in flight

- [ui_rework_list.md](ui_rework_list.md): locked UI decisions and the owner's list.
- [concept_skill_and_class_rework_v2.md](concept_skill_and_class_rework_v2.md):
  read its amendments first.
- [concept_offline_progress.md](concept_offline_progress.md).
- [concept_atlas.md](concept_atlas.md): read its owner decisions first. Some
  uncommitted Atlas code sits in the folder (T-005).
