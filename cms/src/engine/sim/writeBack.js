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
 * ## ⚠️ What this must NOT write
 *
 * **`xp` is not derived here.** XP derivation is a later phase; authored `xp`
 * on a Token config or a recipe passes through untouched. Charges, inputs,
 * skill, level and identity are authored too, and are equally untouched.
 */

import { quantityRange } from './fieldAdapter.js';

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
export function migrateLegacyIntent({ tokens = {}, recipePools = {} } = {}) {
    const nextTokens = {};
    for (const [id, token] of Object.entries(tokens)) {
        const outputs = token?.config?.outputs;
        const migrated = migrateOutputs(outputs);
        nextTokens[id] = migrated === outputs
            ? token
            : { ...token, config: { ...token.config, outputs: migrated } };
    }

    const nextPools = {};
    for (const [skillId, pool] of Object.entries(recipePools)) {
        if (!Array.isArray(pool)) { nextPools[skillId] = pool; continue; }
        nextPools[skillId] = pool.map((recipe) => {
            const migrated = migrateOutputs(recipe?.outputs);
            return migrated === recipe?.outputs ? recipe : { ...recipe, outputs: migrated };
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

        next[id] = { ...token, config };
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
            return result;
        });
    }
    return next;
}
