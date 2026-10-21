import { describe, it, expect, vi, beforeEach } from 'vitest';

// heroes feed themselves from their own loadout grid. Food and drink both heal
// and are NEED-driven (the 25% rule); Consumables are not need driven at all and
// fire at the head of every loop.

const { bank, ITEMS, hero } = vi.hoisted(() => ({
    bank: new Map(),
    ITEMS: {
        bread:  { id: 'bread',  equipSlot: 'food',       restoreAmount: 20 },
        ale:    { id: 'ale',    equipSlot: 'drink',      restoreAmount: 15 },
        elixir: { id: 'elixir', equipSlot: 'consumable', loopEffect: { type: 'SPEED', value: 0.3 } },
        scroll: { id: 'scroll', equipSlot: 'consumable', loopEffect: { type: 'YIELD', value: 0.25 } },
        sword:  { id: 'sword',  equipSlot: 'hand' }
    },
    hero: { id: 'h1', name: 'Tester', hp: { current: 100, max: 100 }, equipment: [] }
}));

vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: vi.fn((id) => ITEMS[id] || null),
    ITEMS
}));

vi.mock('../systems/inventory/InventoryManager.js', () => ({
    InventoryManager: {
        hasItem: vi.fn((id, n) => (bank.get(id) || 0) >= n),
        removeItem: vi.fn((id, n) => bank.set(id, (bank.get(id) || 0) - n))
    }
}));

vi.mock('../systems/hero/HeroManager.js', () => ({
    getHero: vi.fn(() => hero),
    modifyHeroHp: vi.fn((_id, d) => { hero.hp.current = Math.min(hero.hp.max, hero.hp.current + d); })
}));

import * as ConsumptionSystem from '../systems/hero/ConsumptionSystem.js';

beforeEach(() => {
    bank.clear();
    hero.hp = { current: 100, max: 100 };
    hero.equipment = ['sword', 'bread', 'ale', 'elixir', 'scroll', null, null, null, null];
    vi.clearAllMocks();
});

describe('the 25% rule (D-17)', () => {
    it('does not eat while HP is healthy', () => {
        bank.set('bread', 5);
        expect(ConsumptionSystem.tryEat('h1')).toEqual([]);
        expect(bank.get('bread')).toBe(5);
    });

    it('eats once HP drops below the threshold', () => {
        bank.set('bread', 5);
        hero.hp.current = 20;                       // 20% of 100
        const meals = ConsumptionSystem.tryEat('h1');
        expect(meals).toEqual([expect.objectContaining({ itemId: 'bread', amount: 20 })]);
        expect(hero.hp.current).toBe(40);
        expect(bank.get('bread')).toBe(4);
    });

    it('treats exactly 25% as still healthy', () => {
        bank.set('bread', 5);
        hero.hp.current = 25;
        expect(ConsumptionSystem.tryEat('h1')).toEqual([]);
    });

    it('drinks too, from its own slot, when food leaves HP still low', () => {
        bank.set('bread', 5);
        bank.set('ale', 5);
        hero.hp.current = 2;                        // bread brings it to 22: still low
        const meals = ConsumptionSystem.tryEat('h1');
        expect(meals.map(m => m.itemId)).toEqual(['bread', 'ale']);
        expect(hero.hp.current).toBe(37);
        expect(bank.get('bread')).toBe(4);
        expect(bank.get('ale')).toBe(4);
    });

    it('keeps the drink when the food is enough', () => {
        bank.set('bread', 5);
        bank.set('ale', 5);
        hero.hp.current = 10;                       // bread brings it to 30
        expect(ConsumptionSystem.tryEat('h1').map(m => m.itemId)).toEqual(['bread']);
        expect(bank.get('ale')).toBe(5);
    });

    it('drinks alone when there is no food to eat', () => {
        bank.set('ale', 5);                         // bread equipped but unstocked
        hero.hp.current = 10;
        expect(ConsumptionSystem.tryEat('h1').map(m => m.itemId)).toEqual(['ale']);
        expect(hero.hp.current).toBe(25);
    });

    it('reports need without consuming', () => {
        hero.hp.current = 10;
        expect(ConsumptionSystem.needsFood('h1')).toBe(true);
        expect(bank.get('bread')).toBeUndefined();
    });
});

describe('supply chain, not timing', () => {
    it('goes without when the bank is empty, rather than stalling', () => {
        hero.hp.current = 10;
        expect(ConsumptionSystem.tryEat('h1')).toEqual([]);
        expect(hero.hp.current).toBe(10);           // still hurt, still running
    });

    it('goes without when nothing of that class is equipped', () => {
        bank.set('bread', 5);
        hero.equipment = ['sword', null, null, null, null, null, null, null, null];
        hero.hp.current = 10;
        expect(ConsumptionSystem.tryEat('h1')).toEqual([]);
        expect(bank.get('bread')).toBe(5);
    });

    it('never overheals past max', () => {
        bank.set('bread', 5);
        hero.hp.current = 10;
        ConsumptionSystem.tryEat('h1');
        expect(hero.hp.current).toBeLessThanOrEqual(hero.hp.max);
    });
});

describe('eating is uncapped (D-31)', () => {
    it('eats again immediately if still low — no cooldown', () => {
        bank.set('bread', 5);
        hero.hp.current = 10;
        expect(ConsumptionSystem.tryEat('h1')).toHaveLength(1);
        hero.hp.current = 10;                        // knocked straight back down
        expect(ConsumptionSystem.tryEat('h1')).toHaveLength(1);
        expect(bank.get('bread')).toBe(3);
    });
});

describe('the Consumable class (D-20/D-56)', () => {
    it('spends one of EACH equipped consumable, uncapped', () => {
        bank.set('elixir', 3);
        bank.set('scroll', 3);
        const spent = ConsumptionSystem.consumeLoopConsumables('h1');
        expect(spent.map(s => s.itemId)).toEqual(['elixir', 'scroll']);
        expect(bank.get('elixir')).toBe(2);
        expect(bank.get('scroll')).toBe(2);
    });

    it('is not need-driven — it fires at full health', () => {
        bank.set('elixir', 1);
        hero.hp.current = hero.hp.max;
        expect(ConsumptionSystem.consumeLoopConsumables('h1')).toHaveLength(1);
    });

    it('skips any that are out of stock and runs unbuffed for those', () => {
        bank.set('elixir', 1);                       // scroll unstocked
        const spent = ConsumptionSystem.consumeLoopConsumables('h1');
        expect(spent.map(s => s.itemId)).toEqual(['elixir']);
    });

    it('leaves food and drink alone — different rhythms entirely', () => {
        bank.set('elixir', 1); bank.set('bread', 1); bank.set('ale', 1);
        ConsumptionSystem.consumeLoopConsumables('h1');
        expect(bank.get('bread')).toBe(1);
        expect(bank.get('ale')).toBe(1);
    });

    it('returns the item so the Prep Phase can apply its loop effect', () => {
        bank.set('elixir', 1);
        const [spent] = ConsumptionSystem.consumeLoopConsumables('h1');
        expect(spent.item.loopEffect).toEqual({ type: 'SPEED', value: 0.3 });
    });
});

describe('grid inspection', () => {
    it('reports what the hero is carrying, by class', () => {
        expect(ConsumptionSystem.getConsumables('h1')).toEqual({
            food: 'bread',
            drink: 'ale',
            consumables: ['elixir', 'scroll']
        });
    });
});
