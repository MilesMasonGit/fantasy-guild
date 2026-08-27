# Recipe & Charges Rework — Roadmap v1

> **Status:** v1, authored 2026-08-27. Authoritative plan for the rework described
> in [`concept_recipe_and_charges_rework.md`](concept_recipe_and_charges_rework.md).
> The concept states the vision; **this document is what gets built**, and where
> the two disagree, this one wins.
>
> **Sequencing:** this rework is a **prerequisite** for the economic simulator
> described in [`economic_simulator_problem_space.md`](economic_simulator_problem_space.md).
> That work rebuilds EV and the solver on top of the schema landed here. §5 is the
> contract between the two.

---

## 1. Locked decisions

Taken with the project owner on 2026-08-27. **Do not re-litigate these.**

| # | Decision |
| :--- | :--- |
| **R-1** | **One merged recipe schema.** `data/recipes.json` and `data/tokenRecipes.json` collapse into a single shape. It carries `levelRequirement` from the former and `requiresContext` + skill pooling from the latter. ⚠️ **Revised 2026-08-27 — see R-9.** This was written believing both systems were live. They are not. |
| **R-2** | **Subskills are retired.** Recipes key on **skill**, not subskill. Every surviving reference to a subskill is out of date. |
| **R-3** | **Energy is retired entirely — the vital, not just the recipe field.** Charges have replaced it. Food and drink survive with a new purpose: **healing HP and applying status effects**. |
| **R-4** | **Unlimited tokens (`usesRemaining === null`) ignore charge deltas in both directions** and never deplete. A `+charges` effect on one is a no-op; so is a `-charges` cost. |
| **R-5** | **A freshly placed station defaults to its skill's lowest-level recipe**, always — regardless of who is assigned, or whether anyone is. If the worker cannot run it, the existing skill-too-low alert fires. |
| **R-6** | **EV and auto-balance fields are carried through untouched.** Migrate them verbatim into the new shape. Do not read them, write them, validate them, or design around them. They belong to the economic simulator rework. |
| **R-7** | **Item outputs go to the bank as today.** Only **Token** outputs use the floor-drop pipeline. |
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
| Skill-pooled recipes, opt-in per station | `recipePoolRegistry.js` |
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
| **P3** | **Recipe modal + gear badge — UI.** Gear icon via the existing alert badge system. Modal with the five-band hierarchy (concept §2.2): worker-craftable, worker threshold marker, guild-potential band, guild threshold marker, locked. **Bands on skill level only (R-12)** — context sufficiency is the token's alert badge, not the modal's job. Hover quick-inspect tooltip. | P2 | Not started |
| **P4** | **Context tokens as plain recipe inputs (R-10).** Tool tiers as structured data. Context-token charge costs as recipe inputs (§3.1.2). Wire into P1's atomic check. They gate nothing and define nothing — an unmet one is a missing input like any other. | P0, P1 | Not started |
| **P5** | **Token outputs via floor drop.** Reuse the map-burst floor-drop pipeline for Token outputs. Items still go to the bank (R-7). | P0 | Not started |
| **P6** | **CMS authoring.** Recipe Editor realigned to the Token Editor I/O paradigm. Duration + skill XP fields. Token inputs/outputs with charge deltas. Charge Delta field on statement/effect blocks. | P0, P1 | Not started |
| **P7** | **Retirement: subskills.** `SkillSystem.js`, `DatabaseManager.js`, `Mutators.test.js`, `data/subskills.json`, and six CMS files. Small and self-contained. | P0 | Not started |
| **P8** | **Retirement: the energy vital.** Large. Unwinds `RegenSystem`, `ConsumptionSystem`, `VitalBar`, `HeroState`, defeat penalties, equipment modifiers, `ParticleOverlay`, `BankTab`, and the CMS's energy terms. Food and drink are re-pointed at HP and status effects (R-3). | P1 | Not started |
| **P9** | **Handoff.** Update §5 to describe what actually shipped, and correct the stale claims in the economic simulator brief (§5.2). | all | Not started |

**Suggested order:** P0 → P1 → P2 → P3, with P4 / P5 / P6 fanning out once P0 and P1
land, and P7 / P8 taken as standalone sittings. P8 is a project in its own right and
should not be folded into a recipe sitting.

---

## 5. Handoff contract — economic simulator

### 5.1 What that rework can rely on

- **One recipe schema, one file.** After P0 there is a single recipe shape and a single
  data source. No pooled-vs-private fork, no second registry.
- **Recipes key on skill.** No subskill layer to model.
- **No energy term.** It is gone from recipes *and* from heroes. Any balance model
  inheriting an energy cost is modelling something that no longer exists.
- **Charges are the throttle.** Every consumption axis in the game is charges: station
  operational cost, context-token cost, effect-level deltas. A recipe's true cost is
  items + charges + time, and nothing else.
- **Duration and XP live on the recipe**, not on the station.
- **The EV fields are untouched and theirs.** `targetEV`, `calculatedEV`, `autoBalance`,
  `fieldLocks`, `profitSplit`, `liquidityEV`, `progressionEV`, `goldPerMinute`,
  `xpPerMinute` arrive in whatever state they are in today. This rework neither
  maintains nor trusts them.

### 5.2 Claims in the simulator brief that this rework invalidates

`economic_simulator_problem_space.md` was written before these decisions. **P9 must
correct it**, or the simulator will be designed against a game that no longer exists:

| Line | Stale claim | Reality after this rework |
| :--- | :--- | :--- |
| 46 | "Hero level does not affect speed or output" | Worker skill level scales craft speed, and completing a cycle awards that worker skill XP. |
| 64, 742 | A Context Token beside a Station decides which recipe runs | The player selects the recipe. Context tokens are declared *inputs* that gate it. |
| 729 | Data lives in `data/recipes.json` | Confirm the surviving path after P0. |

---

## 6. Risks

- **P0 is load-bearing for six other phases and for a whole separate rework.** Getting
  the schema wrong is the expensive mistake here. It is worth spending disproportionate
  care on P0 and treating P1–P8 as comparatively mechanical.
- **P8 is bigger than it looks.** "Retire energy" reads as one line and touches ~12 files
  across heroes, combat, equipment, UI and the CMS. It also requires food and drink to
  have a working replacement purpose *before* the vital comes out, or the consumables
  loop is dead in the interim.
- **The comment layer in this codebase is not trustworthy.** Code review round 2 found
  eight cases of fabricated rationale. Verify behaviour against code and tests, never
  against a comment — including the doctrine comments this rework is overturning.
