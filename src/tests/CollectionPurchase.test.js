import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { CollectionManager } from '../systems/progression/CollectionManager.js';
import * as CardManager from '../systems/cards/CardManager.js';

// Mock EventBus
vi.mock('../systems/core/EventBus.js', () => ({
    EventBus: {
        publish: vi.fn()
    }
}));
vi.mock('../systems/cards/CardManager.js', () => ({
    getActiveCards: vi.fn(() => []),
    getCard: vi.fn((id) => ({ id, cardType: id.includes('quest') ? 'quest' : 'task' })),
    createCard: vi.fn((id) => ({ success: true, card: { id: 'instance-1', templateId: id } }))
}));

describe('CollectionManager Purchase Logic', () => {
    beforeEach(() => {
        GameState.initNew();
        GameState.state.collection.playsets = {};
        GameState.state.collection.packsBought = {};
        GameState.state.currency.gold = 1000;
        GameState.state.cards.active = [];
        GameState.state.cards.limits = { max: 12 };
        GameState.state.ui.activeAreaId = 'area_guild_hall';
    });

    it('should successfully buy a pack', () => {
        const cost = CollectionManager.getPackCost('area_guild_hall');
        const result = CollectionManager.buyPack('area_guild_hall');
        
        expect(result.success).toBe(true);
        expect(GameState.state.currency.gold).toBe(1000 - cost);
        expect(GameState.state.collection.packsBought['area_guild_hall']).toBe(1);
        expect(CardManager.createCard).toHaveBeenCalledWith('booster_pack', expect.any(Object));
    });

    it('should fail if insufficient gold', () => {
        GameState.state.currency.gold = 2; // Less than base cost 5
        const result = CollectionManager.buyPack('area_guild_hall');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('INSUFFICIENT_GOLD');
        expect(GameState.state.currency.gold).toBe(2);
    });

    it('should fail if board is full', () => {
        GameState.state.cards.active = new Array(12).fill({});
        const result = CollectionManager.buyPack('area_guild_hall');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('BOARD_FULL');
    });

    it('should scale cost correctly', () => {
        GameState.state.collection.packsBought['area_guild_hall'] = 2;
        const expectedCost = CollectionManager.getPackCost('area_guild_hall');
        const result = CollectionManager.buyPack('area_guild_hall');
        
        expect(GameState.state.currency.gold).toBe(1000 - expectedCost);
        expect(GameState.state.collection.packsBought['area_guild_hall']).toBe(3);
    });

    it('should fail if area is exhausted', () => {
        // Mock exhaustion
        vi.spyOn(CollectionManager, 'checkAreaExhaustion').mockReturnValue(true);
        
        const result = CollectionManager.buyPack('area_guild_hall');
        expect(result.success).toBe(false);
        expect(result.error).toBe('AREA_EXHAUSTED');
    });
});
