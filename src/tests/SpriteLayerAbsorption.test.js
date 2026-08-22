import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';

describe('SpriteLayer Loot Landing, Lingering & Absorption', () => {
    beforeEach(() => {
        GameState.initNew();
        GameState.state.board = { tiles: {}, tokenBank: {}, tray: [], sprites: [] };
    });

    it('spawns the first item as a standalone stack', () => {
        const first = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);
        expect(first).not.toBeNull();
        expect(first.targetStackId).toBeNull();
        expect(first.quantity).toBe(1);
        expect(SpriteLayer.getSprites().length).toBe(1);
    });

    it('spawns a subsequent item near the existing stack with targetStackId', () => {
        const first = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);
        const second = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);

        expect(second).not.toBeNull();
        expect(second.targetStackId).toBe(first.id);
        expect(second.absorbAt).toBeGreaterThan(Date.now());
        expect(SpriteLayer.getSprites().length).toBe(2);

        // Distance from first stack is close (~24-48px)
        const dist = Math.hypot(second.x - first.x, second.y - first.y);
        expect(dist).toBeGreaterThanOrEqual(20);
        expect(dist).toBeLessThanOrEqual(55);
    });

    it('absorbs lingering item into the parent stack and publishes SPRITE_ABSORBED', () => {
        const absorbedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.SPRITE_ABSORBED, (e) => absorbedEvents.push(e));

        const first = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);
        const second = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);

        expect(first.quantity).toBe(1);
        expect(SpriteLayer.getSprites().length).toBe(2);

        // Execute absorption
        SpriteLayer.absorbSprite(second.id);

        expect(first.quantity).toBe(2);
        expect(SpriteLayer.getSprites().length).toBe(1);
        expect(absorbedEvents.length).toBe(1);
        expect(absorbedEvents[0]).toEqual({
            parentId: first.id,
            absorbedId: second.id,
            quantity: 1
        });
    });

    it('allows collecting the lingering sprite independently without taking parent stack', () => {
        const first = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);
        const second = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);

        // Collect second sprite only
        const collected = SpriteLayer.collectSprite(second.id);
        expect(collected).toBe(true);

        const remaining = SpriteLayer.getSprites();
        expect(remaining.length).toBe(1);
        expect(remaining[0].id).toBe(first.id);
        expect(remaining[0].quantity).toBe(1);
    });

    it('merges tokens within 2 tiles into the same stack', () => {
        // Tile 10 and Tile 11 (adjacent tiles, 1 tile apart)
        const first = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 10);
        const second = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 11);

        expect(second.targetStackId).toBe(first.id);
    });

    it('creates separate stacks for tokens farther than 2 tiles apart', () => {
        // Tile 0 (top-left) and Tile 48 (bottom-right)
        const first = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 0);
        const second = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 48);

        expect(second.targetStackId).toBeNull();
        expect(SpriteLayer.getSprites().length).toBe(2);

        // A third drop near tile 48 merges into the second stack
        const third = SpriteLayer.addSprite('item', 'item_oak_wood', 1, 47);
        expect(third.targetStackId).toBe(second.id);
    });
});
