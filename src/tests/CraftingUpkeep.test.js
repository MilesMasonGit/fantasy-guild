import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as ConsumptionSystem from '../systems/hero/ConsumptionSystem.js';
import { CONSUME_THRESHOLD } from '../config/loopConstants.js';

// Locks C-13 (D-4, D-29): a crafter tops up from their OWN loadout grid, and
// "runs indefinitely" holds even when a craft costs more energy than the
// ambient top-up threshold.

const WATER = { id: 'item_water', name: 'Water', equipSlot: 'drink', restoreAmount: 10 };

vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: vi.fn((id) => (id === 'item_water' ? WATER : null)),
    getAllItems: vi.fn(() => ({ item_water: WATER }))
}));

vi.mock('../config/registries/equipmentConstants.js', () => ({
    getEquippedEntries: vi.fn((hero) => hero._equipped || []),
    categoryIdsOfKind: vi.fn(() => ['potion']),
    CATEGORY_KINDS: { CONSUMABLE: 'consumable' }
}));

let hero;
let bankStock;

vi.mock('../systems/hero/HeroManager.js', () => ({
    getHero: vi.fn(() => hero),
    modifyHeroEnergy: vi.fn((_id, amount) => {
        hero.energy.current = Math.min(hero.energy.max, hero.energy.current + amount);
    }),
    modifyHeroHp: vi.fn()
}));

vi.mock('../systems/inventory/InventoryManager.js', () => ({
    InventoryManager: {
        hasItem: vi.fn((_id, n) => bankStock >= n),
        removeItem: vi.fn((_id, n) => { bankStock -= n; })
    }
}));

function seedHero({ energy, withDrink = true }) {
    hero = {
        id: 'hero_1',
        name: 'Tester',
        energy: { current: energy, max: 100 },
        hp: { current: 100, max: 100 },
        _equipped: withDrink ? [{ category: 'drink', itemId: 'item_water' }] : []
    };
    bankStock = 50;
}

beforeEach(() => { GameState.initNew(); });

describe('Ambient top-up (the idle rhythm)', () => {
    it('drinks when energy falls below the threshold', () => {
        seedHero({ energy: 100 * CONSUME_THRESHOLD - 1 });   // 24 of 100
        const drunk = ConsumptionSystem.tryDrink('hero_1');
        expect(drunk).not.toBeNull();
        expect(hero.energy.current).toBe(34);
    });

    it('does not drink while comfortably supplied', () => {
        seedHero({ energy: 80 });
        expect(ConsumptionSystem.tryDrink('hero_1')).toBeNull();
        expect(hero.energy.current).toBe(80);
    });
});

describe('On-demand top-up (D-29 — "runs indefinitely")', () => {
    it('drinks for a craft that costs more than the ambient threshold', () => {
        // 40 energy of 100 is ABOVE the 25% threshold, so the ambient rule
        // would never fire — yet a 60-energy craft is unaffordable. Without
        // `need` the crafter stalls forever with a full waterskin equipped.
        seedHero({ energy: 40 });
        expect(ConsumptionSystem.tryDrink('hero_1')).toBeNull();          // ambient: not low

        const drunk = ConsumptionSystem.tryDrink('hero_1', { need: 60 });
        expect(drunk).not.toBeNull();
        expect(hero.energy.current).toBe(50);
    });

    it('converges on the cost across repeated ticks', () => {
        seedHero({ energy: 40 });
        // One drink does not cover a 60-cost craft; the tick repeats.
        for (let i = 0; i < 5 && hero.energy.current < 60; i++) {
            ConsumptionSystem.tryDrink('hero_1', { need: 60 });
        }
        expect(hero.energy.current).toBeGreaterThanOrEqual(60);
    });

    it('stops drinking once the need is met', () => {
        seedHero({ energy: 90 });
        expect(ConsumptionSystem.tryDrink('hero_1', { need: 60 })).toBeNull();
        expect(hero.energy.current).toBe(90);
    });
});

describe('Running dry is a supply problem, not a crash', () => {
    it('goes without when the grid has no drink equipped', () => {
        seedHero({ energy: 5, withDrink: false });
        expect(ConsumptionSystem.tryDrink('hero_1', { need: 15 })).toBeNull();
        expect(hero.energy.current).toBe(5);
    });

    it('goes without when the bank is out of stock', () => {
        seedHero({ energy: 5 });
        bankStock = 0;
        expect(ConsumptionSystem.tryDrink('hero_1', { need: 15 })).toBeNull();
        expect(hero.energy.current).toBe(5);
    });
});
