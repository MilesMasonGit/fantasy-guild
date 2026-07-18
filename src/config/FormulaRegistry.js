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
// COMBAT FORMULAS — 7-Stat Engine (combat_formula_spec.md)
// Structures are owner-locked; ⚠ constants are first-calibration values
// verified by tools/curve_explorer.html. Crit, Armor, and weapon-speed
// archetypes are hooks only for now (later implementation pass).
// =============================================================================

/**
 * The growth curve — one dial for the whole game (spec §1).
 * G(L) = 1.045^(L−1); G(1) = 1.0, G(99) ≈ 75×.
 */
export const GROWTH_RATE = 1.045;
export function growth(level) {
    return Math.pow(GROWTH_RATE, Math.max(1, level) - 1);
}

// --- Hero stats from skills alone (spec §3, "naked hero") ---

/** HP = 30·G(Combat Level) + 20·G(Defense) ⚠ */
export const HERO_HP_CL_BUDGET = 30;
export const HERO_HP_DEFENSE_BUDGET = 20;
export function heroMaxHp(combatLevel, defenseLevel) {
    return Math.round(
        HERO_HP_CL_BUDGET * growth(combatLevel) +
        HERO_HP_DEFENSE_BUDGET * growth(defenseLevel)
    );
}

/** Per-hit damage = 4·G(active style skill) ⚠ */
export const HERO_DAMAGE_BUDGET = 4;
export function heroBaseDamage(styleSkillLevel) {
    return HERO_DAMAGE_BUDGET * growth(styleSkillLevel);
}

/** Fixed attack intervals for this pass (weapon archetypes redefine hero speed later) ⚠ */
export const HERO_ATTACK_INTERVAL_MS = 2500;
export const ENEMY_ATTACK_INTERVAL_MS = 3000;

/**
 * Innate Block from Defense skill (owner-approved deviation 2026-07-12:
 * spec has Block as gear-only; owner chose a small innate chance so Block
 * exists before the gear pass). 0.125%/level → ~12.4% at Defense 99.
 * Gear block will slot into the same term, amplified ×(1 + Defense/200).
 */
export const INNATE_BLOCK_PER_DEFENSE = 0.125;
export function blockChance(defenseLevel, gearBlock = 0) {
    return gearBlock * (1 + defenseLevel / 200) + defenseLevel * INNATE_BLOCK_PER_DEFENSE;
}

// --- Hit roll (spec §7 step 2) ---

/** Base hit chance percentage (owner-locked) */
export const BASE_HIT_CHANCE = 75;

/** Hit shift per level of (attacker style skill − defender Defense) ⚠ */
export const HIT_CHANCE_SKILL_SCALE = 0.25;

/** Hit chance min/max bounds */
export const HIT_CHANCE_MIN = 5;
export const HIT_CHANCE_MAX = 95;

/**
 * Combat hit chance per the spec pipeline:
 * 75 + 0.25·(attacker skill − defender Defense) + accuracy − block ± RPS, clamped 5–95.
 * @param {number} attackerSkill - Attacker's active style skill level
 * @param {number} defenderDefense - Defender's Defense skill level
 * @param {number} rpsShift - ±RPS_HIT_SHIFT or 0 (from rpsOutcome)
 * @param {number} accuracy - Attacker's flat Accuracy (gear; 0 for now)
 * @param {number} defenderBlock - Defender's effective Block %
 * @returns {number} Hit chance (5-95)
 */
export function hitChance(attackerSkill, defenderDefense, rpsShift = 0, accuracy = 0, defenderBlock = 0) {
    const raw = BASE_HIT_CHANCE
        + (attackerSkill - defenderDefense) * HIT_CHANCE_SKILL_SCALE
        + accuracy - defenderBlock + rpsShift;
    return Math.max(HIT_CHANCE_MIN, Math.min(HIT_CHANCE_MAX, raw));
}

// --- Damage roll (spec §7 step 3) ---

/** Uniform per-hit damage spread ⚠ */
export const DAMAGE_SPREAD_MIN = 0.85;
export const DAMAGE_SPREAD_MAX = 1.15;
export function rollDamageSpread(baseDamage) {
    const spread = DAMAGE_SPREAD_MIN + Math.random() * (DAMAGE_SPREAD_MAX - DAMAGE_SPREAD_MIN);
    return baseDamage * spread;
}

// --- RPS (spec §9, owner-locked orientation) ---

/** Favorable matchup: +10% damage, +7 hit chance; unfavorable inverts. ⚠ exact split */
export const RPS_HIT_SHIFT = 7;
export const RPS_DAMAGE_SHIFT = 0.10;

/**
 * Rock-Paper-Scissors matchup table (owner-locked 2026-07-10):
 * Melee > Ranged > Magic > Melee — warriors close on archers,
 * archers pick off mages, mages melt armored warriors.
 */
export const RPS_RULES = {
    melee:  { strong: 'ranged', weak: 'magic' },
    ranged: { strong: 'magic',  weak: 'melee' },
    magic:  { strong: 'melee',  weak: 'ranged' },
};

/**
 * RPS outcome for attacker vs defender styles.
 * @returns {number} +1 favorable, −1 unfavorable, 0 neutral
 */
export function rpsOutcome(attackerType, defenderType) {
    if (!attackerType || !defenderType) return 0;
    const atk = attackerType.toLowerCase();
    const def = defenderType.toLowerCase();
    if (RPS_RULES[atk]?.strong === def) return 1;
    if (RPS_RULES[atk]?.weak === def) return -1;
    return 0;
}

// --- Enemy budgets (spec §6, banded) ---

/** Enemy HP = 32·G(level), damage = 9·G(level) ⚠ */
export const ENEMY_HP_BUDGET = 32;
export const ENEMY_DAMAGE_BUDGET = 9;

/** XP per kill = 12·G(level)^1.15 — super-linear so on-level is XP-optimal ⚠ */
export const ENEMY_XP_BUDGET = 12;
export const ENEMY_XP_EXPONENT = 1.15;

/**
 * Derive an enemy's combat stat block from its level (band).
 * `budgetScale` is an informal precursor of the spec's budget-trade rule:
 * it scales HP/damage/XP together (tutorial pushovers < 1.0 < beefy bosses).
 * @param {number} level - The enemy's band level (1-99)
 * @param {number} budgetScale - Budget multiplier (default 1.0)
 * @returns {{ hp: number, minDamage: number, maxDamage: number, attackIntervalMs: number, xp: number }}
 */
export function enemyCombatBudget(level, budgetScale = 1.0) {
    const g = growth(level);
    const damage = ENEMY_DAMAGE_BUDGET * g * budgetScale;
    return {
        hp: Math.max(1, Math.round(ENEMY_HP_BUDGET * g * budgetScale)),
        minDamage: Math.max(1, Math.round(damage * DAMAGE_SPREAD_MIN)),
        maxDamage: Math.max(1, Math.round(damage * DAMAGE_SPREAD_MAX)),
        attackIntervalMs: ENEMY_ATTACK_INTERVAL_MS,
        xp: Math.max(1, Math.round(ENEMY_XP_BUDGET * Math.pow(g, ENEMY_XP_EXPONENT) * budgetScale))
    };
}

/** On kill: weapon skill gets full XP, Defense gets this share (owner-locked 2026-07-12) */
export const DEFENSE_XP_SHARE = 1 / 3;

/**
 * The global status-effect clock (status_effects_concept.md §1B): every
 * periodic status ticks once per interval, in combat and out of it.
 */
export const STATUS_TICK_INTERVAL_MS = 5000;

// --- Legacy combat constants (dormant pre-rework combat path only) ---

/** @deprecated legacy attack-speed model; live combat uses fixed intervals */
export const BASE_ATTACK_SPEED_MS = 3000;
export const MIN_ATTACK_SPEED_MS = 500;
export function heroAttackSpeed() {
    return HERO_ATTACK_INTERVAL_MS;
}

/** @deprecated legacy percentage damage reduction; the spec uses flat Armor (gear, later) */
export function defenceReduction() {
    return 0;
}

/** @deprecated legacy ±25% multiplier RPS; the spec uses flat +7 hit / +10% damage */
export function rpsMultiplier(attackerType, defenderType) {
    const outcome = rpsOutcome(attackerType, defenderType);
    return 1 + outcome * RPS_DAMAGE_SHIFT;
}

// =============================================================================
// REGEN
// =============================================================================

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

/** Global modifier to scale combat XP awards based directly on the enemy's Combat Stat. */
export const GLOBAL_COMBAT_XP_MULTIPLIER = 1.0;

/** Max skill level */
export const MAX_SKILL_LEVEL = 99;

/** XP curve formula constant: floor(level + 300 * 2^(level/7)) / 4 cumulative */
// The actual XP curve implementation lives in XPCurve.js with its pre-computed table.
// This constant is here for documentation and potential future hot-swapping.
export const XP_CURVE_BASE = 300;
export const XP_CURVE_EXPONENT_DIVISOR = 7;
