// Fantasy Guild - Combat Formulas
// The numbers live in FormulaRegistry.js; this file reads them off heroes, their gear and enemies.

import {
    heroMaxHp,
    levelDamageBonus,
    UNARMED_DAMAGE,
    attackSpeedMs,
    missChance,
    BASE_CRIT_CHANCE,
    CRIT_MULTIPLIER,
    matchupMultiplier,
    roundHalfUp,
    rpsOutcome,
} from '../config/FormulaRegistry.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getEquippedEntries, isWeaponCategory } from '../config/registries/equipmentConstants.js';
import { isWeapon, weaponUsableBy } from '../config/registries/weaponStyles.js';
import { sumStatusEffect } from '../config/registries/statusRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

export { rpsOutcome };

/**
 * The ONE combat skill a hero holds, and its level, exactly as saved.
 *
 * **A hero holds exactly one of Melee, Ranged, Magic or Stealth, or none at all** (a Recruit,
 * who reads `{ id: null, level: 0 }` and fights barehanded with no style and no combat XP).
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

/** The combat level of a hero holding no combat skill: 0, so a Recruit has 10 HP. */
export const UNSKILLED_COMBAT_LEVEL = 0;

/**
 * The combat level every combat formula uses (HP, the damage step, the miss gap): the held combat
 * skill's level, or {@link UNSKILLED_COMBAT_LEVEL}. Nothing is written to the hero.
 */
export function getHeroCombatLevel(hero) {
    const { id, level } = getHeroCombatSkillEntry(hero);
    return id ? level : UNSKILLED_COMBAT_LEVEL;
}

/**
 * Whether this hero fights as a Recruit: holding no combat skill, they punch for 1 every 3 s
 * whatever is in their hands, with no style and no combat XP.
 */
export function fightsAsRecruit(hero) {
    return !getHeroCombatSkillEntry(hero).id;
}

/** Whether this hero can fight at all. Everyone fights; a Recruit barehanded. */
export function canHeroFight(hero) {
    return !!hero;
}

/**
 * Max HP from skills: 10 + the combat skill's level, 10 for a hero holding none.
 * @param {Object} skills - hero.skills map
 */
export function heroMaxHpFromSkills(skills) {
    return heroMaxHp(getHeroCombatLevel({ skills }));
}

/**
 * The weapon a hero swings, or null: the first weapon in the hands, in grid order, that belongs to
 * the hero's own style (`weaponStyles.js`).
 * ⚠️ A Recruit swings nothing even with a weapon equipped, and a weapon of another style (one held
 * from before a re-training, or from an older save) is not swung: the equip paths refuse both.
 */
export function getHeroWeapon(hero) {
    const style = getHeroCombatSkillEntry(hero).id;
    if (!style) return null;
    for (const { itemId, category } of getEquippedEntries(hero)) {
        if (!isWeaponCategory(category)) continue;
        const item = getItem(itemId);
        if (item && isWeapon(item) && weaponUsableBy(item, style)) return item;
    }
    return null;
}

/**
 * The side of the matchup cycle a hero fights on: always their own combat skill, since a hero
 * swings only weapons of that style (a Dagger is Melee and Stealth: a Fighter fights melee with
 * it, a Rogue stealth). A Recruit has none and is even with everyone.
 * @returns {string|null} a combat skill id, or null
 */
export function getHeroCombatStyle(hero) {
    return getHeroCombatSkillEntry(hero).id;
}

/** How long a hero's swing takes: the weapon's speed, normal (3 s) unarmed or as a Recruit. */
export function heroAttackSpeedMs(hero) {
    return attackSpeedMs(getHeroWeapon(hero)?.speed);
}

// --- What a hero carries (all default to 0 when nothing provides them) ------------------------

const axis = (entity, type) => entity?.aggregator?.query(type) || 0;

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
    return axis(hero, EFFECT_TYPES.ARMOR)
        + axis(hero, EFFECT_TYPES.DEFENSE)
        + sumStatusEffect(hero?.statuses, 'flat_armor');
}

/** The flat damage reduction applied after armour. */
export function heroFlatResist(hero) {
    return axis(hero, EFFECT_TYPES.RESIST_FLAT);
}

/** Percentage points taken off the hero's miss chance. */
export function heroAccuracy(hero) {
    return axis(hero, EFFECT_TYPES.ACCURACY);
}

/** Percentage points added to the miss chance of whoever attacks the hero. */
export function heroDodge(hero) {
    return axis(hero, EFFECT_TYPES.DODGE);
}

/** Armour points the hero's hits ignore. */
export function heroPierce(hero) {
    return axis(hero, EFFECT_TYPES.PIERCE);
}

/** Crit chance in percent: 5 plus whatever gear adds. */
export function heroCritChance(hero) {
    return BASE_CRIT_CHANCE + axis(hero, EFFECT_TYPES.CRIT_CHANCE);
}

/**
 * The most stacks of status `statusId` that can build up on this hero: the status's own cap moved
 * by what the hero carries for it (a Hide Vest: poison stacks at most 1 lower). Never below 0; at 0
 * the status cannot land.
 *
 * Every status engine that stacks asks this, so a gear ability means one thing whichever engine
 * runs the status.
 */
export function heroStatusStackCap(hero, statusId, baseMax) {
    const shift = hero?.aggregator?.query(EFFECT_TYPES.STATUS_MAX_STACKS, statusId) || 0;
    return Math.max(0, Math.floor((baseMax ?? 0) + shift));
}

// --- What an enemy carries: its profile (the level table and the author's numbers), plus what
// --- effects lend it through the fight's aggregator.

/**
 * The flat damage reduction an **enemy** carries.
 *
 * One function so armour means the same thing on both sides of a fight.
 * `enemyStatuses` is the old status engine's list, summed in as `heroFlatArmor`
 * sums the hero's.
 */
export function enemyFlatArmor(enemy, enemyStatuses = null) {
    return (enemy?.armor || 0)
        + axis(enemy, EFFECT_TYPES.ARMOR)
        + axis(enemy, EFFECT_TYPES.DEFENSE)
        + sumStatusEffect(enemyStatuses, 'flat_armor');
}

export function enemyDodge(enemy) {
    return (enemy?.dodge || 0) + axis(enemy, EFFECT_TYPES.DODGE);
}

export function enemyAccuracy(enemy) {
    return (enemy?.accuracy || 0) + axis(enemy, EFFECT_TYPES.ACCURACY);
}

export function enemyPierce(enemy) {
    return (enemy?.pierce || 0) + axis(enemy, EFFECT_TYPES.PIERCE);
}

export function enemyCritChance(enemy) {
    return (enemy?.critChance ?? BASE_CRIT_CHANCE) + axis(enemy, EFFECT_TYPES.CRIT_CHANCE);
}

/** How long an enemy's swing takes. */
export function enemyAttackSpeedMs(enemy) {
    return enemy?.attackSpeed || attackSpeedMs(enemy?.speed);
}

// --- The swing -------------------------------------------------------------------------------

/**
 * Roll one swing: miss, then (only on a hit) crit.
 *
 * ⚠️ The draw order is part of the game's work: one `Math.random()` for the miss and one more for
 * the crit on a hit, nothing else. Catch-up replays the same stream, so a draw added here or
 * skipped on one path shifts every outcome after it.
 *
 * @param {number} missPct
 * @param {number} critPct
 * @returns {{ hit: boolean, crit: boolean }}
 */
export function rollSwing(missPct, critPct) {
    if (Math.random() * 100 < missPct) return { hit: false, crit: false };
    return { hit: true, crit: Math.random() * 100 < critPct };
}

/** The hero's miss chance against this enemy. */
export function heroMissChance(hero, enemy) {
    return missChance(getHeroCombatLevel(hero), enemy?.level || 1, enemyDodge(enemy), heroAccuracy(hero));
}

/** The enemy's miss chance against this hero. */
export function enemyMissChance(enemy, hero) {
    return missChance(enemy?.level || 1, getHeroCombatLevel(hero), heroDodge(hero), enemyAccuracy(enemy));
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
 * What a hero's hit deals before the matchup, buffs, crit and armour: the weapon's damage (a fist
 * is 1) plus 1 per 20 combat levels plus flat Damage from gear.
 */
export function heroBaseDamage(hero) {
    const weapon = getHeroWeapon(hero);
    const weaponDamage = weapon && Number(weapon.damage) > 0 ? Number(weapon.damage) : UNARMED_DAMAGE;
    return weaponDamage + levelDamageBonus(getHeroCombatLevel(hero)) + axis(hero, EFFECT_TYPES.DAMAGE);
}

/**
 * One landed hit's damage, the order both sides use: multipliers (buffs, the matchup's ±25 %)
 * rounded halves up, then doubled on a crit, then armour (less pierce) taken off, then flat
 * resistance; never below 1.
 */
function landedDamage(base, multiplier, crit, armour, pierce, resist = 0) {
    const scaled = roundHalfUp(base * multiplier);
    const struck = crit ? scaled * CRIT_MULTIPLIER : scaled;
    return Math.max(1, struck - Math.max(0, armour - pierce) - resist);
}

/**
 * A hero's landed hit on an enemy.
 * @param {{ crit?: boolean, enemyStatuses?: Array }} [options]
 */
export function heroHitDamage(hero, enemy, { crit = false, enemyStatuses = null } = {}) {
    const multiplier = damageMultiplierOf(hero) * matchupMultiplier(getHeroCombatStyle(hero), enemy?.combatType);
    return landedDamage(heroBaseDamage(hero), multiplier, crit, enemyFlatArmor(enemy, enemyStatuses), heroPierce(hero));
}

/**
 * An enemy's landed hit on a hero: its hit, the matchup, crit, then the hero's armour (less the
 * enemy's pierce) and resistance.
 * @param {{ crit?: boolean }} [options]
 */
export function enemyHitDamage(enemy, hero, { crit = false } = {}) {
    const multiplier = matchupMultiplier(enemy?.combatType, getHeroCombatStyle(hero));
    return landedDamage(enemy?.hit ?? 1, multiplier, crit, heroFlatArmor(hero), enemyPierce(enemy), heroFlatResist(hero));
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
 * XP for defeating an enemy, carried on its profile from the level table.
 */
export function getCombatXpAward(enemy) {
    return enemy?.xpAwarded ?? 1;
}
