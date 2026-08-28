# Known Issues — open after the Recipe & Charges rework

> **Written 2026-08-27**, when the Recipe & Charges rework merged to `main` (`1a13e2d`).
>
> Everything here was **found and deliberately not fixed** during that rework, either
> because it was out of scope or because it needs a decision that was not this rework's
> to make. Nothing here is a regression from the rework unless it says so.
>
> Ordered by severity. Each ticket says how it was verified, so nobody has to rediscover
> it — and where a claim is *inferred* rather than observed, it says that too.

---

## RC-1 — A fresh game cannot create heroes, so it cannot be played

**Severity: critical.** This is the root cause of the long-standing "a fresh save is
unplayable" symptom recorded in code review round 2.

`HeroManager.getRosterLimit()` returns **0** on a new game. `isRosterFull()` is therefore
true with zero heroes, and `createHero()` returns `null` on every call, logging
*"Roster full — refused to create a new hero"*. Nothing can be staffed, so nothing on the
playmat can work. The QA panel's "Hire Random Hero" button silently doing nothing is the
same bug.

**Verified live** 2026-08-27: after clicking "New Game", `{ heroCount: 0, rosterLimit: 0 }`.
Loading an existing save gives `{ heroCount: 1, rosterLimit: 0 }` — the limit is 0 either
way; existing saves only work because their heroes predate the check.

The roster cap is supposed to be **12** (D-251, standard from 2026-08-18, fixed in
`c6ca657`). Something returns 0 instead — most likely a guild upgrade or unlock value that
a fresh game initialises to 0, read directly by `getRosterLimit()` with no base or floor.
**That last sentence is a hypothesis, not a finding.**

Start at `HeroManager.getRosterLimit()` and `isRosterFull()`, and check what a fresh
`INITIAL_STATE` provides for whatever backs the cap. Add a regression test asserting a
fresh game can create a hero.

*Three agents during the rework hit this blind and had to work around it by loading an
existing save.*

---

## RC-2 — The Forge's copper ingot route is orphaned content

**Severity: high (content-breaking).**

`token_forge`, `token_campfire` and `token_windmill` all still carry `config` blocks whose
`outputs` their pooled recipes now **shadow**. A station's selected recipe replaces its
config route rather than supplementing it — `effectiveIO` is
`recipe?.inputs ?? def?.config?.inputs` (`RecipeResolver.js:194`), and `productionRoutes`
returns recipes instead of the config entry (`tokenRegistry.js:168`).

For Campfire and Windmill this is harmless: their config outputs (Charcoal, Flour) are
duplicates of surviving recipes, so they still make the same thing.

**The Forge is not harmless.** Its config route produced `item_copper_ingot`, and it was
the game's only source of that item. That route is now unreachable, and
`recipe_copper_ingot` was pruned in P2.6 for requiring a `Fuel` tag nothing provides. So
copper ingot has **no producer at all**, and `item_copper_sword` — still dropped by a loot
table at `data/enemies.json:36` — is unauthored.

Two things to decide, and they are separate:
1. Delete the three dead `config` blocks (tidying), and
2. Restore a copper chain, or accept that copper is gone until content is re-authored.

⚠️ Do not simply make pools *add to* config routes to "fix" this. That was considered and
rejected during P2.6 — it gives a station two sources of truth for what it makes and cuts
against the rework's premise that the selected recipe decides.

---

## RC-3 — Three rework features are proven only by fixtures

**Severity: medium.** These work. They have never run on content a player can reach,
because the corpus was pruned to three recipes (R-16) and none of them exercises these
paths.

| Feature | Test | Why no live coverage |
| :--- | :--- | :--- |
| Hierarchical tool tiers | `src/tests/ContextToolTiers.test.js` | No shipped recipe declares `requiresContext` |
| Token outputs as floor drops | `src/tests/TokenOutputDrops.test.js` | No shipped recipe declares a `tokenId` output |
| Non-default charge deltas | `src/tests/ChargesEngine.test.js` | No shipped statement authors a `chargeDelta` other than the default |

The first real content-authoring pass is where these get their first live exercise. Treat
that pass as a test of these features, not only of the content.

---

## RC-4 — A crafted Token can arrive with unlimited charges

**Severity: medium — a trap for the first Token-output recipe, not a live bug.**

A recipe that outputs a Token drops it carrying `tokenStartingUses(tokenId)`, which is
`def.uses ?? null` — and `null` means **unlimited** (R-4). **14 of 39 shipped Tokens do not
author `uses`.** Seven are Maps, where it does not matter. Two do:

- `token_copper_woodaxe` (a context tool)
- `token_campfire` (a station)

Either would mint a permanent copy if a recipe output it today. Map bursts have the same
property, so this is consistent rather than a rework regression — but it will bite the
first person to author a Token-output recipe.

**Fix options:** author `uses` on the Tokens that lack it; or make the Token-output path
refuse a Token with no `uses`; or decide unlimited crafted Tokens are acceptable and say
so. This needs a design call, not just a patch.

---

## RC-5 — `contentGenerator.js` is dead against the current CMS store

**Severity: medium. Pre-existing rot from the CMS rework, not from this one.**

`cms/src/engine/contentGenerator.js` calls `addStation`, `updateStation`, `addTask` and
`updateRecipe(id, patch)`. The store exports only `addRecipe(skillId, data)` and
`updateRecipe(skillId, index, patch)`, and has **no station or task collection at all**.
The Generate flow's station, task and recipe import paths cannot work today.

Related: `FileManagerModal`'s backup payload still gathers `stations`, `enemies`, `areas`
and `quests` from the store — all `undefined`, for the same reason.

Found during P7 while removing subskill references. Left alone as far larger than that
phase, and larger than a cleanup ticket — this is "does the Generate flow still have a
job?", which is a design question.

---

## RC-6 — `data/stations.json` is a card-era orphan

**Severity: low.**

`DatabaseManager.stationFiles` globs it and **nothing reads what it loads**. P7 stripped
seven now-meaningless `subskillId` keys from it but left the file and its glob in place as
out of scope. CR2 already filed the underlying issue.

Either delete the file and its glob, or find out what was meant to consume it.

---

## RC-7 — Sync overwrites the recipe file with no guard, by design

**Severity: low, and this is a DECISION, not a defect (R-18).**

`syncToGame` writes every file unconditionally, including `tokenRecipes.json` as `[]` if
the CMS workspace holds no recipes. Because there is no game→CMS import path (CMS-4
removed it deliberately), opening the CMS in a fresh browser profile and pressing Sync
will overwrite `data/tokenRecipes.json` with an empty array. Recovery is via git.

**The owner was asked during P6a and chose this**, for consistency with `items.json`,
`tokens.json` and `maps.json`, which have always behaved this way.

⚠️ **Do not add a guard without asking.** It is recorded here so that nobody finds an
unguarded destructive write and helpfully "fixes" it. If it does get revisited, it belongs
to the whole sync, not to recipes alone.

---

## RC-8 — The economic simulator brief describes a game that no longer exists

**Severity: high for that rework, invisible until it starts.**

`docs/economic_simulator_problem_space.md` lives **only on the unmerged branch
`economic-sim-brief`** (commits `e3b34de`, `bc8a843`). It was written before this rework
and is wrong in four places. It was deliberately **not** edited from the rework branch —
writing to a file that exists only on someone else's unmerged branch forks it rather than
fixing it.

Corrections are listed with line numbers in
[`recipe_and_charges_roadmap_v1.md`](recipe_and_charges_roadmap_v1.md) §5.2, and §5.1 is
the handoff contract. **Apply §5.2 to that branch before the economic simulator work
starts**, or it will be designed against stale premises: that hero level does not affect
speed, that context tokens choose a station's recipe, and that recipe data lives in
`data/recipes.json`.
