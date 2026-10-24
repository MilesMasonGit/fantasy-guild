// Fantasy Guild - Formula Registry
//
// The combat numbers (`docs/active/concept_combat.md`, "Detail pass rulings"). Small
// numbers everywhere: a hero has 10 HP plus their combat level, a copper sword hits for 2, and
// one or two extra damage is a noticeable boost. Every number here is a first proposal for the
// owner to tune in play.

// --- Rounding -------------------------------------------------------------------------------

/**
 * Round to the nearest whole number, halves up (2.5 → 3, 4.5 → 5): the one rounding every combat
 * percentage uses. The small epsilon keeps a product such as 6 × 0.75 = 4.499999… from rounding
 * down.
 */
export function roundHalfUp(x) {
    return Math.floor(x + 0.5 + 1e-9);
}

// --- Heroes ---------------------------------------------------------------------------------

/** Max HP = 10 + combat level: about 10 for a Recruit, 109 at level 99. */
export const HERO_BASE_HP = 10;
export function heroMaxHp(combatLevel) {
    return HERO_BASE_HP + Math.max(0, Math.floor(combatLevel || 0));
}

/** The level's share of damage: +1 per 20 combat levels (0 below 20, 4 at 80-99). */
export const LEVELS_PER_DAMAGE_STEP = 20;
export function levelDamageBonus(combatLevel) {
    return Math.floor(Math.max(0, combatLevel || 0) / LEVELS_PER_DAMAGE_STEP);
}

/** A bare fist: what a Recruit always hits with, and a promoted hero holding no weapon. */
export const UNARMED_DAMAGE = 1;

// --- Swing speed ----------------------------------------------------------------------------

/** The three weapon speeds. A weapon (and an enemy) names one; anything else is normal. */
export const ATTACK_SPEED_MS = Object.freeze({ fast: 2000, normal: 3000, slow: 4000 });
export const DEFAULT_ATTACK_SPEED = 'normal';
export function attackSpeedMs(speed) {
    return ATTACK_SPEED_MS[speed] ?? ATTACK_SPEED_MS[DEFAULT_ATTACK_SPEED];
}

// --- Misses ---------------------------------------------------------------------------------

/**
 * Miss chance, in whole percent:
 *   level part = 10 − 1 × (attacker level − defender level), kept between 5 and 25;
 *   miss       = level part + the defender's Dodge − the attacker's Accuracy, kept between 5 and 40.
 * So five levels above an enemy reach the 5 % floor, fifteen below reach 25 %, and only Dodge
 * and Accuracy move it further.
 */
export const MISS = Object.freeze({
    BASE: 10,
    PER_LEVEL: 1,
    LEVEL_MIN: 5,
    LEVEL_MAX: 25,
    MIN: 5,
    MAX: 40
});
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function missChance(attackerLevel, defenderLevel, dodge = 0, accuracy = 0) {
    const gap = (attackerLevel || 0) - (defenderLevel || 0);
    const levelPart = clamp(MISS.BASE - MISS.PER_LEVEL * gap, MISS.LEVEL_MIN, MISS.LEVEL_MAX);
    return clamp(roundHalfUp(levelPart + (dodge || 0) - (accuracy || 0)), MISS.MIN, MISS.MAX);
}

// --- Crits ----------------------------------------------------------------------------------

/** About 1 swing in 20 crits for double, the doubling applied BEFORE armour. Gear adds chance. */
export const BASE_CRIT_CHANCE = 5;
export const CRIT_MULTIPLIER = 2;

// --- The style cycle ------------------------------------------------------------------------

/** A good matchup deals 25 % more, a bad one 25 % less (rounded halves up, minimum 1 after armour). */
export const MATCHUP_DAMAGE_SHIFT = 0.25;

/**
 * Combat matchup table, a four-way cycle (owner-locked):
 * Melee > Ranged > Magic > Stealth > Melee. Opposite pairs (Melee–Magic,
 * Ranged–Stealth) are even, so each style has one favoured and one
 * unfavoured matchup.
 */
export const RPS_RULES = {
    melee:   { strong: 'ranged',  weak: 'stealth' },
    ranged:  { strong: 'magic',   weak: 'melee' },
    magic:   { strong: 'stealth', weak: 'ranged' },
    stealth: { strong: 'melee',   weak: 'magic' },
};

/**
 * RPS outcome for attacker vs defender styles. A side with no style (a Recruit) is even with
 * everyone.
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

/** 1.25, 1 or 0.75. */
export function matchupMultiplier(attackerType, defenderType) {
    return 1 + rpsOutcome(attackerType, defenderType) * MATCHUP_DAMAGE_SHIFT;
}

// --- Enemies: the level table ---------------------------------------------------------------

/**
 * What an enemy of a level has before the author changes anything (the CMS will fill these and
 * let any be overridden). Tuned so an even fight, a hero with their tier's
 * normal-speed weapon against an enemy of their own level, lasts 10+ swings and 30 s or more:
 *   HP      = 20 + level        (10 more than a hero of that level)
 *   hit     = 1 + 1 per 20 levels
 *   armour  = 1 per 30 levels
 *   speed   = normal (3 s)
 *   XP      = 10 × 1.065^(level − 1), rounded
 * The worked duels are in `concept_combat.md` ("The level table and weapon tiers").
 */
export const ENEMY_LEVEL_TABLE = Object.freeze({
    HP_BASE: 20,
    HIT_LEVELS_PER_STEP: 20,
    ARMOR_LEVELS_PER_POINT: 30,
    XP_BASE: 10,
    XP_GROWTH: 1.065
});

/**
 * The stat block for an enemy of `level`.
 * @returns {{ hp: number, hit: number, armor: number, speed: string, attackSpeedMs: number, xp: number }}
 */
export function enemyLevelStats(level) {
    const L = Math.max(1, Math.floor(level || 1));
    const t = ENEMY_LEVEL_TABLE;
    return {
        hp: t.HP_BASE + L,
        hit: 1 + Math.floor(L / t.HIT_LEVELS_PER_STEP),
        armor: Math.floor(L / t.ARMOR_LEVELS_PER_POINT),
        speed: DEFAULT_ATTACK_SPEED,
        attackSpeedMs: attackSpeedMs(DEFAULT_ATTACK_SPEED),
        xp: Math.max(1, roundHalfUp(t.XP_BASE * Math.pow(t.XP_GROWTH, L - 1)))
    };
}

/**
 * The proposed weapon tiers, by the smithing ingots' levels: a normal weapon's damage, a fast one
 * about 2/3 of it, a slow one about 4/3, so the three deal about the same per second before
 * armour. A proposal for authoring; every weapon carries its own `damage`, and the
 * engine never reads this table.
 */
export const WEAPON_TIERS = Object.freeze([
    { tier: 'copper',     level: 1,  fast: 1, normal: 2, slow: 3 },
    { tier: 'iron',       level: 15, fast: 2, normal: 3, slow: 4 },
    { tier: 'silver',     level: 30, fast: 3, normal: 4, slow: 5 },
    { tier: 'gold',       level: 45, fast: 3, normal: 5, slow: 7 },
    { tier: 'mythril',    level: 60, fast: 4, normal: 6, slow: 8 },
    { tier: 'adamantine', level: 75, fast: 5, normal: 7, slow: 9 },
    { tier: 'darkmetal',  level: 90, fast: 5, normal: 8, slow: 11 }
]);

// --- The Rules tick -------------------------------------------------------------------------

/**
 * The one clock every lingering effect ticks on ("On Tick"), statuses included: a normal
 * swing's pace, so a Poison stack's 1 a tick reads like a third of a swing per second.
 */
export const STATUS_TICK_INTERVAL_MS = 3000;

/**
 * How far a Swing Time effect may move a swing: never under a quarter of its time, never over
 * four times it.
 */
export const SWING_TIME_FACTOR_RANGE = Object.freeze({ min: 0.25, max: 4 });

// --- Regen ----------------------------------------------------------------------------------

/** 1 HP every 10 s, outside fights only: mid-fight only food heals. */
export const REGEN_CONFIG = {
    hp:     { amount: 1, interval: 10.0 },
};
