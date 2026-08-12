// Fantasy Guild - Combat Formulas
// 7-Stat Engine pass (combat_formula_spec.md §7 pipeline).
// NOTE: Tunable constants live in FormulaRegistry.js. This file provides
// hero/enemy-aware wrappers. Crit, Armor, and weapon-speed archetypes are
// hooks only (they resolve to 0/neutral until their implementation pass).

import {
    growth,
    heroMaxHp as _heroMaxHp,
    heroBaseDamage,
    blockChance,
    hitChance as _hitChance,
    rollDamageSpread,
    rpsOutcome,
    rpsMultiplier as _rpsMultiplier,
    RPS_HIT_SHIFT,
    RPS_DAMAGE_SHIFT,
    HERO_ATTACK_INTERVAL_MS,
    ENEMY_ATTACK_INTERVAL_MS,
    BASE_ATTACK_SPEED_MS,
    MIN_ATTACK_SPEED_MS,
    DAMAGE_SPREAD_MIN,
    DAMAGE_SPREAD_MAX,
} from '../config/FormulaRegistry.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { getPrimaryWeapon } from '../config/registries/equipmentConstants.js';
import { sumStatusEffect } from '../config/registries/statusRegistry.js';

export { BASE_ATTACK_SPEED_MS, MIN_ATTACK_SPEED_MS, HERO_ATTACK_INTERVAL_MS, ENEMY_ATTACK_INTERVAL_MS };

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * The combat style a hero uses is determined entirely by the equipped
 * weapon's type (locked decision). Unarmed counts as Melee.
 *
 * With two hands the PRIMARY weapon decides — the first occupied hand — so a
 * sword in hand1 and a bow in hand2 fights melee. Single-weapon heroes behave
 * exactly as they did under the old one-slot model.
 * @param {Object} hero
 * @returns {'melee'|'ranged'|'magic'}
 */
export function getHeroCombatStyle(hero) {
    const weaponId = getPrimaryWeapon(hero);
    if (weaponId) {
        const weapon = getItem(weaponId);
        const style = weapon?.skillRequired;
        if (style === 'melee' || style === 'ranged' || style === 'magic') return style;
    }
    // Unarmed: fall back to the hero's own combat skill rather than assuming
    // melee. The two can no longer disagree anyway — a weapon requires its
    // style to equip, so a Ranged hero cannot be holding a sword — but an
    // unarmed Ranger should still fight ranged.
    return getHeroCombatSkillEntry(hero).id || 'melee';
}

/**
 * The ONE combat skill a hero holds, and its level.
 *
 * **A hero holds exactly one of Melee, Ranged or Magic, or none at all.** This
 * is the single number the whole combat engine runs on: it supplies attack
 * *and* defence, max HP and block. A Melee 30 hero attacks at 30 and defends
 * at 30.
 *
 * ⚠️ **A hero with no combat skill scores 0, not 1.** That is a Recruit, and a
 * Recruit cannot fight — see `canHeroFight`. Returning a floor of 1 here would
 * have quietly made them a weak fighter instead of a non-combatant, which is
 * the opposite of what the design asks for.
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

/**
 * Whether this hero can fight at all.
 *
 * Possession, never level: holding a combat skill decides *if*; how high it is
 * never decides *whether*. An unpromoted Recruit holds none and is refused.
 */
export function canHeroFight(hero) {
    return getHeroCombatSkillEntry(hero).id !== null;
}

/**
 * Get the hero's combat skill level.
 *
 * ⚠️ The `selectedStyle` argument is **ignored** and kept only so the many
 * existing call sites keep compiling. A hero has one style; the equipped
 * weapon no longer selects between four skill bars, it only decides which
 * side of the rock-paper-scissors triangle they fight on.
 */
export function getHeroCombatSkill(hero, _selectedStyle = 'melee') {
    return getHeroCombatSkillEntry(hero).level;
}

/**
 * A hero's defensive number.
 *
 * *Was* the separate `defense` skill. That skill is deleted — the single
 * combat skill supplies both halves, so there is no way to build a tanky hero
 * distinct from a damaging one through skills. Defensive building moves
 * entirely to equipment, which is what gives the nine gear slots a job.
 */
export function getHeroDefenseSkill(hero) {
    return getHeroCombatSkillEntry(hero).level;
}

/**
 * Hero max HP from skills: 30·G(Combat Level) + 20·G(Defence) (spec §3), where
 * both terms are now the same single combat skill.
 *
 * ⚠️ **A Recruit floors at level 1 for HP only.** They cannot fight, but they
 * stand on the board, take environmental damage and can be healed, so a max HP
 * of zero would make them unrepresentable. Everything that decides *combat*
 * reads the real 0 via `getHeroCombatSkillEntry`.
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
 * the innate block that skill grants (owner deviation 2026-07-12).
 */
export function getHeroBlockChance(hero) {
    const gearBlock = hero?.aggregator?.query('BLOCK') || 0;
    return blockChance(getHeroDefenseSkill(hero), gearBlock);
}

/**
 * Calculate hit chance per the spec pipeline (§7 step 2):
 * 75 + 0.25·(attacker style skill − defender Defense) + Accuracy − Block ± RPS 7, clamped 5–95.
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
 * Compute damage dealt from hero to enemy (spec §7 steps 3-5).
 * Base = 4·G(style skill) + weapon damage (flat placeholder until the gear
 * pass prices weapons properly) + flat modifiers; ×0.85-1.15 spread; RPS ±10%;
 * crit hook (0 for now); minus enemy flat Armor (0 by default); min 1.
 */
export function computeHeroDamage(hero, enemy, weapon, damageBonus = 0, selectedStyle = 'melee', enemyStatuses = null) {
    const skill = getHeroCombatSkill(hero, selectedStyle);
    const base = heroBaseDamage(skill) + (weapon?.damage || 0) + damageBonus;

    let damage = rollDamageSpread(base);

    // Damage buffs (Well Fed) sum additively per layer
    damage *= 1 + sumStatusEffect(hero?.statuses, 'damage_pct');

    const enemyStyle = enemy?.combatType || 'melee';
    damage *= 1 + rpsOutcome(selectedStyle, enemyStyle) * RPS_DAMAGE_SHIFT;

    // Crit hook (spec §7 step 4): innate 5%/2× lands with the crit pass.

    // Armor (spec §7 step 5): flat subtraction after crit — enemy budget
    // deviations (later) plus any Armor Shield status on the enemy.
    const armor = (enemy?.armor || 0) + sumStatusEffect(enemyStatuses, 'flat_armor');

    return Math.max(1, Math.round(damage - armor));
}

/**
 * Compute damage dealt from enemy to hero (spec §7 steps 3-5).
 * Enemy min/max damage already carry the 0.85-1.15 spread (derived in the
 * enemy registry from the band budget); RPS ±10%; minus hero flat Armor
 * (gear pass later); min 1.
 */
export function computeEnemyDamage(enemy, hero = null, heroStyle = 'melee') {
    const base = rollDamage(enemy.minDamage ?? 1, enemy.maxDamage ?? 1);

    const enemyStyle = enemy.combatType || 'melee';
    let damage = base * (1 + rpsOutcome(enemyStyle, heroStyle) * RPS_DAMAGE_SHIFT);

    // Hero flat Armor (spec §7 step 5). Existing armor items register their
    // `defense` stat as DEFENSE modifiers — treated as flat Armor until the
    // gear pass introduces properly budgeted ARMOR values. Armor Shield
    // status stacks add on top (they decay via notifyHitTaken after impact).
    const armor = (hero?.aggregator?.query('ARMOR') || 0)
        + (hero?.aggregator?.query('DEFENSE') || 0)
        + sumStatusEffect(hero?.statuses, 'flat_armor');
    const flatResist = hero?.aggregator?.query('RESIST_FLAT') || 0;

    return Math.max(1, Math.round(damage - armor - flatResist));
}

/**
 * Deterministic hero damage range for UI display — mirrors computeHeroDamage
 * exactly, with the spread bounds substituted for the random roll.
 */
export function getHeroDamageRange(hero, enemy, weapon, damageBonus = 0, selectedStyle = 'melee', enemyStatuses = null) {
    const skill = getHeroCombatSkill(hero, selectedStyle);
    const base = heroBaseDamage(skill) + (weapon?.damage || 0) + damageBonus;
    const buffMult = 1 + sumStatusEffect(hero?.statuses, 'damage_pct');
    const enemyStyle = enemy?.combatType || 'melee';
    const rpsMult = 1 + rpsOutcome(selectedStyle, enemyStyle) * RPS_DAMAGE_SHIFT;
    const armor = (enemy?.armor || 0) + sumStatusEffect(enemyStatuses, 'flat_armor');
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
    const armor = (hero?.aggregator?.query('ARMOR') || 0)
        + (hero?.aggregator?.query('DEFENSE') || 0)
        + sumStatusEffect(hero?.statuses, 'flat_armor');
    const flatResist = hero?.aggregator?.query('RESIST_FLAT') || 0;
    return {
        min: Math.max(1, Math.round((enemy?.minDamage ?? 1) * rpsMult - armor - flatResist)),
        max: Math.max(1, Math.round((enemy?.maxDamage ?? 1) * rpsMult - armor - flatResist))
    };
}

/**
 * Crit chance hook (spec §7 step 4): resolves to 0 until the crit pass lands
 * (innate 5%/2× then). The combat info panels read this so they pick up the
 * real value automatically when it's implemented.
 */
export function getCritChance(/* entity */) {
    return 0;
}

/**
 * Hero attack interval — fixed 2.5s this pass; weapon archetypes redefine it later (spec §5).
 */
export function getHeroAttackSpeed() {
    return HERO_ATTACK_INTERVAL_MS;
}

/**
 * XP for defeating an enemy — derived onto the enemy stat block from its
 * band budget (12·G(level)^1.15, spec §6).
 */
export function getCombatXpAward(enemy) {
    return enemy?.xpAwarded ?? 1;
}

/**
 * Legacy RPS multiplier shim (UI matchup displays).
 * @deprecated use rpsOutcome/RPS_DAMAGE_SHIFT from FormulaRegistry
 */
export function calculateRpsMultiplier(attackerType, defenderType) {
    return _rpsMultiplier(attackerType, defenderType);
}

/**
 * Legacy percentage damage-reduction shim — always 0 now; the spec uses
 * flat Armor from gear (later pass).
 * @deprecated
 */
export function calculateDefenceReduction() {
    return 0;
}

export { growth };
