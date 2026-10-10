/** Economic simulator: the write-back. The passes in `simRunner` return Maps and write nothing; this is the one place that turns them back into the field names the game reads in `data/items.json`, `tokens.json` and `tokenRecipes.json`. Two jobs: land the derived numbers (item `value` and `valueSource`, cycle length, each output's `minQty`/`maxQty`/`chance`), and ⚠️ delete the retired fields wherever they are found, on every run. Sync writes from the store, not from `data/`, so a browser workspace saved before a field was retired would otherwise put it straight back. */

import { quantityRange } from './fieldAdapter.js';
import { deriveTokenType } from '../../utils/constants';
import { slugify } from '../../utils/idGenerator';
import { isMapItem } from '../../../../src/systems/atlas/mapItems.js';

/** Item fields the retired balance engine wrote. Deleted on every run. */
export const RETIRED_ITEM_FIELDS = Object.freeze(['trueCost', 'sellPrice']);

/**
 * The nine EV / auto-balance fields recipes carried for the retired engine.
 * Deleted on every run.
 */
export const RETIRED_RECIPE_FIELDS = Object.freeze([
    'targetEV', 'calculatedEV', 'autoBalance', 'fieldLocks', 'profitSplit',
    'liquidityEV', 'progressionEV', 'goldPerMinute', 'xpPerMinute',
]);

/** `isPrimarySource` is the old anchor flag. It is migrated to the `anchor` intent flag where true (see `migrateLegacyIntent`) and deleted either way. */
export const RETIRED_OUTPUT_FIELDS = Object.freeze(['isPrimarySource']);

/**
 * Token fields the recipe and charges rework retired. Deleted on every run, because the write-back is what stops a stale workspace putting them back.
 * * `xp`: a Token's top-level xp. Dead at runtime (the engine awards `io.xp ?? config.xp`), so it is a second, disagreeing number.
 * * `charges`: retired in favour of `uses`; `liveCharges` reads `uses` and nothing reads `charges`.
 * * `recipePool`: retired in favour of the skill named in the Token's `station` statement (`recipePoolRegistry`).
 * * `scrapValue`: what a Map burst charged for a Token; the Map check that derived it is retired.
 * ⚠️ `config.xp` is NOT here and must never be: that one is derived and live.
 */
export const RETIRED_TOKEN_FIELDS = Object.freeze(['xp', 'charges', 'recipePool', 'scrapValue']);

/** A copy of `record` without `fields`; the original when it had none of them. */
function without(record, fields) {
    if (!record || typeof record !== 'object') return record;
    if (!fields.some(f => f in record)) return record;
    const next = { ...record };
    for (const field of fields) delete next[field];
    return next;
}

/**
 * Move `isPrimarySource: true` onto the `anchor` intent flag.
 * ⚠️ This runs BEFORE the passes: the anchor election reads `output.anchor`, so migrating on the way out would price the same content two different ways on consecutive runs. Idempotent: an output already carrying `anchor: true` is left alone.
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
 * Bring a recipe authored before the recipe and charges rework up to today's shape.
 * ⚠️ This runs BEFORE the passes, for the same reason as the anchor migration: a recipe with no `id` was flattened under a synthetic `pooled_<skill>_<index>` key, so the passes keyed their results under a name the pool entry did not carry and the write-back found none of them. Giving it a real id here means the sim and the write-back agree. The `id` is slugified from the name and kept unique across every pool, since the flattened map is global; `durationMs` is renamed from the old `cycleTimeMs`.
 */
function migrateRecipeSchema(recipe, skillId, usedIds) {
    if (!recipe || typeof recipe !== 'object') return recipe;

    const needsId = !recipe.id;
    const needsDuration = !Number.isFinite(recipe.durationMs)
        && Number.isFinite(recipe.cycleTimeMs);
    const needsLevel = recipe.levelRequirement === undefined;
    const needsChargeCost = recipe.stationChargeCost === undefined;
    const hasLegacyCycle = 'cycleTimeMs' in recipe;
    if (!needsId && !needsDuration && !needsLevel && !needsChargeCost && !hasLegacyCycle) {
        return recipe;
    }

    const next = { ...recipe };

    if (needsId) {
        const base = slugify(recipe.name, 'recipe') || `recipe_${skillId}`;
        let id = base;
        for (let n = 2; usedIds.has(id); n += 1) id = `${base}_${n}`;
        next.id = id;
    }
    usedIds.add(next.id);

    if (needsDuration) next.durationMs = recipe.cycleTimeMs;
    // The old field goes either way: kept, it is a second cycle length that nothing reads and the next author would reasonably believe.
    delete next.cycleTimeMs;

    if (needsLevel) next.levelRequirement = 1;
    if (needsChargeCost) next.stationChargeCost = 1;

    return next;
}

/** Every retired field gone from one Token, wherever it sits: `recipePool` was written at the top level on some Tokens and inside `config` on others, so both are checked. */
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

        // ⚠️ `tokenType` is derived here, BEFORE the passes read it. The ANCHOR pass reads `tokenType` on the way in to decide which kinds can never anchor, so a record whose authored type disagreed with its own rules was a deferred kind on run one and an ordinary producer on run two. Deriving it here, like the `isPrimarySource` migration above, makes the first run agree with the second.
        const derived = deriveTokenType(withOutputs)?.type;
        const typed = derived && derived !== withOutputs.tokenType
            ? { ...withOutputs, tokenType: derived }
            : withOutputs;

        // The retired fields go here rather than on the way out, so a pre-rework workspace cannot reach the passes carrying two disagreeing charge counts.
        nextTokens[id] = stripRetiredTokenFields(typed);
    }

    const nextPools = {};
    // Ids already spoken for, so a generated one cannot collide with an authored one in another pool: the flattened recipe map is global.
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

/**
 * One output, with its derived fields written from authored intent. `baseQty {min,max}` is the intent; `minQty`/`maxQty` are the derived pair the game reads.
 * ⚠️ When the lever policy moves an output and the author never wrote a `baseQty`, the only record of what they wanted is the pair about to be overwritten, so `baseQty` (and `baseChance` for a tuned chance) is seeded from the pre-tuning values first; otherwise one Recalculate would become the new intent and the next would tune away from it, a ratchet. Seeding happens only on an output the sim actually tuned.
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

/** A downcycle recipe's derived quantities. A capped output becomes a metronome at the capped average (min and max both equal to it), because the cap is stated as one number and inventing a spread would be inventing intent. An uncapped output keeps its authored range. */
function downcycleOverrides(entry) {
    const overrides = new Map();
    (entry?.outputs ?? []).forEach((output, index) => {
        if (output.derivedAvgQty === output.authoredAvgQty) return;
        overrides.set(index, { minQty: output.derivedAvgQty, maxQty: output.derivedAvgQty });
    });
    return overrides;
}

/** What the lever policy moved, as per-output overrides. A tuning record's `after.outputs` is index-parallel to the authored outputs array, so the index is the join, not the item id (it matters for an entity that lists the same item twice). An entity the policy left alone or refused yields no overrides. */
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
 * ⚠️ An item the passes could not price keeps `value: null` and gains `valueSource: null` rather than being skipped: null means not yet computed, which is what an unreachable item is and what the audit raises as Critical.
 * ⚠️ A map item is the exception: nothing prices a map, so it is written back exactly as authored.
 */
export function applyItemResults(items = {}, sim) {
    const next = {};
    for (const [id, item] of Object.entries(items)) {
        if (isMapItem(item)) { next[id] = item; continue; }
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

/** Tokens: derived `config.cycleTimeMs` and per-output quantities. A Token the passes skipped (inert or untagged) keeps its authored cycle time exactly as typed: the simulator does not guess a tag, so it does not touch the numbers that would follow from one. */
export function applyTokenResults(tokens = {}, sim) {
    const next = {};
    for (const [id, token] of Object.entries(tokens)) {
        const tokenId = token?.id ?? id;
        if (!token?.config) { next[id] = token; continue; }

        const outputs = deriveOutputs(token.config.outputs, sim.downcycles.get(tokenId), sim.tunings?.get(tokenId));
        const cycleTimeMs = sim.cycleTimes.get(tokenId);
        const config = { ...token.config, outputs };
        if (Number.isFinite(cycleTimeMs)) config.cycleTimeMs = cycleTimeMs;

        // Derived XP. A Token the XP pass had no answer for keeps its authored `config.xp` exactly as typed, the same rule as the cycle time.
        // ⚠️ `token.xp` (top level) is never written here: it is deleted in `migrateLegacyIntent` before the passes run.
        const xp = sim.xp?.get(tokenId);
        if (Number.isFinite(xp)) config.xp = xp;

        next[id] = { ...token, config };
    }
    return next;
}

/** Recipes: derived `durationMs` and per-output quantities, with the retired EV fields gone. Recipes go through the same write-back as Tokens because they go through the same passes. */
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
            // Derived XP: the field the runtime prefers over the Token's `config.xp` when a recipe is the active one.
            const xp = sim.xp?.get(recipe.id);
            if (Number.isFinite(xp)) result.xp = xp;
            return result;
        });
    }
    return next;
}
