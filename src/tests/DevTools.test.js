import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import {
    giveItem, listGivableItemIds, getSpawnerKindCounts
} from '../systems/core/DevTools.js';

// Token Lifecycle slice 0.2: the QA panel's give-item helpers.

vi.mock('../config/registries/itemRegistry.js', () => {
    const ITEMS = {
        item_oak_log: { id: 'item_oak_log', name: 'Oak Log', maxStack: 99 },
        item_coal: { id: 'item_coal', name: 'Coal', maxStack: 99 },
        oak_log: { id: 'oak_log', name: 'Legacy Oak Log', maxStack: 99 }
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
    SpriteLayer.init();          // wires overflow subscription
});

describe('listGivableItemIds', () => {
    it('lists only live item_* ids, sorted', () => {
        expect(listGivableItemIds()).toEqual(['item_coal', 'item_oak_log']);
    });
});

describe('giveItem', () => {
    it('adds to the Bank through InventoryManager.addItem', () => {
        const spy = vi.spyOn(InventoryManager, 'addItem');
        const r = giveItem('item_oak_log', 5);

        expect(spy).toHaveBeenCalledWith('item_oak_log', 5, 'dev_give_item');
        expect(r).toEqual({ ok: true, added: 5, overflow: 0 });
        expect(GameState.state.inventory.items.item_oak_log.quantity).toBe(5);
        spy.mockRestore();
    });

    it('accepts string input from the form and trims the id', () => {
        const r = giveItem('  item_coal ', '3');
        expect(r.ok).toBe(true);
        expect(GameState.state.inventory.items.item_coal.quantity).toBe(3);
    });

    it('a full Bank overflows onto the mat rather than losing anything (D-138)', () => {
        GameState.state.inventory.maxSlots = 1;
        giveItem('item_coal', 1);

        const r = giveItem('item_oak_log', 7);
        expect(r).toEqual({ ok: true, added: 0, overflow: 7 });
        expect(GameState.state.inventory.items.item_oak_log).toBeUndefined();
        expect(SpriteLayer.countOnBoard('item_oak_log')).toBe(7);
    });

    it('a stack at the shared ceiling sends only the remainder to the mat', () => {
        giveItem('item_coal', 1e12 - 4);
        const r = giveItem('item_coal', 10);
        expect(r).toEqual({ ok: true, added: 4, overflow: 6 });
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(6);
    });

    it('refuses an unknown id, an empty id and a bad amount without touching the Bank', () => {
        const spy = vi.spyOn(InventoryManager, 'addItem');
        expect(giveItem('item_nope', 1).ok).toBe(false);
        expect(giveItem('', 1).ok).toBe(false);
        expect(giveItem('item_coal', 0).ok).toBe(false);
        expect(giveItem('item_coal', 'abc').ok).toBe(false);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('getSpawnerKindCounts', () => {
    // Rows with spawners on the mat are pinned in SpawnerSystem.test.js.
    it('is an empty list when no spawner is on the mat', () => {
        expect(getSpawnerKindCounts()).toEqual([]);
    });
});
