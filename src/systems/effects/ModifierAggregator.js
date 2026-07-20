import { EFFECT_TYPES, TARGET_CATEGORIES } from './constants.js';
import { SUB_SKILL_TO_PARENT, COMBAT_SKILL_IDS } from '../../config/registries/skillRegistry.js';

/**
 * === Two-Bucket math (status_effects_plan.md §15.3, LOCKED) ===
 *
 *      Final = (Base + Σ additive) × (Σ multipliers)
 *
 * Rules, all of which are pinned by tests in `src/tests/Mutators.test.js`:
 *  - **Base sits INSIDE the additive bucket.** It is the seed of the sum, not
 *    a separate term applied afterwards.
 *  - The **multiplier bucket defaults to ×1 when it is empty**, so an
 *    untouched entity yields exactly its base. A source that is currently
 *    neutral must contribute NOTHING (not a 1.0 entry) — see `collectMultipliers`.
 *  - **Multipliers SUM, they do not compound.** Three ×2 tokens give ×6, not
 *    ×8. This is deliberate and counter-intuitive; do not "correct" it.
 *  - **Negative multipliers are legal** (a curse is authored as -2, never ×0)
 *    and the summed bucket is **clamped at 0**, so results never go negative.
 *
 * Per §15.12 there is ONE bucket pair per axis, shared by hero Status Effects,
 * Card Tokens, gear and station buffs. There is no separate "hero stage".
 * Tokens themselves arrive in Phase 3; this is the shared machinery they and
 * everything else feed.
 *
 * === Which bucket does a modifier land in? ===
 * A UMI declares it explicitly:
 *   { bucket: 'multiplier', value: 2 }   → contributes the FACTOR 2 (i.e. ×2)
 *   { bucket: 'additive',   value: 5 }   → contributes +5 to the additive sum
 *
 * `bucket` is optional. Legacy content authored before the Two-Bucket
 * conversion expresses percentage buffs as fractions (`value: 0.25` meaning
 * "+25%") and was read through the old `Base × (1 + Σ)` path. When such an
 * entry (no `bucket` field) is read as a multiplier, its contribution is
 * `1 + value` — so a lone +25% station buff still means ×1.25. New content
 * should set `bucket: 'multiplier'` and author raw factors.
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
 * The whole Two-Bucket formula in one place (§15.3):
 *      Final = (Base + Σ additive) × (Σ multipliers)
 *
 * @param {number} base            - Base sits INSIDE the additive bucket
 * @param {object} [buckets]
 * @param {number[]} [buckets.additive]    - additive contributions
 * @param {number[]} [buckets.multipliers] - raw multiplier factors
 * @returns {number}
 */
export function applyTwoBucket(base, { additive = [], multipliers = [] } = {}) {
    let additiveTotal = base || 0;
    for (const a of additive) additiveTotal += (a || 0);
    return additiveTotal * combineMultipliers(multipliers);
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
            if (mod.bucket === 'multiplier') return; // multiplier bucket, not additive
            sum += (mod.value || 0);
        });
        return sum;
    }

    /**
     * Additive-bucket sum. Alias of `query()` in Two-Bucket terminology.
     * @returns {number} Σ additive (NOT including Base — the caller supplies that)
     */
    getAdditive(effectType, category = TARGET_CATEGORIES.ALL) {
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
            const value = mod.value || 0;
            if (mod.bucket === 'multiplier') {
                factors.push(value);
                return;
            }
            // An entry that explicitly declares itself additive never reaches
            // the multiplier bucket.
            if (mod.bucket) return;
            // Legacy fractional buff ("+25%") → factor 1.25. See header note.
            if (value === 0) return; // a neutral legacy entry contributes nothing
            factors.push(1 + value);
        });
        return factors;
    }

    /**
     * The resolved multiplier bucket for this aggregator alone: Σ factors,
     * defaulting to 1 when empty and clamped at 0.
     */
    getMultiplierBucket(effectType, category = TARGET_CATEGORIES.ALL) {
        return combineMultipliers(this.collectMultipliers(effectType, category));
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
     * Check if a category is a parent of another (e.g. LABOR is parent of MINING).
     * Derived from the skill registry so it stays in sync with the 15-skill system.
     * Categories are compared case-insensitively (modifier targets are often uppercased).
     */
    _isParentOf(parent, child) {
        const parentId = String(parent).toLowerCase();
        const childId = String(child).toLowerCase();

        if (parentId === TARGET_CATEGORIES.COMBAT) {
            return COMBAT_SKILL_IDS.includes(childId);
        }
        return SUB_SKILL_TO_PARENT[childId] === parentId;
    }
}
