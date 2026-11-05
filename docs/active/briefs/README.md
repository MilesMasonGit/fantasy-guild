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
| 29 | [300 Encyclopedia and collection log](300_encyclopedia.md): one full-screen reference with everything visible (no silhouettes), by kind, every source and the full ingredient tree folded, click a node to walk the tree, uses; collected ticks per kind, silent, reset at the ritual; links from every card | 28 (L2: the shared tree engine) | yes, one look |
| 30 | [310 Bank at scale](310_bank_at_scale.md): each tab holds 64 kinds (16 tabs = 1,024), Bank Slots retires; search by name, tag and type; a small Sort button beside Select (this tab or the entire Bank; type, tier, name; in place); owner CMS: item tags | — | yes, one look |
| 31 | [320 Guild Hall upgrades](320_guild_hall_upgrades.md): the Hall as a main driver: a constellation per skill (XP, yield, speed boosts, one rank per tier; Token upgrades), the Well's upgradable basic outputs, the Hearth's Infirmary and loadout slots; the Compass, Token Cap star, Cartography Table and Notice Board retire; the ledger reads every star (payback per rank) and prices the first star list; owner reviews the pack | 28 (the ledger) | yes, one look |
| 32 | [330 World map](330_world_map.md): a seeded hex world around the Starter Camp (three strict rings, wild beyond), six origin wedges, visible cells with requirements paid at once, a darkened mat with a small arrival fight, kit archetypes and specialties, building nodes anywhere per skill (Stone terrain, prospecting maps, banners), the tome as the world map, map items retired, the tutorial ending on the world map; the ledger's World plan and checks F; the first world pack; old saves abandoned | 31 (Hall boosts in place for pricing), 28 | yes, three looks |
| 33 | [340 Hero bar and sheet, detail pass](340_hero_bar_detail.md): the flag drag from the bar, wider spacing and larger names; HP numbers on a pixel bar, status as a hover bubble naming the task, yellow and red alerts beside the hero, the flag on the other side; skills two side by side, arrow scrolling, close and edit beside the sheet, larger portraits in the Bank's column; moving items between slots and heroes; four phases, no owner CMS | — | yes, once, after H4 (with looks to pick) |
| 34 | [350 Tokens and the Token card, detail pass](350_tokens_card_detail.md): heroes always on top, hover no longer lifts a Token, Tokens a little more spaced out (expect WORK CHANGED); the card rebuilt with a header, a stat block, events and requirements sections, larger art, arrows only when needed, long output lists collapsed; two phases, no owner CMS | — | yes, once (with looks and numbers to pick) |
| 35 | [360 Combat look, detail pass](360_combat_detail.md): picture mock-ups for the owner to pick from first; then the fight panel becomes a movable window that minimizes to a tab, several at once; on the mat no fight plate, stylized HP bars with numbers, fewer floats, moves and procs in bubbles, a QA test fight; crowded fights step to open space (expect WORK CHANGED); four phases, no owner CMS | C1: —; C2, C3: 340 H2, 350 T2; C4: 350 T1 | yes, several (mock-up pick, then rounds in the game) |
| 36 | [370 Rivers, water and ground, detail pass](370_terrain_detail.md): rivers with real bends and changing width that differ by world (position, winding, wider sections; expect WORK CHANGED); water with depth bands; ragged borders between grounds and dirt that looks settled; two phases, no art and no owner CMS | — | yes, once, in play |
| 37 | [380 World map, detail pass](380_world_map_detail.md): hex mock-ups for the owner to pick first; a bigger map you drag around, cell states by colour, ring lines, wild rings hidden until accessible; the tip and a thinner panel, a big Settle button, no tabs; a Guild Hall star per ring from ring 2 with its pack and the ledger counting them (expect WORK CHANGED); settling as gold banner, title, heroes walking in to the Hall, then enemies waiting spread across the dark mat until the player sends heroes (expect WORK CHANGED); five phases; owner CMS: review the stars pack | M1: —; M4: coordinate with T-294 | yes, several (the hex pick, then two looks) |
| 38 | [390 Guild Hall, detail pass](390_guild_hall_detail.md): mock-ups of sprite outlines on stars and a purple panel first; a less cluttered sky with no rank numbers, spaced stars, titles below, full-screen; a star panel with a clear sentence and now, next and max; Hall effects saying boosts; upgrade ceremony; the drop lap at 10 minutes, down to 5 by upgrades (expect WORK CHANGED and a pacing change); five phases; owner CMS: review the lap star's pack | G1: —; G3: 350 T2 | yes, several (the mock-up pick, then two looks) |
| 39 | [400 Bank, detail pass](400_bank_detail.md): a coloured pixel gradient behind every drawer and panel; a new item tooltip; a Bank inspection window with a large sprite and lifetime stats (Discard moved later, T-306); items with a Use that open instantly (Bird Nest first; the ledger reads it); four phases; owner CMS: review the Bird Nest pack | — | yes, two looks |
| 40 | [410 Shop and Foundations, detail pass](410_shop_detail.md): five Foundations each for their own kind of building, with new Excavation and Battlefield; the Shop sells Foundations only and pops up from the bottom as a row of cards with skill icons and costs; two phases, expect WORK CHANGED on the first; owner CMS: review the Foundations pack, Sync, then S2 | S2: S1's Sync | yes, one look |
| 41 | [420 Top bar, detail pass](420_top_bar_detail.md): a larger banner across the bar; the Token Summary opens on hover like Upkeep; a pixel X on Demolish; Disallow retires as a whole mechanic; two phases; no owner CMS | — | yes, one look (banner size) |
| 42 | [430 Notifications, detail pass](430_notifications_detail.md): new recipes, first finds, a full Bank and knock-outs no longer go missing after time away, listed in the summary and shown as banners on closing it; a gold banner when a place is settled; two phases; no owner CMS | — | yes, one short look |
| 43 | [440 Away summary, detail pass](440_away_summary_detail.md): two columns, item changes as one net list on the left and news on the right; fights as kill counts; a centred heading; a second confirm on both buttons; save slots show the away time built up; two phases; no owner CMS | 430 N1 | yes, one short look |
| 44 | [450 Settings and start screen, detail pass](450_settings_start_detail.md): a cleaner three-tab settings window; a title screen; saves become real files with a button that opens their folder (today's saves don't carry over); a new game names the Guild, shows rings 1 to 3 of the world with a reroll and makes the first hero; four phases, S3 alone (never lose a save); no owner CMS | S4: S2 | yes, three looks |
| 45 | [460 Hard pixel finish, detail pass](460_hard_pixel_finish.md): the last soft glows, text shadows and drop shadows go to hard pixel (T-013); a sheet for the owner first, then the change; no owner CMS | — | yes, the sheet, then a short look |
| 46 | [470 Encyclopedia, detail pass](470_encyclopedia_detail.md): mock-ups, then a clear difference on the chart between what is required and what is produced; counts and small progress bars in the book's corner; a recipe's ingredients link to their pages; three phases; no owner CMS | — | yes, the mock-ups' pick, then a look |
| 47 | [480 The very early game and Limes](480_early_game_slurm.md): Limes the guide, in a large corner portrait with a stay-until-done bubble and gold outlines; an empty opening, a scrap heap and rusty tools that break; about 10 minutes of lessons, then one big goal, settling a place; Smithing a recipe per level from the ingot; four phases, expect WORK CHANGED; owner CMS: review the opening's pack, Sync | 410; 450 S4; **L2 to L4 wait for content planning's buildings (T-307)** | yes, the scale pick, then a full play |

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
- **Looks are picked from screenshots, then one is built** (owner, 2026-11-05): where a brief says "show two or three looks" or "for the owner to pick", the phase first renders them as a screenshot comparison page (mock-ups or the real game, side by side, a letter each). The owner picks, and only the picked design is built. No look switches in the QA panel. Eye-checks then cover how it plays.
- **Old saves aren't protected** (owner, 2026-11-05; GDD: refused until 1.0): no brief spends work keeping a save from before a change playable. A new game is the test. File saves, once brief 450 S3 lands, must still never lose data.
- **Bookkeeping**: close tickets into `docs/archive/tickets_done.md`, log
  changes in `CHANGELOG.md`, update `docs/active/NOW.md` at the end of a
  session.
