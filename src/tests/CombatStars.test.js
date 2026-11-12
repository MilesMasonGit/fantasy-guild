import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { hallRuleSentence, starAmount, starSentence } from '../systems/progression/hallStarText.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { getPaletteEntry, isCombatStyleScope } from '../config/registries/modifierPalette.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE, getUpgradeDef } from '../config/guildUpgrades.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import {
    heroBlow, heroBaseDamage, heroAttackSpeedMs, heroAccuracy, heroMissChance, getHeroCombatStyle,
    enemyBlow, enemyAccuracy, enemyAttackSpeedMs
} from '../systems/combat/CombatFormulas.js';
import { heroSide } from '../ui/components/combat/fightView.js';

/**
 * Combat stars (brief 620 E4): a Guild Hall star may give heroes Damage, Swing Time (attack speed)
 * and Accuracy, narrowed to one combat style, the style a hero fights in (the weapon's; Melee
 * barehanded). The hero's numbers read the guild-wide aggregator for that style; enemies never do.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const weapon = (id, name, extra = {}) => ({ id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', ...extra });
registerItems({
    cs_sword: weapon('cs_sword', 'Star Sword', { styles: ['melee'], damage: 4 }),
    cs_bow: weapon('cs_bow', 'Star Bow', { styles: ['ranged'], damage: 4 }),
    cs_wand: weapon('cs_wand', 'Star Wand', { styles: ['magic'], damage: 4 })
});

let seq = 0;
const rule = (type, value, bucket, category) => ({
    id: `stm_cs_${++seq}`, keyword: KEYWORD.PROVIDES,
    payload: { type, bucket, value, ...(category ? { category } : {}) },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
});

/** A sky of one star with one rank holding `rules`. */
function sky(rules) {
    return {
        constellations: { melee_x: { id: 'melee_x', name: 'Melee X', label: { x: 0, y: -3 } } },
        stars: {
            cs_star: { id: 'cs_star', constellation: 'melee_x', name: 'Sharp Blades', node: { x: 0, y: -2.6 }, links: [HALL_NODE],
                ranks: [{ tier: 1, price: [{ itemId: 'item_oak_wood', quantity: 5 }], rules, lines: [] }] }
        }
    };
}

/** Put `rules` in force as a held star (rank 1), or as a star not yet bought (rank 0). */
function holdStar(rules, rank = 1) {
    registerHallSky(sky(rules));
    HallRules.apply({ cs_star: rank });
}

/** A level-50 hero holding `weaponId` (barehanded when null). */
function hero(id, weaponId = null) {
    const h = generateHero({ name: id });
    h.id = id;
    h.status = 'idle';
    Object.values(h.skills).forEach(s => { s.level = 50; s.xp = 0; });
    h.equipment = [weaponId, ...Array(8).fill(null)];
    rehydrateHero(h);
    GameState.state.heroes.push(h);
    return h;
}

const ENEMY = { combatType: 'magic', level: 10, hit: 3, accuracy: 0, attackSpeed: 3000 };

/** The numbers a fight reads off a hero, against a plain enemy. */
const numbers = (h) => ({
    hit: heroBlow(h, ENEMY).exact,
    base: heroBaseDamage(h),
    swingMs: heroAttackSpeedMs(h),
    accuracy: heroAccuracy(h),
    miss: heroMissChance(h, ENEMY)
});

let melee, archer, mage, fist;
beforeEach(() => {
    GameState.initNew();
    registerHallSky(null);
    HallRules.apply({});
    melee = hero('cs_melee', 'cs_sword');
    archer = hero('cs_archer', 'cs_bow');
    mage = hero('cs_mage', 'cs_wand');
    fist = hero('cs_fist');
});
afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
});
afterAll(() => HallRules.teardown());

describe('a combat star helps only the style it names', () => {
    it('the heroes fight in the styles their weapons say (barehanded is Melee)', () => {
        expect([melee, archer, mage, fist].map(getHeroCombatStyle)).toEqual(['melee', 'ranged', 'magic', 'melee']);
    });

    it('+50 % Damage for Melee raises a melee hero\'s hit and not an archer\'s', () => {
        const before = [melee, archer, mage, fist].map(numbers);
        holdStar([rule(EFFECT_TYPES.DAMAGE, 0.5, 'percentage', 'melee')]);
        const after = [melee, archer, mage, fist].map(numbers);
        expect(after[0].hit).toBeCloseTo(before[0].hit * 1.5, 9);
        expect(after[3].hit).toBeCloseTo(before[3].hit * 1.5, 9);
        expect(after[1]).toEqual(before[1]);
        expect(after[2]).toEqual(before[2]);
    });

    it('+2 flat Damage for Ranged adds to an archer\'s base hit only', () => {
        const before = [melee, archer].map(numbers);
        holdStar([rule(EFFECT_TYPES.DAMAGE, 2, 'flat', 'ranged')]);
        expect(heroBaseDamage(archer)).toBe(before[1].base + 2);
        expect(numbers(melee)).toEqual(before[0]);
    });

    it('−25 % Swing Time for Ranged makes an archer swing a quarter sooner, and nobody else', () => {
        const before = [melee, archer, mage].map(numbers);
        holdStar([rule(EFFECT_TYPES.SWING_TIME, -0.25, 'percentage', 'ranged')]);
        expect(heroAttackSpeedMs(archer)).toBe(Math.round(before[1].swingMs * 0.75));
        expect(heroAttackSpeedMs(archer)).toBeLessThan(before[1].swingMs);
        expect(numbers(melee)).toEqual(before[0]);
        expect(numbers(mage)).toEqual(before[2]);
    });

    it('+10 Accuracy for Magic takes 10 points off a mage\'s miss chance only', () => {
        // A tough enemy, so the miss chance is off its 5 % floor.
        const tough = { ...ENEMY, level: 99, dodge: 20 };
        const before = [melee, archer, mage].map(numbers);
        const missBefore = heroMissChance(mage, tough);
        holdStar([rule(EFFECT_TYPES.ACCURACY, 10, 'flat', 'magic')]);
        expect(heroAccuracy(mage)).toBe(before[2].accuracy + 10);
        expect(heroMissChance(mage, tough)).toBeLessThan(missBefore);
        expect(numbers(melee)).toEqual(before[0]);
        expect(numbers(archer)).toEqual(before[1]);
    });

    it('a star naming no style helps every fighter', () => {
        const before = [melee, archer, mage].map(numbers);
        holdStar([rule(EFFECT_TYPES.DAMAGE, 0.5, 'percentage')]);
        [melee, archer, mage].forEach((h, i) => expect(numbers(h).hit).toBeCloseTo(before[i].hit * 1.5, 9));
    });

    it('a star with no rank bought changes nothing', () => {
        const before = [melee, archer, mage, fist].map(numbers);
        holdStar([
            rule(EFFECT_TYPES.DAMAGE, 0.5, 'percentage', 'melee'),
            rule(EFFECT_TYPES.SWING_TIME, -0.25, 'percentage', 'melee'),
            rule(EFFECT_TYPES.ACCURACY, 10, 'flat', 'melee')
        ], 0);
        expect([melee, archer, mage, fist].map(numbers)).toEqual(before);
    });

    it('a star narrowed to a work skill helps no fighter', () => {
        const before = [melee, archer].map(numbers);
        holdStar([rule(EFFECT_TYPES.DAMAGE, 0.5, 'percentage', 'mining')]);
        expect([melee, archer].map(numbers)).toEqual(before);
    });

    it('never reaches an enemy', () => {
        const enemy = { ...ENEMY };
        const before = { blow: enemyBlow(enemy, archer).exact, accuracy: enemyAccuracy(enemy), swing: enemyAttackSpeedMs(enemy) };
        holdStar([
            rule(EFFECT_TYPES.DAMAGE, 0.5, 'percentage'),
            rule(EFFECT_TYPES.SWING_TIME, -0.25, 'percentage'),
            rule(EFFECT_TYPES.ACCURACY, 10, 'flat')
        ]);
        expect({ blow: enemyBlow(enemy, archer).exact, accuracy: enemyAccuracy(enemy), swing: enemyAttackSpeedMs(enemy) }).toEqual(before);
    });

    it('the fight window\'s hit and swing show the star', () => {
        const before = heroSide(melee);
        const archerBefore = heroSide(archer);
        holdStar([
            rule(EFFECT_TYPES.DAMAGE, 0.5, 'percentage', 'melee'),
            rule(EFFECT_TYPES.SWING_TIME, -0.25, 'percentage', 'melee')
        ]);
        const after = heroSide(melee);
        expect(after.hit).toBeCloseTo(before.hit * 1.5, 9);
        expect(after.swingMs).toBe(Math.round(before.swingMs * 0.75));
        expect(heroSide(archer)).toEqual(archerBefore);
    });

    it('a carried rule narrowed to a style counts only in that style (flat and percentage)', () => {
        const before = [melee, archer].map(numbers);
        for (const h of [melee, archer]) {
            h.aggregator.addModifier({ type: EFFECT_TYPES.DAMAGE, value: 3, bucket: 'flat', source: 'test:charm', target: { category: 'ranged' } });
            h.aggregator.addModifier({ type: EFFECT_TYPES.DAMAGE, value: 0.5, bucket: 'percentage', source: 'test:charm', target: { category: 'ranged' } });
        }
        expect(numbers(melee)).toEqual(before[0]);
        expect(heroBaseDamage(archer)).toBe(before[1].base + 3);
    });
});

describe('the words: palette, rule text and the star', () => {
    it('Damage, Swing Time and Accuracy narrow by combat style; no other combat axis does', () => {
        for (const type of [EFFECT_TYPES.DAMAGE, EFFECT_TYPES.SWING_TIME, EFFECT_TYPES.ACCURACY]) {
            expect(getPaletteEntry(type).categories).toBe('combatStyle');
        }
        expect(getPaletteEntry(EFFECT_TYPES.DODGE).categories).toBeUndefined();
        expect(getPaletteEntry(EFFECT_TYPES.CRIT_CHANCE).categories).toBeUndefined();
        expect([undefined, 'ALL', 'combat', 'melee', 'Stealth'].map(isCombatStyleScope)).toEqual([true, true, true, true, true]);
        expect(['mining', 'not_a_style'].map(isCombatStyleScope)).toEqual([false, false]);
    });

    it('the CMS offers any style or one of the four, never a work skill', () => {
        const slot = slotsOf(rule(EFFECT_TYPES.DAMAGE, 0.1, 'percentage')).find(s => s.id === 'category');
        expect(slot.options.map(o => o.id)).toEqual(['', 'melee', 'ranged', 'magic', 'stealth']);
        expect(slot.options.map(o => o.label)).toEqual(['Any style', 'Melee', 'Ranged', 'Magic', 'Stealth']);
    });

    it('a rule names its style, on a Token and on a hero', () => {
        expect(renderStatement(rule(EFFECT_TYPES.DAMAGE, 0.1, 'percentage', 'melee'), {}))
            .toBe('Provides 10% more damage in combat, but only for Melee fighters — to the hero carrying this item, or on an enemy, to the hero fighting it.');
        expect(renderStatement(rule(EFFECT_TYPES.ACCURACY, 5, 'flat', 'stealth'), { carried: true }))
            .toBe('Gives the hero 5 more accuracy in combat, but only as a Stealth fighter.');
        // A work skill there matches no fighter and is not said (the audit names it).
        expect(renderStatement(rule(EFFECT_TYPES.DAMAGE, 2, 'flat', 'mining'), {}))
            .toBe('Provides 2 more damage in combat — to the hero carrying this item, or on an enemy, to the hero fighting it.');
    });

    it('a combat star says who it helps and how, in the Hall\'s effects and its card', () => {
        expect(hallRuleSentence(rule(EFFECT_TYPES.DAMAGE, 0.1, 'percentage', 'melee'))).toBe('Gives every Melee fighter 10% more damage in combat.');
        expect(hallRuleSentence(rule(EFFECT_TYPES.SWING_TIME, -0.1, 'percentage', 'ranged'))).toBe('Gives every Ranged fighter 10% less swing time in combat.');
        expect(hallRuleSentence(rule(EFFECT_TYPES.ACCURACY, 5, 'flat'))).toBe('Gives every hero 5 more accuracy in combat.');

        const cases = [
            [rule(EFFECT_TYPES.DAMAGE, 0.1, 'percentage', 'melee'), 'Every Melee fighter hits harder.', '10% more damage'],
            [rule(EFFECT_TYPES.SWING_TIME, -0.1, 'percentage', 'ranged'), 'Every Ranged fighter swings faster.', '10% less swing time'],
            [rule(EFFECT_TYPES.ACCURACY, 5, 'flat', 'magic'), 'Every Magic fighter misses less.', '5 more accuracy'],
            [rule(EFFECT_TYPES.DAMAGE, -0.1, 'percentage', 'stealth'), 'Every Stealth fighter hits softer.', '10% less damage']
        ];
        for (const [statement, sentence, amount] of cases) {
            registerHallSky(sky([statement]));
            const def = getUpgradeDef('cs_star');
            expect(starSentence(def)).toBe(sentence);
            expect(starAmount(def, 1)).toBe(amount);
        }
    });
});

describe('the audit', () => {
    const findings = (rules) => {
        const s = sky(rules);
        return hallStarFindings({ sky: s, items: { item_oak_wood: { id: 'item_oak_wood' } } }).map(f => f.message);
    };

    it('takes a style star as a star the Hall can give', () => {
        expect(findings([rule(EFFECT_TYPES.DAMAGE, 0.1, 'percentage', 'melee'), rule(EFFECT_TYPES.ACCURACY, 5, 'flat')])).toEqual([]);
    });

    it('still names a combat axis a star cannot give, and a style rule narrowed to a work skill', () => {
        const messages = findings([rule(EFFECT_TYPES.DODGE, 5, 'flat'), rule(EFFECT_TYPES.DAMAGE, 0.1, 'percentage', 'mining')]);
        expect(messages.some(m => m.includes('Dodge rule, which only reaches a hero from what they carry'))).toBe(true);
        expect(messages.some(m => m.includes('narrowed to "mining", which is no combat style'))).toBe(true);
    });

    it('names an item whose style rule is narrowed to a work skill', () => {
        const effects = { cs_fx: { id: 'cs_fx', name: 'Odd Edge', statements: [rule(EFFECT_TYPES.DAMAGE, 1, 'flat', 'mining')] } };
        const items = { cs_odd: { id: 'cs_odd', name: 'Odd Sword', type: 'weapon', statements: [rule(EFFECT_TYPES.DAMAGE, 1, 'flat', 'mining')] } };
        const messages = findUnknownRefs({ tokens: {}, items, recipes: {}, effects }).map(f => f.message);
        expect(messages.some(m => m.includes('which is no combat style'))).toBe(true);
    });
});
