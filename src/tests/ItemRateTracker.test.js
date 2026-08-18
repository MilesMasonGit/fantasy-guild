import { describe, it, expect, beforeEach } from 'vitest';
import { ItemRateTracker } from '../systems/inventory/ItemRateTracker.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GameState } from '../state/GameState.js';
import '../systems/core/NotificationSubscriptions.js';

describe('ItemRateTracker — production-driven rate calculation', () => {
    beforeEach(() => {
        GameState.initNew();
        ItemRateTracker.clearAll();
    });

    it('records gains when item sprites are produced on the board', () => {
        SpriteLayer.addSprite('item', 'item_oak_wood', 5, 10);
        const rate = ItemRateTracker.getRate('item_oak_wood');
        expect(rate).toBeGreaterThan(0);
    });

    it('does not double-count or spike rate when items are collected from the floor into inventory', () => {
        const sprite = SpriteLayer.addSprite('item', 'item_oak_wood', 10, 10);
        const rateBeforeCollection = ItemRateTracker.getRate('item_oak_wood');

        // Collect the sprite
        SpriteLayer.collectSprite(sprite.id);

        const rateAfterCollection = ItemRateTracker.getRate('item_oak_wood');
        // Rate should stay identical rather than doubling to 20
        expect(rateAfterCollection).toBe(rateBeforeCollection);
    });

    it('tracks item consumption/loss as negative rate correctly', () => {
        InventoryManager.addItem('item_oak_wood', 100);
        ItemRateTracker.clearAll();

        InventoryManager.removeItem('item_oak_wood', 10);
        const rate = ItemRateTracker.getRate('item_oak_wood');
        expect(rate).toBeLessThan(0);
    });
});
