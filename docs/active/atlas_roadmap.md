# Atlas roadmap (brief 70)

*Phase A0, written 2026-10-09 by the engineer tier from a read-only pass over
`main` at `e0ae30b8` (briefs 10–40 merged) and the parked branch `atlas-wip`
(`aecd7bda`). Source of truth: [`concept_atlas.md`](concept_atlas.md) (its
"Owner decisions, 2026-10-07" first), amended by
[`concept_progression.md`](concept_progression.md),
[`concept_skill_loops.md`](concept_skill_loops.md) and
[`concept_quests_tutorial.md`](concept_quests_tutorial.md). Brief:
[`briefs/70_atlas.md`](briefs/70_atlas.md).*

**How to read the evidence tags.** **[code]** = read in the code at the file and
line given. **[data]** = read from `data/*.json` with a throwaway script.
**[doc]** = read in a doc. **[reasoned]** = my inference, not checked by running
anything. **Nothing here was measured**: no bench, no test run, no game run (the
brief said read-only, and other agents hold the bench). Every "bench work
unchanged" below is a prediction the slice must prove with
`npm run bench -- --compare`.

Also read for this pass: `concept_combat.md` (enemy camps, lures, ambushes,
guardians, "maps drop steadily"), `concept_guild_hall.md` (The Compass:
Token cap and Cartography slots as Hall upgrades; the camera move onto the
cartographer's map table), `concept_knowledge.md` (map items show what they
write), `concept_living_game.md` (Region happenings follow the map: later),
`concept_tone_and_world.md` (storybook Region names; maps write worlds; why
Regions freeze), `concept_release.md` (saves become files before outside
players; first playtest after the Starter Camp and first loops).

---

## A. What the docs say versus the code

Each row: where a concept, brief or ticket is wrong or stale against `main`.

| # | The doc says | The code says | Evidence |
|---|---|---|---|
| A-1 | Brief 70: "**Uncommitted** Atlas work sits in the owner's folder … `StateSchema.js` … `data/items/maps.json`". | Stale. The main checkout is clean; T-005/T-006 parked it on branch `atlas-wip` (2026-10-07): `6f104f61` adds `atlas: { activeRegionId, regions }` to `INITIAL_STATE` and `'atlas'` to `REQUIRED_KEYS`, plus two edited map pictures (`map_frozenpeak.png`, `map_volcano.png`); `aecd7bda` adds `data/items/maps.json` (2 base maps, 2 modifiers). | [code] `git diff main...atlas-wip`; `docs/archive/tickets_done.md:16-17` |
| A-2 | (implicit) the parked `data/items/maps.json` is Atlas content. | It sits **outside the CMS's sight but inside the game's**: the game loads every `data/items/**/*.json` (`DatabaseManager.js:14`, `itemRegistry.js:58-68`), while the CMS syncs only `data/items.json` (`cms/src/engine/fileUtils.js:48`, `TopBar.jsx:30`). Its sprites `d_map_forest`, `d_map_mountain`, `d_mod_hardwood`, `d_mod_ruins` exist nowhere in `sprite-manifest.js`; its types `map` / `map_modifier` are not in `ITEM_TYPES` (`itemRegistry.js:25-36`). Merging it would add four items with missing art that the owner can't edit. | [code] |
| A-3 | `tickets_done.md`: "T-002 — All Maps and Map Tokens deleted". | One Map Token remains: `token_volcanic_island` (`mapId: map_volcanic_island`) while `data/maps.json` is `{}`. GDD §3 is right about it. The boot audit already reports the dangling `mapId` (`ContentAudit.js:122`). | [data] [code] |
| A-4 | concept_atlas, top: "The opening mat (Hall, Oak Forest, Copper Mine **bought from the Shop**)". | The three are **placed** by `EngineBootstrap.openingMat()` on a new game (`EngineBootstrap.js:64-72`, `:270-274`); the Bank opens with 3 Oak Seed, 10 Oak Wood, 2 Wheat Seed (`:82-86`). Nothing is bought. | [code] |
| A-5 | Owner decision: "**Everything** on the mat counts" toward the Token cap. | Today the cap counts everything **except the Guild Hall and quest Tokens**, and counts binned Tokens (`MatCap.js:28-31`, `:41-52`). And **rule-fired spawns ignore the cap**: `EffectActions.spawn` (`EffectActions.js:266-306`) never asks `MatCap`; only the Spawner System (`SpawnerSystem.js:234`), the Shop (`Shop.js:85`) and recipes that make Tokens (`Placement.js:318`) do. An ambush rule today could push the mat past the cap. | [code] |
| A-6 | concept_atlas §3.5: "Organic node respawns are **already handled** to find a clear space." | Nothing respawns today. A Token at 0 charges is removed (`Charges.js:192-195` → `destroyToken`, `:125-153`); a context or buff Token worn out by service is removed too (`BoardRunner.js:384-391`). Spawners land **new** Tokens at the nearest free spot and may push spawned ones (`SpawnerSystem.js:240-244`). Respawning **in place** (the owner's decision) needs no free spot at all, because the Token never leaves. | [code] |
| A-7 | Owner decision: ambushes are "the effect grammar's **spawns**". | `Spawns` exists but can't express an ambush yet: (1) **no chance**: its payload is `{ typeId, placement }` (`statements.js:376-377`, slots `statementSlots.js:226-240`), so a rule on "cycle complete" (its default moment, `statements.js:409-415`) fires **every** cycle; (2) a firing costs the bearer **one charge** by default (`DEFAULT_STATEMENT_CHARGE_DELTA`, re-exported at `Charges.js:34-42`); (3) the spawned enemy gets **no tether** (only the Spawner System sets one, `SpawnerSystem.js:259`), so it stands still (`EnemyMotion.js:28`) and a hostile one watches around itself (`Hostiles.js:44-47`); (4) the cap gap in A-5. | [code] |
| A-8 | Brief piece 2: "the Spawner System **narrowed** to enemies and lures". | Amended by D4 (growing places keep spawning). In code there is nothing to narrow: the Spawner System is content-driven, and "forests and mines stop being Shop purchases" is the owner removing `shop` blocks in the CMS (`Shop.js:19-30` sells any Token with a `shop` block). The engine keeps the whole Spawner System. | [code] [doc] |
| A-9 | Owner decision: "The Shop sells buildings and **tools** only (Foundations, anvils, tools, lures)". | The Shop sells **no tool Token today**: the only context Token with a `shop` block is the Copper Anvil; pickaxes and woodaxes come from Smithing recipes (`recipe_copper_pickaxe`, `recipe_mtozw3la`). The Shop sells Tokens only, never items (`Shop.js:134-159`). Once tools are hero gear (T-126), "tools" in that sentence means nothing unless the Shop learns to sell items. Today's Shop: Oak Forest, Coast, Copper Mine, Coal Mine, Quarry, Farmland, Wood and Stone Foundation, Copper Anvil, Goblin Camp. | [data] [code] |
| A-10 | Brief piece 3: demolition "replaces the bin". | The bin does two more jobs that need a home: it is **how a bounty is dismissed** (`QuestTokens.js:48-58`), and `bench:drag` exercises **binning and unbinning** as drag kinds (`bench/browser/dragKit.mjs:338-415`; brief 50's branch is editing that file now). | [code] |
| A-11 | concept_skill_loops (Mining): "**today's** Copper Ore Minecart restocks a vein". | The Minecart's `Restocks` rule is **inert**: Managers were retired and nothing in the engine acts on `restocks` (`tokenTypeDerivation.js:10-12`; no reader in `src/systems`). The Minecart does nothing today. | [code] |
| A-12 | concept_skill_loops (Forestry): groves via "increase growth speed for Oak Saplings". | There is **no axis for growth or respawn time**: `grows.afterMs` is read directly (`TimedChanges.js:187-194`), outside `TileModifiers`. Groves and minecarts need a new time axis; that's skill-loop prototyping after the Atlas, but the respawn clock should be read through one function so the axis can be added later. | [code] [reasoned] |
| A-13 | concept_quests_tutorial: today's tutorial teaches "**buy an Oak Forest** from the Shop". | It never buys an Oak Forest (it's on the opening mat): the 11 steps are recruit, flag, log 3 Oak Trees, collect 10 loot, open the Bank, buy anything (suggests a Quarry), buy a Wood Foundation, build a Workbench, craft Charcoal, plant Farmland, harvest Wheat (`tutorialQuests.js:25-120`). The conclusion (rewrite after brief 70) stands. | [code] |
| A-14 | GDD §1: "set up a Region, **exhaust it**, move the guild to a better one". | concept_progression (newer): "Old Regions never wear out"; going back to specialised Regions is intended play. GDD §1 needs the new wording when the Atlas lands. | [doc] |
| A-15 | Brief 70's reading list: GDD §10 covers "Regions frozen while away". | GDD §10 (lines 453-466) predates the Atlas and says nothing about Regions; the rule lives only in concept_atlas's owner table. Nothing in the catch-up needs to change for it (see B, catch-up). | [doc] [code] |
| A-16 | concept_progression ⚠️: 25 endgame sites vs **the Token cap**. | Also vs **room**: the mat is 11 × ~7 steps of 160 u (1760 × 1126 u, `matGeometry.js:19-55`, `matTuning.js:112-117`); a size-1 Token is 128 u across. 25 full-size sites take about a third of the mat's ~77 step-cells before any tutorial node or building. | [code] [reasoned] |
| A-17 | Brief 70 lists "gathering tools become hero gear (T-126)" among what the Atlas takes on. | TICKETS calls T-126 "a design-to-code job for the **post-crunch** build" (`TICKETS.md:53`). Scope conflict: owner question D-11. | [doc] |
| A-18 | Skill-less Tokens as treasures ("ruins and caches", concept_progression). | A flag **skips** a worked Token that names no skill (`Flags.js:447`, `SKIP.NO_SKILL`), so treasures must name a skill or no hero will ever open them. (Same today for the berry bushes, `skill: ''`: unfinished content, not a bug.) | [code] [data] |
| A-19 | T-024, T-025 (open): `map_burst` / `map_opened` double count; `buyMap` ignores `sourceRect`. | Stale: neither publisher nor `buyMap` exists any more (only a comment at `QuestManager.js:183`). Both can close. | [code] |
| A-20 | Director's brief for A0 names `ShopPanel.jsx`. | The file is `src/ui/components/drawer/ShopDrawer.jsx` (its test is `ShopPanel.test.js`). | [code] |
| A-21 | `GuildModifiers.js:4-6`: "nothing registers into it yet outside tests". | True: only `TileModifiers.js:765` reads the guild-wide aggregator. It is the ready-made home for Region-wide modifier rules (A4). | [code] |

Things the concept gets **right** that the roadmap leans on [code]:
- Every Token clock advances only by the tick's `delta` and never reads the wall
  clock (`TimedChanges.js:36-43`), so a frozen Region resumes exactly where it
  stopped, with no catch-up of its own.
- Board runtime caches are already keyed **per board object**
  (`BoardState.js:119-166` layout and membership versions, `:424` per-board
  runtime that `Flags` uses, `EnemyMotion.js:78`, `Hostiles.js:40`), so
  swapping `state.board` behaves like a load.
- Lure upkeep exists (`SpawnerSystem.js:194-214`, upkeep paid only after a spawn
  lands); enemies never attack Tokens; Foundations already process from the Bank
  wherever the inputs came from (`InputAllocator`).

---

## B. Inventory: every subsystem the Atlas touches

| Subsystem | Today | Becomes | Slice |
|---|---|---|---|
| **Save** (`StateSchema.js`, `SaveMigration.js`, `GameState.js`) | One `board`; `GAME_VERSION '0.8.0'`; `migrateState` backfills two levels deep, refuses other versions (`SaveMigration.js:23-60`). | `state.board` **stays the active Region's live board** (so no engine reader changes) and a new `state.atlas` holds `{ activeRegionId, regions: { id: { id, kind, practicalName, flavourName, ingredients, seed, biome, rules, settledAt, archived, board } } }`, the active Region's `board` field null. Frozen boards are stored whole, minus the Hall and quest Tokens (they travel) and floor loot (banked on leaving). Version per D-5. | A1 |
| **Travel / freezing** (new `src/systems/atlas/`) | — | `Atlas.travel(id)`: stop work, bank floor loot, lift the Hall instance and quest Tokens, store the board, install the other, put the Hall at the centre and the quests beside it, flags per D-8, then publish one "board swapped" event that the load-time handlers also hear (`BoardRunner` rebuild + `Restrictions.reconcile`, `BoardCombat.clearAll`, `Flags.reset`/`restoreWork`, `QuestManager.ensureQuests`, `SpawnerSystem.resetAlerts`), plus `GAME_RESET { reason: 'travel' }` for the UI, then save. | A1 |
| **Catch-up** (`CatchUp.js`) | Plays the tick handlers over `state.board` only. | Unchanged: frozen Regions aren't in `state.board`, so "only the active Region runs" holds by construction. The away summary's `floor` reads the active board (`CatchUp.js:~145`): fine. "Tokens used up" must not count respawning nodes (A2). | A1, A2 |
| **Charges and depletion** (`Charges.js`, `RecipeResolver.wearNearbySupport`, `WorkCheck.js`, `BoardRunner.js`, `TimedChanges.js`) | 0 charges → removed, `TOKEN_DEPLETED`. | A Token type with a `respawn` block (`{ mode: 'refill' \| 'regrow', afterMs, into? }`, authored in the CMS) **rests** instead: refill = stays, unworkable, a `respawn` clock (a new row in `TimedChanges.HANDLERS`) refills it; regrow = transforms into `into` (an Oak Tree becomes an Oak Sapling, which already grows back). New events (resting, respawned), never `TOKEN_DEPLETED`. A type without the block behaves exactly as today. | A2 |
| **Spawners** (`SpawnerSystem.js`) | Content-driven; family caps count the bin. | Unchanged engine; bin counting goes with the bin. Growing places (Forest, Farmland fields, orchards) and enemy camps and lures keep spawning; mines become map veins (content). | A3b, content |
| **Bin** (`DiscardBin.js`, `DiscardBinPanel.jsx`, `PopOutSidebars.jsx`, `dropOnMat.js`, `MatCapBadge.jsx`, `ShopDrawer.jsx`, `BoardState` bin storage, `MatCap`, `SpawnerSystem` census) | 9 places, refunds. | **Removed.** Replaced by demolition: mark a Token, a hero with Construction removes it, no refund. Bounties get a "Dismiss" on the quest Token. | A3a, A3b |
| **Work choice** (`StationRecipe.workConfigOf`, `Flags.js`) | `workConfigOf(def, instance)`, but `Flags` calls it **without the instance** in four places (`Flags.js:195, 209, 247, 541`), as does `heroBubbles.js:89,109`. | A marked-for-demolition Token's work becomes "Construction, level 1, a fixed time" through `workConfigOf(def, instance)`, so every caller must pass the instance. | A3a |
| **Shop** (`Shop.js`, `ShopDrawer.jsx`) | Sells any Token with a `shop` block. | Engine unchanged. The owner removes resource places from the Shop in the CMS (after A6/A7, see E). A content-audit warning names a respawning fixture or map node still sold at the Shop. | A5 (audit), content |
| **Token cap** (`MatCap.js`, `guildUpgrades.js`) | 80, dev override; counts bin; excludes Hall and quests. | Counts the active Region only; excludes only the Hall and quests (landmarks count, D-1 amended 2026-10-09) (endgame sites, per D-1); rule-fired spawns respect it (A9); a Hall upgrade raises it (D-9). | A3b, A6, A7, A9 |
| **Maps** (`mapRegistry.js`, `ContentAudit.js` map branch, `DatabaseManager.mapFilesSingle`, `tokenTypeDerivation.js:69`, CMS `MapEditor.jsx` / `mapPass.js` / `simRunner.js`) | Idle (T-110); one inert Map Token. | Per D-4: maps and modifiers are **items** with a Cartography block; the old map code retires (T-110), the Volcanic Island Token is deleted in the CMS. | A5 |
| **Generation** (new `src/systems/atlas/Budget.js`, `Layout.js`) | — | Ingredients → node budget (a pure function) → seeded layout within (cap − building reserve) around a clear centre for the Hall; reroll = new seed only; settle consumes the ingredients and creates the Region; Region rules register in the guild-wide aggregator while active; the Region keeps its biome weights for brief 80. | A4 |
| **Cartography and Atlas UI** (new `src/ui/components/atlas/`, `BubbleMenu.jsx`, `ReactRoot.jsx`) | 4 bubbles (`BubbleMenu.jsx:99-113`). | An Atlas bubble; the Cartography table (inventory, 2→8 slots, node summary, preview, reroll, cancel, settle) and the Region list (travel, rename, archive, abandon). | A6 |
| **Starter Camp / new game** (`EngineBootstrap.js`, content) | Hall + Oak Forest + Copper Mine, opening items in code (T-014). | A hand-made Starter Camp Region (layout per D-2) with the 25 endgame sites (per D-1) and the ritual site; can't be abandoned. | A7 |
| **Tutorial** (`tutorialQuests.js`, `QuestManager.js`, `QuestTokens.js`) | 11 pre-Atlas steps in code. | The cartographer's chain, one at a time, ending in the first maps, the first settled Region and the first move; new quest events `token_inspected`, `region_settled`, `region_travelled`. | A8 |
| **Ambush** (`statements.js`, `statementSlots.js`, `statementText.js`, `TriggerSystem.js`, `EffectActions.js`, CMS `Statements.jsx`) | See A-7. | `Spawns` gains a chance; a miss costs nothing; rule-fired spawns wait at the cap; an ambusher is tethered to the node it came from. | A9 |
| **Movable vs fixed** (`Placement.isPermanentToken`, `MatToken.jsx`, `DndKit.jsx`, `EffectActions.spawnPoint`) | Everything drags; only the Hall can't leave the mat (`Placement.js:82-86`). | Fixed Tokens per D-6 don't drag and are never pushed; movable ones show a faint marker at rest and lift on hover. | A10 |
| **Tier wording** (`StationRecipeModal.jsx:28,37`, `statementText.js:549,557` "a Tier 2 …") | Player-facing "tier N", "Foundation tier N or higher". | Names instead ("a Stone Foundation or better"). The CMS keeps its tier numbers. | A11 |
| **CMS** | Lifecycle blocks: spawner, grows, turns, foundation, shop, trickle (`useEntityStore.js:485`). | A Respawns block (A2); `chance` on Spawns (A9); a Landmark flag (A7); the Item editor's Cartography section (A5); Starter Camp page (D-2); map items exempt from the economic simulator's value passes (A5). Verify only on a throwaway route (TESTING, "The CMS"). | A2, A5, A7, A9 |
| **Bench and fixtures** (`bench/fixtures.mjs`, `bench/lib/fingerprint.mjs`, `dragKit.mjs`) | Fingerprint hashes the active board, Bank, heroes, loot, bin and random draws (`fingerprint.mjs:105-131`); scenarios build boards from fixtures, never from the opening (`harness.mjs:90-91`). | Engine bench work unchanged by design (every new behaviour is opt-in content or off the tick). `bench:drag` loses its bin kinds (A3b). Optional later: an S9 "travel" scenario timing a board swap. | A3b, E |
| **Tests** | ~300 files; content-pinning suites read `data/` (`ForestryChain`, `MiningChain`, `FarmingChain`, `NewGameOpening`, `ContentRules`, `QuestTutorialChain`, `MapBurstRetired`, `EconSimMaps`). | New engine suites per slice (names in C). The content-pinning suites are rewritten **when the owner syncs Atlas content**, in a commit of their own (the pre-commit hook keeps `data/` and code apart). | all |
| **Docs** | GDD §1, §3 (Spawners, Charges, Bin, Maps, Token cap), §5 (Shop), §8 (tutorial, upgrades), §10, §13, §15. | Updated slice by slice; concept_atlas's superseded sections marked. | all |
| **Hero gear** (`equipmentCategories.js`, `Charges.planContextCharges`, `RecipeResolver` `acceptedTokens`, `WorkCheck.heroReason`) | Tools are context Tokens nearby (9 types) that wear; the Iron Ore Vein needs a pickaxe nearby (`acceptedTokens`). Hands hold 2. | T-126 only (D-11): the requirement would read the hero's hands instead of the neighbours; tool Tokens and the recipes that make them become items; T-018 goes moot. Not needed by the Starter Camp: Oak, Copper, Coal and Stone need no tool today. | A13 |

---

## C. Slices

Ordered so that **each one leaves a playable game**: everything new is either
off until content uses it, reachable only from the dev console, or a finished
screen. "Bench" means the engine bench's work gate; draw and drag benches are
named when they move.

### A1 — Region model, travel and the save (engineer)

- **Files**: `src/state/StateSchema.js` (the `atlas` section), `SaveMigration.js`
  (per D-5), new `src/systems/atlas/Atlas.js` and `regionNames.js` (practical
  and flavour names; all player-facing text in one place for T-119),
  `EngineBootstrap.js` (a new game creates its first Region; `Game.Atlas`; a dev
  helper `Atlas.devCreateEmptyRegion()`), `engineEvents.js` (the board-swapped
  event), one subscription line each in `BoardRunner.js`, `BoardCombat.js`,
  `Flags.js`, `QuestManager.js`, `SpawnerSystem.js`; `QuestTokens.js` (quest
  Tokens travel beside the Hall).
- **Tests first**: `AtlasRegions.test.js`: a new game has one active Region
  holding the live board; practical name from ingredients, flavour name
  renamable; archive hides and restores; abandon deletes for good and refuses
  the active Region and the Starter Camp. `AtlasTravel.test.js`: travel stores
  the old board whole and installs the other; **there and back equals save and
  load** (Tokens, clocks, charges, flags identical); a frozen Region's clocks,
  charges and loot don't move during an hour of play elsewhere; a catch-up plays
  only the active Region; the Hall is one instance that travels with its
  Passive Production clock; quest Tokens travel beside it and the bounty clock is
  the guild's; floor loot is banked on leaving, overflow stays on that Region's
  floor; heroes arrive with no claim and no fight; the Token cap counts only the
  active Region. `SaveSchemaDeclared.test.js` gains the `atlas` section (its
  `regions` treated as id-keyed).
- **Done when**: tests green; in the dev game, travel to an empty test Region
  and back from the console, the mat redraws, heroes are idle, loot is banked,
  and a reload keeps both Regions.
- **Bench**: work unchanged [reasoned: the fingerprint never reads
  `state.atlas`, and no scenario travels]. S6's `stateJsonKb` grows by a few
  bytes (watched, not gated).
- **Eye-check**: no (nothing a player reaches without the console).
- **Parallel**: yes with A4 (pure new modules) and A9; **not** with A2 or A3a
  (they share `BoardRunner`, `Flags`, `WorkCheck`).
- **Open bits** (cheap to flip, so build with the recommended answers):
  D-5 (save version) and D-8 (flags on return).

### A2 — Respawning fixtures (engineer)

- **Files**: `Charges.js` (`destroyToken` diverts a type with a `respawn`
  block), `TimedChanges.js` (a `respawn` handler row for refill; regrow is a
  transform into `into`), `WorkCheck.js` (a "resting" reason checked before
  charges, not in `FIXABLE`), `BoardRunner.js` (a resting Token raises no alert;
  its hero lets go), `RecipeResolver.wearNearbySupport` path (same diversion),
  `boardEvents.js` (resting / respawned events), `tokenRegistry.js` or
  `tokenConstants.js` (one `respawnOf(def)` reader; the respawn time read through
  one function so a future time axis can widen it, A-12), `lifecycleAudit.js`
  (`into` exists and grows back to the type; `afterMs ≥ 1000`; never on enemies,
  spawners or Foundations), `catchUpSummary.js` (resting nodes are not "Tokens
  used up"), UI: a resting look and the countdown bubble (`MatToken.jsx`,
  `TimerBubble.jsx`, `lifecycleLines.js` "Refills in 12 s"), CMS:
  `TOKEN_LIFECYCLE_BLOCKS` and `makeLifecycleBlock` in `useEntityStore.js`,
  `LifecycleBlocks.jsx` (a Respawns block: refill or regrow, time, into).
- **Tests first** (`Respawn.test.js`): a refill Token at 0 stays on the mat,
  can't be worked, and refills to full after its time; a regrow Token at 0
  becomes its `into` Token, which grows back into it; no `TOKEN_DEPLETED` and no
  "used up" count for a respawning Token; a hero on a node that starts resting
  lets go with no red alert and picks the next thing; one big tick refills
  exactly as many small ones (catch-up); **a type without the block still leaves
  the mat at 0**; a tree spawned by a Forest regrows in place and keeps counting
  toward its family cap; a CMS test that the Respawns block round-trips through
  Sync.
- **Done when**: tests green; in the game, a fixture with a respawn block
  (registered from the console, or authored on a throwaway CMS route) rests,
  shows its countdown and comes back.
- **Bench**: work unchanged [reasoned: opt-in field, no bench or test fixture
  carries it]. One more `applies` check per Token per tick: expect noise-level
  timing; compare S2/S3.
- **Eye-check**: yes, small (the resting look); batch with milestone M1.
- **Parallel**: after A1; alongside A4 and A9.
- **Open bit**: D-7 (refill all at once vs a trickle). Build A; B is an extra
  mode later.

### A3a — Demolition as a job (engineer)

- **Files**: `StationRecipe.js` (`workConfigOf` returns the demolition config
  for a marked instance), `Flags.js` and `heroBubbles.js` (pass the instance
  everywhere `workConfigOf` is called), `BoardRunner.js` (a finished demolition
  removes the Token: a demolished event, no refund, no `TOKEN_DEPLETED`, no
  loot), new `src/systems/board/Demolition.js` (`canDemolish`, `mark`, `unmark`;
  `DEMOLISH_MS` and level 1 as constants), save: `instance.demolish`.
- **Tests first** (`Demolition.test.js`): marking makes the Token Construction
  work for a hero holding Construction; a finished demolition removes it with no
  refund and no depletion moment; the Hall, landmarks, quests and enemies can't
  be marked; unmarking restores normal work and loses the half-done
  demolition; a marked spawner stops spawning and a marked station stops its
  recipe.
- **Done when**: tests; from the console, mark a Token, watch a Construction
  hero walk over and remove it.
- **Bench**: unchanged [reasoned: nothing marks in the scenarios].
- **Eye-check**: no (no UI yet). The bin still exists alongside it.
- **Parallel**: after A2 (shared files); can be built before brief 50 merges.

### A3b — The bin goes; demolition UI (builder, after brief 50 merges)

- **Files**: delete `DiscardBin.js`, `DiscardBinPanel.jsx`; `PopOutSidebars.jsx`
  (the Bin tab), `dropOnMat.js` (unbin branch), `MatCapBadge.jsx`,
  `ShopDrawer.jsx` (`BIN_CHANGED`), `BoardState.js` (bin storage), `MatCap.js`
  and `SpawnerSystem.js` (bin counting), `StateSchema.js` (`bin`), `QuestTokens.js`
  + `QuestTooltip.jsx` (a Dismiss for bounties, not tutorial steps), a
  "Demolish" / "Cancel demolition" button in `TokenInspection.jsx` /
  `TokenInspectPopup.jsx`, a marked badge in `TokenBadges.jsx`; tests
  `DiscardBin*.test.js`, `PopOutSidebars`, `BumpSignatures`, `MatTopBar`,
  `QuestTokens`, `SpawnerSystem`; `bench/browser/dragKit.mjs` (bin kinds out).
- **Tests first**: a bounty can be dismissed and frees its place; the Token cap
  and family caps count no bin; the inspection button marks and unmarks.
- **Done when**: tests; in the game: mark from the inspection, a hero
  demolishes, the cap number drops, no bin tab anywhere.
- **Bench**: engine work unchanged [reasoned: the bin hash of an absent bin is
  the empty hash, as today]. **`bench:drag` changes** (the bin kinds go): re-take
  its baseline in the same slice and say so.
- **Eye-check**: yes (milestone M2).
- **Parallel**: no: waits for `crunch/drag` (brief 50 edits `dragKit.mjs`, and
  D3 will touch `MatToken`/`DndKit`).

### A4 — Generation engine (engineer)

- **Files**: new `src/systems/atlas/Budget.js` (ingredients → node counts),
  `Layout.js` (seeded layout; a local mulberry32 seeded per Region, never
  `Math.random`, see T-088), `Atlas.settle()` / `Atlas.reroll()` in `Atlas.js`,
  `RegionRules.js` (Region-wide `Provides` registered in the guild-wide
  aggregator, `GuildModifiers.js`, while the Region is active, replayed on load
  and travel), a definition adapter (shape per D-4), dev helpers to grant map
  items and settle from the console.
- **The model** [reasoned from concept_atlas §3.2–3.3 and §4]: each Base Map
  gives weighted node entries, enemy camps and treasures; modifiers **add**
  (density), **replace** (Oak → Fir), **add camps** (threat) or **add
  treasures**; the total is a points budget clamped to `cap − BUILD_RESERVE`
  (one constant, e.g. half the cap); counts apportioned by largest remainder;
  the layout places every node on a legal spot (`MatPlacement`), keeps a clear
  ring round the centre for the Hall, clusters same-species trees (Forestry's
  groves) and keeps camps away from the centre. Placed nodes are `placed` with a
  `fixture` mark (never pushed, D-6). The Region stores its biome weights (for
  brief 80) and its seed.
- **Tests first** (`AtlasBudget.test.js`, `AtlasLayout.test.js`): the budget is
  a pure function of the ingredients and **reroll never changes it**; same
  ingredients and seed give the same layout, a new seed moves only coordinates;
  a layout fits the cap minus the reserve; every node is legal and clear of the
  Hall's ring; same-species nodes cluster; replace/density/threat/treasure each
  do what they say; settle consumes the ingredients and cancel consumes nothing;
  Region rules apply only while their Region is active, and again after a load.
- **Done when**: tests; from the console, settle a two-ingredient Region, travel
  there, see a sensible layout; reroll ten times, the node summary never
  changes.
- **Bench**: unchanged (not in the tick).
- **Eye-check**: no (the layouts are seen in A6's preview).
- **Parallel**: the pure Budget/Layout modules now, alongside A1; settle after
  A1. **Prerequisite**: T-097's mat-size half (a fixed game value), so a layout's
  coordinates mean the same on every machine [reasoned: today the size is a
  per-device Mat Tuner value, `matTuning.js:112-117`].

### A5 — Maps as items, and the old map code retired (engineer; CMS editor by a builder)

- **Files** (per D-4 A): `itemRegistry.js` (`map`, `modifier` types),
  CMS `ItemEditor.jsx` (a Cartography section) and the simulator (map items
  priced by nothing: exempt them from the value and refusal passes,
  `cms/src/engine/sim/*`), `ContentAudit.js` (map items' Token references; a map
  that writes no nodes; a respawning node still sold at the Shop), the Bank at
  64 px for map items (`BankTab.jsx`), item inspection "What it writes" (from
  `Budget.js`), `questBounties.js` (bounties may pay a map, **drawn when
  claimed**, not when the bounty appears, so no random draw moves in the bench).
  Retire T-110: `mapRegistry.js`, `DatabaseManager.mapFilesSingle`, the map
  resolver and `auditMaps` (`ContentAudit.js:17, 49, 122, 533-552, 608`), the
  `mapId` rung (`tokenTypeDerivation.js:69`), CMS `MapEditor.jsx`, `mapPass.js`,
  its call in `simRunner.js`, the route in `App.jsx`, the maps mention in
  `TopBar.jsx`/`fileUtils.js`; tests `MapBurstRetired`, `EconSimMaps`,
  `CMSSyncRoute`, `ContentRules`.
- **Tests first**: a map item loads with its Cartography block; the audit flags
  a map naming a missing Token; a claimed bounty can pay a map and the bounty
  roll itself draws no extra random number; the CMS round-trips the Cartography
  block.
- **Done when**: tests; the owner can author a map item in the CMS (checked on a
  throwaway route), it shows in the Bank at 64 px and says what it writes.
- **Bench**: unchanged if the reward is drawn at claim [reasoned: bounties
  appear in the bench, claims never happen there].
- **Eye-check**: yes (Bank and inspection), milestone M1.
- **Parallel**: waits for D-4; then alongside A2/A3a (different files).

### A6 — Cartography and the Atlas screens (builder from this roadmap)

- **Files**: new `src/ui/components/atlas/` (`AtlasScreen.jsx`,
  `CartographyTable.jsx`, `NodeSummary.jsx`, `LayoutPreview.jsx` a small
  drawing of the generated layout, `RegionList.jsx`), `BubbleMenu.jsx` (Atlas
  bubble), `ReactRoot.jsx` (the overlay), `guildUpgrades.js` and
  `GuildUpgradeManager.js` (`cartography_slots` 2→8, `token_cap` per D-9),
  `MatCap.matCap()` reads the Token Cap rank.
- **Behaviour**: slots take one item each, never more than the Bank holds;
  reroll with the cooldown in D-9; cancel and closing return everything (nothing
  is taken until Settle); Settle, then Travel; rename the flavour name; archive;
  abandon behind a confirm. **Click to slot first**; drag to slot after brief 50
  merges (`DndKit.jsx` is brief 50's).
- **Tests first** (component tests): slot rules; settle consumes and adds a
  Region; cancel consumes nothing; abandon asks first and refuses the active
  Region; the Token Cap upgrade raises `matCap()`.
- **Done when**: in the game, with dev-granted maps: open the Atlas, slot two
  maps, read the summary, reroll, settle, travel, come back.
- **Bench**: engine unchanged. Draw: one cost-log line (a fifth bubble; the
  screen is an overlay, not on the mat).
- **Eye-check**: yes, **milestone M1** (with A2's look and A5's Bank).
- **Parallel**: yes with brief 50 (no shared files while it's click-to-slot).
- Waits for: A1, A4, A5, D-9.

### A7 — The Starter Camp and the new game (engineer, then owner content)

- **Files**: `tokenRegistry.js` / `MatCap.js` / `Placement.js` /
  `Demolition.js` (a `landmark` flag: not counted, fixed, not demolishable, per
  D-1), inspection of a landmark (skill, level, items needed), the Starter Camp
  layout source per D-2 (CMS page + loader, or code), `EngineBootstrap.js`
  (`createDefaultGameData` builds the Starter Camp Region; `openingMat` and
  `OPENING_ITEMS` move to content per D-2), the reachability test.
- **Tests first**: `NewGameOpening.test.js` rewritten (a new game opens in the
  Starter Camp, its Hall at the centre, its sites not counted); the "§6 every
  chain reachable" test re-based on the Starter Camp + the tutorial's maps + the
  Shop; the Starter Camp can't be abandoned; `ContentAudit`'s opening list.
- **Done when**: a new game in the browser opens on the owner's Starter Camp.
- **Bench**: unchanged (scenarios never use the opening, `harness.mjs:90-91`).
- **Eye-check**: yes, **milestone M3** (with A8).
- **Waits for**: D-1, D-2 and the owner's layout and site Tokens (placeholders
  are fine).

### A8 — The cartographer's tutorial (builder; text drafted for the owner)

- **Files**: `tutorialQuests.js` (new chain, new ids), `QuestManager.js` (new
  targets `token_inspected` (reported by the UI like `open_bank`),
  `region_settled`, `region_travelled`), the quest poster in the cartographer's
  voice (`QuestPoster.jsx`, `QuestTooltip.jsx`), the tutorial aide's beacons
  (T-095 dies here), T-115's wording dies here.
- **Steps** [doc: concept_quests_tutorial]: recruit; plant a flag; gather;
  collect loot; buy a Foundation; build a station; craft a recipe; win a safe
  first fight; inspect an endgame site; receive the first maps (the reward);
  write the first world (settle); move the guild (travel).
- **Tests first**: `QuestTutorialChain.test.js` rewritten to drive every step
  through the real systems; `TutorialAide.test.js`.
- **Done when**: a new game plays from the first quest to the first move in the
  browser, about 30–60 minutes at normal speed (time-skipped for the check).
- **Bench**: unchanged [reasoned: the tutorial Token spawns the same way; verify].
- **Eye-check**: yes, milestone M3 (the owner reads the cartographer's lines).
- **Waits for**: A6, A7.

### A9 — Ambush rules (engineer)

- **Files**: `statements.js` (`chance` in the Spawns payload), `statementSlots.js`
  (a chance slot), `statementText.js` ("a 5% chance to spawn …"; T-062: git
  treats this file as binary, so review its diff by hand), `TriggerSystem.js`
  (roll before firing: a miss neither fires, costs a charge nor starts the
  cooldown; a rule-fired spawn waits while the mat is at the cap), the ambusher
  tethered to its bearer (`EffectActions.spawn` returns the id; the caller sets
  `tether`), CMS `Statements.jsx`.
- **⚠️ Where the cap check goes**: in the rule-fired path, **not** inside
  `EffectActions.spawn`. S4 drives `EffectActions.spawn` past 80 Tokens without
  lifting the cap (`bench/scenarios/s4-push-storm.mjs:9-12`; only `realistic.mjs:56`
  and `s7-waiting-room.mjs:68` lift it), so a check there would change S4's work.
- **Tests first** (`Ambush.test.js`): with a seeded roll a 5% rule fires about
  5% of cycles; a miss costs nothing; a rule-fired spawn waits at the cap; an
  ambusher watches around the node and attacks its gatherer; **a Spawns rule
  with no chance draws no random number** (today's behaviour).
- **Done when**: tests; in the game, a dev fixture node with a 50% ambush spawns
  a hostile that attacks the gatherer, offline too (a time skip).
- **Bench**: unchanged [reasoned: no chance field means no draw; no fixture uses
  Spawns rules].
- **Eye-check**: no (the owner authors ambushes later; D4 removed the mining
  one).
- **Parallel**: yes, now.

### A10 — Fixed and movable Tokens (builder, after brief 50 merges)

- **Files**: `Placement.js` (an `isFixed` reader: per D-6), `MatToken.jsx` and
  `DndKit.jsx` (a fixed Token doesn't lift), `EffectActions.spawnPoint` /
  `BoardState.placedTokenIds` (fixed Tokens are never pushed), a faint marker
  at rest and a lift on hover with the grab cursor on movable Tokens.
- **Tests first**: a fixed Token refuses a drag; pushes skip fixed Tokens; only
  movable Tokens carry the marker.
- **Bench**: engine unchanged. **Draw: a cost-log line** (a marker on every
  movable Token at rest is a mat effect: the crunch rule in NOW.md).
- **Eye-check**: yes, milestone M2.
- **Waits for**: brief 50, D-6.

### A11 — No tier labels (builder)

- **Files**: `StationRecipeModal.jsx:28,37` ("tier N", "Foundation tier N or
  higher" → "a Stone Foundation or better"), the "a Tier 2 pickaxe" in the
  game's rules sentences (`statementText.js:549,557`; provisional effect names,
  `effectMigration.js:53`), inspection lines; the CMS keeps its numbers.
  RenderGolden: regenerate and read the diff.
- **Bench**: unchanged. **Eye-check**: yes (text), any milestone.
- **Parallel**: yes, now (small).

### A12 — Map upcycling (builder; per D-10)

- In the Cartography screen: trade N of a map for 1 of another, ratios on the
  map item in the CMS. Tests: an exchange takes exactly N and gives 1; refused
  short. Eye-check yes. After A6.

### A13 — Tools as hero gear, T-126 (engineer; per D-11, recommended after the crunch)

- `WorkCheck.heroReason` / `Flags` read a tool requirement against the hero's
  hands (`equipmentCategories.js`, hands: 2) instead of `acceptedTokens`
  neighbours (`RecipeResolver.js:75-90`, `Charges.planContextCharges`); tool
  Tokens and their recipes become items (owner content); support wear
  (`wearNearbySupport`) no longer applies to tools. Its own design pass first.

### Owner CMS to-do (after the code it needs; see E for order)

1. **After A2**: Respawns on Oak Tree (regrow into Oak Sapling), Copper Ore
   Vein, Coal Vein, Stone Outcrop, Clay and Quartz Deposits (refill), the Coast.
2. **After A5**: the first map items (D-3), maps on enemy drop tables (Goblin,
   Cow, Thorn Elemental); delete the Volcanic Island Token.
3. **After A7**: the Starter Camp layout (D-2); 25 endgame-site Tokens (name,
   ruin art, skill at 99, the items it needs; placeholders fine); treasures name
   a skill (A-18).
4. **Last, once A6 and A7 are merged**: remove the Shop blocks from Oak Forest,
   Coast, Copper Mine, Coal Mine, Quarry and the Goblin Camp (or give the Camp
   an upkeep and keep it as a lure).

---

## D. Owner questions (one batch)

Only questions whose answer changes code. Recommendation first in each.

### Owner answers (interview, 2026-10-09)

| Q | Answer |
|---|---|
| D-1 | **B, amended 2026-10-09 (brief 60 interview)**: the 25 sites **count toward the cap** after all (the owner: "I want the starter camp's tokens to count towards the limit"), and stand full size (not half size, not a ring by rule). Where they stand is the owner's layout (D-2). Expect a crowded Starter Camp; the owner chose readability. |
| D-2 | **A**: a Starter Camp page in the CMS, filled by a dev button ("Save this mat as the Starter Camp"), then Sync. The opening becomes content (settles T-014 for the opening). |
| D-3 | **A**: 3 Base Maps (Forest, Mountain, Coast) and 4 modifier kinds (more of a node, a better node instead, an enemy camp, a treasure); base-building modifiers in a later slice. |
| D-4 | **B**: maps and modifiers are authored in a **rewritten Map editor**, and each appears as an item in the Bank automatically. |
| D-5 | **A**: old saves are refused; the owner starts a new game. |
| D-6 | **B**: as A (map nodes, planted trees, sites and the Hall fixed with no marker; everything bought or built movable with the faint marker and lift; enemies and quests as today), **but map nodes can't be demolished**: the settled layout is permanent, and rerolling before settling is the only way to make room. |
| D-7 | **A**: a vein empties, rests for its respawn time, then refills completely at once. |
| D-8 | **A**: each Region remembers its flag positions; a brand-new Region starts with every hero in the Dock; loot on the floor is banked when the guild leaves. |
| D-9 | **Owner's numbers**: **4 Cartography slots to start, upgradeable to 8**; **base Token cap 128, upgradeable +16 per rank up to 256** (8 ranks). Pricing as today's placeholders (rank n = 10 × n Oak Wood) until the night-sky rework; reroll cooldown 0.5 s. ⚠️ The cap rises from 80: check brief 60/90's performance budgets against 128 and 256 (`MatCap.BASE_TOKEN_CAP`, T-102). |
| D-10 | **A**: instant trade in the Cartography screen, ratio per map in the CMS; the Atlas's last slice. |
| D-11 | **A**: tools as hero gear (T-126) **after the crunch**. |
| D-12 | **A**: keep the owner's two edited map pictures (frozen peak, volcano), drop the rest of `atlas-wip`. |

**D-1. The 25 endgame sites in the Starter Camp: the Token cap and the room on
the mat.** (25 full-size sites fill about a third of the mat before anything
else.)
- **A (recommended)**: Sites don't count toward the cap, can't be moved or
  demolished, and are drawn at **half size** in a ring of ruins round the mat's
  edge. Most of the cap and the mat stay free for the tutorial and building.
- B: Sites don't count and stand full size. They read better, but the Starter
  Camp feels crowded.
- C: The Starter Camp gets a bigger mat. The most room, but mat size becomes
  per-Region (more code, and the "fixed size" rule bends).
- D: One "Ancient Ruins" Token holds all 25 challenges. One slot, but you lose
  seeing each site.

**D-2. Who lays out the Starter Camp, and where it's kept.**
- **A (recommended)**: A simple Starter Camp page in the CMS (a list of Tokens
  with positions, plus the opening Bank), filled by a dev button in the game:
  arrange the mat in the game, press "Save this mat as the Starter Camp", Sync.
  The opening becomes content (this also settles T-014 for the opening).
- B: An engineer writes the layout in code from your sketch. Fastest now, but
  every change needs an engineer.
- C: A drag-and-drop mat editor inside the CMS. The nicest, and a long build.

**D-3. Which Base Maps and Modifiers ship first** (this decides which modifier
kinds the engine supports first).
- **A (recommended)**: 3 Base Maps built from today's Tokens: **Forest** (Oak,
  berries), **Mountain** (Copper, Coal, Stone), **Coast**; and 4 kinds of
  modifier: **more of a node** (Overgrown), **a better node instead** (Fir
  Grove: Oak → Fir), **an enemy camp** (Goblin Camp), **a treasure** (Ruins).
  Modifiers that change how a base is built (cramped land, a leyline bonus,
  tougher enemies) come in a later slice. (The concept's Plains and Swamp need
  Tokens that don't exist yet: grass, herbs, slimes.)
- B: 2 Base Maps (Forest, Mountain) and 2 modifiers (Fir Grove, Goblin Camp).
  Proves the loop fastest, little variety.
- C: All kinds at once, base-building modifiers included.

**D-4. Where you author Maps and Modifiers.**
- **A (recommended)**: As **items** in the Item editor, with a new Cartography
  section (what the map writes). One kind of thing to author; drops, quest
  rewards and the Bank already handle items. The old Map editor retires.
- B: In the old Map editor, rewritten; each map automatically appears as an item
  in the Bank. Keeps maps apart from items in the CMS, but two places describe
  one thing.

**D-5. Your saves when the Atlas lands.**
- **A (recommended)**: Old saves are refused and you start a new game, as the
  standing "refused until 1.0" policy says. A pre-Atlas save has Shop-bought
  forests and mines, a bin and no Starter Camp; carrying it over is work thrown
  away before 1.0.
- B: Keep old saves: your current mat becomes your first Region ("the Old
  Camp", no endgame sites, Tokens in the bin are discarded); new games start in
  the Starter Camp.

**D-6. What can be moved and demolished on the post-Atlas board.**
- **A (recommended)**: Map nodes, planted trees, the endgame sites and the Guild
  Hall stay where they are (no marker). Everything you bought or built moves
  (faint marker, lifts on hover). Enemies and quests move as today. Anything but
  the Hall, the sites, quests and enemies can be marked for demolition, **map
  nodes included** (that's how you clear a crowded spot).
- B: As A, but map nodes can't be demolished: the settled layout is permanent,
  and rerolling before you settle is the only way to get room.
- C: Everything stays draggable as today. No fixed board; the markers lose
  their point.

**D-7. How an ore vein refills.**
- **A (recommended)**: It empties, rests for its respawn time, then refills
  completely in one go (the 2026-10-07 decision as written). Easy to read:
  "Refills in 12 s".
- B: It regains one charge every few seconds whenever it's below full, even
  while being mined. Smoother, but a vein mined slower than it refills never
  runs dry, so the number of veins and miners matters less.

**D-8. Going back to a Region.**
- **A (recommended)**: Each Region remembers where your heroes' flags were:
  going back to the copper Region puts everyone back to work at once. A
  brand-new Region starts with every hero in the Dock. Loot lying on the floor
  is banked when the guild leaves.
- B: Heroes always arrive in the Dock; you re-plant flags after every move.
- C: Flags keep their spot on the mat from Region to Region, wherever that lands.

**D-9. Cartography numbers** (placeholders until the Hall's night-sky rework).
- **A (recommended)**: 2 slots to start, the Cartography Slots upgrade adds one
  per rank up to 8, priced like every upgrade today (rank n costs 10 × n Oak
  Wood). A Token Cap upgrade: +10 per rank, 4 ranks (80 → 120), same pricing.
  Reroll cooldown 0.5 s, as the concept says.
- B: Same shape, and you give the prices and amounts now.
- C: No Token Cap upgrade yet; the cap stays 80 until the sky rework.

**D-10. Map upcycling** (turning surplus maps into better ones).
- **A (recommended)**: In the Cartography screen: trade a number of one map for
  one better map, instantly, no hero; the ratio is set on each map in the CMS.
  Built as the Atlas's last slice.
- B: A crafting recipe a hero works at a station (needs a skill to own it).
- C: After the crunch.

**D-11. Tools as hero gear (T-126): in the Atlas, or after?**
- **A (recommended)**: After the crunch, as the ticket says. The Starter Camp's
  first nodes (Oak, Copper, Coal, Stone) need no tool today, so the tutorial
  doesn't depend on it.
- B: As the Atlas's last slice, so the tutorial teaches the pickaxe in hand from
  day one (otherwise the tutorial gets one more rewrite later).

**D-12. The parked Atlas work (T-005, branch `atlas-wip`).**
- **A (recommended)**: Keep your two edited map pictures (frozen peak, volcano);
  drop the rest. The save section is rewritten in A1 with more fields, and the
  four map items were written outside the CMS: the game would load them where
  the CMS can't see them, and their pictures don't exist. They're re-made in the
  CMS once maps exist (D-4). The pictures are yours, in `public/assets/`: you
  commit them, or tell the director to.
- B: Keep the save section as A1's starting point; drop the items.
- C: Keep everything, and teach the CMS to read `data/items/`.

---

## E. Notes for the director

### Risks

1. **Brief 50 overlap.** A3b (the bin) and A10 (fixed Tokens, markers) touch
   `PopOutSidebars`, `dropOnMat`, `MatToken`, `DndKit` and `bench/browser/dragKit.mjs`,
   which `crunch/drag` is editing (its D1 already changed `dragKit.mjs`, +127
   lines). Hold both until brief 50 merges; A6 uses click-to-slot so it doesn't
   need `DndKit`.
2. **Content order can break new games.** If the owner removes the resource
   places from the Shop before the Starter Camp (A7) and maps (A5/A6) exist, a
   new game has no wood. The Shop edit goes last (C, owner to-do 4).
3. **Content-pinning tests break on every Atlas content sync**
   (`ForestryChain`, `MiningChain`, `FarmingChain`, `NewGameOpening`,
   `ContentRules`, `QuestTutorialChain` read `data/`). Plan a follow-up commit
   after each sync; the pre-commit hook keeps `data/` and code apart.
4. **Travel must reset exactly what a load resets.** The per-board WeakMaps make
   this mostly free, but module-level state exists (`SpawnerSystem` alerts and
   no-room set, `BoardRunner` carry-over, `TimedChanges` in-hand set). A1's
   "there and back equals save and load" test is the guard; don't merge A1
   without it.
5. **Demolition is per instance, work choice is per type.** Four `Flags` calls
   and `heroBubbles` read `workConfigOf(def)` without the instance; missing one
   sends heroes to a marked Token for its old skill or ignores the mark (A3a).
6. **Cap leaks.** Rule-fired spawns ignore the cap today (A-5); fix it in the
   rule path, not in `EffectActions.spawn`, or S4's work changes (A9).
7. **The Starter Camp's 25 sites** are a space problem as much as a cap problem
   (A-16). Don't start A7 before D-1.
8. **Mat size is per device** (Mat Tuner). Generated coordinates assume one
   size; land T-097's mat-size half before A4 settles real Regions.
9. **Save size.** 20+ Regions × ~80 Tokens fit easily in `localStorage`
   [reasoned: ~250 bytes per Token ≈ 0.5 MB], provided floor loot is banked on
   leaving and frozen boards drop runtime fields. Saves become files before
   outside players anyway (concept_release).
10. **The economic simulator** prices everything by sources; map items have
    none and will draw refusals until A5 exempts them.
11. **CMS checks** happen on a throwaway route only (TESTING): a Respawns or
    Cartography test block left in the real workspace gets synced into `data/`.

### Build first overnight (no owner answer needed)

- **A1** Region model and travel, with D-5 A (refuse old saves: one constant)
  and D-8 A (flags remembered) isolated in one function each.
- **A4's pure modules** (`Budget.js`, `Layout.js`) against an internal recipe
  shape; the definition adapter waits for D-4.
- **A9** Ambush rules (fully locked).
- **A11** No tier labels (locked; small; visible text, so it waits for an
  eye-check before merging).
- Then **A2** (after A1; D-7 A is the literal decision) and **A3a** (after A2).

Run A1, A4-pure and A9 as three worktrees in parallel (no shared files);
A2 → A3a sequentially after A1 in the A1 worktree's branch line.

### Must wait

- On owner answers: A5 (D-4), A6 (D-9, and A5), A7 (D-1, D-2, owner layout),
  A8 (A7), A10 (D-6), A12 (D-10), A13 (D-11), and the `atlas-wip` clean-up (D-12).
- On brief 50 merging: A3b, A10, drag-to-slot in A6.
- On owner content: A7's real Starter Camp, A8's text, every live-game "done
  when" that needs authored respawns or maps (until then, verify with console
  fixtures).

### Eye-check milestones

- **M1**: resting nodes (A2), the Bank's map items (A5), the Atlas and
  Cartography screens (A6), tier wording (A11) if ready.
- **M2**: demolition and no bin (A3b), fixed vs movable with markers (A10).
- **M3**: a new game in the Starter Camp through the cartographer's tutorial to
  the first move (A7, A8).
- **M4**: upcycling (A12).

### Bookkeeping this unlocks

- Close **T-024** and **T-025** (stale, A-19); **T-101** is moot once A3b lands;
  **T-110** is consumed by A5; **T-108** and **T-103** (the `StateSchema.js`
  comment pass) unblock once D-12 is settled; **T-014** is half-settled by D-2;
  **T-095** and **T-115** die with A8; `tickets_done.md`'s T-002 line overstates
  (Volcanic Island remains, A-3).
- GDD sections to update as slices land: §1, §3 (Spawners, Charges, Bin, Maps,
  Token cap), §5 (Shop), §8 (tutorial, upgrades), §10, §13, §15 (Region,
  Atlas, landmark, resting).
- Brief 80 needs each Region's biome weights: A4 stores them.
