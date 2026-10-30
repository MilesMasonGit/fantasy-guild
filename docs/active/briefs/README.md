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
| 21 | [210 Backlog intake](210_backlog_intake.md): the owner's UI tweaks and small systems, six batches (mat and top bar, mat clean-ups, Bank/items/hero bar, Guild Hall, drawers/Atlas/dev tools, frames and bubbles); **Backlog director, waits for the owner's go** **done 2026-10-24** (batches A–F merged; follow-ups T-240 to T-244, T-247) | — | yes, per batch |
| 22 | [220 Combat](220_combat.md): the detail pass: small numbers, weapon families with abilities, enemy kinds, elixirs, Poison and Burn, boss moves, one-on-one encounters, the combat panel; **Systems director, owner's go 2026-10-24** | — (C6 part after 210 F2) | yes (C3, C5, C6) |
| 22b | [230 Skill loops](230_skill_loops.md): each starting skill plays its own way: Forests that plant and regrow their trees (stumps pay a seedling), veins that rest and refill with Mines and Minecarts around them, self-growing fields with a picked seed, fishing by water, tool and bait, Furnace and Smithy, work potions and drinks as work buffs, supports built on Foundations; one brief for all nine (owner 2026-10-24); **Systems director** | S1: —; S5, S6: 220 C3; pack coordinated with 240 | yes (S9, one look) |
| 23 | [240 Basic content](240_basic_content.md): Starter Camp to plane 2 (copper and oak, then iron and fir): engine gaps (packs carry the Starter Camp, tutorial maps, first-kill drops, the Bog biome, Hall prices), then three CMS change packs the owner reviews, then a play-through; **Systems director** | K0: —; packs: 220 C2, C5 | yes (Bog look, play-through) |
| 24 | [250 Token bars](250_token_bars.md): one plate for every Token (no output icon, idle Tokens get it on hover, the round rings retire), the big gear in place of a choice's '!', no charges on enemies, the owner's pennant flag for every hero; owner CMS: stumps to Art size Small | — | yes, one look |
| 25 | [260 Hero orders](260_hero_orders.md): drag a hero onto a job (one hero, one Token), camps for area work (Logging Camp, Mining Camp, Fishing Hut, Farmstead; enemy camps as hunting grounds); flags, Work Permissions and Scouting Flags retire; three phases, the owner may stop after the first; owner CMS: camps pack, shorter rest and regrow times, Bunk Beds price | 24 (reuses its pennant) | yes, per phase |
| 26 | [270 Classless heroes](270_classless_heroes.md): no jobs or promotion, every hero holds every skill (gate: the level); the weapon decides the combat style; armour families per style with off-style penalties; Stealth's sneak strike and unseen at work; milestone perks at 10/25/50/75/99; five specialist skills cut; owner CMS: one style per weapon, gear level requirements, armour families, perks, Goblin retune | 25 (O1); K2–K3 moved to brief 280 | yes, two looks |
| 27 | [280 Combat v2](280_combat_v2.md): nine damage types in three groups (Physical, Elemental, Special), arrows as ammo, enemy resistances on the info card, the fraction sub-roll; no flat armour: gear resistances with damage cuts to named styles, off-hand items, Venom and Sunder; enemy move sets; style characters (melee re-engage, stealth burst, Motes, Throwing Daggers); owner CMS: review the content pack | 26 (K1) | yes, four looks |
| 28 | [290 Progression ledger](290_progression_ledger.md) (rewritten 2026-10-29 from the system plan): a Ledger tab in the CMS from the first phase; a spike first (an abstract guild model against the real engine within ±15 %); the plan block (status, plan tier, stubs that never sync); reach and tree engine; checks and the item page; a tiers-and-stubs pack; the pretend player against the owner's pace curve; timeline, hubs, before-and-after and the agent gate; the content fix pack; then automatic balancing in Recalculate; CMS-only, may run beside 260–280 | — | yes (CMS, three looks), owner reviews two packs and sets the pace curve |

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
