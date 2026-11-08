# Tickets — the one backlog

**This is the only place open work is tracked.** Bugs, performance, cleanup,
tests, owner to-dos and pending design questions all live here. Feature plans
live in their roadmap docs; when a plan leaves loose ends, they become tickets
here.

## Rules

- **Add**: next free `T-` number (see the counter), one row, one line. Put
  detail in the row or link a section of a live doc; never start a new list
  somewhere else.
- **Close**: delete the row here and append one line to
  [`docs/archive/tickets_done.md`](../archive/tickets_done.md):
  `T-NNN — summary — commit hash — date`.
- **Status**: `open` (anyone may take it) · `owner` (blocked on the owner —
  say on what) · `blocked` (say on what) · `ride-along` (do only while already
  editing that code).
- **Priority**: **P1** a player can hit it, or a measured miss of a target ·
  **P2** real cost or risk · **P3** tidy-up.
- **Origin**: the old ID, so the full write-up can be found in
  `docs/archive/` (CR4 = code review round 4, `docs/active/review/`;
  CR3 = code review round 3, `docs/archive/review_v3/`;
  FB = token lifecycle feedback; FMR = free playmat review, 2026-09-21).
- **Before closing a batch**: the merge gate in
  [`docs/reference/TESTING.md`](TESTING.md) (tests, bench, cycles).

**Next free number: T-338**

---

## 1. Waiting on the owner

| ID | What | Origin |
|---|---|---|
| T-007 | **Coal Vein at 4 s**: accept, re-tag its purpose from gold to items (~3 s), or leave for the simulator rework? | FB §5.1 |
| T-008 | **Flag Radius upgrade art**: keep borrowing the plain hero flag, or use the red banner art? ⚠️ Moot once brief 260 O2 lands (Scouting Flags retires). | FB §5.2 |
| T-010 | **Speech bubble audit**: add/remove list for `docs/reference/speech_bubble_lines.md`. | FB §5.5 |
| T-011 | **Watch by eye** (no agent has seen these on screen): Token hit animations + transform glow, loot flight to the Hall, Shop drawer, countdown badge. | FB §5.6 |
| T-012 | **Decided (owner 2026-11-02): keep.** Transforms push neighbouring spawned Tokens, as they do today; nothing to build. | FMR |
| T-014 | **Quest content is written in engine code** (the tutorial chain, `tutorialQuests.js`), not the CMS. Move it to content? (Design call, never asked; Atlas A8 rewrites the chain.) The opening half is closed: the Starter Camp is content (Atlas A7). | CR3-515 |
| T-127 | **Markets are cut for now** (owner 2026-10-09, D2): the Shrimp Market Token runs but pays nothing. Retire or repurpose it in the CMS (it turns up from Shrimp Coast content). The GDD §16 question is closed. | concept_progression.md |

## 2. Open work

### Engine

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-334 | P2 | open | **DropLap test fails since the Swift Laps Sync** (`src/tests/DropLap.test.js:300`, "synced: the QA mirror then gives way"): the owner synced the drop-lap pack on 2026-11-06 (421c58bd, `star_well_lap` now in `data/hallStars.json`), so the test expects the QA fixture's mirror star to be removed. Remove the QA mirror (the test says where) and the test's pre-Sync branch; builder-lite. Fails on main, 1 of 7,881 | brief 390 G5 |
| T-333 | P2 | open, measured | **A hidden page piles up detached elements and listeners** (confirmed by the 30-minute soak baseline, 2026-11-07, `review/baseline/soak.txt`): while `document.visibilityState` is hidden and the drawing clocks are paused, DOM nodes climb 294 a minute and listeners 136 a minute (1,876 → 3,347 nodes, 830 → 1,505 listeners over five hidden minutes), most of them detached (the document itself grew 26 a minute); all released at the first visible frame. Engine ticks keep running at 100 % while hidden, page task time drops to 6 %. A game left in a background browser tab for hours keeps climbing; the desktop app is probably unaffected (WebView2 keeps the page visible when minimised: unverified). Guess, not checked: elements removed while no frame runs stay alive until the next rendered frame. Next: `npm run bench:soak -- --hidden=20 --snapshot` with snapshots around the hidden phase to name the holder. | soak prep, review R11 |
| T-335 | P2 | open, measured | **The idle heap grows about 52 KB a minute while visible** (soak baseline, 2026-11-07, cap128, 27 fitted minutes, r² 0.97, WARN at 50, fails at 200): 17.4 MB heap, up 1.3 MB over the run, with no growth in nodes, listeners, subscribers or documents. The class-by-class snapshot diff puts the retained growth in compiled code (+1.17 MB, +2,106 objects), closures (+1.04 MB retained on +87 objects), scope contexts (+0.58 MB) and plain Objects (+1,684), plus Blink style caches (PresentationAttributeCacheEntry 79 → 425, CSSRatioValue 154 → 846, CSSValueList +703). Compiled code is V8 warming up and may level off; the closures and contexts are the lead. Next: a 60-minute run to see whether it levels off; if not, `--snapshot` with a longer gap and follow the closures' retainers in DevTools. | soak baseline, review R11 |
| T-258 | P2 | open | **Put the tutorial's Old Site step back once the endgame ruins exist** (owner 2026-10-27 removed it, T-259): the concept puts 25 endgame ruins in the Starter Camp; no Token is marked `landmark` yet. When the ruins are authored and placed, restore the inspect step and its lines | K4 (Owner 2026-11-04: the old steps retire with brief 480; a place for the ruins goes in its goal, if wanted.) |
| T-287 | P3 | open | **Enemy performance, next steps** (T-200 report; the tether census and the loot flight's forced layout merged 2026-11-03): the walk-end neighbourhood rebuild (~8 % of the enemies80 tick; limiting it to the walker needs a ruling on modifiers that are stale on purpose: `charges_below`, `worked`, `carrying`); MatBoard re-rendering every tick with walkers (structural, eye-check); a JS-stepped walk glide (~3,000 transition events a second; eye-check and `bench:crisp`) | T-200 engineer 2026-11-02 |
| T-294 | P2 | open | **The ledger and world tables can't hold the ladder yet**: the ledger's plan tiers stop at 5 (`PLAN_TIERS`, the ladder needs 7) and a cell's settle level and price follow its ring, not its rung. Open tiers 6 and 7, let a cell's requirement follow the rung of its main material, then set stage budgets and the new pace curve in the plan ([the ladder](../active/concept_content_roadmap.md#the-ladder-owner-approved-2026-11-02)). **Ring stars (brief 380 M4) lean on the same mapping**: the ledger prices a ring's Guild Hall star so the ring opens when the stage before it ends, reading ring n as opening after tier n − 1 in one place (`ringBudgetTier` in `ledger/pace.js`); when rings hold several rungs, make it the ring before's last tier, re-run the stars' proposals (CMS Guild Hall page) and re-price the wild rings' stars, which wait on budgets for tiers 3 and on (today priced by the wild price growth, in tier 3's Watermelon) | content roadmap 2026-11-02 |
| T-336 | P2 | open | **The ledger calls every rare find "Luck only"** (owner ruling 2026-11-07, [concept_balancing.md](../active/concept_balancing.md)): `LUCK_BELOW` (5 %, `src/systems/progression/ledger/engine.js`) marks any drop under it with no sure way as luck, but the owner rules that a very low rate on repeatable work is a steady source (0.1 % on a 10 s cycle is about 8 a day). Judge repeatable sources by finds a day for one hero (a threshold in the ledger's settings), and keep the warning for one-off finds that wear out. **Also**: rare-find boosts get their own boost-strength target (potion x2 to x3, building x1.5), so the balancer doesn't cut them to the consumable +20 %. | content agent 2026-11-07 |
| T-337 | P2 | open, rules approved 2026-11-07 | **A new XP table** ([BALANCE_RULES.md](BALANCE_RULES.md) section 1, owner 2026-11-07): `xpForLevel` in `src/utils/XPCurve.js` (the RuneScape formula) becomes the rules' table, XP to the next level = 1,660 x 2^((L - 1) / 20) x the pace curve's minutes / 60, about 20.6 million to 99 (today about 13 million), so work pays 2x more an hour each tier. ⚠️ Levels in old saves shift; the ledger reads `xpForLevel` and follows on its own; the hero sheet's numbers need the shorthand. Lands with the balancing pack, not before, or today's XP rewards no longer fit the levels. | content agent 2026-11-07 |
| T-295 | P3 | open | **Loot flight gets an arc back, without costing performance** (owner 2026-11-02: "we lost the arc effect at some point, possibly for performance"). A small experiment measured with the draw bench. Find first which flight lost it: `ParticleOverlay.jsx` still has arc code for flights to a stub. Wait for T-197 (`perf/loot-bubbles`) if it is still open. Eye-check: the owner judges the feel. |
| T-296 | P3 | open | **Extra boards may pile up at the Hall** (seen once, 2026-11-02, by the terrain comparison's agent, after about 30 minutes of play in one dev game, world map build; not looked into, may be a test artefact). Try to reproduce in a fresh game before anything else. |
| T-301 | P3 | open | **Audit how item counts are shown across the game** (owner 2026-11-03): the Shop's price ribbons show the full number instead of our shorthand. List every place an item count shows, say which use the shorthand, and bring the rest in line. |
| T-302 | P3 | open, needs an interview | **The hero recolour system** (owner 2026-11-02 and 11-04): players recolour a hero's sprite in the edit window and on the new game screen (detail pass, section 11). Not designed yet: the planning agent interviews the owner first, with looks from real art. |
| T-303 | P2 | open, needs a brief | **Gloves, boots and cape slots** (owner 2026-11-04, [content_smithing.md](../active/content_smithing.md), [content_tailor.md](../active/content_tailor.md)): heroes get three new gear slots. Touches `EquipmentManager`, the hero sheet (brief 340 lays it out), gear defence numbers and the CMS. Today gear is hand, hat, chest and two trinkets. |
| T-304 | P2 | open, needs a brief | **Tailor, a 21st skill** (owner 2026-11-04, [concept_content_roadmap.md](../active/concept_content_roadmap.md)): the skill itself in the registry and CMS, a skill icon for the art list, a station, and every place that counts skills (the ritual's final challenges, hero sheet, ledger). Its content list comes from a roadmap session first. |
| T-305 | P2 | open, needs a brief | **Put the approved content roadmap in the CMS as Planned entries** (owner 2026-11-02, [concept_content_roadmap.md](../active/concept_content_roadmap.md)): a pack per chain page, so the ledger can check the whole plan. Needs T-294 first (tiers, the 20-level ladder). Planned entries never reach the game. |
| T-318 | P3 | open | **The Token name on hover is larger** (owner, 2026-11-05). Show the owner two or three sizes on one screenshot page, then build only the pick (briefs README: looks are picked from screenshots). Check it on small and large Tokens and at mat zoom. Eye-check: no, the screenshot pick is the look. |
| T-317 | P3 | open | **Hero bar HP bars are light red** (owner, 2026-11-05): every hero HP bar on the hero bar uses the mat's light red (`HP_COLOUR` in `src/ui/components/board/healthBar.js`) whatever the health, replacing the green, amber and red tones (`hpTone` in `dockHeroView.js`). Check any other hero HP bar (hero sheet, fight window) and say which already match. Look-only, merges on the gate with a line in STATUS. |
| T-332 | P3 | open | **A pack's Token description does not survive the Sync** (found 2026-11-06 after the Foundations pack: Excavation and Battlefield read "A token for the guild playmat."; the CMS writes descriptions from rules, `cms/src/engine/descriptionDictionary.js`). Either the CMS keeps an authored description, or packs stop writing one; the owner types the two in the CMS meanwhile | director 2026-11-06 |
| T-331 | P3 | open | **The star panel's price shows a stale have count when the pinned panel switches stars** (found by the 390 G5 builder, 6 Nov): it showed 0/110000 with 110,000 in the Bank until any Bank change. `GuildUpgradeInspection.jsx`: the `haveSignature` `useGameState` recomputes only on events, not when `upgradeDef` changes | director 2026-11-06 |
| T-329 | P3 | open | **A wide sideways swipe over the encyclopedia chart can trigger the browser's Back** (found by the 470 E2 builder, 6 Nov, in a Chrome tab; untested in the Tauri window). Check Tauri; if it happens, stop overscroll navigation on the chart | director 2026-11-06 |
| T-327 | P3 | open | **Inline text outlines never show** (460 P1, 6 Nov): `tailwind.css` gives every element the hard 1 px text outline with `!important`, so inline `textShadow` loses: four soft ones are dead code, and seven hard outlines written on purpose never show (work plate numbers, fighters' HP numbers, the fight window's words, VitalBar, three Guild Hall OUTLINEs, the dock pager). Decide per case whether the thicker outline was wanted; table 3 of `research/hard_pixel/list.md` | director 2026-11-06 |
| T-326 | P3 | open | **Spawners that missed search again although the board is unchanged** (brief 500 engineer, 6 Nov): on C240 the 16 Forests and Quarries below their cap all miss in the same tick every 5 s (about 0.65 ms each), C240 p99 4.8 to 9.8 ms. A missed spawner could skip its next search while `MatPlacement.roomVersion()` is unchanged; needs care, since which Tokens can be pushed may change without the stamp. Real play staggers the clocks; accepted for now | director 2026-11-06 |
| T-325 | P2 | open | **Catch-up bias: a hero arriving part-way through a 1 s step gets the whole step** (found by the C4 engineer, 6 Nov, measured): in a crowded hunt, 1000 ms steps kill 1736 an hour against 1579 at 100 ms ticks (+9.9 %) on main; walking time 302 s vs 1187 s. Offline time away plays a little richer than live. An engineer brief: carry the arrival's leftover into work and fights as the work-cycle carry does; expect WORK CHANGED nearly everywhere | director 2026-11-06 |
| T-324 | P2 | open | **The bench's fidelity gate flakes on one seed** (C4 engineer, 6 Nov): S8L vs S8F `depleted` is now about 55 an hour, nearly all goblin kills, and jumps at thresholds, so main fails the ±1 % gate on 6 of 15 seeds (seed 2: 53 vs 57). Judge it on the median per-seed gap over about 5 seeds (main median 0, C4 -1; about 70 s more per compare), and update bench/README's about 6 depletions an hour | director 2026-11-06 |
| T-323 | P2 | open | **Drag bench on main: hero drops without a flag, and covered flags** (6 Nov 03:00, `bench:drag --kinds=dockHero,flag` on main 6513255e): 4 and 2 of 50 dock-hero drops (plain, overlays) end with the hero holding no flag (drop sound hero_assign); 47 and 34 of 50 flag drags skipped because every flag is drawn under something (heroes on top since 350, 30 % spacing); one flag pickup took the wrong hero's flag. Diagnose whether the drop fault is the game or the bench | director 2026-11-06 |
| T-321 | P3 | open | **React duplicate key: Goblin Camp (its own)** in SpawnerSystem's dev rows when two goblin camps stand on the mat (seen by the brief 500 builder; there before it) | director 2026-11-05 |
| T-316 | P3 | open | **Coast swing and roughness sliders do nothing since ragged borders** (370 R2): `edgeSwing`, `edgeRoughness`, `edgeStrips` and `edgeProfile` no longer reach the drawing; kept with a warning comment. Remove them and their tests, or wire them to the ragged borders | director 2026-11-05 |
| T-315 | P3 | open | **A crowded fight can step onto a tree or into water** (360 C4): the step to open space ignores Tokens and ground, as an enemy stroll does. Once rivers (370 R1) land, check whether a fight stepping into a river reads badly; if so, pass over spots on water | director 2026-11-05 |
| T-314 | P2 | open | **Every enemy has a basic attack and special attacks at a chance** (owner 2026-11-05): a basic attack that never bubbles on the mat, plus special moves (an effect, or no hit) each with a percentage chance. Moves already pick by `weight` (`src/config/registries/enemyMoves.js`); likely the CMS shows the chance as a percentage and the content agent authors a basic attack for every enemy. Needs a short interview: is the chance per swing, and do specials replace the basic attack or come on top | director |
| T-312 | P3 | open | **C256 p99 about 20 ms**: on a full mat the waiting Forests and Quarries whose clocks line up all try in one tick (mean 1.9 ms; clocks spread give p99 8.8). The rest of a failed push's cost; a spatial grid for moved Tokens was tried and was slower | engineer 2026-11-05 |
| T-310 | P2 | open | **The QA panel is too cluttered** (owner 2026-11-05): sort it so the owner's checks are quick to find; drop sections nobody uses; dev-only look switches go once their pick is built. Needs a short interview on what the owner uses it for. |
| T-309 | P3 | open | **A hero kind no drag starts any more**: since dragging a hero off the bar carries their flag, `DRAG_KIND.HERO` has no source. `MatHero.jsx`, the readers in `OrderDragLine`, `OrderLighting`, `Board`, `dropOnMat`, `FlagLayer` and `BankHeroPanel`, and about 8 test files still name it. Clear out once brief 340 has merged. |
| T-308 | P3 | open, owner choosing | **A very crowded Forest replants without end** (brief 350 T1, 2026-11-05): with 7 or more other Tokens around it at 30 % overlap, no spot has the grown tree's room, so a Sapling takes the small gap, shifts out of reach on growing and the Forest replants: 12 to 20 seedlings in 10 minutes instead of 5, stray trees and stumps that never regrow. Today's 40 % has a mild form (21 of 40 runs at 9 neighbours). Probe sets were the engineer's own; how often real play crowds a Forest like this is not measured. A player dropping a Token beside a small Stump can also shift a tree on growing (not measured). Owner's choice in the eye-check. |
| T-306 | P3 | open, needs an interview | **Discard, or selling, in the Bank's inspection window** (owner 2026-11-05, moved out of brief 400 B3): amounts 1, 50 %, All, All −1 or a slider, and **Discard always confirms**. The owner hopes to find a way to sell items instead ([ideas.md](../active/ideas.md)); gold left the game, so a sale needs designing first. |
| T-307 | P2 | open, needs a brief | **One clear building per skill** ([content_construction.md](../active/content_construction.md); owner 2026-11-05): a spread of buildings, so the different building effects can be tested. **Waits until the owner has polished content planning.** Today's rules split recipes by station kind, and the tutorial, ledger and Starter Camp name today's stations. Brief 480's L2 to L4 wait for this; brief 410 doesn't. |
| T-300 | P3 | open | **Leftovers from the map retirement, for a decision**: Region rules (`RegionRules.js`, recipe `rules`, the ledger's region factor) are tested but no shipped recipe carries one, leave until brief 380 settles; `data/maps.json` is `{}` and read by nothing; `src/ui/dev/terrainDev.js` is imported only by tests; a saved stack of a deleted item stays hidden and still takes a Bank slot (no fix recommended: old saves are abandoned) | T-292 engineer 2026-11-03 |
| T-299 | P3 | open | **Forced layouts bigger than the loot flight's** (20 s trace on enemies80, busy machine, one run): `HeroBubbleLayer.jsx:168` 24 style and 25 layout, 82.5 ms; `healthTextWidth` in `FightLayer.jsx` 3, 15.6 ms. Measure on a quiet machine first | T-287 engineer 2026-11-03 |
| T-260 | P1 | built 79c6b01c; owner sets tiers | **Recruits may hold copper weapons** (owner 2026-10-27, reverses the C2 call that Recruits refuse weapons): no hero leaves Recruit in plane 1 (the Fighter needs Mining and Smithing 10), so crafted copper swords were useless | K4 |
| T-176 | P2 | open | **The quest board** ([concept_quests_tutorial.md](../active/concept_quests_tutorial.md), "The quest board", owner 2026-10-20): one fixture board at the bottom-left of every Region's mat; click opens its card on the quest list; up to 3 collect/hunt bounties from reachable content, Bank have/need, Claim takes items and bursts materials as floating loot; tutorial step pinned first; gold outline and ready count at rest. Replaces the loose quest Tokens. Brief 170. | owner interview (Owner 2026-11-04: its pinned tutorial row no longer applies; brief 480.) |
| T-175 | P2 | owner | (Concept still a draft, owner 2026-10-14: not for the director yet.) **Collectors: the Guild Hall and warehouses** ([concept_collectors.md](../active/concept_collectors.md)): the Hall collects all loot in a small radius from the start, widened by a ranked Hall star; warehouses built on Foundations collect items with one tag (CMS Collects block: tag, radius, interval ~60 s), bigger radius on higher tiers, no upkeep; shared sweep clock, nearest collector wins, items fly in; Bank-full leaves loot and shows the yellow mark; reach ring on hover, drag, placing. Remove the auto-collect setting. Engineer. WORK CHANGED expected. Cost-log line. Eye-check. | concept_collectors.md |
| T-253 | P3 | open | **A CMS page for engine tuning numbers** (brief 230 S1a, owner 2026-10-24: "a ticket later"): the speed-up floor (`MAX_SPEED_UP_CUT = 0.8`) and the elixir dose (`ELIXIR_FIGHTS = 10`) live as code constants in `loopConstants.js`; give the owner a synced tuning page (a `data/tuning.json`, a CMS page, a loader). Builder. | brief 230 S1a |
| T-026 | P3 | ride-along | Small per-tick allocations in combat and statuses. | CR3-032 |
| T-027 | P3 | ride-along | Motion ticks allocate small objects per walker. | CR3-153 |

### Brief 210 — the backlog intake (owner 2026-10-22, Backlog director)

Detail, order and tiers in [brief 210](../active/briefs/210_backlog_intake.md); the owner's words in `docs/active/research/backlog_intake_2026-10-22.md` (intake codes in brackets).

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|

### UI

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-162 | P3 | ride-along | **Pixel sprites replace vector icons** (lucide: chevrons, X, zap, sparkles, help circle and others) as each screen is touched; missing sprites get a placeholder and a line in `owner_art_list.md`. | UI_STYLE.md (2026-10-13) |
| T-261 | P2 | brief 250 | **Enemies show a charges count on hover** (their hidden use count); an enemy shows name and HP only. Brief 250 P1. | owner_feedback 2026-10-27 |
| T-262 | P3 | brief 250 | **A choice waiting on you swaps its '!' for the gear on hover**: Foundations and recipe stations, the gear in the same spot at 2× (64 px). Brief 250 P1. Eye-check. | owner_feedback 2026-10-27 |
| T-263 | P2 | brief 250 | **One plate for every Token**: no output item on the work plate (skill icon when there is nothing else), idle Tokens get the plate under them on hover, the round charges, timer, spawner and quest rings retire. Brief 250 P3. Eye-check. | concept_token_bars.md |
| T-150 | P3 | brief 250 | **The pennant flag**: every hero's flag is the owner's 32 px pennant (`public/assets/ui/u_flag_pennant.png`) at 2× (64 px), the same for every hero; no fade and no colour cue for now (owner 2026-10-27: a flag rework comes later). Brief 250 P2. Eye-check. | refinement_pass_todo.md §3, ideas.md, concept_token_bars.md |
| T-151 | P3 | owner | **Colour-blind-safe hero flags**: safe colours plus a second cue (pattern or initial). Joins the owner's later **flag rework** (owner 2026-10-27), which also settles hero colours and the fade now that every hero carries the same pennant. | ideas.md |
| T-157 | P3 | open | **Quick Settings landing tab** in Settings: Master, Music and SFX volume, Animations, font and text size, Item Fly Particles, Auto-save interval (owner 2026-10-13). The same controls stay in their own tabs. Eye-check. | refinement_pass_todo.md §2 |
| T-138 | P3 | owner | **Sprite-strip player for owner-drawn effects**: play a horizontal strip once at a mat point on the strike frame / event (like `AnimatedHeroSprite.jsx:57-76`); a new `assets/fx/` folder added to the spriteFx generator's skip list (`spriteFx.js:77-80`). Waits for the owner's first effect art (owner_art_list.md). | research/animation_menu.md |
| T-119 | P3 | open | **Convert existing screens to the strings file** (format, lookup and TEXT.md built 2026-10-20, 9a103fbb: `src/i18n/en.json`, `t()`, `docs/reference/TEXT.md`; new UI uses it). The old screens convert in a later pass. | ideas.md |

### Cleanup — dead code, vestiges, lint *(safe, invisible; delete tests only with the code they test)*

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-140 | P3 | open | **The Map check's dials and refusals are read by nothing** since Atlas A5 retired `mapPass.js`: in `cms/src/engine/sim/dials.js` `mapScrapRatio`, `mapProductiveReturn`, `rarityPremium`, `rarityWeights`/`RARITY_WEIGHTS`, `scrapRatioAt`, `productiveReturnAt`, `pinnedAt`; `dayInReach` in `xpPass.js` (and `hoursPerDay` if the Pace dials no longer need it); the seven `map-*` codes in `refusals.js`; their fields in the CMS Settings modal. Delete with their tests (`EconSimXP`'s `dayInReach` cases; `EconSimLevers`' Map-card test flips back to absent). Also `checkPass.js` skips unlimited Tokens because the Map check used to name them: nothing names them now. | Atlas A5 |
| T-141 | P3 | blocked | **Content audit: a respawning node still sold at the Shop** (roadmap A5 lists it): warn when a Token with A2's Respawns block also has a `shop` block. Blocked on A2 merging (its block shape). One rule in `lifecycleAudit.js`, so the boot check and the CMS Economy Audit share it. | Atlas A5 |
| T-054 | P3 | open | Class names that match no stylesheet: `animate-in`/`fade-in`/`zoom-in-95` (no `tailwindcss-animate`), `custom-scrollbar`, `gi-scrollbar`. The unused z-index tokens went in 87a461a2; the unloaded stylesheets were already gone. | CR3-465 |
| T-056 | P3 | open | Rename `DeckDndProvider`/`DeckDndContext` (about forty test files import them). The tile accessors, unused constants, tray particle fields and dead particle lookups went in 70590720. | CR3-504, 408 |
| T-057 | P3 | open | Rename tile-named engine vocabulary — code names and event strings together, one slice. | CR3-501 |
| T-058 | P3 | open | Lint residue (~74 old errors), per area: engine, combat (keep `MERGE_GRACE_MS` at 1100), UI↔engine (don't add hook deps blindly), renderer, UI. | CR3-110, 265, 312, 359, 467 |
| T-059 | P3 | open | The CMS imports `itemRegistry` for one constant. | CR3-511 |
| T-060 | P3 | blocked (soak) | Toasts may leave page elements behind. A 60-minute soak decides: certification Part G (`docs/archive/certification_checklist.md`), or automate it with the drawing bench's Chrome driver. | CR3-039 |
| T-063 | P3 | open | `resolveAnimationPath` hard-codes an id map and uses a relative `assets/` path. *Unverified since 2026-09-21.* | FMR |
| T-094 | P3 | open | Villager remnants: `isVillager` branches in `EquipmentValidator`, `HeroRehydration`, `SkillSystem`, and the QA panel's filters. Held back while the rules and UI branches edited those files. The test-only effect helpers and inert globs went in 40123429. | GDD survey, W3 |
| T-108 | P3 | open | `cardUseCounts` (counts completed cycles per Token type; `GameState.js`, `BoardRunner.js`) is a deck-era name; rename it after the parked `atlas-wip` branch is merged or dropped (its `StateSchema.js` edit declares the field). | hygiene W4 |
| T-103 | P3 | open | Comment-slimming leftovers: `src/state/StateSchema.js` (review ids and history; `atlas-wip` still parks an edit there), `cms/src/engine/sim/dryRun.mjs` header, ~15 test comments clipped by the ID stripper (none found by pattern). Tuner hints, WORK_SKILL_WHY, the reachRegistry names and `PERSONALITY_TAGS` done in 2c116882. | Slimming pass |

### Build, tests, docs

| ID | Pri | Status | Summary | Origin |
|---|---|---|---|---|
| T-067 | P3 | open | Skipped tests: the Map-burst rule skips still need a ruling or deletion. | CR3-554 |
| T-116 | P3 | open | The CMS content generator still writes the retired task/area effect vocabulary (`targetCategory` enum ALL/COMBAT/MELEE/MINING/INDUSTRY/NATURE/CRAFTING in `contentGenerator.js`); only its skill list follows the registry. Its prompt also still teaches energy costs and the per-level skill multiplier (`contentGenerator.js`, `useGlobalStore.js` defaults), both retired. It is still reachable from the CMS's Generate button, so rewriting the prompt is a design call, not dead code. | brief 20 R3 |
| T-114 | P3 | open | Remove `migrateSkillIds` (the `logging` → `forestry` content migration in the game loaders and the CMS store) once the owner has synced `data/` with `forestry`. | brief 20 R0 |

## 3. Parked — don't work on these without a reason

*Latent = the code is wrong but no shipped content triggers it. Fix it, test
first, when content that uses it is authored.*

| ID | Why parked | Summary | Origin |
|---|---|---|---|
| T-071 | Envelope decided: parked (owner 2026-10-21) | Canvas mat. Envelope (GDD §14): Tokens are the cheapest thing on the mat (about 1 ms at 128); fix the moving things first (T-197 to T-201). Reopen only if 256 must be smooth on a slow laptop. | CR3-355 |
| T-072 | after the crunch | `@ts-check` trial on the contract layer. | CR3-560 |
| T-073 | latent | Input-cost discount applied when paying, not when checking. | CR3-028 |
| T-074 | latent | Item rules can be given moments that never fire. | CR3-202 |
| T-075 | latent | Rule upkeep pays from the Bank only (spawner upkeep is fixed by TL-20). | CR3-204, FB §5.4 |
| T-076 | latent | Each cure reaches only one of the two effect systems. | CR3-251 |
| T-077 | latent | Timed effects lose combat numbers on reload; use game time, not the wall clock. | CR3-252 |
| T-078 | latent | Loadout re-expanded on every axis read. | CR3-253 |
| T-079 | latent | Loading rewrites the Guild Hall's definition. | CR3-257 |
| T-081 | latent | Engine init isn't safe to run twice — only matters with a "back to title" feature. | CR3-108 |
| T-082 | latent | Shop's unreachable refund path skips mat events. | CR3-206 |
| T-083 | re-check | Synchronous subscribers; several whole-mat rebuilds per tick. Probably closed by Wave 3b — re-measure before working on it. | CR3-102 |
| T-084 | not needed | Push solver all-pairs (S4 worst push ~15 ms vs 8). Only matters past ~250 Tokens; T-035 may make it moot. | CR3-152 |
| T-086 | needs a Codex screen | Enemy kill counts never recorded. | CR3-035 |
| T-087 | owner-deferred | Desktop-shell group (save export, `src-tauri`). | CR3-046 |
| T-088 | Stage 2 | Randomness is unseeded and has no injectable source. | CR3-044 |
| T-089 | Stage 2 | Hero state lives in seven stores. | CR3-561 |
| T-090 | Stage 3 | Terrain can't be added through the CMS. | CR3-564 |
| T-091 | Stage 3 | Tokens teleport; mat size is dev tuning. | CR3-565 |
| T-092 | design | The free-playmat plan's "Map stays unopened" overflow rule (FP-46) is unbuilt; overflow drops as loot. | FMR |
| T-100 | before release | Master volume defaults to 0 so the owner can work in silence; set an audible default before shipping. | GDD §16.10 |
| T-199 | P2 | open | **24 h catch-up misses 30 s at 256 Tokens (38.3 s) and about 70 enemies (35.6 s)** (Envelope; the owner keeps the 256 cap, so this must be fixed). At ~4x it takes 6.4x its full-speed time; check the 50 ms slices' yields and the catch-up bar. `CatchUp.run`, the tick handlers; profile with `bench/catchup/time.mjs --scene`. Engineer. | brief 90 |
| T-201 | P2 | open | **Drags on the 128 board at ~4x fail smooth's drag test by about 2x** (Envelope: pickup 55-61 ms, drop 73-109 ms vs 33.4 ms). Continue T-033's next steps: dnd-kit context changes, the drop animation's measuring. Engineer. | brief 90 |
| T-203 | P3 | open | **The `camp128` bench board's premise is stale** (it assumes 25 endgame sites outside the cap; `MatCap.countsTowardCap` and GDD §3/§16 count landmarks): fix `bench/scenarios/cap.mjs`, the `stressScenarios.js` label, `bench/README.md` and PERFORMANCE 'Smooth, defined'; rename it cap153 or retire it. Builder-lite. | brief 90 |
| T-207 | P3 | open | **Smooth's second line is effectively pass/fail** on the headless 165 Hz clock (the 1-in-1,000 frame within 33.4 ms: 30.3 ms passes, 36.4 ms fails). Restate it as 'at most 5 frames', or lean on the 16.7 ms share plus the long-frame count. Director, with the owner. | brief 90 |
| T-209 | P3 | open | **The 128 board at 1x read 97.2 % within 6.06 ms** in one window on 2026-10-21 vs 99.5 % on 2026-10-09: confirm with three windows in a quiet bench window; if real, find what moved it. Director. | brief 90 |
| T-196 | P3 | open | **Afterimages look wrong as white speckles** (owner 2026-10-21, eye-check of the animation batch): the hit and loot-hop afterimages are speckled white copies (`src/ui/components/board/fx/`, generated tinted pictures). Try the sprite's own colours speckled, or another look, on the style sheet page first; refinement pass. Eye-check. | T-137 |
| T-195 | P3 | open | **Three one-line leftovers in the terrain director's files** (engine plumbing, 2026-10-21): `src/systems/atlas/Atlas.js:516` still publishes `STATE_CHANGED` after its own `GAME_RESET` (delete it, then `STATE_CHANGED` from `engineEvents.js` and its `NO_LISTENER` entry, and tighten `StateChangedRetired.test.js`); `src/systems/atlas/layoutInputs.js:25` reads `matTuningDefault('matSteps')` and should read `MAT_STEPS` from `matGeometry.js`. Also (2026-10-21): `src/ui/dev/terrainDev.js` (`DEV_GROUND_TOKENS`) has the Test Boat borrow `token_fishing_net`'s look, and the tools content sync deleted that Token; repoint it to a live Token and remove its `KNOWN_DEAD` entry in `ContentIdsInCode.test.js`. Terrain director. | T-015, T-097 |
| T-193 | P3 | open | **A notification log** (owner 2026-10-19: low priority, build only if it proves needed; [concept_notifications.md](../active/concept_notifications.md) "Later: the log"): opens as a modal; plain-text rows like the item stubs, no sprite; a new-items dot, no count. Builder. Eye-check. | brief 150 |
| T-189 | P3 | open | **Retire `data/palettes/materials_library.json`** (found 2026-10-16): 12 lower-case ramps the Studio only reads (a GET in `RecolorEditor.jsx`), looked up only when a swap target matches a lower-case key exactly, which the dropdown never offers. Confirm nothing needs it, then remove the read and have the owner delete the file through the Studio/CMS. builder-lite. | T-180 palette bake |
