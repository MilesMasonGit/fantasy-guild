import { describe, it, expect } from 'vitest';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { buildWorld, computeReach, itemKey, tokenKey, HOW } from '../systems/progression/ledger/engine.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * The ledger reads a Token's rare drop table (brief 590 P3) as it reads chance lines: the reach
 * engine (the CMS ledger and the Encyclopedia) gives each find at its own chance, the table's times
 * its share; the rate calculator counts each find a cycle, Lucky widening the table. A find only a
 * rare table gives is judged as a chance line is: by finds a day on repeatable work.
 */

const provides = (id, type, bucket, value, to) => ({ id: `stm_${id}`, keyword: 'provides', to, reach: 'nearby', payload: { type, bucket, value } });
const item = (id) => ({ id, name: id, type: 'material', stackable: true, equipSlot: '' });
const ITEMS = Object.fromEntries(['lr_ore', 'lr_gem', 'lr_pearl', 'lr_bone'].map(id => [id, item(id)]));
const TABLE = { chance: 0.4, entries: [{ itemId: 'lr_gem', weight: 3, minQty: 1, maxQty: 1 }, { itemId: 'lr_pearl', weight: 1, minQty: 2, maxQty: 2 }] };
const TOKENS = {
    lr_vein: {
        id: 'lr_vein', name: 'LR Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', tags: ['Ore'], uses: null, requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3600, xp: 1, inputs: [], outputs: [{ itemId: 'lr_ore', chance: 100, minQty: 1, maxQty: 1 }] },
        rareTable: TABLE
    },
    lr_rat: {
        id: 'lr_rat', name: 'LR Rat', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, requiresHero: true, enemy: { level: 1, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] },
        rareTable: { chance: 10, entries: [{ itemId: 'lr_bone', weight: 1, minQty: 1, maxQty: 1 }] }
    },
    lr_charm: {
        id: 'lr_charm', name: 'LR Charm', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, requiresHero: false, config: null,
        statements: [provides('lr_charm', EFFECT_TYPES.LUCKY, 'percentage', 1, { mode: 'id', value: 'lr_vein' })]
    }
};
const CAMP = { tokens: [{ typeId: 'lr_vein', x: 400, y: 400 }, { typeId: 'lr_rat', x: 700, y: 400 }] };
const content = () => ({ tokens: TOKENS, items: ITEMS, recipes: [], effects: {}, starterCamp: CAMP });

describe('the reach engine (the CMS ledger, the Encyclopedia)', () => {
    it('gives each find at its own chance beside the Token\'s own lines, an enemy\'s beside its loot', () => {
        const world = buildWorld(content());
        const work = world.rules.find(r => r.id === 'work:lr_vein');
        expect(work.how).toBe(HOW.WORK);
        const round = (n) => Math.round(n * 1e9) / 1e9;
        expect(work.gives.map(g => [g.key, round(g.chance), round(g.perCycle)])).toEqual([
            [itemKey('lr_ore'), 1, 1],
            [itemKey('lr_gem'), 0.003, 0.003],
            [itemKey('lr_pearl'), 0.001, 0.002]
        ]);
        // An enemy with no loot lines still drops its rare find.
        const drop = world.rules.find(r => r.id === 'drop:lr_rat');
        expect(drop.gives).toEqual([{ key: itemKey('lr_bone'), chance: 0.1, perCycle: 0.1 }]);
    });

    it('a find only a rare table gives is judged by finds a day, as a chance line is', () => {
        const reach = computeReach(buildWorld(content()));
        // 0.3 % on a 3.6 s cycle: 72 a day, a steady source.
        expect(reach.get(itemKey('lr_gem'))).toMatchObject({ tier: 0, sureTier: 0, luckOnly: false, rareOnly: false, via: tokenKey('lr_vein') });
        expect(reach.get(itemKey('lr_gem')).findsPerDay).toBeCloseTo(72, 6);
        expect(reach.get(itemKey('lr_gem')).chance).toBeCloseTo(0.003, 9);
        expect(reach.get(itemKey('lr_ore'))).toMatchObject({ tier: 0, luckOnly: false });
        // 10 % is above the luck line: a sure way, as a 10 % chance line would be.
        expect(reach.get(itemKey('lr_bone'))).toMatchObject({ tier: 0, luckOnly: false });
    });
});

describe('the rate calculator', () => {
    it('counts each find a cycle at its share of the table\'s chance', () => {
        const r = buildRateBook(content()).rateOf({ token: 'lr_vein' });
        expect(r.ok).toBe(true);
        // 1,000 cycles an hour: 0.3 % Gems, 0.1 % twice-Pearls.
        expect(r.items.lr_gem).toBeCloseTo(3, 6);
        expect(r.items.lr_pearl).toBeCloseTo(2, 6);
        expect(r.unmodelled.some(u => u.what === EFFECT_TYPES.LUCKY)).toBe(false);
    });

    it('widens the table by Lucky in reach: +100 % doubles every find', () => {
        const r = buildRateBook(content()).rateOf({ token: 'lr_vein' }, { supports: ['lr_charm'] });
        expect(r.items.lr_gem).toBeCloseTo(6, 6);
        expect(r.items.lr_pearl).toBeCloseTo(4, 6);
        expect(r.items.lr_ore).toBeCloseTo(1000, 6);
    });
});
