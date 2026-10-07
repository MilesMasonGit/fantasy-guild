# Crunch briefs — index

Ready-to-run briefs for the crunch, one file per track, written 2026-10-07
from the owner's interviews. A director session picks the next brief, reads
**only that brief plus `CLAUDE.md` and `docs/reference/TESTING.md`**, and runs
its phases. Each phase says what to read, what to change, how to know it's
done, and which tier should build it.

## Order

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
| 9 | [80 Terrain rework](80_terrain.md) | 8 | yes |
| 10 | [90 Performance Envelope](90_performance_envelope.md) | 9 | — |

Order ruled by the owner 2026-10-07: UI phases that don't touch skills first,
then class rework v2, then the hero bar/panel on the new skill list, then
offline progress. Deep optimization → Atlas → terrain → Envelope (2026-10-06).
Code changes run one at a time in the checkout; a brief's read-only research
may overlap another's build.

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
- **Tiers**: runner (Haiku) for runs and mechanical edits; builder (Sonnet)
  for written-down designs; engineer (Opus) for engine work, performance and
  new designs into code. The director verifies every claim before merging.
- **Bookkeeping**: close tickets into `docs/archive/tickets_done.md`, log
  changes in `CHANGELOG.md`, update `docs/active/NOW.md` at the end of a
  session.
