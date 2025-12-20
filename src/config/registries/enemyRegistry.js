// Fantasy Guild - Enemy Registry
// Phase 29: Combat System

/**
 * EnemyRegistry - Defines all enemy types for combat encounters
 * 
 * Enemies are organized by biome and tier (1-5).
 * Each enemy has stats, attack patterns, and drop tables.
 */

// === Enemy Schema ===
// {
//   id: string,              // Format: "{biome}_t{tier}_{name}"
//   name: string,            // Display name
//   biomeId: string,         // Reference to BiomeRegistry
//   tier: number,            // 1-5 (difficulty/progression)
//   hp: number,              // Base hit points
//   attackSkill: number,     // For hit chance calculation
//   defenceSkill: number,    // For damage reduction
//   minDamage: number,       // Minimum damage per attack
//   maxDamage: number,       // Maximum damage per attack
//   attackSpeed: number,     // Milliseconds per attack
//   energyCost: number,      // Energy consumed per round
//   drops: [                 // Inline drop table (preferred)
//     { itemId: string, minQty: number, maxQty: number, chance: number }
//   ],
//   xpAwarded: { combat: number, defence: number },
//   icon: string,            // Emoji for display
//   isBoss?: boolean         // Optional: true for boss enemies
// }

export const ENEMIES = {
    // === Forest Enemies ===
    forest_t1_wolf: {
        id: 'forest_t1_wolf',
        name: 'Wolf',
        biomeId: 'forest',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 25,
        attackSkill: 8,
        defenceSkill: 5,
        minDamage: 2,
        maxDamage: 4,
        attackSpeed: 3000,
        // Inline drops (preferred over dropTableId)
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 60 },
            { itemId: 'wolf_fang', minQty: 1, maxQty: 1, chance: 25 }
        ],
        xpAwarded: 15,
        icon: '🐺'
    },

    forest_t1_boar: {
        id: 'forest_t1_boar',
        name: 'Wild Boar',
        biomeId: 'forest',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 35,
        attackSkill: 6,
        defenceSkill: 8,
        minDamage: 3,
        maxDamage: 5,
        attackSpeed: 3500,
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 3, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 2, chance: 80 },
            { itemId: 'boar_tusk', minQty: 1, maxQty: 1, chance: 20 }
        ],
        xpAwarded: 18,
        icon: '🐗'
    },

    // === Plains Enemies ===
    plains_t1_rat: {
        id: 'plains_t1_rat',
        name: 'Giant Rat',
        biomeId: 'plains',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 5,
        attackSkill: 1,
        defenceSkill: 1,
        minDamage: 1,
        maxDamage: 3,
        attackSpeed: 2000,
        drops: [
            { itemId: 'rat_tail', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 30 }
        ],
        xpAwarded: 8,
        icon: '🐀'
    },

    plains_t1_snake: {
        id: 'plains_t1_snake',
        name: 'Grass Snake',
        biomeId: 'plains',
        tier: 1,
        combatType: 'magic', // Venom
        energyCost: 2,
        hp: 18,
        attackSkill: 10,
        defenceSkill: 2,
        minDamage: 2,
        maxDamage: 4,
        attackSpeed: 2500,
        drops: [
            { itemId: 'snake_skin', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'venom_sac', minQty: 1, maxQty: 1, chance: 15 }
        ],
        xpAwarded: 10,
        icon: '🐍'
    },

    // === Mountain Enemies ===
    mountain_t1_goat: {
        id: 'mountain_t1_goat',
        name: 'Mountain Goat',
        biomeId: 'mountain',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 30,
        attackSkill: 7,
        defenceSkill: 10,
        minDamage: 3,
        maxDamage: 6,
        attackSpeed: 3000,
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 2, chance: 70 },
            { itemId: 'goat_horn', minQty: 1, maxQty: 1, chance: 30 }
        ],
        xpAwarded: 14,
        icon: '🐐'
    },

    mountain_t1_eagle: {
        id: 'mountain_t1_eagle',
        name: 'Giant Eagle',
        biomeId: 'mountain',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 20,
        attackSkill: 12,
        defenceSkill: 4,
        minDamage: 4,
        maxDamage: 7,
        attackSpeed: 2800,
        drops: [
            { itemId: 'feather', minQty: 2, maxQty: 5, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 50 },
            { itemId: 'eagle_talon', minQty: 1, maxQty: 1, chance: 20 }
        ],
        xpAwarded: 16,
        icon: '🦅'
    },

    // === Farmland Enemies ===
    farmland_t1_chicken: {
        id: 'farmland_t1_chicken',
        name: 'Chicken',
        biomeId: 'farmland',
        tier: 1,
        combatType: 'melee',
        energyCost: 1,
        hp: 5,
        attackSkill: 1,
        defenceSkill: 1,
        minDamage: 1,
        maxDamage: 1,
        attackSpeed: 7000,
        drops: [
            { itemId: 'raw_chicken', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'feather', minQty: 1, maxQty: 2, chance: 50 }
        ],
        xpAwarded: 5,
        icon: '🐔'
    },

    // === Cave Enemies ===
    cave_t1_bat: {
        id: 'cave_t1_bat',
        name: 'Cave Bat',
        biomeId: 'cave',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 12,
        attackSkill: 8,
        defenceSkill: 2,
        minDamage: 1,
        maxDamage: 3,
        attackSpeed: 1800,
        drops: [
            { itemId: 'bat_wing', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'guano', minQty: 1, maxQty: 3, chance: 40 }
        ],
        xpAwarded: 7,
        icon: '🦇'
    },

    cave_t1_spider: {
        id: 'cave_t1_spider',
        name: 'Giant Spider',
        biomeId: 'cave',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 22,
        attackSkill: 9,
        defenceSkill: 5,
        minDamage: 2,
        maxDamage: 5,
        attackSpeed: 2500,
        drops: [
            { itemId: 'spider_silk', minQty: 1, maxQty: 3, chance: 100 },
            { itemId: 'spider_fang', minQty: 1, maxQty: 1, chance: 25 },
            { itemId: 'venom_sac', minQty: 1, maxQty: 1, chance: 20 }
        ],
        xpAwarded: 12,
        icon: '🕷️'
    },

    // === Swamp Enemies ===
    swamp_t1_frog: {
        id: 'swamp_t1_frog',
        name: 'Giant Frog',
        biomeId: 'swamp',
        tier: 1,
        combatType: 'ranged', // Tongue
        energyCost: 2,
        hp: 20,
        attackSkill: 6,
        defenceSkill: 6,
        minDamage: 2,
        maxDamage: 4,
        attackSpeed: 2200,
        drops: [
            { itemId: 'frog_leg', minQty: 2, maxQty: 2, chance: 100 },
            { itemId: 'slime', minQty: 1, maxQty: 2, chance: 50 }
        ],
        xpAwarded: 10,
        icon: '🐸'
    },

    swamp_t1_leech: {
        id: 'swamp_t1_leech',
        name: 'Swamp Leech',
        biomeId: 'swamp',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 16,
        attackSkill: 4,
        defenceSkill: 3,
        minDamage: 1,
        maxDamage: 2,
        attackSpeed: 2000,
        drops: [
            { itemId: 'slime', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'leech_blood', minQty: 1, maxQty: 1, chance: 40 }
        ],
        xpAwarded: 6,
        icon: '🪱'
    },

    // === Guild Hall Enemies ===
    guild_hall_t1_skeleton: {
        id: 'guild_hall_t1_skeleton',
        name: 'Ancient Skeleton Warrior',
        biomeId: 'guild_hall',
        tier: 1,
        combatType: 'melee',
        energyCost: 2,
        hp: 3,
        attackSkill: 1,
        defenceSkill: 1,
        minDamage: 2,
        maxDamage: 4,
        attackSpeed: 10000, // 10 seconds
        drops: [
            { itemId: 'bone', minQty: 1, maxQty: 2, chance: 100 } // Heuristic drop
        ],
        xpAwarded: 10,
        icon: '💀'
    },

    guild_hall_t1_skeleton_mage: {
        id: 'guild_hall_t1_skeleton_mage',
        name: 'Ancient Skeleton Mage',
        biomeId: 'guild_hall',
        tier: 1,
        combatType: 'magic',
        energyCost: 2,
        hp: 3,
        attackSkill: 1,
        defenceSkill: 1,
        minDamage: 2,
        maxDamage: 4,
        attackSpeed: 10000,
        drops: [
            { itemId: 'bone', minQty: 1, maxQty: 2, chance: 100 }
        ],
        xpAwarded: 10,
        icon: '🧙💀'
    },

    guild_hall_t1_skeleton_archer: {
        id: 'guild_hall_t1_skeleton_archer',
        name: 'Ancient Skeleton Archer',
        biomeId: 'guild_hall',
        tier: 1,
        combatType: 'ranged',
        energyCost: 2,
        hp: 3,
        attackSkill: 1,
        defenceSkill: 1,
        minDamage: 2,
        maxDamage: 4,
        attackSpeed: 10000,
        drops: [
            { itemId: 'bone', minQty: 1, maxQty: 2, chance: 100 }
        ],
        xpAwarded: 10,
        icon: '🏹💀'
    }
};

// === Helper Functions ===

/**
 * Get an enemy by ID
 * @param {string} enemyId 
 * @returns {Object|null}
 */
export function getEnemy(enemyId) {
    return ENEMIES[enemyId] || null;
}

/**
 * Get all enemies
 * @returns {Object}
 */
export function getAllEnemies() {
    return { ...ENEMIES };
}

/**
 * Get enemies by biome
 * @param {string} biomeId 
 * @returns {Object[]}
 */
export function getEnemiesByBiome(biomeId) {
    return Object.values(ENEMIES).filter(e => e.biomeId === biomeId);
}

/**
 * Get enemies by tier
 * @param {number} tier 
 * @returns {Object[]}
 */
export function getEnemiesByTier(tier) {
    return Object.values(ENEMIES).filter(e => e.tier === tier);
}

/**
 * Get enemies by biome and tier
 * @param {string} biomeId 
 * @param {number} tier 
 * @returns {Object[]}
 */
export function getEnemiesByBiomeAndTier(biomeId, tier) {
    return Object.values(ENEMIES).filter(
        e => e.biomeId === biomeId && e.tier === tier
    );
}

/**
 * Get a random enemy for a biome
 * @param {string} biomeId 
 * @param {number} maxTier - Maximum tier to consider (default 1)
 * @returns {Object|null}
 */
export function getRandomEnemyForBiome(biomeId, maxTier = 1) {
    const enemies = Object.values(ENEMIES).filter(
        e => e.biomeId === biomeId && e.tier <= maxTier
    );
    if (enemies.length === 0) return null;
    return enemies[Math.floor(Math.random() * enemies.length)];
}

/**
 * Get all enemy IDs
 * @returns {string[]}
 */
export function getAllEnemyIds() {
    return Object.keys(ENEMIES);
}
