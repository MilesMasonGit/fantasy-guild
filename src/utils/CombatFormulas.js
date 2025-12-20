// Fantasy Guild - Combat Formulas
// Phase 30: Combat Formulas

/**
 * CombatFormulas - Stateless utility module for combat calculations
 * 
 * All functions are pure - no side effects, no state.
 * Used by CombatSystem for hit/damage calculations.
 * 
 * Formulas from architecture_proposal.md:
 * - Hit Chance: 50 + (AttackerSkill - DefenderSkill) * 2 (capped 5%-95%)
 * - Base Damage: weapon.minDamage + random(0, weapon.maxDamage - weapon.minDamage)
 * - Defence Reduction: Math.min(defenceSkill * 0.5, 50)% reduction
 */

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
 * Calculate hit chance percentage
 * Formula: 50 + (attackerSkill - defenderSkill) * 2, capped 5%-95%
 * 
 * @param {number} attackerSkill - Attacker's combat skill level
 * @param {number} defenderSkill - Defender's defence skill level
 * @returns {number} Hit chance as percentage (5-95)
 */
export function calculateHitChance(attackerSkill, defenderSkill) {
    const baseChance = 50 + (attackerSkill - defenderSkill) * 2;
    return clamp(baseChance, 5, 95);
}

/**
 * Roll for hit based on attacker/defender skill difference
 * 
 * @param {number} attackerSkill - Attacker's combat skill level
 * @param {number} defenderSkill - Defender's defence skill level
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
 * Calculate defence reduction percentage
 * Formula: defenceSkill * 0.5, capped at 50%
 * 
 * @param {number} defenceSkill - Defender's defence skill level
 * @returns {number} Damage reduction as decimal (0-0.5)
 */
export function calculateDefenceReduction(defenceSkill) {
    const reductionPercent = Math.min(defenceSkill * 0.5, 50);
    return reductionPercent / 100;
}

/**
 * Calculate RPS multiplier
 * Melee < Ranged < Magic < Melee
 * Advantage: 1.25x damage, Disadvantage: 0.75x damage
 * @param {string} attackerType
 * @param {string} defenderType
 * @returns {number} Multiplier (1.25, 1.0, or 0.75)
 */
export function calculateRpsMultiplier(attackerType, defenderType) {
    if (!attackerType || !defenderType) return 1.0;

    const rules = {
        melee: { weak: 'ranged', strong: 'magic' },
        ranged: { weak: 'magic', strong: 'melee' },
        magic: { weak: 'melee', strong: 'ranged' }
    };

    if (rules[attackerType]?.strong === defenderType) return 1.25;
    if (rules[attackerType]?.weak === defenderType) return 0.75;
    return 1.0;
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
 */
export function computeEnemyDamage(enemy, effectiveDefenceSkill, heroStyle = 'melee') {
    // Base damage from enemy stats
    const baseDamage = rollDamage(enemy.minDamage, enemy.maxDamage);

    // Apply RPS (Enemy vs Hero)
    // Note: If Enemy(Melee) hits Hero(Magic) -> Enemy Strong -> 1.25x
    // This assumes Hero's active style is their "Defence Type" for this context
    const enemyType = enemy.combatType || 'melee';
    const rpsMultiplier = calculateRpsMultiplier(enemyType, heroStyle);

    // Apply defence reduction
    const defenceReduction = calculateDefenceReduction(effectiveDefenceSkill);

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
 * Calculate hero attack speed (time between attacks in ms)
 * Base speed: 3000ms
 * Formula: Base / (1 + Skill * 0.005) - similar to Task efficiency
 * Adjusted by equipment bonuses
 * 
 * @param {number} skillLevel - Weapon skill level (default 1)
 * @param {number} tickSpeedBonus - Total tick speed bonus from equipment (negative is faster)
 * @returns {number} Attack speed in milliseconds
 */
export function getHeroAttackSpeed(skillLevel = 1, tickSpeedBonus = 0) {
    const baseSpeed = 3000;

    // Apply skill reduction first (efficiency)
    // Level 1: 3000 / 1.005 = 2985ms
    // Level 10: 3000 / 1.05 = 2857ms
    // Level 100: 3000 / 1.5 = 2000ms
    const skillMultiplier = 1 + (skillLevel * 0.005);
    const speedAfterSkill = baseSpeed / skillMultiplier;

    // Apply equipment bonus (flat reduction usually)
    // Bonus is usually negative (e.g., -300 = 300ms faster)
    return Math.max(500, speedAfterSkill + tickSpeedBonus);
}

/**
 * Check if hero should auto-consume (HP or Energy below 20%)
 * 
 * @param {Object} hero - Hero object with hp and energy
 * @returns {{ needsFood: boolean, needsDrink: boolean }}
 */
export function checkAutoConsume(hero) {
    const hpPercent = hero.hp.current / hero.hp.max;
    const energyPercent = hero.energy.current / hero.energy.max;

    return {
        needsFood: hpPercent < 0.20,
        needsDrink: energyPercent < 0.20
    };
}

/**
 * Determine combat skill XP to award based on attack type
 * 
 * @param {Object} enemy - Enemy object with xpAwarded
 * @param {string} attackType - 'melee', 'ranged', or 'magic'
 * @returns {{ combatXp: number, defenceXp: number }}
 */
export function getCombatXpAward(enemy, attackType) {
    return {
        combatXp: enemy.xpAwarded?.combat ?? 10,
        defenceXp: enemy.xpAwarded?.defence ?? 5
    };
}
