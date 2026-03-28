import { EFFECT_TYPES, TARGET_CATEGORIES } from './constants.js';

/**
 * ModifierAggregator - Component for entities that can receive and sum modifiers.
 * Uses additive stacking: Base * (1 + Sum(modifiers))
 */
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
 
        for (const [sourceId, mods] of this.modifiers) {
            if (this.disabledSources.has(sourceId)) continue;
 
            for (const mod of mods) {
                if (mod.type !== effectType) continue;

                const targetCat = mod.target?.category || TARGET_CATEGORIES.ALL;
                
                const matches = 
                    targetCat === TARGET_CATEGORIES.ALL || 
                    targetCat === category ||
                    this._isParentOf(targetCat, category);

                if (matches) {
                    sum += (mod.value || 0);
                }
            }
        }

        return sum;
    }

    /**
     * Calculate the bonus multiplier for a specific effect and category
     * @param {string} effectType - From EFFECT_TYPES
     * @param {string} category - From TARGET_CATEGORIES
     * @returns {number} The multiplier (e.g. 1.25 for +25%)
     */
    getMultiplier(effectType, category = TARGET_CATEGORIES.ALL) {
        const cacheKey = `${effectType}:${category}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const sum = this.query(effectType, category);
        const multiplier = 1 + sum;
        this.cache.set(cacheKey, multiplier);
        return multiplier;
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
     * Check if a category is a parent of another (e.g. INDUSTRY is parent of MINING)
     */
    _isParentOf(parent, child) {
        const map = {
            [TARGET_CATEGORIES.INDUSTRY]: [
                TARGET_CATEGORIES.MINING, TARGET_CATEGORIES.LOGGING, 
                TARGET_CATEGORIES.SMELTING, TARGET_CATEGORIES.SMITHING, 
                TARGET_CATEGORIES.CRAFTING
            ],
            [TARGET_CATEGORIES.NATURE]: [
                TARGET_CATEGORIES.FORAGING, TARGET_CATEGORIES.HERBALISM, 
                TARGET_CATEGORIES.HUNTING, TARGET_CATEGORIES.HARVESTING
            ],
            [TARGET_CATEGORIES.NAUTICAL]: [
                TARGET_CATEGORIES.FISHING, TARGET_CATEGORIES.SAILING, 
                TARGET_CATEGORIES.SWIMMING
            ],
            [TARGET_CATEGORIES.CULINARY]: [
                TARGET_CATEGORIES.COOKING, TARGET_CATEGORIES.BREWING, 
                TARGET_CATEGORIES.BUTCHERY
            ],
            [TARGET_CATEGORIES.SOCIAL]: [
                TARGET_CATEGORIES.BARTERING, TARGET_CATEGORIES.RECRUITMENT, 
                TARGET_CATEGORIES.PROPAGANDA, TARGET_CATEGORIES.DIPLOMACY
            ],
            [TARGET_CATEGORIES.CRIME]: [
                TARGET_CATEGORIES.PICKPOCKETING, TARGET_CATEGORIES.LOCKPICKING, 
                TARGET_CATEGORIES.STEALTH
            ],
            [TARGET_CATEGORIES.OCCULT]: [
                TARGET_CATEGORIES.RITUALS, TARGET_CATEGORIES.SUMMONING, 
                TARGET_CATEGORIES.ENCHANTING
            ],
            [TARGET_CATEGORIES.SCIENCE]: [
                TARGET_CATEGORIES.ENGINEERING, TARGET_CATEGORIES.ALCHEMY, 
                TARGET_CATEGORIES.MEDICINE
            ],
            [TARGET_CATEGORIES.COMBAT]: [
                TARGET_CATEGORIES.MELEE, TARGET_CATEGORIES.RANGED, 
                TARGET_CATEGORIES.MAGIC
            ]
        };

        return map[parent]?.includes(child) || false;
    }
}
