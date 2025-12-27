// Fantasy Guild - Project Registry
// Phase 25: Area Cards + Project Chain System

import { getBiome } from './biomeRegistry.js';

/**
 * ProjectRegistry - Defines all area projects organized into chains
 * 
 * Each project belongs to a chain (via chainId) and has a tier (1-5).
 * Completing a tier unlocks the next tier in that chain.
 * 
 * Chains:
 * - recruiting: Grants free recruit cards
 * - inventory_slots: Increases storage capacity
 * - max_stack: Increases item stack limits
 * - double_items: Chance to double item outputs
 */

// === Tier Cost in Influence ===
export const PROJECT_TIER_COST = {
    1: 10,
    2: 20,
    3: 35,
    4: 55,
    5: 80
};

// === Project Definitions ===
export const PROJECTS = {
    // ============================================
    // RECRUITING CHAIN - Grants free recruit cards
    // ============================================
    recruiting_t1: {
        id: 'recruiting_t1',
        name: 'Tavern',
        chainId: 'recruiting',
        tier: 1,
        description: 'Grants 1 FREE Recruit Card',
        icon: '🍺',
        effectType: 'recruit_card',
        effect: { count: 1 }
    },
    recruiting_t2: {
        id: 'recruiting_t2',
        name: 'Guild Hall',
        chainId: 'recruiting',
        tier: 2,
        description: 'Grants 1 FREE Recruit Card',
        icon: '🏛️',
        effectType: 'recruit_card',
        effect: { count: 1 }
    },
    recruiting_t3: {
        id: 'recruiting_t3',
        name: 'Adventurer Academy',
        chainId: 'recruiting',
        tier: 3,
        description: 'Grants 1 FREE Recruit Card',
        icon: '🎓',
        effectType: 'recruit_card',
        effect: { count: 1 }
    },
    recruiting_t4: {
        id: 'recruiting_t4',
        name: 'Heroic Monument',
        chainId: 'recruiting',
        tier: 4,
        description: 'Grants 1 FREE Recruit Card',
        icon: '🗿',
        effectType: 'recruit_card',
        effect: { count: 1 }
    },
    recruiting_t5: {
        id: 'recruiting_t5',
        name: 'Hall of Legends',
        chainId: 'recruiting',
        tier: 5,
        description: 'Grants 1 FREE Recruit Card',
        icon: '👑',
        effectType: 'recruit_card',
        effect: { count: 1 }
    },

    // ============================================
    // INVENTORY SLOTS CHAIN - Increases storage
    // ============================================
    inv_slots_t1: {
        id: 'inv_slots_t1',
        name: 'Chest',
        chainId: 'inventory_slots',
        tier: 1,
        description: '+10 inventory slots',
        icon: '📦',
        effectType: 'inventory_slots',
        effect: { slots: 10 }
    },
    inv_slots_t2: {
        id: 'inv_slots_t2',
        name: 'Bag of Holding',
        chainId: 'inventory_slots',
        tier: 2,
        description: '+15 inventory slots',
        icon: '🎒',
        effectType: 'inventory_slots',
        effect: { slots: 15 }
    },
    inv_slots_t3: {
        id: 'inv_slots_t3',
        name: 'Warehouse',
        chainId: 'inventory_slots',
        tier: 3,
        description: '+20 inventory slots',
        icon: '🏭',
        effectType: 'inventory_slots',
        effect: { slots: 20 }
    },
    inv_slots_t4: {
        id: 'inv_slots_t4',
        name: 'Vault',
        chainId: 'inventory_slots',
        tier: 4,
        description: '+25 inventory slots',
        icon: '🏦',
        effectType: 'inventory_slots',
        effect: { slots: 25 }
    },
    inv_slots_t5: {
        id: 'inv_slots_t5',
        name: 'Pocket Dimension',
        chainId: 'inventory_slots',
        tier: 5,
        description: '+30 inventory slots',
        icon: '🌀',
        effectType: 'inventory_slots',
        effect: { slots: 30 }
    },

    // ============================================
    // MAX STACK CHAIN - Increases stack limits
    // ============================================
    max_stack_t1: {
        id: 'max_stack_t1',
        name: 'Organizer',
        chainId: 'max_stack',
        tier: 1,
        description: '+25 max stack size',
        icon: '📋',
        effectType: 'max_stack',
        effect: { stackBonus: 25 }
    },
    max_stack_t2: {
        id: 'max_stack_t2',
        name: 'Compression Crate',
        chainId: 'max_stack',
        tier: 2,
        description: '+50 max stack size',
        icon: '🗜️',
        effectType: 'max_stack',
        effect: { stackBonus: 50 }
    },
    max_stack_t3: {
        id: 'max_stack_t3',
        name: 'Magical Containers',
        chainId: 'max_stack',
        tier: 3,
        description: '+75 max stack size',
        icon: '✨',
        effectType: 'max_stack',
        effect: { stackBonus: 75 }
    },
    max_stack_t4: {
        id: 'max_stack_t4',
        name: 'Infinite Satchel',
        chainId: 'max_stack',
        tier: 4,
        description: '+100 max stack size',
        icon: '🧳',
        effectType: 'max_stack',
        effect: { stackBonus: 100 }
    },
    max_stack_t5: {
        id: 'max_stack_t5',
        name: 'Void Storage',
        chainId: 'max_stack',
        tier: 5,
        description: '+150 max stack size',
        icon: '🕳️',
        effectType: 'max_stack',
        effect: { stackBonus: 150 }
    },

    // ============================================
    // MINING FORTUNE CHAIN - Double items for Mining tasks
    // ============================================
    mining_fortune_t1: {
        id: 'mining_fortune_t1',
        name: 'Quarry',
        chainId: 'mining_fortune',
        tier: 1,
        description: '+10% double items (Mining)',
        icon: '⛏️',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'mining' }
    },
    mining_fortune_t2: {
        id: 'mining_fortune_t2',
        name: 'Deep Mine',
        chainId: 'mining_fortune',
        tier: 2,
        description: '+10% double items (Mining)',
        icon: '🕳️',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'mining' }
    },
    mining_fortune_t3: {
        id: 'mining_fortune_t3',
        name: 'Mining Guild',
        chainId: 'mining_fortune',
        tier: 3,
        description: '+10% double items (Mining)',
        icon: '⚒️',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'mining' }
    },

    // ============================================
    // LOGGING FORTUNE CHAIN - Double items for Logging tasks
    // ============================================
    logging_fortune_t1: {
        id: 'logging_fortune_t1',
        name: 'Lumber Camp',
        chainId: 'logging_fortune',
        tier: 1,
        description: '+10% double items (Logging)',
        icon: '🪓',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'logging' }
    },
    logging_fortune_t2: {
        id: 'logging_fortune_t2',
        name: 'Sawmill',
        chainId: 'logging_fortune',
        tier: 2,
        description: '+10% double items (Logging)',
        icon: '🪚',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'logging' }
    },
    logging_fortune_t3: {
        id: 'logging_fortune_t3',
        name: 'Forestry Lodge',
        chainId: 'logging_fortune',
        tier: 3,
        description: '+10% double items (Logging)',
        icon: '🌲',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'logging' }
    },

    // ============================================
    // FARMING FORTUNE CHAIN - Double items for Farming tasks
    // ============================================
    farming_fortune_t1: {
        id: 'farming_fortune_t1',
        name: 'Farm',
        chainId: 'farming_fortune',
        tier: 1,
        description: '+10% double items (Farming)',
        icon: '🚜',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'farming' }
    },
    farming_fortune_t2: {
        id: 'farming_fortune_t2',
        name: 'Orchard',
        chainId: 'farming_fortune',
        tier: 2,
        description: '+10% double items (Farming)',
        icon: '🍎',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'farming' }
    },
    farming_fortune_t3: {
        id: 'farming_fortune_t3',
        name: 'Granary',
        chainId: 'farming_fortune',
        tier: 3,
        description: '+10% double items (Farming)',
        icon: '🌾',
        effectType: 'double_items',
        effect: { chance: 0.10, targetCategory: 'farming' }
    },

    // ============================================
    // EXPLORATION CHAIN - Unlocks new biomes
    // Requires all starting biomes to be completed first
    // ============================================
    unlock_swamp: {
        id: 'unlock_swamp',
        name: 'Swamp Expedition',
        chainId: 'exploration',
        tier: 1,
        description: 'Unlock the Swamp biome for exploration.',
        icon: '🐊',
        effectType: 'unlock_biome',
        effect: { biomeId: 'swamp' },
        prerequisites: {
            completedBiomes: ['forest', 'mountain', 'farmland', 'village']
        }
    },

    // ============================================
    // GUILD HALL CHAIN - Starting area project
    // ============================================
    bunk_bed: {
        id: 'bunk_bed',
        name: 'Bunk Bed',
        chainId: 'guild_hall',
        tier: 1,
        description: 'Build a bunk bed to house new guild members.',
        icon: '🛏️',
        effectType: 'recruit_card',
        effect: { count: 1 },  // Spawns 1 free recruit card
        resourceCost: {
            wood_oak: 10
        }
    }
};

// === Helper Functions ===

/**
 * Get a project by ID
 * @param {string} projectId 
 * @returns {Object|null}
 */
export function getProject(projectId) {
    return PROJECTS[projectId] || null;
}

/**
 * Get project tier cost in Influence
 * @param {number} tier 
 * @returns {number}
 */
export function getProjectCost(tier) {
    return PROJECT_TIER_COST[tier] || 10;
}

export default {
    PROJECTS,
    PROJECT_TIER_COST,
    getProjectCost
};
