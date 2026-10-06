# Gap Analysis: `playmat_grid_concept.md` §10 vs the Codebase

**Written:** 2026-08-06, on `rework/playmat-7x7-grid`.
**Purpose:** verify §10's port inventory against the actual code *before* the
roadmap is written. Per `playmat_roadmap_brief.md` §5.

**Baseline confirmed:** `npx vitest run` → **39 files, 563 tests, 563 passing,
12.15s.** App version **0.4.2**; save-schema version **0.5.0**.

**One factual correction to the brief itself:** it says the design branch is
*five* commits ahead of `main`. It is **twelve** (`git log --oneline main..HEAD`).
`main` has nothing this branch lacks, so the recommendation to branch from here
is unaffected.

---

## How to read this

Every claim below was checked by opening the file named. Verdicts:

| | Meaning |
| :--- | :--- |
| ✅ **Holds** | The claim is accurate. Port as described. |
| ⚠️ **Holds with a catch** | Broadly right, but something material is missing from the claim. |
| ❌ **Wrong** | The claim does not match the code. |

---

## 1. The headline: three findings that change the plan

Before the itemised audit, these are the three that actually move work around.

### 1.1 ❌ Two of the three hero→board effects do not exist

§4.2 (D-67) says the board depends on three hero properties: **Speed**,
**Access** and **Efficiency**. §10 treats heroes as a survivor, so this reads as
"already built".

| Effect | Reality |
| :--- | :--- |
| **Access** (skill gates work) | ✅ Exists. `RequirementRegistry.js` handlers `skillrequirement` / `heroslot` → `SkillSystem.meetsRequirement`. |
| **Speed** (higher skill → faster) | ❌ **Does not exist.** |
| **Efficiency** (fewer inputs consumed) | ❌ **Does not exist.** |

This is not a near-miss. There are *two independent* reasons a hero's skill
cannot currently affect work speed:

1. **Nothing reads it.** `HeroRehydration.updateHeroSkillModifiers()`
   (`src/systems/hero/logic/HeroRehydration.js:74`) dutifully writes a `SPEED`
   modifier per skill onto `hero.aggregator`. But
   `StatProcessor.calculateWorkcycleStats()`
   (`src/systems/cards/logic/StatProcessor.js:40`) consults `card.aggregator`,
   the area aggregator and the global aggregator — **never `hero.aggregator`**.
   The comment on line 52 says "Local Modifiers (from heroes, equipment…)", but
   nothing ever puts a hero modifier on a card's aggregator.
2. **It would not match if it did.** Those modifiers target
   `{ category: skillId.toUpperCase() }` — `'NATURE'` — while the lookup key is
   the card's lowercase `trait.skill` (`'nature'`). The equality check fails,
   and the parent-of fallback fails too because `nature` is itself a parent
   skill.

`SkillSystem.getEffectiveLevel()` is likewise still the stub it was written as:
`// TODO: Integrate with ModifierAggregator when those systems exist`.

**Efficiency** has an axis (`INPUT_COST`, consumed by `WorkProcessor` and
`CardPreflight`) but the only thing that has ever fed it is a stamped card
mutator. No hero, class, trait or piece of gear registers on it.

**Consequence for the plan:** "a hero on a Token makes it go faster and cost
less" is a **build**, not a port. It is small — a hero-aggregator lookup in
`StatProcessor`, a category-casing fix, and a formula — but it must be a
scheduled phase, not an assumed freebie. Without it, hero skill level does
nothing on the board except open doors, and the whole levelling loop reads flat.

### 1.2 ❌ "Retreating heals" — heroes already regenerate mid-fight

§8.1 and D-136 both state: *"`RegenSystem` already regenerates HP for **idle**
heroes, and a hero pulled off a Token is idle — so retreating a wounded hero
*is* the healing mechanic."* Risk 14 was **closed** on this basis.
`playmat_hero_concept.md:134` repeats it.

`src/systems/hero/RegenSystem.js:64`:

```js
// Allow regen for 'idle', 'working', and 'combat' statuses
if (hero.status !== 'idle' && hero.status !== 'working' && hero.status !== 'combat') continue;
```

Heroes regenerate at the **same rate while fighting** as while idle. Retreat
therefore confers **no healing advantage whatsoever** today.

This matters more than a one-line fix, because §8 leans on it. The whole "combat
is the active half, inattention has a price" pillar (D-130) assumes withdrawing
is a meaningful tactical act. Right now the only difference between retreating
and standing there is that the enemy stops hitting you — which is real, but it
is not "retreat is the healing mechanic", and it is not a reason to close risk
14.

Related: **voluntary retreat does not exist.** `card.isFleeing` is *read* in
`CombatProcessor.js:98,101` and **never written** anywhere in `src/`. D-130's
"the player can pull a hero off an enemy at any moment and the fight ends
immediately" is unbuilt.

### 1.3 ⚠️ The adjacency buff the design actually needs has no delivery path

§10.3 frames the modifier rebuild as "keep the maths, swap the targeting". The
maths genuinely is keepable (see §3 below). But the claim understates the job,
and there is a code-verified audit in the repo that already says so —
`buff_diversification_orientation.md` (written 2026-08-01, §3):

| Axis | Consumed by | Reachable from |
| :--- | :--- | :--- |
| `SPEED` | `StatProcessor` | Card + Area + Global |
| `YIELD` | `LootSystem` | **Card only** |
| `WORK_TIME` | `StatProcessor` | **Card only** |
| `INPUT_COST` | `WorkProcessor`, `CardPreflight` | **Card only** |
| `DAMAGE`, `DEFENSE` | `StatProcessor` | **Hero only** |
| `XP_BONUS`, `LOOT_MULT`, `FAIL_CHANCE`, `HP_REGEN`, `THORNS_REFLECT`, `STAT_BONUS`, `LOGIC_OVERRIDE` | — | **nothing reads them** |

**SPEED is the only axis that crosses scopes.** Everything the board's adjacency
system is *for* — a Sawmill nudging a Forest's **yield**, a Tool Rack cutting a
Forge's **input cost** (§3.3, D-119/D-120) — is on an axis that is card-local
only. "Replace `loop`/`next_card` with the 8 neighbours" gets you an aura
delivered to the right tiles; it does **not** get you an aura that can move
yield, because the yield resolver never consults anything but the Token's own
aggregator.

I confirmed the dead-axis half independently: `SkillSystem.getXpMultiplier()`
queries `EFFECT_TYPES.XP_GAIN`, which **does not exist** in
`src/systems/effects/constants.js` (the constant is `XP_BONUS`). It is
`undefined`, matches nothing, and the function always returns `1.0`.

**Consequence for the plan:** the adjacency phase has two halves that were
budgeted as one — (a) route effects to the 8 neighbours, and (b) widen
yield/cost/time so a neighbour can move them. The second half is the one that
makes Context and Buff Tokens work at all.

---

## 2. §10.2 "Survives" — claim by claim

### ✅ The global item Bank and the item economy

`InventoryManager` / `InventoryStore` / `InventoryGroupManager` /
`CommerceSystem` / `TransactionProcessor` are area-agnostic and stand alone.

**One rule conflict, and it is load-bearing.** D-138 says *"Nothing is ever lost
to a full Bank"* — an item with no slot stays on the board as a sprite. Today,
`InventoryManager.addItem()` (line 42) **returns 0 and destroys the item**:

```js
if (usedSlots >= maxSlots) {
    NotificationSystem.warning(`Bank is full — no free slot for ${template.name}`);
    return 0;
}
```

The current mitigation is the opposite of D-138: `CardPreflight` **refuses to
run the cycle at all** if the output has nowhere to go (`CardFailure.test.js`
pins this across 24 tests). D-138 inverts that — run the cycle, drop the loot on
the floor. So the Bank survives, but Bank-full behaviour is a rewrite, and the
loot-sprite layer (§2.6 below) is its prerequisite, not a cosmetic extra.

Also worth knowing: D-137 says *"stacks are never capped; slots are"*. Slot caps
are real (`maxSlots`, default 20, raised by `bank_slots`). Stack caps also
exist, but `DEFAULT_MAX_STACK` is `1e12`, so in practice the design already
holds. The `stack_size` guild upgrade (`maxStackBonus`, +50/rank) is therefore
buying a rounding error on a trillion and should probably be retired.

### ✅ The 7-stat combat engine — genuinely portable

`CombatProcessor.processCombat(card, trait, delta)` takes a card-like object, a
hero and an enemy. It reaches into `HeroManager`, `CombatFormulas`,
`StatusEffectSystem` and `CombatAttackProcessor` — **not** into area or deck
state. Swapping "card instance" for "Token instance" is a genuine port.
`CombatResolutionProcessor.handleVictory` publishes `combat_victory` and
`LootSystem` picks it up; also area-agnostic.

Two bonuses I did not expect:

* **D-103's post-kill rest already exists.** `handleVictory` sets
  `combat.state.intermissionTimer = 2000`, and `processCombat`'s intermission
  branch restores the enemy to full HP and resumes. That is exactly the
  "fight duration + a fixed rest, enemy respawns in place" model the board wants.
  Today the deck loop *pre-empts* it by advancing the slot; on a board, you
  simply stop pre-empting it and the behaviour is already correct.
* **D-74's equipment loss on defeat exists** — `LoopRunner._applyDeathPenalties`
  (`DefeatPenalties.test.js`, 9 tests). The *rules* port; the *harness* is
  inside `LoopRunner` and needs re-homing.

**The catch:** the only thing that currently ticks combat is
`LoopRunner._tickCombat`. There is no standalone combat tick handler in
`EngineBootstrap._registerTickHandlers()`. Combat must get its own tick, or the
new board runner must own the hand-off. (Historical note: the header comment in
`LoopRunner.js:81` still refers to "systems/combat/CombatTickProcessor, a dormant
parallel implementation" — that file **no longer exists**. The dead-processor
problem the previous gap analysis caught was already cleaned up. The comment is
just stale.)

### ✅ The status-effect engine

`StatusEffectSystem` has its own tick handler on the 5s clock, is registered
independently in `EngineBootstrap`, and imports nothing loop-shaped except
`AREA_EVENTS` for notification routing. Ports cleanly. 10 tests.

### ⚠️ Heroes and their 9-slot equipment grid

**The "9 slots" number is correct** — `GRID_SLOT_COUNT` in
`equipmentCategories.js`, nine generic slots rendered 3×3, constrained by
per-category caps rather than slot position (D-7/D-55). §10.2 is right and any
memory of "six slots" is out of date.

**But "equipment survives" oversells what equipment currently does.**
`EquipmentManager.applyEquipmentModifiers` registers modifier types that mostly
have no consumer:

| Type written | Consumers found outside `EquipmentManager` |
| :--- | :--- |
| `ACCURACY` | 1 |
| `RESIST_FLAT` | 2 |
| `TICKSPEEDBONUS`, `SKILL_LEVEL`, `SLOW_ENEMY`, `SUNDER`, `EVASION`, `LIGHT`, `HASTE`, `HPBONUS` | **0 each** |

Only `DAMAGE` and `DEFENSE` reliably reach the fight. So a "port equipment
unchanged" phase ports a system where most gear effects are silent no-ops. That
is fine as a decision — it is out of scope this pass — but it should be a
*stated* deferral, not a surprise found while authoring the first Map's kit.

**Classes and traits are already cosmetic.** `HeroGenerator.js:119` says so
explicitly: `// Classes/traits are cosmetic — no modifiers applied.` This
**defuses a contradiction I was going to flag**: §10.1 lists "Hero traits" as
*deleted*, while the brief §4 and `playmat_hero_concept.md:11` say traits *ship
unchanged*. Both are arguing over a display label with zero mechanical effect.
Keeping or cutting them costs nothing either way — pick one and move on.

❌ **A related claim in the hero spec is simply wrong.**
`playmat_hero_concept.md:116` says *"the existing 90 class perks re-home onto the
job tree; the 90 trait perks re-home onto skill milestones. All 180 survive."*
There are **9 classes and 9 traits** (`classRegistry.js`, `traitRegistry.js`),
each with three bonus-skill names and one modifier — and the modifiers are not
applied. There are **no 180 perks to re-home.** That is a content-authoring job
of unknown size, not a migration. (Out of scope this pass, but the hero session
should not be planned against a number that is off by 10×.)

Bonus finding while checking: trait/class `bonusSkills` reference `industry`,
`crafting`, `nautical`, `culinary` — **none of which are skills.** The 15 are
melee, ranged, magic, defense, labor, aquatic, nature, forge, cooking, alchemy,
science, occult, crime, explore, social. Dead data, harmless while cosmetic.

### ⚠️ Guild Upgrades, re-homed to the Guild Hall tile

The **mechanism** survives cleanly: ranks in `progress.guildUpgrades`, every
derived stat *recomputed* from rank (never incremented), idempotent on load.
That is a good design and it ports.

**The tree's contents largely do not.** Of 14 nodes in `guildUpgrades.js`:

| Node group | Count | Fate |
| :--- | :--- | :--- |
| `bank_tabs`, `bank_slots`, `stack_size`, `roster_size` | 4 | ✅ Survive (`stack_size` is arguably pointless, see above) |
| `quest_slots` | 1 | ⚠️ Quests "may be cut" (§12) |
| `universal_rest` (grants a Universal card) | 1 | ❌ Dies — universals are a deck concept |
| `outpost_slots` (grants Outpost banners) | 1 | ❌ Dies |
| 7 × `outpost_*` (grant station cards) | 7 | ❌ Die |

So **9 of 14 nodes go**, and `GuildUpgradeManager` itself carries deck-loop
logic that must come out: `_ensureOutpostBanners()` calls into `OutpostManager`,
`recompute()` writes `collection.universals` and `collection.playsets`, and
`purchase()` gates on `collection.unlockedAreaSets` (areas, deleted).

**And §11's four tracks are not what exists.** The design asks for Storage /
Roster / Aura / Economy. Storage and Roster exist. **Aura and Economy do not
exist at all** — and Aura (D-121, bonuses to the Guild Hall's 8 neighbours) is
blocked on the adjacency-delivery work in §1.3.

### ⚠️ The card *schema and execution model*, which becomes the Token model

This is the claim I'd most want the owner to look hard at, because it is the
largest single line item in the plan and it is doing a lot of work in one
sentence.

**What genuinely ports:**

* The authored **JSON schema** is a good fit. A task card is already
  `{ id, name, cardType, preset, config: { skill, subskill, baseTickTime, xp,
  inputs, outputs }, effects: [...] }`. Rename `baseTickTime` → cycle time, add
  `uses`, and it is a Token definition. Cycle timings already sit in D-164's
  10–30s band (4000–6000ms in `whispering_woods.json`).
* The **composable effect list** (D-60, `effectRegistry.js`) is exactly the right
  shape: `work_output`, `hazard`, `restore`, `buff`, `combat`, `token_stamp`,
  each with a phase and a validator. Adding a Token behaviour is authoring plus a
  resolver. 31 tests. Keep.
* The **flyweight + ephemeral instance** pattern is *precisely* what §3 asks for
  ("a Token is a card definition plus board state — the registry holds the type;
  a light instance holds position, uses remaining, and which hero is on it").
  `CardFactory.createInstance()` already builds that instance.

**What does not port, and is not mentioned:**

* ❌ **Input handling is the wrong shape.** D-24 says *"Inputs are pulled
  automatically from the global Bank."* The current model requires the player to
  **manually assign an item to each input slot** — `card.assignedItems[slotIndex]`,
  validated by the `inputslot` / `dynamic_inputslots` handlers in
  `RequirementRegistry.js`, consumed by `WorkProcessor.consumeInputs()`. There is
  also `card.stack` (items physically dropped onto a card). None of that has a
  place on a board where a Forge just takes coal from the Bank. `consumeInputs()`
  is ~100 lines and roughly all of it is assignment plumbing.
* ❌ **`completeWorkCycle()` carries deck-era passengers**: tool durability
  (`card.assignedToolId` → `decrementDurability`, retired by D-118), Project
  cards, quest-selection cards, the `card.stack` fallback. This is a trim, not a
  port.
* ⚠️ **The trait bag.** Execution dispatches on `card.traits[]` (`workcycle`,
  `combat`, `loot`, `inputslot`, `toolslot`, `unifiedreward`, `applystatus`,
  `quest_selection`) assembled from presets by `CardAssembler`/`ModularSyncer`.
  It works and it is tested — but it is a second, older dispatch mechanism
  sitting *underneath* the newer effect list, and the roadmap has to decide
  whether the Token model keeps both or collapses onto one.

**My read:** "the execution model survives" is true of the *skeleton* — flyweight
definition, ephemeral instance, timer, complete-and-pay. It is not true of the
*input and tool layers*, which are roughly half of `WorkProcessor` and
`RequirementRegistry` and which the board explicitly replaces. Budget this as
"port the cycle engine, rewrite input resolution", not as "port".

### ✅ The nav bubble menu, drawers and inspection panel

`BubbleMenu.jsx` (131 lines) is a generic dock of bubbles; only the entries
change. `BottomFolderDrawer` / `TabStrip` / `InspectionPanel` are generic
containers with no area coupling. `BankTab.jsx` (579 lines) is the Bank UI and
survives. §10.2 is right.

### 🎁 Two survivors §10 does not mention, both valuable

* **The drag-and-drop system.** `src/ui/dnd/` — a pointer-tracked dnd-kit layer
  with an animated ghost, "bloom on cross-over" between drawer and board
  surfaces, spring-back on a miss, per-target `accepts()`/`onDrop()`, and SFX.
  It already has a `board` surface concept and `CARD | HERO | ITEM` payload
  kinds. The board needs a `TOKEN` kind and 48 drop targets. **This is the
  single biggest head start in the codebase** for a design where "drag is the
  only verb" (risk 8), and §10 does not list it.
* **Playmat art already exists.** `public/assets/playmat/` holds 26 files, and
  `sprite-manifest.js` registers 20 `pm_board_*` tile sprites (guild hall ×5,
  forest ×4, mountain ×6, farmland ×3, village ×1) plus table backgrounds and
  per-skill test tiles. `tileRegistry.js` (192 lines) still maps them. Leftovers
  from the *previous* spatial playmat — which means the worst-case full-board
  mock (risk 7) can be built against real art immediately, not against grey boxes.

---

## 3. §10.3 "Requires Rebuilding" — claim by claim

### ✅ Keep `ModifierAggregator` and the Three-Bucket maths

Verified. `ModifierAggregator.js` imports only `constants.js` and
`skillRegistry.js`. Nothing deck-shaped. `applyThreeBucket`,
`combineMultipliers`, `combinePercentages`, `resolveAxis` are all pure. 26 tests
pin the rules in `Mutators.test.js` Phase 1. Keep verbatim.

### ✅ `LoopBuffs.js` dies

Correct. Its entire vocabulary is `EFFECT_REACH.LOOP` ("until the loop wraps")
and `EFFECT_REACH.NEXT_CARD`, keyed by slot index. Nothing survives the deck.
18 tests go with it.

### ⚠️ `AreaModifiers.js` dies — but its sibling was left off the list

`AreaModifiers.js` (45 lines) is a `Map<areaId, ModifierAggregator>`. Yes, it
dies. But §10.3 does not mention **`GlobalModifiers.js`** (76 lines) — the
guild-wide aggregator, the *only* scope that currently proves an aura can reach
across the game. It carries the additive-stacking source-id discipline (D-23)
that any board-wide upgrade will need, and `normalizeAuras()` for one-or-many
authoring. It is also the pattern the Guild Hall's **Global** upgrade reach
(D-121) should copy.

**Recommendation:** keep `GlobalModifiers.js` (renamed), delete `AreaModifiers.js`,
and add a new per-tile scope. That is three scopes → two, not three → one.

### ❌ The `EFFECT_REACH` claim is right but incomplete

Correct that `loop`/`next_card` must become "the 8 adjacent tiles". Incomplete
because — see §1.3 — retargeting alone will not let a Context Token change a
neighbour's **yield** or **input cost**. Those resolvers only ever read the
Token's own aggregator. Both halves belong in the same phase.

### ❌ The "Token" name collision — `TokenAxes.js` must NOT retire

§10.3 groups `TokenRegistry.js`, `SlotTokens.js` and `TokenAxes.js` as one
card-mutator system that "most likely retires with the loop". Two of the three,
yes. The third is a mistake:

| File | Verdict |
| :--- | :--- |
| `src/config/registries/TokenRegistry.js` (213 lines) | ❌ **Retires.** Card-mutator definitions. Frees the name. |
| `src/systems/effects/SlotTokens.js` (346 lines) | ❌ **Retires.** Stamps onto deck slot indices, wiped at the Cycle boundary. |
| `src/systems/effects/TokenAxes.js` (65 lines) | ✅ **KEEP.** |

`TokenAxes.js` is **generic** — `resolve(aggregator, effectType, base)`. It is
the *only* consumer path in the game for `YIELD`, `WORK_TIME` and `INPUT_COST`,
and it owns the hard floors (`MIN_WORK_TIME_MS = 1000`, `MIN_INPUT_COST = 1`). It
is called from `LootSystem`, `StatProcessor`, `WorkProcessor` and `CardPreflight`
— none of which are dying. Deleting it deletes the yield/cost/time consumers the
board's whole economy depends on. Rename it (`EffectAxes.js`) and keep it.

`MutatorStamping.js` (149 lines) and `CardTokenOverlay.jsx` also retire with the
mutator system.

**On the freed name:** the collision genuinely clears. D-78's alternatives
(**Mark**, **Sigil**, **Condition**) are not needed — nothing wants the stamped-
modifier concept on the board, because context adjacency does that job spatially.

### ✅ The CMS

Not audited beyond confirming the warning is real and already recorded in
`cms_rework_concept.md` / project memory. ⚠️ "Sync to Game" destroys unmodelled
content. Keep it away from hand-authored Token JSON.

---

## 4. Things §10 does not classify at all, which are real build work

None of these are in §10.1/.2/.3. Each is a genuine subsystem the slice needs.

| # | Missing from §10 | Why it matters |
| :--- | :--- | :--- |
| A | **The 7×7 board itself** — grid state, 48 tiles, occupancy, 8-neighbour adjacency, displacement (D-134/D-143/D-147) | Zero code exists. `tileRegistry.js` is art only. |
| B | **The loot-sprite layer** (D-40/41/42, D-158) | Loot currently goes **straight to the Bank** via `TransactionProcessor`. No sprite, no floating layer, no grab-and-place, no "pull inputs from a sprite" (D-42). **D-138's overflow rule depends entirely on this.** Only `ParticleOverlay.jsx` exists, and it is decorative. |
| C | **The Tray** (D-86/D-107, D-168) | Explicitly "load-bearing" in §3.4. Nothing like it exists. |
| D | **The Token Bank** (D-137) with **consolidation** (D-77) | The item Bank exists; a *Token* bank with partial-charge repacking does not. |
| E | **The Cartographer and Maps** (D-98/D-99/D-155/D-166) | Nearest existing thing is `CollectionManager`'s booster packs + `PackOpeningOverlay.jsx` (292 lines) — but that is *per-area escalating price, pick-1-of-N*, and Maps are *flat within-theme price, burst of 3–6, all of it yours*. The overlay and the purchase plumbing are reusable; the mechanic is not. |
| F | **Managers** (D-35/D-104/D-140/D-151) | New. Note D-151 (restock *under* a working hero, who resumes automatically) has no analogue in any current system. |
| G | **Token depletion / charges** (D-176) | The nearest existing thing is item durability — which is being *deleted* (D-118). `DurabilitySystem.js` (71 lines) retires; charges are new. |
| H | **Voluntary retreat** (D-130) | `isFleeing` is read, never written. See §1.2. |
| I | **Hero speed & efficiency** | See §1.1. |
| J | **Adjacency-reachable yield/cost** | See §1.3. |

**Order-of-magnitude read:** §10 frames the rework as mostly port-with-some-
rebuild. The honest split is closer to **half port, half greenfield** — with the
greenfield half (board, tray, sprites, banks, maps, managers) being most of what
makes the slice *feel* like the design, and therefore most of what has to exist
before "is the board fun?" can be answered at all.

---

## 5. Test-suite audit

**Baseline: 39 files / 563 tests / all green.** The brief is right that "tests
green" becomes hollow as suites vanish. Here is what actually vanishes.

### 5.1 Dies outright — tests the deleted system (13 files, 166 tests)

| File | Tests | Covers |
| :--- | ---: | :--- |
| `BinderManager.test.js` | 23 | Per-area binders |
| `DeckSlotRules.test.js` | 18 | Deck slots, copy limits |
| `CollectionManager.test.js` | 18 | Booster packs, playsets, per-area price curve |
| `LoopBuffs.test.js` | 18 | `loop` / `next_card` reach |
| `GuildTreeOutposts.test.js` | 16 | Outpost grants in the guild tree |
| `OutpostBanners.test.js` | 13 | Outpost banners |
| `GlobalAuras.test.js` | 12 | Outpost auras, `StationSlotManager` |
| `BinderMastery.test.js` | 11 | Mastery bonuses |
| `LoopRunnerFlow.test.js` | 11 | The loop state machine |
| `PrepPhase.test.js` | 9 | The Prep Phase |
| `CardPips.test.js` | 9 | Binder copy pips |
| `CraftingUpkeep.test.js` | 7 | Outpost craft energy |
| `LibraryFoundation.test.js` | 6 | Area sets / library |
| `StationCard.test.js` | 4 | Station cards via `ModularSyncer` |

⚠️ `GlobalAuras.test.js` is worth a second look — 12 tests that pin
**additive stacking and post-load rehydration** of a cross-scope aura. Those are
exactly the rules the board's Guild Hall aura will need. The *subject* dies; the
*rules* should be re-pinned in whatever replaces it, not lost.

### 5.2 Survives as-is — tests code being kept (20 files, ~174 tests)

`HeroDock` (33), `HeroSystem` (21), `BigNumbers` (11), `StatusEffects` (10),
`TimeBank` (10), `CombatFormulas` (9), `EquipmentCategories` (9),
`useGameState` (9), `SaveRoundtrip` (7), `EquipmentRequirements` (6),
`SaveDurability` (6), `CombatEating` (5), `EventBus` (5), `XPCurve` (5),
`theaterUtils` (5), `AssetManager` (4), `DynamicRegistries` (4),
`InventorySlotCap` (5), `CombatCard` (1).

This is the real regression net for the clean-break branch. It covers heroes,
skills, equipment, combat maths, status effects, saves, the dock and the number
formatting — but **not** work-cycle execution, **not** the economy loop, and
**not** anything spatial.

### 5.3 Splits — the file survives, part of its content does not (6 files, ~223 tests)

| File | Tests | Split |
| :--- | ---: | :--- |
| `Mutators.test.js` | **130** | Phase 1 three-bucket maths (26) ✅ keep · Phase 2 card tags (26) ✅ mostly keep · Phase 5 token axes (13) ✅ keep, rehome onto Token instances · Phase 7 combat-tag derivation (7) ✅ keep — **but** Phase 0 scaffolding (13), Phase 3 slot lifecycle (19), Phase 4 stamping (10), Phase 8 Area Anchor (5) and Phase 9 badge data (11) ❌ die. **~58 of 130 go.** |
| `CardEffects.test.js` | 31 | Effect registry ✅ · the `EFFECT_REACH.LOOP/NEXT_CARD` cases need rewriting to adjacency |
| `CardFailure.test.js` | 24 | Preflight + failure gating ✅ conceptually — **but the Bank-full cases directly encode the behaviour D-138 inverts** (see §2.1) |
| `ConsumptionSystem.test.js` | 15 | Food/`tryEat` ✅ · drink/energy ❌ dies with Energy |
| `EffectResolvers.test.js` | 14 | Resolvers ✅ · reach-dependent cases need rework |
| `DefeatPenalties.test.js` | 9 | The D-74 rules ✅ · the `LoopRunner` harness ❌ |

### 5.4 What this means for the clean-break risk

Rough arithmetic: of 563 tests, roughly **~230 die** (166 outright + ~64 inside
splits), **~174 survive untouched**, and **~160 survive but need re-homing onto
the board.**

The honest statement for the roadmap: **after deletion, "npm test is green"
proves the hero/skill/equipment/combat/save half of the game still works, and
says essentially nothing about whether the board works.** Two mitigations worth
scheduling explicitly:

1. **Write the board's tests as the board is built, phase by phase** — grid
   occupancy, adjacency neighbour sets, displacement, consolidation maths,
   first-come input allocation. These are pure-logic, cheap to test, and they are
   the *only* thing that will catch collateral damage on a branch with no
   flag-off comparison.
2. **Re-pin the orphaned rules before deleting their homes.** Specifically:
   `GlobalAuras`' additive-stacking + rehydration rules, and `CardFailure`'s
   preflight semantics (rewritten to D-138's inversion). Deleting these files
   without a replacement silently drops two rules the board still needs.

---

## 6. Decisions taken from this analysis (owner, 2026-08-06)

Twelve calls made in response to the findings above. These carry into the
roadmap as locked decisions; they need **G-nn** ids assigned there so they can be
cited without re-litigating.

| # | Decision | Consequence for the plan |
| :--- | :--- | :--- |
| **1** | **Hero Speed and Efficiency are DEFERRED to the hero rework.** Skills gate Access this pass and nothing else. | D-67 is knowingly unimplemented — goes in the deferred-decisions table. Hero level will not change cycle time or input cost during the playtest. Heroes still matter as D-62's *gate* (no hero, no work), which is what the board actually tests. |
| **2** | **Regen is passive at all times, by intent. No code change.** The *documents* are wrong, not the engine. | Correct §8.1, D-136 and `playmat_hero_concept.md:134` to say: regen is constant; retreat works by removing the damage source, so a withdrawn hero nets positive HP. **Risk 14 stays closed**, on corrected reasoning. Rate (1 HP/5s) is a first-balance-pass item. |
| **3** | **Retreat is not a mechanic** — it is just unassigning the hero mid-combat. | No `isFleeing` feature. Retreat falls out of hero placement plus D-131. `card.isFleeing` becomes dead code and is removed. |
| **4** | **The enemy resets to full HP when its hero leaves.** Current behaviour. | Consistent with D-131 — interrupting mid-cycle forfeits it. Zero work. This is what gives §8.1's "watch your first few fights" its cost. |
| **5** | **Widen YIELD / WORK_TIME / INPUT_COST to read neighbouring tiles**, in the adjacency phase. | Closes §1.3. Context and Buff Tokens can do the numeric half of their job. Touches `LootSystem`, `StatProcessor`, `WorkProcessor`, `CardPreflight` — roughly one line per scope per resolver. |
| **6** | **Keep both dispatch mechanisms** (trait bag + effect list) for the port; collapse later. | Lowest-risk port. Logged as known cleanup debt. |
| **7** | **Hero traits: keep the label, cut nothing.** | §10.1 is corrected to match the brief and the hero spec. Zero work — they are already cosmetic. |
| **8** | **Energy: stop consuming it, hide the UI, leave the data.** | The design call (D-183/D-184) lands for free once card draws and Outposts are gone. The 45-file / 183-reference removal sweep is **deferred cleanup**, not slice work. Drink items and `tryDrink` go dormant with it. |
| **9** | **Quests: leave dormant** — don't tick, don't delete. | `QuestBoardSystem` loses its tick handler; `quest_slots` is hidden. Nothing is removed. §12's "may be cut" stays genuinely open. |
| **10** | **Guild Upgrades: Storage + Roster only.** Aura and Economy deferred. | Mostly deletion — 9 of 14 nodes go, plus the `OutpostManager` / `universals` / `playsets` / `unlockedAreaSets` coupling inside `GuildUpgradeManager`. Roster is the one that shapes play (D-181). |
| **11** | **Build the loot-sprite layer EARLY**, before Token behaviour. | Sprites are core, not polish — Map bursts (D-142) and crafted-Token output (D-148) both land through them, and **D-138's "nothing is ever lost" depends on them entirely.** Bank overflow behaviour is inverted at the same time. |
| **12** | **One full Map + a cheap second.** | Map 1 gets the proper ~15-Token kit; Map 2 is deliberately thin (~5 Tokens) and exists only to make the price step and the strength/demand jump real. Resolves the D-108 / risk-6 tension in risk 6's favour, at low cost. |

**Also settled:**

* **Branch:** implementation branches **off `rework/playmat-7x7-grid`**. It
  already carries all 12 design commits plus everything `main` has, so work
  starts with the specs present. `main` stays untouched and playable as the
  rollback point until the slice works, then the whole thing merges once.
* **Content authoring:** I propose the full Map 1 kit (~15 Tokens) against
  §7.3d's Woodland example — producers, context, buff, manager, enemy — with
  numbers in D-164's 10–30s band; the owner reviews and retunes. This also
  surfaces risk 17's authoring cost immediately.
* **Clutter mock (risk 7):** folded into the UI/polish phase rather than given
  its own early phase. ⚠️ *Noted as an accepted risk:* this is the failure that
  killed the previous spatial playmat, and finding it late means redesigning the
  tile after everything already renders through it. The mitigation is that real
  playmat art already exists, so an ad-hoc 48-tile check can be run cheaply at
  any point without waiting for the phase.

---

## 7. Summary table

| §10 claim | Verdict |
| :--- | :--- |
| Item Bank survives | ⚠️ Yes, but D-138 inverts Bank-full behaviour |
| 7-stat combat engine survives | ✅ Yes — and D-103's rest already exists |
| Status-effect engine survives | ✅ Yes |
| Heroes + 9-slot grid survive | ⚠️ 9 slots correct; most gear effects are silent no-ops; hero Speed/Efficiency don't exist |
| Guild Upgrades survive, re-homed | ⚠️ Mechanism yes; 9 of 14 nodes die; Aura and Economy tracks don't exist |
| Card schema + execution model survive | ⚠️ Skeleton yes; input/tool layers are a rewrite |
| Nav / drawers / inspection survive | ✅ Yes |
| Keep `ModifierAggregator` + Three-Bucket | ✅ Yes, verbatim |
| Replace `EFFECT_REACH` targeting | ⚠️ Necessary but not sufficient — axes are card-local |
| `LoopBuffs.js` dies | ✅ Yes |
| `AreaModifiers.js` dies | ✅ Yes — but `GlobalModifiers.js` should be kept, and isn't mentioned |
| Token name collision retires cleanly | ❌ `TokenRegistry` + `SlotTokens` yes; **`TokenAxes.js` must be kept** |
| Hero traits deleted (§10.1) | ❌ Contradicts the brief and hero spec — and they're already cosmetic |
| Risk 14 closed ("RegenSystem heals idle heroes") | ❌ It heals fighting heroes too |
| "90 class perks + 90 trait perks re-home" (hero spec) | ❌ There are 9 and 9, carrying no perks |
| Drag-and-drop system | 🎁 Major survivor, unlisted |
| Playmat board art | 🎁 26 files already in `public/`, unlisted |
