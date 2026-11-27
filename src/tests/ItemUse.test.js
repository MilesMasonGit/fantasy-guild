import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ItemRateTracker } from '../systems/inventory/ItemRateTracker.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { useDropsOf, hasUse, useProblem } from '../config/registries/itemUse.js';
import { useItem, rollUse, ROLL_EACH_UP_TO } from '../systems/inventory/ItemUse.js';
import { useAmountOf } from '../ui/components/drawer/ItemUseControl.jsx';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { sameRolls } from './fixtures/rolls.js';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Using items (brief 400 B4): an item's Use, authored in the CMS as drops, pays them at once into
 * the Bank with no hero; each copy rolls every drop as a work cycle rolls its outputs, on the
 * game's seeded `Math.random`. A full Bank loses nothing: what it has no room for waits on the mat
 * as loot and the Bank Full banner says so.
 */

const NEST = {
    id: 'iu_nest', name: 'Use Nest', type: 'material', stackable: true,
    use: {
        drops: [
            { itemId: 'iu_seed', chance: 100, minQty: 1, maxQty: 2 },
            { itemId: 'iu_rare', chance: 25, minQty: 1, maxQty: 1 }
        ]
    }
};
registerItems({
    iu_nest: NEST,
    iu_seed: { id: 'iu_seed', name: 'Use Seed', type: 'material', stackable: true },
    iu_rare: { id: 'iu_rare', name: 'Use Rare Seed', type: 'material', stackable: true },
    iu_sure: { id: 'iu_sure', name: 'Use Crate', type: 'material', stackable: true, use: { drops: [{ itemId: 'iu_seed', minQty: 3, maxQty: 3 }] } },
    iu_fill: { id: 'iu_fill', name: 'Use Filler', type: 'material', stackable: true },
    iu_plain: { id: 'iu_plain', name: 'Use Plain', type: 'material', stackable: true },
    iu_broken: { id: 'iu_broken', name: 'Use Broken', type: 'material', stackable: true, use: { drops: [{ itemId: 'iu_missing', chance: 50 }] } },
    iu_empty: { id: 'iu_empty', name: 'Use Empty', type: 'material', stackable: true, use: { drops: [{ itemId: 'iu_seed', chance: 0 }, { minQty: 2 }] } }
});

SpriteLayer.init();

let rolls = null;
beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
    GameState.state.board.sprites = [];
    ItemRateTracker.clearAll();
});
afterEach(() => {
    rolls?.mockRestore();
    rolls = null;
});

const count = (id) => InventoryManager.getItemCount(id);
const onFloor = (id) => SpriteLayer.countOnBoard(id);

describe('an item\'s Use as the game reads it', () => {
    it('reads its drops: chance 100 and one of each when absent, whole amounts, a line that can never drop left out', () => {
        expect(useDropsOf(NEST)).toEqual([
            { itemId: 'iu_seed', chance: 100, minQty: 1, maxQty: 2 },
            { itemId: 'iu_rare', chance: 25, minQty: 1, maxQty: 1 }
        ]);
        expect(useDropsOf({ use: { drops: [{ itemId: 'a' }, { itemId: 'b', chance: 150, minQty: 3, maxQty: 1.7 }] } }))
            .toEqual([{ itemId: 'a', chance: 100, minQty: 1, maxQty: 1 }, { itemId: 'b', chance: 100, minQty: 1, maxQty: 3 }]);
        expect(useDropsOf({ use: { drops: [{ itemId: 'a', chance: 0 }, { chance: 50 }, { itemId: 'c', minQty: 0, maxQty: 0 }] } })).toEqual([]);
        expect(useDropsOf({})).toEqual([]);
        expect(useDropsOf(null)).toEqual([]);
        expect(hasUse(NEST)).toBe(true);
        expect(hasUse({ id: 'x' })).toBe(false);
    });

    it('a Use that gives nothing is an audit line; no Use, or one that gives, is none; a drop naming no item is named at boot', () => {
        expect(useProblem({})).toBeNull();
        expect(useProblem(NEST)).toBeNull();
        expect(useProblem({ use: { drops: [] } })).toMatch(/its Use gives nothing/);
        const lines = auditContent();
        expect(lines.some(f => f.where === 'Item "iu_broken"' && /Something its Use gives points at the item "iu_missing"/.test(f.what))).toBe(true);
        expect(lines.some(f => f.where === 'Item "iu_empty"' && /its Use gives nothing/.test(f.what))).toBe(true);
        expect(lines.some(f => f.where === 'Item "iu_nest"')).toBe(false);
    });
});

describe('the rolls', () => {
    it('each copy rolls each line: the chance first (only under 100), then the amount, on the random given', () => {
        // Copy 1: seed amount 0.9 → 2; rare chance 0.1 → lands, amount → 1. Copy 2: seed 0.2 → 1; rare 0.9 → misses.
        const stream = [0.9, 0.1, 0.5, 0.2, 0.9];
        const random = () => stream.shift();
        expect([...rollUse(useDropsOf(NEST), 2, random)]).toEqual([['iu_seed', 3], ['iu_rare', 1]]);
        expect(stream).toEqual([]);
    });

    it('are the game\'s seeded rolls: the same stream gives the same Use, another seed may not', () => {
        const run = (seed) => {
            GameState.state.inventory.items = {};
            InventoryManager.addItem('iu_nest', 40);
            rolls = sameRolls(seed);
            const result = useItem('iu_nest', 40);
            rolls.mockRestore();
            rolls = null;
            return result.paid;
        };
        const a = run(7);
        expect(run(7)).toEqual(a);
        // 40 copies: 40 to 80 seeds, about 10 rare ones.
        const seeds = a.find(p => p.itemId === 'iu_seed').quantity;
        expect(seeds).toBeGreaterThanOrEqual(40);
        expect(seeds).toBeLessThanOrEqual(80);
        expect([run(8), run(9), run(10)].some(p => JSON.stringify(p) !== JSON.stringify(a))).toBe(true);
    });

    it('past the roll-each limit, each line pays its expected amount made whole by chance', () => {
        const big = ROLL_EACH_UP_TO * 10;
        const out = rollUse(useDropsOf(NEST), big, () => 0.5);
        expect(out.get('iu_seed')).toBe(big * 1.5);
        expect(out.get('iu_rare')).toBe(big * 0.25);
        // At the limit, every copy still rolls.
        let draws = 0;
        rollUse(useDropsOf(NEST), ROLL_EACH_UP_TO, () => { draws++; return 0.99; });
        expect(draws).toBe(ROLL_EACH_UP_TO * 2);
    });
});

describe('a Use pays out at once, into the Bank, with no hero', () => {
    it('each amount the drawer offers: 1, 50 %, All -1 and All', () => {
        InventoryManager.addItem('iu_sure', 10);
        const amounts = ['one', 'half', 'allButOne', 'all'].map(p => useAmountOf(p, 10));
        expect(amounts).toEqual([1, 5, 9, 10]);
        // A sure 3 a copy: every amount pays exactly three times what it takes.
        let left = 10;
        let seeds = 0;
        for (const preset of ['one', 'half', 'allButOne', 'all']) {
            const n = useAmountOf(preset, left);
            const result = useItem('iu_sure', n);
            expect(result).toEqual({ itemId: 'iu_sure', used: n, paid: [{ itemId: 'iu_seed', quantity: 3 * n }], waiting: [] });
            left -= n;
            seeds += 3 * n;
            expect(count('iu_sure')).toBe(left);
            expect(count('iu_seed')).toBe(seeds);
            if (!left) break;
        }
        // 1, then half of 9 (5), then All -1 of 4 (3), then the last one.
        expect(left).toBe(0);
        expect(seeds).toBe(30);
        expect(GameState.state.inventory.items.iu_sure).toBeUndefined();
    });

    it('a stack of one: 50 % and All -1 are 1, as All is', () => {
        expect(['one', 'half', 'allButOne', 'all'].map(p => useAmountOf(p, 1))).toEqual([1, 1, 1, 1]);
        expect(useAmountOf('half', 7)).toBe(4);
    });

    it('uses at most what the Bank holds; none held, no Use, or nothing asked uses nothing', () => {
        InventoryManager.addItem('iu_sure', 2);
        expect(useItem('iu_sure', 50).used).toBe(2);
        expect(count('iu_sure')).toBe(0);
        expect(useItem('iu_sure', 1)).toBeNull();
        InventoryManager.addItem('iu_plain', 3);
        expect(useItem('iu_plain', 1)).toBeNull();
        expect(count('iu_plain')).toBe(3);
        InventoryManager.addItem('iu_nest', 3);
        expect(useItem('iu_nest', 0)).toBeNull();
        expect(useItem('iu_nest', -4)).toBeNull();
        expect(count('iu_nest')).toBe(3);
    });

    it('announces the Bank once for the whole Use: the copies taken, each drop given', () => {
        InventoryManager.addItem('iu_sure', 4);
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, p => heard.push(p));
        useItem('iu_sure', 4);
        off();
        expect(heard).toEqual([
            { itemId: 'iu_sure', amount: 0, removed: 4 },
            { itemId: 'iu_seed', amount: 12, added: 12 }
        ]);
    });

    it('counts in each item\'s per hour: the copies spent, the drops gained', () => {
        InventoryManager.addItem('iu_sure', 4);
        useItem('iu_sure', 4);
        expect(ItemRateTracker.getFlow('iu_seed')).toMatchObject({ gained: 12, spent: 0 });
        expect(ItemRateTracker.getFlow('iu_sure')).toMatchObject({ spent: 4 });
    });

    it('a drop naming an item that does not exist pays nothing; the rest still pay', () => {
        registerItems({ iu_half: { id: 'iu_half', name: 'Use Half', type: 'material', use: { drops: [{ itemId: 'iu_gone' }, { itemId: 'iu_seed' }] } } });
        InventoryManager.addItem('iu_half', 2);
        const result = useItem('iu_half', 2);
        expect(result.paid).toEqual([{ itemId: 'iu_seed', quantity: 2 }]);
        expect(count('iu_half')).toBe(0);
    });
});

describe('a full Bank loses nothing', () => {
    const fullBank = (slots) => {
        GameState.state.inventory.maxSlots = slots;
    };

    it('a drop with no slot waits on the mat as loot, the Bank Full banner says so, and the result names it', () => {
        fullBank(2);
        InventoryManager.addItem('iu_sure', 5);
        InventoryManager.addItem('iu_fill', 1);
        expect(InventoryManager.freeSlots()).toBe(0);
        const full = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.BANK_FULL, p => full.push(p));
        const result = useItem('iu_sure', 2);
        off();
        expect(count('iu_sure')).toBe(3);
        expect(count('iu_seed')).toBe(0);
        expect(onFloor('iu_seed')).toBe(6);
        expect(result.waiting).toEqual([{ itemId: 'iu_seed', quantity: 6 }]);
        expect(full).toEqual([{ itemId: 'iu_seed', reason: 'slots' }]);
        // Room made, the loot comes in like any other.
        InventoryManager.removeItem('iu_fill', 1);
        SpriteLayer.collectAll();
        expect(count('iu_seed')).toBe(6);
        expect(onFloor('iu_seed')).toBe(0);
    });

    it('using the last of a stack frees its slot for a drop: that one goes in, the next kind waits', () => {
        fullBank(2);
        InventoryManager.addItem('iu_nest', 4);
        InventoryManager.addItem('iu_fill', 1);
        rolls = sameRolls(11);
        const result = useItem('iu_nest', 4);
        const given = Object.fromEntries(result.paid.map(p => [p.itemId, p.quantity]));
        expect(count('iu_nest')).toBe(0);
        // The seeds come first and take the freed slot.
        expect(count('iu_seed')).toBe(given.iu_seed);
        expect(onFloor('iu_seed')).toBe(0);
        if (given.iu_rare) {
            expect(count('iu_rare')).toBe(0);
            expect(onFloor('iu_rare')).toBe(given.iu_rare);
            expect(result.waiting).toEqual([{ itemId: 'iu_rare', quantity: given.iu_rare }]);
        }
        // Nothing went missing: every copy's drops are in the Bank or on the mat.
        for (const [id, n] of Object.entries(given)) expect(count(id) + onFloor(id)).toBe(n);
    });

    it('a stack already held always has room: only new kinds can wait', () => {
        fullBank(2);
        InventoryManager.addItem('iu_sure', 5);
        InventoryManager.addItem('iu_seed', 1);
        const result = useItem('iu_sure', 5);
        expect(result.waiting).toEqual([]);
        expect(count('iu_seed')).toBe(16);
    });
});
