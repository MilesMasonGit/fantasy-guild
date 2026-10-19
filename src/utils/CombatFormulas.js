// Fantasy Guild - Combat Formulas
// Tunable constants live in FormulaRegistry.js; this file provides
// hero/enemy-aware wrappers.

import {
    growth,
    heroMaxHp as _heroMaxHp,
    heroBaseDamage,
    blockChance,
    hitChance as _hitChance,
    rollDamageSpread,
    rpsOutcome,
    RPS_HIT_SHIFT,
    RPS_DAMAGE_SHIFT,
    HERO_ATTACK_INTERVAL_MS,
    ENEMY_ATTACK_INTERVAL_MS,
    BASE_ATTACK_SPEED_MS,
    MIN_ATTACK_SPEED_MS,
    DAMAGE_SPREAD_MIN,
    DAMAGE_SPREAD_MAX,
} from '../config/FormulaRegistry.js';
import { COMBAT_SKILL_IDS, isCombatSkill } from '../config/registries/skillRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getPrimaryWeapon } from '../config/registries/equipmentConstants.js';
import { sumStatusEffect } from '../config/registries/statusRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

export { BASE_ATTACK_SPEED_MS, MIN_ATTACK_SPEED_MS, HERO_ATTACK_INTERVAL_MS, ENEMY_ATTACK_INTERVAL_MS };

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * The combat style a hero uses is determined entirely by the equipped
 * weapon's type. Unarmed counts as Melee.
 *
 * With two hands the PRIMARY weapon decides (the first occupied hand), so a
 * sword in hand1 and a bow in hand2 fights melee.
 * @param {Object} hero
 * @returns {string} a combat skill id
 */
export function getHeroCombatStyle(hero) {
    const weaponId = getPrimaryWeapon(hero);
    if (weaponId) {
        const weapon = getItem(weaponId);
        const style = weapon?.skillRequired;
        if (isCombatSkill(style)) return style;
    }
    // Unarmed: fall back to the hero's own combat skill rather than assuming
    // melee, so an unarmed Ranger fights ranged.
    return getHeroCombatSkillEntry(hero).id || 'melee';
}

/**
 * The ONE combat skill a hero holds, and its level, exactly as saved.
 *
 * **A hero holds exactly one of Melee, Ranged, Magic or Stealth, or none at all.** That
 * single skill supplies attack *and* defence, max HP and block. A Melee 30 hero attacks at
 * 30 and defends at 30.
 *
 * ⚠️ **Not the number the combat maths uses.** A hero holding none (a Recruit) reads
 * `{ id: null, level: 0 }` here, which is what decides that their fights earn no combat XP.
 * The maths reads {@link getHeroCombatLevel}, which puts a Recruit at 1.
 *
 * @param {Object} hero
 * @returns {{ id: string|null, level: number }}
 */
export function getHeroCombatSkillEntry(hero) {
    for (const id of COMBAT_SKILL_IDS) {
        const s = hero?.skills?.[id];
        if (s) return { id, level: typeof s === 'number' ? s : (s.level || 0) };
    }
    return { id: null, level: 0 };
}

/** The level a hero who holds no combat skill fights at: a level 1 fighter with what they hold. */
export const UNSKILLED_COMBAT_LEVEL = 1;

/**
 * The combat level every combat formula uses: the held combat skill's level, or
 * {@link UNSKILLED_COMBAT_LEVEL} for a hero who holds none. Nothing is written to the hero.
 */
export function getHeroCombatLevel(hero) {
    const { id, level } = getHeroCombatSkillEntry(hero);
    return id ? level : UNSKILLED_COMBAT_LEVEL;
}

/**
 * Whether this hero can fight at all. Everyone fights: a hero holding no combat skill fights
 * as a level 1 fighter (see {@link getHeroCombatLevel}).
 */
export function canHeroFight(hero) {
    return !!hero;
}

/**
 * Get the hero's combat level (see {@link getHeroCombatLevel}).
 *
 * ⚠️ The `selectedStyle` argument is **ignored** and kept only so existing call
 * sites keep compiling. A hero has one style; the equipped weapon only decides
 * which side of the matchup cycle they fight on.
 */
export function getHeroCombatSkill(hero, _selectedStyle = 'melee') {
    return getHeroCombatLevel(hero);
}

/**
 * A hero's defensive number. The single combat skill supplies both halves, so
 * skills cannot build a tanky hero distinct from a damaging one; defensive
 * building is equipment.
 */
export function getHeroDefenseSkill(hero) {
    return getHeroCombatLevel(hero);
}

/**
 * Hero max HP from skills; both terms of the formula use the single combat
 * skill.
 *
 * A hero holding no combat skill gets the level 1 fighter's HP, matching
 * {@link getHeroCombatLevel}. ⚠️ A held skill at level 0 also floors at 1 here,
 * since a max HP of zero is unrepresentable.
 *
 * @param {Object} skills - hero.skills map
 * @returns {number}
 */
export function heroMaxHpFromSkills(skills) {
    if (!skills) return _heroMaxHp(1, 1);
    const { level } = getHeroCombatSkillEntry({ skills });
    const effective = Math.max(1, level);
    return _heroMaxHp(effective, effective);
}

/**
 * A hero's effective Block %: gear block amplified by their combat skill, plus
 * the innate block that skill grants.
 */
export function getHeroBlockChance(hero) {
    const gearBlock = hero?.aggregator?.query('BLOCK') || 0;
    return blockChance(getHeroDefenseSkill(hero), gearBlock);
}

/**
 * Calculate hit chance (spec §7 step 2): skill difference, Accuracy, Block and
 * the RPS shift, clamped.
 *
 * @param {number} attackerSkill - Attacker's active style skill level
 * @param {number} defenderDefense - Defender's Defense skill level (enemies: their level)
 * @param {string} attackerStyle
 * @param {string} defenderStyle
 * @param {Object} attacker - entity (for gear Accuracy)
 * @param {Object} defender - entity (for Block: hero innate / enemy blockChance field)
 * @returns {number} Hit chance (5-95)
 */
export function calculateHitChance(attackerSkill, defenderDefense, attackerStyle = 'melee', defenderStyle = 'melee', attacker = null, defender = null) {
    const rpsShift = rpsOutcome(attackerStyle, defenderStyle) * RPS_HIT_SHIFT;
    const accuracy = attacker?.aggregator?.query('ACCURACY') || 0;

    let defenderBlock = 0;
    if (defender?.skills) {
        defenderBlock = getHeroBlockChance(defender);
    } else if (defender?.blockChance) {
        defenderBlock = defender.blockChance; // enemy budget deviation, later
    }

    return _hitChance(attackerSkill, defenderDefense, rpsShift, accuracy, defenderBlock);
}

/**
 * Roll for hit. One roll; a miss/block ends the attack (spec §7).
 */
export function rollHit(attackerSkill, defenderSkill, attackerStyle = 'melee', defenderStyle = 'melee', attacker = null, defender = null) {
    const hitChance = calculateHitChance(attackerSkill, defenderSkill, attackerStyle, defenderStyle, attacker, defender);
    const roll = Math.random() * 100;
    return roll < hitChance;
}

/**
 * Roll damage within a range (inclusive)
 */
export function rollDamage(minDamage, maxDamage) {
    if (minDamage >= maxDamage) return minDamage;
    return minDamage + Math.floor(Math.random() * (maxDamage - minDamage + 1));
}

/**
 * The outgoing-damage multiplier a hero carries.
 *
 * ⚠️ Reads BOTH sources: `damage_pct` from the old status engine, and the
 * `DAMAGE` percentage bucket that a carried library effect registers. One
 * function so the two cannot drift.
 */
export function damageMultiplierOf(hero) {
    const fromStatuses = sumStatusEffect(hero?.statuses, 'damage_pct');
    const fromEffects = hero?.aggregator?.getPercentageBucket
        ? hero.aggregator.getPercentageBucket(EFFECT_TYPES.DAMAGE) - 1
        : 0;
    return 1 + fromStatuses + fromEffects;
}

/**
 * Compute damage dealt from hero to enemy (spec §7 steps 3-5): base from the
 * combat skill plus weapon damage and flat bonuses, spread, buffs, RPS shift,
 * minus enemy flat Armor; min 1.
 */
export function computeHeroDamage(hero, enemy, weapon, damageBonus = 0, selectedStyle = 'melee', enemyStatuses = null) {
    const skill = getHeroCombatSkill(hero, selectedStyle);
    const base = heroBaseDamage(skill) + (weapon?.damage || 0) + damageBonus;

    let damage = rollDamageSpread(base);

    // Damage buffs sum additively; `damageMultiplierOf` reads both sources.
    damage *= damageMultiplierOf(hero);

    const enemyStyle = enemy?.combatType || 'melee';
    damage *= 1 + rpsOutcome(selectedStyle, enemyStyle) * RPS_DAMAGE_SHIFT;

    // Flat Armor subtracts after the spread and multipliers.
    const armor = enemyFlatArmor(enemy, enemyStatuses);

    return Math.max(1, Math.round(damage - armor));
}


/**
 * The flat damage reduction a hero carries: Armor, legacy DEFENSE, and any
 * armour a status is lending them. One function so armour means one thing
 * regardless of what hit you.
 *
 * ⚠️ `DEFENSE` is summed in alongside `ARMOR` deliberately: existing armour
 * items register their `defense` stat on that axis, and it is treated as flat
 * Armor.
 */
export function heroFlatArmor(hero) {
    return (hero?.aggregator?.query('ARMOR') || 0)
        + (hero?.aggregator?.query('DEFENSE') || 0)
        + sumStatusEffect(hero?.statuses, 'flat_armor');
}

/**
 * The flat damage reduction an **enemy** carries.
 *
 * One function so armour means the same thing on both sides of a fight.
 * `enemyStatuses` is the old status engine's list, summed in as `heroFlatArmor`
 * sums the hero's.
 */
export function enemyFlatArmor(enemy, enemyStatuses = null) {
    return (enemy?.armor || 0)
        + (enemy?.aggregator?.query('ARMOR') || 0)
        + (enemy?.aggregator?.query('DEFENSE') || 0)
        + sumStatusEffect(enemyStatuses, 'flat_armor');
}

/** The flat damage reduction applied after armour. */
export function heroFlatResist(hero) {
    return hero?.aggregator?.query('RESIST_FLAT') || 0;
}

/**
 * Damage from a non-combat source, mitigated.
 *
 * ⚠️ **Floors at zero, where a combat hit floors at one**, deliberately.
 * Combat's minimum of 1 exists so a fight always progresses; a thorn is not a
 * fight, and a floor of 1 would make heavy armour worth nothing against it.
 */
export function mitigateFlatDamage(hero, rawDamage) {
    const reduced = rawDamage - heroFlatArmor(hero) - heroFlatResist(hero);
    return Math.max(0, Math.round(reduced));
}

/**
 * Compute damage dealt from enemy to hero (spec §7 steps 3-5). Enemy min/max
 * already carry the damage spread (derived from the band budget); RPS shift;
 * minus hero flat Armor and Resist; min 1.
 */
export function computeEnemyDamage(enemy, hero = null, heroStyle = 'melee') {
    const base = rollDamage(enemy.minDamage ?? 1, enemy.maxDamage ?? 1);

    const enemyStyle = enemy.combatType || 'melee';
    let damage = base * (1 + rpsOutcome(enemyStyle, heroStyle) * RPS_DAMAGE_SHIFT);

    // Existing armor items register `defense` as DEFENSE modifiers, which
    // `heroFlatArmor` treats as flat Armor.
    const armor = heroFlatArmor(hero);
    const flatResist = heroFlatResist(hero);

    return Math.max(1, Math.round(damage - armor - flatResist));
}

/**
 * Deterministic hero damage range for UI display — mirrors computeHeroDamage
 * exactly, with the spread bounds substituted for the random roll.
 */
export function getHeroDamageRange(hero, enemy, weapon, damageBonus = 0, selectedStyle = 'melee', enemyStatuses = null) {
    const skill = getHeroCombatSkill(hero, selectedStyle);
    const base = heroBaseDamage(skill) + (weapon?.damage || 0) + damageBonus;
    const buffMult = damageMultiplierOf(hero);
    const enemyStyle = enemy?.combatType || 'melee';
    const rpsMult = 1 + rpsOutcome(selectedStyle, enemyStyle) * RPS_DAMAGE_SHIFT;
    const armor = enemyFlatArmor(enemy, enemyStatuses);
    return {
        min: Math.max(1, Math.round(base * DAMAGE_SPREAD_MIN * buffMult * rpsMult - armor)),
        max: Math.max(1, Math.round(base * DAMAGE_SPREAD_MAX * buffMult * rpsMult - armor))
    };
}

/**
 * Deterministic enemy damage range for UI display — mirrors computeEnemyDamage
 * (enemy min/max already carry the spread from the band budget).
 */
export function getEnemyDamageRange(enemy, hero = null, heroStyle = 'melee') {
    const enemyStyle = enemy?.combatType || 'melee';
    const rpsMult = 1 + rpsOutcome(enemyStyle, heroStyle) * RPS_DAMAGE_SHIFT;
    const armor = heroFlatArmor(hero);
    const flatResist = heroFlatResist(hero);
    return {
        min: Math.max(1, Math.round((enemy?.minDamage ?? 1) * rpsMult - armor - flatResist)),
        max: Math.max(1, Math.round((enemy?.maxDamage ?? 1) * rpsMult - armor - flatResist))
    };
}

/**
 * Hero attack interval: a fixed value until weapon archetypes redefine it.
 */
export function getHeroAttackSpeed() {
    return HERO_ATTACK_INTERVAL_MS;
}

/**
 * XP for defeating an enemy, derived onto the enemy stat block from its
 * band budget.
 */
export function getCombatXpAward(enemy) {
    return enemy?.xpAwarded ?? 1;
}

export { growth };
