# Recipe & Charges Rework — Roadmap v1

> **Status:** v1, authored 2026-08-27. Authoritative plan for the rework described
> in [`concept_recipe_and_charges_rework.md`](concept_recipe_and_charges_rework.md).
> The concept states the vision; **this document is what gets built**, and where
> the two disagree, this one wins.
>
> **Sequencing:** this rework is a **prerequisite** for the economic simulator, briefed in
> `economic_simulator_problem_space.md` — ⚠️ which lives on the unmerged branch
> `economic-sim-brief`, **not here**. That work rebuilds EV and the solver on top of the
> schema landed here. **§5 is the contract between the two, and §5.2 lists corrections
> that brief still needs.**
>
> ---
>
> ## Status: complete, 2026-08-27
>
> **All phases landed on branch `recipe-charges-rework`.** P0, P1, P2, P2.5, P2.6, P3,
> P5, P6a, P6b, P7 built; **P4** absorbed into P1/P2; **P8 moved out** to a separate
> effects rework; **P9** (this handoff) done. Suite green at **1381 passed / 31 skipped**
> across 98 files.
>
> **Read §1 before touching any of this.** Eighteen decisions are locked there, and
> several are counter-intuitive enough that an agent acting on instinct will undo them:
> `CONFLICT` is deleted deliberately, the CMS sync has no empty-collection guard
> deliberately, an absent `chargeDelta` means −1 rather than 0, and hero energy is
> **still live** despite R-3's wording.
>
> **This document records where its own plan was wrong.** Six claims in the original
> roadmap were disproved by the work — R-1's premise, R-7's wording, R-16's count, the
> P4 scope, the P6 scope, and §5.1's energy claim. Each correction is inline and marked
> ⚠️ rather than silently edited, because the reasoning is the useful part.

---

## 1. Locked decisions

Taken with the project owner on 2026-08-27. **Do not re-litigate these.**

| # | Decision |
| :--- | :--- |
| **R-1** | **One merged recipe schema.** `data/recipes.json` and `data/tokenRecipes.json` collapse into a single shape. It carries `levelRequirement` from the former and `requiresContext` + skill pooling from the latter. ⚠️ **Revised 2026-08-27 — see R-9.** This was written believing both systems were live. They are not. |
| **R-2** | **Subskills are retired.** Recipes key on **skill**, not subskill. Every surviving reference to a subskill is out of date. |
| **R-3** | **Energy is retired entirely — the vital, not just the recipe field.** Charges have replaced it. Food and drink survive with a new purpose: **healing HP and applying status effects**. <br><br>⚠️ **Scope moved 2026-08-27.** The *recipe* half is done — `energyCost` left the schema in P0. **Retiring the hero energy vital is no longer part of this rework**; the owner has moved it into a separate **effects rework**. The decision stands; the work belongs elsewhere. Until that rework runs, hero energy is **live and load-bearing** — `RegenSystem`, `ConsumptionSystem`, `VitalBar`, `HeroState`, defeat penalties, equipment modifiers and the CMS energy terms all still read it. **Do not remove, deprecate or tidy any of it as a side effect of other work.** |
| **R-4** | **Unlimited tokens (`usesRemaining === null`) ignore charge deltas in both directions** and never deplete. A `+charges` effect on one is a no-op; so is a `-charges` cost. |
| **R-5** | **A freshly placed station defaults to its skill's lowest-level recipe**, always — regardless of who is assigned, or whether anyone is. If the worker cannot run it, the existing skill-too-low alert fires. |
| **R-6** | **EV and auto-balance fields are carried through untouched.** Migrate them verbatim into the new shape. Do not read them, write them, validate them, or design around them. They belong to the economic simulator rework. |
| **R-7** | **Item outputs are unchanged.** Only **Token** outputs are new work. ⚠️ **Wording corrected 2026-08-27 (P5).** This originally said item outputs "go to the bank", which is not what the code does: `BoardRunner.js:273` spawns them as **floor sprites** via `SpriteLayer.addSprite('item', …)`, and they reach the bank only when the player collects them or they absorb into an existing stack. The decision itself is unaffected — item outputs keep whatever they do today — but do not "fix" them to write to the bank directly. |
| **R-8** | **Station operational charge cost and effect-level charge deltas are two separate axes** that both apply. Concept §3.1 and §3.2 describe different mechanisms, not one mechanism twice. |

### Added 2026-08-27, after the P0 investigation

The investigation found R-1's premise false. `data/tokenRecipes.json` is `{}` — the game
runs **zero** recipes. `data/recipes.json` has no loader; `recipeRegistry.js` was deleted
on 2026-08-24 (CR2-119) and the file's only remaining reader in the tree is the fixture
import at `src/tests/CMSBalanceEngine.test.js:11`. P0 is therefore **not** a merge of two
live systems. It is one live-but-empty system plus an orphaned file.

| # | Decision |
| :--- | :--- |
| **R-9** | **Remap and migrate the 23 orphaned recipes.** Their names, inputs, outputs and level data are intact. Only the `skill` field is junk (`culinary`, `industry` — not skill ids; `tokenConstants.js:26` names this exact past failure). Recover skill from the **subskill name**, whose parents map cleanly: `forge`→`smithing`, `cooking`→`cooking`, `nature`→`nature`, `labor`→`mining`. Verified: of the 18 recipes carrying both `skillRequirement` and `levelRequirement`, **zero disagree**, so that data is trustworthy and one of the two can be dropped safely. |
| **R-10** | **Accept the subskill collapse, and do not add a station-level filter.** Smelting + Weaponsmithing + Toolsmithing + Jewelry all become `smithing`; Baking + Cooking become `cooking`. **Context tokens do not gate the pool — they are simple recipe inputs now.** Which recipes belong to which skill will change often during development, so do not build machinery that makes reassignment expensive. |
| **R-11** | **EV fields stay flat**, exactly as they sit today. Seven CMS engine files read them by name. R-6 is honoured literally: we do not touch what is not ours, including its shape. |
| **R-12** | **The recipe modal bands on skill level only.** It shows what the worker *can do*, by level. Missing context tokens are **not** a modal concern — insufficient inputs already surface as an alert on the station token itself. Do not duplicate that state in the modal. |
| **R-13** | **Every migrated recipe runs at a flat `durationMs: 10000`.** The card-era times (2000–21500ms, 14 of 23 under 10s) were authored for a different loop and are not worth preserving — the economic simulator rework rewires all of this. A flat 10s keeps the corpus usable as test content for P1–P4 without anyone guessing at pacing. Do not re-tune these by hand; that is the EV rework's job. |

### Added 2026-08-27, after P2

P2 found that **no shipped station can select a recipe**: `token_ceramics_kiln` is the only
Token with a `recipePool` and it points at `crafting`, which is empty, while all 23
recipes are `cooking` and `smithing`. Rather than patch the content, the owner changed how
station-ness is authored.

| # | Decision |
| :--- | :--- |
| **R-14** | **Station becomes a Token Effect — an authored statement, and it carries its skill.** One statement, e.g. "Works as a Smithing station", with the skill picked from a dropdown exactly as `ACTS_AS` picks its tag. That skill's recipes are the station's pool. **`recipePool` is retired.** This puts Station in line with every other token type, which the derivation already reads from statements: `RESTOCKS`→manager, `ACTS_AS`→context, `PROVIDES`/`GRANTS`→buff (`tokenTypeDerivation.js:65-84`). It also satisfies R-10 — reassigning a station's skill is one dropdown. |
| **R-15** | **The statement is the only way to be a Station.** The current inference — "has a work cycle with inputs" (`tokenTypeDerivation.js:80`) — is deleted. A Token is a Station because it says so. Any shipped Token that relied on the inference gets a Station statement authored onto it. |
| **R-16** | **Prune the 19 unusable migrated recipes.** Once shipped stations pooled the P0 corpus, 16 recipe inputs turned out to have no producer anywhere in the game and two context tags no provider. The owner's call: *"We don't need that content. I'll just recreate it later, it's not a lot of work."* Only **3** recipes survive — Charcoal (smithing L5), Flour (cooking L1), Shrimp (cooking L1). ⚠️ **Do not delete the art assets** for the pruned content.<br><br>⚠️ **Corrected during P2.6.** This first said 4, keeping Copper Sword, on the claim that its `item_copper_ingot` was Token-produced by `token_forge`'s config block. That was wrong: **P2.5 made a station's pooled recipes _replace_ its config route, not supplement it** (`effectiveIO` is `recipe?.inputs ?? def?.config?.inputs`, `RecipeResolver.js:194`; `productionRoutes` returns recipes instead of the config entry, `tokenRegistry.js:168`). So the Forge's smelting route was already dead, copper ingot's only live producer was `recipe_copper_ingot`, and that recipe dies for wanting the unprovided `Fuel` tag. The owner chose to prune the sword rather than revive the chain. Note `item_copper_sword` is consequently unauthored while `data/enemies.json:36` still drops it. |
| **R-17** | **Item inputs name a specific `itemId`. Tag-shaped item inputs are retired.** `{tag: "Fuel", quantity: 1}` as a *material* is gone. **Tool and context requirements keep tag + tier** — `{tag: "pickaxe", minTier: 1}` — because that hierarchy is what lets a Tier 2 tool satisfy a Tier 1 requirement without relisting every qualifying Token. Concept §2.4 stands; P4 stands, minus tag-shaped materials. |
| **R-18** | **Sync writes every file unconditionally, recipes included — no empty-collection guard.** Asked during P6a and declined: full-file replacement is the established CMS-53 behaviour for `items.json`, `tokens.json` and `maps.json`, and recipes behave the same. ⚠️ **The consequence is real and accepted:** there is no game→CMS import path (CMS-4 removed it), so opening the CMS in a fresh browser profile and pressing Sync will overwrite `data/tokenRecipes.json` with `[]`. Recovery is via git. **This is a decision, not a defect — do not add a guard without asking the owner.** |

---

## 2. What this rework overturns

`src/systems/board/RecipeResolver.js` opens with a signed doctrine that this rework
**deliberately reverses**. The next agent to read that file must not "restore" it.

| Superseded | Was | Becomes |
| :--- | :--- | :--- |
| **D-18** | Adjacency *defines* what a station makes. | The player selects the recipe explicitly; adjacency *gates* it. |
| **D-19** | A context Token with nothing relevant adjacent is inert. | Unchanged in spirit — context is now a declared recipe input. |
| **D-20** | Conflicting context puts the station in an error state. | **Unreachable.** Explicit selection cannot conflict. |
| **"No menus"** | "There is deliberately no recipe dropdown. The board is the interface." | There is a recipe modal. The board still gates, but no longer decides. |

**Consequences to execute, not merely note:**

- `RECIPE.CONFLICT` and `ALERT.CONFLICT` become unreachable and are **deleted**, along
  with their tests and the `setAlert(..., ALERT.CONFLICT)` branch at
  `BoardRunner.js:463`.
- `ALERT.NO_RECIPE` (`BoardRunner.js:476`) changes meaning: under R-5 a placed station
  always has a recipe, so this fires only for a station whose skill pool is empty.
  Decide during P2 whether it survives at all.

  **Decided in P2: it survives, re-meant as "cannot run its recipe".** The empty-pool
  case is the rarer half; the common one is a station whose *selected* recipe names a
  context Token that is not beside it, which is exactly the state the alert already
  reported and already named the missing Token for. Deleting it would have meant either
  a silent stall or a new alert doing the same job under a new name. Its hint text
  changed with its meaning ("This station is missing a Token its recipe needs beside
  it"); `ALERT.CONFLICT` is deleted outright.
- The doctrine comment block at the head of `RecipeResolver.js` is **rewritten**, not
  left in place with the code changed underneath it. A stale rationale comment is worse
  than none — this repo has a documented history of exactly that failure.

---

## 3. Foundations already in place

Verified in the current tree. These are extension points, not new builds.

| Need | Already exists |
| :--- | :--- |
| Adjacency + tag→highest-tier resolution | `contextTiersAround()`, `RecipeResolver.js:52` |
| Hierarchical tool-tier fulfilment (concept §2.4) | `checkAcceptedTokens()`, `RecipeResolver.js:82` |
| Worker skill gating + alerts | `heroRequirementAlert()`, `BoardRunner.js:93` |
| Worker speed scaling | `BoardRunner.js:108` |
| Charge storage, unlimited semantics | `usesRemaining`, `BoardState.js:35` |
| Charge badge + delta floater UI | `BoardTile.jsx:19`, `BoardTile.jsx:95` |
| Restock-on-drop, partial-charge sell value | `Placement.js:374`, `TokenBank.js:209` |
| Skill-pooled recipes | `recipePoolRegistry.js` — ⚠️ the *opt-in per station* half is gone: P2.5 retired `recipePool` and the private `recipes[]` fork, so there is one path. |
| Alert vocabulary | `ALERT`, `boardEvents.js:130` |

---

## 4. Phases

Each phase is one coherent slice, committed at the end.

| # | Phase | Depends on | Status |
| :--- | :--- | :--- | :--- |
| **P0** | **Recipe schema + data migration.** Land the shape proposed in `recipe_schema_proposal_v1.md`. Remap and migrate the 23 orphaned recipes (R-9); EV fields flat and verbatim (R-6, R-11); skill replaces subskill (R-2); `energyCost` dropped (R-3). Delete the orphaned `data/recipes.json` and repoint its one test fixture. Tests for the migration before the migration. **Two hazards found and not yet fixed:** `def.charges` is dead — the live pool is `def.uses`, and Tokens carry both with *different* values; and `outputs[].chance` uses `1`-for-certain in `recipes.json` versus `100` elsewhere, so a verbatim copy silently makes every recipe a 1% drop. | — | **Done 2026-08-27** |
| **P1** | **Charges engine.** Effect-level charge deltas (concept §3.2): negative, zero, positive, ceiling at initial charges. Atomic all-or-nothing requirement check (§3.3). Depletion → destroy. First-come-first-served sharing; lowest-remaining-first prioritisation. R-4 throughout. | — | **Done 2026-08-27.** `src/systems/board/Charges.js` is the one place charges are read, moved or spent; `BoardRunner`, `TriggerSystem` and `RecipeResolver` route through it. New alert `ALERT.CHARGES`. Effect deltas are `statement.chargeDelta` — **absent means −1**, not 0, so every statement authored before the field keeps wearing as it did. |
| **P2** | **Station recipe selection — engine.** `selectedRecipeId` on the token instance. R-5 default on placement. Persist until vaulted. Save migration for existing placed stations. Rework `RecipeResolver` from matching to validation. Delete the CONFLICT path (§2). | P0, P1 | **Done 2026-08-27.** `src/systems/board/StationRecipe.js` owns `selectedRecipeId` — default, set, clear, and the save backfill. `resolveRecipe` validates rather than matches and returns the selected recipe even while gated, so callers can name what is missing. `RECIPE.CONFLICT` and `ALERT.CONFLICT` are deleted. **`ALERT.NO_RECIPE` survives, re-meant**: it now fires when a station cannot run the recipe it is set to (missing context), or has an empty pool — see §2 note below. **No save-schema bump**: the field is optional and backfilled on load, as Tray positions were. |
| **P2.5** | **Station becomes a statement (R-14, R-15).** New Station statement keyword carrying a skill. `recipePool` retired; the cycle-with-inputs inference deleted from `tokenTypeDerivation.js`. Author Station statements onto the shipped Tokens that need them — which is also what unblocks P3, since nothing shipped can currently select a recipe at all. | P2 | **Done 2026-08-27.** `KEYWORD.STATION` (`Works as`) carries a skill id; `stationSkillOf` in `statements.js` is the one reader. `deriveTokenType` reads it above the Restocks rung and the cycle-with-inputs inference is deleted. `recipePool` **and** the private `recipes[]` fork are both retired — `recipesForToken` has one path. Authored onto `token_forge` (smithing), `token_campfire` (smithing — its Charcoal recipes live there), `token_windmill` (cooking) and `token_ceramics_kiln` (crafting, **pool still empty**). CMS: a skill dropdown on the statement row; the Token editor's pooling checkbox writes the statement. |
| **P2.6** | **Prune the corpus to what works (R-16, R-17).** Delete the 19 recipes whose inputs nothing produces or whose context tags nothing provides, leaving 3. Retire tag-shaped item inputs; keep tag+tier tool requirements. Retire the two characterisation tests that pinned the gaps, and restore Rule 1's consume-side check to a hard assertion now that it can pass. ⚠️ **Art assets stay.** | P2.5 | **Done 2026-08-27** |
| **P3** | **Recipe modal + gear badge — UI.** Gear icon via the existing alert badge system. Modal with the five-band hierarchy (concept §2.2): worker-craftable, worker threshold marker, guild-potential band, guild threshold marker, locked. **Bands on skill level only (R-12)** — context sufficiency is the token's alert badge, not the modal's job. Hover quick-inspect tooltip. | P2 | **Done 2026-08-27.** `RecipeBands.js` computes the bands (worker / guild / locked) from skill levels alone; `StationRecipeModal.jsx` renders them with both threshold markers, which are drawn whether or not the bands around them have rows. `StationGearBadge` in `BoardTile.jsx` is the handle and the hover preview. **Only the locked band is disabled** — a guild-band recipe stays selectable, which is also what keeps an unworked station (worker level 0) usable. **Empty pool:** the gear badge still shows and the modal says the skill has no recipes; hiding it would make an authored station indistinguishable from an ordinary Token. |
| **P4** | ~~**Context tokens as plain recipe inputs (R-10).**~~ **Absorbed by P1/P2 — closed 2026-08-27 without its own agent.** P1 built the context-charge planning (lowest-remaining-first, spreading across providers, unlimited providers charge nothing, first-come-first-served across stations) and P2 built tier-comparing validation and missing-context reporting. The only gap left was that **nothing pinned the tier hierarchy itself** — every `minTier` test in the suite asked for tier 1 and supplied tier 1, which passes whether the comparison is `>=` or `===`. Closed by `src/tests/ContextToolTiers.test.js` (5 tests): a Tier 2 tool satisfies a Tier 1 requirement, a Tier 1 does not satisfy a Tier 2. ⚠️ No shipped recipe declares `requiresContext` since the P2.6 prune, so this is fixture-proven only.<br><br>**Original scope:** Tool tiers as structured data. Context-token charge costs as recipe inputs (§3.1.2). Wire into P1's atomic check. They gate nothing and define nothing — an unmet one is a missing input like any other. | P0, P1 | **Closed 2026-08-27 (absorbed).** |
| **P5** | **Token outputs via floor drop.** Reuse the map-burst floor-drop pipeline for Token outputs. Item outputs are unchanged — they are floor sprites too, per R-7's correction. | P0 | **Done 2026-08-27.** `BoardRunner`'s output loop gained a `tokenId` branch calling `SpriteLayer.addSprite('token', …)` with `tokenStartingUses`, exactly as `Cartographer.openMap` does. **One sprite per copy**, not one stack of `quantity`: `SpriteLayer` merges only `kind: 'item'`, and both collection paths build one instance per sprite regardless of quantity. **No board-full case exists** — item outputs and Map bursts both call `addSprite` unconditionally and the floor is D-138's unbounded overflow, so this matches. Not pushed to `produced` (that list is matched against `when.watchItemId`). ⚠️ Fixture-proven — `src/tests/TokenOutputDrops.test.js`; no shipped recipe declares a Token output. ⚠️ Observed live: shipped Tokens have no `uses` authored, so a crafted copy of one drops unlimited — the same `def.charges` vs `def.uses` content gap P0 recorded, not a P5 behaviour. |
| **P6a** | **Give recipes a sync path at all.** ⚠️ **`syncToGame` (`cms/src/engine/fileUtils.js:56`) writes only `items.json`, `tokens.json` and `maps.json` — recipes have never reached the game from the CMS.** Authoring UI is worthless until this exists, so it goes first and alone. **Two hazards, both capable of silent data loss:** (1) `syncToGame` runs `state.recalculateEconomy(globals)` over its payload before writing — putting recipes through that would let the economy pass rewrite their EV fields, **violating R-6**; the EV fields must round-trip byte-identical. (2) The CMS's known failure mode is that **sync destroys content the CMS does not model** — any recipe field absent from the entity store is lost on the first sync. Land this with a round-trip test before any editor work. | P0, P1 | **Done 2026-08-27.** `cms/src/engine/recipeSync.js` builds the payload; `syncToGame` writes a fourth file, `tokenRecipes.json`. **Recipes bypass the economy pass** — they are flattened from the store's `recipePools`, which `recalculateEconomy` never writes back (it discards `result.recipes` and sets only items/tokens/maps). A recipe is **spread, never rebuilt**, so fields with no editor behind them — `requiresContext`, `stationChargeCost`, `durationMs`, `tokenId` outputs, the nine EV fields — survive along with their key order. `src/tests/RecipeSyncRoundTrip.test.js` pins the byte-identical round trip. ⚠️ `data/tokenRecipes.json` lost its trailing newline: the hand-maintained file had one and the CMS writer emits none, exactly as for the other three files. |
| **P6b** | **CMS authoring UI.** Recipe Editor realigned to the Token Editor I/O paradigm. Duration + skill XP fields. Token inputs/outputs. **A Charge Delta field on statement/effect blocks — `chargeDelta` currently has _zero_ CMS presence** (P1 built the engine side; nothing can author it). Note P1's rule that an unwritten `chargeDelta` means −1, not 0, so the field should default to *writing* an explicit value rather than leaving it blank. | P6a | **Done 2026-08-27.** `cms/src/components/shared/IOEntryList.jsx` is the Token editor's I/O control, lifted out of `SupplyChainColumn` and rendered by the Recipe editor too — one control, not two. Outputs accept a **Token** (`{tokenId, chance, minQty, maxQty}`, the shape `BoardRunner`'s output loop branches on); inputs stay items-only (CMS-43, R-17). Context requirements author `minTier` and `chargeCost`, not just the tag. **Charge delta:** `DEFAULT_STATEMENT_CHARGE_DELTA` moved to `statements.js` so the CMS can read it without the board runtime, `makeStatement` **stamps an explicit `-1`** on the three keywords that can carry a trigger, and the editor's box shows that -1 rather than a blank. Nothing is stamped on a keyword that can never fire — `TriggerSystem.fireStatement` is the only reader and it only sees statements with a `When` clause. |
| **P7** | **Retirement: subskills.** `SkillSystem.js`, `DatabaseManager.js`, `Mutators.test.js`, `data/subskills.json`, and six CMS files. Small and self-contained. | P0 | **Done 2026-08-27.** `data/subskills.json` deleted along with its `DatabaseManager` glob; the dead `subSkillId` field left the `hero_leveled` payload (always `null` by construction, no subscriber read it); the six CMS references went, including the prompt schemas in `contentGenerator.js`. **The survey missed `data/stations.json`** — seven orphaned `subskillId` keys, four pointing at ids in the deleted file; stripped. No save carried subskill state, so no backfill and no schema bump. `getSkillLevel` and `requirementFailure` were never subskill-aware, so hero gating is untouched. Four mentions survive on purpose: they *enforce* the retirement rather than surviving it. |
| **P8** | **Retirement: the energy vital.** Large. Unwinds `RegenSystem`, `ConsumptionSystem`, `VitalBar`, `HeroState`, defeat penalties, equipment modifiers, `ParticleOverlay`, `BankTab`, and the CMS's energy terms. Food and drink are re-pointed at HP and status effects (R-3). | P1 | **MOVED OUT 2026-08-27 — not this rework's work.** The owner has folded it into a separate **effects rework**. It was never a phase-sized job: ~12 files across heroes, combat, equipment, UI and the CMS, and it needs food and drink to have a working replacement purpose *before* the vital comes out, or the consumables loop is dead in between. ⚠️ **Until that rework runs, hero energy is live.** Leave it alone. |
| **P9** | **Handoff.** Update §5 to describe what actually shipped, and correct the stale claims in the economic simulator brief (§5.2). | all | **Done 2026-08-27.** §5.1 rewritten against what actually shipped — including the correction that **hero energy is still live**, which §5.1 previously denied outright once P8 moved out. §5.2 could not be applied at source: the brief is not on this branch. See the warning there. |

**Suggested order:** P0 → P1 → P2 → P3, with P4 / P5 / P6 fanning out once P0 and P1
land, and P7 / P8 taken as standalone sittings. P8 is a project in its own right and
should not be folded into a recipe sitting.

---

## 5. Handoff contract — economic simulator

### 5.1 What that rework can rely on

- **One recipe schema, one file.** After P0 there is a single recipe shape and a single
  data source. No pooled-vs-private fork, no second registry.
- **Recipes key on skill.** No subskill layer to model.
- **No energy term _on a recipe_.** `energyCost` left the schema in P0. ⚠️ **Hero energy
  is still live** — retiring the vital moved into a separate effects rework (see R-3 and
  the P8 row). So: do not model an energy cost for crafting, and do not assume heroes
  have no energy. Both halves of that sentence matter.
- **Charges are the throttle for crafting.** A recipe's cost is items + charges + time:
  station operational cost (`stationChargeCost`), context-token cost (`requiresContext[].chargeCost`),
  and effect-level deltas (`statement.chargeDelta`). ⚠️ An **absent** `chargeDelta` means
  **−1**, not 0.
- **Duration and XP live on the recipe**, not on the station — `durationMs` and `xp`.
- **A station declares its skill in a statement**, not a field. `recipePool` is retired;
  `stationSkillOf(def)` is the one reader. A station's pool is every recipe of that skill.
- **The corpus is deliberately 3 recipes** — Charcoal (smithing L5), Flour (cooking L1),
  Shrimp (cooking L1). The other 20 were pruned as unrunnable (R-16). This is test
  material, not content: **do not calibrate anything against its numbers**, and note
  `durationMs` is a flat 10000 on all three by fiat (R-13), not by design.
- **The CMS can now write recipes.** `syncToGame` emits `tokenRecipes.json` as a fourth
  file, and recipes deliberately **bypass `recalculateEconomy`** so it cannot rewrite
  them. If your rework wants the economy pass to own recipe balance, that bypass in
  `cms/src/engine/recipeSync.js` is the seam you will want to change — it is one function.
- **The EV fields are untouched and theirs.** `targetEV`, `calculatedEV`, `autoBalance`,
  `fieldLocks`, `profitSplit`, `liquidityEV`, `progressionEV`, `goldPerMinute`,
  `xpPerMinute` arrive in whatever state they are in today. This rework neither
  maintains nor trusts them.

### 5.2 Claims in the simulator brief that this rework invalidates

⚠️ **`economic_simulator_problem_space.md` is NOT on this branch or on `main`.** It exists
only on the unmerged branch **`economic-sim-brief`** (commits `e3b34de`, `bc8a843`), which
is another session's work. **P9 deliberately did not edit it** — writing to a file that
only exists on someone else's unmerged branch would create a conflicting duplicate rather
than a correction.

**So these corrections must be applied on `economic-sim-brief`, by whoever owns it.**
Line numbers are as of `bc8a843`. Until then, that brief describes a game that no longer
exists in four places:

| Line | Stale claim | Reality after this rework |
| :--- | :--- | :--- |
| 46 | "Hero level does not affect speed or output" | Worker skill level scales craft speed (`BoardRunner.js:108`), and completing a cycle awards that worker skill XP. |
| 64, 742 | A Context Token beside a Station decides which recipe runs | **The player selects the recipe** from a modal. Context tokens are declared *inputs* — they gate a cycle, they do not choose it. D-18/D-19/D-20 and "no menus" are reversed (§2). |
| 729 | Data lives in `data/recipes.json` | `data/recipes.json` is **deleted**. The single source is `data/tokenRecipes.json`, a flat array. |
| §1 table | "Station — consumes items and produces others" as a Token *kind* | A Station is now an authored **statement** carrying a skill (R-14). The "cycle with inputs" inference is deleted (R-15). |

---

## 5b. Found in passing, not fixed

Both surfaced while verifying P2.6 in the running game. Neither belongs to this rework.

- **All three shipped stations carry dead `config` blocks.** `token_forge`, `token_campfire`
  and `token_windmill` still declare `config.outputs` that their pooled recipes now shadow
  (see R-16's correction). Charcoal and Flour are harmless duplicates of surviving recipes;
  **the Forge's `item_copper_ingot` route is orphaned content** — the game's only source of
  that item, now unreachable. Schedule the cleanup deliberately rather than letting a later
  phase delete it in passing.
- **`getRosterLimit()` returns 0 on a fresh game**, so `isRosterFull()` is true with zero
  heroes and `createHero` refuses every call. This is the root cause of the "a fresh save is
  unplayable" symptom that code review round 2 recorded and that three agents in this rework
  hit blind. Verified live: `{count: 0, limit: 0}` on a new game.

---

## 6. Risks

Written before the work; kept, with what actually happened.

- **P0 was load-bearing for six other phases and for a whole separate rework.** ✅ Held
  up. The schema shipped in P0 and never needed reshaping — P5's Token outputs and P6b's
  authoring both fitted the shape as authored.
- **P8 is bigger than it looks.** ✅ Correct, and acted on: it left this rework entirely.
- **The comment layer in this codebase is not trustworthy.** ✅ Repeatedly confirmed, and
  it cut both ways — this rework's *own* documents were the ones most often wrong, and
  every phase found something in its brief that the code contradicted. Verify against
  code and tests, never against prose, **including this document**.

### What is proven only by fixtures

Three things ship untested against real content, because the corpus was pruned to 3
recipes and none of them exercises these paths:

- **Tool tiers** (`ContextToolTiers.test.js`) — no shipped recipe declares `requiresContext`.
- **Token outputs** (`TokenOutputDrops.test.js`) — no shipped recipe declares a `tokenId` output.
- **Charge deltas above the default** — no shipped statement authors a non-default `chargeDelta`.

They work. They have simply never run on content the player can reach. The first real
authoring pass is where that gets tested.

⚠️ **When authoring the first Token-output recipe**, check the output Token has `uses`
authored — 14 of 39 shipped Tokens do not, including `token_copper_woodaxe` and
`token_campfire`, and a crafted copy of one drops as **unlimited**.
