import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BinderMastery from '../systems/progression/BinderMastery.js';
import { getAreaAggregator, clearAllAreaAggregators } from '../systems/loop/AreaModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { combinePercentages } from '../systems/effects/ModifierAggregator.js';

// Locks C-19 (D-66): completing an area's binder grants a permanent bonus that
// fires exactly once, rides the area aggregator, and survives a reload.

const CARDS = {
    a_wood: { id: 'a_wood', cardType: 'task', areaId: 'area_a' },
    a_ore:  { id: 'a_ore',  cardType: 'task', areaId: 'area_a' },
    a_boost:{ id: 'a_boost', cardType: 'boost', areaId: 'area_a', isUnique: true, maxCopies: 1 },
    b_fish: { id: 'b_fish', cardType: 'task', areaId: 'area_b' }
};

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => CARDS[id] || null),
    getAllCards: vi.fn(() => CARDS),
    getCardsByAreaSet: vi.fn((areaId) => Object.values(CARDS).filter(c => c.areaId === areaId)),
    CARD_TYPES: { TASK: 'task', COMBAT: 'combat', STATION: 'station' }
}));

vi.mock('../config/registries/areaSetRegistry.js', () => ({
    getAreaSet: vi.fn((id) => (id === 'area_b'
        ? { id, name: 'B', masteryBonus: { type: 'SPEED', target: { category: 'fishing' }, bucket: 'percentage', value: 0.5 } }
        : { id, name: 'A' }))
}));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn()
}));

/** The area aggregator's percentage factor for a skill. */
const areaFactor = (areaId, skill) =>
    combinePercentages(getAreaAggregator(areaId).collectPercentages(EFFECT_TYPES.SPEED, skill));

/** Fill area_a's binder to completion: 4 copies each task, 1 of the Boost. */
function completeAreaA() {
    GameState.state.collection.binders.area_a = { a_wood: 4, a_ore: 4, a_boost: 1 };
}

beforeEach(() => {
    GameState.initNew();
    GameState.state.collection.unlockedAreaSets = ['area_a', 'area_b'];
    GameState.state.collection.binders = {};
    GameState.state.areaStates = {
        area_a: { deckSlots: [], binderMasteryUnlocked: false },
        area_b: { deckSlots: [], binderMasteryUnlocked: false }
    };
    clearAllAreaAggregators();
});

describe('Granting the bonus (D-66)', () => {
    it('does nothing while the binder is incomplete', () => {
        GameState.state.collection.binders.area_a = { a_wood: 4 };
        expect(BinderMastery.evaluate('area_a')).toBe(false);
        expect(BinderMastery.isUnlocked('area_a')).toBe(false);
        expect(areaFactor('area_a', 'ALL')).toBeCloseTo(1.0);
    });

    it('fires on completion and registers the bonus', () => {
        completeAreaA();
        expect(BinderMastery.evaluate('area_a')).toBe(true);
        expect(BinderMastery.isUnlocked('area_a')).toBe(true);
        expect(areaFactor('area_a', 'ALL')).toBeCloseTo(1.1);   // default +10%
    });

    it('fires exactly once — no repeat on later evaluations', () => {
        completeAreaA();
        expect(BinderMastery.evaluate('area_a')).toBe(true);

        // Re-entry is what stops the notification firing on every later pack.
        expect(BinderMastery.evaluate('area_a')).toBe(false);
        expect(BinderMastery.evaluate('area_a')).toBe(false);
        expect(areaFactor('area_a', 'ALL')).toBeCloseTo(1.1);   // still +10%, not +30%
    });

    it('does not leak into other areas', () => {
        completeAreaA();
        BinderMastery.evaluate('area_a');
        expect(areaFactor('area_b', 'ALL')).toBeCloseTo(1.0);
    });

    it('refuses to reward an area with nothing authored in it', () => {
        // An empty pool reports "complete" vacuously — that must not hand out a
        // free permanent bonus for a region with no content.
        GameState.state.collection.unlockedAreaSets = ['area_empty'];
        GameState.state.areaStates.area_empty = { deckSlots: [], binderMasteryUnlocked: false };
        expect(BinderMastery.evaluate('area_empty')).toBe(false);
    });
});

describe('Authored bonuses (D-71 — tuning is the designer’s)', () => {
    it('uses the area authored bonus when there is one', () => {
        GameState.state.collection.binders.area_b = { b_fish: 4 };
        BinderMastery.evaluate('area_b');
        expect(areaFactor('area_b', 'fishing')).toBeCloseTo(1.5);
    });

    it('falls back to the default when none is authored', () => {
        expect(BinderMastery.getMasteryBonus('area_a')).toEqual([BinderMastery.DEFAULT_MASTERY_BONUS]);
    });
});

describe('Surviving a reload', () => {
    it('replays earned mastery onto the runtime aggregator', () => {
        completeAreaA();
        BinderMastery.evaluate('area_a');
        expect(areaFactor('area_a', 'ALL')).toBeCloseTo(1.1);

        // Aggregators are runtime-only; a load starts them empty.
        clearAllAreaAggregators();
        expect(areaFactor('area_a', 'ALL')).toBeCloseTo(1.0);

        BinderMastery.rehydrate();
        expect(areaFactor('area_a', 'ALL')).toBeCloseTo(1.1);
    });

    it('does not double up when rehydrated twice', () => {
        completeAreaA();
        BinderMastery.evaluate('area_a');
        BinderMastery.rehydrate();
        BinderMastery.rehydrate();
        expect(areaFactor('area_a', 'ALL')).toBeCloseTo(1.1);
    });

    it('restores nothing for an area that never earned it', () => {
        BinderMastery.rehydrate();
        expect(areaFactor('area_a', 'ALL')).toBeCloseTo(1.0);
    });
});

describe('evaluateAll', () => {
    it('sweeps every unlocked area', () => {
        completeAreaA();
        GameState.state.collection.binders.area_b = { b_fish: 4 };

        BinderMastery.evaluateAll();

        expect(BinderMastery.isUnlocked('area_a')).toBe(true);
        expect(BinderMastery.isUnlocked('area_b')).toBe(true);
    });
});
