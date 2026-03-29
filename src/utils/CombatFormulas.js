// Fantasy Guild - Combat Formulas
// Phase 30: Combat Formulas
// NOTE: Tunable constants are in FormulaRegistry.js. This file provides
// weapon/enemy-aware wrappers and re-exports for backward compatibility.

import {
    hitChance as _hitChance,
    defenceReduction as _defenceReduction,
    rpsMultiplier as _rpsMultiplier,
    heroAttackSpeed as _heroAttackSpeed,
    AUTO_CONSUME_THRESHOLD as _AUTO_CONSUME_THRESHOLD,
    SKILL_SPEED_FACTOR,
    BASE_ATTACK_SPEED_MS,
    MIN_ATTACK_SPEED_MS,
} from '../config/FormulaRegistry.js';

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Calculate hit chance percentage.
 * Delegates to FormulaRegistry.
 */
export function calculateHitChance(attackerSkill, defenderSkill) {
    return _hitChance(attackerSkill, defenderSkill);
}

/**
 * Roll for hit based on attacker/defender skill difference
 * 
 * @param {number} attackerSkill - Attacker's combat skill level
 * @param {number} defenderSkill - Defender's combat skill level
 * @returns {boolean} True if attack hits
 */
export function rollHit(attackerSkill, defenderSkill) {
    const hitChance = calculateHitChance(attackerSkill, defenderSkill);
    const roll = Math.random() * 100;
    return roll < hitChance;
}

/**
 * Roll damage within a range (inclusive)
 * 
 * @param {number} minDamage - Minimum damage
 * @param {number} maxDamage - Maximum damage
 * @returns {number} Rolled damage value
 */
export function rollDamage(minDamage, maxDamage) {
    if (minDamage >= maxDamage) return minDamage;
    return minDamage + Math.floor(Math.random() * (maxDamage - minDamage + 1));
}

/**
 * Calculate defence reduction percentage.
 * Delegates to FormulaRegistry.
 */
export function calculateDefenceReduction(combatSkill) {
    return _defenceReduction(combatSkill);
}

/**
 * Calculate RPS multiplier.
 * Delegates to FormulaRegistry.
 */
export function calculateRpsMultiplier(attackerType, defenderType) {
    return _rpsMultiplier(attackerType, defenderType);
}

/**
 * Compute damage dealt from hero to enemy
 * Includes RPS and weapon mismatch logic
 */
export function computeHeroDamage(hero, enemy, weapon, damageBonus = 0, selectedStyle = 'melee') {
    // Check for Mismatch (e.g., Sword with Magic style)
    // If mismatch, use Unarmed damage (1-2) and no weapon bonuses
    const weaponSkillRequired = weapon?.skillRequired ?? 'melee';
    const isMismatch = weapon && weaponSkillRequired !== selectedStyle;

    let minDamage, maxDamage, baseDamage;

    if (isMismatch) {
        // Unarmed damage
        minDamage = 1;
        maxDamage = 2;
        baseDamage = rollDamage(minDamage, maxDamage); // No damageBonus on mismatch
    } else {
        // Standard weapon damage
        minDamage = weapon?.minDamage ?? 1;
        maxDamage = weapon?.maxDamage ?? 2;
        baseDamage = rollDamage(minDamage, maxDamage) + damageBonus;
    }

    // Apply RPS Multiplier
    const enemyType = enemy.combatType || 'melee';
    const rpsMultiplier = calculateRpsMultiplier(selectedStyle, enemyType);

    // Apply defence reduction
    const defenceReduction = calculateDefenceReduction(enemy.defenceSkill);

    // Final Calculation: (Base * RPS) * (1 - Defence)
    // We apply RPS to base damage before defence for impact
    const damageAfterRps = baseDamage * rpsMultiplier;
    const finalDamage = Math.floor(damageAfterRps * (1 - defenceReduction));

    // Minimum 1 damage
    return Math.max(1, finalDamage);
}

/**
 * Compute damage dealt from enemy to hero
 * Includes RPS logic (Enemy attacking Hero)
 * 
 * @param {Object} enemy 
 * @param {number} defenderSkill - The hero's active combat skill level (plus equipment defense)
 * @param {string} heroStyle - The hero's active combat style
 * @returns {number} Final damage
 */
export function computeEnemyDamage(enemy, defenderSkill, heroStyle = 'melee') {
    // Base damage from enemy stats
    const baseDamage = rollDamage(enemy.minDamage, enemy.maxDamage);

    // Apply RPS (Enemy vs Hero)
    const enemyType = enemy.combatType || 'melee';
    const rpsMultiplier = calculateRpsMultiplier(enemyType, heroStyle);

    // Apply defence reduction
    const defenceReduction = calculateDefenceReduction(defenderSkill);

    const damageAfterRps = baseDamage * rpsMultiplier;
    const finalDamage = Math.floor(damageAfterRps * (1 - defenceReduction));

    // Minimum 1 damage
    return Math.max(1, finalDamage);
}

/**
 * Get the relevant combat skill for a hero based on selected style
 * @param {Object} hero 
 * @param {string} selectedStyle 
 * @returns {number} 
 */
export function getHeroCombatSkill(hero, selectedStyle = 'melee') {
    return hero.skills?.[selectedStyle]?.level ?? 1;
}

/**
 * Calculate hero attack speed (time between attacks in ms).
 * Delegates to FormulaRegistry.
 */
export function getHeroAttackSpeed(skillLevel = 1, tickSpeedBonus = 0) {
    return _heroAttackSpeed(skillLevel, tickSpeedBonus);
}

// Re-export consumption threshold from FormulaRegistry
export const CONSUMPTION_THRESHOLD = _AUTO_CONSUME_THRESHOLD;
 
/**
 * Check if hero should auto-consume (HP or Energy below threshold)
 * 
 * @param {Object} hero - Hero object with hp and energy
 * @returns {{ needsFood: boolean, needsDrink: boolean }}
 */
export function checkAutoConsume(hero) {
    const hpPercent = hero.hp.current / hero.hp.max;
    const energyPercent = hero.energy.current / hero.energy.max;
 
    return {
        needsFood: hpPercent < CONSUMPTION_THRESHOLD,
        needsDrink: energyPercent < CONSUMPTION_THRESHOLD
    };
}

/**
 * Determine combat skill XP to award based on enemy.
 * All combat XP is now a flat value from the enemy registry.
 * 
 * @param {Object} enemy - Enemy object with xpAwarded
 * @returns {number} Flat XP award
 */
export function getCombatXpAward(enemy) {
    if (typeof enemy.xpAwarded === 'number') {
        return enemy.xpAwarded;
    }
    // Fallback if registry hasn't been fully converted
    return (enemy.xpAwarded?.combat ?? 10) + (enemy.xpAwarded?.defence ?? 5);
}
