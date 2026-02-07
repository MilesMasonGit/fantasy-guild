// Fantasy Guild - Biome Registry
// Phase 23: Biome & Modifier Registries

/**
 * BiomeRegistry - Defines all biomes in the game world
 * 
 * Biomes represent different terrain/environment types that can be discovered
 * through exploration. Each biome may have associated task cards and enemies.
 * 
 * Note: Passive bonuses will be implemented in a later phase via ModifierAggregator.
 */

// === Biome Constants ===
export const BIOME_CATEGORIES = {
    NATURAL: 'natural',
    UNDERGROUND: 'underground',
    AQUATIC: 'aquatic',
    MYSTICAL: 'mystical',
    SPECIAL: 'special'  // Non-discoverable biomes (e.g., Guild Hall)
};

// === Biome Definitions ===
export const BIOMES = {
    // === Natural Biomes ===
    forest: {
        id: 'forest',
        name: 'Forest',
        description: 'Dense woodland filled with timber and wildlife.',
        category: BIOME_CATEGORIES.NATURAL,
        icon: '🌲',
        color: '#2d5a27',
        backgroundImage: 'bg_lush_forest.png',
        taskHints: ['logging', 'foraging', 'hunting'],
        // Effects applied to tasks spawned from this biome
        effects: [
            { type: 'speed_skill', skills: ['nature'], bonus: 0.05 }
        ],

        // === Exploration Requirements (Simplified for Testing) ===
        explorationCost: {
            base: { wood_oak: 3 }  // Simple single-item requirement
        },

        // === Enemy Groups for Questing ===
        enemyGroups: [
            { enemyId: 'forest_t1_wolf', count: 5, unlocksTask: 'logging' },
            { enemyId: 'forest_t1_wolf', count: 8, unlocksTask: 'foraging' },
            { enemyId: 'forest_t1_boar', count: 3, unlocksTask: 'gather_coal' }
        ],

        // === Project Chain ===
        projectChain: ['logging_fortune_t1', 'logging_fortune_t2'],

        // Task/Combat drop table for Area Cards (weights determine spawn chance)
        taskPool: [
            { taskId: 'logging', weight: 35 },
            { taskId: 'foraging', weight: 30 },
            { taskId: 'gather_coal', weight: 20 },
            { taskId: 'combat_wolf', weight: 15 }  // Combat card
        ]
    },

    plains: {
        id: 'plains',
        name: 'Plains',
        description: 'Open grasslands with scattered resources.',
        category: BIOME_CATEGORIES.NATURAL,
        icon: '🌾',
        color: '#8fbc8f',
        taskHints: ['farming', 'herding', 'gathering'],
        effects: [
            { type: 'xp_skill', skills: ['nature'], bonus: 0.05 }
        ],
        taskPool: [
            { taskId: 'foraging', weight: 40 },
            { taskId: 'logging', weight: 25 },
            { taskId: 'well', weight: 20 },
            { taskId: 'combat_rat', weight: 15 }  // Combat card
        ],
        projectChain: ['farming_fortune_t1', 'farming_fortune_t2']
    },

    mountain: {
        id: 'mountain',
        name: 'Mountain',
        description: 'Rocky peaks rich with ore deposits.',
        category: BIOME_CATEGORIES.NATURAL,
        icon: '⛰️',
        color: '#708090',
        backgroundImage: 'bg_mountains_rocky_hills.png',
        taskHints: ['mining', 'quarrying', 'climbing'],
        effects: [
            { type: 'xp_skill', skills: ['industry'], bonus: 0.05 }
        ],
        taskPool: [
            { taskId: 'gather_copper_ore' },
            { taskId: 'mine_copper_ore' },
            { taskId: 'gather_coal' },
            { taskId: 'smelt_any_ore' },
            { taskId: 'combat_goat' }
        ],
        // === Exploration Requirements (Simplified for Testing) ===
        explorationCost: {
            base: { ore_coal: 3 }  // Simple single-item requirement
        },
        projectChain: ['mining_fortune_t1']
    },

    cave: {
        id: 'cave',
        name: 'Cave',
        description: 'Dark underground passages hiding rare minerals.',
        category: BIOME_CATEGORIES.UNDERGROUND,
        icon: '🕳️',
        color: '#4a4a4a',
        taskHints: ['mining', 'spelunking', 'excavating'],
        effects: [
            { type: 'speed_skill', skills: ['industry'], bonus: 0.05 }
        ],
        taskPool: [
            { taskId: 'gather_copper_ore', weight: 35 },
            { taskId: 'gather_coal', weight: 30 },
            { taskId: 'craft_torch', weight: 15 },
            { taskId: 'combat_bat', weight: 20 }  // Combat card
        ],
        projectChain: ['mining_fortune_t2']
    },

    swamp: {
        id: 'swamp',
        name: 'Swamp',
        description: 'Murky wetlands with unique flora and fauna.',
        category: BIOME_CATEGORIES.AQUATIC,
        icon: '🐸',
        color: '#556b2f',
        taskHints: ['fishing', 'herbalism', 'foraging'],
        effects: [
            { type: 'output_double', skills: ['nature'], bonus: 0.05 }
        ],
        taskPool: [
            { taskId: 'foraging', weight: 35 },
            { taskId: 'well', weight: 30 },
            { taskId: 'logging', weight: 15 },
            { taskId: 'combat_frog', weight: 20 }  // Combat card
        ],
        // No project defined for swamp yet, leaving valid empty array
        projectChain: []
    },

    // === Starting Biomes ===
    farmland: {
        id: 'farmland',
        name: 'Farmland',
        description: 'Fertile fields providing food and sustenance.',
        category: BIOME_CATEGORIES.NATURAL,
        icon: '🌾',
        color: '#7cb342',
        backgroundImage: 'bg_golden_plains.png',
        taskHints: ['farming', 'food', 'cooking'],
        effects: [
            { type: 'xp_skill', skills: ['culinary'], bonus: 0.10 }
        ],

        // === Exploration Requirements ===
        explorationCost: {
            base: { torch: 5 }
        },

        // === Enemy Groups for Questing ===
        enemyGroups: [
            { enemyId: 'farmland_t1_chicken', count: 3, unlocksTask: 'wheat_field' },
            { type: 'collection', name: 'Build Chicken Coop', requirements: { wood_oak: 10 }, unlocksTask: 'combat_chicken' },
            { enemyId: 'farmland_boss_scarecrow', count: 1, unlocksTask: 'windmill' },
            { type: 'collection', name: 'Harvest', requirements: { wheat: 10 }, unlocksExplore: 'orchard' }
        ],

        taskPool: [
            { taskId: 'lemon_orchard' },
            { taskId: 'apple_orchard' },
            { taskId: 'wheat_field' },
            { taskId: 'windmill' },
            { taskId: 'combat_chicken_coop', weight: 15 }
        ],
        projectChain: ['farming_fortune_t1']
    },

    village: {
        id: 'village',
        name: 'Village',
        description: 'A bustling settlement ripe for manipulation and intrigue.',
        category: BIOME_CATEGORIES.NATURAL,
        icon: '🏘️',
        color: '#a67c52',
        backgroundImage: 'bg_cozy_village.png',
        taskHints: ['intrigue', 'social', 'crime'],
        effects: [
            { type: 'xp_skill', skills: ['crime', 'occult'], bonus: 0.10 }
        ],
        taskPool: [
            { taskId: 'spread_rumors' },
            { taskId: 'lemonade_stand' },
            { taskId: 'grandmas_kitchen' },
            { taskId: 'craft_pickaxe' },
            { taskId: 'craft_axe' }
        ],
        projectChain: ['recruiting_t1']
    },

    // === Orchard Biome (Progressive from Farmland) ===
    orchard: {
        id: 'orchard',
        name: 'Orchard',
        description: 'A bountiful grove filled with fruit trees and berry bushes.',
        category: BIOME_CATEGORIES.NATURAL,
        icon: '🍎',
        color: '#e8a45c',
        taskHints: ['gathering', 'food', 'nature'],
        effects: [
            { type: 'xp_skill', skills: ['nature'], bonus: 0.10 }
        ],

        // === Exploration Requirements ===
        explorationCost: {
            base: { torch: 5 }
        },

        // === Enemy Groups (placeholder) ===
        enemyGroups: [],

        taskPool: [],
        projectChain: []
    },

    // === Special Biomes (Non-discoverable via random, but explorable) ===
    guild_hall: {
        id: 'guild_hall',
        name: 'Guild Hall',
        description: 'The hall stands dilapidated and dark, shadows clinging to its weary timbers. Yet, in the silence, a spark remains—a promise of glory waiting to be rekindled.',
        category: BIOME_CATEGORIES.SPECIAL,
        icon: '🏛️',
        color: '#8b7355',
        backgroundImage: 'bg_guild_hall.png',
        taskHints: [],
        // Guild Hall cards have debuffs:
        // - 20% slower task completion (negative speed_skill)
        effects: [
            { type: 'speed_skill', skills: ['all'], bonus: -0.20 }
        ],

        // === NEW: Exploration Requirements ===
        // Base cost is consumed gradually during exploration
        // Specific costs are biome-unique gates
        explorationCost: {
            base: { 'key_ancient': 1 },      // Starting biome - simple requirement
            specific: {}              // No special requirements
        },

        // === NEW: Enemy Groups for Questing ===
        // Each group unlocks one task when defeated
        // Now supports mixed types: 'combat' (default) and 'collection'
        enemyGroups: [
            { enemyId: 'guild_hall_t1_skeleton', count: 1, unlocksTask: 'well', rewards: [{ itemId: 'battleaxe_rotten', count: 1 }], xpRewards: [{ skill: 'melee', amount: 1000 }] },
            { enemyId: 'guild_hall_t1_skeleton_mage', count: 1, unlocksTask: 'scrap_furniture', rewards: [{ itemId: 'staff_rotten', count: 1 }], xpRewards: [{ skill: 'magic', amount: 1000 }] },
            { enemyId: 'guild_hall_t1_skeleton_archer', count: 1, unlocksTask: 'dusty_charcoal_kiln', rewards: [{ itemId: 'bow_rotten', count: 1 }], xpRewards: [{ skill: 'ranged', amount: 1000 }] },
            { enemyId: 'guild_hall_t1_skeleton_guildmaster', count: 1, unlocksTask: 'adventurers_workbench', unlocksExplore: 'sunny_valley', xpRewards: [{ skill: 'defence', amount: 1000 }] }
        ],

        // === NEW: Project Chain ===
        // Linear sequence of projects after questing complete
        projectChain: ['bunk_bed'],

        taskPool: []  // No random task spawning - tasks come from enemyGroups
    }
};

// === Helper Functions ===

/**
 * Get a biome by ID
 * @param {string} biomeId 
 * @returns {Object|null}
 */
export function getBiome(biomeId) {
    return BIOMES[biomeId] || null;
}

/**
 * Get all biomes in a category
 * @param {string} category 
 * @returns {Object[]}
 */
export function getBiomesByCategory(category) {
    return Object.values(BIOMES).filter(biome => biome.category === category);
}

/**
 * Get a random biome (excludes SPECIAL category like guild_hall)
 * @returns {Object}
 */
export function getRandomBiome() {
    // Exclude non-discoverable biomes (SPECIAL category)
    const discoverableBiomes = Object.values(BIOMES).filter(
        biome => biome.category !== BIOME_CATEGORIES.SPECIAL
    );
    const randomIndex = Math.floor(Math.random() * discoverableBiomes.length);
    return discoverableBiomes[randomIndex];
}

/**
 * Get all biome IDs
 * @returns {string[]}
 */
export function getAllBiomeIds() {
    return Object.keys(BIOMES);
}

/**
 * Get a random biome from the player's unlocked biomes only
 * Uses provided GameState or falls back to importing it
 * @param {Object} gameState - Optional GameState object
 * @returns {Object}
 */
export function getRandomUnlockedBiome(gameState = null) {
    // Get unlocked biomes from GameState
    let unlockedIds;
    if (gameState) {
        unlockedIds = gameState.progress?.unlockedBiomes || [];
    } else {
        // Fallback: try to access global window._GameState if available
        unlockedIds = window._GameState?.progress?.unlockedBiomes || [];
    }

    const unlockedBiomes = unlockedIds
        .map(id => BIOMES[id])
        .filter(b => b && b.category !== BIOME_CATEGORIES.SPECIAL);

    if (unlockedBiomes.length === 0) {
        // Fallback to any non-special biome
        return getRandomBiome();
    }

    const randomIndex = Math.floor(Math.random() * unlockedBiomes.length);
    return unlockedBiomes[randomIndex];
}
