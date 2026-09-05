/**
 * Economic simulator — the write-back (phase P5, the cutover).
 *
 * The passes in `simRunner` return Maps and write nothing. This file is the one
 * place that turns those Maps back into the shapes the **game** reads, so that
 * `data/items.json`, `data/tokens.json` and `data/tokenRecipes.json` keep the
 * field names they have always had (plan §16).
 *
 * ```
 * authored intent  →  the passes  →  here  →  today's fields
 * ```
 *
 * ## Two jobs, and the second one is the load-bearing half
 *
 * 1. **Land the derived numbers** — an item's `value` and `valueSource`, an
 *    entity's cycle length, and each output's `minQty`/`maxQty`/`chance`.
 * 2. **Delete the retired fields, wherever they are found, on every run.** The
 *    old balance engine wrote `trueCost` and `sellPrice` onto items and nine EV
 *    fields onto recipes. Those are gone from `data/`, but a browser workspace
 *    saved before this change still holds them — and Sync writes from the
 *    *store*, not from `data/`. Without the stripping below, one Sync from a
 *    stale workspace would put every deleted field straight back into the game
 *    files. The migration of `data/` was a single edit; this is what keeps it
 *    migrated.
 *
 * ## ⚠️ XP, and the one field that looks derived but is dead
 *
 * As of P8, `xp` **is** derived: a recipe's `xp` and a Token's `config.xp` are
 * written from the XP pass, because those are the two fields the *runtime*
 * reads. `BoardRunner.js:353` awards `io.xp ?? config.xp`, and `io.xp` is the
 * active recipe's `xp` (`RecipeResolver.js:197`: `xp: recipe?.xp ?? def?.config?.xp`).
 *
 * ⚠️ **A Token's *top-level* `xp` is dead at runtime** — nothing reads it — and
 * it is now **deleted on every run**, along with `charges` and `recipePool`.
 * That sitting has happened: see `RETIRED_TOKEN_FIELDS`. `data/` was cleaned of
 * all three in `0b6f258`, but nothing stripped them here, so any Sync from a
 * browser saved before the rework put them straight back.
 *
 * Inputs, skill, level and identity are authored, and are untouched. `uses` is
 * authored and is the one charge field; `charges` is its retired twin.
 *
 * **A Map's price, materials and pool membership are authored** and are never
 * written. The one derived thing a Map carries is each pool entry's `weight`
 * (CMS-124) — see `applyMapResults`.
 */

import { quantityRange } from './fieldAdapter.js';
import { deriveTokenType } from '../../utils/constants';
import { slugify } from '../../utils/idGenerator';

/** Item fields the retired balance engine wrote. Deleted on every run. */
export const RETIRED_ITEM_FIELDS = Object.freeze(['trueCost', 'sellPrice']);

/**
 * The nine EV / auto-balance fields recipes carried for the retired engine
 * (plan §16). Deleted on every run.
 */
export const RETIRED_RECIPE_FIELDS = Object.freeze([
    'targetEV', 'calculatedEV', 'autoBalance', 'fieldLocks', 'profitSplit',
    'liquidityEV', 'progressionEV', 'goldPerMinute', 'xpPerMinute',
]);

/**
 * `isPrimarySource` was the struck CMS-110 era's anchor flag. It is migrated to
 * the `anchor` intent flag where true (see `migrateLegacyIntent`) and deleted
 * either way, so the old vocabulary does not survive as a second, dead way to
 * say "anchor".
 */
export const RETIRED_OUTPUT_FIELDS = Object.freeze(['isPrimarySource']);

/**
 * Token fields the **recipe & charges rework** retired. Deleted on every run.
 *
 * ⚠️ These are a different generation from `RETIRED_ITEM_FIELDS`. Those came
 * from the old balance engine; these came from the rework that made `uses` the
 * one charge field and moved a station's skill onto its `station` statement.
 * `data/` was cleaned of all three in `0b6f258` — but the write-back was never
 * taught to strip them, so the very next Sync from any browser put them
 * straight back. That is the half this completes.
 *
 * * `xp` — a Token's **top-level** xp. Dead at runtime: the engine awards
 *   `io.xp ?? config.xp`, so a top-level `xp` is a second, disagreeing number
 *   that made the drawer promise XP no cycle could award (CR2-192).
 * * `charges` — retired in favour of `uses` (CR2-121). `liveCharges` reads
 *   `uses` and nothing reads `charges`, so a workspace where the two disagree
 *   is carrying a number that already does nothing.
 * * `recipePool` — retired in favour of the skill named in the Token's
 *   `station` statement (`recipePoolRegistry`).
 *
 * ⚠️ `config.xp` is NOT here and must never be: that one is derived and live.
 */
export const RETIRED_TOKEN_FIELDS = Object.freeze(['xp', 'charges', 'recipePool']);

/** A copy of `record` without `fields`; the original when it had none of them. */
function without(record, fields) {
    if (!record || typeof record !== 'object') return record;
    if (!fields.some(f => f in record)) return record;
    const next = { ...record };
    for (const field of fields) delete next[field];
    return next;
}

// === Legacy intent migration =================================================

/**
 * Move `isPrimarySource: true` onto the `anchor` intent flag.
 *
 * ⚠️ **This runs BEFORE the passes, not after.** The anchor election reads
 * `output.anchor`, so migrating on the way out would mean the first
 * Recalculate elected without the flag and the second elected with it — the
 * same content pricing two different ways on two consecutive runs. Migrating
 * first makes one run enough.
 *
 * Idempotent: an output already carrying `anchor: true` is left alone, so a
 * corpus where the migration has already happened cannot be double-flagged, and
 * one where only the legacy flag survives cannot lose it.
 */
function migrateOutput(output) {
    if (!output || typeof output !== 'object') return output;
    if (output.isPrimarySource !== true || output.anchor === true) return output;
    return { ...output, anchor: true };
}

function migrateOutputs(outputs) {
    if (!Array.isArray(outputs)) return outputs;
    let changed = false;
    const next = outputs.map((output) => {
        const migrated = migrateOutput(output);
        if (migrated !== output) changed = true;
        return migrated;
    });
    return changed ? next : outputs;
}

/**
 * Migrate the legacy anchor flag across a whole workspace.
 *
 * Returns the same references where nothing changed, so React identity checks
 * stay meaningful and an already-migrated workspace costs nothing.
 */
/**
 * Bring a recipe authored before the recipe & charges rework up to today's shape.
 *
 * ⚠️ **This runs BEFORE the passes, for the same reason the anchor migration
 * does.** A recipe with no `id` was flattened under a synthetic
 * `pooled_<skill>_<index>` key (`useEntityStore.flatten`), so every pass keyed
 * its results under a name the pool entry did not carry — and the write-back
 * then looked those results up by `recipe.id`, found `undefined`, and wrote
 * none of them. The recipe came out of a Recalculate exactly as it went in.
 * Giving it a real id here means the sim and the write-back agree on one name.
 *
 * Three fields, all of them identity or gates rather than economics:
 *
 * * **`id`** — slugified from the name, so it reads like the ids a person would
 *   have typed (`recipe_copper_ingot`) rather than a counter. Uniqueness is
 *   enforced across every pool, since the flattened map is global.
 * * **`durationMs`** — renamed from the old `cycleTimeMs`. The adapter reads
 *   `durationMs` for a recipe and `config.cycleTimeMs` for a Token; an
 *   un-migrated recipe therefore read as having no cycle at all.
 * * **`levelRequirement`** — defaulted to 1, which is what the adapter already
 *   assumes for a missing level. Writing it makes the assumption visible.
 *
 * Idempotent: a recipe that already carries all three is returned unchanged, by
 * reference, so an up-to-date workspace costs nothing and two runs agree.
 */
function migrateRecipeSchema(recipe, skillId, usedIds) {
    if (!recipe || typeof recipe !== 'object') return recipe;

    const needsId = !recipe.id;
    const needsDuration = !Number.isFinite(recipe.durationMs)
        && Number.isFinite(recipe.cycleTimeMs);
    const needsLevel = recipe.levelRequirement === undefined;
    const hasLegacyCycle = 'cycleTimeMs' in recipe;
    if (!needsId && !needsDuration && !needsLevel && !hasLegacyCycle) return recipe;

    const next = { ...recipe };

    if (needsId) {
        const base = slugify(recipe.name, 'recipe') || `recipe_${skillId}`;
        let id = base;
        for (let n = 2; usedIds.has(id); n += 1) id = `${base}_${n}`;
        next.id = id;
    }
    usedIds.add(next.id);

    if (needsDuration) next.durationMs = recipe.cycleTimeMs;
    // The old field goes either way: kept, it is a second cycle length that
    // nothing reads and the next author would reasonably believe.
    delete next.cycleTimeMs;

    if (needsLevel) next.levelRequirement = 1;

    return next;
}

/**
 * Every retired field gone from one Token, wherever it sits.
 *
 * `recipePool` was written at the top level on some Tokens and inside `config`
 * on others, so both are checked rather than assuming the shape.
 */
function stripRetiredTokenFields(token) {
    if (!token || typeof token !== 'object') return token;
    let next = without(token, RETIRED_TOKEN_FIELDS);
    if (next.config && typeof next.config === 'object' && 'recipePool' in next.config) {
        next = { ...next, config: without(next.config, ['recipePool']) };
    }
    return next;
}

export function migrateLegacyIntent({ tokens = {}, recipePools = {} } = {}) {
    const nextTokens = {};
    for (const [id, token] of Object.entries(tokens)) {
        const outputs = token?.config?.outputs;
        const migrated = migrateOutputs(outputs);
        const withOutputs = migrated === outputs
            ? token
            : { ...token, config: { ...token.config, outputs: migrated } };

        // ⚠️ **`tokenType` is derived here, BEFORE the passes read it.**
        //
        // It is a derived field with no override (owner decision Q3, redesign
        // §1.2), and `recalculateEconomy` has always re-derived it on the way
        // *out*. But the ANCHOR pass reads `tokenType` on the way *in*, to
        // decide which kinds can never anchor — so a record whose authored type
        // disagreed with its own rules was a deferred kind on run one and an
        // ordinary producer on run two, and the same content priced two
        // different ways on two consecutive runs. It converged, but plan §11's
        // "two runs are byte-identical" was only true from the second run on,
        // and every workspace saved before the derivation landed is in exactly
        // that shape.
        //
        // Deriving it here — the same place and for the same reason as the
        // `isPrimarySource` → `anchor` migration above — makes the first run
        // agree with the second. Found by P9's adversarial set, which was the
        // first thing to run the whole pipeline twice over content whose
        // authored type lied about its rules.
        const derived = deriveTokenType(withOutputs)?.type;
        const typed = derived && derived !== withOutputs.tokenType
            ? { ...withOutputs, tokenType: derived }
            : withOutputs;

        // The retired fields go here rather than on the way out, so that a
        // single pre-rework workspace cannot reach the passes carrying two
        // disagreeing charge counts.
        nextTokens[id] = stripRetiredTokenFields(typed);
    }

    const nextPools = {};
    // Ids already spoken for, so a generated one cannot collide with an
    // authored one in another pool — the flattened recipe map is global.
    const usedIds = new Set();
    for (const pool of Object.values(recipePools)) {
        if (Array.isArray(pool)) pool.forEach(r => { if (r?.id) usedIds.add(r.id); });
    }
    for (const [skillId, pool] of Object.entries(recipePools)) {
        if (!Array.isArray(pool)) { nextPools[skillId] = pool; continue; }
        nextPools[skillId] = pool.map((recipe) => {
            const migrated = migrateOutputs(recipe?.outputs);
            const withOutputs = migrated === recipe?.outputs
                ? recipe
                : { ...recipe, outputs: migrated };
            return migrateRecipeSchema(withOutputs, skillId, usedIds);
        });
    }

    return { tokens: nextTokens, recipePools: nextPools };
}

// === Derived write-back ======================================================

/**
 * One output, with its derived fields written from authored intent.
 *
 * `baseQty {min,max}` is the intent; `minQty`/`maxQty` are the derived pair the
 * game reads. Where an output has no `baseQty` — an entity authored before the
 * intent fields existed — `quantityRange` falls back to the derived pair
 * itself, so this is a no-op rather than a reset to 1.
 *
 * ## Seeding intent, and why it is not an edit
 *
 * When the lever policy moves an output, the derived pair stops agreeing with
 * the authored one. If the author never wrote a `baseQty`, the *only* record of
 * what they wanted is the pair we are about to overwrite — so this seeds
 * `baseQty` (and, for a tuned chance, `baseChance`) from the pre-tuning values
 * first. Without that, one Recalculate would quietly become the new intent and
 * the next would tune away from it again: a ratchet, not a derivation.
 *
 * Seeding happens **only on an output the sim actually tuned**. Untouched
 * content keeps exactly the shape it has always had.
 */
function deriveOutput(output, override) {
    if (!output || typeof output !== 'object') return output;
    const authored = quantityRange(output);
    const range = override
        ? { min: override.minQty ?? authored.min, max: override.maxQty ?? authored.max }
        : authored;
    const chance = override && Number.isFinite(override.chancePercent)
        ? override.chancePercent
        : output.chance;

    const stripped = without(output, RETIRED_OUTPUT_FIELDS);
    const same = stripped === output
        && stripped.minQty === range.min
        && stripped.maxQty === range.max
        && stripped.chance === chance;
    if (same) return output;

    const next = { ...stripped, minQty: range.min, maxQty: range.max };
    if (chance !== undefined) next.chance = chance;

    // Seed the intent fields the tuning is about to diverge from.
    if (override) {
        if (!Number.isFinite(output.baseQty?.min) || !Number.isFinite(output.baseQty?.max)) {
            next.baseQty = { min: authored.min, max: authored.max };
        }
        if (next.chance !== output.chance && !Number.isFinite(output.baseChance)) {
            next.baseChance = Number.isFinite(output.chance) ? output.chance : 100;
        }
    }
    return next;
}

/**
 * A downcycle recipe's derived quantities (CMS-130).
 *
 * The pricing pass caps what a return leg gives back and reports the capped
 * average per output. A capped output becomes a metronome at that average —
 * min and max both equal to it — because the cap is stated as one number and
 * inventing a spread around it would be inventing intent. An uncapped output
 * keeps its authored range.
 */
function downcycleOverrides(entry) {
    const overrides = new Map();
    (entry?.outputs ?? []).forEach((output, index) => {
        if (output.derivedAvgQty === output.authoredAvgQty) return;
        overrides.set(index, { minQty: output.derivedAvgQty, maxQty: output.derivedAvgQty });
    });
    return overrides;
}

/**
 * What the lever policy moved, as per-output overrides (phase P6).
 *
 * A tuning record's `after.outputs` is index-parallel to the authored outputs
 * array — the adapter preserves order and never drops an entry — so the index
 * is the join, not the item id. That matters for the rare entity that lists the
 * same item twice.
 *
 * An entity the policy left alone (`lever: 'none'`), or one it refused, yields
 * no overrides: a refusal changes nothing, which is the point of refusing.
 */
function tuningOverrides(tuning) {
    const overrides = new Map();
    if (!tuning?.after || !tuning.lever || tuning.lever === 'none') return overrides;
    tuning.after.outputs.forEach((output, index) => {
        const before = tuning.before.outputs[index];
        if (!before) return;
        if (output.minQty === before.minQty
            && output.maxQty === before.maxQty
            && output.chancePercent === before.chancePercent) return;
        overrides.set(index, {
            minQty: output.minQty,
            maxQty: output.maxQty,
            chancePercent: output.chancePercent,
        });
    });
    return overrides;
}

function deriveOutputs(outputs, downcycleEntry, tuning) {
    if (!Array.isArray(outputs)) return outputs;
    // A downcycle recipe is never tuned (its quantities come from the recovery
    // cap), so the two override sources can never collide.
    const overrides = downcycleEntry ? downcycleOverrides(downcycleEntry) : tuningOverrides(tuning);
    let changed = false;
    const next = outputs.map((output, index) => {
        const derived = deriveOutput(output, overrides.get(index));
        if (derived !== output) changed = true;
        return derived;
    });
    return changed ? next : outputs;
}

/**
 * Items: derived `value` and `valueSource`, retired fields gone.
 *
 * ⚠️ An item the passes could not price keeps `value: null` and gains
 * `valueSource: null` rather than being skipped. Null is CMS-86's "not yet
 * computed", which is what an unreachable item genuinely is and what the audit
 * raises as Critical. Writing the key regardless means the game and the tests
 * can read one field for provenance instead of two shapes.
 */
export function applyItemResults(items = {}, sim) {
    const next = {};
    for (const [id, item] of Object.entries(items)) {
        const itemId = item?.id ?? id;
        const stripped = without(item, RETIRED_ITEM_FIELDS);
        const priced = sim.values.has(itemId);
        next[id] = {
            ...stripped,
            value: priced ? sim.values.get(itemId) : null,
            valueSource: priced ? (sim.elections.get(itemId)?.sourceId ?? null) : null,
        };
    }
    return next;
}

/**
 * Tokens: derived `config.cycleTimeMs` and per-output quantities.
 *
 * A Token the passes skipped — inert, or untagged — has no derived cycle time,
 * and its authored one is left exactly as typed. That is the whole point of the
 * untagged rule: the simulator does not guess a tag, so it does not touch the
 * numbers that would follow from one.
 */
export function applyTokenResults(tokens = {}, sim) {
    const next = {};
    for (const [id, token] of Object.entries(tokens)) {
        const tokenId = token?.id ?? id;
        if (!token?.config) { next[id] = token; continue; }

        const outputs = deriveOutputs(token.config.outputs, sim.downcycles.get(tokenId), sim.tunings?.get(tokenId));
        const cycleTimeMs = sim.cycleTimes.get(tokenId);
        const config = { ...token.config, outputs };
        if (Number.isFinite(cycleTimeMs)) config.cycleTimeMs = cycleTimeMs;

        // Derived XP (P8). A Token the XP pass had no answer for — skipped,
        // untagged, no solved cycle — keeps its authored `config.xp` exactly as
        // typed, the same rule the cycle time follows above.
        //
        // ⚠️ `token.xp` (top level) is never WRITTEN here — it is deleted
        // instead, in `migrateLegacyIntent`, before the passes run. Only
        // `config.xp` is derived; see the header note.
        const xp = sim.xp?.get(tokenId);
        if (Number.isFinite(xp)) config.xp = xp;

        next[id] = withScrapValue({ ...token, config }, sim, tokenId);
    }
    return next;
}

/**
 * A Token's derived scrap value (CMS-48, phase P7) — what one full copy sells
 * for, allocated out of the scrap budget of the richest Map that hands it over.
 *
 * ⚠️ A Token **no Map's pool contains** gets no `scrapValue` at all, rather
 * than a zero. `TokenBank.sellValue` falls back to its rarity table for exactly
 * that case, and a written zero would make an unreachable Token unsellable
 * instead of merely unpriced — the difference between "the sim has not said"
 * and "the sim says nothing".
 */
function withScrapValue(token, sim, tokenId) {
    const value = sim?.scrapValues?.get(tokenId);
    if (!Number.isFinite(value)) {
        if (!('scrapValue' in token)) return token;
        const stripped = { ...token };
        delete stripped.scrapValue;
        return stripped;
    }
    return { ...token, scrapValue: value };
}

/**
 * Tokens whose config is null still take a scrap value.
 *
 * `applyTokenResults` returns a config-less Token untouched, because there is
 * no cycle to derive — but a Map Token, a pickaxe or a buff is exactly the kind
 * of thing a burst hands over and a player then sells. This runs over the
 * result of `applyTokenResults` so the two concerns stay separable.
 */
export function applyScrapValues(tokens = {}, sim) {
    if (!sim?.scrapValues) return tokens;
    const next = {};
    for (const [id, token] of Object.entries(tokens)) {
        next[id] = token ? withScrapValue(token, sim, token?.id ?? id) : token;
    }
    return next;
}

/**
 * Maps: derived pool **weights** (CMS-124, phase P7).
 *
 * A pool entry's draw weight comes from the referenced Token's rarity through
 * one global table, so it is sim-written from here on and the Map editor's
 * weight column is read-only-derived. Everything else about a Map — its price,
 * its materials, which entries are in its pool — is authored and untouched:
 * the Map check refuses rather than adjusts, precisely because it has nothing
 * of its own to move.
 *
 * A Map the pass skipped (a guild-hall map, an empty pool) keeps its authored
 * weights exactly as typed.
 */
export function applyMapResults(maps = {}, sim) {
    const weights = sim?.mapWeights;
    if (!weights) return maps;
    const next = {};
    for (const [key, map] of Object.entries(maps)) {
        const derived = weights.get(map?.id ?? key);
        if (!derived || !Array.isArray(map?.pool)) { next[key] = map; continue; }
        let changed = false;
        const pool = map.pool.map((entry, i) => {
            const weight = derived[i];
            if (!Number.isFinite(weight) || entry?.weight === weight) return entry;
            changed = true;
            return { ...entry, weight };
        });
        next[key] = changed ? { ...map, pool } : map;
    }
    return next;
}

/**
 * Recipes: derived `durationMs` and per-output quantities, EV fields gone.
 *
 * Recipes go through the same write-back as Tokens because they go through the
 * same passes. The bypass that used to route them around the economy pass —
 * built to protect the nine EV fields from a solver that rewrote them — has
 * nothing left to protect and is retired (plan §16).
 */
export function applyRecipePoolResults(recipePools = {}, sim) {
    const next = {};
    for (const [skillId, pool] of Object.entries(recipePools)) {
        if (!Array.isArray(pool)) { next[skillId] = pool; continue; }
        next[skillId] = pool.map((recipe) => {
            if (!recipe) return recipe;
            const stripped = without(recipe, RETIRED_RECIPE_FIELDS);
            const outputs = deriveOutputs(recipe.outputs, sim.downcycles.get(recipe.id), sim.tunings?.get(recipe.id));
            const durationMs = sim.cycleTimes.get(recipe.id);
            const result = { ...stripped, outputs };
            if (Number.isFinite(durationMs)) result.durationMs = durationMs;
            // Derived XP (P8) — the field the runtime prefers over the Token's
            // `config.xp` when a recipe is the active one.
            const xp = sim.xp?.get(recipe.id);
            if (Number.isFinite(xp)) result.xp = xp;
            return result;
        });
    }
    return next;
}
