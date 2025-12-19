// Fantasy Guild - Modifier Registry
// Phase 23: Biome & Modifier Registries

/**
 * ModifierRegistry - Defines all environmental modifiers in the game
 * 
 * Modifiers represent weather, time of day, or other conditions that
 * affect cards within a biome. Each card can have one biome + one modifier.
 * 
 * Note: Passive bonuses will be implemented in a later phase via ModifierAggregator.
 */

// === Modifier Categories ===
export const MODIFIER_CATEGORIES = {
    WEATHER: 'weather',
    TIME: 'time',
    MAGICAL: 'magical'
};

// === Modifier Definitions ===
export const MODIFIERS = {
    // === Weather Modifiers ===
    clear: {
        id: 'clear',
        name: 'Clear',
        description: 'Perfect conditions for work.',
        category: MODIFIER_CATEGORIES.WEATHER,
        icon: '☀️',
        color: '#ffd700',
        effects: [
            { type: 'output_double', skills: ['nature'], bonus: 0.05 }
        ]
    },

    rainy: {
        id: 'rainy',
        name: 'Rainy',
        description: 'Wet conditions slow some tasks but help others.',
        category: MODIFIER_CATEGORIES.WEATHER,
        icon: '🌧️',
        color: '#6495ed',
        effects: [
            { type: 'output_double', skills: ['nature'], bonus: 0.05 }
        ]
    },

    windy: {
        id: 'windy',
        name: 'Windy',
        description: 'Strong gusts make precision work difficult.',
        category: MODIFIER_CATEGORIES.WEATHER,
        icon: '💨',
        color: '#87ceeb',
        effects: [
            { type: 'speed_skill', skills: ['nautical'], bonus: 0.05 }
        ]
    },

    foggy: {
        id: 'foggy',
        name: 'Foggy',
        description: 'Limited visibility conceals hidden treasures.',
        category: MODIFIER_CATEGORIES.WEATHER,
        icon: '🌫️',
        color: '#a9a9a9',
        effects: [
            { type: 'xp_skill', skills: ['crime'], bonus: 0.05 }
        ]
    },

    stormy: {
        id: 'stormy',
        name: 'Stormy',
        description: 'Dangerous conditions, but greater rewards.',
        category: MODIFIER_CATEGORIES.WEATHER,
        icon: '⛈️',
        color: '#4b0082',
        effects: [
            { type: 'xp_skill', skills: ['magic'], bonus: 0.05 }
        ]
    }
};

// === Helper Functions ===

/**
 * Get a modifier by ID
 * @param {string} modifierId 
 * @returns {Object|null}
 */
export function getModifier(modifierId) {
    return MODIFIERS[modifierId] || null;
}

/**
 * Get all modifiers in a category
 * @param {string} category 
 * @returns {Object[]}
 */
export function getModifiersByCategory(category) {
    return Object.values(MODIFIERS).filter(mod => mod.category === category);
}

/**
 * Get a random modifier
 * @returns {Object}
 */
export function getRandomModifier() {
    const modifierIds = Object.keys(MODIFIERS);
    const randomIndex = Math.floor(Math.random() * modifierIds.length);
    return MODIFIERS[modifierIds[randomIndex]];
}

/**
 * Get all modifier IDs
 * @returns {string[]}
 */
export function getAllModifierIds() {
    return Object.keys(MODIFIERS);
}
