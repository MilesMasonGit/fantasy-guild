// Fantasy Guild - Threat Registry
// Phase 32: Invasion System - Debuffs

/**
 * ThreatRegistry - Defines global debuffs caused by active invasions.
 * 
 * Each threat has:
 * - id: unique identifier
 * - name: display name
 * - description: user-facing text
 * - effect: The quantitative impact { type, category?, skill?, value, isFlat? }
 */

export const THREATS = Object.freeze({
    pecking_order: {
        id: 'pecking_order',
        name: 'Pecking Order',
        description: 'Hostile chickens are harassing nature workers.',
        effectType: 'SPEED',
        targetCategory: 'nature',
        value: -0.1
    },
    // --- Speed Debuffs ---
    industrial_decay: {
        id: 'industrial_decay',
        name: 'Industrial Decay',
        description: 'Rusty machinery slows down industry.',
        effectType: 'SPEED',
        targetCategory: 'industry',
        value: -0.1
    },
    natures_wrath: {
        id: 'natures_wrath',
        name: "Nature's Wrath",
        description: 'Overgrown brush slows nature gathering.',
        effectType: 'SPEED',
        targetCategory: 'nature',
        value: -0.1
    },
    clumsiness: {
        id: 'clumsiness',
        name: 'Clumsiness',
        description: 'Errors slow down precise crafting.',
        effectType: 'SPEED',
        targetCategory: 'crafting',
        value: -0.1
    },
    spoilage: {
        id: 'spoilage',
        name: 'Spoilage',
        description: 'Rot slows down culinary tasks.',
        effectType: 'SPEED',
        targetCategory: 'culinary',
        value: -0.1
    },
    darkness: {
        id: 'darkness',
        name: 'Darkness',
        description: 'Gloom slows occult rituals.',
        effectType: 'SPEED',
        targetCategory: 'occult',
        value: -0.1
    },
    // --- Yield/Gold Debuffs ---
    plunder: {
        id: 'plunder',
        name: 'Plunder',
        description: 'Bandits steal gathered resources.',
        effectType: 'YIELD',
        targetCategory: 'gathering',
        value: -0.1
    },
    theft: {
        id: 'theft',
        name: 'Theft',
        description: 'Produced goods frequently go missing.',
        effectType: 'YIELD',
        targetCategory: 'production',
        value: -0.1
    },
    tax_evasion: {
        id: 'tax_evasion',
        name: 'Tax Evasion',
        description: 'Gold gain is hampered by corruption.',
        effectType: 'GOLD_GAIN',
        targetCategory: 'all',
        value: -0.1
    },
    // --- XP/Regen Debuffs ---
    fear: {
        id: 'fear',
        name: 'Fear',
        description: 'Stress slows natural healing.',
        effectType: 'SPEED',
        targetCategory: 'all',
        value: -0.1
    },
    stagnation: {
        id: 'stagnation',
        name: 'Stagnation',
        description: 'Gathering yields little insight.',
        effectType: 'XP_GAIN',
        targetCategory: 'gathering',
        value: -0.1
    }
});

/**
 * Get a threat by ID
 * @param {string} threatId 
 * @returns {Object|null}
 */
export function getThreat(threatId) {
    return THREATS[threatId] || null;
}

/**
 * Get all threats
 * @returns {Object}
 */
export function getAllThreats() {
    return THREATS;
}
