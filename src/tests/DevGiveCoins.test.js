import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { getCoins, spendCoins } from '../systems/inventory/Coins.js';
import { giveItem } from '../systems/core/DevTools.js';
import { giveAndSay, devBankEveryKind, devFillBank } from '../ui/dev/qaTools.js';

// The QA panel gives Coins to the guild's coin count, never as a Bank stack.

vi.mock('../config/registries/itemRegistry.js', () => {
    const ITEMS = {
        item_coins: { id: 'item_coins', name: 'Coins', maxStack: 99 },
        item_coal: { id: 'item_coal', name: 'Coal', maxStack: 99 }
    };
    return {
        getItem: vi.fn((id) => ITEMS[id] || null),
        getAllItems: vi.fn(() => ITEMS),
        isRetiredItem: vi.fn(() => false),
        DEFAULT_MAX_STACK: 1e12
    };
});

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(),
    success: vi.fn(), error: vi.fn(), getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
});

describe('giving Coins from the QA panel', () => {
    it('raises the guild coins and leaves no Coins stack in the Bank', () => {
        const before = getCoins();
        const r = giveItem('item_coins', 500);
        expect(r).toMatchObject({ ok: true, added: 500, overflow: 0 });
        expect(getCoins()).toBe(before + 500);
        expect(GameState.state.inventory.items.item_coins).toBeUndefined();
        expect(InventoryManager.getItemCount('item_coins')).toBe(0);
    });

    it('the coins given can be paid out', () => {
        giveItem('item_coins', 500);
        expect(spendCoins(300)).toBe(true);
        expect(getCoins()).toBe(200);
        expect(spendCoins(300)).toBe(false);
    });

    it('says it went to the guild', () => {
        expect(giveAndSay('item_coins', 5)).toBe('Gave 5 Coins to the guild');
    });

    it('the bank fillers never put Coins in the Bank', () => {
        devBankEveryKind();
        devFillBank();
        expect(GameState.state.inventory.items.item_coins).toBeUndefined();
        expect(InventoryManager.getItemCount('item_coal')).toBe(1);
    });
});
