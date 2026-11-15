# D1: The mat, read deep

*Reviewer session D1, 2026-11-15, read at `main` **cccf7a24** in the worktree `.claude/worktrees/rw`.
The first session of the deep read the owner asked for on 2026-11-15 (rulings in `STATUS.md`): hunt
bugs a player can hit, one area properly. Scope: `src/systems/board/` (66 files, 17,037 lines) and
what it calls in `combat/`, `effects/`, `hero/`, `events/`, `quests/`, `atlas/` and the UI's drop
and order handlers. Method: the area was cut into eight pieces by what the player does (the work
cycle; placing, moving and merging; geometry and ground; orders and walking; fights; things on a
clock; buffs and upkeep; triggers and statuses) and two cross-cutting traces (every way a Token
leaves the mat against everything that points at one; every piece of module state against load,
travel, catch-up and undo). Ten read-only readers (Fable) each read their piece whole, about 3.5
million tokens of reading in all, and tried to disprove each lead before reporting it. The reviewer
read `BoardRunner.js` whole and re-read the cited lines of the leading findings; every finding was
then checked by one of three second readers on another model (Opus), given the finding's text and
nothing else and told to refute it (see each `Verified by`). Nothing was run: no
tests, no bench, no game. Round 4's R2 and R3 findings and `TICKETS.md` were checked so nothing here
re-files them.*

## Session summary (for the owner)

**What this area is.** The playmat's rules: where a Token may stand and how it is moved or merged,
which Token each hero's order claims and how they walk to it, every work cycle, growing and
refilling, spawners, fights, buffs between neighbours, and the rules that fire on moments. Round 4
gave it one quick pass (R2, fifteen findings, two of them bugs). This time every file was read
whole by a reader whose only job was to find what a player can hit, and two readers followed
single questions across the whole engine.

**How healthy it is.** Sound at the core, with real bugs at the seams. The parts that run ten times
a second came through a hostile read clean: no cycle pays without producing or produces without
paying, nothing is spent or awarded twice, no clock double-fires or loses time in a catch-up, no
hero or Token is left stuck when a Token leaves, and nothing is forgotten or left over across a
reload, travel, a catch-up or its undo (the section "What the readers found sound" lists what was
pressed, so nobody re-checks it). The bugs sit where two rules meet that were written apart:
healing and travel, merging and resting, Thorns and the kill, growing and a neighbour placed tight.
A second layer is waiting rather than live: the rule grammar the CMS offers is much wider than what
shipped content uses, and thirteen shapes it can author today would misbehave (CR4-124).

**The three findings that matter most.**
1. **CR4-101, a healing hero is knocked out twice.** A hero defeated in one Region who still holds
   an order on an enemy in another is, on the guild's return inside the five-minute healing time,
   defeated again without a blow: a second share of carried food and drink gone and a second roll
   to lose every gear piece. The ordinary way in is settling a new place, losing a fight to the
   enemies holding it, and going home. If the old order is a tree or a station, the hero simply
   works while "healing". Found independently by three readers.
2. **CR4-103 and CR4-104, Thorns.** The Thorns rule quietly spends a second charge on every harvest
   or kill, so a Redberry Bush gives 13 harvests per refill where its neighbour the Blackberry Bush
   gives 25, and a Thorn Elemental lasts 50 kills, not 100; nothing on the card says so and a code
   note says the bush was meant to be free. And on its last kill the Thorn Elemental "runs out"
   twice: two notices, and the used-up count doubled for quests and the away summary.
3. **CR4-102 and CR4-105, Tokens that vanish or jump.** Dropping a used-up, resting Forest onto
   another of its kind deletes it with a cheerful "Restocked" (zero charges to give reads as
   "everything fitted"). And a tree growing back, or a large building finishing, beside something
   placed tight against its small Stump or Foundation appears up to 640 units away instead of
   waiting for room; the tree may land outside its Forest's reach and never regrow.

**Counts.** 25 findings: 22 `bug`, 3 `owner-decision`. 1 at P1, 5 at P2, 19 at P3. 23 verified
against the code by a second reader on another model, 2 left `reasoned` (their size in play is
unmeasured). Of the 25, twelve are things a player can meet in ordinary play today (CR4-101 to
105, 107, 109 to 112, 114, 116), ten are small or need an unusual sequence, two are for the owner
to rule on as design (CR4-107, CR4-108), and one (CR4-124) gathers thirteen latent faults behind
content nobody has authored yet. The three checkers refuted no finding outright and corrected
fourteen details, all folded in; half of one finding (a bounty landing off the mat, CR4-125) was
refuted and removed. Six questions for the owner are in `STATUS.md`.

**For the director to check first.** Nothing here needs a bench to believe; each is a scenario that
can be staged in the running game or pinned by a test before the fix. CR4-101 first (stage: order a
hero onto an enemy, travel, lose a fight, travel back). CR4-103's fix changes the bench's
`depleted` figure wherever a Thorn Elemental was double-counted, and CR4-107 (a) and CR4-118 would
change the work fingerprint: each is a WORK CHANGED to accept on purpose, with the reason. CR4-118
is the one finding that wants a measurement: the same fight at 100 ms and at 1,000 ms steps.

---

## Findings

### CR4-101  A hero who is still healing is knocked out a second time, or works while healing, after travelling to a Region where they still hold an order
- **Tag**: bug
- **Priority / Effort / Risk**: P1 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/BoardCombat.js:416`, `src/systems/board/BoardCombat.js:513-532`, `src/systems/board/Flags.js:777-795`, `src/systems/board/Flags.js:1042-1046`, `src/systems/board/Flags.js:230-234`, `src/systems/combat/CombatFormulas.js:86-88`, `src/systems/board/WorkCheck.js:60-70`, `src/systems/atlas/Atlas.js:506-534`, `src/systems/board/Orders.js:104-107`, `src/systems/combat/DefeatPenalties.js:31-51`
- **What**: A defeat takes the hero's flag down on the mat they are on, and that is the only thing keeping a healing hero off work. Flags planted in another Region stay in that Region's frozen board. Travel does not look at hero status, and neither does anything that hands out work on arrival. So a hero knocked out in Region B, brought back to Region A inside the five-minute healing time, walks to their old order. If it is an enemy or an enemy camp, the tick they arrive makes a fight, sees `status === 'wounded'` and resolves a second defeat with nobody swinging: a second knock-out banner, another share of each carried food and drink stack, another loss roll on every gear piece. If it is a tree or a station they work full cycles with XP and output while "healing", limp removed. The only wounded check is on a new order from the player (`Orders.js:104`), which also means the player cannot drag them away; only right-click stop works.
- **Evidence**: `tickToken` ends with `if (!hero || hero.status === 'wounded' || ...) { resolveDefeat(instance, heroId); return; }` (`BoardCombat.js:416-418`); `resolveDefeat` skips re-setting the status (`:517`) but calls `applyDefeatPenalties(heroId)` and publishes `HERO_DEFEATED` unconditionally (`:522`, `:532`). `canHeroFight` is `!!hero`. `arrive()` is `reset(); forget claims; restoreWork();` with no status test. `travel()` refuses only for no game, unknown or archived Region, already here, catch-up running. Found independently by three readers (orders, fights, load and travel). GDD says a healing hero takes no job (`docs/reference/GDD.md:725-727`). The natural route in: settle a new place (it arrives held by enemies), lose a fight there, go home.
- **Fix sketch**: One rule in one place: a wounded hero takes no claim (`canTake` / `evaluate` in `Flags.js`), so every board, load and arrival obeys it; and `resolveDefeat` returns early (no penalties, no event) when the hero was already wounded before this fight began. Decide with the owner whether a healing hero's flags in other Regions stay planted (they resume when healed) or come down. Must not change: heroes picking their old orders up on return (`AtlasTravel.test.js:413`), the defeat penalties themselves, the bench's work fingerprint (no wounded travel in the bench).
- **Verified by**: Opus verifier A (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. Read `Flags.js` claim path, `HeroMotion`, `WorkCheck`, `CombatProcessor`, `DefeatPenalties` and every `'wounded'` in the engine: no status check between travel and the claim; `applyDefeatPenalties` has no guard. The reviewer re-read `BoardCombat.js:404-535`, `Flags.js:1015-1048`, `Atlas.js:504-512`.
- **State**: open

### CR4-102  Dropping a used-up, resting Token onto a copy of itself deletes it, with a "Restocked" notice
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/MatPlacement.js:813-823`, `src/systems/board/MatPlacement.js:913-928`, `src/systems/board/Placement.js:241-279`, `src/systems/board/Placement.js:308-317`, `src/ui/components/board/dropOnMat.js:97-100`, `src/ui/components/board/rightClickOrders.js:76-85`
- **What**: Dropping a Token on a matching copy tops the copy up with the dragged Token's charges; when every charge fits, the dragged Token is absorbed and removed. A dragged Token with zero charges has nothing to give, and zero left over reads as "every charge fitted": the copy gains nothing, the green "Restocked from ..." notice and sound play, and the dragged Token is taken off the mat for good. A resting Token is not spent: it would have refilled.
- **Evidence**: `available = instance.usesRemaining != null ? instance.usesRemaining : maxCap` is 0; `transferred = Math.min(needed, 0)` is 0; `leftover = 0`; `if (leftover === 0) return { status: 'restocked', ..., absorbed: true }`; `restock()` then calls `BoardState.removeToken(moved.id)`. `restockTargetAt` asks only that the target is the same type and below `def.uses`. Which Tokens: in today's content the three built Forests, `token_birch_forest`, `token_maple_forest`, `token_mahogany_forest` (250 charges, refill after 10 minutes; made by a build recipe, so placed, not fixtures, and no `staysPut`). The raspberry and pineapple bushes and the watermelon patch also lack `staysPut` but exist only as Region nodes, which are fixtures (`src/systems/atlas/Cartography.js:121`) and cannot be dragged. The copy dropped onto may itself be fixed: `restockTargetAt` does not ask. The only drag gate in the UI is `FixedTokens.isFixed`. The tests pin only movers that hold charges (`MatPlacement.test.js:265-367`, `TokenRestock.test.js`).
- **Fix sketch**: In `dropAt`, a mover with no charges to give is not a restock: fall through to the ordinary nudge beside the copy (`transferred <= 0` means no restock). Must not change: restocking beats nudging for a mover that holds charges (`MatPlacement.test.js:266`), the CR4-027 fix (an absorbed mover leaves).
- **Verified by**: Opus verifier A (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, with the list of affected Tokens corrected to the three built Forests (folded in). The reviewer re-read `MatPlacement.js:795-830`, `:905-928`, `Placement.js:232-320`.
- **State**: open

### CR4-103  A Thorn Elemental "runs out" twice on its last kill: two notices, and the depletion counted twice
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/BoardCombat.js:449-457`, `src/systems/board/BoardCombat.js:462`, `src/systems/board/BoardCombat.js:478-496`, `src/systems/board/TriggerSystem.js:207`, `src/systems/board/TriggerSystem.js:387`, `src/systems/board/Charges.js:181-183`, `src/systems/board/Charges.js:124-141`, `src/systems/quests/QuestManager.js:213`, `src/systems/core/CatchUp.js:211`, `src/systems/world/Arrival.js:236`
- **What**: A kill takes one charge off the enemy Token and publishes `CYCLE_COMPLETE`; the Thorns rule hears it and takes another. When the kill leaves 1 and Thorns takes it to 0, `Charges.applyDelta` removes the Token and announces the depletion (alert, `TOKEN_DEPLETED`, `TILE_CHANGED`, `ADJACENCY_DIRTY`); control returns to `resolveVictory`, which sees `usesRemaining <= 0` and announces the same depletion again. The player gets "Token Exhausted: Thorn Elemental" twice, and every `TOKEN_DEPLETED` listener runs twice: the quest counter for used-up Tokens, the away summary's count, the arrival check. The same root makes the two publishers disagree: a kill's `TOKEN_DEPLETED` carries no `instance` and no `heroId`, so a rule on an enemy's own depletion, or an event enemy's "worked out" report (`src/systems/events/EventClock.js:339-341`), could never fire (no such content today).
- **Evidence**: `token_thorn_elemental` has `uses: 100` and carries `effect_thorns` (`chargeDelta: -1`) with no per-reference `chargeCost`; 100 is even, so Thorns always takes the last charge, on the 50th kill. `resolveVictory` re-implements `destroyToken` rather than calling it; the second `removeToken` is a no-op but nothing guards the second round of publishes. `Thorns.test.js` uses `uses: null` only.
- **Fix sketch**: `resolveVictory` checks the Token is still on the mat before announcing, or better hands the depletion to `Charges.destroyToken` so there is one implementation and one payload (with `instance` and `heroId`). Must not change: the kill's loot landing before the Token leaves, `endFight` at the kill, the bench's `depleted` figure except where a Thorn Elemental was double-counted (a WORK CHANGED to accept, and say why).
- **Verified by**: Opus verifier A (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. `statementChargeDelta` returns -1 for the elemental's reference; order on the last kill as written. The reviewer re-read `BoardCombat.js:440-497`, `Charges.js:117-185`.
- **State**: open

### CR4-104  Thorns quietly spends a second charge: a Redberry Bush gives 13 harvests per refill, not 25, and a Thorn Elemental 50 kills, not 100
- **Tag**: owner-decision
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/BoardRunner.js:420`, `src/systems/board/BoardRunner.js:430`, `src/systems/board/TriggerSystem.js:207`, `src/systems/board/TriggerSystem.js:387`, `src/systems/board/cycleCharges.js:35-58`, `src/systems/effects/effectLibrary.js:156-158`, `data/effects.json` (`effect_thorns`), `data/tokens.json` (`token_redberry_bush`, `token_thorn_elemental`)
- **What**: Each harvest of a Redberry Bush spends one charge for the cycle and one more for the Thorns rule that pricks the hero. 25 charges give 13 harvests, then the bush rests; the Blackberry Bush beside it, also 25, gives 25. The card says only "On Cycle: deals 1 damage to the hero", the pace maths (`cycleCharges.js`) counts one charge a cycle, and a code comment says the intent was "one Thorns free on a berry bush, a charge on a monster" through a per-reference cost the bush's reference does not carry. Three places disagree with what the engine does.
- **Evidence**: `effect_thorns` statement has `chargeDelta: -1`; both Tokens reference it as `{ effectId, scale: 1 }` with no `chargeCost`. `statementCycleCost` / `ownCycleCost` count only `chargeWhen: per_cycle` rules, so the triggered cost is invisible to the ledger. `Thorns.test.js:271-288` pins only that a reference can override the cost.
- **Fix sketch**: The owner's call (a question in `STATUS.md`): (a) free on the bush, set `chargeCost: 0` on the bush's reference by change pack, and decide the monster separately; (b) the cost is wanted, so the rule's sentence says "uses 1 charge" and the ledger counts it. Nothing in code changes for (a). Fixing CR4-103 first makes either safe.
- **Verified by**: Opus verifier A (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. Arithmetic re-derived: 13 harvests (the last without a thorn), 50 kills; a Refresh perk can skip the cycle's charge, never the thorn's.
- **State**: open

### CR4-105  A tree that grows back, or a large building that finishes, can appear somewhere else on the mat
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / M / medium
- **Confidence**: verified
- **Where**: `src/systems/board/MatPlacement.js:499-511`, `src/systems/board/MatPlacement.js:469`, `src/systems/board/MatPlacement.js:683-691`, `src/systems/board/FixedTokens.js:117-124`, `src/systems/board/EffectActions.js:388-392`, `src/systems/board/EffectActions.js:220-227`, `src/systems/board/Foundations.js:43-50`, `src/systems/board/BoardRunner.js:220-224`, `src/config/matGeometry.js:94`, `src/systems/board/TimedChanges.js:179-203`
- **What**: A Stump and a Sapling are small (`artSize: small`, radius 32); the Tree they become is standard (radius 64; a Cedar is size 2, radius 144), and a size-1 Foundation can build a size-2 building. The player may legally place a station tight against the small one. When it grows or finishes, the grown form overlaps the placed neighbour, the push is refused (placed Tokens are never pushed for a growth or a build), and the fallback puts it on the nearest free spot within 640 units. The player sees a tree hop across the mat, or pays for a building that stands somewhere else, though `Foundations.js` says it becomes the Token "at the same point" and a build with no room is meant to hold with the "no room" mark. A map tree the guild "never moves" has moved. If the tree lands outside its Forest's reach, its next Stump waits on "Needs Oak Forest" for good and the Forest plants a replacement.
- **Evidence**: `forceSpot` tries the point, then `relax`, then `findSpot(..., reach: ARRIVAL_FALLBACK_REACH)` (640). `relax` returns null at once when the newcomer overlaps a fixed body, and `fixPlaced: true` makes every placed, planted or `staysPut` Token fixed. `Foundations.hasRoomToBuild` asks the same `forceSpot`, so the far fallback counts as "room". The search that keeps room for the grown form (`asGrown`) has one caller, a Forest's own plantings. `recipe_muily2pe` builds `token_fighter_s_academy` (size 2). Tests pin the fallback for `forceSpot` in general (`MatPlacement.test.js:458`, `SpawnTransform.test.js:177`), not a growth or build relocating. T-308 covers only a crowded Forest's own Saplings.
- **Fix sketch**: Two parts, the second the owner's call. (1) A player's drop beside a Token that grows, or beside a Foundation, keeps room for the largest form it can become (the `asGrown` test in the drop's legality), so the squeeze cannot be made. (2) For squeezes already on mats: a growth or build that cannot stand at its own point holds (growth clock full, build on "no room") instead of hopping, or hops only a short way. Must not change: the Tree-Stump-Sapling ids and pins following (`Flags.followTransform`), saved layouts (nothing moves on load), the bench's work fingerprint for boards where every growth has room.
- **Verified by**: Opus verifier A (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, with the size wording corrected to `artSize` (folded in). The "Needs Oak Forest" consequence was not traced end to end.
- **State**: open

### CR4-106  A Sapling planted on the outermost ring of its Forest's reach counts as outside it
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/MatPlacement.js:393-398`, `src/systems/board/MatPlacement.js:117-120`, `src/systems/board/MatPlacement.js:503`, `src/systems/board/EffectActions.js:220-227`, `src/systems/board/SpawnerSystem.js:383-388`, `src/systems/board/SpawnerSystem.js:162-171`, `src/systems/board/nearby.js:44-46`, `src/systems/board/TileModifiers.js:1025-1046`
- **What**: A Forest looks for a planting spot on rings out to its reach, inclusive, and 240 (the reach) is itself a ring. "In reach" is an exact compare with no slack, so a point computed as `x + cos*240` often measures a hair over 240 back from the Forest; and every growth then snaps the Token to whole units, which moves it further. When the inner rings are full (packed mat, mat edge, water), the Forest plants on ring 240, does not count that Sapling, pays for another, and the tree's Stump later says it needs its Forest and never regrows. A new mechanism behind T-308's symptom: no crowding shove is needed.
- **Evidence**: The ring walk runs `d <= ctx.reach`; `nearby` tests `distanceSq <= radius * radius`. Computed twice (reader and verifier, `node`, the 252 candidates of ring 240): between a third and a half read as out of reach depending on the Forest's coordinates (84 to 121 of 252 over five Forest points); after the whole-unit snap in `forceSpot`'s `clampInside`, about half (125 to 130 of 252). `SpawnerWithinReach.test.js:87-155` tests only an open mat and a fully packed one. The same snap also makes any grown Token or finished build re-test legality up to 0.71 units from where it stood, which feeds CR4-105's hop for a Token standing just at a neighbour's gap. Frequency in real play is unmeasured (reasoned).
- **Fix sketch**: Search to `reach - RING_STEP` (or shrink the search reach by one unit) so a planting never sits on the limit, and do not round a transform's own point (test legality where it stands). Must not change: saved layouts, the reach ring the player sees, the bench's work fingerprint on boards with open inner rings.
- **Verified by**: Opus verifier A (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, re-running the ring arithmetic on five Forest points; the share corrected to a range (folded in).
- **State**: open

### CR4-107  A low-level hero can work a station set to a high-level recipe; the card and the recipe list say they cannot
- **Tag**: owner-decision
- **Priority / Effort / Risk**: P2 / S / medium
- **Confidence**: verified
- **Where**: `src/systems/board/StationRecipe.js:112-121`, `src/systems/board/StationRecipe.js:66-74`, `src/systems/board/WorkCheck.js:60-81`, `src/systems/board/BoardRunner.js:614`, `src/systems/board/BoardRunner.js:635`, `src/ui/components/board/tokenCard.js:543`, `src/systems/board/RecipeList.js:98`, `src/systems/progression/ledger/engine.js:455`
- **What**: A recipe's level gates only picking it, and the pick is open up to the guild's best hero. Once a Furnace is set to a level-30 ingot, a level-1 smith ordered onto it is not refused, works it and earns that recipe's XP (smithing recipes run to level 90, where a cycle pays 2,185 XP). The card shows "Smithing 30" as the work level and the recipe list draws each hero's divider below the rows they can run. A Foundation does enforce the recipe's level per hero (`BuildInPlace.test.js:187-203`). Either the engine or the card and divider are wrong, and it is a levelling shortcut either way.
- **Evidence**: `workConfigOf` folds `recipeLevel(recipe)` into `skillRequired` only when `def.foundation`; a station returns `def.config` as authored, and every station with a config in `data/tokens.json` has `skillRequired: 1` (16 of 17; one has no config). `Flags` uses the same `workConfigOf` then `heroReason`, and `RecipeResolver` has no level check. `heroReason` checks `config.skillRequired` only. A ledger comment calls it intended ("the recipe's level gates only picking it") and `GDD.md:1033` gates the list by the guild's best hero; no test pins the station case.
- **Fix sketch**: The owner's call (a question in `STATUS.md`): (a) a hero needs the recipe's level to work it (fold the level in for stations as for Foundations; the hero is skipped with the usual "skill too low"); (b) by design, so the card and the divider stop saying otherwise. (a) changes the bench's work fingerprint if a bench hero is under-levelled for a set recipe.
- **Verified by**: Opus verifier A (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, with the XP example and the station count corrected (folded in). No other gate found.
- **State**: open

### CR4-108  Merging treats Tokens that refill, and enemies, as if they were consumables
- **Tag**: owner-decision
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/MatPlacement.js:813-823`, `src/systems/board/MatPlacement.js:913-928`, `src/systems/board/Placement.js:267-279`, `src/systems/board/Respawn.js:109-123`, `src/systems/board/BoardCombat.js:449-457`
- **What**: The top-up merge was made for consumable Tokens. It also applies to Tokens that refill on their own and to enemies with charges. A full Birch Forest dropped on a resting one is absorbed whole: two forests that would each refill for ever become one. A resting copy is a valid target, so its rest is skipped by pouring charges in. A Cow or Thorn Elemental below its 100 merges with another (the only enemies with more than one charge); the absorbed one leaves with no depletion, the pasture's count drops and it spawns a fresh one. The merge fires whenever the pointer is inside the copy's picture (64 units) while two such Tokens may stand about 61 apart, so packing them tightly by hand, or a right-click move onto the copy, merges instead of nudging.
- **Evidence**: `restockTargetAt` tests type and `usesRemaining < def.uses` only; no test for `respawn` or enemy types. `Respawn.js:115-116` shows the mid-rest restock is known. "Restocking beats nudging" is pinned for plain consumables (`MatPlacement.test.js:266`).
- **Fix sketch**: The owner's call (a question in `STATUS.md`): (a) only Tokens that do not refill and are not enemies merge; the rest nudge beside the copy; (b) keep it. CR4-102 is fixed either way.
- **Verified by**: Opus verifier A (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. Gap arithmetic re-derived (61.2 units between two standard Tokens against a 64-unit picture).
- **State**: open

### CR4-109  Holding an enemy in the hand pauses its fight but not the poison
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/BoardRunner.js:584-587`, `src/systems/board/BoardRunner.js:592-601`, `src/systems/effects/LiveEffects.js:578-585`, `src/systems/hero/RegenSystem.js:42`, `src/systems/combat/CombatAttackProcessor.js:82`
- **What**: A Token in the player's hand is skipped by the tick before the fight code, so neither side swings and the fight neither ends nor resets. The three-second status clock runs on its own handler for every bearer regardless. A hero carrying Venom stacks (Queen Bee and Toxic Frog through their `venomous` kind, one stack a hit; the Greater Slime every third hit; up to 3 stacks, 1 damage a stack every 3 s, armour ignored) or the Fire Elemental Chief's Burn keeps losing HP while the player holds that enemy, cannot eat (eating is a swing) and does not regenerate (marked in combat), and can be knocked out with the full gear loss while the fight shows nothing happening.
- **Evidence**: The in-hand `continue` at `:584` sits before `BoardCombat.tickToken` at `:600`, whose own comment says it must be called unconditionally. Enemies are selectable and draggable (`useMatSelection.js`, "an enemy included"). Found by three readers. Needs a held drag of many seconds with stacks on; how long the UI lets a drag last was not checked.
- **Fix sketch**: Picking up an enemy that is being fought ends the fight as a let-go does (statuses off, enemy whole), or a fought enemy refuses the pick-up; the smaller change is to end the fight in the in-hand branch. Must not change: a held Token's work cycle pausing and resuming.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, with the enemies that land a damaging status corrected (folded in). No drag time limit and no fight refusal in `DndKit.jsx` or `MatToken.jsx`.
- **State**: open

### CR4-110  A Token's card stays open, on the old name and place, after the Token is built, felled, used up, killed or claimed
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/ui/components/board/TokenInspectPopup.jsx:52-66`, `src/ui/ReactRoot.jsx:433-440`, `src/ui/hooks/useUIModals.js:7`, `src/systems/board/EffectActions.js:413`
- **What**: The card is drawn for as long as a selection is set, and nothing clears the selection when its Token leaves the mat or becomes another (every "becomes" is a new instance with a new id). Open a Foundation's card, let the hero finish: a Workbench stands there and the card still says "Wood Foundation". Same for an Oak turning into a Stump, a killed enemy, a claimed quest. Its buttons are inert on the dead id, so nothing wrong can be done from it.
- **Evidence**: The popup re-measures only on `TILE_CHANGED` for its own id and falls back to the old rectangle when the element is gone; a transform publishes `TILE_CHANGED` under the new id. The card hangs on `ui.inspect.selection` (`useUIModals`), not on the mat's selection outline, which is dropped when its Token goes (`useMatSelection.js:181-182`) without reaching the card. The only clearers are picking another Token or a hero, a drag, an Encyclopedia link, the fight panel opening, Escape, the X and an outside click; travel does not close it either. `TokenCard.test.js:414` covers Escape, the X and a mat click only. Not seen in the running game.
- **Fix sketch**: Close the card when its instance leaves the mat; on `TOKEN_TRANSFORMED` follow to the new id (the owner may prefer close). An eye-check only if it follows.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, with the list of what closes the card completed (folded in).
- **State**: open

### CR4-111  After a camp the player built is demolished, its enemies belong to no camp, and a new camp spawns a second set
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/SpawnerSystem.js:403-405`, `src/systems/board/Demolition.js:207-221`, `src/systems/board/EnemyMotion.js:106-117`, `src/systems/board/Camps.js:123`
- **What**: A spawned enemy is tied to its camp by the camp's instance id. Demolition removes the camp and nothing else. The re-attach pass skips any Token that has a tether at all and runs once per board, so the orphans never join another camp. Build a Goblin Camp, let it spawn three, demolish it and build another in the same place: the new camp counts none of the old goblins and spawns three more; a hero ordered to the new camp hunts only the new three.
- **Evidence**: `finish` calls `removeToken` and publishes; camp membership is `instance.tether === camp.id`. Built camps only (`recipe_build_goblin_camp`); map camps are fixtures and cannot be marked. `Camps.js` was read by search here, whole by the orders reader, who found a dead tether inert.
- **Fix sketch**: On a camp leaving the mat, clear its children's tethers (set to none, so the once-per-board attach or a small re-attach on camp arrival adopts them), or remove them with the camp: the owner's call if the second is preferred. Must not change: arrival enemies' deliberate `tether: null`.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. Read `Camps.js` whole, the three counting modes, every tether writer; a built Goblin Camp can be demolished.
- **State**: open

### CR4-112  Going back to a Region where an old event still stands wipes the progress toward the next event
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/events/EventClock.js:311-314`, `src/systems/events/EventClock.js:28-30`, `src/systems/atlas/Atlas.js:519-521`
- **What**: The guild has one event clock. On any tick where an event Token stands on the active mat, the clock is set to zero. An event left behind in Region A is frozen with it; the clock runs normally in Region B; popping back to A, where the old buff still has time left, zeroes 40 minutes of waiting on the first tick.
- **Evidence**: `if (eventTokenOnMat()) { s.clockMs = 0; return; }`. The header says an event on another mat "does not hold this mat's clock", true while away. `Events.test.js` has no travel case. Nothing sticks: the clock resumes when the Token leaves.
- **Fix sketch**: Hold the clock (return without adding) instead of zeroing it while an event stands, zeroing only when an event lands. Must not change: one event at a time, the saved wait.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. The event's own clock freezes with the board and comes back with time left.
- **State**: open

### CR4-113  An event's banner follows the guild to another Region and points at nothing
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/notifications/routing.js:156-172`, `src/systems/notifications/routing.js:199-203`, `src/systems/notifications/routing.js:211-217`, `src/systems/atlas/Atlas.js:531`
- **What**: The event banner is withdrawn only when the event ends. Travel publishes `GAME_RESET` with reason `travel`, which clears banners only for a new game or a dev board, and pruning runs only at a catch-up's end. So Rainfall's banner stays up in a Region where there is no Rainfall, and a second event can land beside it.
- **Evidence**: As cited. What a click on the orphan banner does (`useShowOnMat`) was not traced.
- **Fix sketch**: On `BOARD_SWAPPED`, withdraw banners whose subject Token is not on the new mat (the catch-up's pruning, reused); put them back on return if wanted.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. Banners never fade; no `BOARD_SWAPPED` subscriber prunes them.
- **State**: open

### CR4-114  An idle hero sent to a new waiting spot crosses the mat at half speed and reads as idle
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/HeroMotion.js:408-415`, `src/systems/board/HeroMotion.js:363`, `src/systems/board/HeroMotion.js:339`, `src/systems/board/HeroMotion.js:448-459`, `src/systems/board/Flags.js:675-684`, `src/systems/board/Flags.js:989`
- **What**: A hero who has waited more than a few seconds starts strolling, which halves their speed. A new spot order, or an order onto a Token they can only wait beside, does not clear the stroll: they walk the whole way at 60 units a second instead of 120, aimed at the new spot plus the old stroll offset, and the roster says idle, not walking. Dropped on a Token they can claim, they walk at full speed.
- **Evidence**: `speed = walkSpeed() * (body.limp ? LIMP_FACTOR : body.potter ? STROLL_FACTOR : 1)`; `body.potter` is set at `:412` and cleared only on a claim (`:327`), on coming off work (`:339`) or for a home body (`ensureBody`). `setOrder` calls `release` (returns early with no claim) then `HeroMotion.enter`. Once a first stroll has started `potter` is never null again for an idle hero (`:412` always draws a new offset), so any hero who has stood two to six seconds is affected. `HeroMotion.test.js:429-438` ("strolls go with the flag when it is moved") checks only the end point, and arguably makes the stroll offset carrying over intended: the defect is the half speed and the idle status, not the aim.
- **Fix sketch**: A new order walks at full speed and reads as walking until the hero reaches the new spot (clear or ignore the stroll for that walk in `enter` or `setOrder`).
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, noting the test that makes the carried stroll offset arguably intended (folded in).
- **State**: open

### CR4-115  Stopping a hero near the left or bottom edge puts their flag off the mat
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/Flags.js:817-820`, `src/systems/board/Flags.js:839-841`, `src/systems/board/Orders.js:118`, `src/systems/board/MatResize.js:92-98`
- **What**: Right-click stop turns the order into a spot at the hero's body minus the idle offset (72 left, 72 down), written with no clamp, unlike an ordinary spot order. Within 72 units of the left or bottom edge the flag lands outside the mat; after a reload or travel `fitToMat` pulls it in and the hero's waiting spot shifts.
- **Evidence**: `stop` passes `(at) => ({ x: at.x - dx, y: at.y - dy })` to `lapseWhereStanding`, which calls `BoardState.setFlag` directly. Whether the mat clips the drawn flag was not checked.
- **Fix sketch**: Clamp the point as `Orders.orderAt` does.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. `setFlag` does not clamp; only `Orders.orderAt` and `fitToMat` do.
- **State**: open

### CR4-116  A cycle can finish without its "cycle starts" moment: after a recipe change mid-cycle, and after travelling away and back
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/StationRecipe.js:66-74`, `src/ui/components/board/TokenCard.jsx:666-669`, `src/systems/board/BoardRunner.js:749-758`, `src/systems/board/BoardRunner.js:764-773`, `src/systems/atlas/Atlas.js:519`, `src/systems/board/Flags.js:258-269`, `src/systems/board/LoadoutMoments.js:98-104`
- **What**: `CYCLE_START`, the drink and work-potion dose, and On Work Start rules fire only when a Token's progress is zero. Two paths keep progress across a break that everything else treats as an interruption. (1) Changing a station's recipe mid-cycle keeps `cycleElapsedMs`: 15 s into a 16 s recipe, switch to an 8 s one, and it completes on the next tick as the new recipe (new inputs, new XP) with no start moment. (2) Travel freezes Tokens with their progress (pinned on purpose, `AtlasTravel.test.js:200-228`) and on return a hero claims without resetting it, so the first cycle back counts no drink and any hero finishes what another started. No gain was found (inputs are paid at completion); the cost is uncounted doses and missed start rules.
- **Evidence**: `setSelectedRecipe` writes `selectedRecipeId` and publishes `TILE_CHANGED`, nothing else. `BoardState.js:16` says progress is "reset by any interruption". Every other break (hero let go, wound, demolition mark and unmark, partial merge) resets it.
- **Fix sketch**: A recipe change resets progress; a claim on a Token with progress but no worker either resets it or fires the start moment for the new worker. Must not change: travel keeping a Token's progress if the owner wants it kept (then fire the start moment instead), a plain move keeping progress.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. Every `cycleElapsedMs = 0` site read; none on a recipe change or on a claim.
- **State**: open

### CR4-117  A partial merge resets the moved Token's work progress; a plain move keeps it
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/Placement.js:283-286`, `src/systems/board/Placement.js:304-317`
- **What**: `moveTokenTo` passes `keepCycle: true` because "a moved Token keeps its progress and carries its hero". When the move lands on a copy, some charges transfer and the leftover is nudged beside it, the leftover path calls `forfeitCycle(instance)` unconditionally: `placeTokenAt` hands a restock to `restock()` (`:182`) before its own `keepCycle` test (`:185`). Small, and the opposite of `moveTokenTo`'s own rule.
- **Evidence**: `forfeitCycle(instance); putOnMat(instance, from, decision.x, decision.y);` in `restock`, with no `keepCycle` test. `MatPlacement.test.js:352-367` covers the path without asserting on progress.
- **Fix sketch**: Honour `keepCycle` on the leftover path.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, with the cross-reference corrected (folded in).
- **State**: open

### CR4-118  Between kills a hero eats about twenty times live and about three in a catch-up, so the same fight can end differently while away
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / M / medium
- **Confidence**: reasoned
- **Where**: `src/systems/combat/CombatResolutionProcessor.js:54`, `src/systems/combat/CombatProcessor.js:38-52`, `src/systems/combat/CombatProcessor.js:71`, `src/systems/hero/RegenSystem.js:42`, `src/systems/hero/RegenSystem.js:56`, `src/systems/hero/ConsumptionSystem.js:101-106`, `src/systems/combat/CombatAttackProcessor.js:82-91`
- **What**: After a kill the hero is `idle` for the two-second rest, and while idle the regen handler lets them eat once per tick with no cooldown: 21 chances to eat live (100 ms ticks: the 20 of the rest and the first after it) and 3 in a catch-up (1,000 ms steps), each needing health under a quarter. A hero under a quarter health on a many-charge enemy (Cow, Thorn Elemental) or hopping between camp enemies climbs back live but starts the next fight still low in a catch-up, and may be knocked out, with the gear loss, only when the player is away. It also makes eating between kills free against the in-fight price of a skipped swing, which may be the intended rest.
- **Evidence**: As cited; regen HP itself is time-based and equal in both. Real food values against max HP at the levels where this bites were not checked, so the size is unmeasured.
- **Fix sketch**: Make out-of-fight eating time-based (one meal per fixed interval of game time), so live and catch-up agree. Changes the bench's work fingerprint for fighting scenarios; needs the owner's nod on the interval.
- **Hypothesis to test**: a fixed-seed fight scenario run at 100 ms and at 1,000 ms steps should show different food use and, at low health, a different knock-out count.
- **Verified by**: Opus verifier B (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed as a mechanism; count re-derived (21 against 3). Size in play unmeasured, so the finding stays reasoned.
- **State**: open

### CR4-119  The Abundance badge on a ripe Field shows a load the Field does not hold
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/EffectBreakdown.js:286-296`, `src/systems/board/Fields.js:164-173`, `src/systems/board/Fields.js:220-226`
- **What**: A Field's load is read once, as it ripens, and stored. The card recomputes it live. Place a Composter (Crop Load +1) beside a ripe Wheat Field holding 10: the card shows Abundance +1, the Field still gives 10. Demolish the Composter beside a Field that ripened with 11: the badge goes, the Field still gives 11. Every other row on the card is read live by the engine too; only this one differs.
- **Evidence**: `final = Fields.loadAtRipening(...)` in the breakdown; `loadAtRipening` documented "Read once, as it ripens". `EffectBreakdown.test.js` was not read.
- **Fix sketch**: The row shows the stored load for a ripe Field and the live one otherwise.
- **Verified by**: Opus verifier C (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. The only Abundance test uses an unripe Field.
- **State**: open

### CR4-120  A "for the cycle" potion effect stays on a hero whose cycle never finishes
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/LoadoutMoments.js:184-186`, `src/systems/board/LoadoutMoments.js:100`, `src/systems/effects/LiveEffects.js:358-370`, `src/systems/effects/LiveEffects.js:546`, `src/systems/board/Flags.js:248-256`
- **What**: A work potion's effect is ended by that Token's `CYCLE_COMPLETE` or by the hero's next cycle start. If the cycle never completes (the hero is recalled, the event node leaves on its hour, the Foundation is refunded), the effect stays listed on the hero until they start work somewhere else. Board readers filter by Token so it gives no bonus elsewhere; only the hero's effect list shows it today, and it counts again if the hero goes back to that same Token.
- **Evidence**: `release` does not end it; `syncAggregator` reads it without the `at` filter. Seven effects in `data/effects.json` use `forCycle` (the Birdwatcher potion and six drinks); none carries a combat number (loot, yield, XP and a bonus drop only), so the combat aggregator, which reads without the Token filter, picks nothing up from them today. A fight ending and a load do not end it either.
- **Fix sketch**: End a hero's for-the-cycle effects in `Flags.release`.
- **Verified by**: Opus verifier C (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, with the count of effects (seven) and the combat claim corrected (folded in).
- **State**: open

### CR4-121  A crash right after settling a place leaves it free of its arrival enemies for good
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/world/Settling.js:189`, `src/systems/world/Settling.js:221`, `src/systems/atlas/Atlas.js:340`, `src/systems/atlas/Atlas.js:534`, `src/systems/world/Arrival.js:196-208`, `src/systems/board/Occupation.js:25-34`
- **What**: Settling saves, pays, travels (which saves), and only then puts the arrival enemies down and marks the mat held; nothing saves after that. Until the next autosave (ten minutes by default, and it can be switched off) the save on disk is "travelled, paid, no enemies". If the game dies in that window (crash, power loss; a normal close saves), the reload finds a settled place with no encounter, for good.
- **Evidence**: Order of calls as cited; `isOccupied()` reads `board.arrival`, absent in that save.
- **Fix sketch**: Save once after `Arrival.occupy`, or occupy before the travel's save.
- **Verified by**: Opus verifier C (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. Every `SaveManager.save(` and `occupy(` call read; nothing saves after the enemies land and nothing re-occupies on load.
- **State**: open

### CR4-122  Reloading while a hero is mid-fight counts their elixir for the same enemy twice
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/board/BoardCombat.js:569-572`, `src/systems/board/BoardCombat.js:346-357`, `src/systems/board/BoardCombat.js:388-398`, `src/systems/board/Flags.js:1017-1035`, `src/systems/board/LoadoutMoments.js:181-183`, `src/systems/hero/ConsumptionSystem.js:185-212`
- **What**: Fights are not saved. On load the hero is stood back at the enemy, the first tick makes a new fight and publishes `COMBAT_ENGAGED` again, and the elixir counter takes one more fight off the dose, drinking a new elixir from the Bank at a dose boundary. The same second engagement happens in CR4-101's second defeat. Beside it, and written down as design (`BoardCombat.js:35-37`): the enemy returns to full health on load while the hero keeps their damage, so a fight the hero was winning when the game was closed can become a knock-out in the catch-up; worth one look by the owner as a ruling, not filed as a defect.
- **Evidence**: `FIGHT_START = 'COMBAT_ENGAGED'` (`ConsumptionSystem.js:112`); `hero.elixirFights[itemId] = left - 1` (`:208`), saved with the hero. A new fight starts `idle` and turns `active` on its first tick, which publishes the engagement. It is the same thing that happens when a hero walks away and comes back, a consequence of the reload rule at `BoardCombat.js:35-37` rather than a separate mechanism.
- **Fix sketch**: Count the elixir at the kill, or save a "counted for this enemy" mark on the hero cleared at the kill. The second engagement must still fire the elixir's rules: it is what puts back the for-the-fight effects a load strips (`Elixirs.test.js:260-269`).
- **Verified by**: Opus verifier C (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, reframed as a consequence of the reload rule, and the fix sketch corrected (folded in).
- **State**: open

### CR4-123  "Load as I left it" can go back further than the summary on screen says
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/core/CatchUp.js:397-398`, `src/ui/components/hud/CatchUpOverlay.jsx:37-41`, `src/ui/components/hud/CatchUpOverlay.jsx:47-52`
- **What**: While one "While you were away" summary is open, a second long gap (the PC sleeps) replaces the summary on screen, but the undo save stays the first one. The button then discards both absences and the play between them while the page lists only the second. A comment says keeping the first save is meant; the screen does not say what will be undone.
- **Evidence**: As cited.
- **Fix sketch**: The summary adds the two absences together (or says "since <time of the first save>") while the undo covers both.
- **Verified by**: Opus verifier C (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed. No test covers two shown catch-ups.
- **State**: open

### CR4-124  Rules the CMS can author today that the engine gets wrong (no shipped content reaches them yet)
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / M / low
- **Confidence**: verified
- **Where**: listed per item
- **What**: Shipped content uses little of the rule grammar: Thorns is the only board-event rule on a Token (the bosses' move rules run through the fight's own moments). The readers found these faults waiting for the first Token that uses the shape; each is a defect the day content arrives, and the content agent should know them before planning such Tokens.
  1. **Upkeep on anything but a standing buff is charged but not enforced**: an "Acts as anvil, consumes 1 Coal every 30 s" keeps acting when unpaid, and a triggered rule keeps firing; the only reader of "is it paid" is the ambient path (`src/systems/board/TileModifiers.js:435`, `src/systems/board/BlockUpkeep.js:52-90`, `src/systems/board/RecipeResolver.js:54`). Upkeep on an item's or Hall star's rule is never charged at all (`src/systems/board/BoardRunner.js:572`).
  2. **A buff filtered on "fewer than N charges" or "whose hero carries X" is worked out once and not refreshed** when charges or the loadout change, unless a board-reach rule is on the mat (the "being worked" filter is refreshed correctly) (`src/systems/board/TileModifiers.js:320-330`, `:732-740`).
  3. **An upkeep naming the same item on two lines pays half and counts as paid** (`src/systems/board/BlockUpkeep.js:73-81`; the spawner path sums by item, `src/systems/board/SpawnerSystem.js:317-320`).
  4. **"On Cycle" and "a neighbour completes a cycle" rules miss the cycle that uses a Token up**: the Token is removed before `CYCLE_COMPLETE` is published, with no point or instance in the payload (`src/systems/board/BoardRunner.js:420`, `:430`, `src/systems/board/TriggerSystem.js:465-469`, `:503-504`).
  5. **A second rule on one moment still runs on a Token the first rule just replaced**, paying from the discarded instance and announcing a depletion where the new Token stands (`src/systems/board/TriggerSystem.js:474-483`, `:506-510`, `:387`).
  6. **"On Bank Holds" fires only when the Bank moves**, not "while the Bank holds" as its hint says: nothing re-checks when the cooldown ends (`src/systems/board/TriggerSystem.js:517-527`, `src/config/registries/triggerRegistry.js:356`); and on load it is evaluated before the board's own load handler has run (`src/systems/progression/GuildUpgradeManager.js:213`; no harm shown).
  7. **A `Transforms` aimed at another Token lets the bearer off its charge** (`src/systems/board/TriggerSystem.js:291-293`, `:385`).
  8. **A rule-driven `Transforms` or `Spawns here` drops what makes a Token special** (`event`, `arrival`, `builtFrom`), a `Spawns here` announces nothing for the Tokens it removes, and neither waits for a Token in the player's hand (`src/systems/board/EffectActions.js:396-407`, `:321-322`).
  9. **Swing timers fire at most once per tick**, so a swing faster than one second would halve in a catch-up and then burst live (`src/systems/combat/CombatProcessor.js:79`, `src/systems/combat/CombatAttackProcessor.js:191`); the fastest swing shipped content can reach is exactly 1,000 ms (a fast enemy under Enrage), while the engine's own range allows 500 ms (`src/config/FormulaRegistry.js:180`).
  10. **An effect carried both "for the fight" and "for a while" loses the longer life at the kill** (`src/systems/effects/LiveEffects.js:194-206`, `:333-344`).
  11. **A flag judges "inputs available" without the candidate hero's own Efficiency**, so a hero carrying a cost cut is passed over for a station they could afford (`src/systems/board/Flags.js:388`, `src/systems/board/WorkCheck.js:136`, `src/systems/board/InputCost.js:52-55`, `src/systems/board/TileModifiers.js:1063-1067`, which reads the Token's current worker); no `INPUT_COST` rule exists in `data/`.
  12. **With "no stacking" on, an unpaid or filtered-out copy still blocks a later copy** (`src/systems/board/TileModifiers.js:402-435`); the flag is off everywhere.
  13. **A water authored with bait-only pools would pay XP for a cycle that catches nothing** (`src/systems/board/Fishing.js:80-83`, `src/systems/board/BoardRunner.js:318-321`).
- **Evidence**: Each reader checked `data/` for the shape and found none (`effects.json`, `tokens.json`, `items.json`, `hallStars.json`, `skillPerks.json`).
- **Fix sketch**: Not one fix. Either a content audit rule per item (the cheap guard: `ContentAudit.js` refuses or warns on the shape until the engine supports it) or the engine fix when the first Token needs it. Items 1, 4 and 6 are the ones a planned Token is most likely to meet.
- **Verified by**: Opus verifier C (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed, item by item: 8 confirmed as written, 5 with corrections (folded in); `data/` scanned for each shape and none found.
- **State**: open

### CR4-125  Travel can put a quest bounty on top of another Token
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: reasoned
- **Where**: `src/systems/atlas/Atlas.js:472-481`, `src/systems/atlas/Atlas.js:484-497`, `src/systems/board/MatPlacement.js:422-442`, `src/systems/board/MatResize.js:72-90`
- **What**: Tokens that travel with the guild (the Hall, quest bounties) are put down in the new Region at a remembered spot with no check, or by a whole-mat search that falls back to the raw aim point when the mat has no spot (`findSpotAnywhere(...) || aim`). So a bounty with a remembered spot can be dropped onto one placed a moment earlier by the search, and on a mat with no legal spot left a bounty lands on whatever stands at its aim. It cannot end outside the mat: `fitToMat` runs right after and pulls it in, at worst overlapping. Needs three Regions in a particular arrival order, or a full mat; reach in real play not established.
- **Evidence**: `putDown` uses the remembered spot with no check (`Atlas.js:473-476`); `findSpotAnywhere(...) || aim` (`:478`). `QuestTokens` does not re-seat bounties afterwards.
- **Fix sketch**: Check the remembered spot with `isLegal` before using it, and fall back to the search.
- **Verified by**: Opus verifier C (read-only, given the finding's text only), 2026-11-15: traced each scenario in the code and `data/` trying to refute it; confirmed for stacking; the "off the mat" half was REFUTED (`fitToMat` runs after) and removed. Reach in play not established, so reasoned.
- **State**: open

---

## Notes (leads without a finding)

- **A zero-length tick would fire "cycle starts" twice** and count a second drink dose (`src/systems/board/BoardRunner.js:749-758`; `TimeManager` floors the delta at 0 but allows 0). `performance.now()` is monotonic, so it needs two timer callbacks in one timestamp; not shown to happen.
- **Token ids are a millisecond plus five random characters** (`src/systems/board/BoardState.js:64-66`), and a second object with the same id silently replaces the first (`:334-335`). Estimated well under 0.1 % per full-day catch-up on a tree-heavy mat; grows with id churn.
- **A Token let go just off the mat moves to the nearest edge** rather than cancelling (`src/ui/dnd/DndKit.jsx:136-162`, `src/systems/board/Placement.js:168`); the Shop path refuses the same drop. Probably a design call for the owner, not filed.
- **A hero knocked out by a status while standing at the Hall is not greyed** until a reload (`src/systems/board/Flags.js:777-779`, `src/systems/board/HeroMotion.js:383-386`); whether a status can outlast the walk home is unverified.
- **A buff arriving mid-growth hands the overshoot to the next stage** (`src/systems/board/TimedChanges.js:449-459`, `:487-490`): consistent with thresholds read live; noted so nobody is surprised.
- **A Token emptied while in the hand, saved in that moment, stays at 0 charges after a reload** (`src/systems/board/Charges.js:107-112`): the deferred removal is runtime only. Needs a save during a drag.
- **The catch-up's set-up runs before its `try`** (`src/systems/core/CatchUp.js:340-345`): a throw there would leave the loop stopped until a reload. No thrower found.
- **A spawner's "no room" note is reset on travel but not on load** (`src/systems/board/SpawnerSystem.js:574-587`): a second load in one page session is not reachable in the shipped UI (every load reloads the page), so moot.
- **Marking a camp for demolition turns its hunters into its demolishers, ending a fight mid-way** (`src/systems/board/Camps.js:41-52`): stated as the rule in the file, read as design.
- **Already ticketed and seen again**: T-325 (a hero arriving mid-step in a catch-up is credited the whole second), T-315 (a crowded fight stepping onto Tokens or water), T-308 (a crowded Forest's Saplings; CR4-106 adds a mechanism), T-361, T-077, T-358, T-407.

## What the readers found sound (so nobody re-checks it)

- **The work cycle.** No path completes without paying, pays without producing, spends a charge twice, finishes two cycles in one step or loses the remainder (cycle time is floored at 1,000 ms; the leftover carries by Token and by hero). Room, charges and inputs are all checked before anything is spent, and every early return leaves progress full. `WorkCheck` and the cycle agree on inputs and charges for the hero on the Token. XP, tool wear, drinks and bait are each applied once.
- **The Token list during the tick** is a frozen snapshot replaced on any membership change; a Token removed mid-pass is skipped, one added is first ticked next tick. Nothing outside `BoardState` writes `board.tokens`, and nothing changes a type or an id in place.
- **When a Token leaves**, every engine-side holder is cleaned in the tick or by an untagged engine listener (heard in a catch-up): order pins, claims, saved work notes, fights, fight-room steps, tethers and the spawner census, alerts, clocks, carry maps, neighbour and modifier caches. No stuck hero, no blocking claim, no clock throwing in the tick, no spawner child counted for ever.
- **Load, travel, catch-up, undo.** Every module-level store in the board, effects, events, quests, hero and combat folders was listed with what resets it; all are keyed on the board object (a load and travel both install a new one), rebuilt on `GAME_LOADED` / `BOARD_SWAPPED`, or harmless. A second load in one page session is not reachable in the shipped UI. No mat rule reads the wall clock; every Token clock is delta-based, so a frozen Region resumes exactly. No engine rule depends on a mounted component or a UI-tagged event. Listeners are not doubled.
- **Placement and geometry.** The room searches cannot return NaN, an off-mat point, an occupied point or forbidden ground; a push never moves a landmark, the Hall or a placed Token; the failed-search memo, the neighbour cache and its move journal are exact across remove-and-add, travel and load. The Shop cannot be made to place without paying, pay without placing, or refund more than was paid. The mat cap counts right.
- **Orders and walking.** Two heroes cannot claim one Token; a claim on a Token gone, moved out of reach or marked is released the next pass with the matching skip, so no flip-flop and no starvation; walking cannot overshoot, stall one step short or produce NaN.
- **Fights.** A kill is paid once and a defeat resolved once (except CR4-101's re-entry); loot of a last-charge kill lands before the Token leaves; HP is clamped; a dead or downed fighter does nothing; statuses come off on every fight end; Burn's three ticks deal three times; the three-second clock fires once per 3,000 ms at either step size.
- **Clocks.** Growth, regrow, refill, spawner, upkeep, bounty and event clocks advance by delta, carry their overshoot, hold when blocked and neither double-fire nor lose time at 1,000 ms steps. Spawner upkeep is paid only after the child lands.
- **Buff caches.** Every Token add, remove or move rebuilds buffs at both ends, in quiet mode too; the grow-time, gate and neighbour caches invalidate on every change that can alter their answer for the rule shapes that exist in content; the tooltip and the engine use the same walk, base and floors for every row but CR4-119.
