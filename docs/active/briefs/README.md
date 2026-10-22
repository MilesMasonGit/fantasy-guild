# Crunch briefs — index

Ready-to-run briefs for the crunch, one file per track, written 2026-10-07
from the owner's interviews. A director session picks the next brief, reads
**only that brief, the docs it names, `CLAUDE.md` and `docs/reference/TESTING.md`**, and runs
its phases. Each phase says what to read, what to change, how to know it's
done, and which tier should build it.

## Order

**This table is the director's queue** (owner ruling 2026-10-13). A brief gets a
row when its concept doc is `Status: approved` and the planning agent has
written the brief; the director proposes each wave's order from it as
multiple choice at wave start.

| # | Brief | Needs | Eye-check |
|---|---|---|---|
| 1 | [00 Quick fixes](00_quick_fixes.md): T-104 drag, T-101 bin cap | — | no |
| 2 | [10 UI rework](10_ui_rework.md): bubbles, callouts, sidebars, Shop, top bar, inspection, motion | 1 | yes, batched |
| 3 | [20 Class rework v2](20_class_rework_v2.md) | 2 | content only |
| 4 | [30 Hero bar and panel](30_hero_bar_panel.md) | 3 | yes |
| 5 | [40 Offline progress](40_offline_progress.md) | 1 | yes (bar + summary) |
| 6 | [50 Drag deep-dive](50_drag_deep_dive.md) | 2, 4 | yes |
| 7 | [60 Deep optimization](60_deep_optimization.md) | 2–6 | look-preserving |
| 8 | [70 Atlas](70_atlas.md) | 7 | yes |
| 9 | [85 Art direction](85_art_direction.md): bench page, brightness script, Studio palette import; the owner's art weekend | — | owner judges on the bench |
| 10 | [80 Terrain rework](80_terrain.md) | 8 | yes |
| 11 | [100 Style kit](100_style_kit.md): style sheet page, arrow-bar list, text sizes, tooltip | — | yes, once |
| 12 | [110 Map tools and top bar](110_map_tools.md): camp fixtures, Demolish mode, top bar | 11, T-147 | yes |
| 13 | [120 Mat, hover and Token card](120_mat_and_card.md) | 11, 12, T-146, T-147 | yes, two batches |
| 14 | [130 Recipe list](130_recipe_list.md) | 13 | yes |
| 15 | [140 Hero bar](140_hero_bar.md): Work Permissions, level-up, shine | 11, T-152 | yes |
| 16 | [150 Notifications](150_notifications.md) | 11, 15 | yes |
| 17 | [160 Atlas tome and Hall sky](160_atlas_tome.md): tome, banners, sky, camera moves | 11, 12 | yes, two batches |
| 18 | ~~[170 The quest board](170_quest_boards.md)~~ **postponed** (owner 2026-10-20: written, not built until later mechanics settle what quests are for) | 13, 14, 16 | yes |
| 19 | [180 Ground structure](180_ground_structure.md): tint pattern, organic earth, grouped props, the owner's edge pieces | 10 | yes |
| 19b | [190 Playmat style](190_playmat_style.md): Clean ground at 2×, quieter decorations, darker rim, shadows, ambient life | 19, 12, 13 (P2) | yes, per phase |
| 19c | [200 CMS change packs](200_cms_change_packs.md): agents author content for the owner to review (T-133); first pack: the starting maps | — | yes (CMS) |
| 20 | [90 Performance Envelope](90_performance_envelope.md), **done 2026-10-21** (GDD §14; T-071 parked; T-197 to T-210 filed) | 10–19 | — |

Order ruled by the owner 2026-10-07: UI phases that don't touch skills first,
then class rework v2, then the hero bar/panel on the new skill list, then
offline progress. Deep optimization → Atlas → terrain → Envelope (2026-10-06).
**Brief 85 runs now** (owner, 2026-10-15): its three tools on Friday 16 October
so the owner can work the art over the weekend; Friday's remaining tweaks
move to the next wave. Brief 80 (T0 to T4) was built alongside, 2026-10-15. The refinement-pass briefs (100–170) run after terrain and before the
Envelope, foundations first (owner, 2026-10-14); the Envelope measures the
finished game. `T-` entries under Needs are wave 2 tickets that must be
merged first. Collectors (`concept_collectors.md`) stays a draft for now.
Code phases on different files may run in parallel in worktrees (`CLAUDE.md`);
a brief's read-only research may overlap another's build.

## Rules every brief follows

- **Sources of truth**: [`ui_rework_list.md`](../ui_rework_list.md) (UI
  decisions, locked), [`UI_STYLE.md`](../../reference/UI_STYLE.md) (how
  information reads), the concept docs in `docs/active/`, and the
  [GDD](../../reference/GDD.md). Locked decisions are not re-litigated; a
  genuinely new question goes to the owner **as part of a batch** (the owner
  prefers larger batches).
- **Merge gate**: [`TESTING.md`](../../reference/TESTING.md). Anything the
  player sees is exercised in the running game.
- **Eye-check batches**: phases the owner must see build up on one
  integration branch per brief (e.g. `crunch/ui-rework`), each phase its own
  commits. When 2–4 phases are ready, the director lists exactly what to look
  at and where (one short checklist), the owner looks, and the batch merges.
  Fixes from the look go on the same branch before merging.
- **Measure, don't fix** (UI rework and anything drawn): run
  `npm run bench:draw -- --compare` before and after each phase and append
  one line to the cost log in
  [`PERFORMANCE.md`](../../reference/PERFORMANCE.md) ("UI rework cost log"):
  phase, S2 4× FPS and frame work before → after. Don't optimize during the
  UI rework unless a phase makes something unusable; optimization is brief 60.
- **Atlas-aware**: the Atlas replaces the bin (with demolition) and stops the
  Shop selling resource spawners (`concept_atlas.md`, top). Don't invest in
  bin UI or spawner-specific Shop polish.
- **Content is the owner's**: anything in `data/` is authored in the CMS by
  the owner. Briefs that need content end with a short "owner CMS to-do"
  list; never hand-edit `data/`.
- **Tiers**: defined only in `.claude/agents/` (runner, builder-lite, builder,
  engineer); `CLAUDE.md` says how the director picks one and spot-checks. The
  director verifies every claim before merging. Benches run only in the
  owner's downtime, by the director (TESTING.md, gate item 2).
- **Bookkeeping**: close tickets into `docs/archive/tickets_done.md`, log
  changes in `CHANGELOG.md`, update `docs/active/NOW.md` at the end of a
  session.
