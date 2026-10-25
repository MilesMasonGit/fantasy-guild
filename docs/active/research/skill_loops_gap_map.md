# Brief 230 S0 — Gap map (read-only)

Engineer, 2026-10-24, on `main` at 2007e868 (after f415b5d3). No code changed, no branch, no server.
Sources: brief 230, concept_skill_loops "The next pass" + "Rulings this pass", GDD §3/§4/§7/§14,
concept_combat C3–C5 sections, `git diff main...systems/combat-encounters`, brief 240, and the code.

## 0. What I measured versus reasoned

**Measured** with a scratch vitest file outside the repo
(`scratchpad/s0proof/s0_probe.test.js`, run through a scratch config that reuses the project's
`vitest.config.js`; 6/6 pass, nothing written to the repo):

1. **A Mine works today as a Token-borne Double Item Chance**: a buff Token with
   `Provides Double Item Chance 25 (flat), narrowed to Copper Ore, to [id = vein], nearby`
   gives the vein a 20–30 % double on Copper Ore over 2000 rolls, 0 % on the Coal it also drops,
   **100 % with four Mines in reach**, 0 % for a vein out of reach. No engine work.
2. **The only speed-up floor today is the engine's 1 s**: five Minecarts at −20 % each resolve a
   10 s vein to 0 ms (`TileModifiers.resolveAxis`), and the worked cycle runs at exactly 1000 ms
   (`BoardRunner.tick`'s `Math.max(1000, …)`). There is no 80 % floor.
3. **Growth ignores neighbours**: a "Forest" providing −50 % Work Time to a Sapling does nothing;
   the Sapling still takes its full 30 s (`TimedChanges` reads `grows.afterMs` only).
4. **A miner whose only vein rests goes idle**: `Flags.statusOf` = `idle`, `BoardRunner.isHeroIdle`
   = true, skip reason `resting` — that is the path that says "No work in range."
5. **A station out of input**: a pinned hero stays (`alert = inputs`); an area-flag hero leaves the
   starved station for a vein in reach the next pass.
6. **Cost of a live axis read** (owner's PC, node, not the bench): `resolveAxis` ≈ **1.2 µs** with
   no modifiers, ≈ **2.0 µs** with one. Used below for the catch-up sum (§14 risk 1).

Everything else in this file is **read from the code** (file + function named) — reasoned, not run.

## 1. Gap table

Size: S ≤ ½ day, M ≈ 1 day, L ≈ 2+ days of agent work. "§14" = GDD Performance Envelope.

### Shared machinery (brief S1 and the shared rules)

| # | Ruling (short) | Today (verified) | Missing | Where | Size | §14 / save risk |
|---|---|---|---|---|---|---|
| 1 | Speed-ups stack, at most **80 % off**, one number | `BoardRunner.tick` resolves `WORK_TIME` through `TileModifiers.resolveAxis` (tile + guild + hero scopes, percentages **sum**), floored only at an absolute `Math.max(1000, …)`. Proven (probe 2) | A relative floor: `max(base × (1 − MAX_CUT), resolved)` beside the 1 s engine floor (keep both: the catch-up relies on ≥ 1 s cycles, `loopConstants.MAX_TICK_DELTA_MS`). One helper used by every speed-up reader | new helper in `TileModifiers` (or `effects/speedFloor.js`), called from `BoardRunner.tick` and the new grow reader (#2) | S | none; same work for shipped content (only the Coast's −5 % exists) |
| 2 | Supports speed **times that are not work** (Forest regrow, Well field growth, Beehive fill, vein rest if ever) | `TimedChanges.HANDLERS.grows.dueMs` = `def.grows.afterMs`; `refill.dueMs` = `Respawn.restMsOf` ("the one reader of the time, so a future time axis … widens it here"). No modifier is read (probe 3) | A new palette axis **Grow Time** (`GROW_TIME`, percentage, inverted, narrowable by tag via the filter) read by `grows` and `refill` `dueMs`, floored by #1. ⚠️ Must be **cached per Token** (resolved when its aggregator is rebuilt, not per tick): see §14 risk 1 | `effects/constants.js`, `modifierPalette.js` (row = CMS control for free), `statementText` wording, `TimedChanges`/`Respawn.restMsOf`, `TileModifiers` cache | M | **§14 catch-up** if read live; save: none (clocks keep elapsed ms; a changed due time just moves the finish) |
| 3 | The floor number lives "in the CMS tuning" | **There is no CMS-authored engine tuning.** `data/` holds effects, items, maps, palettes, starterCamp, tokenRecipes, tokens. Engine numbers are code constants (`loopConstants.ELIXIR_FIGHTS = 10`); the CMS "tuning" store (`cms/src/stores/useGlobalStore.js`) is the economic simulator's, never synced to the game | Either a code constant beside `ELIXIR_FIGHTS` or a new synced data file + CMS page + loader | `loopConstants.js` (A) or `data/tuning.json` + Sync + CMS page (B) | S (A) / M (B) | **Owner question Q3** |
| 4 | Gathering, nothing ready in reach: **hero waits silently**, works the first Token that comes back | Resting Token → `WorkCheck.fixableReason` = `resting` → `Flags.keepOrRelease` lets go → `choose` finds nothing → state `idle` → `HeroBubbleLayer` says **"No work in range."** and the yellow idle mark is on (`isHeroIdle`). Proven (probe 4). Coming back is already fast: `TOKEN_RESPAWNED` and `TILE_CHANGED` mark flags dirty (`Flags.init`). A growing Sapling/Stump/Field has no `config`, so the flag never even records it | A "waiting for a node" reading: the flag's last pass skipped something that is **on its way back** (resting, growing or a Field growing) for a skill the hero holds and allows. Then: no idle bubble, status/dock line "Waiting for Copper Vein", and (Q2) no idle mark. ⚠️ **C5 builds the same shape for fights** (`Flags.waitingFor`, "Waiting for Goblin.", a `waiting` moment, `flagText.waitingTypeOf`, `dockStatusLine`): extend it, don't fork it | `Flags.evaluate`/`waitingFor`, `HeroBubbleLayer`, `heroSpeech`, `flagText`, `HeroDockTab`, `BoardRunner.isHeroIdle` | M | none; presentational except the idle mark. **Conflicts with C5's diff** in all five files |
| 5 | Station missing input: **stops, hero waits there, Token says "Needs Coal"** in the "Needs Pickaxe" look | Stops: yes (`BoardRunner.tick` `ALERT.INPUTS`, no partial cycles, progress kept). Says it: the **work plate** (brief 210 F2, T-239, `workPlate.workPlateOf`/`plateCells`) already shows the missing item icon with have/need while a hero stands there, and `TILE_EVENT_ALERT out_of_item` raises one notice. "Needs Pickaxe" is a different channel: `Flags.recordSkips` → `TOOL_NEEDED` → `CalloutLayer` speech-style callout, re-said every few seconds (`callouts.dueAgain`). Hero waits: **only while nothing else in reach can run** (`Flags.keepOrRelease`, FIXABLE branch; proven, probe 5) | (a) A "Needs Coal" callout over the station in the `CalloutLayer` look (an `INPUT_NEEDED` event from `BoardRunner` when the INPUTS alert starts, spaced like the tool callout). (b) Whether the hero stays even when other work could run: **Q1** (a lone hero who mines and smelts would deadlock under the literal reading) | `BoardRunner` (publish), `CalloutLayer`, `callouts.js`, `boardEvents`; `Flags.keepOrRelease` only if Q1 = B | S (a) + S/M (b) | none |
| 6 | **Trees, fruit trees and veins can't be dragged** | `FixedTokens.isFixed` is the single hook (fixture = map node or camp-laid; landmark; **planted** = spawned and in a `grows` chain). Read by `Placement.moveTokenTo` (refusal), `MatToken` (cursor, drag), `WorkPlateLayer`, the pushers. Map trees/veins and Forest-planted trees are **already fixed**. Not fixed: a *placed* or *spawned-by-a-Mine* vein, a placed tree (QA, old saves) | A type-level mark ("Stays where it stands"), `isFixed` reads it. Explicit checkbox rather than deriving from `respawn` (a Field or a Beehive may use refill/grow and should stay movable) | `FixedTokens.isFixed`, CMS Token editor or `LifecycleBlocks` | S | no drag code touched → no drag bench. Old saves: Mine-spawned veins become fixed in place (fine) |
| 7 | **Stations never wear out** | `Charges.planCycle` spends `recipe.stationChargeCost` (every shipped recipe = 1) from any Token with numeric `usesRemaining`. Furnace/Workbench/Cooking Pot are `uses: null` (never wear); **Grandma's Kitchen has 5000**, the Windmill 1000, the Copper Anvil 20 (context wear, `RecipeResolver.wearNearbySupport`) | Engine rule: a `Works as` Token is unlimited whatever its type or saved instance says; CMS hides Charges on a station (and the audit flags one). The anvil itself goes in S6 | `Charges.isUnlimited`/`planCycle`, CMS `TokenEditor` Charges field, `ContentAudit` | S | save: an old Grandma's Kitchen's 5000 is ignored (good). Bench: same work unless a bench board holds a charged station |
| 7b | (implied) **Supports don't wear** either | Buff Tokens wear one charge **per cycle they serve** (`RecipeResolver.wearNearbySupport`: `isBuff` serves anything that runs beside it). A Forest/Mine/Dock authored with charges would wear away | Content authored with unlimited charges + an audit warning, or the same engine rule as #7 for supports: **Q11** | `ContentAudit` (+ `wearNearbySupport` if B) | S | none |
| 8 | No working sprite: the progress dial is the look | Nothing draws a station "working" sprite (no such field anywhere); the work plate's fill is the dial | nothing | — | — | — |
| 9 | Support Tokens act within `nearby` (164 u) | `reachRegistry`/`nearby.js`; Provides default reach `nearby`. Brief 210 A3's 240 u is the **flag** radius (`Flags.flagRadius`), separate | nothing | — | — | — |
| 10 | Every new field gets its CMS control in the same phase | CMS editors exist for `grows`, `turns`, `respawn` (mode/into/afterMs), `spawner`, `foundation`, `needsTool`, Rules (palette-driven), recipes (incl. `durationMs`, `foundationKinds`, `foundationMinTier`). Recalculate strips only a short blacklist (`writeBack.RETIRED_TOKEN_FIELDS`), so new fields survive | per phase (listed below) | — | — | — |

### Forestry and Orchards (S2)

| # | Ruling | Today (verified) | Missing | Where | Size | §14 / save risk |
|---|---|---|---|---|---|---|
| 11 | Tree → **Stump** → Sapling → Tree, in place; Stump per species | `respawn: { mode: 'regrow', into }` (`Respawn.restInstead` → `TimedChanges.regrow` → `EffectActions.transformInstance`) keeps origin, fixture mark and biome; a `grows` chain back exists. **No content uses it** | Content (Oak Tree regrows into Oak Stump; Stump grows into Sapling) — the engine chain works today | S8 | — | 3 transforms per tree lap (today: leave + spawn + grow ≈ the same churn) |
| 12 | **Regrowth needs a Forest of the same species in reach**; none → Stump stays a Stump | Nothing gates a clock on neighbours. ⚠️ The `Requires` keyword ("Needs …", authored in the Rules editor, sentence exists) **has no runtime reader** (only `statementText`/`statementSlots`/`effectMigration`); `Acts as` tags are read by `RecipeResolver.contextTiersAround` (cached `neighbourIds`) | A gate on a timed clock: while unmet the clock does not advance (a true pause). Recommend making **`Requires` + `Acts as` live for timed changes** (Forest: Acts as `oak_forest`; Stump: Requires `oak_forest`), evaluated once per neighbourhood rebuild (cache on the Token's aggregator), not per tick | `TimedChanges.advance`/`HANDLERS`, `TileModifiers.rebuildToken` (cache), `statements` | M | cheap if cached; per-tick neighbour scans would cost (§14 risk 1) |
| 13 | **Every new Sapling costs one seedling** — a Forest's planting and a Stump's regrow; none → Stump **stopped** | Forest planting: `SpawnerSystem.attemptSpawn` upkeep (exists: Oak Forest pays 1 Oak Seedling, Bank then floor loot, paid only after landing). Stump regrow: `grows` has no cost | `grows.cost` (or `respawn.cost`): paid at fire through `InputAllocator`; short → held at due (the existing "nowhere to stand" hold) with a **"stopped: Needs Oak Seedling"** mark on the Token (spawner-style channel: `SPAWNER_ALERT_CHANGED`/`syncAlerts` pattern, no hero) | `TimedChanges` (fire + hold), new timed-alert sync, `LifecycleBlocks` Grows block (cost list), Token card lines | M | none |
| 14 | A Forest **plants within reach, up to its allowance**; no upkeep beyond the seedling; costs seeds to build | `SpawnerSystem`: **family cap is mat-wide** (sum of allowances of every live spawner sharing the family; every Oak Tree/Sapling on the mat counts, map trees included) and landing is `nearest_free` (nearest free spot, not limited to 164 u). Build cost: Foundation recipe inputs (exists) | Opt-in per spawner: count the family **within reach of this Forest** and land only within reach. ⚠️ Keep today's semantics for camps: **C5 builds bosses and guardians as camps-of-one on ordinary spawners** | `SpawnerSystem.attemptSpawn`/`countOf`/`spawnerStatus`, `EffectActions.spawn` (radius), CMS Spawner block checkbox | M | catch-up: one neighbour count per attempt (cheap). Save: an old Oak Forest's clocks carry over |
| 15 | Forests **speed their own species'** regrowth (Stumps and Saplings), stacking to the floor | Nothing (see #2) | Content: Forest `Provides Grow Time −X % to [tag oak]` — rides #1/#2 | S8 | — | — |
| 16 | **Wild Forests on maps, demolishable**; **clearing a stump is a demolish** | `Demolition.refusalOf` refuses **map nodes** (`MAP_NODE`) and **camp fixtures** (`CAMP`); a map's Forest and a map tree's Stump are both fixtures → cannot be demolished | A type-level "may be demolished even as a map node" (Forests, Stumps), CMS checkbox | `Demolition.refusalOf`/`canDemolish`, CMS | S | none |
| 17 | Trees can't be dragged | See #6 (planted and map trees already fixed) | — | — | — | — |
| 18 | **Orchards mirror Forests, fruit trees are picked**: Fruiting → picked empty → **Bare** rests → Fruiting (refill), needs an Orchard in reach; art Sapling/Fruiting/Bare | Refill exists (`Respawn` refill, greyed + countdown). Apple Orchard spawner + Apple Sapling → Apple Tree (3 charges, **leaves**) today | Refill gated by #12, sped by #2, and drawn with a **Bare sprite while resting** (#22's resting-sprite hook). Bare is the resting look of the Fruiting type, not a new type | content + #12 + #22 | S (after S2a + S3) | none |
| 19 | Logs per tree per species; woodaxe tier gating; rare finds as loud pops | `uses` per type; `needsTool` (exists); rare drops: `RareDrops.noteDrop` publishes `RARE_DROP` but the **twinkle is switched off** (`lootEffects.LOOT_RARE_TWINKLE = false`, owner's B2 choice) | Loud pops: see Q6 (shared with fishing) | — | — | — |

### Mining (S3)

| # | Ruling | Today (verified) | Missing | Where | Size | §14 / save risk |
|---|---|---|---|---|---|---|
| 20 | Veins **refill all at once** after a rest (Copper ~5 ore, ~1 min, per ore) | `Respawn` refill, CMS Respawns block (mode, rest time). Content: Copper Ore Vein has 5 charges, no respawn (leaves) | Content only | S8 | — | refill keeps the instance: **cheaper** than today's spawn/leave |
| 21 | **Mine: ~25 % double per Mine in reach, stacking, sure at four** | `OutputRules.doubleItemDrop` + the C2 `DOUBLE_DROP` row (flat %, item narrowing). **Proven working from a Token today** (probe 1) | Content only (one statement per Mine; "any item" would also double gems — Q13) | S8 | — | adds one `Math.random` per landed ore while a Mine is near (work change, expected) |
| 22 | **One shared empty-rock sprite** for a resting vein; inspect names the ore | `MatToken` draws `TokenSprite typeId` + `gi-token-resting` grey filter + `TimerBubble` countdown; nothing swaps art by state | A resting sprite on the respawn block (`respawn.restingSprite`, CMS sprite picker), drawn by `MatToken` while resting (no grey filter then); the card already names the type. Same hook serves Orchards' Bare (#18) and, extended, Fields (#28) | `Respawn` (getter), `MatToken`/`useTokenDetail`, CMS `LifecycleBlocks` Respawns block | M | drawn: `bench:draw --compare` once; no new elements |
| 23 | **Minecart shortens veins' work time** in reach, stacking to the floor | `WORK_TIME` Provides works today; the Copper Ore Minecart's **Restocks** rule does nothing at runtime (the keyword is read only by `tokenTypeDerivation` to call it a "manager"; GDD §7's "Minecart restocking ships" is stale) | Content + #1 | S8 | — | — |
| 24 | **Mines no longer spawn veins; veins come from maps only**, fixed | Copper/Coal Mine and Quarry are spawners; **the Starter Camp (`data/starterCamp.json`) holds only an Oak Forest and a Copper Mine** — its copper comes from the Mine's spawns | Content: Mines lose the spawner block; veins placed by maps and by the Starter Camp. ⚠️ **Until the Starter Camp carries fixture veins (brief 240 K0.1 + K1, or an S8 starterCamp entry), a new game has no copper** | S8 + 240 | — | save: old Mine-spawned veins stay, now refilling and fixed (#6) |
| 25 | Danger per map (ambushes on veins) | C5: a `Spawns` rule at ~2 % on the node's own cycle (`TriggerSystem`, `Flags.springAmbushes`) | nothing here | — | — | — |

### Farming (S4)

| # | Ruling | Today (verified) | Missing | Where | Size | §14 / save risk |
|---|---|---|---|---|---|---|
| 26 | **A Field is one Token that grows itself**: empty → growing → ripe → harvested and replanted | Wheat Field = spawner of Wheat Sprouts (grow 30 s into Ripe Wheat, 3 charges, leaves); Farmland is a Foundation whose Farming recipes build a Wheat Field / Apple Orchard | A Field state machine on one instance (stage + crop saved on the instance; a `TimedChanges` handler for growing; harvest = ordinary work while ripe; `WorkCheck` "growing" reason that feeds #4's silent wait) | new `board/Fields.js`, `TimedChanges`, `WorkCheck`, `BoardRunner.completeCycle` (last cycle) | L | **cheaper** than today's sprout spawner (no membership churn) |
| 27 | **Seed picked on the field** from a list like the recipe picker; **sticks** | Stations keep `selectedRecipeId` per instance (`StationRecipe`), the gear badge opens the picker; recipes are **level-gated** | How crops are authored: **Q4** (crops as Farming recipes on a Field station vs a crop list on the Token). Recipes reuse picker, stickiness, level gates, recipe change packs — but need S6a's per-station pools | `StationRecipe`, picker UI, `RecipeEditor` (grow time, load) | M | — |
| 28 | Art: shared empty and growing field, **ripe sprite per crop** | — | Sprite by state (extends #22's hook) | `MatToken` | S | drawn |
| 29 | **Ripe field holds a load** (e.g. 10 wheat over several cycles); **last cycle replants** paying one seed; none → stopped | Charges/`uses` exist; seed payment = #13's cost machinery | Load = charges set at ripening; last cycle pays the sticky crop's seed → growing, or "stopped: Needs Wheat Seed" (#13's mark) | `Fields.js`, `Charges` | M | — |
| 30 | Grow time 1–2 h per crop | Timed clocks are saved and caught up (`TimedChanges`, `CatchUp` 1 s steps) | nothing beyond #26 | — | — | catch-up: fine (closed-form clock) |
| 31 | Well/water faster | #2 | content | S8 | — | — |
| 32 | Composter **adds to the load** | `YIELD` (more crops per harvest cycle) exists; nothing changes a starting charge count | Routine call: Composter = Provides Yield to Fields (no engine), or a new "load" axis read at ripening | content (or `Fields.js`) | — / S | — |
| 33 | Beehive: chance of bonus crops or seeds; **fills slowly with honey and wax** a Farming hero collects (more with fields/flowers in reach) | Bonus: `BONUS_DROP` Grants or `DOUBLE_DROP` (exist; `effect_bonus_wheat` already exists). Fill: a gatherable Token with a slow refill + #2 speed-up from Fields | Q10 (refill all at once vs one charge at a time) | content (or `Respawn` trickle mode) | — / S | — |
| 34 | Windmill mills grain (a processing station) | Windmill today: a resource Token (Cooking cycle making flour, 1000 charges, +5 double loot to Fields) | A station with milling recipes: needs S6a's per-station pools | S6a + S8 | — | — |
| 35 | Herb Gardens work like Fields | — | Same as #26–#29 with its own crop list (or station kind) | S4 | — | — |
| 36 | Fields and Forests **built by Construction on a Foundation** (Forest's seed cost in the build) | Farmland is a Foundation with **farming** skill; build recipes carry inputs, `durationMs`, `foundationKinds`, `foundationMinTier` | Content (Farmland/Field recipes to Construction) | S8 | — | — |
| 37 | Today's Wheat Field spawner goes | — | Content; the old sprouts/ripe wheat finish and leave if their types are kept (if deleted they become inert "ghosts", `ContentAudit.reportSaveContent`) | S8 | — | save: keep the old types (or accept ghosts) |

### Fishing (S5)

| # | Ruling | Today (verified) | Missing | Where | Size | §14 / save risk |
|---|---|---|---|---|---|---|
| 38 | Water **never runs out**, **doesn't shift**; one sprite per water type (sea, river, lake) | Coast: 5000 charges, **no work cycle**, `turns` into Shrimp Coast 30 % every 60 s; the Shrimp Coast is the only fishable Token (1000 charges, rod) | Content: water Tokens with unlimited charges and their own cycle; Coast loses `turns`. Engine `turns` stays (dormant). A turned Shrimp Coast in an old save turns back on `TURN_DEFAULTS` (60 s, 30 %) even if the Coast loses its block (`turn_back` reads `turnedFrom`) | S8 | — | save: keep `token_coast` as the sea spot (old Coasts become fishable; their saved 5000 charges never run out in practice) |
| 39 | **Catch pools**: water × tool kind × bait → weighted pool; no bait → basic pool | Outputs are independent chances (`BoardRunner.completeCycle`); `weightedPick.pickWeighted` exists | A `fishing` block on the water Token (pools: tool kind, bait item or none, weighted catches) and a pick in `completeCycle` replacing the outputs; CMS editor for the block | `BoardRunner.completeCycle`/`OutputRules`, CMS `TokenEditor` | M | one pick per catch |
| 40 | **Tool kinds decide the pool** (rod, net, cage); **tiers don't gate** | `toolKinds.TOOL_KINDS` = pickaxe, woodaxe, fishing_rod, sickle; `needsTool` is **one** kind + min tier (`WorkCheck.heroReason`, `HeroTools.holdsToolFor`, "Needs Fishing Rod") | Net and Cage rows; a water accepts **any of** its pools' kinds (derive the need from the pools); "Needs Fishing Rod or Net"; which pool if a hero holds two (Q7) | `toolKinds`, `WorkCheck`, `HeroTools`, `flagText`, CMS | M | — |
| 41 | A better rod has its own bonus (e.g. more weight on the rare share) | Rods can carry Rules today: Yield, Double Item Chance on a named fish | Routine call: use existing rows now; a "rare weight" axis only if play asks | — | — | — |
| 42 | **Bait** carried in the consumable cells, **one per catch**, runs out → plain | Consumable cells are unlimited (`equipmentConstants`); Bank-backed (`slotBacked`) | At the catch: the first carried consumable a pool names with Bank stock → spend 1, use its pool. Small, fishing-specific; does not need S6b | `BoardRunner`/fishing pick, `InventoryManager` | S | defeat: bait sits in the consumable category, so it is exempt like elixirs |
| 43 | **Rare catches pop loudly** | `RARE_DROP` is published, but the **twinkle is off** (owner's B2) | Q6 | `CalloutLayer` (A) | S | — |
| 44 | **Dock in reach** makes fishing faster | `WORK_TIME` Provides (the Coast's −5 % is exactly this) | content + #1 | S8 | — | — |
| 45 | Bait is crafted (Raw Shrimp, worms from Farming) | recipes exist | content | S8 | — | — |

### Stations, work consumables, Construction (S6)

| # | Ruling | Today (verified) | Missing | Where | Size | §14 / save risk |
|---|---|---|---|---|---|---|
| 46 | **Furnace** (ore + coal → ingots) and a hero-worked **Smithy** (ingots → tools) replace the anvil | A station's pool is **every recipe of its skill** (`recipePoolRegistry.getSkillRecipePool`); the Furnace offers tool recipes too; the anvil gates only `recipe_muily2ph` (copper nails) by context tag. Foundations already narrow by `foundationKinds` | **Per-station recipe pools**: a station kind on the Works-as rule, station kinds on the recipe (mirror of `foundationKinds`), the picker and `StationRecipe.validateSelection` honour it. ⚠️ C5's Summoning Circle recipe sits in the **whole Alchemy pool** (C5 says so); the Alchemy Table would offer it without this | `recipePoolRegistry`, `StationRecipe`, picker, CMS `RecipeEditor` + Works-as slot | M | save: an old Furnace set to a tool recipe falls back to "Choose a recipe" (`validateSelection`) |
| 47 | **Better stations faster, same recipes** (Copper → Iron Smithy, Campfire → Kitchen), on a **new Foundation** | `Provides Work Time −X %` with reach `self` works today; Foundation tiers exist | content + #1 floor | S8 | — | — |
| 48 | Cooking: food stations (Campfire, Kitchen) and a drinks station (Brewery); **no fuel at the Campfire** | Campfire today is a Crafting resource making charcoal; cooking recipes spend charcoal | #46 pools + content | S6a + S8 | — | — |
| 49 | Crafting: Workbench only; Alchemy: one Alchemy Table | Workbench exists; no Alchemy station or recipes ship | content + #46 | S8 | — | — |
| 50 | **Work potions** spent only when a cycle of **their own skill** starts (Birdwatcher) | `BoardRunner.tick` already calls `LoadoutMoments.fire(id, heroId, 'CYCLE_START')` at each cycle start; carried rules pay from the Bank per firing (`HeroEffects.payLoadoutCost`). Missing: (a) a **skill on the moment** ("When a Forestry cycle starts"), (b) a **"for the cycle"** lifetime (C3 added "for the fight", C4 "for the swing", `LiveEffects.apply`), (c) a live effect's **Grants** never reach a cycle's bonus drops (`TileModifiers.loadoutPayloads` reads items only; `heroContributions` reads live effects for Provides only) | (a)+(b)+(c), each mirroring C3/C4 | `LoadoutMoments`, `triggerRegistry`, `statementSlots`/`statementText`, `LiveEffects`, `TileModifiers.loadoutPayloads` | M–L | catch-up: no new random draws unless a rule rolls; LoadoutMoments already runs per cycle start |
| 51 | **Drinks are work buffs for 10 work cycles** (like an elixir's 10 fights) | `ConsumptionSystem.startFightElixirs` + `hero.elixirFights` (saved) is the exact pattern. Today a drink **heals out of fights** (`tryEat` food then drink) and **any consumable's ambient `Provides` applies permanently while it has Bank stock** (`HeroEffects.loadoutStatements` → `heroContributions`): a "Coffee: −10 % work time" authored today would be a free, never-spent buff | A work-cycle dose counter (`hero.drinkCycles`, `DRINK_CYCLES = 10` beside `ELIXIR_FIGHTS`) drunk at cycle start; drink rules fire from the dose ("When a work cycle starts, applies Coffee for the cycle"); consumables' ambient rules gated on a dose (or refused by the CMS). Drink healing: Q9 | `ConsumptionSystem`, `LoadoutMoments`, `HeroEffects`, CMS audit | M | save: new hero field, absent reads 0 |
| 52 | Work potions and bait in the unlimited consumable cells | `equipmentConstants` consumable category unlimited (C3) | nothing | — | — | — |
| 53 | **Construction builds every support and station on a Foundation**, **build times per build** | Build time is already per recipe (`durationMs`, CMS Recipe editor; all are 30 s today). Shop sells Oak Forest, Coast, Copper/Coal Mine, Quarry, Farmland, Foundations, Copper Anvil, Goblin Camp | content (move supports from the Shop to build recipes; times 30 s / 1–2 min / minutes) | S8 | — | — |
| 54 | Materials paid at build start; short → Foundation says what's missing | Inputs paid when the cycle **completes** (`completeCycle`), checked before it starts (`WorkCheck` INPUTS); the work plate shows what's missing | The visible result matches; paid at completion, not start (a moved-away builder loses nothing). Routine; leave | — | — | — |
| 55 | Temporary Tokens (Guard Tower) stay | out of scope (combat) | — | — | — | — |

## 2. The specific checks, answered

- **Reach-scoped speed-up that stacks to a floor?** Half: `Provides Work Time −X % to [tag/id] nearby`
  stacks (percentages sum) and is reach-scoped (`TileModifiers.applicableStatements`), but the only
  floor is 1 s absolute (proven), and **nothing speeds a timed change** (growth, rest) at all
  (proven). Missing: the 80 % relative floor (#1) and a Grow Time axis (#2).
- **Bonus-drop / double-drop chance?** Yes, three kinds: `LOOT_MULT` (whole cycle doubles),
  `BONUS_DROP` via Grants (an extra different item), and C2's `DOUBLE_DROP` (one named item).
  **A Mine reuses `DOUBLE_DROP` with zero engine work**, narrowed to its ore, stacking 25 % each to
  a sure double at four (proven, probe 1).
- **Waiting silently / "Needs X" / the Needs Pickaxe bubble / the bubble row.** Today a gatherer
  with only resting nodes goes idle and says "No work in range." (proven). The Needs Pickaxe
  bubble is a `CalloutLayer` callout from `TOOL_NEEDED`, said over the Token the flag would have
  worked. The bubble row (T-239) is the **work plate**: for a hero on a starved station it
  already shows the missing item with have/need — so "the Token says what's missing" exists while
  a hero is there; the S1 additions are the spoken "Needs Coal" callout and the waiting rules.
  Silent waiting fits the plate naturally: a waiting hero works nothing, so no plate, no bubble;
  the dock/flag line says "Waiting for Copper Vein". C5 adds the same "waiting" shape for fights.
- **Fixed nodes hook?** Yes: `FixedTokens.isFixed` (fixtures, landmarks, planted). Map and planted
  trees and veins are already fixed. Only a type-level mark is missing (#6), and no drag code
  changes (so no drag bench).
- **Today's content and old saves**: see §5.

## 3. Proposed phases, order, pairs and tiers

Splits: **S1 in two** (S1a numbers and marks now; S1b waiting after C5 merges, since C5 rewrites
the same five files), **S2 in two** (S2a Forestry with the timed-change gate and cost; S2b
Orchards, small, once the resting-sprite hook exists), **S6 in two** (S6a stations and recipe
pools; S6b work consumables).

| Batch | Phase | Tier | Needs | Owns (files) |
|---|---|---|---|---|
| 1 | **S1a** Floor + Grow Time axis (cached) + fixed-node mark + stations never wear (+ supports per Q11) | engineer | Q3 | `TileModifiers`, `BoardRunner` (floor line), `TimedChanges`/`Respawn.restMsOf`, `modifierPalette`, `constants`, `statementText`, `FixedTokens`, `Charges`, `loopConstants`, CMS Token editor |
| 2 | **S1b** Silent waiting + "Needs Coal" callout + station wait rule | builder (engineer if Q1 = B) | C5 merged, S1a, Q1, Q2 | `Flags`, `HeroBubbleLayer`, `heroSpeech`, `flagText`, `HeroDockTab`, `CalloutLayer`, `callouts`, `BoardRunner` (one publish) |
| 2 ∥ | **S6a** Per-station recipe pools, Furnace/Smithy, anvil out, Campfire/Kitchen/Brewery shape, drinks' healing (Q9) | builder | S1a (never wear) | `recipePoolRegistry`, `StationRecipe`, recipe picker, `RecipeEditor`, Works-as slot, `ConsumptionSystem.tryEat` |
| 3 | **S2a** Forestry: `Requires`/`Acts as` gate on timed clocks, timed cost + "stopped" mark, Forest plants within reach (opt-in), demolishable map Forests/Stumps | engineer | S1a | `TimedChanges`, `SpawnerSystem`, `EffectActions.spawn`, `Demolition`, `TileModifiers` (gate cache), CMS `LifecycleBlocks` |
| 3 ∥ | **S5** Fishing: pools, net/cage, any-of tool need, bait per catch, rare-catch signal | engineer | S1a (Dock floor), S1b for waiting looks (not blocking) | `BoardRunner.completeCycle`/`OutputRules`, `toolKinds`, `WorkCheck.heroReason`, `HeroTools`, `flagText` (needs text), CMS `TokenEditor`, `CalloutLayer` |
| 4 | **S3** Mining: resting-sprite hook, empty rock, card line; content shape for Mines/Minecarts | builder | S1a | `Respawn` (sprite getter), `MatToken`, `useTokenDetail`, `tokenCard`, CMS Respawns block |
| 4 ∥ | **S6b** Work consumables: moment skill, "for the cycle", live-effect Grants, drink doses (10 cycles), potions | engineer | S6a | `LoadoutMoments`, `LiveEffects`, `ConsumptionSystem`, `HeroEffects`, `TileModifiers.loadoutPayloads`, `triggerRegistry`, `statementSlots`/`statementText`, CMS Item editor |
| 5 | **S4** Farming: Field and Herb Garden state machine, crop pick (Q4), load, replant cost, stage sprites | engineer | S2a (cost/stopped), S3 (sprite hook), S6a (if Q4 = A) | new `Fields.js`, `TimedChanges` (one row), `WorkCheck`, `BoardRunner` (last cycle), `MatToken` (state sprite), CMS |
| 5 ∥ | **S2b** Orchards: refill gate + Bare resting sprite, Orchard planting | builder | S2a, S3 | mostly content shape + small `Respawn` wiring |
| 6 | **S7** Seeing support effects (today: Near ring on hover/drag via `reachDisplay.showsNearRing`, rules text on the card; no per-effect highlight, no "boosted by" list) | builder | S2–S6 | mat highlight layer, `tokenCard` |
| 6 ∥ | **S8** Content pack (drafting can start in batch 4) | builder writes, director checks | S2–S6, 240 K0.1 | `cms/incoming/` |
| 7 | **S9** Play-through, eye-check (can split gathering/stations) | director | all | — |

Parallel pairs chosen so no two agents own the same file. Known shared touches: `BoardRunner`
(S1b one publish line vs S6a none; S5 `completeCycle` vs S6b none in batch 4) and the CMS
`TokenEditor` (S1a checkbox vs C5's 29-line edit: small merge). The Systems director also runs
combat (C5 rework, C0, C6): with two code agents per director, **batch 1 is S1a beside C5**.

Each phase should ship a **QA panel section** (like C5's `EncountersDevSection`) so the S9
eye-check is reachable by clicking (owner ruling 2026-10-13).

Bench expectations: engine phases built **opt-in** (new fields, new axes) give **same work** on
today's content; S1a stays same work unless a bench board holds a charged station (Grandma's
Kitchen). WORK CHANGED lands with S8's content, where the brief accepts it. `bench:draw --compare`
for S3/S4 (state sprites) and S7; drag bench not needed (no drag code).

## 4. GDD §14 risks

1. **Catch-up time (the big one).** If Grow Time (#2), the Forest gate (#12) or the floor are
   resolved live inside `TimedChanges` `dueMs` (called per timed Token per 1 s step), a 24 h
   catch-up pays it 86,400 times per Token. Measured ≈ 1.2–2.0 µs per `resolveAxis`; with ~60
   growing/resting Tokens that is ≈ 6–10 s on top of today's 19 s (limit 30 s). **Cache the
   resolved factor and the gate per Token when its aggregator is rebuilt** (`TileModifiers`
   already rebuilds on every neighbourhood change; `ModifierAggregator.cache` exists and is unused).
   Then the cost is ~0. (Reasoned from the micro-timing; the bench's catch-up scenario must confirm.)
2. **Token count.** Felled trees no longer leave; Stumps, Forests, Mines, Minecarts, Docks, Wells
   and Beehives all stand on the mat and count toward 128. A content risk for S8/240 (map budgets
   ≤ 64 nodes), not an engine one.
3. **Membership churn.** Tree → Stump → Sapling → Tree is three transforms a lap (each drops the
   neighbour cache, source index and census). Today's leave + spawn + grow is about the same; veins
   (refill in place) and Fields (one instance) are cheaper than today. Low risk.
4. **Drawing.** State sprites (S3 resting rock, S4 field stages, S2b Bare) swap an image on an
   existing element; callouts ("Needs Coal", rare catch) reuse `CalloutLayer`. `bench:draw` once each.
5. **Per-cycle work.** Fishing pools, bait, doses and potions add a handful of reads per cycle
   start/complete; `LoadoutMoments.fire` already runs at every cycle start. Low risk.

## 5. Save compatibility

Saves of the same version (0.8.1) load with new content; the version policy refuses only other
versions (`SaveMigration.migrateState`). An instance of a deleted type stays in the save as an
inert ghost (`ContentAudit.reportSaveContent`: "Nothing has been removed"). So:

- **Keep ids** and repurpose: `token_oak_tree` (gains regrow into a new Stump), `token_oak_sapling`,
  `token_apple_tree` (becomes the Fruiting tree, refill), `token_copper_ore_vein` (refill),
  `token_coast` (the sea spot), `token_wheat_field` (the new Field, if the generic Field takes it).
- **Oak Trees**: load fine; when felled with no Forest in reach they become Stumps that wait
  (the designed loop: build a Forest, seedlings drop from felling). Q12.
- **Apple Trees**: fine (refill, needs an Orchard: an old Orchard is a spawner Token that keeps
  its id).
- **Oak Forest**: clocks carry over; only its cap/landing change (opt-in in S8).
- **Copper/Coal Mine, Quarry**: lose their spawner block; their veins stay, refill, become fixed.
- **Wheat Field**: an old instance becomes an empty Field with no crop picked ("Choose a seed");
  old Sprouts/Ripe Wheat finish and leave if their types are kept — **S8 should keep them** (or
  the director accepts ghosts).
- **Shrimp Coast**: turns back into a Coast on `TURN_DEFAULTS` (even if its type is deleted).
- **Copper Anvil**: keep the type (demolishable) or accept ghosts; recipes stop needing it.
- **Stations with charges** (Grandma's Kitchen 5000): never wear after S1a.
- **Station selections**: a Furnace set to a tool recipe falls back to "Choose a recipe" after S6a.
- **Heroes**: new `drinkCycles` (and any dose map) read 0 when absent; `elixirFights` unchanged.
- **New games**: ⚠️ with Mines no longer spawning, **the Starter Camp has no copper** until it
  carries fixture veins (240 K0.1 lets a pack carry the Starter Camp; K1 places veins). S8 must not
  remove the Mine spawner block before the camp has veins.

## 6. Overlaps

- **C3 (merged)**: elixir doses (`startFightElixirs`, `hero.elixirFights`, `LoadoutMoments`
  fight-start path, "used" bubble) are the template for drinks (10 work cycles) and work potions
  (1 cycle, own skill): same "drink when the dose is out, fire rules from the dose" rule on
  `CYCLE_START` instead of `COMBAT_ENGAGED`, plus "for the cycle" beside "for the fight".
  The "used" bubble shows a drink as it is drunk (works as is).
- **C4 (merged)**: the 3 s Rules tick (`STATUS_TICK_INTERVAL_MS`) is not needed by any loop;
  "for the swing" shows how a new lifetime is added. Nothing conflicts.
- **C5 (rework, `systems/combat-encounters`)**: (1) **Flags/flagText/HeroBubbleLayer/heroSpeech/
  HeroDockTab**: C5's "Waiting for Goblin" is the pattern S1b extends: S1b after C5 merges.
  (2) Bosses and guardians are **camps-of-one on ordinary spawners**: S2a's Forest cap change must
  be opt-in. (3) The **Summoning Circle recipe sits in the whole Alchemy pool**: S6a's per-station
  pools fix it; tell the C5/C0 author to give it a station kind once S6a lands. (4) Node ambushes
  ride on finished cycles: unaffected by refill/regrow. (5) `TokenEditor.jsx` small merge.
- **Brief 240**: packs follow whichever lands first. Coordinate: Starter Camp veins (above);
  240 K2's Iron Anvil → Iron Smithy; map trees need wild Forests (and #16 to demolish them);
  K1's "wheat patch" (Q5); K2's grapevines (fruit tree or crop) and Lavender (wild node or Herb
  Garden crop); K3's "Bountiful" density modifier counts fields/fruit as nodes.

## 7. Owner questions (multiple choice, recommendation first)

**Q1. A station runs out of an input while a hero works it. Does the hero stay?**
- **A (recommended):** they stay and the station says "Needs Coal", **unless** something else in
  their flag can run, then they work that and come back when the input arrives (today's rule, now
  also said out loud). A hero who both mines and smelts never gets stuck.
- B: they stay until the input arrives or you move them (the ruling read literally). A lone hero
  whose own mining feeds their furnace would wait forever.

**Q2. A gatherer waits for a vein to refill (or a tree to regrow). What shows?**
- **A (recommended):** no bubble; the flag and dock say "Waiting for Copper Vein"; no yellow "idle"
  mark (they are doing their job).
- B: no bubble, but the yellow idle mark stays, so the hero bar still flags them.

**Q3. Where does the "at most 80 % off" number live?**
- **A (recommended):** one number in the game's settings code beside the "10 fights" elixir
  number; you ask to change it. A ticket for a CMS "game numbers" page later.
- B: a new "Game numbers" page in the CMS, synced into the game with your content (a bigger piece
  of work in this brief).

**Q4. How are a Field's seeds written in the CMS?**
- **A (recommended):** each crop is a **Farming recipe** (seed in, crops out per harvest, plus grow
  time and load). The Field's seed list is the recipe picker you already know, crops unlock by
  Farming level, and change packs carry them. Needs the per-station recipe lists from S6a first.
- B: a crop list typed on the Field Token itself (its own new editor block).

**Q5. A map's wheat patch (brief 240's Starter Camp) is…**
- **A (recommended):** a wild crop node that refills like a berry bush; Fields are only built by
  the player.
- B: a ready-planted Field with wheat already picked, which the player may re-seed.

**Q6. "Rare catches pop loudly" — the loot twinkle is switched off (your 2026-10-23 choice). How?**
- **A (recommended):** a callout over the water naming the catch ("Dolphin!"), the "Needs Pickaxe"
  look.
- B: turn the twinkle back on for rare catches only.
- C: the hero says it in a speech bubble.

**Q7. A hero holds a rod and a net and fishes. Which pool?**
- **A (recommended):** the tool in the first hand.
- B: the one whose pool matches the bait they carry, else the first hand.

**Q8. A Forest is demolished while a Sapling near it is growing.**
- **A (recommended):** the Sapling finishes; only a Stump needs a Forest to start regrowing.
- B: the Sapling pauses too until a Forest is back.

**Q9. Drinks become work buffs. Do they still heal out of fights?**
- **A (recommended):** no: drinks only buff (food heals). Matches both concepts.
- B: yes, they heal out of fights as today and also buff.

**Q10. The Beehive "fills slowly".**
- **A (recommended):** it rests empty and refills all at once (the vein's way, already built),
  faster with fields or flowers near.
- B: it fills one honey at a time.

**Q11. Do support buildings (Forest, Mine, Dock, Well…) wear out?**
- **A (recommended):** never, like stations.
- B: they wear a little per cycle they help, as today's buff Tokens do.

**Q12. Old saves: felled Oaks with no Forest near become Stumps that wait.**
- **A (recommended):** accept it: build an Oak Forest nearby (seedlings drop from felling).
- B: on load, place one wild Oak Forest beside each old grove (a one-off repair).

**Q13. Does a Mine double every drop of its veins, gems included?**
- **A (recommended):** only the ore (gems stay rare).
- B: everything the vein drops.


## 8. Routine calls the director can make (not owner questions)

- Composter "adds to the load" = **Provides Yield** to Fields (no engine).
- Rod tier bonuses use existing rows (Yield, Double Item Chance on a named fish) until play asks
  for a "rare weight" row.
- A Stump or Field stopped for want of seed shows a spawner-style mark ("Needs Oak Seedling");
  a hero by it with nothing else is idle in the normal way (nothing is on its way back).
- A Forest's allowance counts trees in its reach, map trees included.
- Picking a Field's seed plants it at once if the Bank has one (no hero).
- Materials for a build are checked before and paid at the end, as today.

## 9. Doc notes for the planning agent (not owner questions)

- concept_skill_loops: the 2026-10-24 Forestry bullet "Forests stack fully … about a quarter"
  sits **below** the "Standard floor" paragraph that says it replaces "the 'about a quarter'
  Forest floor **above**". The brief uses 80 %; the doc should drop the quarter bullet.
- GDD §7 "What ships: … Minecart restocking": the `Restocks` keyword has no runtime reader (only
  `tokenTypeDerivation` reads it, to call the Token a manager). Likewise `Requires` is latent.
- GDD §3 Foundations "(30 s, level 1)": build time is per recipe already (`durationMs`).
- GDD §8 tutorial step list is the old one (now `cart_*` steps in `tutorialQuests.js`).
- Brief 230 "What already exists": Spawners' cap is **mat-wide** per family, not per Forest.
