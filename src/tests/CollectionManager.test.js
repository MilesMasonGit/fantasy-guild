import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionManager } from '../systems/progression/CollectionManager.js';
import { GameState } from '../state/GameState.js';
import * as CardManager from '../systems/cards/CardManager.js';
import * as areaSetRegistry from '../config/registries/areaSetRegistry.js';
import * as questRegistry from '../config/registries/questRegistry.js';

vi.mock('../state/GameState.js', () => ({
    GameState: {
        collection: { playsets: {}, packsBought: {} },
        areaStates: {},
        cards: { active: [] }
    }
}));

vi.mock('../systems/cards/CardManager.js', () => ({
    getActiveCards: vi.fn(() => []),
    getCard: vi.fn((id) => ({ id, cardType: id.startsWith('quest') ? 'quest' : 'task' })),
    createCard: vi.fn((id, options) => ({ 
        success: true, 
        card: { id: 'instance_1', templateId: id, location: options.overrides?.location || 'board' } 
    }))
}));

vi.mock('../config/registries/areaSetRegistry.js', () => ({
    getAreaSet: vi.fn((id) => ({
        id,
        deckList: { logging: 4, well: 4, copper_mine: 4, bunk_bed: 1 }
    })),
    getPackCost: vi.fn(() => 50)
}));

vi.mock('../config/registries/questRegistry.js', () => ({
    getAreaQuests: vi.fn((id) => [
        { id: 'quest_1', name: 'Quest 1' },
        { id: 'quest_2', name: 'Quest 2' }
    ])
}));

describe('CollectionManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        GameState.collection.playsets = {};
        GameState.areaStates = {
            area_guild_hall: { completedQuestIds: [] }
        };
        CardManager.getActiveCards.mockReturnValue([]);
    });

    describe('generatePackOptions', () => {
        it('should generate up to 4 unique options', () => {
            const options = CollectionManager.generatePackOptions('area_guild_hall');
            expect(options.length).toBe(4);
            const uniqueOptions = new Set(options);
            expect(uniqueOptions.size).toBe(options.length);
        });

        it('should exclude completed quests', () => {
            GameState.areaStates.area_guild_hall.completedQuestIds = ['quest_1'];
            const options = CollectionManager.generatePackOptions('area_guild_hall');
            expect(options).not.toContain('quest_1');
        });

        it('should exclude cards already at max playset', () => {
            GameState.collection.playsets = { logging: 4 };
            const options = CollectionManager.generatePackOptions('area_guild_hall');
            expect(options).not.toContain('logging');
        });

        it('should exclude quests already on board', () => {
            CardManager.getActiveCards.mockReturnValue([{ templateId: 'quest_1' }]);
            const options = CollectionManager.generatePackOptions('area_guild_hall');
            expect(options).not.toContain('quest_1');
        });

        it('should handle small pools by showing only remaining unique types', () => {
            GameState.collection.playsets = {
                logging: 4,
                well: 4,
                copper_mine: 4
            };
            // Only bunk_bed (1) and quest_1, quest_2 are left = 3 total unique types
            const options = CollectionManager.generatePackOptions('area_guild_hall');
            expect(options.length).toBe(3);
        });
    });

    describe('claimCard', () => {
        it('should increment playset for cards', () => {
            CollectionManager.claimCard('logging', 'area_guild_hall');
            expect(GameState.collection.playsets['logging']).toBe(1);
        });

        it('should NOT increment playset for quests (not in deckList)', () => {
            CollectionManager.claimCard('quest_1', 'area_guild_hall');
            expect(GameState.collection.playsets['quest_1']).toBeUndefined();
        });

        it('should start cards in library and quests on board', () => {
            const cardResult = CollectionManager.claimCard('logging', 'area_guild_hall');
            expect(cardResult.card.location).toBe('library');

            const questResult = CollectionManager.claimCard('quest_1', 'area_guild_hall');
            expect(questResult.card.location).toBe('board');
        });
    });

    describe('checkAreaExhaustion', () => {
        it('should return false if cards or quests are remaining', () => {
            expect(CollectionManager.checkAreaExhaustion('area_guild_hall')).toBe(false);
        });

        it('should return true if all cards maxed and all quests done/owned', () => {
            GameState.collection.playsets = {
                logging: 4,
                well: 4,
                copper_mine: 4,
                bunk_bed: 1
            };
            GameState.areaStates.area_guild_hall.completedQuestIds = ['quest_1'];
            CardManager.getActiveCards.mockReturnValue([{ templateId: 'quest_2' }]);
            
            expect(CollectionManager.checkAreaExhaustion('area_guild_hall')).toBe(true);
        });
    });
});
