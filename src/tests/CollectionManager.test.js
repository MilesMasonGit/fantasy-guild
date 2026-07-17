import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionManager } from '../systems/progression/CollectionManager.js';
import { GameState } from '../state/GameState.js';
import { CurrencyManager } from '../systems/economy/CurrencyManager.js';
import { UNIFIED_PACK } from '../config/loopConstants.js';

vi.mock('../state/GameState.js', () => ({
    GameState: {
        collection: { playsets: {}, unlockedAreaSets: [], globalPacksBought: 0 },
        currency: { gold: 0 }
    }
}));

vi.mock('../systems/economy/CurrencyManager.js', () => ({
    CurrencyManager: {
        spendGold: vi.fn(() => true)
    }
}));

vi.mock('../config/registries/areaSetRegistry.js', () => ({
    getAreaSet: vi.fn((id) => ({
        id,
        deckList: id === 'area_guild_hall'
            ? { logging: 4, well: 4, copper_mine: 4, bunk_bed: 1 }
            : { forest_task: 4 }
    }))
}));

describe('CollectionManager (unified packs, Phase 5 §5F/§5G)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        GameState.collection.playsets = {};
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

        it('excludes cards whose playset is capped', () => {
            GameState.collection.playsets = { logging: 4, bunk_bed: 1 };
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
            GameState.collection.playsets = { logging: 4, well: 4, copper_mine: 4, bunk_bed: 1 };
            const result = CollectionManager.buyUnifiedPack();
            expect(result.success).toBe(false);
            expect(result.error).toBe('SOLD_OUT');
        });

        it('offers fewer options when the pool is nearly exhausted', () => {
            GameState.collection.playsets = { logging: 4, well: 4 };
            const result = CollectionManager.buyUnifiedPack();
            expect(result.success).toBe(true);
            expect(result.options.sort()).toEqual(['bunk_bed', 'copper_mine']);
        });
    });

    describe('claimToCollection', () => {
        it('increments the playset by one', () => {
            const result = CollectionManager.claimToCollection('logging');
            expect(result.success).toBe(true);
            expect(GameState.collection.playsets.logging).toBe(1);
        });

        it('refuses a fifth copy', () => {
            GameState.collection.playsets = { logging: 4 };
            const result = CollectionManager.claimToCollection('logging');
            expect(result.success).toBe(false);
            expect(GameState.collection.playsets.logging).toBe(4);
        });
    });

    describe('isCardDiscovered', () => {
        it('is implicit from ownership (§5H)', () => {
            expect(CollectionManager.isCardDiscovered('logging')).toBe(false);
            GameState.collection.playsets.logging = 1;
            expect(CollectionManager.isCardDiscovered('logging')).toBe(true);
        });
    });
});
