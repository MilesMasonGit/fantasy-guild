import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { BANK_TAB_SLOTS } from '../systems/inventory/bankTabs.js';

/**
 * ⭐ Items the data no longer has (deleted or renamed in the CMS) stay in the Bank's save, so
 * restoring the id restores the stack, but take no slot: the Bank cannot show, move or spend them,
 * so a slot they held could never be freed.
 */

vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: vi.fn((id) => (id.startsWith('item_gone') ? null : { id, name: id, maxStack: 99 })),
    DEFAULT_MAX_STACK: 1e12
}));
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(),
    success: vi.fn(), error: vi.fn(), getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const inv = () => GameState.state.inventory;
const kind = (i) => `item_k${String(i).padStart(4, '0')}`;
const gone = (i) => `item_gone${String(i).padStart(4, '0')}`;
const fill = (from, to) => { for (let i = from; i < to; i++) InventoryManager.addItem(kind(i), 1); };
/** Stacks a save made before the delete holds, filed in the first tab. */
const holdGone = (n) => { for (let i = 0; i < n; i++) inv().items[gone(i)] = { itemId: gone(i), quantity: 5, dur: null }; };

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GuildUpgradeManager.recompute();
});

describe('⭐ kinds with no definition take no Bank slot', () => {
    it('⭐ a tab full but for hidden kinds still takes a new kind; the hidden ones stay', () => {
        holdGone(10);
        fill(0, BANK_TAB_SLOTS - 1);
        expect(InventoryManager.freeSlots()).toBe(1);
        expect(InventoryManager.addItem(kind(999), 1)).toBe(1);
        expect(InventoryManager.freeSlots()).toBe(0);
        expect(InventoryManager.addItem(kind(1000), 1)).toBe(0);
        for (let i = 0; i < 10; i++) expect(inv().items[gone(i)]).toEqual({ itemId: gone(i), quantity: 5, dur: null });
    });

    it('a first tab of hidden kinds lets a new kind file there', () => {
        holdGone(BANK_TAB_SLOTS);
        expect(InventoryManager.freeSlots()).toBeGreaterThan(0);
        expect(InventoryManager.tabHasRoom(inv().groupOrder[0])).toBe(true);
        expect(InventoryManager.addItem(kind(0), 3)).toBe(3);
        expect(Object.keys(inv().items)).toHaveLength(BANK_TAB_SLOTS + 1);
    });

    it('room for a hero\'s copy back counts no hidden kind', () => {
        holdGone(5);
        fill(0, BANK_TAB_SLOTS - 1);
        expect(InventoryManager.hasRoomFor([kind(500)])).toBe(true);
        expect(InventoryManager.hasRoomFor([kind(500), kind(501)])).toBe(false);
    });
});
