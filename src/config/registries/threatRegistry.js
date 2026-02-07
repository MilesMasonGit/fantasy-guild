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

export const THREATS = {
    // --- Tick Time Debuffs (+10% per stack) ---
    industrial_decay: {
        id: 'industrial_decay',
        name: 'Industrial Decay',
        description: 'Rusty machinery and cracked tools slow down industry.',
        effect: { type: 'tick_time', category: 'industry', value: 0.1 }
    },
    natures_wrath: {
        id: 'natures_wrath',
        name: "Nature's Wrath",
        description: 'Vines and overgrown brush impede nature gathering.',
        effect: { type: 'tick_time', category: 'nature', value: 0.1 }
    },
    clumsiness: {
        id: 'clumsiness',
        name: 'Clumsiness',
        description: 'Static in the air causes errors in precise crafting.',
        effect: { type: 'tick_time', category: 'crafting', value: 0.1 }
    },
    spoilage: {
        id: 'spoilage',
        name: 'Spoilage',
        description: 'Unseen rot quickens the decay of ingredients.',
        effect: { type: 'tick_time', category: 'culinary', value: 0.1 }
    },
    darkness: {
        id: 'darkness',
        name: 'Darkness',
        description: 'Suffocating gloom makes occult rituals difficult.',
        effect: { type: 'tick_time', category: 'occult', value: 0.1 }
    },
    ignorance: {
        id: 'ignorance',
        name: 'Ignorance',
        description: 'A mental fog slows scientific research.',
        effect: { type: 'tick_time', category: 'science', value: 0.1 }
    },
    rough_seas: {
        id: 'rough_seas',
        name: 'Rough Seas',
        description: 'Choppy waters and winds slow nautical work.',
        effect: { type: 'tick_time', category: 'nautical', value: 0.1 }
    },
    lawlessness: {
        id: 'lawlessness',
        name: 'Lawlessness',
        description: 'Chaos in the shadows makes crime more tedious.',
        effect: { type: 'tick_time', category: 'crime', value: 0.1 }
    },

    // --- Loss Chances ---
    plunder: {
        id: 'plunder',
        name: 'Plunder',
        description: 'Bandits often steal gathered resources.',
        effect: { type: 'output_loss', category: 'gathering', value: 0.1 }
    },
    theft: {
        id: 'theft',
        name: 'Theft',
        description: 'Produced goods frequently go missing.',
        effect: { type: 'output_loss', category: 'production', value: 0.1 }
    },

    // --- Energy Cost Debuffs (+1 flat per stack) ---
    heavy_burden: {
        id: 'heavy_burden',
        name: 'Heavy Burden',
        description: 'Industry feels physically exhausting.',
        effect: { type: 'energy_cost', category: 'industry', value: 1, isFlat: true }
    },
    thorns: {
        id: 'thorns',
        name: 'Thorns',
        description: 'Briers and nettles drain energy.',
        effect: { type: 'energy_cost', category: 'nature', value: 1, isFlat: true }
    },
    complication: {
        id: 'complication',
        name: 'Complication',
        description: 'Crafting requires extreme concentration.',
        effect: { type: 'energy_cost', category: 'crafting', value: 1, isFlat: true }
    },
    burned: {
        id: 'burned',
        name: 'Burned',
        description: 'Intense heat in the kitchens tires heroes.',
        effect: { type: 'energy_cost', category: 'culinary', value: 1, isFlat: true }
    },
    drain: {
        id: 'drain',
        name: 'Drain',
        description: 'Occult tasks leach literal life force.',
        effect: { type: 'energy_cost', category: 'occult', value: 1, isFlat: true }
    },
    confusion: {
        id: 'confusion',
        name: 'Confusion',
        description: 'Complex variables lead to mental exhaustion.',
        effect: { type: 'energy_cost', category: 'science', value: 1, isFlat: true }
    },
    headwind: {
        id: 'headwind',
        name: 'Headwind',
        description: 'Fighting the wind is exhausting work.',
        effect: { type: 'energy_cost', category: 'nautical', value: 1, isFlat: true }
    },
    bribes: {
        id: 'bribes',
        name: 'Bribes',
        description: 'Navigating corruption costs more effort.',
        effect: { type: 'energy_cost', category: 'crime', value: 1, isFlat: true }
    },

    // --- XP Gain Debuffs (-10% per stack) ---
    stagnation: {
        id: 'stagnation',
        name: 'Stagnation',
        description: 'The world feels stale; gathering yields little insight.',
        effect: { type: 'xp_gain', category: 'gathering', value: -0.1 }
    },
    boredom: {
        id: 'boredom',
        name: 'Boredom',
        description: 'Repetitive production fails to challenge the mind.',
        effect: { type: 'xp_gain', category: 'production', value: -0.1 }
    },
    doubt: {
        id: 'doubt',
        name: 'Doubt',
        description: 'Existential dread hampers special skill focus.',
        effect: { type: 'xp_gain', category: 'special', value: -0.1 }
    },

    // --- Progress Chances ---
    sabotage: {
        id: 'sabotage',
        name: 'Sabotage',
        description: 'Work on buildings is frequently undone.',
        effect: { type: 'progress_chance', type_filter: 'project', value: -0.1 }
    },
    lost: {
        id: 'lost',
        name: 'Lost',
        description: 'Exploration is hampered by shifted landmarks.',
        effect: { type: 'progress_chance', type_filter: 'explore', value: -0.1 }
    },

    // --- Consumable Debuffs (-10% per stack) ---
    tainted_water: {
        id: 'tainted_water',
        name: 'Tainted Water',
        description: 'Bitterness in the water reduces its restoration.',
        effect: { type: 'item_effectiveness', item_tag: 'drink', value: -0.1 }
    },
    rotten_food: {
        id: 'rotten_food',
        name: 'Rotten Food',
        description: 'Worms and mold reduce food nutritional value.',
        effect: { type: 'item_effectiveness', item_tag: 'food', value: -0.1 }
    },

    // --- Inventory Debuffs ---
    embargo: {
        id: 'embargo',
        name: 'Embargo',
        description: 'Trade restrictions reduce storage space.',
        effect: { type: 'inventory_stack', value: -0.1 }
    },
    blockade: {
        id: 'blockade',
        name: 'Blockade',
        description: 'Seized supplies reduce slot availability.',
        effect: { type: 'inventory_slots', value: -1, isFlat: true }
    },

    // --- Durability & Health ---
    rust: {
        id: 'rust',
        name: 'Rust',
        description: 'Enhanced corrosion damages tools faster.',
        effect: { type: 'tool_durability_loss', value: 0.1 }
    },
    fear: {
        id: 'fear',
        name: 'Fear',
        description: 'Stress slows natural healing.',
        effect: { type: 'regen_rate', value: -0.1 }
    },
    cursed: {
        id: 'cursed',
        name: 'Cursed',
        description: 'Dark magic drains vitality from every action.',
        effect: { type: 'energy_cost', value: 1, isFlat: true } // Extra fatigue everywhere
    },
    despair: {
        id: 'despair',
        name: 'Despair',
        description: 'Gloom prevents new heroes from appearing.',
        effect: { type: 'recruit_card_gain', value: -1, isFlat: true } // 0 recruit cards on retirement
    }
};

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
    return { ...THREATS };
}
