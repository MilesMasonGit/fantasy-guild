import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { hallRulesOf } from '../systems/progression/hallModifiers.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE, authoredStars } from '../config/guildUpgrades.js';
import {
    heroCritChance, heroDodge, heroBlow, heroTypeResistance, enemyBlow, enemyMissChance,
    enemyCritChance, enemyDodge, enemyTypeResistance, typeDamageBoost, heroDamageType
} from '../systems/combat/CombatFormulas.js';
import { heroSide, heroResistLines } from '../ui/components/combat/fightView.js';
import { hallEffectsNow } from '../ui/components/board/GuildHallEffectsPopover.jsx';
import { hallRuleSentence, starSentence, starAmount } from '../systems/progression/hallStarText.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';

/**
 * Guild-wide combat effects: a Guild Hall star's (or a Region rule's) Crit Chance, Dodge, Type
 * Damage % and Type Resistance % reach every hero, summed in the same bucket as what the hero
 * carries; enemies never read the guild's. Sunder cannot sit on a star. No shipped star carries
 * these, so every star here is a fixture.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerItems({
    gce_sword: { id: 'gce_sword', name: 'Guild Sword', type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', styles: ['melee'], damage: 4, damageType: 'slash' }
});

let seq = 0;
const rule = (type, value, category) => ({
    id: `stm_gce_${++seq}`, keyword: KEYWORD.PROVIDES,
    payload: { type, bucket: 'flat', value, ...(category ? { category } : {}) },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
});

function sky(rules) {
    return {
        constellations: { gce_c: { id: 'gce_c', name: 'Guild Arms', label: { x: 0, y: -3 } } },
        stars: {
            gce_star: { id: 'gce_star', constellation: 'gce_c', name: 'Guild Arms', node: { x: 0, y: -2.6 }, links: [HALL_NODE],
                ranks: [{ tier: 1, price: [{ itemId: 'item_oak_wood', quantity: 5 }], rules, lines: [] }] }
        }
    };
}

function holdStar(rules, rank = 1) {
    registerHallSky(sky(rules));
    HallRules.apply({ gce_star: rank });
}

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

/** What a hero carries: a flat row on their own aggregator, as gear registers it. */
const carry = (h, type, value, category) => h.aggregator.addModifier({
    type, value, bucket: 'flat', source: `test:gear:${++seq}`, ...(category ? { target: { category } } : {})
});

const ENEMY = { combatType: 'magic', level: 50, hit: 10, accuracy: 0, attackSpeed: 3000 };

let swordsman, fist;
beforeEach(() => {
    GameState.initNew();
    registerHallSky(null);
    HallRules.apply({});
    swordsman = hero('gce_sword_hero', 'gce_sword');
    fist = hero('gce_fist');
});
afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
});
afterAll(() => HallRules.teardown());

describe('a star\'s Crit Chance and Dodge reach every hero', () => {
    it('+10 Crit Chance raises every hero\'s crit chance by 10, added to what they carry', () => {
        carry(swordsman, EFFECT_TYPES.CRIT_CHANCE, 5);
        const before = [heroCritChance(swordsman), heroCritChance(fist)];
        holdStar([rule(EFFECT_TYPES.CRIT_CHANCE, 10)]);
        expect([heroCritChance(swordsman), heroCritChance(fist)]).toEqual([before[0] + 10, before[1] + 10]);
    });

    it('+8 Dodge raises every hero\'s dodge and an enemy misses them more', () => {
        carry(fist, EFFECT_TYPES.DODGE, 4);
        const missBefore = enemyMissChance(ENEMY, swordsman);
        const before = [heroDodge(swordsman), heroDodge(fist)];
        holdStar([rule(EFFECT_TYPES.DODGE, 8)]);
        expect([heroDodge(swordsman), heroDodge(fist)]).toEqual([before[0] + 8, before[1] + 8]);
        expect(enemyMissChance(ENEMY, swordsman)).toBeGreaterThan(missBefore);
    });
});

describe('a star\'s Type Damage % and Type Resistance % reach every hero', () => {
    it('+20 Slash damage is summed with the hero\'s own Slash boost, not multiplied by it', () => {
        expect(heroDamageType(swordsman)).toBe('slash');
        carry(swordsman, EFFECT_TYPES.TYPE_DAMAGE, 10, 'slash');
        const before = heroBlow(swordsman, ENEMY).exact;
        holdStar([rule(EFFECT_TYPES.TYPE_DAMAGE, 20, 'slash')]);
        expect(heroBlow(swordsman, ENEMY).exact).toBeCloseTo(before / 1.1 * 1.3, 9);
    });

    it('a star\'s row on a group (Physical) counts on none of its types: only types carry numbers', () => {
        const before = heroBlow(swordsman, ENEMY).exact;
        holdStar([rule(EFFECT_TYPES.TYPE_DAMAGE, 20, 'physical')]);
        expect(heroBlow(swordsman, ENEMY).exact).toBe(before);
    });

    it('+15 Crush resistance is summed with the hero\'s own and cuts an enemy\'s plain swing', () => {
        carry(fist, EFFECT_TYPES.TYPE_RESIST, 10, 'crush');
        const before = { slash: heroTypeResistance(fist, 'slash'), crush: heroTypeResistance(fist, 'crush'), fire: heroTypeResistance(fist, 'fire') };
        const blowBefore = enemyBlow(ENEMY, fist).exact;
        holdStar([rule(EFFECT_TYPES.TYPE_RESIST, 15, 'crush')]);
        expect(heroTypeResistance(fist, 'crush')).toBe(before.crush + 15);
        expect(heroTypeResistance(fist, 'slash')).toBe(before.slash);
        expect(heroTypeResistance(fist, 'fire')).toBe(before.fire);
        expect(enemyBlow(ENEMY, fist).exact).toBeCloseTo(blowBefore / 0.9 * 0.75, 9);
    });

    it('Sunder on the hero lowers the guild\'s resistance with their own', () => {
        holdStar([rule(EFFECT_TYPES.TYPE_RESIST, 15, 'crush')]);
        carry(fist, EFFECT_TYPES.SUNDER, 10);
        expect(heroTypeResistance(fist, 'crush')).toBe(5);
    });

    it('the fight window shows the star\'s boost and resistance', () => {
        holdStar([rule(EFFECT_TYPES.TYPE_DAMAGE, 20, 'slash'), rule(EFFECT_TYPES.TYPE_RESIST, 15, 'crush')]);
        expect(heroSide(swordsman).hitLines.some(l => l.includes('20%'))).toBe(true);
        expect(heroResistLines(fist).find(l => l.id === 'crush')?.value).toBe(15);
    });
});

describe('enemies never read the guild\'s', () => {
    it('a star\'s four combat effects leave an enemy\'s numbers alone', () => {
        const enemy = { ...ENEMY, resistances: { slash: 10 } };
        const read = () => ({
            crit: enemyCritChance(enemy), dodge: enemyDodge(enemy), boost: typeDamageBoost(enemy, 'slash'),
            resist: enemyTypeResistance(enemy, 'slash'), blow: enemyBlow(enemy, swordsman).exact
        });
        const before = read();
        holdStar([
            rule(EFFECT_TYPES.CRIT_CHANCE, 10), rule(EFFECT_TYPES.DODGE, 8),
            rule(EFFECT_TYPES.TYPE_DAMAGE, 20, 'slash'), rule(EFFECT_TYPES.TYPE_RESIST, 15, 'slash')
        ]);
        expect(read()).toEqual(before);
    });
});

describe('Sunder cannot sit on a star', () => {
    it('the guild does not carry it, and the boot audit names it', () => {
        const sunder = rule(EFFECT_TYPES.SUNDER, 10);
        holdStar([sunder]);
        const { modifiers, held, ignored } = hallRulesOf(authoredStars(), { gce_star: 1 });
        expect(modifiers).toEqual([]);
        expect(held).toEqual([]);
        expect(ignored).toHaveLength(1);
        expect(getGlobalAggregator().query(EFFECT_TYPES.SUNDER)).toBe(0);

        const messages = hallStarFindings({ sky: sky([sunder]), items: { item_oak_wood: { id: 'item_oak_wood' } } }).map(f => f.message);
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatch(/Sunder rule/);
        expect(messages[0]).toMatch(/Delete the rule in the CMS/);
    });

    it('the audit takes the four guild combat effects as effects a star can give', () => {
        const rules = [
            rule(EFFECT_TYPES.CRIT_CHANCE, 5), rule(EFFECT_TYPES.DODGE, 5),
            rule(EFFECT_TYPES.TYPE_DAMAGE, 10, 'fire'), rule(EFFECT_TYPES.TYPE_RESIST, 10, 'elemental')
        ];
        expect(hallStarFindings({ sky: sky(rules), items: { item_oak_wood: { id: 'item_oak_wood' } } })).toEqual([]);
    });
});

describe('the Hall\'s Effects list shows only effects that work', () => {
    it('lists a Crit Chance rule, never a Sunder or a Food Healing one', () => {
        holdStar([rule(EFFECT_TYPES.CRIT_CHANCE, 5), rule(EFFECT_TYPES.SUNDER, 10), rule(EFFECT_TYPES.FOOD_HEALING, 0.5)]);
        GameState.state.progress.guildUpgrades = { ...(GameState.state.progress.guildUpgrades || {}), gce_star: 1 };
        const { boosts } = hallEffectsNow(GameState.state);
        expect(boosts).toHaveLength(1);
        expect(boosts[0]).toMatch(/crit/i);
    });
});

describe('the words: the Hall Effects list and the star card', () => {
    const cases = [
        [rule(EFFECT_TYPES.CRIT_CHANCE, 5), 'Crit Chance +5% for every hero in combat.', 'Every hero crits more often.', 'Crit Chance +5%'],
        [rule(EFFECT_TYPES.DODGE, 4), 'Dodge +4% for every hero in combat.', 'Every hero dodges more.', 'Dodge +4%'],
        [rule(EFFECT_TYPES.TYPE_DAMAGE, 10, 'fire'), 'Gives every hero 10% more Fire damage in combat.', 'Every hero hits harder with Fire.', '10% more Fire damage'],
        [rule(EFFECT_TYPES.TYPE_RESIST, 10, 'crush'), 'Gives every hero 10% Crush resistance in combat.', 'Every hero takes less from Crush.', '10% Crush resistance'],
        [rule(EFFECT_TYPES.TYPE_RESIST, -5, 'slash'), 'Gives every hero a 5% Slash weakness in combat.', 'Every hero takes more from Slash.', 'a 5% Slash weakness']
    ];
    it.each(cases)('%#: says who it helps and how', (statement, line, sentence, amount) => {
        registerHallSky(sky([statement]));
        const def = getUpgradeDef('gce_star');
        expect([hallRuleSentence(statement), starSentence(def), starAmount(def, 1)]).toEqual([line, sentence, amount]);
    });
});
