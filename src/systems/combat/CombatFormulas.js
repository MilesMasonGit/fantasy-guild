// Combat Formulas
// The numbers live in FormulaRegistry.js; this file reads them off heroes, their gear and enemies.

import {
    heroMaxHp,
    levelDamageBonus,
    UNARMED_DAMAGE,
    attackSpeedMs,
    missChance,
    BASE_CRIT_CHANCE,
    CRIT_MULTIPLIER,
    cappedCritChance,
    NO_AMMO_DAMAGE_FACTOR,
    matchupMultiplier,
    SWING_TIME_FACTOR_RANGE,
} from '../../config/FormulaRegistry.js';
import { COMBAT_SKILL_IDS, BAREHANDED_STYLE_ID } from '../../config/registries/skillRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEquippedEntries, getGrid, isWeaponCategory } from '../../config/registries/equipmentConstants.js';
import { isWeapon, weaponStyleOf, meetsGearRequirements } from '../../config/registries/weaponStyles.js';
import {
    weaponDamageTypeOf, BAREHANDED_DAMAGE_TYPE, PLAIN_ENEMY_HIT_TYPE, resistanceFor, DAMAGE_TYPES
} from '../../config/registries/damageTypes.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { combinePercentages } from '../effects/ModifierAggregator.js';
import { roundByChance, WHOLE_EPSILON } from '../../utils/RNG.js';
import { MAX_TICK_DELTA_MS } from '../../config/loopConstants.js';

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
    const slot = getHeroWeaponSlot(hero);
    return slot === null ? null : getItem(getGrid(hero)[slot]);
}

/**
 * The grid slot of the weapon a hero swings ({@link getHeroWeapon}), or null barehanded. The only
 * weapon in the hands that lends anything: another one there lends nothing (`HeroEffects`).
 */
export function getHeroWeaponSlot(hero) {
    for (const { index, itemId, category } of getEquippedEntries(hero)) {
        if (!isWeaponCategory(category)) continue;
        const item = getItem(itemId);
        if (item && isWeapon(item) && meetsGearRequirements(item, hero)) return index;
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
    return keptSwingFactor(aggregator.getPercentageBucket(EFFECT_TYPES.SWING_TIME));
}

/** A Swing Time bucket as the factor a swing's time is multiplied by, kept within `SWING_TIME_FACTOR_RANGE`. */
export function keptSwingFactor(factor) {
    return Math.min(SWING_TIME_FACTOR_RANGE.max, Math.max(SWING_TIME_FACTOR_RANGE.min, factor));
}

/** {@link swingTimeFactor} for a hero: what they carry (gear, perks, lingering effects) and the guild's stars for their style. */
function heroSwingTimeFactor(hero) {
    return keptSwingFactor(heroPercentBucket(hero, EFFECT_TYPES.SWING_TIME));
}

/** How long a hero's swing takes: the weapon's speed, normal (3 s) barehanded. */
export function heroAttackSpeedMs(hero) {
    return Math.round(attackSpeedMs(getHeroWeapon(hero)?.speed) * heroSwingTimeFactor(hero));
}

// --- What a hero carries (all default to 0 when nothing provides them) ------------------------

const axis = (entity, type, category) => entity?.aggregator?.query(type, category) || 0;

/**
 * A hero's flat total on an axis they also read from the guild (`fromGuild` in the palette): what
 * they carry plus what the guild gives (Hall stars), summed in one bucket and read
 * for the same category. Enemies never read the guild's.
 */
function heroGuildAxis(hero, type, category) {
    if (!hero) return 0;
    return axis(hero, type, category) + getGlobalAggregator().query(type, category);
}

/**
 * {@link heroGuildAxis} on a style axis (Damage, Accuracy: `categories: 'combatStyle'`), read for the
 * style the hero fights in, so a rule narrowed to Melee helps only a Melee fighter.
 */
function heroStyleAxis(hero, type, style = getHeroCombatStyle(hero)) {
    return heroGuildAxis(hero, type, style);
}

/**
 * A hero's percentage bucket on a style axis, theirs and the guild's for their style summed into one
 * bucket before it applies (resolving each apart and multiplying would compound them).
 */
function heroPercentBucket(hero, type, style = getHeroCombatStyle(hero)) {
    if (!hero) return 1;
    return combinePercentages([
        ...(hero.aggregator?.collectPercentages ? hero.aggregator.collectPercentages(type, style) : []),
        ...getGlobalAggregator().collectPercentages(type, style)
    ]);
}

/** Percentage points taken off the hero's miss chance. */
export function heroAccuracy(hero) {
    return heroStyleAxis(hero, EFFECT_TYPES.ACCURACY);
}

/** Percentage points added to the miss chance of whoever attacks the hero: theirs and the guild's. */
export function heroDodge(hero) {
    return heroGuildAxis(hero, EFFECT_TYPES.DODGE);
}

/** Crit chance in percent: 5 plus what the hero carries and the guild gives, at most the cap (`CRIT_CHANCE_CAP`). */
export function heroCritChance(hero) {
    return cappedCritChance(BASE_CRIT_CHANCE + heroGuildAxis(hero, EFFECT_TYPES.CRIT_CHANCE));
}

// --- The combat tricks: each read for the style the hero fights in, theirs and the guild's added --

/** Whole health the hero heals on each kill (Heal on Kill): every source added, a fraction dropped, never below 0. */
export function heroKillHeal(hero) {
    return Math.max(0, Math.floor(heroStyleAxis(hero, EFFECT_TYPES.KILL_HEAL)));
}

/** The percent chance, once a fight, that a defeating blow leaves the hero at 1 health (Last Stand). */
export function heroLastStandChance(hero) {
    return heroStyleAxis(hero, EFFECT_TYPES.LAST_STAND);
}

/** The percent chance a hero's attack strikes again at once (Twin Strike). */
export function heroTwinStrikeChance(hero) {
    return heroStyleAxis(hero, EFFECT_TYPES.TWIN_STRIKE);
}

/** The percent chance a dodge makes the hero's next landed hit a sure crit (Crit After Dodge). */
export function heroDodgeCritChance(hero) {
    return heroStyleAxis(hero, EFFECT_TYPES.DODGE_CRIT);
}

/** A sure crit's chance in percent: above the cap, so the roll always crits. */
export const SURE_CRIT_CHANCE = 100;

/**
 * The most stacks of status `statusId` (a status effect's id) that can build up on this fighter:
 * the status's own cap moved by what they carry for it (a Status Stack Limit of −1 on Venom: one
 * stack fewer). Never below 0; at 0 the status cannot land.
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

/** An enemy's crit chance in percent: its own (5 unless authored) plus what effects lend it, at most the cap. */
export function enemyCritChance(enemy) {
    return cappedCritChance((enemy?.critChance ?? BASE_CRIT_CHANCE) + axis(enemy, EFFECT_TYPES.CRIT_CHANCE));
}

/** How long an enemy's swing takes: its speed, moved by any Swing Time on it (an enrage). */
export function enemyAttackSpeedMs(enemy) {
    return Math.round((enemy?.attackSpeed || attackSpeedMs(enemy?.speed)) * swingTimeFactor(enemy));
}

/**
 * Whether a swing of `speedMs` may land more than once in one engine step: only one faster than the
 * largest step (a catch-up's), so it swings as often while the player is away as it does live. One
 * of a second or more lands at most once a step, as it always has.
 */
export function swingRepeatsInStep(speedMs) {
    return speedMs > 0 && speedMs < MAX_TICK_DELTA_MS;
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

/** Whether an attack that deals no damage lands, by the same miss chance as a swing: one draw, no crit. */
export function rollLands(missPct) {
    return !(Math.random() * 100 < missPct);
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
 * library effect registers (a boss's heavy strike). A hero's is {@link heroDamageMultiplier}.
 */
export function damageMultiplierOf(entity) {
    const fromEffects = entity?.aggregator?.getPercentageBucket
        ? entity.aggregator.getPercentageBucket(EFFECT_TYPES.DAMAGE) - 1
        : 0;
    return 1 + fromEffects;
}

/**
 * A hero's outgoing-damage multiplier: the `DAMAGE` percentage bucket of what they carry (Well Fed)
 * and the guild's stars, for the style they fight in.
 */
export function heroDamageMultiplier(hero, style = getHeroCombatStyle(hero)) {
    return heroPercentBucket(hero, EFFECT_TYPES.DAMAGE, style);
}

// --- Damage types ------------------------------------------------------------------------------

/** The type a hero's own blow hits with: their weapon's (`damageTypes.weaponDamageTypeOf`), Crush barehanded. */
export function heroDamageType(hero) {
    const weapon = getHeroWeapon(hero);
    return weapon ? weaponDamageTypeOf(weapon, weaponStyleOf(weapon)) : BAREHANDED_DAMAGE_TYPE;
}

/** What a fighter's hits of type `type` gain, in percent: all their Type Damage rows on that type, added. */
export function typeDamageBoost(entity, type) {
    return axis(entity, EFFECT_TYPES.TYPE_DAMAGE, type);
}

/** {@link typeDamageBoost} for a hero: their rows on the type and the guild's, added. */
export function heroTypeDamageBoost(hero, type) {
    return heroGuildAxis(hero, EFFECT_TYPES.TYPE_DAMAGE, type);
}

/** The points of Sunder a fighter carries (the Sunder status, once per stack): off every resistance they have. */
export function sunderOf(entity) {
    return Math.max(0, axis(entity, EFFECT_TYPES.SUNDER));
}

/**
 * A resistance after Sunder: lowered by `sunderPct`, never below 0. A weakness (or no resistance)
 * is untouched: Sunder strips what protects a fighter, it does not make them weak.
 */
export function afterSunder(resistPct, sunderPct) {
    if (!(resistPct > 0) || !(sunderPct > 0)) return resistPct;
    return Math.max(0, resistPct - sunderPct);
}

/**
 * How much a hero resists hits of `type`, in percent: every line they have for that type added (worn
 * gear's resistances, Type Resistance rows, what the guild gives), after any Sunder on them.
 */
export function heroTypeResistance(hero, type) {
    return afterSunder(heroGuildAxis(hero, EFFECT_TYPES.TYPE_RESIST, type), sunderOf(hero));
}

/**
 * How much an enemy resists hits of `type`, in signed percent (a weakness negative): its own line
 * for the type (an authored line replaces its kind's, `enemyProfile.js`) plus what effects on it
 * lend for the type, after any Sunder on it.
 */
export function enemyTypeResistance(enemy, type) {
    return afterSunder(resistanceFor(enemy?.resistances, type) + axis(enemy, EFFECT_TYPES.TYPE_RESIST, type), sunderOf(enemy));
}

/**
 * The percent a hero's worn gear cuts from their hits in `style` (the style they fight in when not
 * given): every piece's `damageCut` on it, added (`gearDefence.js`), at most 100.
 */
export function styleDamageCut(hero, style = getHeroCombatStyle(hero)) {
    return Math.min(100, Math.max(0, axis(hero, EFFECT_TYPES.STYLE_DAMAGE_CUT, style)));
}

/** What is left of a hero's hits in `style` after their gear's cut: 1 with none, 0 at a cut of 100. */
export function styleCutFactor(hero, style = getHeroCombatStyle(hero)) {
    const cut = styleDamageCut(hero, style);
    return cut > 0 ? 1 - cut / 100 : 1;
}

/**
 * The attacker's boost first, then the target's resistance cuts what is left: (1 + boost) ×
 * (1 − resistance), each half never below 0. Both in percent. So 100 % resistance is always 0, and
 * a weakness (negative) multiplies the boosted hit.
 */
export function typeFactor(boostPct, resistPct) {
    return boostFactor(boostPct) * Math.max(0, 1 - (resistPct || 0) / 100);
}

/** The attacker's half of {@link typeFactor}: 1 + boost, never below 0. */
function boostFactor(boostPct) {
    return Math.max(0, 1 + (boostPct || 0) / 100);
}

// --- The blow ---------------------------------------------------------------------------------

/**
 * What a hero's hit deals before the matchup, buffs, crit and the type factor: the weapon's damage
 * (a fist is 1) plus 1 per 20 combat levels plus flat Damage from gear.
 */
export function heroBaseDamage(hero) {
    const weapon = getHeroWeapon(hero);
    const weaponDamage = weapon && Number(weapon.damage) > 0 ? Number(weapon.damage) : UNARMED_DAMAGE;
    return weaponDamage + levelDamageBonus(getHeroCombatLevel(hero)) + heroStyleAxis(hero, EFFECT_TYPES.DAMAGE);
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
 * "Resisted"; `pre` is the part before the type factor; `boost` the attacker's Type Damage % on it, when any.
 * @returns {{ exact: number, parts: Array<{type: string, pre: number, amount: number, resist: number, boost?: number, arrow?: boolean}> }}
 */
function landedBlow(parts, multiplier, crit, boostOf, resistOf) {
    let exact = 0;
    const out = parts.map(part => {
        const pre = Math.max(0, part.base * multiplier * (crit ? CRIT_MULTIPLIER : 1));
        const resist = resistOf(part.type);
        const boost = boostOf(part.type) || 0;
        const amount = pre * typeFactor(boost, resist);
        exact += amount;
        return { type: part.type, pre, amount, resist, ...(boost ? { boost } : {}), ...(part.arrow ? { arrow: true } : {}) };
    });
    return { exact, parts: out };
}

/**
 * A hero's landed blow on an enemy, before the fraction sub-roll. The multiplier holds the buffs, the
 * matchup and the cut their worn gear makes to the style they fight in ({@link styleCutFactor}), and
 * halves the blow when the weapon's ammo is out and the hero fights on (`short`: no Mote, the last
 * Kunai; `NO_AMMO_DAMAGE_FACTOR`, `Ammo.js`).
 * @param {{ crit?: boolean, arrow?: {damage: number, damageType: string}|null, short?: boolean }} [options]
 */
export function heroBlow(hero, enemy, { crit = false, arrow = null, short = false } = {}) {
    const style = getHeroCombatStyle(hero);
    const multiplier = heroDamageMultiplier(hero, style) * matchupMultiplier(style, enemy?.combatType) * styleCutFactor(hero, style)
        * (short ? NO_AMMO_DAMAGE_FACTOR : 1);
    return landedBlow(heroHitParts(hero, arrow), multiplier, crit,
        (type) => heroTypeDamageBoost(hero, type),
        (type) => enemyTypeResistance(enemy, type));
}

/** An enemy's hit before any multiplier: its own, plus the flat Damage a rule has lent it. */
export function enemyBaseHit(enemy) {
    return (enemy?.hit ?? 1) + axis(enemy, EFFECT_TYPES.DAMAGE);
}

/**
 * An enemy's landed blow on a hero, before the fraction sub-roll: its hit plus any flat Damage lent
 * to it, in one type (its move's, `type`; a plain swing is Crush), × the matchup and any Damage
 * percentage (a heavy strike, an enrage), crit, then the hero's resistance to that type.
 * @param {{ crit?: boolean, type?: string|null }} [options]
 */
export function enemyBlow(enemy, hero, { crit = false, type = null } = {}) {
    const multiplier = damageMultiplierOf(enemy) * matchupMultiplier(enemy?.combatType, getHeroCombatStyle(hero));
    const base = enemyBaseHit(enemy);
    return landedBlow([{ type: type || PLAIN_ENEMY_HIT_TYPE, base }], multiplier, crit,
        (type) => typeDamageBoost(enemy, type),
        (type) => heroTypeResistance(hero, type));
}

/**
 * An enemy's numbers as a fight reads them off whatever aggregator it carries (a fight's, or its kinds
 * alone out of a fight, `enemyKindEffects.enemyAtRest`): its hit before the matchup, the crit and the
 * hero's resistances, how often it attacks, its Dodge, Accuracy and Crit, and each type it resists
 * or is weak to. The CMS shows these as "what the fight uses".
 * @returns {{hit: number, attackSpeedMs: number, dodge: number, accuracy: number, critChance: number, resistances: Object<string, number>}}
 */
export function enemyNumbers(enemy) {
    const resistances = {};
    for (const { id } of DAMAGE_TYPES) {
        const value = enemyTypeResistance(enemy, id);
        if (value) resistances[id] = value;
    }
    return {
        hit: Math.max(0, enemyBaseHit(enemy) * damageMultiplierOf(enemy)),
        attackSpeedMs: enemyAttackSpeedMs(enemy),
        dodge: enemyDodge(enemy),
        accuracy: enemyAccuracy(enemy),
        critChance: enemyCritChance(enemy),
        resistances
    };
}

/**
 * The fraction sub-roll: a blow of 1.1 does 1 nine times in ten and 2 one time in ten
 * (`RNG.roundByChance`).
 *
 * ⚠️ Draws one `Math.random()` only when the blow has a fraction, right after the swing's miss
 * and crit draws; a whole blow draws nothing. Catch-up replays the same stream, so this must stay
 * the only draw here and stay in this place.
 */
export function rollFraction(exact) {
    return roundByChance(exact);
}

/**
 * A hero's landed hit on an enemy, as a whole number. ⚠️ Draws for a fraction ({@link rollFraction}).
 * @param {{ crit?: boolean, arrow?: {damage: number, damageType: string}|null, short?: boolean }} [options]
 */
export function heroHitDamage(hero, enemy, options = {}) {
    return rollFraction(heroBlow(hero, enemy, options).exact);
}

/**
 * Whether a blow's types helped or hurt it: `weak` when the target's weaknesses outweigh its
 * resistances across the parts, `resisted` the other way, null when neither moved it. The words
 * are about the target, so the attacker's boost alone never moves them; but the resistance cuts
 * the boosted part, so each part counts what the target took off (or gave) after the boost.
 * @returns {'weak'|'resisted'|null}
 */
export function blowVerdict(parts) {
    let shift = 0;
    for (const p of parts || []) shift += (p.amount || 0) - (p.pre || 0) * boostFactor(p.boost);
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
