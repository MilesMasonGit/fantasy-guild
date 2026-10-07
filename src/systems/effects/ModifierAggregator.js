import { EFFECT_TYPES, TARGET_CATEGORIES } from './constants.js';
import { COMBAT_SKILL_IDS } from '../../config/registries/skillRegistry.js';

/**
 * Three-Bucket math:  Final = (Base + Σ flat) × (Σ multipliers) × (1 + Σ percentages)
 * The buckets resolve IN SEQUENCE. Example: Base 1, a +1 flat, a ×2 multiplier and +25%
 * give (1 + 1) × 2 × 1.25 = 5. Base sits INSIDE the flat bucket as the seed of the sum.
 *
 * ⚠️ Members of a bucket SUM, they never compound: multipliers ×2 and ×3 give ×5 (not ×6),
 * +25% and +50% give ×1.75 (not ×1.875). Do not "correct" this. Multipliers default to ×1
 * when empty and clamp at 0; negative values are legal (a curse is -2, never ×0).
 *
 * ⚠️ A neutral source must contribute NOTHING to a bucket, not a 1.0 entry: in a bucket that
 * sums, a stray 1 inflates the total.
 *
 * A modifier declares `bucket: 'flat' | 'multiplier' | 'percentage'` ('additive' is a synonym
 * for flat). An entry with no `bucket` is a PERCENTAGE (a bare fraction such as 0.25 means
 * +25%), except that `query`/`getFlat` read it as flat. New content should be explicit.
 */
/**
 * Resolve a multiplier bucket: Σ factors, ×1 when empty, clamped at 0.
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
 * empty, clamped at 0.
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
 * The whole Three-Bucket formula in one place:
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
            if (mod.bucket === 'multiplier' || mod.bucket === 'percentage') return;
            // A BARE entry (no `bucket`) is ambiguous: a flat +5 or a 0.25 meaning +25%. The
            // method the caller uses disambiguates, and a caller asking for flats wants flats.
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
            // ONLY explicit ×N factors; bare entries are percentages (see `collectPercentages`).
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
     * Bare entries (no `bucket`) land here: they are fractions meaning percentages.
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
     * Resolve one effect axis end-to-end through the full Three-Bucket formula. The single
     * place the formula is assembled from an aggregator; an aggregator with no modifiers for
     * `effectType` returns `base` untouched.
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
     * Only one hierarchy exists: `combat` over the three combat styles. Every skill is
     * top-level, so a modifier targeting `mining` targets Mining and nothing else; to cover
     * several skills it must name them.
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
