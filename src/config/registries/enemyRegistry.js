// Fantasy Guild - Enemy Registry
// Phase 29: Combat System

/**
 * EnemyRegistry - Defines all enemy types for combat encounters
 * 
 * Enemies are organized by biome and tier (1-5).
 * Each enemy has stats, attack patterns, and drop tables.
 */

// === Enemy Schema (7-stat engine: combat_formula_spec.md §6) ===
// {
//   id: string,              // Format: "{biome}_t{tier}_{name}"
//   name: string,            // Display name
//   biomeId: string,         // Reference to BiomeRegistry
//   tier: number,            // 1-5 (biome progression grouping)
//   level: number,           // Band level — ALL combat stats derive from this
//   budgetScale: number,     // Optional (default 1.0). Scales HP/damage/XP together.
//                            // Informal precursor of the spec's budget-trade rule
//                            // (tutorial pushovers < 1.0; per-stat deviations come
//                            // with the status-system pass).
//   combatType: string,      // melee/ranged/magic — drives RPS
//   drops: [                 // Inline drop table (preferred)
//     { itemId: string, minQty: number, maxQty: number, chance: number }
//   ],
//   icon: string,            // Emoji for display
//   isBoss?: boolean         // Optional: true for boss enemies
// }
//
// DERIVED at load (do not author; overwritten from level/budgetScale):
//   hp = 32·G(level) · scale        minDamage/maxDamage = 9·G(level)·scale ±15%
//   attackSpeed = 3000ms            attackSkill = defenceSkill = level
//   xpAwarded = 12·G(level)^1.15 · scale       energyCost = 0 (F4: no energy in combat)

const STATIC_ENEMIES = {
    // === Forest Enemies ===
    forest_t1_wolf: {
        id: 'forest_t1_wolf',
        name: 'Wolf',
        biomeId: 'forest',
        tier: 1,
        level: 3,
        combatType: 'melee',
        // Inline drops (preferred over dropTableId)
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 60 },
            { itemId: 'wolf_fang', minQty: 1, maxQty: 1, chance: 25 }
        ],
        icon: '🐺'
    },

    forest_t1_boar: {
        id: 'forest_t1_boar',
        name: 'Wild Boar',
        biomeId: 'forest',
        tier: 1,
        level: 4,
        combatType: 'melee',
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 3, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 2, chance: 80 },
            { itemId: 'boar_tusk', minQty: 1, maxQty: 1, chance: 20 }
        ],
        icon: '🐗'
    },

    forest_t1_thorn_elemental: {
        id: 'forest_t1_thorn_elemental',
        name: 'Thorn Elemental',
        biomeId: 'forest',
        tier: 1,
        level: 5,
        combatType: 'melee',
        drops: [
            { itemId: 'thorn_vine', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'berry_rare', minQty: 1, maxQty: 1, chance: 30 }
        ],
        icon: '🌿',
        sprite: 'assets/sprites/implemented/enemies/enemy_elemental_thorn.png',
        traits: [
            { id: 'thorns', level: 1 }
        ]
    },

    // === Plains Enemies ===
    plains_t1_rat: {
        id: 'plains_t1_rat',
        name: 'Giant Rat',
        biomeId: 'plains',
        tier: 1,
        level: 1,
        budgetScale: 0.5,
        combatType: 'melee',
        drops: [
            { itemId: 'rat_tail', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 30 }
        ],
        icon: '🐀'
    },

    plains_t1_snake: {
        id: 'plains_t1_snake',
        name: 'Grass Snake',
        biomeId: 'plains',
        tier: 1,
        level: 3,
        combatType: 'magic', // Venom
        statusOnHit: { statusId: 'poison', chance: 0.5, stacks: 1 },
        drops: [
            { itemId: 'snake_skin', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'venom_sac', minQty: 1, maxQty: 1, chance: 15 }
        ],
        icon: '🐍'
    },

    // === Mountain Enemies ===
    mountain_t1_goat: {
        id: 'mountain_t1_goat',
        name: 'Mountain Goat',
        biomeId: 'mountain',
        tier: 1,
        level: 4,
        combatType: 'melee',
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 2, chance: 70 },
            { itemId: 'goat_horn', minQty: 1, maxQty: 1, chance: 30 }
        ],
        icon: '🐐'
    },

    mountain_t1_eagle: {
        id: 'mountain_t1_eagle',
        name: 'Giant Eagle',
        biomeId: 'mountain',
        tier: 1,
        level: 5,
        combatType: 'melee',
        drops: [
            { itemId: 'feather', minQty: 2, maxQty: 5, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 50 },
            { itemId: 'eagle_talon', minQty: 1, maxQty: 1, chance: 20 }
        ],
        icon: '🦅'
    },

    // === Farmland Enemies ===
    farmland_t1_chicken: {
        id: 'farmland_t1_chicken',
        name: 'Chicken',
        biomeId: 'farmland',
        tier: 1,
        level: 1,
        budgetScale: 0.1,
        combatType: 'melee',
        drops: [
            { itemId: 'raw_chicken', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'feather', minQty: 1, maxQty: 2, chance: 50 }
        ],
        icon: '🐔'
    },

    // === Cave Enemies ===
    cave_t1_bat: {
        id: 'cave_t1_bat',
        name: 'Cave Bat',
        biomeId: 'cave',
        tier: 1,
        level: 2,
        combatType: 'melee',
        drops: [
            { itemId: 'bat_wing', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'guano', minQty: 1, maxQty: 3, chance: 40 }
        ],
        icon: '🦇'
    },

    cave_t1_spider: {
        id: 'cave_t1_spider',
        name: 'Giant Spider',
        biomeId: 'cave',
        tier: 1,
        level: 4,
        combatType: 'melee',
        statusOnHit: { statusId: 'poison', chance: 0.35, stacks: 2 },
        drops: [
            { itemId: 'spider_silk', minQty: 1, maxQty: 3, chance: 100 },
            { itemId: 'spider_fang', minQty: 1, maxQty: 1, chance: 25 },
            { itemId: 'venom_sac', minQty: 1, maxQty: 1, chance: 20 }
        ],
        icon: '🕷️'
    },

    // === Swamp Enemies ===
    swamp_t1_frog: {
        id: 'swamp_t1_frog',
        name: 'Giant Frog',
        biomeId: 'swamp',
        tier: 1,
        level: 3,
        combatType: 'ranged', // Tongue
        drops: [
            { itemId: 'frog_leg', minQty: 2, maxQty: 2, chance: 100 },
            { itemId: 'slime', minQty: 1, maxQty: 2, chance: 50 }
        ],
        icon: '🐸'
    },

    swamp_t1_leech: {
        id: 'swamp_t1_leech',
        name: 'Swamp Leech',
        biomeId: 'swamp',
        tier: 1,
        level: 2,
        combatType: 'melee',
        statusOnHit: { statusId: 'bleed', chance: 0.3, stacks: 1 },
        drops: [
            { itemId: 'slime', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'leech_blood', minQty: 1, maxQty: 1, chance: 40 }
        ],
        icon: '🪱'
    },

    // === Guild Hall Enemies ===
    guild_hall_t1_skeleton: {
        id: 'guild_hall_t1_skeleton',
        name: 'Ancient Skeleton Warrior',
        biomeId: 'guild_hall',
        tier: 1,
        level: 1,
        budgetScale: 0.25, // tutorial pushover
        combatType: 'melee',
        drops: [
            { itemId: 'bone', minQty: 1, maxQty: 2, chance: 100 } // Heuristic drop
        ],
        icon: '💀'
    },

    guild_hall_t1_skeleton_mage: {
        id: 'guild_hall_t1_skeleton_mage',
        name: 'Ancient Skeleton Mage',
        biomeId: 'guild_hall',
        tier: 1,
        level: 1,
        budgetScale: 0.25, // tutorial pushover
        combatType: 'magic',
        drops: [
            { itemId: 'bone', minQty: 1, maxQty: 2, chance: 100 }
        ],
        icon: '🧙💀'
    },

    guild_hall_t1_skeleton_archer: {
        id: 'guild_hall_t1_skeleton_archer',
        name: 'Ancient Skeleton Archer',
        biomeId: 'guild_hall',
        tier: 1,
        level: 1,
        budgetScale: 0.25, // tutorial pushover
        combatType: 'ranged',
        drops: [
            { itemId: 'bone', minQty: 1, maxQty: 2, chance: 100 }
        ],
        icon: '🏹💀'
    },

    guild_hall_t1_skeleton_guildmaster: {
        id: 'guild_hall_t1_skeleton_guildmaster',
        name: 'Ancient Guildmaster Skeleton',
        biomeId: 'guild_hall',
        tier: 1,
        level: 2,
        budgetScale: 0.4, // tutorial boss — tougher than his minions, still forgiving
        combatType: 'melee',
        drops: [
            { itemId: 'bone', minQty: 1, maxQty: 2, chance: 100 }
        ],
        icon: '👑💀',
        isBoss: true
    },

    guild_hall_t1_chicken: {
        id: 'guild_hall_t1_chicken',
        name: 'Wild Chicken',
        biomeId: 'guild_hall',
        tier: 1,
        level: 1,
        budgetScale: 0.1, // it's a chicken
        combatType: 'melee',
        drops: [
            { itemId: 'raw_chicken', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'feather', minQty: 1, maxQty: 2, chance: 50 }
        ],
        icon: '🐔'
    },

    // === Farmland Boss Enemies ===

    farmland_boss_scarecrow: {
        id: 'farmland_boss_scarecrow',
        name: 'Spooky Scarecrow',
        biomeId: 'farmland',
        tier: 1,
        level: 3,
        combatType: 'melee',
        drops: [
            { itemId: 'straw', minQty: 2, maxQty: 4, chance: 100 },
            { itemId: 'wood_oak', minQty: 1, maxQty: 2, chance: 50 }
        ],
        icon: '🎃',
        isBoss: true
    }
};

/**
 * Load all JSON enemy files from data/
 * Uses Vite's import.meta.glob for static analysis
 */
import { DatabaseManager } from '../DatabaseManager.js';

const jsonEnemyFilesSingle = DatabaseManager.enemyFilesSingle;
const jsonEnemyFilesGlob = DatabaseManager.enemyFilesGlob;

function loadJsonEnemies() {
    const dynamicEnemies = {};

    // Process enemies.json if it exists
    for (const [path, module] of Object.entries(jsonEnemyFilesSingle)) {
        try {
            const enemiesData = module.default || module;
            for (const [enemyId, enemyDef] of Object.entries(enemiesData)) {
                if (!enemyDef.id) enemyDef.id = enemyId;
                dynamicEnemies[enemyId] = enemyDef;
            }
        } catch (error) {
            console.warn(`Error loading enemy JSON from ${path}:`, error);
        }
    }

    // Process enemies/**/*.json if they exist
    for (const [path, module] of Object.entries(jsonEnemyFilesGlob)) {
        try {
            const enemiesData = module.default || module;
            for (const [enemyId, enemyDef] of Object.entries(enemiesData)) {
                if (!enemyDef.id) enemyDef.id = enemyId;
                dynamicEnemies[enemyId] = enemyDef;
            }
        } catch (error) {
            console.warn(`Error loading enemy JSON from ${path}:`, error);
        }
    }

    return dynamicEnemies;
}

const DYNAMIC_ENEMIES = loadJsonEnemies();

import { enemyCombatBudget } from '../FormulaRegistry.js';

/**
 * Derive an enemy's combat stat block from its band level (spec §6).
 * CMS/JSON enemies without a level default to band 1.
 */
function withDerivedCombatStats(enemy) {
    const level = enemy.level ?? 1;
    const budgetScale = enemy.budgetScale ?? 1.0;
    const budget = enemyCombatBudget(level, budgetScale);
    return {
        ...enemy,
        level,
        hp: budget.hp,
        minDamage: budget.minDamage,
        maxDamage: budget.maxDamage,
        attackSpeed: budget.attackIntervalMs,
        attackSkill: level,
        defenceSkill: level,
        xpAwarded: budget.xp,
        energyCost: 0 // F4 (owner-locked): no energy cost in combat
    };
}

export const ENEMIES = Object.freeze(
    Object.fromEntries(
        Object.entries({ ...STATIC_ENEMIES, ...DYNAMIC_ENEMIES })
            .map(([id, enemy]) => [id, Object.freeze(withDerivedCombatStats(enemy))])
    )
);

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
    return ENEMIES;
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
