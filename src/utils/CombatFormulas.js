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
    rpsOutcome,
    SWING_TIME_FACTOR_RANGE,
} from '../config/FormulaRegistry.js';
import { COMBAT_SKILL_IDS, BAREHANDED_STYLE_ID } from '../config/registries/skillRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getEquippedEntries, isWeaponCategory } from '../config/registries/equipmentConstants.js';
import { isWeapon, weaponStyleOf, meetsGearRequirements } from '../config/registries/weaponStyles.js';
import {
    weaponDamageTypeOf, BAREHANDED_DAMAGE_TYPE, PLAIN_ENEMY_HIT_TYPE, resistanceFor
} from '../config/registries/damageTypes.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

export { rpsOutcome };

/** A hero's level in one skill, as saved; 0 when they hold none of it (a villager). */
function skillLevelOf(hero, skillId) {
    const s = hero?.skills?.[skillId];
    if (!s) return 0;
    return typeof s === 'number' ? s : (s.level || 0);
}

/**
 * The weapon a hero swings, or null: the first weapon in the hands, in grid order, whose level
 * requirement the hero meets (`weaponStyles.meetsGearRequirements`).
 * ⚠️ A weapon the hero does not meet (worn before its requirement was authored) stays in hand and
 * is not swung: the equip paths refuse it.
 */
export function getHeroWeapon(hero) {
    for (const { itemId, category } of getEquippedEntries(hero)) {
        if (!isWeaponCategory(category)) continue;
        const item = getItem(itemId);
        if (item && isWeapon(item) && meetsGearRequirements(item, hero)) return item;
    }
    return null;
}

/**
 * The style a hero fights in, the side of the matchup cycle they stand on and the skill their
 * kills train: **the weapon decides** ({@link getHeroWeapon}'s style), and barehanded is a punch
 * in {@link BAREHANDED_STYLE_ID} (Melee).
 * @returns {string} a combat skill id
 */
export function getHeroCombatStyle(hero) {
    const weapon = getHeroWeapon(hero);
    return weapon ? weaponStyleOf(weapon) : BAREHANDED_STYLE_ID;
}

/**
 * The style a hero fights in and their level in it, read live from what is in their hands: the
 * level every combat formula uses (the damage step and the miss gap, both ways). Nothing is
 * written to the hero.
 * @returns {{ id: string, level: number }}
 */
export function getHeroCombatSkillEntry(hero) {
    const id = getHeroCombatStyle(hero);
    return { id, level: skillLevelOf(hero, id) };
}

/** The level of the style the hero fights in now (see {@link getHeroCombatSkillEntry}). */
export function getHeroCombatLevel(hero) {
    return getHeroCombatSkillEntry(hero).level;
}

/** Whether this hero can fight at all. Everyone fights; barehanded is a punch. */
export function canHeroFight(hero) {
    return !!hero;
}

/**
 * The hero's best combat skill's level: what max HP grows with, so a hero who swaps sword for bow
 * keeps their health.
 * @param {Object} skills - hero.skills map
 */
export function highestCombatLevel(skills) {
    let best = 0;
    for (const id of COMBAT_SKILL_IDS) best = Math.max(best, skillLevelOf({ skills }, id));
    return best;
}

/**
 * Max HP from skills: 10 + the highest of the four combat skills.
 * @param {Object} skills - hero.skills map
 */
export function heroMaxHpFromSkills(skills) {
    return heroMaxHp(highestCombatLevel(skills));
}

/**
 * How much longer or shorter a swing is for whoever carries Swing Time (an elixir, an enraged
 * enemy): a factor on the swing's time, kept within `SWING_TIME_FACTOR_RANGE`. 1 when nothing
 * provides it.
 */
export function swingTimeFactor(entity) {
    const aggregator = entity?.aggregator;
    if (!aggregator?.getPercentageBucket) return 1;
    const factor = aggregator.getPercentageBucket(EFFECT_TYPES.SWING_TIME);
    return Math.min(SWING_TIME_FACTOR_RANGE.max, Math.max(SWING_TIME_FACTOR_RANGE.min, factor));
}

/** How long a hero's swing takes: the weapon's speed, normal (3 s) barehanded. */
export function heroAttackSpeedMs(hero) {
    return Math.round(attackSpeedMs(getHeroWeapon(hero)?.speed) * swingTimeFactor(hero));
}

// --- What a hero carries (all default to 0 when nothing provides them) ------------------------

const axis = (entity, type, category) => entity?.aggregator?.query(type, category) || 0;

/** Percentage points taken off the hero's miss chance. */
export function heroAccuracy(hero) {
    return axis(hero, EFFECT_TYPES.ACCURACY);
}

/** Percentage points added to the miss chance of whoever attacks the hero. */
export function heroDodge(hero) {
    return axis(hero, EFFECT_TYPES.DODGE);
}

/** Crit chance in percent: 5 plus whatever gear adds. */
export function heroCritChance(hero) {
    return BASE_CRIT_CHANCE + axis(hero, EFFECT_TYPES.CRIT_CHANCE);
}

/**
 * The most stacks of status `statusId` (a status effect's id) that can build up on this fighter:
 * the status's own cap moved by what they carry for it (a Hide Vest: poison stacks at most 1
 * lower). Never below 0; at 0 the status cannot land.
 */
export function heroStatusStackCap(hero, statusId, baseMax) {
    const shift = hero?.aggregator?.query(EFFECT_TYPES.STATUS_MAX_STACKS, statusId) || 0;
    return Math.max(0, Math.floor((baseMax ?? 0) + shift));
}

// --- What an enemy carries: its profile (the level table and the author's numbers), plus what
// --- effects lend it through the fight's aggregator.

export function enemyDodge(enemy) {
    return (enemy?.dodge || 0) + axis(enemy, EFFECT_TYPES.DODGE);
}

export function enemyAccuracy(enemy) {
    return (enemy?.accuracy || 0) + axis(enemy, EFFECT_TYPES.ACCURACY);
}

export function enemyCritChance(enemy) {
    return (enemy?.critChance ?? BASE_CRIT_CHANCE) + axis(enemy, EFFECT_TYPES.CRIT_CHANCE);
}

/** How long an enemy's swing takes: its speed, moved by any Swing Time on it (an enrage). */
export function enemyAttackSpeedMs(enemy) {
    return Math.round((enemy?.attackSpeed || attackSpeedMs(enemy?.speed)) * swingTimeFactor(enemy));
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
 * The outgoing-damage multiplier a fighter carries: the `DAMAGE` percentage bucket that a lingering
 * library effect registers (Well Fed on a hero, a boss's heavy strike). Either side.
 */
export function damageMultiplierOf(entity) {
    const fromEffects = entity?.aggregator?.getPercentageBucket
        ? entity.aggregator.getPercentageBucket(EFFECT_TYPES.DAMAGE) - 1
        : 0;
    return 1 + fromEffects;
}

// --- Damage types ------------------------------------------------------------------------------

/** The type a hero's own blow hits with: their weapon's (`damageTypes.weaponDamageTypeOf`), Crush barehanded. */
export function heroDamageType(hero) {
    const weapon = getHeroWeapon(hero);
    return weapon ? weaponDamageTypeOf(weapon, weaponStyleOf(weapon)) : BAREHANDED_DAMAGE_TYPE;
}

/**
 * What a fighter's hits of type `type` gain, in percent: their Type Damage rows on the type and on
 * its group (the aggregator counts a group's row on each of its types).
 */
export function typeDamageBoost(entity, type) {
    return axis(entity, EFFECT_TYPES.TYPE_DAMAGE, type);
}

/** How much a hero resists hits of `type` (a type, or a group for a hit typed only by its group), in percent. */
export function heroTypeResistance(hero, type) {
    return axis(hero, EFFECT_TYPES.TYPE_RESIST, type);
}

/**
 * How much an enemy resists hits of `type`, in signed percent (a weakness negative): its own
 * resistances, where a line on the type replaces its group's, plus what effects on it lend.
 */
export function enemyTypeResistance(enemy, type) {
    return resistanceFor(enemy?.resistances, type) + axis(enemy, EFFECT_TYPES.TYPE_RESIST, type);
}

/** 1 + the attacker's boost − the target's resistance, never below 0. Both in percent. */
export function typeFactor(boostPct, resistPct) {
    return Math.max(0, 1 + ((boostPct || 0) - (resistPct || 0)) / 100);
}

// --- The blow ---------------------------------------------------------------------------------

/**
 * What a hero's hit deals before the matchup, buffs, crit and the type factor: the weapon's damage
 * (a fist is 1) plus 1 per 20 combat levels plus flat Damage from gear.
 */
export function heroBaseDamage(hero) {
    const weapon = getHeroWeapon(hero);
    const weaponDamage = weapon && Number(weapon.damage) > 0 ? Number(weapon.damage) : UNARMED_DAMAGE;
    return weaponDamage + levelDamageBonus(getHeroCombatLevel(hero)) + axis(hero, EFFECT_TYPES.DAMAGE);
}

/**
 * The parts of a hero's blow, each in its own type: the weapon (or fist) with the level step and
 * gear's flat Damage, and for a shot the arrow's own damage (`arrow`, `damageTypes.arrowOf`).
 * @param {{damage: number, damageType: string}|null} [arrow]
 * @returns {Array<{type: string, base: number, arrow?: boolean}>}
 */
export function heroHitParts(hero, arrow = null) {
    const parts = [{ type: heroDamageType(hero), base: heroBaseDamage(hero) }];
    if (arrow) parts.push({ type: arrow.damageType, base: arrow.damage, arrow: true });
    return parts;
}

/**
 * One landed blow, the order both sides use: each part × the multiplier (buffs and the matchup's
 * ±25 %), doubled on a crit, × its type factor (never below 0). No rounding and no floor: the
 * whole number comes from {@link rollFraction}, so a resisted hit can do 0 and immunity means 0.
 *
 * `resist` is the target's signed resistance to the part's type, so the screen can say "Weak!" or
 * "Resisted"; `pre` is the part before the type factor.
 * @returns {{ exact: number, parts: Array<{type: string, pre: number, amount: number, resist: number, arrow?: boolean}> }}
 */
function landedBlow(parts, multiplier, crit, boostOf, resistOf) {
    let exact = 0;
    const out = parts.map(part => {
        const pre = Math.max(0, part.base * multiplier * (crit ? CRIT_MULTIPLIER : 1));
        const resist = resistOf(part.type);
        const amount = pre * typeFactor(boostOf(part.type), resist);
        exact += amount;
        return { type: part.type, pre, amount, resist, ...(part.arrow ? { arrow: true } : {}) };
    });
    return { exact, parts: out };
}

/**
 * A hero's landed blow on an enemy, before the fraction sub-roll.
 * @param {{ crit?: boolean, arrow?: {damage: number, damageType: string}|null }} [options]
 */
export function heroBlow(hero, enemy, { crit = false, arrow = null } = {}) {
    const multiplier = damageMultiplierOf(hero) * matchupMultiplier(getHeroCombatStyle(hero), enemy?.combatType);
    return landedBlow(heroHitParts(hero, arrow), multiplier, crit,
        (type) => typeDamageBoost(hero, type),
        (type) => enemyTypeResistance(enemy, type));
}

/**
 * An enemy's landed blow on a hero, before the fraction sub-roll: its hit plus any flat Damage lent
 * to it, as one Physical hit (an enemy has no moves yet), × the matchup and any Damage percentage
 * (a heavy strike, an enrage), crit, then the hero's resistance to Physical.
 * @param {{ crit?: boolean }} [options]
 */
export function enemyBlow(enemy, hero, { crit = false } = {}) {
    const multiplier = damageMultiplierOf(enemy) * matchupMultiplier(enemy?.combatType, getHeroCombatStyle(hero));
    const base = (enemy?.hit ?? 1) + axis(enemy, EFFECT_TYPES.DAMAGE);
    return landedBlow([{ type: PLAIN_ENEMY_HIT_TYPE, base }], multiplier, crit,
        (type) => typeDamageBoost(enemy, type),
        (type) => heroTypeResistance(hero, type));
}

/** How close to a whole number a blow must be to count as whole (float error, not a fraction). */
const WHOLE_EPSILON = 1e-9;

/**
 * The fraction sub-roll: a blow of 1.1 does 1 nine times in ten and 2 one time in ten.
 *
 * ⚠️ Draws one `Math.random()` only when the blow has a fraction, right after the swing's miss
 * and crit draws; a whole blow draws nothing. Catch-up replays the same stream, so this must stay
 * the only draw here and stay in this place.
 */
export function rollFraction(exact) {
    if (!(exact > 0)) return 0;
    const whole = Math.floor(exact + WHOLE_EPSILON);
    const fraction = exact - whole;
    if (fraction < WHOLE_EPSILON) return whole;
    return whole + (Math.random() < fraction ? 1 : 0);
}

/**
 * A hero's landed hit on an enemy, as a whole number. ⚠️ Draws for a fraction ({@link rollFraction}).
 * @param {{ crit?: boolean, arrow?: {damage: number, damageType: string}|null }} [options]
 */
export function heroHitDamage(hero, enemy, options = {}) {
    return rollFraction(heroBlow(hero, enemy, options).exact);
}

/**
 * An enemy's landed hit on a hero, as a whole number. ⚠️ Draws for a fraction ({@link rollFraction}).
 * @param {{ crit?: boolean }} [options]
 */
export function enemyHitDamage(enemy, hero, options = {}) {
    return rollFraction(enemyBlow(enemy, hero, options).exact);
}

/**
 * Whether a blow's types helped or hurt it: `weak` when the target's weaknesses outweigh its
 * resistances across the parts, `resisted` the other way, null when neither moved it. The
 * attacker's own Type Damage boosts do not count: the words are about the target.
 * @returns {'weak'|'resisted'|null}
 */
export function blowVerdict(parts) {
    let shift = 0;
    for (const p of parts || []) shift -= (p.pre || 0) * (p.resist || 0);
    if (shift > WHOLE_EPSILON) return 'weak';
    if (shift < -WHOLE_EPSILON) return 'resisted';
    return null;
}

/**
 * XP for defeating an enemy, carried on its profile from the level table.
 */
export function getCombatXpAward(enemy) {
    return enemy?.xpAwarded ?? 1;
}
