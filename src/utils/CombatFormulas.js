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
    GLOBAL_COMBAT_XP_MULTIPLIER,
} from '../config/FormulaRegistry.js';

export { BASE_ATTACK_SPEED_MS, MIN_ATTACK_SPEED_MS };

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
/**
 * Calculate hit chance percentage with Option A stat-scaling and gear traits.
 * Formula: BASE + (effectiveAttackerSkill - effectiveDefenderSkill) * SCALE + Finesse - Deflection, clamped.
 */
export function calculateHitChance(attackerSkill, defenderSkill, attackerStyle = 'melee', defenderStyle = 'melee', attacker = null, defender = null) {
    // 1. Option A Stat Scaling based on RPS Matchup
    const rps = calculateRpsMultiplier(attackerStyle, defenderStyle);
    let effectiveAtk = attackerSkill;
    let effectiveDef = defenderSkill;
    
    if (rps > 1.0) {
        effectiveAtk = attackerSkill * 1.25;
        effectiveDef = defenderSkill * 0.75;
    } else if (rps < 1.0) {
        effectiveAtk = attackerSkill * 0.75;
        effectiveDef = defenderSkill * 1.25;
    }

    // 2. Base Skill-Based Hit Chance
    let chance = _hitChance(effectiveAtk, effectiveDef);

    // 3. Apply Gear Modifiers (Finesse Accuracy & Deflection Evasion)
    const accuracy = attacker?.aggregator?.query('ACCURACY') || 0;
    const evasion = defender?.aggregator?.query('EVASION') || 0;

    chance = chance + accuracy - evasion;

    return clamp(chance, 5, 95);
}

/**
 * Roll for hit based on attacker/defender skill difference and elemental matchup.
 * 
 * @param {number} attackerSkill - Attacker's combat skill level
 * @param {number} defenderSkill - Defender's combat skill level
 * @param {string} attackerStyle - Attacker's combat style
 * @param {string} defenderStyle - Defender's combat style
 * @param {Object} attacker - Attacker entity (for gear modifiers)
 * @param {Object} defender - Defender entity (for gear modifiers)
 * @returns {boolean} True if attack hits
 */
export function rollHit(attackerSkill, defenderSkill, attackerStyle = 'melee', defenderStyle = 'melee', attacker = null, defender = null) {
    const hitChance = calculateHitChance(attackerSkill, defenderSkill, attackerStyle, defenderStyle, attacker, defender);
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
 * Compute damage dealt from hero to enemy.
 * Skill-based base damage, Option A RPS, and modular weapon modifiers (Damage & Sunder).
 */
export function computeHeroDamage(hero, enemy, weapon, damageBonus = 0, selectedStyle = 'melee') {
    // 1. Core Combat Scaling: Deriving base damage range from effective active skill level
    const heroSkill = getHeroCombatSkill(hero, selectedStyle);
    const enemyType = enemy.combatType || 'melee';
    const rps = calculateRpsMultiplier(selectedStyle, enemyType);
    
    let effectiveSkill = heroSkill;
    let effectiveEnemyDef = enemy.defenceSkill;
    
    if (rps > 1.0) {
        effectiveSkill = heroSkill * 1.25;
        effectiveEnemyDef = enemy.defenceSkill * 0.75;
    } else if (rps < 1.0) {
        effectiveSkill = heroSkill * 0.75;
        effectiveEnemyDef = enemy.defenceSkill * 1.25;
    }

    const baseMin = Math.max(1, Math.floor(effectiveSkill * 0.4));
    const baseMax = Math.max(2, Math.floor(effectiveSkill * 0.6));
    
    // 2. Roll base damage and add flat damage modifiers (Damage)
    let baseDamage = rollDamage(baseMin, baseMax) + damageBonus;

    // 3. Apply Sunder (Penetration) modifier to enemy defense skill
    const sunderPct = hero?.aggregator?.query('SUNDER') || 0; // ignores % of defense skill
    const finalEnemyDefSkill = Math.max(0, effectiveEnemyDef * (1 - sunderPct));
    
    // Apply defence reduction
    const defenceReduction = calculateDefenceReduction(finalEnemyDefSkill);

    // Final Damage calculation
    const finalDamage = Math.floor(baseDamage * (1 - defenceReduction));

    // Minimum 1 damage
    return Math.max(1, finalDamage);
}

/**
 * Compute damage dealt from enemy to hero.
 * Includes RPS, defense reduction, and Resistance flat damage absorption.
 * 
 * @param {Object} enemy 
 * @param {number} defenderSkill - The hero's active combat skill level (plus equipment defense)
 * @param {string} heroStyle - The hero's active combat style
 * @param {Object} hero - The hero entity (for Resistance flat gear modifier)
 * @returns {number} Final damage
 */
export function computeEnemyDamage(enemy, defenderSkill, heroStyle = 'melee', hero = null) {
    // Base damage from enemy stats
    const baseDamage = rollDamage(enemy.minDamage, enemy.maxDamage);

    // Apply Option A stat scaling to defender skill (Enemy vs Hero)
    const enemyType = enemy.combatType || 'melee';
    const rps = calculateRpsMultiplier(enemyType, heroStyle);
    let effectiveDefenderSkill = defenderSkill;
    
    if (rps > 1.0) {
        effectiveDefenderSkill = defenderSkill * 0.75;
    } else if (rps < 1.0) {
        effectiveDefenderSkill = defenderSkill * 1.25;
    }

    // Apply defence reduction
    const defenceReduction = calculateDefenceReduction(effectiveDefenderSkill);

    let finalDamage = Math.floor(baseDamage * (1 - defenceReduction));

    // Apply Resistance flat damage absorption modifier
    const flatResist = hero?.aggregator?.query('RESIST_FLAT') || 0;
    finalDamage = Math.max(1, finalDamage - flatResist);

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
    const baseStat = enemy.combatStat ?? enemy.attackSkill ?? 1;
    return Math.round(baseStat * GLOBAL_COMBAT_XP_MULTIPLIER);
}
