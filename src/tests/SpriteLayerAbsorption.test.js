import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import './fixtures/fixtureItems.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * these are spots on a 160 u lattice, which is the step loot stacking was tuned
 * against — sprites merge within ~2 steps (360 u) and stack separately beyond.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

describe('SpriteLayer Loot Landing, Lingering & Absorption', () => {
    beforeEach(() => {
        GameState.initNew();
        GameState.state.board = { tokens: {}, nextTokenOrder: 0, tokenBank: {}, tray: [], sprites: [] };
    });

    it('spawns the first item as a standalone stack', () => {
        const first = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(10) });
        expect(first).not.toBeNull();
        expect(first.targetStackId).toBeNull();
        expect(first.quantity).toBe(1);
        expect(SpriteLayer.getSprites().length).toBe(1);
    });

    it('spawns a subsequent item near the existing stack with targetStackId', () => {
        const first = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(10) });
        const second = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(10) });

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

        const first = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(10) });
        const second = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(10) });

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
        const first = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(10) });
        const second = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(10) });

        // Collect second sprite only
        const collected = SpriteLayer.collectSprite(second.id);
        expect(collected).toBe(true);

        const remaining = SpriteLayer.getSprites();
        expect(remaining.length).toBe(1);
        expect(remaining[0].id).toBe(first.id);
        expect(remaining[0].quantity).toBe(1);
    });

    it('merges tokens within 2 steps into the same stack', () => {
        // Spots 10 and 11 — one 160 u step apart
        const first = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(10) });
        const second = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(11) });

        expect(second.targetStackId).toBe(first.id);
    });

    it('creates separate stacks for tokens farther than 2 steps apart', () => {
        // Spot 0 (top-left) and spot 35 (bottom-right)
        const first = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(0) });
        const second = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(35) });

        expect(second.targetStackId).toBeNull();
        expect(SpriteLayer.getSprites().length).toBe(2);

        // A third drop near spot 35 merges into the second stack
        const third = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, { centre: C(34) });
        expect(third.targetStackId).toBe(second.id);
    });
});
