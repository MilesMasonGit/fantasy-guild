// Fantasy Guild - Formula Registry
// Centralized game math for easy tuning and hot-swapping.
// All balance-tunable formulas and constants live here.
// Change a value → reload → every system picks it up. No save migration needed.

// =============================================================================
// SKILL & TASK FORMULAS
// =============================================================================

/**
 * Skill speed factor: how much each skill level contributes to task/attack speed.
 * Used in: HeroManager (aggregator registration), CombatFormulas (attack speed)
 * Example: Level 10 → 10 * 0.005 = 0.05 = +5% speed
 */
export const SKILL_SPEED_FACTOR = 0.005;

/**
 * Calculate the effective speed multiplier from a skill level.
 * This is the value registered as an aggregator modifier.
 * @param {number} level - Skill level
 * @returns {number} Additive speed bonus (e.g. 0.05 for level 10)
 */
export function skillSpeedBonus(level) {
    return level * SKILL_SPEED_FACTOR;
}

/**
 * Tool speed multiplier: converts a tool's speedBonus (0-1 reduction) to a multiplier.
 * Formula: 1 / (1 - reduction), capped at 0.9 reduction to prevent divide-by-zero.
 * @param {number} speedBonus - Tool's speed bonus (0 to ~0.5 typically)
 * @returns {number} Multiplier (e.g. 1.25 for a 0.2 bonus)
 */
export function toolSpeedMultiplier(speedBonus) {
    if (!speedBonus) return 1.0;
    const reduction = Math.min(0.9, speedBonus);
    return 1 / (1 - reduction);
}

// =============================================================================
// COMBAT FORMULAS
// =============================================================================

/** Base attack speed in milliseconds (before skill/equipment modifiers) */
export const BASE_ATTACK_SPEED_MS = 3000;

/** Minimum attack speed in milliseconds (speed floor) */
export const MIN_ATTACK_SPEED_MS = 500;

/**
 * Calculate hero attack speed (time between attacks in ms).
 * Formula: Base / (1 + skill * SKILL_SPEED_FACTOR) + tickSpeedBonus
 * @param {number} skillLevel - Weapon skill level (default 1)
 * @param {number} tickSpeedBonus - Equipment speed bonus (negative = faster)
 * @returns {number} Attack speed in milliseconds
 */
export function heroAttackSpeed(skillLevel = 1, tickSpeedBonus = 0) {
    const skillMultiplier = 1 + (skillLevel * SKILL_SPEED_FACTOR);
    const speedAfterSkill = BASE_ATTACK_SPEED_MS / skillMultiplier;
    return Math.max(MIN_ATTACK_SPEED_MS, speedAfterSkill + tickSpeedBonus);
}

/** Base hit chance percentage */
export const BASE_HIT_CHANCE = 50;

/** Hit chance skill scaling (per level difference) */
export const HIT_CHANCE_SKILL_SCALE = 2;

/** Hit chance min/max bounds */
export const HIT_CHANCE_MIN = 5;
export const HIT_CHANCE_MAX = 95;

/**
 * Calculate hit chance percentage.
 * Formula: BASE + (attackerSkill - defenderSkill) * SCALE, clamped.
 * @param {number} attackerSkill
 * @param {number} defenderSkill
 * @returns {number} Hit chance (5-95)
 */
export function hitChance(attackerSkill, defenderSkill) {
    const raw = BASE_HIT_CHANCE + (attackerSkill - defenderSkill) * HIT_CHANCE_SKILL_SCALE;
    return Math.max(HIT_CHANCE_MIN, Math.min(HIT_CHANCE_MAX, raw));
}

/** Defence reduction: skill * this factor, as percentage (capped at DEFENCE_CAP) */
export const DEFENCE_SKILL_FACTOR = 0.5;

/** Maximum defence reduction percentage */
export const DEFENCE_CAP = 50;

/**
 * Calculate defence damage reduction as a decimal (0-0.5).
 * @param {number} combatSkill - Defender's primary combat skill level
 * @returns {number} Reduction as decimal
 */
export function defenceReduction(combatSkill) {
    const reductionPercent = Math.min(combatSkill * DEFENCE_SKILL_FACTOR, DEFENCE_CAP);
    return reductionPercent / 100;
}

/** RPS advantage/disadvantage multipliers */
export const RPS_ADVANTAGE = 1.25;
export const RPS_DISADVANTAGE = 0.75;
export const RPS_NEUTRAL = 1.0;

/**
 * Rock-Paper-Scissors combat type matchup table.
 * Melee > Magic > Ranged > Melee
 */
export const RPS_RULES = {
    melee:  { weak: 'ranged', strong: 'magic' },
    ranged: { weak: 'magic',  strong: 'melee' },
    magic:  { weak: 'melee',  strong: 'ranged' },
};

/**
 * Get the RPS damage multiplier.
 * @param {string} attackerType
 * @param {string} defenderType
 * @returns {number}
 */
export function rpsMultiplier(attackerType, defenderType) {
    if (!attackerType || !defenderType) return RPS_NEUTRAL;
    if (RPS_RULES[attackerType]?.strong === defenderType) return RPS_ADVANTAGE;
    if (RPS_RULES[attackerType]?.weak === defenderType) return RPS_DISADVANTAGE;
    return RPS_NEUTRAL;
}

// =============================================================================
// CONSUMPTION & REGEN
// =============================================================================

/** HP/Energy threshold below which heroes auto-consume food/drink (as decimal 0-1) */
export const AUTO_CONSUME_THRESHOLD = 0.20;

/** Regen configuration: amount healed per interval */
export const REGEN_CONFIG = {
    hp:     { amount: 1, interval: 5.0 },   // 1 HP every 5 seconds
    energy: { amount: 1, interval: 5.0 },   // 1 Energy every 5 seconds
};

// =============================================================================
// ECONOMY
// =============================================================================

/**
 * Recruitment cost scaling.
 * @param {number} totalRecruits - Total recruits hired so far
 * @returns {number} Gold cost for the next recruit
 */
export function recruitCost(totalRecruits) {
    return 10 + (totalRecruits * 2);
}

// =============================================================================
// XP FORMULAS (delegates to XPCurve.js — kept there for pre-computed table)
// =============================================================================

/** Max skill level */
export const MAX_SKILL_LEVEL = 99;

/** XP curve formula constant: floor(level + 300 * 2^(level/7)) / 4 cumulative */
// The actual XP curve implementation lives in XPCurve.js with its pre-computed table.
// This constant is here for documentation and potential future hot-swapping.
export const XP_CURVE_BASE = 300;
export const XP_CURVE_EXPONENT_DIVISOR = 7;
