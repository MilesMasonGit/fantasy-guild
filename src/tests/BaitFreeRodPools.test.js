import { describe, it, expect } from 'vitest';

import { materialsOfToken } from '../systems/world/materials.js';
import { buildLedger, itemKey, HOW } from '../systems/progression/ledger/engine.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { poolKeyOf, catchPoolsOf } from '../config/registries/catchPools.js';
import { paceContent } from './fixtures/paceWorld.js';

/**
 * Only a Trap fishes with no bait (`catchPools.poolBites`): a rod pool naming no Bait never bites,
 * so the readers that say what water yields (world materials, the progression ledger, the CMS rate
 * calculator) read the baited rod pool and the Trap's bait-free catch, never the dead rod pool, and
 * a rod fish comes at the price of its Bait.
 *
 * Fixtures only: nothing here reads `data/`.
 */

const fish = (id, name, bait) => ({ id, name, type: 'food', fish: { level: 1, cycleMs: 8000, bait }, plan: { tier: 0 } });

const ITEMS = {
    bf_shrimp: fish('bf_shrimp', 'Shrimp', 0),
    bf_trout: fish('bf_trout', 'Trout', 2),
    bf_eel: fish('bf_eel', 'Eel', 1),
    bf_bait: { id: 'bf_bait', name: 'Bait', type: 'material', equipSlot: 'consumable', stackable: true, plan: { tier: 0 } },
    bf_rod: { id: 'bf_rod', name: 'Rod', type: 'tool', equipSlot: 'hand', tool: { kind: 'fishing_rod', tier: 1, starter: true } },
    bf_trap: { id: 'bf_trap', name: 'Trap', type: 'tool', equipSlot: 'hand', tool: { kind: 'fishing_trap', tier: 1, starter: true } }
};

/** A water with a Trap's bait-free pool, a baited rod pool and a rod pool naming no Bait. */
const LAKE = Object.freeze({
    id: 'bf_lake', name: 'Lake', uses: null,
    config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 8000, xp: 1, inputs: [], outputs: [] },
    catchPools: [
        { tool: 'fishing_trap', bait: null, catches: [{ itemId: 'bf_shrimp', weight: 1 }] },
        { tool: 'fishing_rod', bait: 'bf_bait', catches: [{ itemId: 'bf_trout', weight: 1 }] },
        { tool: 'fishing_rod', bait: null, catches: [{ itemId: 'bf_eel', weight: 1 }] }
    ]
});

/** A water whose only rod pool names no Bait, beside the Trap's. */
const DEAD_ROD = Object.freeze({
    ...LAKE, id: 'bf_dead', name: 'Dead Rod Water',
    catchPools: [
        { tool: 'fishing_trap', bait: null, catches: [{ itemId: 'bf_shrimp', weight: 1 }] },
        { tool: 'fishing_rod', bait: null, catches: [{ itemId: 'bf_eel', weight: 1 }] }
    ]
});

const poolKey = (def, i) => poolKeyOf(catchPoolsOf(def)[i]);

describe('world materials read only the pools that bite', () => {
    it('a rod reads its baited pool, the Trap its bait-free one, never a rod pool with no Bait', () => {
        expect(materialsOfToken(structuredClone(LAKE))).toEqual(['bf_shrimp', 'bf_trout']);
        expect(materialsOfToken(structuredClone(DEAD_ROD))).toEqual(['bf_shrimp']);
    });
});

describe('the progression ledger reads only the pools that bite', () => {
    const content = (water) => {
        const c = paceContent();
        Object.assign(c.items, structuredClone(ITEMS));
        c.tokens[water.id] = structuredClone(water);
        c.starterCamp.tokens.push({ typeId: water.id, x: 5, y: 0 });
        c.starterCamp.bank = { ...c.starterCamp.bank, bf_bait: 50 };
        return c;
    };
    const catchRules = (l, itemId) => l.world.rules.filter(r => r.how === HOW.CATCH && r.gives.some(g => g.key === itemKey(itemId)));

    it('the Trap\'s catch and the baited rod\'s are reached; the rod pool with no Bait lands nothing', () => {
        const l = buildLedger(content(LAKE));
        expect(l.reachOf(itemKey('bf_shrimp'))).toMatchObject({ tier: 0, how: HOW.CATCH });
        expect(l.reachOf(itemKey('bf_trout'))).toMatchObject({ tier: 0, how: HOW.CATCH });
        expect(l.reachOf(itemKey('bf_eel'))?.tier ?? null).toBeNull();
        expect(catchRules(l, 'bf_eel')).toEqual([]);
        expect(buildLedger(content(DEAD_ROD)).reachOf(itemKey('bf_eel'))?.tier ?? null).toBeNull();
    });

    it('a rod fish is caught at the price of its Bait; the Trap\'s spends none', () => {
        const l = buildLedger(content(LAKE));
        expect(catchRules(l, 'bf_trout').map(r => r.inputs)).toEqual([[{ key: itemKey('bf_bait'), quantity: 2 }]]);
        expect(catchRules(l, 'bf_shrimp').map(r => r.inputs)).toEqual([[]]);
    });
});

describe('the CMS rate calculator rates only the pools that bite', () => {
    const book = () => buildRateBook({ items: structuredClone(ITEMS), tokens: { bf_lake: structuredClone(LAKE), bf_dead: structuredClone(DEAD_ROD) } });

    it('lists the Trap\'s pool and the baited rod pool as work, never a rod pool with no Bait', () => {
        const targets = book().workTargets().filter(t => t.token === 'bf_lake' || t.token === 'bf_dead');
        expect(targets).toEqual([
            { token: 'bf_lake', pool: poolKey(LAKE, 0) },
            { token: 'bf_lake', pool: poolKey(LAKE, 1) },
            { token: 'bf_dead', pool: poolKey(DEAD_ROD, 0) }
        ]);
    });

    it('refuses the rod pool with no Bait, and a rod at a water whose rod pool takes none, as the game catches nothing there', () => {
        const b = book();
        expect(b.rateOf({ token: 'bf_lake', pool: poolKey(LAKE, 2) }, { tool: 'bf_rod', level: 1 }).ok).toBe(false);
        expect(b.rateOf({ token: 'bf_dead' }, { tool: 'bf_rod', level: 1 }).ok).toBe(false);
        expect(b.catchesOf({ token: 'bf_dead', pool: poolKey(DEAD_ROD, 1) })).toEqual([]);
    });

    it('a rod fish costs its Bait; the Trap\'s catch spends none', () => {
        const b = book();
        const trout = b.rateOf({ token: 'bf_lake', pool: poolKey(LAKE, 1) }, { tool: 'bf_rod', level: 1 });
        expect(trout.ok).toBe(true);
        expect(Object.keys(trout.perCycle)).toEqual(['bf_trout']);
        expect(trout.inputs.bf_bait / trout.cyclesPerHour).toBeCloseTo(2, 6);
        const shrimp = b.rateOf({ token: 'bf_lake', pool: poolKey(LAKE, 0) }, { tool: 'bf_trap', level: 1 });
        expect(shrimp.ok).toBe(true);
        expect(Object.keys(shrimp.perCycle)).toEqual(['bf_shrimp']);
        expect(shrimp.inputs.bf_bait ?? 0).toBe(0);
    });
});
