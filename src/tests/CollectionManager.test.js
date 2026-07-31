import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionManager } from '../systems/progression/CollectionManager.js';
import { GameState } from '../state/GameState.js';
import { CurrencyManager } from '../systems/economy/CurrencyManager.js';
import { UNIFIED_PACK } from '../config/loopConstants.js';

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
    collection: { playsets: {}, binders: {}, unlockedAreaSets: [], globalPacksBought: 0 },
    CARDS: {
        logging:     { id: 'logging',     cardType: 'task', areaId: 'area_guild_hall' },
        well:        { id: 'well',        cardType: 'task', areaId: 'area_guild_hall' },
        copper_mine: { id: 'copper_mine', cardType: 'task', areaId: 'area_guild_hall' },
        // A unique — maxCopies 1, so one copy completes it (D-61).
        bunk_bed:    { id: 'bunk_bed',    cardType: 'task', areaId: 'area_guild_hall', isUnique: true },
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
    CurrencyManager: {
        spendGold: vi.fn(() => true)
    }
}));

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => CARDS[id] || null),
    getCardsByAreaSet: vi.fn((areaId) => Object.values(CARDS).filter(c => c.areaId === areaId))
}));

describe('CollectionManager (unified packs, Phase 5 §5F/§5G)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        GameState.collection.playsets = {};
        GameState.collection.binders = {};
        GameState.collection.unlockedAreaSets = ['area_guild_hall'];
        GameState.collection.globalPacksBought = 0;
        GameState.currency.gold = 1000;
        CurrencyManager.spendGold.mockReturnValue(true);
    });

    describe('getUnifiedPool', () => {
        it('pools every card from unlocked areas', () => {
            const pool = CollectionManager.getUnifiedPool();
            expect(pool.sort()).toEqual(['bunk_bed', 'copper_mine', 'logging', 'well']);
        });

        it('spans multiple unlocked areas', () => {
            GameState.collection.unlockedAreaSets = ['area_guild_hall', 'area_whispering_woods'];
            const pool = CollectionManager.getUnifiedPool();
            expect(pool).toContain('forest_task');
            expect(pool).toContain('logging');
        });

        it('excludes cards whose copies are all owned', () => {
            GameState.collection.binders = { area_guild_hall: { logging: 4, bunk_bed: 1 } };
            const pool = CollectionManager.getUnifiedPool();
            expect(pool).not.toContain('logging');
            expect(pool).not.toContain('bunk_bed');
            expect(pool).toContain('well');
        });
    });

    describe('buyUnifiedPack', () => {
        it('succeeds, returns up to 4 unique options, and bumps the counter', () => {
            const result = CollectionManager.buyUnifiedPack();
            expect(result.success).toBe(true);
            expect(result.options.length).toBe(4);
            expect(new Set(result.options).size).toBe(4);
            expect(GameState.collection.globalPacksBought).toBe(1);
        });

        it('scales cost by globalPacksBought', () => {
            expect(CollectionManager.getUnifiedPackCost()).toBe(UNIFIED_PACK.BASE_COST);
            GameState.collection.globalPacksBought = 3;
            expect(CollectionManager.getUnifiedPackCost()).toBe(UNIFIED_PACK.BASE_COST + 3 * UNIFIED_PACK.COST_SCALING);
        });

        it('fails with insufficient gold', () => {
            GameState.currency.gold = 0;
            const result = CollectionManager.buyUnifiedPack();
            expect(result.success).toBe(false);
            expect(result.error).toBe('INSUFFICIENT_GOLD');
        });

        it('fails as SOLD_OUT when everything is capped', () => {
            GameState.collection.binders = { area_guild_hall: { logging: 4, well: 4, copper_mine: 4, bunk_bed: 1 } };
            const result = CollectionManager.buyUnifiedPack();
            expect(result.success).toBe(false);
            expect(result.error).toBe('SOLD_OUT');
        });

        it('offers fewer options when the pool is nearly exhausted', () => {
            GameState.collection.binders = { area_guild_hall: { logging: 4, well: 4 } };
            const result = CollectionManager.buyUnifiedPack();
            expect(result.success).toBe(true);
            expect(result.options.sort()).toEqual(['bunk_bed', 'copper_mine']);
        });
    });

    describe('claimToCollection', () => {
        it('increments the owned count in that card\'s area binder', () => {
            const result = CollectionManager.claimToCollection('logging');
            expect(result.success).toBe(true);
            expect(GameState.collection.binders.area_guild_hall.logging).toBe(1);
        });

        it('refuses a fifth copy', () => {
            GameState.collection.binders = { area_guild_hall: { logging: 4 } };
            const result = CollectionManager.claimToCollection('logging');
            expect(result.success).toBe(false);
            expect(GameState.collection.binders.area_guild_hall.logging).toBe(4);
        });
    });

    describe('isCardDiscovered', () => {
        it('is implicit from ownership (§5H)', () => {
            expect(CollectionManager.isCardDiscovered('logging')).toBe(false);
            GameState.collection.binders = { area_guild_hall: { logging: 1 } };
            expect(CollectionManager.isCardDiscovered('logging')).toBe(true);
        });
    });
});
