import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileLocation, canWithdraw, performReclaim } from '../systems/cards/LibraryManager.js';
import { GameState } from '../state/GameState.js';
import * as CardManager from '../systems/cards/CardManager.js';

// Mock dependencies
vi.mock('../state/GameState.js', () => ({
    GameState: {
        state: {
            collection: { playsets: {} },
            cards: { active: [], limits: { boardMax: 5 } },
            ui: { activeAreaId: 'area_guild_hall' },
            areaStates: {}
        },
        uncacheCard: vi.fn(),
        getCardById: vi.fn()
    }
}));

vi.mock('../systems/cards/CardManager.js', () => ({
    discardCard: vi.fn(() => ({ success: true }))
}));

describe('LibraryManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset state for each test
        GameState.state = {
            collection: { playsets: { logging: 3, mining: 1 } },
            cards: { active: [], limits: { boardMax: 5 } },
            ui: { activeAreaId: 'area_guild_hall' },
            areaStates: {
                area_whispering_woods: { cardSnapshots: [] }
            }
        };
    });

    describe('reconcileLocation', () => {
        it('should show available pips if not on board', () => {
            const pips = reconcileLocation('logging');
            expect(pips.filter(p => p.status === 'available')).toHaveLength(3);
            expect(pips.filter(p => p.status === 'undiscovered')).toHaveLength(1);
        });

        it('should detect cards on active board', () => {
            GameState.state.cards.active = [
                { templateId: 'logging', id: 'c1' },
                { templateId: 'mining', id: 'c2' }
            ];

            const loggingPips = reconcileLocation('logging');
            expect(loggingPips[0]).toEqual({ status: 'in-use', areaId: 'area_guild_hall' });
            expect(loggingPips.filter(p => p.status === 'available')).toHaveLength(2);

            const miningPips = reconcileLocation('mining');
            expect(miningPips[0]).toEqual({ status: 'in-use', areaId: 'area_guild_hall' });
            expect(miningPips.filter(p => p.status === 'available')).toHaveLength(0);
            expect(miningPips.filter(p => p.status === 'undiscovered')).toHaveLength(3);
        });

        it('should detect cards in snapshots', () => {
            GameState.state.areaStates.area_whispering_woods.cardSnapshots = [
                { templateId: 'logging' }
            ];

            const pips = reconcileLocation('logging');
            expect(pips.find(p => p.areaId === 'area_whispering_woods')).toBeDefined();
            expect(pips.filter(p => p.status === 'in-use')).toHaveLength(1);
            expect(pips.filter(p => p.status === 'available')).toHaveLength(2);
        });

        it('should handle complex mixed locations', () => {
            GameState.state.cards.active = [{ templateId: 'logging' }];
            GameState.state.areaStates.area_whispering_woods.cardSnapshots = [{ templateId: 'logging' }];

            const pips = reconcileLocation('logging');
            expect(pips.filter(p => p.status === 'in-use')).toHaveLength(2);
            expect(pips.filter(p => p.status === 'available')).toHaveLength(1);
            expect(pips[2].status).toBe('available');
        });
    });

    describe('canWithdraw', () => {
        it('should allow withdrawal if board space and card available', () => {
            expect(canWithdraw('logging')).toBe(true);
        });

        it('should deny if board is full', () => {
            GameState.state.cards.active = new Array(5).fill({ templateId: 'junk' });
            expect(canWithdraw('logging')).toBe(false);
        });

        it('should deny if all copies are in-use', () => {
            GameState.state.collection.playsets.mining = 1;
            GameState.state.cards.active = [{ templateId: 'mining' }];
            expect(canWithdraw('mining')).toBe(false);
        });
    });

    describe('performReclaim', () => {
        it('should reclaim from active area using CardManager', () => {
            GameState.state.cards.active = [
                { id: 'c1', templateId: 'logging' }
            ];

            const result = performReclaim('logging', 'area_guild_hall');

            expect(result.success).toBe(true);
            expect(CardManager.discardCard).toHaveBeenCalledWith('c1');
        });

        it('should reclaim from hibernated area snapshots', () => {
            GameState.state.areaStates.area_whispering_woods.cardSnapshots = [
                { templateId: 'logging' }
            ];

            const result = performReclaim('logging', 'area_whispering_woods');

            expect(result.success).toBe(true);
            expect(GameState.state.areaStates.area_whispering_woods.cardSnapshots).toHaveLength(0);
        });

        it('should return error if card not found', () => {
            const result = performReclaim('mining', 'area_guild_hall');
            expect(result.success).toBe(false);
            expect(result.error).toBe('CARD_NOT_FOUND_IN_AREA');
        });
    });
});
