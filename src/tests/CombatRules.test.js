import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import {
    roundHalfUp,
    heroMaxHp,
    levelDamageBonus,
    attackSpeedMs,
    missChance,
    matchupMultiplier,
    enemyLevelStats,
    WEAPON_TIERS,
    BASE_CRIT_CHANCE,
    REGEN_CONFIG,
} from '../config/FormulaRegistry.js';
import * as CF from '../utils/CombatFormulas.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { GameState } from '../state/GameState.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as RegenSystem from '../systems/hero/RegenSystem.js';

/**
 * The combat numbers of the detail pass (`concept_combat.md`, "Detail pass rulings"): small
 * numbers, fixed hits, rare misses and crits, flat armour.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

registerItems({
    rules_copper_sword: { id: 'rules_copper_sword', name: 'Copper Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 2 },
    rules_iron_sword: { id: 'rules_iron_sword', name: 'Iron Sword', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 4 },
    rules_dagger: { id: 'rules_dagger', name: 'Dagger', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 1, speed: 'fast' },
    rules_maul: { id: 'rules_maul', name: 'Maul', type: 'weapon', equipSlot: 'hand', hands: 2, skillRequired: 'melee', damage: 3, speed: 'slow' },
    rules_bow: { id: 'rules_bow', name: 'Bow', type: 'weapon', equipSlot: 'hand', skillRequired: 'ranged', damage: 2 },
    rules_odd_speed: { id: 'rules_odd_speed', name: 'Odd', type: 'weapon', equipSlot: 'hand', skillRequired: 'melee', damage: 2, speed: 'ludicrous' },
});

function hero({ skill = null, level = 1, weapon = null } = {}) {
    const h = generateHero({ name: 'h' });
    h.id = `h_${Math.random().toString(36).slice(2)}`;
    if (skill) h.skills[skill] = { level, xp: xpForLevel(level) };
    h.equipment = Array(9).fill(null);
    if (weapon) h.equipment[0] = weapon;
    h.aggregator = new ModifierAggregator(h.id);
    return h;
}
/** A new hero: every skill at level 1. */
const recruit = (weapon = null) => hero({ weapon });
const give = (entity, type, value) => {
    if (!entity.aggregator) entity.aggregator = new ModifierAggregator('e');
    entity.aggregator.addModifier({ type, value, bucket: 'flat', source: `test_${type}` });
};
const enemy = (level, more = {}) => enemyProfileOf({ id: 'e', name: 'E', enemy: { level, style: 'melee', ...more } });

describe('rounding: nearest whole, halves up', () => {
    it('rounds 2.5 up to 3 and 4.5 up to 5, even where floating point lands a hair under', () => {
        expect(roundHalfUp(2.5)).toBe(3);
        expect(roundHalfUp(6 * 0.75)).toBe(5);
        expect(roundHalfUp(2 * 0.75)).toBe(2);
        expect(roundHalfUp(2.49)).toBe(2);
        expect(roundHalfUp(3.75)).toBe(4);
    });
});

// Rewritten with classless heroes: HP is 10 + the best of the four combat skills, so a new hero
// (every skill at 1) has 11; the Recruit's 10 is gone.
describe('HP: 10 + the best combat skill', () => {
    it('a new hero has 11, a level 99 fighter 109, whichever style is best', () => {
        expect(recruit().hp).toEqual({ current: 11, max: 11 });
        expect(CF.heroMaxHpFromSkills(recruit().skills)).toBe(11);
        expect(CF.heroMaxHpFromSkills(hero({ skill: 'melee', level: 1 }).skills)).toBe(11);
        expect(CF.heroMaxHpFromSkills(hero({ skill: 'stealth', level: 99 }).skills)).toBe(109);
        expect(CF.heroMaxHpFromSkills({})).toBe(10);
        expect(heroMaxHp(0)).toBe(10);
    });

    it('only the combat skills count: mining 60 adds nothing', () => {
        const miner = recruit();
        miner.skills.mining = { level: 60, xp: xpForLevel(60) };
        expect(CF.heroMaxHpFromSkills(miner.skills)).toBe(11);
    });

    it('follows a level-up as it happens: max +1, current kept (headroom, not a heal)', () => {
        GameState.initNew();
        const h = hero({ skill: 'melee', level: 4 });
        h.hp = { current: 7, max: 14 };
        GameState.state.heroes = [h];
        SkillSystem.addXP(h.id, 'melee', xpForLevel(5) - h.skills.melee.xp);
        expect(h.skills.melee.level).toBe(5);
        expect(h.hp).toEqual({ current: 7, max: 15 });
    });

    it('an old save is recomputed on load: 50/50 new hero → 11/11, 144/144 Melee 25 → 35/35, a hurt hero keeps their HP', () => {
        const oldRecruit = recruit();
        oldRecruit.hp = { current: 50, max: 50 };
        rehydrateHero(oldRecruit);
        expect(oldRecruit.hp).toEqual({ current: 11, max: 11 });

        const veteran = hero({ skill: 'melee', level: 25 });
        veteran.hp = { current: 144, max: 144 };
        rehydrateHero(veteran);
        expect(veteran.hp).toEqual({ current: 35, max: 35 });

        const hurt = hero({ skill: 'melee', level: 25 });
        hurt.hp = { current: 20, max: 144 };
        rehydrateHero(hurt);
        expect(hurt.hp).toEqual({ current: 20, max: 35 });
    });
});

describe('damage: the weapon, +1 per 20 levels, fixed', () => {
    it('the level step is 0 below 20, 1 at 20-39 … 4 at 80-99', () => {
        expect([1, 19, 20, 39, 40, 79, 80, 99].map(levelDamageBonus)).toEqual([0, 0, 1, 1, 2, 3, 4, 4]);
    });

    it('a copper sword hits for exactly 2 at level 1, every time (no spread)', () => {
        const h = hero({ skill: 'melee', level: 1, weapon: 'rules_copper_sword' });
        const e = enemy(1);
        const hits = new Set(Array.from({ length: 50 }, () => CF.heroHitDamage(h, e)));
        expect([...hits]).toEqual([2]);
    });

    it('the same sword at level 45 hits for 4 (2 + 2)', () => {
        expect(CF.heroHitDamage(hero({ skill: 'melee', level: 45, weapon: 'rules_copper_sword' }), enemy(1))).toBe(4);
    });

    it('flat Damage from gear adds to the hit', () => {
        const h = hero({ skill: 'melee', level: 1, weapon: 'rules_copper_sword' });
        give(h, EFFECT_TYPES.DAMAGE, 1);
        expect(CF.heroHitDamage(h, enemy(1))).toBe(3);
    });

    // Rewritten with classless heroes: barehanded is a Melee punch on the Melee level.
    it('a hero with no weapon punches for 1 (+ the Melee level step), as Melee', () => {
        const h = hero({ skill: 'melee', level: 25 });
        h.skills.ranged = { level: 60, xp: xpForLevel(60) };
        expect(CF.heroBaseDamage(h)).toBe(2);
        expect(CF.getHeroCombatStyle(h)).toBe('melee');
        expect(CF.heroAttackSpeedMs(h)).toBe(3000);
    });
});

// Rewritten with classless heroes: the Recruit is gone. A new hero swings whatever weapon is in
// their hands, at its speed and in its style, at their level 1 in that style.
describe('a new hero swings what they hold', () => {
    it('a fast weapon swings fast, its damage at level 1', () => {
        const r = recruit('rules_dagger');
        expect(CF.getHeroWeapon(r)?.id).toBe('rules_dagger');
        expect(CF.heroBaseDamage(r)).toBe(1);
        expect(CF.heroAttackSpeedMs(r)).toBe(2000);
        expect(CF.getHeroCombatLevel(r)).toBe(1);
    });

    it('a bow fights Ranged: the cycle counts both ways', () => {
        const r = recruit('rules_bow');
        expect(CF.getHeroCombatStyle(r)).toBe('ranged');
        // 2 against magic (good) 2.5 → 3, against melee (bad) 1.5 → 2.
        expect(CF.heroHitDamage(r, enemy(1, { style: 'magic' }))).toBe(3);
        expect(CF.heroHitDamage(r, enemy(1, { style: 'melee' }))).toBe(2);
        // A level 40 hit of 3: melee is strong against ranged, 3.75 → 4; magic weak, 2.25 → 2.
        expect(CF.enemyHitDamage(enemy(40, { style: 'melee' }), r)).toBe(4);
        expect(CF.enemyHitDamage(enemy(40, { style: 'magic' }), r)).toBe(2);
    });
});

describe('the style cycle: ±25 %, rounded halves up', () => {
    it('melee > ranged > magic > stealth > melee; opposites even', () => {
        expect(matchupMultiplier('melee', 'ranged')).toBe(1.25);
        expect(matchupMultiplier('ranged', 'melee')).toBe(0.75);
        expect(matchupMultiplier('melee', 'magic')).toBe(1);
        expect(matchupMultiplier('ranged', 'stealth')).toBe(1);
        expect(matchupMultiplier('stealth', 'melee')).toBe(1.25);
    });

    it('barely shows on small numbers: a 2 becomes 3 on a good matchup and stays 2 on a bad one', () => {
        const sword = hero({ skill: 'melee', level: 1, weapon: 'rules_copper_sword' });
        expect(CF.heroHitDamage(sword, enemy(1, { style: 'ranged' }))).toBe(3);   // 2.5 → 3
        expect(CF.heroHitDamage(sword, enemy(1, { style: 'stealth' }))).toBe(2);  // 1.5 → 2
        expect(CF.heroHitDamage(sword, enemy(1, { style: 'magic' }))).toBe(2);
    });

    it('works for the enemy too: a hit of 6 against a weak style is 8, against a strong one 5', () => {
        registerItems({ rules_shiv: { id: 'rules_shiv', name: 'Shiv', type: 'weapon', equipSlot: 'hand', styles: ['stealth'], damage: 1 } });
        const ranger = hero({ skill: 'ranged', level: 1, weapon: 'rules_bow' });
        const stealthy = hero({ skill: 'stealth', level: 1, weapon: 'rules_shiv' });
        const brute = enemy(1, { style: 'melee', hit: 6 });
        expect(CF.enemyHitDamage(brute, ranger)).toBe(8);     // 7.5 → 8
        expect(CF.enemyHitDamage(brute, stealthy)).toBe(5);   // 4.5 → 5
    });
});

describe('crits double before armour; armour is flat, minimum 1; pierce ignores armour points', () => {
    it('the concept doc\'s example: an iron sword 4 against armour 2 does 2, a crit 6', () => {
        const h = hero({ skill: 'melee', level: 1, weapon: 'rules_iron_sword' });
        const e = enemy(1, { armor: 2 });
        expect(CF.heroHitDamage(h, e)).toBe(2);
        expect(CF.heroHitDamage(h, e, { crit: true })).toBe(6);
    });

    it('a hit always does at least 1', () => {
        const h = hero({ skill: 'melee', level: 1, weapon: 'rules_copper_sword' });
        expect(CF.heroHitDamage(h, enemy(1, { armor: 9 }))).toBe(1);
        const plated = recruit();
        give(plated, EFFECT_TYPES.ARMOR, 5);
        expect(CF.enemyHitDamage(enemy(1), plated)).toBe(1);
    });

    it('pierce takes armour points away, never adds damage', () => {
        const h = hero({ skill: 'melee', level: 1, weapon: 'rules_iron_sword' });
        give(h, EFFECT_TYPES.PIERCE, 1);
        expect(CF.heroHitDamage(h, enemy(1, { armor: 2 }))).toBe(3);
        expect(CF.heroHitDamage(h, enemy(1, { armor: 0 }))).toBe(4);
        const plated = recruit();
        give(plated, EFFECT_TYPES.ARMOR, 3);
        expect(CF.enemyHitDamage(enemy(1, { hit: 5, pierce: 2 }), plated)).toBe(4);
    });

    it('crit chance is 5 %, and gear adds to it; an enemy has 5 % unless authored', () => {
        const h = recruit();
        expect(CF.heroCritChance(h)).toBe(BASE_CRIT_CHANCE);
        give(h, EFFECT_TYPES.CRIT_CHANCE, 10);
        expect(CF.heroCritChance(h)).toBe(15);
        expect(CF.enemyCritChance(enemy(1))).toBe(5);
        expect(CF.enemyCritChance(enemy(1, { critChance: 0 }))).toBe(0);
    });
});

describe('misses: 10 % ± the level gap + Dodge − Accuracy, 5-40 %', () => {
    it('10 % at an even level; one point per level of gap; the gap alone stops at 5 and 25', () => {
        expect(missChance(10, 10)).toBe(10);
        expect(missChance(12, 10)).toBe(8);
        expect(missChance(10, 13)).toBe(13);
        expect(missChance(30, 10)).toBe(5);
        expect(missChance(1, 99)).toBe(25);
    });

    it('Dodge and Accuracy move it past the gap\'s range, within 5-40', () => {
        expect(missChance(1, 99, 15)).toBe(40);
        expect(missChance(1, 99, 30)).toBe(40);
        expect(missChance(10, 10, 15)).toBe(25);
        expect(missChance(10, 10, 0, 3)).toBe(7);
        expect(missChance(10, 10, 0, 20)).toBe(5);
    });

    it('reads the hero\'s level, Accuracy and Dodge and the enemy\'s level, Dodge and Accuracy', () => {
        const h = hero({ skill: 'melee', level: 12 });
        const nimble = enemy(10, { dodge: 15 });
        expect(CF.heroMissChance(h, nimble)).toBe(23);           // 10 − 2 + 15
        give(h, EFFECT_TYPES.ACCURACY, 5);
        expect(CF.heroMissChance(h, nimble)).toBe(18);
        expect(CF.enemyMissChance(enemy(10), h)).toBe(12);       // 10 + 2
        give(h, EFFECT_TYPES.DODGE, 4);
        expect(CF.enemyMissChance(enemy(10, { accuracy: 1 }), h)).toBe(15);
    });

    // Rewritten with classless heroes: a new hero is level 1 in every style, so an even fight.
    it('a new hero is combat level 1 for the gap', () => {
        expect(CF.heroMissChance(recruit(), enemy(1))).toBe(10);
        expect(CF.enemyMissChance(enemy(1), recruit())).toBe(10);
        expect(CF.heroMissChance({ skills: {} }, enemy(1))).toBe(11);
    });

    it('a swing draws one number for the miss and, only on a hit, one for the crit', () => {
        const draws = [0.95, 0.01];
        const spy = vi.spyOn(Math, 'random').mockImplementation(() => draws.shift());
        expect(CF.rollSwing(10, 5)).toEqual({ hit: true, crit: true });
        expect(spy).toHaveBeenCalledTimes(2);
        spy.mockClear();
        draws.push(0.05, 0.5);
        expect(CF.rollSwing(10, 5)).toEqual({ hit: false, crit: false });
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});

describe('swing speed comes from the weapon: fast 2 s, normal 3 s, slow 4 s', () => {
    it('reads the weapon, and anything unknown is normal', () => {
        expect(attackSpeedMs('fast')).toBe(2000);
        expect(attackSpeedMs('slow')).toBe(4000);
        expect(attackSpeedMs(undefined)).toBe(3000);
        expect(CF.heroAttackSpeedMs(hero({ skill: 'melee', weapon: 'rules_dagger' }))).toBe(2000);
        expect(CF.heroAttackSpeedMs(hero({ skill: 'melee', weapon: 'rules_copper_sword' }))).toBe(3000);
        expect(CF.heroAttackSpeedMs(hero({ skill: 'melee', weapon: 'rules_maul' }))).toBe(4000);
        expect(CF.heroAttackSpeedMs(hero({ skill: 'melee', weapon: 'rules_odd_speed' }))).toBe(3000);
    });

    it('an enemy swings at its table speed unless a speed is authored', () => {
        expect(CF.enemyAttackSpeedMs(enemy(1))).toBe(3000);
        expect(CF.enemyAttackSpeedMs(enemy(1, { speed: 'fast' }))).toBe(2000);
        expect(CF.enemyAttackSpeedMs(enemy(1, { speed: 'slow' }))).toBe(4000);
    });
});

describe('the enemy level table', () => {
    it('fills HP, hit, armour, speed and XP from the level', () => {
        expect(enemyLevelStats(1)).toEqual({ hp: 21, hit: 1, armor: 0, speed: 'normal', attackSpeedMs: 3000, xp: 10 });
        expect(enemyLevelStats(20)).toMatchObject({ hp: 40, hit: 2, armor: 0 });
        expect(enemyLevelStats(30)).toMatchObject({ hp: 50, hit: 2, armor: 1 });
        expect(enemyLevelStats(99)).toMatchObject({ hp: 119, hit: 5, armor: 3 });
    });

    it('never falls as the level rises', () => {
        for (let L = 2; L <= 99; L++) {
            const a = enemyLevelStats(L - 1), b = enemyLevelStats(L);
            for (const k of ['hp', 'hit', 'armor', 'xp']) expect(b[k], `${k} at ${L}`).toBeGreaterThanOrEqual(a[k]);
        }
    });

    /**
     * The tuning target: a hero with their tier's normal weapon against an enemy of their own
     * level needs 10+ swings (30 s+) on average. Expected swings = HP ÷ (hit chance × average
     * damage per landed hit, crits included).
     */
    it('an even fight lasts 10 or more swings at every level', () => {
        for (let L = 1; L <= 99; L++) {
            const tier = WEAPON_TIERS.filter(t => L >= t.level).pop();
            const e = enemyLevelStats(L);
            const plain = tier.normal + levelDamageBonus(L);
            const landed = 0.95 * Math.max(1, plain - e.armor) + 0.05 * Math.max(1, 2 * plain - e.armor);
            const swings = e.hp / ((1 - missChance(L, L) / 100) * landed);
            expect(swings, `level ${L}`).toBeGreaterThanOrEqual(10);
        }
    });

    it('authored numbers replace the table\'s one by one; the rest stay safe defaults', () => {
        const e = enemy(5, { hp: 40, armor: 2, dodge: 15, speed: 'slow' });
        expect(e).toMatchObject({ hp: 40, hit: 1, armor: 2, dodge: 15, accuracy: 0, pierce: 0, critChance: 5, attackSpeed: 4000, xpAwarded: 13 });
    });

    it('older content\'s budgetScale still scales HP, hit and XP (not armour or speed)', () => {
        const goblin = enemy(1, { budgetScale: 0.3 });
        expect(goblin).toMatchObject({ hp: 6, hit: 1, armor: 0, attackSpeed: 3000, xpAwarded: 3 });
        const chief = enemy(3, { budgetScale: 0.6 });
        expect(chief).toMatchObject({ hp: 14, hit: 1, xpAwarded: 7 });
    });
});

describe('regen: about 1 HP every 10 s, never in a fight', () => {
    let heroes;
    beforeEach(() => {
        GameState.initNew();
        RegenSystem.reset();
        const resting = recruit();
        resting.status = 'idle';
        resting.hp = { current: 5, max: 10 };
        const fighting = recruit();
        fighting.status = 'combat';
        fighting.hp = { current: 5, max: 10 };
        heroes = { resting, fighting };
        GameState.state.heroes = [resting, fighting];
    });
    afterEach(() => RegenSystem.reset());

    it('heals an idle hero 1 per 10 s and a fighting hero not at all', () => {
        expect(REGEN_CONFIG.hp).toEqual({ amount: 1, interval: 10 });
        RegenSystem.tick(9000);
        expect(heroes.resting.hp.current).toBe(5);
        RegenSystem.tick(1000);
        expect(heroes.resting.hp.current).toBe(6);
        RegenSystem.tick(30000);
        expect(heroes.resting.hp.current).toBe(9);
        expect(heroes.fighting.hp.current).toBe(5);
    });
});
