import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionManager } from '../systems/progression/CollectionManager.js';
import { GameState } from '../state/GameState.js';
import { CurrencyManager } from '../systems/economy/CurrencyManager.js';
import { AREA_PACK } from '../config/loopConstants.js';

// `vi.hoisted` because vi.mock factories are hoisted above normal top-level
// consts — without it the factory can't see these.
//
// One collection object, reachable both as `GameState.collection` (what
// CollectionManager uses) and `GameState.state.collection` (what
// BinderManager uses), so binder writes are visible to both.
//
// Cards carry their own home area (D-3); pools come from the card registry
// rather than an area's authored deckList.
const { collection, CARDS } = vi.hoisted(() => ({
    collection: { playsets: {}, binders: {}, unlockedAreaSets: [], areaPacksBought: {} },
    CARDS: {
        logging:     { id: 'logging',     cardType: 'task', areaId: 'area_guild_hall' },
        well:        { id: 'well',        cardType: 'task', areaId: 'area_guild_hall' },
        copper_mine: { id: 'copper_mine', cardType: 'task', areaId: 'area_guild_hall' },
        // A Boost — maxCopies 1 (D-61). Its rarity is emergent: one copy
        // against everything else's four.
        altar:       { id: 'altar',       cardType: 'boost', areaId: 'area_guild_hall', isUnique: true, maxCopies: 1 },
        forest_task: { id: 'forest_task', cardType: 'task', areaId: 'area_whispering_woods' }
    }
}));

vi.mock('../state/GameState.js', () => ({
    GameState: {
        collection,
        currency: { gold: 0 },
        state: { collection, areaStates: {} }
    }
}));

vi.mock('../systems/economy/CurrencyManager.js', () => ({
    CurrencyManager: { spendGold: vi.fn(() => true) }
}));

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => CARDS[id] || null),
    getCardsByAreaSet: vi.fn((areaId) => Object.values(CARDS).filter(c => c.areaId === areaId))
}));

vi.mock('../config/registries/areaSetRegistry.js', () => ({
    getAreaSet: vi.fn((id) => (id === 'area_whispering_woods' ? { id, packBaseline: 5000 } : { id }))
}));

const GH = 'area_guild_hall';
const WW = 'area_whispering_woods';

describe('CollectionManager — per-area packs (C-14, D-13/D-32/D-46)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        GameState.collection.playsets = {};
        GameState.collection.binders = {};
        GameState.collection.unlockedAreaSets = [GH];
        GameState.collection.areaPacksBought = {};
        GameState.collection.pendingPackOptions = [];
        GameState.collection.pendingPackAreaId = null;
        GameState.currency.gold = 1_000_000;
        CurrencyManager.spendGold.mockReturnValue(true);
    });

    describe('cost curve (D-32)', () => {
        it('starts at the area baseline and grows geometrically', () => {
            expect(CollectionManager.getPackCost(GH)).toBe(AREA_PACK.DEFAULT_BASELINE);

            GameState.collection.areaPacksBought[GH] = 1;
            expect(CollectionManager.getPackCost(GH)).toBe(120);   // 100 × 1.2

            GameState.collection.areaPacksBought[GH] = 2;
            expect(CollectionManager.getPackCost(GH)).toBe(144);   // and compounding
        });

        it('runs each area on its OWN counter', () => {
            GameState.collection.unlockedAreaSets = [GH, WW];
            GameState.collection.areaPacksBought[GH] = 5;

            // Buying in the Guild Hall must not raise the Woodland price.
            expect(CollectionManager.getPacksBought(WW)).toBe(0);
            expect(CollectionManager.getPackCost(WW)).toBe(5000);
        });

        it('expresses TIER as the baseline, not the curve', () => {
            // Same growth everywhere; the first pack is what differs by region.
            expect(CollectionManager.getAreaBaseline(GH)).toBe(100);
            expect(CollectionManager.getAreaBaseline(WW)).toBe(5000);
        });
    });

    describe('pool contents (D-46)', () => {
        it('contains only this area native cards', () => {
            GameState.collection.unlockedAreaSets = [GH, WW];
            const pool = CollectionManager.getAreaPool(GH);
            expect(pool).not.toContain('forest_task');
            expect(pool).toContain('logging');
        });

        it('drops a card once every copy is owned (D-13)', () => {
            GameState.collection.binders[GH] = { logging: 4 };
            expect(CollectionManager.getAreaPool(GH)).not.toContain('logging');
        });

        it('reports exhaustion only when nothing is left', () => {
            expect(CollectionManager.isAreaExhausted(GH)).toBe(false);

            GameState.collection.binders[GH] = { logging: 4, well: 4, copper_mine: 4, altar: 1 };
            expect(CollectionManager.isAreaExhausted(GH)).toBe(true);
        });
    });

    describe('emergent rarity (supersedes D-14 pity)', () => {
        it('weights the pool by copies still owed', () => {
            const pool = CollectionManager.getAreaPool(GH);

            // A regular card owes 4 copies, the Boost owes 1 — so the Boost is
            // four times rarer with no rarity table and no pity counter.
            expect(pool.filter(id => id === 'logging')).toHaveLength(4);
            expect(pool.filter(id => id === 'altar')).toHaveLength(1);
        });

        it('raises the Boost odds as regular cards fill up', () => {
            const share = () => {
                const pool = CollectionManager.getAreaPool(GH);
                return pool.filter(id => id === 'altar').length / pool.length;
            };
            const early = share();                                  // 1 of 13

            GameState.collection.binders[GH] = { logging: 4, well: 4 };
            const late = share();                                   // 1 of 5

            // The anti-lockout property a pity counter existed to provide,
            // arriving for free out of the same rule.
            expect(late).toBeGreaterThan(early);
        });

        it('never offers the same card twice in one pack', () => {
            for (let i = 0; i < 30; i++) {
                const options = CollectionManager.generatePackOptions(GH);
                expect(new Set(options).size).toBe(options.length);
            }
        });

        it('offers fewer options than usual when the pool is nearly dry', () => {
            GameState.collection.binders[GH] = { logging: 4, well: 4, copper_mine: 4 };
            expect(CollectionManager.generatePackOptions(GH)).toEqual(['altar']);
        });
    });

    describe('buying', () => {
        it('charges the area price and bumps only that area counter', () => {
            const result = CollectionManager.buyAreaPack(GH);

            expect(result.success).toBe(true);
            expect(result.cost).toBe(100);
            expect(CurrencyManager.spendGold).toHaveBeenCalledWith(100, expect.stringContaining(GH));
            expect(GameState.collection.areaPacksBought[GH]).toBe(1);
            expect(GameState.collection.areaPacksBought[WW]).toBeUndefined();
        });

        it('refuses a locked area', () => {
            expect(CollectionManager.buyAreaPack(WW)).toEqual({ success: false, error: 'AREA_LOCKED' });
        });

        it('refuses when the binder is complete', () => {
            GameState.collection.binders[GH] = { logging: 4, well: 4, copper_mine: 4, altar: 1 };
            expect(CollectionManager.buyAreaPack(GH)).toEqual({ success: false, error: 'SOLD_OUT' });
        });

        it('refuses when gold is short, without spending', () => {
            GameState.currency.gold = 10;
            expect(CollectionManager.buyAreaPack(GH)).toEqual({ success: false, error: 'INSUFFICIENT_GOLD' });
            expect(CurrencyManager.spendGold).not.toHaveBeenCalled();
            expect(GameState.collection.areaPacksBought[GH]).toBeUndefined();
        });

        it('remembers which area an unclaimed pack came from (CR-040)', () => {
            CollectionManager.buyAreaPack(GH);

            // The gold is already spent, so a reload must be able to reopen
            // the right pack rather than vaporizing it.
            expect(CollectionManager.getPendingPackOptions().length).toBeGreaterThan(0);
            expect(CollectionManager.getPendingPackAreaId()).toBe(GH);
        });

        it('clears the pending pack once a card is claimed', () => {
            CollectionManager.buyAreaPack(GH);
            CollectionManager.claimToCollection('logging');

            expect(CollectionManager.getPendingPackOptions()).toEqual([]);
            expect(CollectionManager.getPendingPackAreaId()).toBeNull();
        });
    });

    describe('claiming', () => {
        it('grants one copy into the card own area binder', () => {
            const result = CollectionManager.claimToCollection('logging');
            expect(result.success).toBe(true);
            expect(GameState.collection.binders[GH].logging).toBe(1);
        });

        it('refuses a card already at its cap', () => {
            GameState.collection.binders[GH] = { altar: 1 };
            const result = CollectionManager.claimToCollection('altar');
            expect(result.success).toBe(false);
        });
    });
});
