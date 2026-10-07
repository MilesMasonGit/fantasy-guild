import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import {
    giveItem, listGivableItemIds, advanceTime, getSpawnerKindCounts,
    DEV_ADVANCE_STEP_MS, DEV_ADVANCE_MAX_STEPS
} from '../systems/core/DevTools.js';
import { MAX_TICK_DELTA_MS } from '../config/loopConstants.js';

// Token Lifecycle slice 0.2: the QA panel's give-item and
// advance-timers helpers.

vi.mock('../config/registries/itemRegistry.js', () => {
    const ITEMS = {
        item_oak_log: { id: 'item_oak_log', name: 'Oak Log', maxStack: 99 },
        item_coal: { id: 'item_coal', name: 'Coal', maxStack: 99 },
        oak_log: { id: 'oak_log', name: 'Legacy Oak Log', maxStack: 99 }
    };
    return {
        getItem: vi.fn((id) => ITEMS[id] || null),
        getAllItems: vi.fn(() => ITEMS),
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

    it('a maxed stack sends only the remainder to the mat', () => {
        giveItem('item_coal', 95);
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

describe('advanceTime', () => {
    const fakeLoop = () => {
        const deltas = [];
        return { deltas, runHandlers: (d) => deltas.push(d) };
    };
    const sum = (a) => a.reduce((s, x) => s + x, 0);

    it('steps at the live loop clamp so no system sees an impossible delta', () => {
        expect(DEV_ADVANCE_STEP_MS).toBe(MAX_TICK_DELTA_MS);
    });

    it('delivers exactly N minutes in fixed steps', () => {
        const loop = fakeLoop();
        const r = advanceTime(5, { loop });

        expect(r).toEqual({ ok: true, advancedMs: 300_000, steps: 300, capped: false });
        expect(loop.deltas).toHaveLength(300);
        expect(sum(loop.deltas)).toBe(300_000);
        expect(loop.deltas.every(d => d === DEV_ADVANCE_STEP_MS)).toBe(true);
    });

    it('a fractional request ends on one short final step', () => {
        const loop = fakeLoop();
        advanceTime(0.01, { loop, stepMs: 250 });   // 600 ms
        expect(loop.deltas).toEqual([250, 250, 100]);
    });

    it('respects the step cap and reports it', () => {
        const loop = fakeLoop();
        const r = advanceTime(10, { loop, stepMs: 1000, maxSteps: 60 });

        expect(r.capped).toBe(true);
        expect(r.steps).toBe(60);
        expect(loop.deltas).toHaveLength(60);
        expect(sum(loop.deltas)).toBe(60_000);
    });

    it('the default cap bounds a huge request', () => {
        const loop = fakeLoop();
        const r = advanceTime(100_000, { loop });
        expect(r.capped).toBe(true);
        expect(loop.deltas).toHaveLength(DEV_ADVANCE_MAX_STEPS);
    });

    it('rejects zero, negative and non-numeric minutes without ticking', () => {
        const loop = fakeLoop();
        for (const bad of [0, -3, 'abc', NaN, Infinity]) {
            expect(advanceTime(bad, { loop }).ok).toBe(false);
        }
        expect(loop.deltas).toHaveLength(0);
    });

    describe('through the real GameLoop', () => {
        let received;
        beforeEach(() => {
            received = [];
            GameLoop.onTick('test_dev_advance', (delta) => received.push(delta));
        });
        afterEach(() => GameLoop.offTick('test_dev_advance'));

        it('drives every registered tick handler with the stepped delta', () => {
            const before = GameLoop.getTickCount();
            advanceTime(2);

            expect(received).toHaveLength(120);
            expect(sum(received)).toBe(120_000);
            expect(GameLoop.getTickCount() - before).toBe(120);
        });

        it('runs even when the loop is stopped (it is an explicit request)', () => {
            const wasRunning = GameLoop.isRunning;
            GameLoop.isRunning = false;
            advanceTime(1);
            expect(received).toHaveLength(60);
            GameLoop.isRunning = wasRunning;
        });
    });
});

describe('getSpawnerKindCounts', () => {
    // Rows with spawners on the mat are pinned in SpawnerSystem.test.js.
    it('is an empty list when no spawner is on the mat', () => {
        expect(getSpawnerKindCounts()).toEqual([]);
    });
});
