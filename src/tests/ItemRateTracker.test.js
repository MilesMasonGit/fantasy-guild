import { describe, it, expect, beforeEach, onTestFinished } from 'vitest';
import * as GameClock from '../systems/core/GameClock.js';
import { ItemRateTracker } from '../systems/inventory/ItemRateTracker.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import '../systems/core/NotificationSubscriptions.js';
import './fixtures/fixtureItems.js';

describe('ItemRateTracker — production-driven rate calculation', () => {
    beforeEach(() => {
        GameState.initNew();
        ItemRateTracker.clearAll();
    });

    it('records gains when item sprites are produced on the board', () => {
        SpriteLayer.addSprite('item', 'fixture_oak_wood', 5, 10);
        const rate = ItemRateTracker.getRate('fixture_oak_wood');
        expect(rate).toBeGreaterThan(0);
    });

    it('does not double-count or spike rate when items are collected from the floor into inventory', () => {
        // A held clock: the rate falls as time passes from the first record, which is not this test.
        GameClock.begin(Date.now());
        onTestFinished(() => GameClock.end());
        const sprite = SpriteLayer.addSprite('item', 'fixture_oak_wood', 10, 10);
        const rateBeforeCollection = ItemRateTracker.getRate('fixture_oak_wood');

        // Collect the sprite
        SpriteLayer.collectSprite(sprite.id);

        const rateAfterCollection = ItemRateTracker.getRate('fixture_oak_wood');
        // Rate should stay identical rather than doubling to 20
        expect(rateAfterCollection).toBe(rateBeforeCollection);
    });

    it('tracks item consumption/loss as negative rate correctly', () => {
        InventoryManager.addItem('fixture_oak_wood', 100);
        ItemRateTracker.clearAll();

        InventoryManager.removeItem('fixture_oak_wood', 10);
        const rate = ItemRateTracker.getRate('fixture_oak_wood');
        expect(rate).toBeLessThan(0);
    });
});

describe('an item’s per hour counts all its spending', () => {
    beforeEach(() => {
        GameState.initNew();
        ItemRateTracker.clearAll();
    });

    it('a station paid off the floor counts what it took, though the Bank never moved', () => {
        SpriteLayer.addSprite('item', 'fixture_oak_wood', 10, 10);
        expect(SpriteLayer.consumeFromSprites('fixture_oak_wood', 4)).toBe(4);
        expect(ItemRateTracker.getFlow('fixture_oak_wood')).toMatchObject({ gained: 10, spent: 4 });
    });

    it('spending from the Bank counts during a catch-up, whose quiet bus skips the UI listeners', () => {
        InventoryManager.addItem('fixture_oak_wood', 20);
        ItemRateTracker.clearAll();
        EventBus.setQuiet(true);
        try {
            InventoryManager.removeItem('fixture_oak_wood', 6);
        } finally {
            EventBus.setQuiet(false);
        }
        expect(ItemRateTracker.getFlow('fixture_oak_wood')).toMatchObject({ gained: 0, spent: 6 });
    });

    it('a spend from the Bank is counted once, live', () => {
        InventoryManager.addItem('fixture_oak_wood', 20);
        ItemRateTracker.clearAll();
        InventoryManager.removeItem('fixture_oak_wood', 6);
        expect(ItemRateTracker.getFlow('fixture_oak_wood').spent).toBe(6);
    });
});

