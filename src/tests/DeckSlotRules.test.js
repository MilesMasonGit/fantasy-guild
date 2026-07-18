import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { DeckSlotManager } from '../systems/loop/DeckSlotManager.js';

// CR-053: locks the card-movement rules (§5B/§5C) the fix waves will
// be deleting code around — ownership, Single-Copy, specialized tags,
// locked slots, and the ownership self-heal.

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => {
        const table = {
            t_mine: { id: 't_mine', name: 'Mine', cardType: 'task', config: { skill: 'labor', subskill: 'mining' }, tags: ['mining'] },
            t_fish: { id: 't_fish', name: 'Fish', cardType: 'task', config: { skill: 'aquatic', subskill: 'fishing' }, tags: ['fishing'] },
            t_fight: { id: 't_fight', name: 'Fight', cardType: 'combat', config: {}, tags: [] },
            t_forge: { id: 't_forge', name: 'Forge', cardType: 'station', config: {}, tags: [] }
        };
        return table[id] || null;
    }),
    CARD_TYPES: { TASK: 'task', COMBAT: 'combat', STATION: 'station' }
}));

vi.mock('../config/registries/cardConstants.js', () => ({
    CARD_TYPES: { TASK: 'task', COMBAT: 'combat', STATION: 'station' }
}));

vi.mock('../systems/area/HeroAssignmentManager.js', () => ({
    resetAreaLoop: vi.fn()
}));

const slots = () => GameState.state.areaStates.area_a.deckSlots;

function seedAreas() {
    GameState.initNew();
    GameState.state.collection.playsets = { t_mine: 1, t_fish: 1 };
    GameState.state.areaStates = {
        area_a: {
            deckSlots: [
                { templateId: null, slotType: 'regular', specializedTags: [], isLocked: false, progress: 0, status: 'idle' },
                { templateId: null, slotType: 'regular', specializedTags: [], isLocked: false, progress: 0, status: 'idle' },
                { templateId: null, slotType: 'specialized', specializedTags: ['mining'], isLocked: false, progress: 0, status: 'idle' },
                { templateId: null, slotType: 'locked', specializedTags: [], isLocked: true, progress: 0, status: 'idle' }
            ],
            stationState: { activeStationCardId: null }
        },
        area_b: {
            deckSlots: [
                { templateId: null, slotType: 'regular', specializedTags: [], isLocked: false, progress: 0, status: 'idle' }
            ],
            stationState: { activeStationCardId: null }
        }
    };
}

describe('DeckSlotManager rules (CR-053)', () => {
    beforeEach(seedAreas);

    it('slots an owned card', () => {
        expect(DeckSlotManager.slotCard('area_a', 0, 't_mine').success).toBe(true);
        expect(slots()[0].templateId).toBe('t_mine');
    });

    it('refuses a card the player does not own', () => {
        const r = DeckSlotManager.slotCard('area_a', 0, 't_fight');
        expect(r.success).toBe(false);
        expect(r.error).toMatch(/do not own/i);
    });

    it('enforces the Single-Copy Rule per area deck', () => {
        DeckSlotManager.slotCard('area_a', 0, 't_mine');
        const r = DeckSlotManager.slotCard('area_a', 1, 't_mine');
        expect(r.success).toBe(false);
        expect(r.error).toMatch(/one copy/i);
    });

    it('refuses to deploy more copies than are owned across areas', () => {
        DeckSlotManager.slotCard('area_a', 0, 't_mine');
        const r = DeckSlotManager.slotCard('area_b', 0, 't_mine');
        expect(r.success).toBe(false);
        expect(r.error).toMatch(/already deployed/i);
    });

    it('honors specialized slot tags', () => {
        expect(DeckSlotManager.slotCard('area_a', 2, 't_fish').success).toBe(false);
        expect(DeckSlotManager.slotCard('area_a', 2, 't_mine').success).toBe(true);
    });

    it('refuses locked slots for both slot and unslot', () => {
        expect(DeckSlotManager.slotCard('area_a', 3, 't_mine').success).toBe(false);
        expect(DeckSlotManager.unslotCard('area_a', 3).success).toBe(false);
    });

    it('station cards cannot go in deck slots', () => {
        GameState.state.collection.playsets.t_forge = 1;
        const r = DeckSlotManager.slotCard('area_a', 0, 't_forge');
        expect(r.success).toBe(false);
        expect(r.error).toMatch(/cannot go in deck slots/i);
    });

    it('unslotting frees the copy for another area', () => {
        DeckSlotManager.slotCard('area_a', 0, 't_mine');
        expect(DeckSlotManager.unslotCard('area_a', 0).success).toBe(true);
        expect(DeckSlotManager.slotCard('area_b', 0, 't_mine').success).toBe(true);
    });

    it('getAllocations reports owned/slotted/available', () => {
        DeckSlotManager.slotCard('area_a', 0, 't_mine');
        const alloc = DeckSlotManager.getAllocations('t_mine');
        expect(alloc.owned).toBe(1);
        expect(alloc.slotted).toEqual([{ areaId: 'area_a', slotIndex: 0 }]);
        expect(alloc.available).toBe(0);
    });

    it('swapSlots exchanges two slots when both fit', () => {
        DeckSlotManager.slotCard('area_a', 0, 't_mine');
        DeckSlotManager.slotCard('area_a', 1, 't_fish');
        expect(DeckSlotManager.swapSlots('area_a', 0, 1).success).toBe(true);
        expect(slots()[0].templateId).toBe('t_fish');
        expect(slots()[1].templateId).toBe('t_mine');
    });

    it('reconcileOwnership grants ownership for slotted-but-unowned cards', () => {
        slots()[0].templateId = 't_fight';   // authored default deck, never granted
        DeckSlotManager.reconcileOwnership();
        expect(GameState.state.collection.playsets.t_fight).toBe(1);
    });
});
