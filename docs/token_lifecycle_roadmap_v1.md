# Token Lifecycle — implementation roadmap v1

**Written 2026-09-25. Approved by the owner 2026-09-25. Status: IN PROGRESS
(director started 2026-09-25); see §8.**

This roadmap builds the **first playable version** of the Spawner System
described in [`concept_token_lifecycle.md`](concept_token_lifecycle.md) (v2.1,
decisions SP-2…SP-74). Its purpose is **testing the basic mechanics**: every
starting skill has a working chain from "bought at the shop" to "items in the
Bank", with cheap placeholder prices, so the owner can play it and refine.

**Where this document and the concept disagree, this document wins for the
first build** (the differences are listed in §2). The concept stays the vision.

---

## 0. How to run this roadmap (for the director)

The implementing agent is a **director**: it plans each slice, hands the work to
subagents, reviews what comes back, verifies it and merges. It does not need to
write most of the code itself.

### 0.1 Read first

1. `CLAUDE.md`: how the owner works. **Not optional.** The owner does not code;
   explain in plain language, ask design questions as multiple choice with a
   recommendation, verify before claiming done, stay in scope, small slices.
2. This roadmap, all of it.
3. `docs/concept_token_lifecycle.md` §1–§3, §9 and §10 (the chains).
4. `docs/free_playmat_roadmap_v1.md` §1 (FP decisions) and the 1.8 / 1.9 rows of
   its status table: both slices are **partly built**, and Phase 9 here undoes
   parts of them.

### 0.2 The workflow for every slice

1. **Brief a subagent** with: the slice's goal and "done when" line from this
   document; the files named in the slice; the decisions it must respect (quote
   the ids); what is **out of scope**; the requirement to write tests; and the
   instruction to report back what changed, what was tested and anything
   surprising. Subagents start cold: give them paths and decision text, not "see
   the conversation".
2. **Parallel lanes use worktrees.** Several chats and agents share one checkout
   on this machine (memory: *Concurrent Sessions Share One Tree*). Give each
   parallel subagent its own worktree (`isolation: "worktree"`) and merge lanes
   one at a time.
3. **Review the diff yourself.** In this codebase, treat any code comment's
   rationale as unverified (Code Review Round 2 found 8 cases of invented
   reasoning).
4. **Verify:**
   * `npm test`, compared with the **baseline** (§0.4). Any new failure is yours
     until proven otherwise; stash your change and rerun before blaming `main`.
   * **Run the game** (`npm run dev`) and exercise the slice. Screenshots of the
     game pane time out; use `window.Game` / `window.GameState` probes from the
     browser tool instead. Press `Enter`, not `Return`. Click by `ref`, not by
     coordinates.
   * Report **what you observed**, not that code was written.
5. **Commit and merge** the slice to `main` (branch per slice, named for the
   job, e.g. `lifecycle/spawner-engine`). **No double quotes in commit messages
   run through PowerShell** (they get mangled); check `git log` afterwards.
6. **Update the status table (§8)** in the same commit, and add a line to
   `CHANGELOG.md` under `## [Unreleased]`.
7. **Stop and ask the owner** at each ⭐ checkpoint in §7 and whenever a design
   question comes up that this document does not answer. Record the answer here
   as a new TL- decision.

### 0.3 Rules that bite

* ⚠️ **Never hand-edit `data/*.json`.** The CMS (`cms/`) is the only authoring
  surface, and its one-way "Sync to Game" **destroys anything it does not
  model**. So **the CMS must learn every new Token block (Phase 4) before any
  content uses it (Phase 7).** Test fixtures are fine for engine tests.
* ⚠️ **Verify CMS work on a sandbox route** (`?p2=1`, `?p6=1`), never on the
  real workspace. The CMS store persists to localStorage.
* ⚠️ **Rules text is pinned by `RenderGolden`.** A wording change needs the
  golden regenerated **and its diff read**.
* ⚠️ **Legacy item ids** (without the `item_` prefix) coexist with live
  `item_*` ids and hide data bugs. Always reproduce with `item_*` ids.
* ⚠️ **Energy code remains** (hero consumption, regen, combat) though energy is
  no longer a mechanic. Don't build on it; don't remove it here either.
* **Offline time is not simulated separately.** `TimeBankManager` replays time
  away by speeding up the live engine. Every new clock in this roadmap **must
  advance by the tick's `delta`** so it speeds up with the rest. This also gives
  testers a free fast-forward.
* **Nothing is ever lost to a full Bank** (D-138): overflow drops as loot on the
  mat. New output paths must go through `InventoryManager`, not around it.

### 0.4 Test baseline

Recorded by slice 0.1 on `main` at `42eef7b` (2026-09-25), in the real checkout:
**3063 tests; 3022 pass, 12 fail in 6 test files, 29 skipped.** Every failure
predates this roadmap. Compare failing test **names**, not counts:

| File | Failing test |
|---|---|
| `ContentRules` | Rule 4: `token_redberry_bush` runs within the 10–30s band |
| `EconSimRunner` | the runner honours an explicit anchor flag over the rule that would elect otherwise |
| `EconSimTime` | the shipped corpus files no row for its 23 config-less Tokens |
| `ItemSellValue` | every priced shipped item now fetches more than the old flat 1g |
| `OneRuleOnePlace` | CR2-196: at least one authored Map still has materials to draw |
| `OneRuleOnePlace` | CR2-196: the inspection panel names the material instead of drawing "Unknown" |
| `TerrainRegistry` | covers every authored Map |
| `TerrainRegistry` | every Token that no Map produces has its own terrain |
| `TerrainRegistry` | overrides a Token a Map can produce only on purpose |
| `TerrainRegistry` | accounts for all 75 Tokens between the two routes |
| `TerrainRegistry` | does NOT guess for a Token that two Maps list |
| `TerrainRegistry` | ignores a stamp naming a terrain that no longer exists |

⚠️ **In a `git worktree`, `TerrainRegistry` fails two more** (untracked art is
absent there). Subagents working in worktrees should expect 14.

`npm run dev` starts and a new game loads on slot 1 (save version `0.8.0`, no
heroes, as designed). The console shows one pre-existing React warning
("Encountered two children with the same key"), not from this work.

---

## 1. Goal and scope

**Done means:** on a **new game**, the owner can buy an Oak Forest and a Copper
Mine, watch them spawn trees and veins, log and mine with Recruits, build a
Furnace, Kitchen and Workbench on Foundations, plant Farmland, fish a Coast
while it has turned into a Shrimp Coast, explore a Map by spending food and
torches, and (with the dev combat grant) fight a Goblin Camp's goblins and its
rare Chief. Every price is paid in items, the Upkeep Summary shows what is being
consumed, and the mat never softlocks.

**In scope:** the nine Recruit skills (SP-58–SP-60, SP-74): Logging, Mining,
Fishing, Farming, Construction, Crafting, Smithing, Cooking, Explore; camps; the
shop; Foundations; upkeep; the Guild Hall trickle; gold's removal; functional UI
for testing; retiring the Vault, Managers and Map bursts.

**Out of scope (later work):**

* **First- and second-promotion skills** (owner). Promotions keep working as
  today; their skill lists are not redesigned here. Academies are only made
  buildable (slice 6.2).
* **The skills-list overhaul** beyond adding the three new starting skills.
* **The Token UI rework** (how Tokens look on the mat). This roadmap builds
  plain, functional UI; the owner wants a separate UI rework afterwards.
* **Tools as hero equipment** (SP-53); see TL-2.
* **Support Tokens and keystones** beyond what already exists (SP-39–SP-41).
* **Balance.** Prices and numbers are low placeholders (TL-5).
* **The economic simulator** (`cms/src/engine/sim`): it will need to model
  rates later; leave it alone unless a change here breaks it.

---

## 2. Decisions this roadmap builds on

### 2.1 From the concept (leaning; do not re-open)

| Area | Decisions |
|---|---|
| Spawners | SP-2 workable Tokens run out · SP-5 cap per kind, mat-wide, counts live Tokens · SP-6 over the cap after a removal, nothing is removed · SP-46 / **SP-68** spawns push, but only other spawned Tokens · **SP-70** spawners generally pay upkeep per spawn, per Token |
| Limits | **SP-67** the mat cap counts only placed Tokens · SP-11 spawners live only on the mat · SP-9 no point pools |
| Shop | SP-12 the shop (reworked Cartographer) · SP-13 progression gated by items, no unlock events · **SP-65** gold retired, items are the only price |
| Foundations | SP-42 bought at the shop, built with Construction · SP-43 a few kinds · SP-49 what it becomes is a recipe, level-gated · SP-47 Farmland is planted by Farming · **SP-62** academies are Foundation recipes |
| Skills | SP-17 / SP-18 / SP-50 / SP-51 Coasts turn on a timer, from a weighted list, and a cycle in progress is lost · SP-48 / SP-71 / SP-73 Fields and Orchards spawn patches for one seed each · SP-23 stations are permanent · SP-26 Cooking and Smithing burn fuel · SP-29 / SP-30 / SP-56 tiered Anvils, bought at the shop, wear out · SP-31 smelt, then smith · SP-34–SP-38 camps · **SP-69** leaders are dangerous by design · SP-54 / **SP-74** Explore spends supplies on Maps for themed loot |
| Misc | SP-52 a hero whose target vanishes moves on · SP-55 Managers retired · **SP-66** the Guild Hall trickle is the backstop · **SP-72** starter set and trickle contents decided after implementation |

### 2.2 Owner decisions for the first build, 2026-09-25

| Id | Decision |
|---|---|
| **TL-1** | **No refunds.** Removing a Token deletes it; nothing comes back. Settles SP-63 for this build. The Hall trickle (SP-66) is the softlock backstop. |
| **TL-2** | **Tool requirements are dropped for now.** Spawned trees, veins and other workable Tokens need no nearby tool. Tools-as-equipment (SP-53) is later work. |
| **TL-3** | **Camps are in**, tested with the existing dev "Grant combat skill" action, since Recruits hold no combat skill. |
| **TL-4** | **Functional UI here; the Token UI rework later.** This roadmap builds what testing needs (an Upkeep Summary, inspection lines, alerts, the shop, recipe picking) and no restyling of Tokens on the mat. |
| **TL-5** | **Prices are low and simple.** Exact items and quantities are refined through testing. |
| **TL-6** | **Only the starting skills.** Promotion skills are left for later. |
| **TL-7** | **Promotion keeps all nine starting skills** (owner, 2026-09-25, at the slice 1.1 checkpoint). Promotion never banks a foundation skill; it only adds (and, for advanced jobs, swaps) the non-foundation skills, so a promoted hero's sheet is wider (about 11). Chosen over leaving five skills banked, so promoted heroes can still build, farm and explore. Slice 1.2. |

---

## 3. Director's picks (provisional; the owner can overturn any)

Technical choices made to get moving. Each needs no owner input unless it turns
out to change something the player sees.

* **DP-1 Content is described by new blocks on the Token type**, the way enemies
  got an `enemy: { level, style }` block. Proposed shapes (Phase 3.0 fixes them
  before anyone builds on them):

  ```js
  spawner: {
    spawns: [{ typeId: 'token_oak_sapling', weight: 1 }],  // weighted list (camps: goblin 95, chief 5)
    allowance: 5,          // this spawner adds 5 to its kinds' caps (SP-5)
    intervalMs: 20000,     // one spawn attempt per interval
    upkeep: [{ itemId: 'item_oak_seed', quantity: 1 }]     // per spawn; may be empty
  }
  grows:   { into: 'token_oak_tree', afterMs: 30000 }       // sapling → tree, patch → ripe patch
  turns:   { into: [{ typeId: 'token_shrimp_coast', weight: 1 }],
             everyMs: 120000, lastsMs: 60000 }               // Coast ↔ Shrimp Coast
  foundation: { kind: 'wood' }                               // 'wood' | 'stone' | 'bench' | 'farmland'
  shop:    { price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'Logging' }
  trickle: [{ itemId: 'item_oak_seed', quantity: 1, everyMs: 300000 }]  // Guild Hall only, for now
  ```

  **Why blocks and not effect statements:** spawning already exists as a
  statement (`EffectActions.spawn`), but statements fire on *events*; there is
  no "every N seconds" trigger, and the mat-wide per-kind cap needs a view across
  all spawners that one statement can't hold. The spawn itself should still go
  through `EffectActions.spawn` so landing and pushing stay one code path.
* **DP-2 One clock system for everything timed:** `grows`, `turns`, spawner
  intervals and the trickle. It ticks from the game loop with `delta` (so the
  time bank fast-forwards it) and saves its timers on the Token instance.
* **DP-3 Every Token instance records its origin:** `placed` (bought, built,
  starting set) or `spawned`. Pushes pass every placed Token as fixed
  (`MatPlacement.forceSpot` already takes `fixedIds`), which is SP-68. The mat
  cap counts `placed` only (SP-67). A `grows` or `turns` change keeps the origin.
* **DP-4 A kind's cap is the sum of the allowances of every live spawner that
  lists that type** (the concept's §9.4 proposal). A weighted camp contributes
  its allowance to **each** type in its list, and the count is taken across all
  of them together (goblins and Chiefs share the camp's cap).
* **DP-5 Upkeep is paid when a spawn happens, from the Bank.** If the Bank
  cannot pay, the spawner **waits** and shows "Needs Oak Seed" (the same
  "unpaid means off" meaning as `BlockUpkeep`, CMS-97). No debt, no partial pay.
* **DP-6 Building in place is a transform.** A Foundation is a station whose
  recipes output a Token. When a Construction cycle completes, the Foundation
  **becomes** the output at the same point (`EffectActions.transform`), with
  origin `placed`. One cycle = the build time. Farmland is the same with
  Farming as the skill.
* **DP-7 A Map is an ordinary producer Token.** Its cycle takes supplies as
  **inputs** (a Cooked Shrimp and a Torch) and rolls **chance outputs** (the
  themed loot table); it has charges and vanishes when they run out. Token
  config already supports inputs, chance outputs and charges, so Explore needs
  almost no engine work. The Map burst (`Cartographer.openMap` / `rollBurst`)
  retires.
* **DP-8 The Anvil is an existing context Token with charges.** Smithing's
  "needs an Anvil nearby" uses today's context machinery (`requiresContext`,
  `Charges.contextProvidersAround`), with the Anvil's metal as its tier. Only
  the *gathering* tool requirements go (TL-2).
* **DP-9 A minimal test content set, not a conversion.** Author **tier one of
  each chain** (§6) through the CMS. The 78 existing Tokens stay in the data but
  are left out of the shop, so they're unreachable in a new game. Converting or
  deleting them is later content work.
* **DP-10 A save-version bump to `0.9.0`, new games only.** Loading an older
  save is not supported in this build (the project has wiped saves at every
  rework). Check `SaveManager` for how a version mismatch is handled today, and
  make it clear rather than crash.
* **DP-11 A dev panel for testing** (in the existing `TestDashboard`): give any
  item, grant a combat skill (exists), jump every spawner and grow clock forward,
  show kind counts and caps.

### 3.1 The data shapes (slice 3.0, director-approved 2026-09-25)

**Final for this build. Everything from Phase 3 on reads from here.** These
shapes replace DP-1's proposal where they differ. Every block is optional and
lives on the Token type in `data/tokens.json` (authored through the CMS, Phase
4). Item ids are always live `item_*` ids.

#### Blocks on the Token type

```js
// A spawner (Oak Forest, Copper Mine, Goblin Camp, Wheat Field).
spawner: {
  spawns:     [{ typeId: 'token_oak_sapling', weight: 1 }], // ≥1 entry; weights are relative
  allowance:  5,        // integer ≥1: what this spawner adds to its family's cap
  intervalMs: 20000,    // ≥1000: one spawn attempt per interval
  upkeep:     [{ itemId: 'item_oak_seed', quantity: 1 }]     // paid per spawn; [] = free
}

// Becomes another Token after a time (Sapling → Tree, patch → ripe patch).
grows: { into: 'token_oak_tree', afterMs: 30000 }            // afterMs ≥1000

// Turns into one of a list for a while, then back (Coast ↔ Shrimp Coast).
turns: {
  into:    [{ typeId: 'token_shrimp_coast', weight: 1 }],   // ≥1 entry
  everyMs: 120000,     // ≥1000: time spent as itself before turning
  lastsMs: 60000       // ≥1000: time spent turned before turning back
}

// A Foundation (bought at the shop, built on with a recipe).
foundation: { kind: 'stone', skill: 'construction' }
  // kind: one of FOUNDATION_KINDS = ['wood', 'stone', 'bench', 'farmland']
  // skill: the skill that builds on it ('construction'; 'farming' for farmland)

// Sold at the Shop.
shop: {
  price:   [{ itemId: 'item_oak_wood', quantity: 10 }],     // ≥1 entry (SP-65: items only)
  section: 'logging'   // a skill id, or 'general'; the Shop groups by it
}

// Income on a clock, no hero needed (the Guild Hall only, for now).
trickle: [{ itemId: 'item_oak_seed', quantity: 1, everyMs: 300000 }]  // everyMs ≥1000
```

**A recipe that builds (DP-6)** is an ordinary recipe in
`data/tokenRecipes.json` whose `skill` is the Foundation's skill, whose single
output is a `tokenId`, and which carries one new field:

```js
foundationKinds: ['stone']   // the Foundation kinds it can be built on
```

A Foundation's recipe pool is **the recipes of its `foundation.skill` whose
`foundationKinds` include its `kind`**. Recipes without `foundationKinds` never
appear on a Foundation, and recipes with it never appear on an ordinary station.
The recipe's `levelRequirement`, `inputs` (the building's own cost, on top of
the Foundation's shop price) and `durationMs` (the build time, one cycle) work
as they do today. On completion the Foundation **becomes** the output Token in
place (`EffectActions.transform`), not a dropped sprite.

#### State on the Token instance (saved)

```js
origin: 'placed' | 'spawned'   // DP-3; absent on an old instance reads as 'placed'
clocks: {                      // elapsed ms, advanced by the tick's delta (DP-2)
  spawnMs: 0,                  // spawner only
  growMs:  0,                  // grows only
  turnMs:  0,                  // turns only (time spent in the current state)
  trickle: [0]                 // trickle only, one entry per trickle line
}
turnedFrom: 'token_coast'      // on a turned instance only: what it turns back into
```

* A `grows` or `turns` change is a transform that **keeps `origin`** and starts
  the new instance's clocks at 0. A turned instance carries `turnedFrom`; it
  turns back after the original's `turns.lastsMs`, read from the `turnedFrom`
  type (so the timing is authored in one place, on the Coast).
* A **Foundation building** keeps `origin: 'placed'`.

#### Rules the engine applies

* **Family and cap (DP-4, SP-5).** A spawner's *family* is every type in its
  `spawns` list **plus everything they grow into** (following `grows.into`
  until it stops), so an Oak Forest's family is `{Oak Sapling, Oak Tree}` and a
  Goblin Camp's is `{Goblin, Goblin Chief}`. The family's **count** is the live
  Tokens on the mat of any type in it, whatever their origin. Its **cap** is the
  sum of `allowance` over every live spawner whose family shares a type with
  it. A spawner attempts a spawn only while count < cap.
* **Upkeep (DP-5).** Checked and paid, all or nothing, at the moment of a spawn,
  through `InventoryManager`. If the Bank can't pay, the clock stays full and
  the spawner retries every tick, reporting `needs <item>`.
* **Landing.** Through `EffectActions.spawn` with placement `nearest_free`
  around the spawner; placed Tokens are fixed (SP-68). Nowhere to go means the
  clock stays full and the spawner reports `no room` (FP-46).
* **Reported state** (for the UI, Phase 8): one of `spawning` (with ms to the
  next attempt), `at_cap`, `needs_item` (with the item ids), `no_room`.
* **Mat cap (SP-67):** counts instances with `origin: 'placed'`, except the Guild
  Hall. Its number is a Mat Tuner setting.

#### Validation (for the content audit, slice 4.2)

Errors:
* every `typeId` / `into` / `tokenId` names an existing Token; every `itemId`
  names an existing live `item_*` item;
* a spawner's family does not contain the spawner itself;
* a `grows` chain does not loop (A → B → A);
* a `turns.into` entry is not the Token itself, and none of its entries has a
  `turns` block of its own;
* weights, quantities, `allowance` are positive integers; times are ≥1000 ms;
* `foundation.kind` is one of `FOUNDATION_KINDS`; `foundation.skill` is a real
  skill;
* each Foundation kind that is sold has at least one recipe;
* a recipe with `foundationKinds` outputs exactly one `tokenId` and its `skill`
  matches that kind's Foundations;
* a Token has at most one of `spawner`, `turns`, `foundation` (they would fight
  over what the Token is).

Warnings (allowed):
* a spawner with empty `upkeep` (SP-70 is decided per Token);
* a `trickle` on any Token other than `token_guild_hall`;
* a Token with a `shop` block but no way to be worked or to spawn anything.

---

## 4. The phases at a glance

```
Phase 0  Groundwork ─┐
Phase 1  Skills ─────┼──────────────┐
Phase 2  Gold out ───┘              │
Phase 3  Spawner engine ──► Phase 4 CMS blocks ──► Phase 7 Skill chains (7 lanes)
            │                                      ▲          │
            ├──► Phase 5 Shop & removal ───────────┤          ▼
            └──► Phase 6 Foundations ──────────────┘   Phase 8 Testing UI
                                                             │
                                             Phase 9 Retirements ──► Phase 10 First playtest
```

| Lane | Can run in parallel with |
|---|---|
| Phase 1 (skills) | Phase 2, Phase 3 |
| Phase 2 (gold) | Phase 1, Phase 3 |
| Phase 4 (CMS) | Phase 5 and Phase 6, once slice 3.0 has fixed the data shapes |
| Phase 7's seven chains | Each other, once Phases 3–6 are merged |
| Phase 8.2 (Upkeep Summary) | Phase 7, once slice 3.3 exists |

---

## 5. Slices

Each slice: tests, run the game and exercise it, one commit, merge. "Files" are
starting points for the brief, not a complete list.

### Phase 0: Groundwork

| Slice | What | Files | Done when |
|---|---|---|---|
| **0.1 Baseline** | Run `npm test` on `main`; record the exact failing files and tests in §0.4. Confirm `npm run dev` starts and a new game loads. | — | §0.4 lists every baseline failure by name. |
| **0.2 Dev tools** | DP-11: "give item" (any id, any amount), "advance timers by N minutes", a kind-count readout (filled in once 3.3 exists). "Grant combat skill" already exists. | `src/ui/components/TestDashboard.jsx` | The owner can give themselves 100 Oak Wood from the panel. |

### Phase 1: The Recruit skills

| Slice | What | Files | Done when |
|---|---|---|---|
| **1.1 Nine starting skills** | Add `farming` and `explore` to the **foundation** layer; move `construction` from signature to foundation (and rewrite its description for building stations). Recruits hold all nine. `HERO_SKILL_SLOTS` currently asserts 6: let the Recruit hold the full foundation set and leave promoted jobs' lists as they are (TL-6). ⚠️ Promoting a Recruit will drop more skills than before; acceptable until the promotion overhaul, but **note it in the status table**. Villagers keep holding two foundation skills (the pool just grows). Placeholder icons for the new skills. | `src/config/registries/skillRegistry.js`, `jobRegistry.js`, `src/systems/hero/HeroGenerator.js`, skill-count tests | A new Recruit shows nine skills at level 1; the flag rules panel lists allow/priority rows for all nine; existing promotion tests pass or are updated with the reason written down. |
| **1.2 Promotion keeps the starting skills** | TL-7: promotion never removes a foundation skill; base-class promotion adds its combat and shared skills; advanced-job promotion swaps only non-foundation skills. Banked foundation skills from older heroes come back. | `PromotionSystem.js`, `jobRegistry.js`, `skillRegistry.js`, promotion tests | A Recruit promoted to Fighter, then to an advanced job, still holds all nine starting skills at their levels. |

### Phase 2: Gold out, items in

| Slice | What | Files | Done when |
|---|---|---|---|
| **2.1 Hall upgrades in items** | Guild Hall upgrades (Bunk Beds, Scouting Flags, bank slots, …) cost a list of items per rank instead of gold (TL-5: cheap and simple, e.g. rank *n* costs 10·n Oak Wood). First recruit stays free. | `src/config/guildUpgrades.js`, `src/systems/progression/GuildUpgradeManager.js`, the upgrade board UI | A second hero can be recruited by paying items; the board shows item prices. |
| **2.2 Gold removed from play** | No gold in the HUD; no selling to the merchant (`CommerceSystem`); no gold from loot pickup or map rewards; quest rewards that gave Maps or gold give items instead. `CurrencyManager` stays in the code, unused (deletion is Phase 9). The save keeps its `gold` field. | `src/systems/economy/*`, `SpriteLayer.js`, `Cartographer.js`, `BoardRunner.js`, `TokenBank.js`, `src/systems/quests/tutorialQuests.js`, HUD | No screen shows gold, and no action earns or spends it. |

### Phase 3: The spawner engine

| Slice | What | Files | Done when |
|---|---|---|---|
| **3.0 Data shapes** | Write the final shapes of `spawner`, `grows`, `turns`, `foundation`, `shop`, `trickle` (DP-1) into this document (a new §3.1), with validation rules for the content audit. **Everything after this reads from it.** | this doc, `src/config/registries/tokenRegistry.js` | The director has approved the shapes; Phase 4 and Phase 3.1+ can start in parallel. |
| **3.1 Origin, mat cap, fixed pushes** | DP-3: `origin` on every instance, saved; the opening Hall is `placed`. The mat cap counts placed Tokens only (SP-67; its number is a Mat Tuner setting). Spawns pass placed Tokens as fixed (SP-68); a spawn with nowhere to go waits (FP-46). | `BoardState.js`, `MatPlacement.js`, `EffectActions.js`, save schema | A test shows a spawn pushing a spawned tree but never a placed station; the placed count ignores spawned Tokens. |
| **3.2 Timed changes** | DP-2's clock, plus `grows` (A becomes B after T) and `turns` (A becomes one of a weighted list for T, then back). On a turn back, a cycle in progress is lost (SP-51) and the hero moves on (SP-52). Timers save and run faster during time-bank replay. | new `src/systems/board/TimedChanges.js` (name free), `EffectActions.transform`, `BoardRunner.js`, `HeroMotion.js` claims | A sapling fixture becomes a tree after its time; a Coast fixture turns and turns back; a hero fishing mid-cycle loses the cycle and walks off. |
| **3.3 Spawners** | `SpawnerSystem`: per spawner, an interval clock; each attempt checks the kind cap (DP-4), pays upkeep (DP-5), picks from the weighted list, lands near the spawner via `EffectActions.spawn`. Reports its state (spawning / at cap / needs *item* / no room) for the UI. SP-6: removing a spawner lowers the cap and removes nothing. Spawned Tokens that run out vanish (existing `Charges.destroyToken`). | new `src/systems/board/SpawnerSystem.js`, `EffectActions.js`, `Charges.js` | With a Forest fixture: 5 trees appear at most; two Forests allow 10; with no seeds in the Bank it waits with "needs Oak Seed"; logging a tree out lets another spawn. |
| **3.4 Guild Hall trickle** | The Hall's `trickle` grants items on a clock (SP-66). Contents are placeholders (SP-72). | `SpawnerSystem.js` or the clock system, `token_guild_hall` via the CMS once Phase 4 lands | A new game's Bank slowly gains the trickle items with no hero. |

### Phase 4: CMS authoring (must land before Phase 7)

| Slice | What | Files | Done when |
|---|---|---|---|
| **4.1 Token blocks** | The Token editor models `spawner`, `grows`, `turns`, `foundation`, `shop`, `trickle`, so Sync to Game carries them instead of destroying them. Pickers for Token and item ids. | `cms/src/components/editors/TokenEditor.jsx`, `cms/src/stores/useEntityStore.js`, sync code | On the sandbox route, a Token with every block survives an edit → sync → reload round trip unchanged. |
| **4.2 Content audit** | `ContentAudit` checks the new blocks: spawned and grown types exist; a spawner does not list itself; shop prices name real items; a Foundation kind has at least one recipe; warnings for a spawner with no upkeep (allowed, SP-70 "per Token"). | `src/systems/core/ContentAudit.js`, `cms/src/engine/connectivityAuditor.js` | A deliberately broken fixture produces one clear message per problem. |
| **4.4 Derived type knows the new blocks** | `deriveTokenType` (game and CMS) recognises `spawner`, `turns` and `foundation` Tokens, so the boot audit stops calling them buffs that do nothing and Recalculate writes a sensible `tokenType`. | `deriveTokenType`, `ContentAudit.js` | A spawner-only fixture produces no "does nothing" finding. |
| **4.3 Recipes that build** | The Recipe editor can author a recipe whose output is a Token, with a skill (Construction or Farming) and level gate, attached to a Foundation kind's pool. | `cms/src/components/editors/RecipeEditor.jsx`, `recipeSync.js`, `recipePoolRegistry.js` | A "Build Furnace" recipe authored in the CMS appears in the game's recipe pool for Stone Foundations. |

### Phase 5: The shop and removal

| Slice | What | Files | Done when |
|---|---|---|---|
| **5.1 The Shop** | The Cartographer panel becomes the **Shop**: every Token with a `shop` block, grouped by section, with its item price and whether the Bank can pay. Buying pays the items and lands the Token beside the Hall (FP-18's path), origin `placed`. Refused (with a reason) when the Bank can't pay or the mat cap is reached. | `Cartographer.js` (or a new `Shop.js` beside it), its UI panel | Buying an Oak Forest takes the Oak Wood from the Bank and puts the Forest on the mat; with too little wood the button says what's missing. |
| **5.2 Dispose** | A **Remove** action on any placed Token except the Guild Hall: a confirm dialog ("This is gone for good, nothing is returned", TL-1), then the Token is deleted. Spawned Tokens it leaves behind stay (SP-6). A hero working it moves on (SP-52). | inspection panel, `BoardState.js` | Removing a Forest leaves its trees; the count of placed Tokens drops by one; nothing enters the Bank. |

### Phase 6: Foundations and Construction

| Slice | What | Files | Done when |
|---|---|---|---|
| **6.1 Build in place** | DP-6: a Foundation is a station whose recipes output a Token; the player picks the recipe on it (today's station recipe picker, `StationRecipe.js` / `StationRecipeModal.jsx`); a Construction hero in range works it; on completion it **becomes** that Token. Level gate from the recipe (SP-49). A Foundation with no recipe picked shows "choose what to build". Farmland is the same with Farming (SP-47). | `StationRecipe.js`, `RecipeResolver.js`, `BoardRunner.js`, `EffectActions.transform`, `StationRecipeModal.jsx` | A Stone Foundation with "Furnace" picked turns into a Furnace after a Construction hero finishes one cycle; with Construction too low the recipe shows as locked with its level. |
| **6.2 Academies** | A Fighter's Academy recipe on a Stone Foundation (SP-62), through the CMS. Promotion itself is untouched (TL-6). | content only (CMS) | An academy can be built and promotes a qualified hero as today. |

### Phase 7: The skill chains (content, plus small mechanics)

Seven lanes, parallel, each authored **in the CMS** (never by hand) with TL-5
placeholder numbers. §6 lists the content each needs. Each lane's "done when" is
**the chain running end to end in a new game**, with the dev panel's help.

| Slice | Chain |
|---|---|
| **7.1 Logging** | Oak Forest → Oak Sapling (grows) → Oak Tree (charges, drops Oak Wood + a 20% Oak Seed) → vanishes → respawns, paying 1 Oak Seed. No axe needed (TL-2). |
| **7.2 Mining** | Copper Mine → Copper Vein; Coal Mine → Coal Vein; a Quarry → Stone Outcrop giving **Stone** (a new item, needed by Stone Foundations). Upkeep: none, or a cheap one (director's call, SP-70 is per Token). No pickaxe needed (TL-2). |
| **7.3 Fishing** | Coast (shop) turns into a Shrimp Coast for a while, then back. Fishing yields Raw Shrimp while it lasts. |
| **7.4 Farming** | Farmland (shop, Foundation kind `farmland`) → planted as a Wheat Field → spawns Wheat Patches (grow to ripe, several charges, drop Wheat + sometimes Wheat Seed), paying 1 Wheat Seed each. One Orchard (Apple) to prove SP-73. |
| **7.5 Processing** | Wood / Stone Foundations → Workbench (Crafting: Oak Wood → Charcoal, Torch), Furnace (Smithing: Copper Ore + Charcoal/Coal → Copper Ingot), Cooking Pot (Cooking: Raw Shrimp + Charcoal → Shrimp). Copper Anvil in the shop, priced in Copper Ingots, with charges; near a Furnace it enables one smithed item. |
| **7.6 Explore** | One reworked Map (e.g. the Oak Forest Map) in the shop: each cycle takes 1 cooked food + 1 Torch and rolls a small themed loot table; charges; vanishes when spent (DP-7). |
| **7.7 Combat** | Goblin Camp (shop) → Goblin (weight ~95) / Goblin Chief (~5, tougher, better loot), shared camp cap. Tested with the dev combat grant (TL-3). Defeat behaves as FP-42. |

⭐ **7.0 (first):** before the lanes start, stop tool requirements from applying
to spawned gathering Tokens (TL-2): either clear `acceptedTokens` on the new
content (content-only), or, if the engine insists on them, a small change in
`RecipeResolver` / `Charges.planContextCharges`. The director picks the smaller
one and records it.

### Phase 8: UI for testing (TL-4)

Plain and functional; the Token UI rework restyles it later.

| Slice | What | Files | Done when |
|---|---|---|---|
| **8.1 Inspection lines** | The Token inspection panel shows, where relevant: a spawner's kind count and cap ("Oak Trees 4 / 5"), next spawn time, upkeep per spawn and whether it's paid; time left to grow or to turn back; a Foundation's chosen recipe and build progress; origin (placed/spawned) in dev mode. | `src/ui/components/drawer/TokenInspection.jsx` | Every new block's state can be read from the panel without dev tools. |
| **8.2 Upkeep Summary** | A panel (from the Bank drawer or HUD) listing **every ongoing cost**: per item, the total per minute across all spawners (and existing statement upkeeps), what's in the Bank, a rough "runs out in", and which Tokens are waiting unpaid. Plus a line for the Hall trickle's income. | new component under `src/ui/components/`, reads `SpawnerSystem` / `BlockUpkeep` | With two Forests and no seeds, the summary says Oak Seed is needed, shows 0 in the Bank, and lists both Forests as waiting. |
| **8.3 Alerts and mat cap** | A spawner's waiting reasons (at cap / needs item / no room) use the existing on-mat alert icon (and speech bubbles only if a hero is involved, per SB rules). The shop shows "Placed Tokens 12 / 40". | alert code in `WorkCheck.js` / `boardEvents.js`, shop panel | A waiting spawner shows an alert without hovering; the shop shows the cap. |

### Phase 9: Retirements

Each retirement is its own slice, done only after its replacement is merged.

| Slice | What | Notes |
|---|---|---|
| **9.1 Map bursts** | Delete `rollBurst` / `openMap` / burst landing and the gold map purchase. Maps are only Explore producers (7.6). | `Cartographer.js`, `data/maps.json` usage, `guildHallMaps.js`, `mapRegistry.js` |
| **9.2 Managers** | Delete `Managers.js` and FP-70's "hero waits for its Manager" (SP-55). | `Managers.js`, `HeroMotion`/flag code that references it |
| **9.3 Vault and Tray storage** | Goal 1: the Vault goes. Loot pickup, right-click deposit and the Vault drawer go; a burst "dropped as loot" path is already gone with 9.1. Delete the dormant Tray storage (`board.tray`, `addToTray`, `TRAY_CAPACITY`). Save format changes (fine under DP-10). | `VaultTransfer.js`, `TokenBank.js`, `BoardState.js`, `SpriteLayer.js`, Bank drawer UI |
| **9.4 Gold code** | Delete `CurrencyManager`, `CommerceSystem`, `TransactionProcessor` and their tests once nothing reads them. | `src/systems/economy/*` |
| **9.5 Quests** | Tutorial quests re-pointed at the new loop (buy from the shop, build on a Foundation, harvest a patch), rewarding items. Triggers `token_placed` / `token_exhausted` checked against the new events. | `tutorialQuests.js`, `QuestManager.js` |
| **9.6 Docs** | Mark the replaced parts of `free_playmat_roadmap_v1.md` (1.8 bursts, 1.9 Vault half, FP-19, FP-37, FP-45, FP-62, FP-70) and the concept's §7 table as superseded, pointing here. | docs only |

### Phase 10: The opening and the first playtest

| Slice | What | Done when |
|---|---|---|
| **10.1 New-game opening** | The starter set on the mat (SP-14, contents per SP-72, placeholders: Guild Hall, Oak Forest, Copper Mine, a few seeds in the Bank) and the Hall trickle's placeholder contents. | A new game can reach every chain in §6 without the dev panel. |
| **10.2 Playtest pack** | A short written checklist for the owner (what to try, what to watch for), a list of every placeholder number and where to change it in the CMS, and known issues. | ⭐ The owner plays it. Their feedback becomes roadmap v2. |

Version bump to **v0.9.0** in all five files (`package.json`,
`package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
`src-tauri/Cargo.lock`) and a tag, when the owner accepts the playtest build.

---

## 6. The test content set (tier one of each chain)

All authored in the CMS (Phase 7). ✱ = a new item or Token. Numbers are
placeholders (TL-5).

| Chain | Shop / Foundation | Spawned or worked Tokens | Items |
|---|---|---|---|
| Logging | Oak Forest (existing id, becomes a spawner) | Oak Sapling✱ → Oak Tree (existing) | Oak Wood, Oak Seed✱ |
| Mining | Copper Mine✱, Coal Mine✱, Quarry✱ | Copper Vein, Coal Vein (existing), Stone Outcrop✱ | Copper Ore, Coal, Stone✱ |
| Fishing | Coast (existing) | Shrimp Coast (existing) | Raw Shrimp |
| Farming | Farmland✱ (Foundation kind) | Wheat Field✱ → Wheat Patch✱; Apple Orchard✱ → Apple Tree (existing) | Wheat, Wheat Seed✱, Apple, Apple Seed✱ |
| Construction | Wood Foundation✱, Stone Foundation✱ | builds the stations below, and the academy | — |
| Crafting | Workbench (existing, on a Wood Foundation) | — | Charcoal, Torch✱ |
| Smithing | Furnace (existing, on Stone); Copper Anvil✱ (shop) | — | Copper Ingot, one copper item |
| Cooking | Cooking Pot (existing, on Wood) | — | Shrimp, one wheat or apple dish |
| Explore | Oak Forest Map (existing, reworked) | — | a small themed loot table |
| Combat | Goblin Camp✱ | Goblin✱, Goblin Chief✱ (or reuse the Thorn Elemental) | a loot item or two |
| Guild Hall | on the mat from the start | trickle | Oak Seed, maybe Oak Wood |

**Circularity check the content lane must pass:** starting from the opening
mat and the trickle alone, every Token in this table is reachable. (The dev
panel is for speed, not for filling gaps.)

---

## 7. Checkpoints with the owner

* ⭐ **After slice 1.1:** the nine skills on a Recruit (quick look).
* ⭐ **After Phases 3 and 5:** buy a Forest, watch it spawn, grow, be logged
  and respawn. **The first "does it feel right" moment**; worth doing before
  Phase 7 builds on it.
* ⭐ **After Phase 8.2:** the Upkeep Summary's layout.
* ⭐ **Phase 10.2:** the full playtest.
* Any time the brief for a slice needs a decision this document does not make.

## 8. Implementation status

| Slice | Status | Notes |
|---|---|---|
| 0.1 Baseline | ✅ Done 2026-09-25 | 12 known failures in 6 files, listed in §0.4; game boots |
| 0.2 Dev tools | ✅ Done 2026-09-25 | QA panel: Give item, Advance timers (1 s steps, max 2 h per click), Spawner kinds placeholder (`DevTools.getSpawnerKindCounts`, filled by 3.3). ⚠️ Wall-clock systems (LiveEffects expiry, quest cooldowns, sprite absorb, modifier expiry) do NOT fast-forward |
| 1.1 Nine starting skills | ✅ Done 2026-09-25 (⭐ checkpoint held: owner chose TL-7) | Recruit holds 9 (`RECRUIT_SKILL_SLOTS`); promoted jobs still 6 (`HERO_SKILL_SLOTS`). ⚠️ As merged, first promotion banks FIVE skills (level + XP kept, D-71), always incl. Construction, Farming, Explore; no promoted job holds Farming or Explore; the Warlord (whose signature was Construction) has no signature skill. Slice 1.2 (TL-7) removes the banking. `explore` id reused safely (no alias to `survival` existed) |
| 1.2 Promotion keeps the starting skills | ✅ Done 2026-09-25 | TL-7. `getJobSheet(jobId)` = all foundation skills + the job's own; Recruit 9 → base class 11 → advanced 13 (Warlord 12, still no signature). Re-training across branches still banks the old branch's non-foundation skills (D-71). Promotion gates unchanged (they read the six listed skills). Old saves' banked foundation skills return on load (`restoreBankedFoundation`). `HERO_SKILL_SLOTS` now means how many skills a job LISTS |
| 2.1 Hall upgrades in items | ✅ Done 2026-09-25 | Every track priced per rank as `[{itemId, quantity}]`, placeholder 10·n `item_oak_wood` (`placeholderPrices` in `guildUpgrades.js`, code not CMS data); rank 1 of Bunk Beds and Wishing Well free; all-or-nothing payment |
| 2.2 Gold removed from play | ✅ Done 2026-09-25 | No gold chip, GP, sell buttons or value badges; coins, Market outputs and Map gold entries credit nothing; quests pay 10 `item_oak_wood`. **Map buying kept, priced in Oak Wood** (`Cartographer.mapPrice`: authored gold ÷ 500, min 1) because with quests no longer paying Maps it is the only way a new game gets Tokens until the Shop (5.1); retire with 9.1. Leftovers for Phase 9: `SellControls.jsx` unused, `EntityRibbon` still knows `item_coins`, tutorial text still says Maps |
| 3.0 Data shapes | ✅ Done 2026-09-25 | §3.1; adds `foundationKinds` on recipes and `foundation.skill`, spawner family = spawns + grow chain |
| 3.1 Origin, mat cap, fixed pushes | ✅ Done 2026-09-25 | `BoardState.originOf/placedTokenIds`, `MatCap.js` (Mat Tuner *Token cap*, default 40, Hall exempt). Every non-spawn route makes `placed` (incl. Map bursts; a Vault round trip makes `placed`). A `here` spawn is `spawned`. The `Transforms` statement keeps origin but still pushes placed Tokens (only timed changes fix them). ⚠️ Pre-existing: `nearest_free` spawns almost never push (`besideBearer` lands inside the min gap) — fix in 3.3 |
| 3.2 Timed changes | ✅ Done 2026-09-25 | `TimedChanges.js`, handler table (turn_back, grows, turns), ticked in `BoardRunner.tick(delta)`; leftover time carries into the new Token (one big tick = many small); blocked change holds its clock full and retries; a turned Token only runs its turn-back clock. Verified live: sapling → tree at 30 s, Coast turns at 2 min and back at 3 min |
| 3.3 Spawners | ⬜ Not started | |
| 3.4 Guild Hall trickle | ⬜ Not started | |
| 4.1 CMS Token blocks | ✅ Done 2026-09-25 | Token editor section *Spawning and Building* (all six blocks); recipe editor *Builds on Foundation* checkboxes (`foundationKinds`); `FOUNDATION_KINDS` lives in `tokenConstants.js`; renames repoint the blocks. Today's data round-trips byte-identical. ⚠️ For 4.3: renaming a Token still does NOT repoint `tokenId` outputs in recipes |
| 4.2 Content audit | ✅ Done 2026-09-25 | One shared checker `src/systems/core/lifecycleAudit.js`, reached by the boot `ContentAudit` and the CMS Economy Audit (Data Integrity rows). Verified live: a broken spawner gives one message per problem; shipped data gives none |
| 4.4 Derived type knows the new blocks | ⬜ Not started | Found by 4.2: `deriveTokenType` calls a spawner-only Token a buff that does nothing, and CMS Recalculate would write `tokenType: 'buff'`. **Must land before Phase 7** |
| 4.3 Recipes that build | ✅ Done 2026-09-25 | Game: `recipesForFoundation`, `buildsOnFoundation`; building recipes never reach an ordinary station; `recipesForToken` returns the Foundation pool. CMS: ticking a kind turns the recipe card into Builds / Building cost / Build Time; Token renames now repoint `tokenId` outputs. ⚠️ Until 6.1 a placed Foundation would run as a plain station and drop its output as a sprite (no shipped Foundation yet) |
| 5.1 The Shop | ⬜ Not started | |
| 5.2 Dispose | ⬜ Not started | |
| 6.1 Build in place | ⬜ Not started | |
| 6.2 Academies | ⬜ Not started | |
| 7.0 Tool requirements off | ⬜ Not started | |
| 7.1–7.7 Chains | ⬜ Not started | |
| 8.1 Inspection lines | ⬜ Not started | |
| 8.2 Upkeep Summary | ⬜ Not started | |
| 8.3 Alerts and mat cap | ⬜ Not started | |
| 9.1–9.6 Retirements | ⬜ Not started | |
| 10.1 Opening | ⬜ Not started | |
| 10.2 Playtest pack | ⬜ Not started | |

## 9. Risks

| Risk | Mitigation |
|---|---|
| The CMS sync wipes content the editor doesn't model | Phase 4 before Phase 7, no exceptions; sandbox-route verification |
| Recruits with nine skills break promotion assumptions (`HERO_SKILL_SLOTS`) | Slice 1.1 records what breaks; the promotion overhaul (later) fixes it properly |
| Spawners and timers drift during time-bank replay | DP-2: every clock uses `delta`; a test replays 10 minutes at high speed and compares with 10 real ticks |
| Pushing performance with many spawned Tokens | The mat cap bounds placed Tokens, and kind caps bound spawned ones; measure a full mat once in Phase 7 |
| Parallel lanes collide in the shared checkout | Worktrees per lane (§0.2), merged one at a time |
| Seed stocks die out early (~1 tree in 9 drops no seed) | The Hall trickle includes a seed (SP-66); watch for it in the playtest |
| Retiring the Vault strands Tokens in old saves | DP-10: new games only |
