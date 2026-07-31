import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-area binders (D-3): a card's copies live in its own area's binder, and
// a card found in one region is usable only there (D-43).
const { collection, CARDS } = vi.hoisted(() => ({
    collection: { playsets: {}, binders: {} },
    CARDS: {
        // Two areas, each with its own pool.
        a_ore:    { id: 'a_ore',    cardType: 'task',  areaId: 'area_a' },
        a_fish:   { id: 'a_fish',   cardType: 'task',  areaId: 'area_a' },
        // A unique Boost — one copy is the whole playset (D-6/D-61).
        a_shrine: { id: 'a_shrine', cardType: 'boost', areaId: 'area_a', maxCopies: 1 },
        b_ore:    { id: 'b_ore',    cardType: 'task',  areaId: 'area_b' },
        // Not area-scoped: stays in the legacy global map until C-12.
        station:  { id: 'station',  cardType: 'station' }
    }
}));

vi.mock('../state/GameState.js', () => ({
    GameState: { state: { collection, areaStates: {} }, collection }
}));

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => CARDS[id] || null),
    getCardsByAreaSet: vi.fn((areaId) => Object.values(CARDS).filter(c => c.areaId === areaId))
}));

import { BinderManager } from '../systems/progression/BinderManager.js';
import { GameState } from '../state/GameState.js';

beforeEach(() => {
    collection.playsets = {};
    collection.binders = {};
    GameState.state.areaStates = {};
});

describe('where a card is owned', () => {
    it('routes an area-scoped card to its own area binder', () => {
        BinderManager.grantCopy('a_ore');
        expect(collection.binders.area_a.a_ore).toBe(1);
        expect(collection.playsets.a_ore).toBeUndefined();
    });

    it('routes a card with no home area to the global map', () => {
        expect(BinderManager.homeAreaOf('station')).toBeNull();
        BinderManager.grantCopy('station');
        expect(collection.playsets.station).toBe(1);
        expect(collection.binders.station).toBeUndefined();
    });

    it('keeps binders independent — the same id in two areas is two collections', () => {
        BinderManager.setOwned('a_ore', 3);
        BinderManager.setOwned('b_ore', 1);
        expect(BinderManager.getOwned('a_ore')).toBe(3);
        expect(BinderManager.getOwned('b_ore')).toBe(1);
        // Asking area_b for area_a's card sees nothing.
        expect(BinderManager.getOwned('a_ore', 'area_b')).toBe(0);
    });
});

describe('copy caps (D-13, D-61)', () => {
    it('caps an ordinary card at four', () => {
        const r = BinderManager.grantCopy('a_ore', 99);
        expect(r.owned).toBe(4);
        expect(r.granted).toBe(4);
        expect(r.full).toBe(true);
    });

    it('caps a unique at its authored maxCopies', () => {
        const r = BinderManager.grantCopy('a_shrine', 4);
        expect(r.owned).toBe(1);
        expect(r.max).toBe(1);
        expect(r.full).toBe(true);
    });

    it('grants nothing once full', () => {
        BinderManager.grantCopy('a_shrine');
        const second = BinderManager.grantCopy('a_shrine');
        expect(second.granted).toBe(0);
        expect(second.owned).toBe(1);
    });

    it('never stores a negative count', () => {
        expect(BinderManager.setOwned('a_ore', -5)).toBe(0);
    });
});

describe('pools and completion (D-13, D-44)', () => {
    it('lists an area pool from the card registry, not from ownership', () => {
        expect(BinderManager.getPool('area_a').sort()).toEqual(['a_fish', 'a_ore', 'a_shrine']);
        expect(BinderManager.getPool('area_b')).toEqual(['b_ore']);
    });

    it('excludes non-collectible types from the pool', () => {
        expect(BinderManager.getPool('area_a')).not.toContain('station');
    });

    it('reports completion in copies, counting a unique as one', () => {
        // 4 + 4 + 1 = 9 copies to complete area_a.
        expect(BinderManager.getCompletion('area_a')).toMatchObject({ owned: 0, total: 9, complete: false });
        BinderManager.setOwned('a_ore', 4);
        BinderManager.setOwned('a_fish', 4);
        expect(BinderManager.getCompletion('area_a')).toMatchObject({ owned: 8, total: 9, complete: false });
        BinderManager.setOwned('a_shrine', 1);
        expect(BinderManager.getCompletion('area_a')).toMatchObject({ owned: 9, total: 9, complete: true });
    });

    it('counts distinct cards collected as well as copies', () => {
        BinderManager.setOwned('a_ore', 1);
        expect(BinderManager.getCompletion('area_a')).toMatchObject({ cardsOwned: 1, cardsTotal: 3 });
    });

    it('drops a maxed card out of the pack pool, so packs always give something new', () => {
        expect(BinderManager.getIncompletePool('area_a').sort()).toEqual(['a_fish', 'a_ore', 'a_shrine']);
        BinderManager.setOwned('a_ore', 4);
        expect(BinderManager.getIncompletePool('area_a')).not.toContain('a_ore');
        BinderManager.setOwned('a_fish', 4);
        BinderManager.setOwned('a_shrine', 1);
        expect(BinderManager.getIncompletePool('area_a')).toEqual([]);
        expect(BinderManager.isComplete('area_a')).toBe(true);
    });

    it('a completed binder does not complete its neighbour', () => {
        BinderManager.setOwned('a_ore', 4);
        BinderManager.setOwned('a_fish', 4);
        BinderManager.setOwned('a_shrine', 1);
        expect(BinderManager.isComplete('area_a')).toBe(true);
        expect(BinderManager.isComplete('area_b')).toBe(false);
    });
});

describe('ownership self-heal', () => {
    it('grants ownership for starter cards that were slotted but never granted', () => {
        GameState.state.areaStates = {
            area_a: { deckSlots: [{ templateId: 'a_ore' }, { templateId: 'a_ore' }, {}, {}] }
        };
        BinderManager.reconcileOwnership();
        expect(BinderManager.getOwned('a_ore')).toBe(2);
    });

    it('leaves an already-sufficient binder alone', () => {
        BinderManager.setOwned('a_ore', 4);
        GameState.state.areaStates = { area_a: { deckSlots: [{ templateId: 'a_ore' }] } };
        BinderManager.reconcileOwnership();
        expect(BinderManager.getOwned('a_ore')).toBe(4);
    });

    it('never grants beyond the cap', () => {
        // Six slotted copies of a 4-cap card can only ever be four owned.
        GameState.state.areaStates = {
            area_a: { deckSlots: Array.from({ length: 6 }, () => ({ templateId: 'a_ore' })) }
        };
        BinderManager.reconcileOwnership();
        expect(BinderManager.getOwned('a_ore')).toBe(4);
    });
});
