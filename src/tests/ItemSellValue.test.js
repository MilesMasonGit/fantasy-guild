import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { CommerceSystem } from '../systems/economy/CommerceSystem.js';
import { CurrencyManager } from '../systems/economy/CurrencyManager.js';
import { getItem } from '../config/registries/itemRegistry.js';

import shippedItems from '../../data/items.json';

/**
 * **An item sells for what it is worth** (CMS-132).
 *
 * ## ⚠️ The bug this suite exists to keep dead
 *
 * `CommerceSystem.getItemPrice` read `item.baseValue`, and **no item in
 * `data/items.json` has ever carried that field** — so the `|| 1` fallback
 * answered every call and every item in the game, from Water to a Copper Ingot,
 * sold for exactly one gold. The whole derived value chain existed and none of
 * it reached the player. The Bank's on-screen prices came through the same
 * call, so they were wrong in the same way and agreed with each other, which is
 * why it survived so long.
 *
 * The fix is one line — read the derived `value` — and these are its teeth.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 50;
});

describe('An item sells for its derived value', () => {
    it('prices a priced item at its value, not at the 1g floor', () => {
        // A shipped item with a derived value well clear of the floor, so a
        // regression to `|| 1` cannot pass by coincidence.
        const [id, item] = Object.entries(shippedItems)
            .filter(([, i]) => Number.isInteger(i.value) && i.value > 1)
            .sort((a, b) => b[1].value - a[1].value)[0];

        expect(item.value).toBeGreaterThan(1);
        expect(CommerceSystem.getItemPrice(id)).toBe(item.value);
    });

    it('pays derived value × quantity into the purse', () => {
        const id = 'item_market_goods';
        const unit = getItem(id).value;
        expect(unit).toBe(10);

        InventoryManager.addItem(id, 4);
        const before = CurrencyManager.getCurrency('gold');

        const result = CommerceSystem.sellItem(id, 4);

        expect(result.success).toBe(true);
        expect(result.totalGold).toBe(unit * 4);
        expect(CurrencyManager.getCurrency('gold')).toBe(before + unit * 4);
    });

    it('every priced shipped item now fetches more than the old flat 1g', () => {
        const priced = Object.entries(shippedItems).filter(([, i]) => i.value > 1);
        expect(priced.length).toBeGreaterThan(0);
        for (const [id, item] of priced) {
            expect(CommerceSystem.getItemPrice(id), `${id} still sells for the floor`)
                .toBe(item.value);
        }
    });

    it('falls back to 1g for an item the simulator could not price', () => {
        // `value: null` is "no source, nothing derives it" — a content gap the
        // CMS audit raises as Critical. Paying nothing would read as a broken
        // Bank rather than as missing content.
        const unpriced = Object.keys(shippedItems).find(id => shippedItems[id].value == null);
        expect(unpriced, 'expected at least one unpriced shipped item').toBeTruthy();
        expect(CommerceSystem.getItemPrice(unpriced)).toBe(1);
    });

    it('answers 0 for an item that does not exist at all', () => {
        expect(CommerceSystem.getItemPrice('item_does_not_exist')).toBe(0);
    });
});
