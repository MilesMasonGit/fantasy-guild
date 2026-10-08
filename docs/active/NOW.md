# NOW — start here

*Updated 2026-10-08. Update this page at the end of every session. Keep it
under one screen: what's next first, finished work gone (it lives in git, the
changelog and `docs/archive/`).*

## Next

1. **Brief 10, UI rework** ([brief](briefs/10_ui_rework.md)) on branch
   `crunch/ui-rework`. Batch A (U1–U3) is merged. **Batch B (U4–U5, plus the
   batch A tweaks) waits for the owner's eye-check**, then merges. Next: U6
   (top bar, Token Summary, T-102 cap 80, Passive Production T-099).
   The unfinished Atlas work is parked on branch `atlas-wip`, not `main`.
2. **Owner CMS to-do** (after batch B merges): Foundation **Tier** on each
   Foundation (Wood: Oak 1, Maple 2, Ebony 3; Stone: Stone 1, Marble 2,
   Basalt 3; author the missing Tokens first). **Shop group** labels: "Wood
   Foundation", "Stone Foundation", "Anvil". **Minimum Foundation tier** on
   building recipes (Recipes → Construction). Higher anvils each need their
   own "Acts as: anvil, tool tier N" effect (Copper 1 … Darkmetal 5).
3. **T-111**: the engine bench reads ~1.4× slow on unchanged `main`; re-run on
   a quiet machine before trusting timing verdicts.

## Where the project is

- **Version** 0.8.x on `main`. Crunch prep is done: GDD, tickets, measuring
  tools and baseline ([PERFORMANCE.md](../reference/PERFORMANCE.md)), design
  interviews, and the briefs.
- **Crunch order:** UI rework → class rework v2 → hero bar and panel →
  offline progress → drag deep-dive → deep optimization → Atlas → terrain →
  Performance Envelope ([briefs](briefs/README.md)).
- **Tests:** all green (4020 passed, 3 skipped). Anything red is new.

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
