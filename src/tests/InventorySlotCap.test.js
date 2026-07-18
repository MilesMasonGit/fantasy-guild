import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';

// Bank slot capacity enforcement (CR-039, owner decision 2026-07-17):
// each distinct item type occupies one slot; a full bank rejects NEW types
// but keeps accepting additions to existing stacks.

vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: vi.fn((id) => ({ id, name: id, maxStack: 99 }))
}));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/QuestTracker.js', () => ({
    QuestTracker: { processEvent: vi.fn() }
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

describe('InventoryManager bank slot capacity (CR-039)', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        GameState.state.inventory.maxSlots = 3;
    });

    it('accepts new item types while slots are free', () => {
        expect(InventoryManager.addItem('item_a', 5)).toBe(5);
        expect(InventoryManager.addItem('item_b', 5)).toBe(5);
        expect(InventoryManager.addItem('item_c', 5)).toBe(5);
        expect(Object.keys(GameState.state.inventory.items)).toHaveLength(3);
    });

    it('rejects a new item type when every slot is taken', () => {
        ['item_a', 'item_b', 'item_c'].forEach(id => InventoryManager.addItem(id, 1));
        expect(InventoryManager.addItem('item_d', 1)).toBe(0);
        expect(GameState.state.inventory.items.item_d).toBeUndefined();
    });

    it('still accepts additions to an existing stack at the cap', () => {
        ['item_a', 'item_b', 'item_c'].forEach(id => InventoryManager.addItem(id, 1));
        expect(InventoryManager.addItem('item_a', 4)).toBe(4);
        expect(GameState.state.inventory.items.item_a.quantity).toBe(5);
    });

    it('frees the slot when a stack is fully removed', () => {
        ['item_a', 'item_b', 'item_c'].forEach(id => InventoryManager.addItem(id, 1));
        expect(InventoryManager.removeItem('item_a', 1)).toBe(true);
        expect(InventoryManager.addItem('item_d', 1)).toBe(1);
    });

    it('honors a raised maxSlots (bank_slots guild upgrade)', () => {
        ['item_a', 'item_b', 'item_c'].forEach(id => InventoryManager.addItem(id, 1));
        expect(InventoryManager.addItem('item_d', 1)).toBe(0);
        GameState.state.inventory.maxSlots = 4;
        expect(InventoryManager.addItem('item_d', 1)).toBe(1);
    });
});
