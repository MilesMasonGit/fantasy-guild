# Merged Recipe Schema — Proposal v1

> **Status:** proposal, authored 2026-08-27. Phase **P0** of
> [`recipe_and_charges_roadmap_v1.md`](recipe_and_charges_roadmap_v1.md).
> **Nothing here is built.** No production code was written and no data was
> migrated. This document exists to be approved or rejected.
>
> Everything below was checked against the code, not against comments. Where a
> comment and the code disagreed, the code won, and the disagreement is called
> out.

---

## 0. Read this first — the ground shifted

Three things turned out not to be true, and they change what P0 actually is.

### 0.1 The game does not load `data/recipes.json`. Nothing does.

`src/config/DatabaseManager.js:31-37` loads **only** `data/tokenRecipes.json`.
The comment there says the card-era `recipes.json` list and the
`recipeRegistry.js` that loaded it were deleted on 2026-08-24 (CR2-119) — and
unlike most comments in this repo, this one checks out. A whole-tree search for
`recipes.json` finds exactly two references:

| File | What it does |
| :--- | :--- |
| `src/config/DatabaseManager.js:32` | mentions it in a comment, does not load it |
| `src/tests/CMSBalanceEngine.test.js:11` | imports it as a **test fixture** for the balance solver |

So `data/recipes.json` is a **dead file with one test reader**. It is not
content the game runs. It is a corpus of 40 authored recipes and their EV
numbers, sitting on disk.

### 0.2 `RecipeEditor.jsx` does not edit `recipes.json` either.

The brief says the CMS Recipe Editor edits `recipes.json`. It does not.
`cms/src/components/editors/RecipeEditor.jsx:23` reads `s.recipePools` from
`useEntityStore` — the **new** skill-pooled collection that syncs to
`data/tokenRecipes.json`. The fields it authors are `name`, `requiresContext`,
`inputs`, `outputs`, `cycleTimeMs`, `xp` (lines 157, 226-279, 346, 358). It
authors **no** `subskillId`, **no** `energyCost`, **no** `levelRequirement`, and
**none of the EV fields**.

Nothing in the tree edits `recipes.json` any more. It was orphaned by CR2-119
and by the CMS's own move to pooled recipes.

### 0.3 `data/tokenRecipes.json` is `{}`. The game has zero recipes.

The file is literally an empty object. One Token — `token_ceramics_kiln`
(`data/tokens.json:300`) — declares `recipePool: "crafting"`, and the crafting
pool is empty, so it makes nothing. No Token in `data/tokens.json` declares a
private `recipes[]` array (a search for `"recipes"` in that file returns zero
hits).

**What this means for P0.** The roadmap frames P0 as "merge two live systems".
It is really: **one live-but-empty system, and one orphaned data file.** There
is almost nothing to migrate and almost nothing to break. The expensive part of
P0 is getting the *shape* right for phases P1-P6, not moving data. That is good
news, and it also raises a real question about whether `recipes.json` should be
migrated at all (Q1 below).

---

## 1. The proposed schema

One shape. One file: **`data/tokenRecipes.json`**, kept as the filename because
it is the one `DatabaseManager` already loads and the one the CMS already syncs
to. (Renaming it to `data/recipes.json` after deleting the old one is cosmetic
and can happen at P9 if wanted.)

**Structural change: a flat array, not an object keyed by skill.** Today the
file is `{ "cooking": [ ... ], "crafting": [ ... ] }`, and a recipe has no
global id — the Recipe Editor's own comment says a recipe is identified only by
"a position in their skill's pool" (`RecipeEditor.jsx:17-20`). **P2 needs
`selectedRecipeId` on a station instance and needs it to survive a save/load.**
An array index into a pool is not a safe id: inserting a recipe in the CMS
renumbers every station's saved selection. So every recipe gets a stable global
`id`, and the skill becomes a field on the recipe. The pool is then just a
filter.

```jsonc
[
  {
    // ── Identity ────────────────────────────────────────────────────────────
    "id": "recipe_copper_sword",     // Stable, globally unique. This is what a placed station saves as its selection.
    "name": "Copper Sword",          // What the player reads in the recipe modal.

    // ── Who can make it, and where ──────────────────────────────────────────
    "skill": "smithing",             // The skill this recipe belongs to. Must be a real skill id from skillRegistry.js. Replaces subskillId (R-2).
    "levelRequirement": 3,           // The worker's level in that skill must be at least this. Drives the modal's five-band hierarchy.

    // ── Time and reward ─────────────────────────────────────────────────────
    "durationMs": 6000,              // Base seconds-in-milliseconds for one craft cycle, before worker speed and buffs.
    "xp": 12,                        // Skill XP awarded to the assigned worker on a completed cycle.

    // ── What it consumes ────────────────────────────────────────────────────
    "inputs": [                      // Item costs, drawn automatically from the bank. Unchanged from today's shape.
      { "itemId": "item_copper_ingot", "quantity": 2 }
    ],

    "requiresContext": [             // Context Tokens that must sit adjacent. Structured objects, not bare tag strings.
      {
        "tag": "anvil",              // The capability tag an adjacent Token must provide (its "Acts as" statement).
        "minTier": 1,                // Minimum tier. A tier-2 anvil satisfies a tier-1 requirement (concept §2.4).
        "chargeCost": 0              // Charges deducted from that adjacent Token per cycle. 0 = the tool is present but not consumed (R-8, concept §3.1.2).
      },
      {
        "tag": "hammer",
        "minTier": 1,
        "chargeCost": 1              // This recipe wears the hammer down one charge per swing.
      }
    ],

    "stationChargeCost": 1,          // Charges deducted from the STATION itself per cycle. Separate axis from context costs (R-8). 0 means the station never wears.

    // ── What it produces ────────────────────────────────────────────────────
    "outputs": [                     // Every entry is one of three kinds, distinguished by which id field it carries.
      {
        "itemId": "item_copper_sword", // An ITEM output. Goes to the bank as today (R-7).
        "chance": 100,               // Percent chance this entry produces anything at all.
        "minQty": 1,                 // Lower bound of the rolled quantity.
        "maxQty": 1                  // Upper bound of the rolled quantity.
      },
      {
        "tokenId": "token_slag",     // A TOKEN output. Uses the map-burst floor-drop pipeline instead of the bank (R-7, P5).
        "chance": 15,
        "minQty": 1,
        "maxQty": 1,
        "usesRemaining": null        // Charges the dropped Token spawns with. null = the Token type's own default.
      }
      // A third kind, { "currency": "gold", ... }, already exists on Token
      // configs (makeCurrencyOutputEntry, useEntityStore.js:373). Carried
      // forward unchanged so a recipe can pay gold.
    ],

    // ── Authoring metadata ──────────────────────────────────────────────────
    "tags": [],                      // Free-form authoring labels. Carried from today's recipes.json; read by nothing at runtime.
    "isLocked": false,               // CMS-side "do not let the solver touch this". Carried verbatim.

    // ── The economic simulator's territory — DO NOT TOUCH (R-6) ─────────────
    "balance": {                     // One opaque bag. This rework moves it and never opens it.
      "targetEV": 1.05,
      "calculatedEV": 1.448,
      "autoBalance": true,
      "fieldLocks": { "quantity": false, "xpAwarded": false },
      "profitSplit": { "item": 0.8, "xp": 0.2 },
      "liquidityEV": 1.038,
      "progressionEV": 0.41,
      "goldPerMinute": 21.82,
      "xpPerMinute": 54.55
    }
  }
]
```

### Why `requiresContext` becomes objects

Today it is an array of bare tag strings (`["ctx_pie_tin"]`), matched with
`.every(tag => available.has(tag))` at `RecipeResolver.js:139-141`. That
expresses presence and nothing else. The roadmap requires the schema to express
**minimum tiers** and **charge costs deducted from adjacent context tokens**, and
neither fits in a string.

The machinery for tiers already exists and is verified working:
`contextTiersAround()` (`RecipeResolver.js:52`) returns highest-provided-tier per
tag, and `checkAcceptedTokens()` (`RecipeResolver.js:82-105`) already does
`(tiers[req.tag] || 0) < minTier` against Token-level `acceptedTokens`. The
proposed `requiresContext` entry is deliberately **the same shape as an
`acceptedTokens` entry plus `chargeCost`**, so P4 can reuse that comparison
rather than write a second one.

`acceptedTokens` on the Token definition stays where it is. It answers "this
Token needs a pickaxe to exist at all" (Copper Ore); `requiresContext` answers
"this recipe needs an anvil". Both apply.

### Where the retired things went

- `subskillId` → replaced by `skill` (R-2).
- `energyCost` → deleted (R-3).
- `baseTickTime` / `cycleTimeMs` → unified as `durationMs`. **See Q4 — these two
  fields are not the same magnitude and picking one silently rescales the game.**

---

## 2. Field-by-field migration table

### 2a. From `data/recipes.json` (the orphaned file, 40 recipes)

| Today | Becomes | Note |
| :--- | :--- | :--- |
| `id` | `id` | Kept. Already `recipe_*` on every entry. |
| `name` | `name` | Kept. |
| `subskillId` | **dropped** → `skill` | R-2. **The mapping is not clean. See Q1.** |
| `skill` | `skill` | Present on 21 of 40 recipes, with values `culinary` and `industry` — **neither is a real skill id.** See Q1. |
| `levelRequirement` | `levelRequirement` | Kept. R-1 names this explicitly. Present on all 40. |
| `skillRequirement` | **dropped** | A duplicate of `levelRequirement` present on 22 entries. On `recipe_copper_ingot` it is `5`, matching `levelRequirement: 5`. I did **not** verify all 22 agree — if the migration is run, that must be asserted first (see §6, T4). |
| `baseTickTime` | `durationMs` | Rename only. Values run 2000–6000ms. See Q4. |
| `energyCost` | **dropped** | R-3. |
| `inputs[].itemId` / `.quantity` | same | Kept. |
| `inputs[].id` | **dropped** | Duplicates `itemId` on every entry I inspected. Read by nothing in `src/`. |
| `inputs[].minQty` / `.maxQty` | **dropped** | Present on inputs, alongside a `quantity` that is what the engine would use. An input with `quantity: 2, minQty: 1, maxQty: 1` (`recipe_charcoal`) is self-contradictory. Uncertain what was intended — flagging, not resolving. |
| `inputs[].tag` | → `requiresContext` entry | `recipe_copper_ingot` has `{ "tag": "Fuel", "quantity": 1 }` as an *input*. That is a context requirement wearing an input's clothes. It becomes `{ "tag": "Fuel", "minTier": 1, "chargeCost": 1 }`. **One occurrence; needs owner confirmation that "Fuel" is a context tag and not a consumed item.** |
| `outputs[].itemId` / `.chance` / `.maxQty` | same | Kept. |
| `outputs[].chance` | `chance` | ⚠️ **Unit collision.** `recipes.json` uses `1` for certain; `tokenRecipes`/Token configs use `100`. A verbatim copy would make every migrated recipe a 1% drop. Must be normalised at migration. |
| `outputs[].dropChance` | **dropped** | Present on 2 entries as `100`, duplicating `chance: 1`. Read by nothing. |
| `outputs[].isPrimarySource` | **dropped** | Balance-solver metadata, not runtime. Uncertain whether the EV rework wants it — see Q5. |
| `outputs[].id`, `.isLocked` | **dropped** | Duplicate / CMS-local. |
| `xpAwarded` | `xp` | Rename, to match the field the engine already reads (`BoardRunner.js:294`). |
| `encounterChance`, `encounterTableId` | **dropped** | `0` and `null` on every entry that has them. A card-era combat hook with no board equivalent. |
| `tags` | `tags` | Kept. Empty on all 40. |
| `isLocked` | `isLocked` | Kept. |
| `autoSyncId` | **dropped** | CMS id-generation flag (`cms/src/utils/idGenerator.js`), not content. |
| `targetEV`, `calculatedEV`, `autoBalance`, `fieldLocks`, `profitSplit`, `liquidityEV`, `progressionEV`, `goldPerMinute`, `xpPerMinute` | → `balance: { … }` **verbatim** | R-6. Values copied byte-for-byte. Only their *location* changes. See Q3 if even that is too much. |

### 2b. From the `recipePoolRegistry` shape (what the game runs today)

| Today | Becomes | Note |
| :--- | :--- | :--- |
| pool key (`"cooking": [...]`) | `skill` field on each recipe | The file flattens to an array. `getSkillRecipePool()` becomes a filter. |
| *(no id)* | `id` | **New and required.** P2's `selectedRecipeId` cannot be an array index. |
| `name` | `name` | Kept. |
| `requiresContext: ["tag"]` | `requiresContext: [{ tag, minTier, chargeCost }]` | Shape change. A bare string migrates to `{ tag, minTier: 1, chargeCost: 0 }` — identical behaviour. |
| `inputs` | `inputs` | Unchanged. |
| `outputs` | `outputs` | Unchanged; gains `tokenId` as a legal alternative to `itemId`. |
| `cycleTimeMs` | `durationMs` | Rename. See Q4. |
| `xp` | `xp` | Unchanged. |
| *(none)* | `levelRequirement` | **New.** R-1. Today the level gate lives on the *station* (`config.skillRequired`, read at `BoardRunner.js:99`), so every recipe on a station shares one gate. Moving it to the recipe is what makes the modal's five-band hierarchy possible. |
| *(none)* | `stationChargeCost` | **New.** Today `BoardRunner.js:304` hardcodes `usesRemaining -= 1` per cycle. R-8 needs this authored. |
| *(none)* | `balance: {}` | Absent on pooled recipes; migrates as an empty object or is omitted. |

---

## 3. The pooled-vs-private question

**Recommendation: dissolve it. The merged schema has no private recipes.**

The roadmap has already half-decided this — §5.1 promises the economic simulator
"No pooled-vs-private fork, no second registry." This proposal makes that
literal: a recipe belongs to a skill, and a station offers its skill's recipes.
There is no second source.

**What it costs: nothing measurable today.** I checked. `data/tokens.json`
contains **zero** occurrences of a `recipes` key. Not one Token uses the private
path. `recipesForToken()` (`recipePoolRegistry.js:105-108`) has a private branch
that no shipped content reaches.

**What has to change:**

- `recipesForToken()` loses its branch and becomes "recipes for this station's
  skill".
- `ContentRules.test.js:270-279` ("never declares both a recipe pool and private
  recipes") becomes vacuous and should be **deleted**, not left passing on an
  empty set. `ContentRules.test.js:281-288` (every pool points at a real skill)
  should be **kept and strengthened** to assert every *recipe's* `skill` is real.
- `ContentRules.test.js:60` (`RUNNING = ... TOKENS[id].recipes?.length`) needs
  rewording.
- The CMS's opt-in toggle (`useEntityStore.js:595-608`, which clears
  `next.recipes` when a Token opts in) loses its reason to exist.

**One thing genuinely goes away.** CMS-77's stated escape hatch was that a
station-exclusive recipe gets authored into the pool and gated by a context tag
only that station's setup satisfies (CMS-6). Under this rework the *player*
picks the recipe and context only gates it — so a recipe that is meant to be
exclusive to one station is now *visible in the modal* on every station of that
skill, greyed out for want of context. That is arguably better (the player can
see what they're missing) but it is a real change in feel, and it is Q6.

**Does this need an owner decision?** Only in the sense that Q6 does. The
dissolve itself is already implied by R-1 and §5.1 and costs nothing today.

---

## 4. Blast radius

Every file that reads or writes recipe data. Paths are from the repo root.

### Game runtime — reads recipes

| File | What it does today | What P0 does to it |
| :--- | :--- | :--- |
| `src/config/DatabaseManager.js` (:31-37) | Globs `data/tokenRecipes.json` + `data/tokenRecipes/**` | Unchanged if the filename stays. Comment at :31-35 needs rewriting. |
| `src/config/registries/recipePoolRegistry.js` | Loads pools, keyed by skill; `recipesForToken` resolves pooled-vs-private | **Rewritten.** Flat-array loader; `getRecipe(id)` added for P2; private branch removed; header doctrine comment (CMS-39/76/77) rewritten, not left stale. |
| `src/systems/board/RecipeResolver.js` | `resolveRecipe` matches recipes by context; `effectiveIO` folds recipe/def; `servesFrom` reads `recipe.requiresContext` as strings (:254) | P0 touches the **shape reads only**: `requiresContext` becomes objects, so `:139-141`, `:254` and `:358-371` need the `.tag` accessor. The behavioural rework (matching → validation) is **P2**, not P0. |
| `src/systems/board/BoardRunner.js` | Reads `io.cycleTimeMs` (:518-525), `io.xp` (:294), `config.skill`/`config.skillRequired` (:93-99), decrements `usesRemaining` by a hardcoded 1 (:304) | P0 renames `cycleTimeMs`→`durationMs` at the read site. Level-gate-from-recipe and `stationChargeCost` are **P1/P2** consumers of fields P0 merely defines. |
| `src/systems/board/InputAllocator.js` | Consumes `inputs[]` | Unchanged — `inputs` shape is untouched. |
| `src/systems/board/BoardState.js` | Holds `usesRemaining` on instances (:36, :86) | Untouched by P0. |
| `src/systems/core/ContentAudit.js` | Audits content reachability | Verify it does not walk pools by key. Uncertain — not inspected in depth. |
| `src/systems/board/TriggerSystem.js` | Matched the recipe search | Believed incidental (`recipes`-adjacent naming). Uncertain — needs a look during P0. |

### Tests

| File | What P0 does to it |
| :--- | :--- |
| `src/tests/ContentRules.test.js` | Delete the pooled-vs-private assertion (:270-279); strengthen the skill-id assertion (:281-288); reword `RUNNING` (:60); the "every recipe points at a context Token that exists" test (:290) needs the object accessor. |
| `src/tests/CMSBalanceEngine.test.js` (:11) | **The only importer of `data/recipes.json`.** If that file is deleted, this test must be repointed or the fixture inlined. It is a solver test, so it belongs to the economic simulator rework — but P0 breaks it if it moves the file. |
| `src/tests/fixtures/testTokens.js` | Fixtures declaring recipes; shape update. |
| `src/tests/Mutators.test.js` | References subskills. P7's problem, but will go red if `data/subskills.json` moves. |
| `src/tests/CMSSmoke.test.js`, `CMSDescriptionDictionary.test.js`, `CMSBoundary.test.js` | Guard the CMS↔game import boundary. Any export removed from `recipePoolRegistry` or `tokenConstants` will surface here. |

### CMS — writes recipes

| File | What it does today | What P0/P6 does to it |
| :--- | :--- | :--- |
| `cms/src/components/editors/RecipeEditor.jsx` | Authors `name`, `requiresContext` (strings), `inputs`, `outputs`, `cycleTimeMs`, `xp` into `recipePools` | Needs `id`, `levelRequirement`, `stationChargeCost`, structured context with tier + charge cost, and Token outputs. Bulk of this is **P6**; P0 must at minimum stop it writing a shape the game can no longer read. |
| `cms/src/stores/useEntityStore.js` | `makeRecipe()` (:390-400) defines the shape; `recipePools` collection (:140-155, :535-570); pooled-or-private toggle (:595-608); flattens pools for the solver (:633-649) | `makeRecipe` gains the new fields. The private branch goes. The solver flattener at :633-649 synthesises fake ids (`pooled_<skill>_<idx>`) precisely because recipes have no real id — that hack **deletes itself** once `id` exists. |
| `cms/src/engine/fileUtils.js` | Writes `data/*.json` on Sync to Game | Must emit an array, not a skill-keyed object. |
| `cms/src/engine/evCalculator.js`, `xpSolver.js`, `taskSolver.js`, `tokenSolver.js`, `anchorCalculator.js`, `contentGenerator.js`, `mockBattle.js` | Read `energyCost` / `baseTickTime` / `levelRequirement` / EV fields | ⚠️ **These read the EV layer, which R-6 says this rework must not touch.** They will break on a field rename or a `balance:{}` nesting. This is the single largest collision between P0 and R-6 — see Q3. |
| `cms/src/components/shared/GenerateModal.jsx`, `FileManagerModal.jsx` | Generation / sync UI | Follow the store. |
| `cms/src/engine/descriptionDictionary.js` | Subskill terms | P7. |
| `cms/src/utils/idGenerator.js` | `autoSyncId` handling | Needs to mint recipe ids now that recipes have them. |

### Data

`data/recipes.json` (delete or archive — Q1), `data/tokenRecipes.json`
(rewritten), `data/subskills.json` (P7), `data/stations.json` (**122 lines, every
entry carries a `subskillId`; no runtime loader — `DatabaseManager.js:11` globs
it but nothing I found consumes the result. Card-era, likely dead. Uncertain**),
`data/tokens.json` (one `recipePool` line, plus `config.skill`/`skillRequired`
which P2 will revisit).

### Out of scope but adjacent — flagging, not fixing

- **`def.charges` is dead.** `tokenRegistry.js:134` says so outright, and
  `:148` shows the real charge pool is `def.uses`. Every Token in
  `data/tokens.json` carries both (`"uses": 1000, "charges": 500`) with
  *different values*. Anything in P1 that reasons about a max-charge ceiling
  must use `uses`, not `charges`.
- **`data/tokens.json` contains `"skill": "farming"`** (line 989) and two empty
  `"skill": ""` entries. `farming` is not in `skillRegistry.js`. Same class of
  bug as Q1.

---

## 5. Open questions for the owner

Answer these on design grounds. Each has my recommendation first.

---

### Q1 — What happens to the 40 recipes in `data/recipes.json`?

They are keyed to skills that **do not exist**. This is not a guess: `skill` is
`"culinary"` or `"industry"` on 21 of them, and the surviving `subskillId`s point
at `data/subskills.json` entries whose `parentSkill` is `"forge"`, `"cooking"`
or `"labor"`. The real skill ids in `src/config/registries/skillRegistry.js` are
`smithing`, `cooking`, `crafting`, `mining`, `logging`, `fishing`, `alchemy`,
`brewing` and 19 others. `forge`, `labor`, `culinary` and `industry` are none of
them.

`src/config/registries/tokenConstants.js:26-28` names this exact failure: the old
CMS "ended up offering skills (`industry`, `culinary`, `nautical`) that the game
had never heard of." `recipes.json` is the surviving wreckage of that.
`useEntityStore.js:33-35` confirms the remapper that used to fix this on import
was deleted with the import path (CMS-4).

So there is no mapping to apply. There is a judgement call.

- **(A) Do not migrate. Delete `recipes.json`, keep it in git history, and
  re-author recipes in the CMS against the new schema. ← recommended.**
  The file is orphaned, its skills are fictional, its `chance` units are
  inverted, and the game currently runs zero recipes anyway — so there is no
  live content to preserve. You would be hand-checking 40 recipes either way;
  authoring them in a working editor is the same work with a better result.
  *Cost:* the EV numbers on those 40 recipes are lost as *data*, though the file
  stays recoverable from git. And `CMSBalanceEngine.test.js` needs its fixture
  inlined.
- **(B) Migrate mechanically, with a quarantine.** Copy all 40 across with
  `skill: null` and let the CMS show them as broken until someone assigns each a
  real skill. *Cost:* you now ship 40 unrunnable recipes and a null-skill code
  path in the engine, for content that was already dead. Every downstream phase
  has to tolerate `skill: null`.
- **(C) Migrate with a mapping you dictate now.** You tell me
  `culinary → cooking`, `industry → smithing`, and the four subskills fold as
  `Smelting + Weaponsmithing → smithing`, `Baking + Cooking → cooking`. *Cost:*
  I would be applying your guess, which is fine — but it is your guess, not a
  fact recovered from the data. And see Q2, which this makes unavoidable.

---

### Q2 — Collapsing subskills merges recipe pools. Is that what you want?

Only relevant if you pick Q1(C).

Today four subskills key those recipes. Collapsed to skills, `Smelting` and
`Weaponsmithing` both become **smithing**, and `Baking` and `Cooking` both become
**cooking**. Concretely: a Blacksmith Forge would offer Charcoal and Copper Ingot
in its recipe modal alongside Copper Sword, because they are all smithing now.

- **(A) Accept the merge. One skill, one pool; use `requiresContext` to keep a
  Forge from making charcoal. ← recommended.** This is exactly what R-2 asks
  for and what CMS-6 context gating is designed to do — a Smelting Furnace
  provides a `crucible` tag that a Forge does not, so ingot recipes appear
  greyed-out on the Forge with a visible reason. The modal's job is to show the
  player what they cannot yet do.
- **(B) Keep them separate by inventing new skills.** `smelting` and
  `weaponsmithing` become real skill ids. *Cost:* you have re-created subskills
  under another name, one layer up, and every hero now carries more skill
  tracks. Directly against R-2.
- **(C) Filter the modal by station instead of by skill.** *Cost:* that is
  station-private recipes again, which R-1 and §5.1 rule out.

---

### Q3 — The EV fields: nest them, or leave them exactly where they sit?

R-6 says carry them verbatim and do not design around them. My schema nests the
nine of them under `balance: { … }`. That is still verbatim *content* — no value
is read or changed — but it *is* a change of address, and seven CMS engine files
(`evCalculator.js`, `xpSolver.js`, `taskSolver.js`, `tokenSolver.js`,
`anchorCalculator.js`, `contentGenerator.js`, `mockBattle.js`) reach for them by
name at the top level.

- **(A) Leave them flat at the top level, exactly as they are today. ←
  recommended.** It is the most literal reading of R-6 and it breaks nothing in
  the CMS solver. The schema is uglier — nine balance fields sitting beside six
  gameplay fields — but "uglier" is a much cheaper problem than "the economic
  simulator rework inherits a migration it did not ask for". The nesting can
  happen inside *that* rework, by the people who own those fields.
- **(B) Nest under `balance: {}` as shown in §1.** Cleaner schema, and a bright
  line saying "this half is not ours". *Cost:* seven CMS files need path updates
  that R-6 arguably forbids me from making.

If you pick (A), delete the `balance` wrapper from §1 and read those nine fields
as top-level.

---

### Q4 — Cycle durations disagree by 3×. Which is the truth?

`recipes.json` uses `baseTickTime` in the **2000–6000ms** range. The pooled
shape's `makeRecipe()` defaults `cycleTimeMs` to **12000**, and the Recipe
Editor shows a warning if a value falls outside **10000–30000**
(`RecipeEditor.jsx:364`). Token configs in `data/tokens.json` use **12000**.
These are the same concept at very different scales — card-era ticks versus
playmat cycles.

- **(A) The playmat numbers win. `durationMs` means a playmat cycle, 10-30s is
  the healthy band, and any migrated recipe is re-timed by hand. ← recommended.**
  The playmat is the game that exists; `recipes.json`'s timings belong to a card
  game that was replaced. Merging them without rescaling would make forty
  recipes fire 3-6× faster than everything else on the board and quietly wreck
  the economy the simulator is about to model.
- **(B) Migrate `baseTickTime` verbatim and rebalance later.** *Cost:* forty
  landmines, and the economic simulator inherits them as if they were authored
  intent.

This only matters if Q1 is (B) or (C). Under Q1(A) it resolves itself.

---

### Q5 — Does `isPrimarySource` on an output survive?

It appears on every output in `recipes.json` and looks like balance-solver
metadata — "this recipe is where the game expects players to get this item". No
runtime code reads it. It is *not* in R-6's protected list, but it smells like it
belongs to the same rework.

- **(A) Keep it on the output entry, unread. ← recommended.** It costs one field
  and nothing else, and the economic simulator plausibly wants it. Deleting data
  the next rework needs is worse than carrying a field nobody reads.
- **(B) Drop it.** Cleaner. Recoverable from git if wanted.

---

### Q6 — Should a station show recipes it cannot currently run?

Dissolving pooled-vs-private (§3) means every station of a skill lists that
skill's whole pool in the modal. A recipe needing context the station lacks is
visible but not selectable.

- **(A) Show them, greyed, with the missing context named. ← recommended.** The
  concept's five-band modal hierarchy (§2.2) is already built on "show the player
  what they cannot do yet and why" — locked-by-level recipes are shown greyed
  with their level requirement. Locked-by-context is the same idea and the same
  UI. It also replaces something the old adjacency model did implicitly: teaching
  the player that context tokens matter.
- **(B) Hide anything the station cannot currently satisfy.** Shorter list.
  *Cost:* recipes appear and vanish as the player rearranges the board, which
  reads as a bug, and the player never learns a recipe exists.

---

## 6. Test plan — what must be asserted before any data is touched

The roadmap says "tests for the migration before the migration." These are
written to be assertable against the tree **as it stands today**, so they capture
current truth rather than the truth we hope for.

### Before touching anything — characterisation tests

| # | Assertion | Why |
| :--- | :--- | :--- |
| **T1** | `data/tokenRecipes.json` parses and every pool key is a real skill id from `skillRegistry.js`. | Pins the invariant `ContentRules.test.js:281` already asserts for Tokens, extended to the data file. Passes trivially today (the file is `{}`) — that is fine; it must keep passing after. |
| **T2** | No Token in `data/tokens.json` declares a `recipes[]` array. | Pins the fact that dissolving private recipes costs nothing. If this ever fails, §3's recommendation is void. |
| **T3** | Every `requiresContext` tag in `data/tokenRecipes.json` is provided by some Token's `ACTS_AS` statement. | `ContentRules.test.js:290` already does this. It must survive the string→object shape change. |
| **T4** | For every recipe in `recipes.json` that has both, `skillRequirement === levelRequirement`. | **Run this before deciding Q1.** If it fails, the two fields are not duplicates and dropping one loses data. I did not run it. |
| **T5** | Snapshot the count and ids of all 40 recipes in `recipes.json`. | A migration that silently loses entries fails loudly instead. Only needed under Q1(B)/(C). |
| **T6** | `CMSBalanceEngine.test.js` passes today, on the current fixture. | It is the only consumer of `recipes.json`. Establish green before P0 moves the file. |

### After the shape lands — schema-validity tests

| # | Assertion |
| :--- | :--- |
| **T7** | Every recipe has a non-empty `id`, and ids are globally unique across the whole file. *(This is the one P2 cannot function without.)* |
| **T8** | Every recipe's `skill` is a real skill id. No `null`, no `culinary`, no `industry`. *(Unless Q1(B) is chosen, in which case invert: `skill` is a real id **or** exactly `null`.)* |
| **T9** | Every recipe has `durationMs > 0` and `levelRequirement >= 1`. |
| **T10** | Every `requiresContext` entry is an object with a `tag`, a `minTier >= 1`, and a `chargeCost >= 0`. No bare strings survive. |
| **T11** | Every output entry carries exactly one of `itemId`, `tokenId`, `currency` — never two, never none. |
| **T12** | Every `itemId` resolves in `itemRegistry`, every `tokenId` in `tokenRegistry`. |
| **T13** | Every `chance` is in `1..100`. *(Catches the `chance: 1` unit collision from §2a. This is the assertion most likely to catch a real migration bug.)* |
| **T14** | `stationChargeCost >= 0` on every recipe. |
| **T15** | No recipe carries `subskillId`, `energyCost`, `baseTickTime`, `cycleTimeMs`, `xpAwarded`, `skillRequirement`, `dropChance` or `encounterChance`. *(A retirement is only real when a test forbids the field's return.)* |

### Behavioural regression — before/after equivalence

| # | Assertion |
| :--- | :--- |
| **T16** | Given a fixture station and a fixture recipe with a bare-string `requiresContext`, `resolveRecipe` returns the same status before and after the object migration. *(The string→object change must be behaviour-neutral at P0. The behaviour change is P2's.)* |
| **T17** | `effectiveIO` returns the same `inputs`/`outputs`/duration/xp for a fixture pooled recipe after the rename. |
| **T18** | A Token with no recipes still resolves `OK` with a null recipe and runs its own `config` outputs. *(`RecipeResolver.js:133`. A Forest makes wood; that must not regress.)* |
| **T19** | `npm test` is green with zero skipped tests newly added. |

### What is deliberately **not** tested

Per R-6: **no assertion touches any EV field.** Not their values, not their
ranges, not their internal consistency. The only permitted assertion about them
is T20 — and it is a copy check, not a validation.

| # | Assertion |
| :--- | :--- |
| **T20** | For every migrated recipe, the nine EV fields are byte-identical to their values in the source file. Deep-equal, no interpretation. |
