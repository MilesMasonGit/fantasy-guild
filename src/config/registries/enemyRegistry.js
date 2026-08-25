// Fantasy Guild - Enemy Registry
// Phase 29: Combat System

/**
 * EnemyRegistry - Defines all enemy types for combat encounters.
 *
 * Every enemy is authored content, loaded from `data/`. Each has stats, an
 * attack pattern and an inline drop table.
 */

// === Enemy Schema (7-stat engine: combat_formula_spec.md §6) ===
// {
//   id: string,              // Content id, e.g. "enemy_giant_rat"
//   name: string,            // Display name
//   biomeId: string,         // ⚠️ INERT. The biome registry was retired
//                            // (2026-08-18) and nothing reads this field.
//   tier: number,            // 1-5 (biome progression grouping)
//   level: number,           // Band level — ALL combat stats derive from this
//   budgetScale: number,     // Optional (default 1.0). Scales HP/damage/XP together.
//                            // Informal precursor of the spec's budget-trade rule
//                            // (tutorial pushovers < 1.0; per-stat deviations come
//                            // with the status-system pass).
//   combatType: string,      // melee/ranged/magic — drives RPS
//   drops: [                 // Inline drop table — the only drop mechanism
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

// The 18 hardcoded card-era enemies that used to sit here (`forest_t1_wolf`,
// `farmland_boss_scarecrow`, …) were deleted on 2026-08-24 (CR2-117). They were
// merged into the live `ENEMIES` object beside the CMS-authored ones, so
// `getAllEnemies()` and the Bestiary saw 22 enemies where the game has 4; they
// used the retired id scheme, carried `biomeId`s for a registry that was
// deleted, and their drop tables named 23 item ids that do not exist.
// Enemies are authored content now — they come from `data/` only.

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
        Object.entries(DYNAMIC_ENEMIES)
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

// `getEnemiesByBiome`, `getEnemiesByBiomeAndTier` and `getRandomEnemyForBiome`
// were deleted on 2026-08-24 (CR2-117). They filtered on `biomeId`, a field no
// authored enemy carries and no registry backs, so they could only ever return
// the hardcoded card-era enemies that went with them. Nothing called any of
// the three.

/**
 * Get enemies by tier
 * @param {number} tier 
 * @returns {Object[]}
 */
export function getEnemiesByTier(tier) {
    return Object.values(ENEMIES).filter(e => e.tier === tier);
}

/**
 * Get all enemy IDs
 * @returns {string[]}
 */
export function getAllEnemyIds() {
    return Object.keys(ENEMIES);
}
