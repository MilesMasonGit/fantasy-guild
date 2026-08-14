import { EFFECT_TYPES, TARGET_CATEGORIES } from './constants.js';
import { COMBAT_SKILL_IDS } from '../../config/registries/skillRegistry.js';

/**
 * === Three-Bucket math (status_effects_plan.md §15.3, LOCKED) ===
 *
 *      Final = (Base + Σ flat) × (Σ multipliers) × (1 + Σ percentages)
 *
 * Three buckets, resolved IN SEQUENCE. Every rule below is pinned by a test in
 * `src/tests/Mutators.test.js`.
 *
 * Canonical worked example — a Fishing task with Base Yield 1 Shrimp, a
 * `+1 Shrimp` flat effect, a `×2 Fishing output` effect and a `+25% Shrimp`
 * effect produces 5 Shrimp:  (1 + 1) × 2 × 1.25 = 5.
 *
 *  1. **FLAT** — raw numbers sum. +2 and +3 give +5. **Base sits INSIDE this
 *     bucket** as the seed of the sum, not a separate term applied after.
 *
 *  2. **MULTIPLIER** — factors SUM, they do not compound. ×2 and ×3 give ×5,
 *     not ×6. This is deliberate and counter-intuitive; do not "correct" it.
 *     Defaults to ×1 when empty, clamped at 0. Negative values are legal — a
 *     curse is authored as -2, never ×0.
 *
 *  3. **PERCENTAGE** — fractions SUM, then apply ONCE as (1 + Σ). +25% and
 *     +50% give +75% → ×1.75. NOT ×1.875 (compounded) and NOT ×2.75 (summed
 *     as factors — the bug this bucket exists to prevent). Defaults to ×1 when
 *     empty; the resulting factor is clamped at 0.
 *
 * A neutral source must contribute NOTHING to a bucket, not a 1.0 entry — in a
 * bucket that sums, a stray 1 inflates the total.
 *
 * Multipliers DO scale the percentage result, because the buckets resolve in
 * sequence. That is intended. The rule being enforced is narrower: **no
 * bucket's members compound with each other.**
 *
 * Per §15.12 there is ONE set of buckets per axis, shared by hero Status
 * Effects, Card Tokens, gear and station buffs. There is no separate "hero
 * stage". Tokens themselves arrive in Phase 3; this is the shared machinery
 * they and everything else feed.
 *
 * === Which bucket does a modifier land in? ===
 * A UMI declares it explicitly:
 *   { bucket: 'multiplier', value: 2 }    → contributes the FACTOR 2 (×2)
 *   { bucket: 'percentage', value: 0.25 } → contributes +0.25 (i.e. +25%)
 *   { bucket: 'flat',       value: 5 }    → contributes +5 to the flat sum
 *
 * `bucket` is optional. Legacy content authored before this conversion
 * expresses percentage buffs as bare fractions (`value: 0.25` meaning "+25%").
 * An entry with no `bucket` field is therefore treated as a PERCENTAGE, which
 * is what such content always meant. New content should be explicit.
 *
 * ('additive' is accepted as a synonym for 'flat' — older call sites use it.)
 *
 * ModifierAggregator - Component for entities that can receive and sum modifiers.
 */
/**
 * Resolve a multiplier bucket: Σ factors, ×1 when empty, clamped at 0 (§15.3).
 *
 * Multipliers SUM: `combineMultipliers([2, 2, 2]) === 6`, not 8.
 *
 * @param {number[]} factors - raw factors. Neutral sources must be omitted
 *                             entirely rather than passed as 1.
 * @returns {number}
 */
export function combineMultipliers(factors) {
    if (!factors || factors.length === 0) return 1;
    let sum = 0;
    for (const f of factors) sum += (f || 0);
    return Math.max(0, sum);
}

/**
 * Resolve a percentage bucket: Σ fractions applied ONCE as (1 + Σ), ×1 when
 * empty, clamped at 0 (§15.3).
 *
 * Percentages SUM as percentages and never inflate one another:
 * `combinePercentages([0.25, 0.5]) === 1.75`, NOT 1.875 and NOT 2.75.
 *
 * @param {number[]} fractions - e.g. [0.25, 0.5] for +25% and +50%. Neutral
 *                               sources must be omitted rather than passed as 0.
 * @returns {number} the resulting factor
 */
export function combinePercentages(fractions) {
    if (!fractions || fractions.length === 0) return 1;
    let sum = 0;
    for (const f of fractions) sum += (f || 0);
    return Math.max(0, 1 + sum);
}

/**
 * The whole Three-Bucket formula in one place (§15.3):
 *      Final = (Base + Σ flat) × (Σ multipliers) × (1 + Σ percentages)
 *
 * Canonical example — applyThreeBucket(1, { flat: [1], multipliers: [2],
 * percentages: [0.25] }) === 5.
 *
 * @param {number} base            - Base sits INSIDE the flat bucket
 * @param {object} [buckets]
 * @param {number[]} [buckets.flat]        - flat contributions
 * @param {number[]} [buckets.multipliers] - raw multiplier factors
 * @param {number[]} [buckets.percentages] - fractions, 0.25 meaning +25%
 * @returns {number}
 */
export function applyThreeBucket(base, { flat = [], multipliers = [], percentages = [] } = {}) {
    let flatTotal = base || 0;
    for (const a of flat) flatTotal += (a || 0);
    return flatTotal * combineMultipliers(multipliers) * combinePercentages(percentages);
}

export class ModifierAggregator {
    constructor(entityId) {
        this.entityId = entityId;
        this.modifiers = new Map(); // sourceId -> [UMI_Object]
        this.cache = new Map();     // effectType:category -> float
        this.disabledSources = new Set(); // sourceIds that should be ignored
    }

    /**
     * Add a modifier to the entity
     * @param {Object} umi - Unified Modifier Interface object
     */
    addModifier(umi) {
        if (!umi.source) {
            console.warn(`[ModifierAggregator] Modifier missing source:`, umi);
            return;
        }
 
        const sourceId = umi.source;
        if (!this.modifiers.has(sourceId)) {
            this.modifiers.set(sourceId, []);
        }
 
        this.modifiers.get(sourceId).push(umi);
        this.clearCache();
    }
 
    /**
     * Enable or disable a specific modifier source
     * @param {string} sourceId 
     * @param {boolean} enabled 
     */
    setSourceEnabled(sourceId, enabled) {
        const wasDisabled = this.disabledSources.has(sourceId);
        
        if (enabled && wasDisabled) {
            this.disabledSources.delete(sourceId);
            this.clearCache();
        } else if (!enabled && !wasDisabled) {
            this.disabledSources.add(sourceId);
            this.clearCache();
        }
    }

    /**
     * Remove all modifiers from a specific source
     * @param {string} sourceId 
     */
    removeModifiersBySource(sourceId) {
        if (this.modifiers.has(sourceId)) {
            this.modifiers.delete(sourceId);
            this.clearCache();
        }
    }

    /**
     * Clear specific modifier type from a source (e.g. for aura updates)
     * @param {string} sourceId 
     * @param {string} type 
     */
    removeSourceType(sourceId, type) {
        const sourceMods = this.modifiers.get(sourceId);
        if (sourceMods) {
            const filtered = sourceMods.filter(m => m.type !== type);
            if (filtered.length === 0) {
                this.modifiers.delete(sourceId);
            } else {
                this.modifiers.set(sourceId, filtered);
            }
            this.clearCache();
        }
    }

    /**
     * Clear all modifiers (e.g. on entity reset)
     */
    clearAll() {
        this.modifiers.clear();
        this.clearCache();
    }

    /**
     * Reset the calculation cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Calculate the raw sum of modifiers for a specific effect and category
     * Useful for flat bonuses (e.g. +8 defense)
     * @param {string} effectType 
     * @param {string} category 
     * @returns {number} The sum of modifiers
     */
    query(effectType, category = TARGET_CATEGORIES.ALL) {
        let sum = 0;
        this._forEachMatching(effectType, category, (mod) => {
            // Explicitly-bucketed multiplicative entries never land here.
            if (mod.bucket === 'multiplier' || mod.bucket === 'percentage') return;
            // A BARE legacy entry (no `bucket`) is ambiguous on its own: it may
            // be a flat +5 damage bonus or a 0.25 meaning "+25%". It is
            // disambiguated by WHICH METHOD the caller uses — a caller asking
            // for flats wants flats. This preserves pre-conversion behaviour
            // exactly; new content should set `bucket` explicitly.
            sum += (mod.value || 0);
        });
        return sum;
    }

    /**
     * Flat-bucket sum. Alias of `query()` in Three-Bucket terminology.
     * @returns {number} Σ flat (NOT including Base — the caller supplies that)
     */
    getFlat(effectType, category = TARGET_CATEGORIES.ALL) {
        return this.query(effectType, category);
    }

    /**
     * Collect this aggregator's contributions to the MULTIPLIER bucket as raw
     * factors, so callers can merge them with factors from non-aggregator
     * sources (tools, mastery) before summing. Returning an array rather than a
     * number matters: an EMPTY bucket means ×1, and only the final combiner can
     * know whether the merged bucket is empty.
     *
     * @returns {number[]} raw factors, e.g. [2, 1.25]
     */
    collectMultipliers(effectType, category = TARGET_CATEGORIES.ALL) {
        const factors = [];
        this._forEachMatching(effectType, category, (mod) => {
            // ONLY explicit ×N factors. Bare legacy entries are percentages
            // (see `collectPercentages`), not factors — reading them here is
            // exactly the bug the percentage bucket was added to fix.
            if (mod.bucket !== 'multiplier') return;
            factors.push(mod.value || 0);
        });
        return factors;
    }

    /**
     * Collect this aggregator's contributions to the PERCENTAGE bucket as raw
     * fractions (0.25 meaning "+25%"), so callers can merge them with fractions
     * from non-aggregator sources before summing.
     *
     * Bare legacy entries land here: content authored before the conversion
     * wrote percentage buffs as fractions with no `bucket` field, and that is
     * what they always meant.
     *
     * @returns {number[]} raw fractions, e.g. [0.25, 0.5]
     */
    collectPercentages(effectType, category = TARGET_CATEGORIES.ALL) {
        const fractions = [];
        this._forEachMatching(effectType, category, (mod) => {
            if (mod.bucket === 'multiplier' || mod.bucket === 'flat' || mod.bucket === 'additive') return;
            const value = mod.value || 0;
            if (value === 0) return; // a neutral entry contributes nothing
            fractions.push(value);
        });
        return fractions;
    }

    /**
     * The resolved multiplier bucket for this aggregator alone: Σ factors,
     * defaulting to 1 when empty and clamped at 0.
     */
    getMultiplierBucket(effectType, category = TARGET_CATEGORIES.ALL) {
        return combineMultipliers(this.collectMultipliers(effectType, category));
    }

    /**
     * The resolved percentage bucket for this aggregator alone: (1 + Σ
     * fractions), defaulting to 1 when empty and clamped at 0.
     */
    getPercentageBucket(effectType, category = TARGET_CATEGORIES.ALL) {
        return combinePercentages(this.collectPercentages(effectType, category));
    }

    /**
     * Resolve one effect axis end-to-end through the full §15.3 Three-Bucket
     * formula: `(base + Σ flat) × (Σ multipliers) × (1 + Σ percentages)`.
     *
     * This is the single place the whole formula is assembled from an
     * aggregator, so the token consumers (yield/time/cost, Phase 5) and any
     * future caller read the buckets identically. An aggregator with no
     * modifiers for `effectType` returns `base` untouched.
     *
     * @param {string} effectType
     * @param {number} [base=0]  seed of the flat bucket
     * @param {string} [category]
     * @returns {number}
     */
    resolveAxis(effectType, base = 0, category = TARGET_CATEGORIES.ALL) {
        return applyThreeBucket(base, {
            flat: [this.getFlat(effectType, category)],
            multipliers: this.collectMultipliers(effectType, category),
            percentages: this.collectPercentages(effectType, category)
        });
    }

    /**
     * Iterate every live, matching modifier. Handles expiry, disabled sources,
     * effect-type filtering and category/parent matching in one place.
     * @private
     */
    _forEachMatching(effectType, category, fn) {
        const now = Date.now();
        let expiredFound = false;

        for (const [sourceId, mods] of this.modifiers) {
            if (this.disabledSources.has(sourceId)) continue;

            for (let i = mods.length - 1; i >= 0; i--) {
                const mod = mods[i];

                // Expiry Check
                if (mod.expiry && now >= mod.expiry) {
                    expiredFound = true;
                    continue;
                }

                if (mod.type !== effectType) continue;

                const targetCat = mod.target?.category || TARGET_CATEGORIES.ALL;

                const matches =
                    targetCat === TARGET_CATEGORIES.ALL ||
                    targetCat === category ||
                    this._isParentOf(targetCat, category);

                if (matches) fn(mod);
            }
        }

        if (expiredFound) {
            this.purgeExpired();
        }
    }

    /**
     * Remove all expired modifiers
     */
    purgeExpired() {
        const now = Date.now();
        let changed = false;

        for (const [sourceId, mods] of this.modifiers) {
            const initialCount = mods.length;
            const filtered = mods.filter(mod => !mod.expiry || now < mod.expiry);
            
            if (filtered.length !== initialCount) {
                changed = true;
                if (filtered.length === 0) {
                    this.modifiers.delete(sourceId);
                } else {
                    this.modifiers.set(sourceId, filtered);
                }
            }
        }

        if (changed) {
            this.clearCache();
        }
    }

    /**
     * Get complex logic metadata
     * @param {string} overrideKey 
     * @returns {Array} List of metadata objects for the override
     */
    getLogicOverrides(overrideKey) {
        const overrides = [];
        for (const [sourceId, mods] of this.modifiers) {
            if (this.disabledSources.has(sourceId)) continue;
 
            for (const mod of mods) {
                if (mod.type === EFFECT_TYPES.LOGIC_OVERRIDE && mod.metadata?.logic === overrideKey) {
                    overrides.push(mod.metadata);
                }
            }
        }
        return overrides;
    }

    /**
     * Check if a category is a parent of another.
     *
     * **Only one hierarchy survives: `combat` over the three combat styles.**
     * The sub-skill tree it used to walk (`mining` under `labor`) is gone —
     * every skill is now a top-level skill, so a modifier targeting `mining`
     * targets Mining and nothing else. A modifier that wants to cover several
     * skills must name them.
     *
     * Categories are compared case-insensitively (modifier targets are often
     * uppercased).
     */
    _isParentOf(parent, child) {
        const parentId = String(parent).toLowerCase();
        const childId = String(child).toLowerCase();

        if (parentId === TARGET_CATEGORIES.COMBAT) {
            return COMBAT_SKILL_IDS.includes(childId);
        }
        return false;
    }
}
