import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks must be declared before importing the module under test ---

const bank = new Map();

vi.mock('../systems/inventory/InventoryManager.js', () => ({
    InventoryManager: {
        hasItem: vi.fn((id, n) => (bank.get(id) || 0) >= n),
        removeItem: vi.fn((id, n) => bank.set(id, (bank.get(id) || 0) - n)),
        getItemCount: vi.fn((id) => bank.get(id) || 0)
    }
}));

const ITEMS = {
    item_bread: { id: 'item_bread', restoreAmount: 12, tags: ['food'] },
    item_beer: { id: 'item_beer', restoreAmount: 8, tags: ['drink'] },
    item_rock: { id: 'item_rock', tags: [] }
};

vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: vi.fn((id) => ITEMS[id] || null)
}));

const hero = { id: 'h1', hp: { current: 50, max: 50 }, energy: { current: 20, max: 100 } };

vi.mock('../systems/hero/HeroManager.js', () => ({
    getHero: vi.fn(() => hero),
    modifyHeroHp: vi.fn((_id, delta) => { hero.hp.current += delta; }),
    modifyHeroEnergy: vi.fn((_id, delta) => { hero.energy.current += delta; })
}));

import {
    resolveEffects,
    resolveOnActivate,
    resolveOnComplete,
    hasResolver
} from '../systems/cards/effects/effectResolvers.js';
import { EFFECT_PHASES } from '../config/cards/effectRegistry.js';

const ctx = { heroId: 'h1', areaId: 'area_test' };

beforeEach(() => {
    bank.clear();
    hero.hp.current = 50;
    hero.energy.current = 20;
    vi.clearAllMocks();
});

describe('resolver dispatch', () => {
    it('owns restore and hazard; leaves engine-owned kinds alone', () => {
        expect(hasResolver('restore')).toBe(true);
        expect(hasResolver('hazard')).toBe(true);
        // Still engine-owned — WorkProcessor, CombatProcessor, MutatorStamping,
        // and C-4 respectively. Declared in the registry, not dispatched here.
        expect(hasResolver('work_output')).toBe(false);
        expect(hasResolver('combat')).toBe(false);
        expect(hasResolver('token_stamp')).toBe(false);
        expect(hasResolver('buff')).toBe(false);
    });

    it('only runs effects belonging to the requested phase', () => {
        bank.set('item_bread', 1);
        const effects = [
            { kind: 'hazard', damage: 5 },
            { kind: 'restore', itemId: 'item_bread' }
        ];

        resolveOnActivate(effects, ctx);
        expect(hero.hp.current).toBe(45); // hazard only

        resolveOnComplete(effects, ctx);
        expect(hero.hp.current).toBe(57); // then the restore
    });

    it('reports which kinds it resolved', () => {
        const out = resolveEffects([{ kind: 'hazard', damage: 1 }], EFFECT_PHASES.ON_ACTIVATE, ctx);
        expect(out.resolved).toEqual(['hazard']);
        expect(out.heroDied).toBe(false);
    });

    it('skips engine-owned kinds without error', () => {
        const out = resolveOnComplete([
            { kind: 'work_output', outputs: [{ itemId: 'x' }] },
            { kind: 'token_stamp', tokenId: 't' }
        ], ctx);
        expect(out.resolved).toEqual([]);
    });

    it('tolerates an empty or missing effect list', () => {
        expect(resolveOnComplete([], ctx).resolved).toEqual([]);
        expect(resolveOnComplete(undefined, ctx).resolved).toEqual([]);
    });
});

describe('restore effect', () => {
    it('item-backed: consumes one from the bank and restores HP', () => {
        bank.set('item_bread', 3);
        resolveOnComplete([{ kind: 'restore', itemId: 'item_bread' }], ctx);
        expect(hero.hp.current).toBe(62);
        expect(bank.get('item_bread')).toBe(2);
    });

    it('item-backed: a drink restores Energy instead', () => {
        bank.set('item_beer', 1);
        resolveOnComplete([{ kind: 'restore', itemId: 'item_beer' }], ctx);
        expect(hero.energy.current).toBe(28);
        expect(hero.hp.current).toBe(50);
    });

    it('item-backed: an empty bank costs the time and nothing else', () => {
        resolveOnComplete([{ kind: 'restore', itemId: 'item_bread' }], ctx);
        expect(hero.hp.current).toBe(50);
        expect(bank.get('item_bread')).toBeUndefined();
    });

    it('item-backed: an item with no restoreAmount still consumes nothing extra', () => {
        bank.set('item_rock', 1);
        resolveOnComplete([{ kind: 'restore', itemId: 'item_rock' }], ctx);
        expect(hero.hp.current).toBe(50);
        expect(bank.get('item_rock')).toBe(0); // consumed, but healed nothing
    });

    it('direct form: applies the authored amount without touching the bank', () => {
        resolveOnComplete([{ kind: 'restore', resource: 'hp', amount: 15 }], ctx);
        expect(hero.hp.current).toBe(65);

        resolveOnComplete([{ kind: 'restore', resource: 'energy', amount: 5 }], ctx);
        expect(hero.energy.current).toBe(25);
    });
});

describe('hazard effect (D-11: once per execution)', () => {
    it('damages the hero on activate', () => {
        resolveOnActivate([{ kind: 'hazard', damage: 4 }], ctx);
        expect(hero.hp.current).toBe(46);
    });

    it('reports heroDied when the damage is lethal', () => {
        hero.hp.current = 3;
        const out = resolveOnActivate([{ kind: 'hazard', damage: 4 }], ctx);
        expect(out.heroDied).toBe(true);
    });

    it('stops resolving once the hero has died', () => {
        hero.hp.current = 3;
        const out = resolveOnActivate([
            { kind: 'hazard', damage: 4 },
            { kind: 'hazard', damage: 99 }
        ], ctx);
        expect(out.heroDied).toBe(true);
        expect(out.resolved).toEqual(['hazard']); // the second never ran
        expect(hero.hp.current).toBe(-1);
    });

    it('four hazard cards in a loop land four separate hits', () => {
        const oneCard = [{ kind: 'hazard', damage: 4 }];
        for (let i = 0; i < 4; i++) resolveOnActivate(oneCard, ctx);
        expect(hero.hp.current).toBe(34); // 50 - 16
    });
});
