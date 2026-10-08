# NOW — start here

*Updated 2026-10-08. Update this page at the end of every session. Keep it
under one screen: what's next first, finished work gone (it lives in git, the
changelog and `docs/archive/`).*

## Next

1. **Brief 20, class rework v2** ([brief](briefs/20_class_rework_v2.md)). Brief 10
   (UI rework) is done and merged; its owner taste notes are in
   [design_pass_notes.md](design_pass_notes.md) — read the relevant area before
   touching it, don't act on it mid-crunch.
2. **Max plan (2026-10-08):** a Fable session directs; tiers raised (runner
   Sonnet, builder Opus, engineer Opus extra-high, in `CLAUDE.md`). T-066 is
   closed: the full suite runs in a worktree with both `node_modules` linked,
   so code phases on different files may now run in parallel (TESTING.md).
3. **Owner CMS to-do**: Foundation **Tier** on each Foundation (Wood: Oak 1,
   Maple 2, Ebony 3; Stone: Stone 1, Marble 2, Basalt 3; author the missing
   Tokens first). **Shop group** labels: "Wood Foundation", "Stone
   Foundation", "Anvil". **Minimum Foundation tier** on building recipes
   (Recipes → Construction). Higher anvils each need their own "Acts as:
   anvil, tool tier N" effect (Copper 1 … Darkmetal 5).
4. **T-111**: the engine bench timings read slow on unchanged `main` (machine
   state); trust its work check, re-run timing verdicts before believing them.

**Lessons from brief 10's director:** subagent reports were wrong or partial
several times (a bench filter that hid T-106, an undiagnosed drop race, a
stale claim about hero size): read the diffs, not just the reports. Agents
must open their own browser tab and leave dev saves as they found them. A
bench WORK CHANGED is accepted only under a named ticket.

## Where the project is

- **Version** 0.8.x on `main`. Crunch prep is done: GDD, tickets, measuring
  tools and baseline ([PERFORMANCE.md](../reference/PERFORMANCE.md)), design
  interviews, and the briefs.
- **Crunch order:** UI rework → class rework v2 → hero bar and panel →
  offline progress → drag deep-dive → deep optimization → Atlas → terrain →
  Performance Envelope ([briefs](briefs/README.md)).
- **Tests:** all green (4133 passed, 3 skipped). Anything red is new.

## Ground rules during the crunch

- **Measure, don't fix** anything drawn (brief 30 too): one line per phase in
  PERFORMANCE.md's "UI rework cost log"; optimization comes later (brief 60).
- **Don't add expensive effects** to the mat (background blur, layout-shifting
  animation, heavy transparency over animation) without logging their cost.
- **Don't invest in what the Atlas replaces**: the bin, and resource spawners
  in the Shop.

## Design docs in flight

- [ui_rework_list.md](ui_rework_list.md): locked UI decisions and the owner's list
  (brief 30 still uses its hero bar, panel and work-rules sections).
- [design_pass_notes.md](design_pass_notes.md): owner taste notes for later.
- [concept_skill_and_class_rework_v2.md](concept_skill_and_class_rework_v2.md):
  read its amendments first.
- [concept_offline_progress.md](concept_offline_progress.md).
- [concept_atlas.md](concept_atlas.md): read its owner decisions first. The
  unfinished Atlas code is parked on branch `atlas-wip`.
