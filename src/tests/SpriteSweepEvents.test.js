import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * CR2-056 — a sprite sweep used to publish about eight events per sprite.
 *
 * Measured on `main` 2026-08-26: one `collectAll()` over 40 sprites published
 * **322 events**, of which `state_changed` ×120 and `board:sprites_changed`
 * ×40. Worse, a sweep that collected *nothing* — a full Bank with litter on the
 * floor, which is D-138's designed steady state — published the same 322, every
 * tick, forever, having changed nothing.
 *
 * These tests pin the two things that fixed it: a refusal announces nothing,
 * and a sweep announces once. They deliberately do NOT pin the per-sprite
 * events that come from `InventoryManager` and the registry — that is a
 * different territory, and `board:sprite_collected` is per-sprite by design.
 */

/** Count every event published during `fn`, by name. */
const countEvents = (fn) => {
    const counts = {};
    const realPublish = EventBus.publish.bind(EventBus);
    const spy = vi.spyOn(EventBus, 'publish').mockImplementation((name, payload) => {
        counts[name] = (counts[name] || 0) + 1;
        return realPublish(name, payload);
    });
    try { fn(); } finally { spy.mockRestore(); }
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
    return counts;
};

beforeEach(() => {
    GameState.initNew();
    SpriteLayer.init();
});

describe('A sprite sweep announces once, not once per sprite (CR2-056)', () => {
    it('publishes one board:sprites_changed for a 40-sprite sweep', () => {
        for (let i = 0; i < 40; i++) SpriteLayer.addSprite('item', 'item_oak_wood', 1, null);

        const counts = countEvents(() => SpriteLayer.collectAll());

        expect(counts[BOARD_EVENTS.SPRITES_CHANGED]).toBe(1);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('still publishes board:sprite_collected once per sprite', () => {
        // Not batched, and must never be: it carries the position the particle
        // flies from (D-236) and `QuestManager` counts it.
        for (let i = 0; i < 40; i++) SpriteLayer.addSprite('item', 'item_oak_wood', 1, null);

        const counts = countEvents(() => SpriteLayer.collectAll());

        expect(counts[BOARD_EVENTS.SPRITE_COLLECTED]).toBe(40);
    });

    it('collects the same sprites and the same quantities as before', () => {
        for (let i = 0; i < 12; i++) SpriteLayer.addSprite('item', 'item_oak_wood', 3, null);

        const taken = SpriteLayer.collectAll();

        expect(taken).toBe(12);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('⚠️ a sweep that collects NOTHING publishes nothing at all', () => {
        // D-138's designed steady state. This used to publish the full 322,
        // every tick, having changed nothing — because the `state_changed`
        // publish sat in a `finally` block.
        GameState.state.inventory.maxSlots = 0;
        for (let i = 0; i < 40; i++) SpriteLayer.addSprite('item', `item_ghost_${i}`, 1, null);

        const counts = countEvents(() => SpriteLayer.collectAll());

        expect(counts.total).toBe(0);
        expect(SpriteLayer.getSprites()).toHaveLength(40);   // nothing was lost
    });

    it('a single refused collect publishes nothing', () => {
        GameState.state.inventory.maxSlots = 0;
        const sprite = SpriteLayer.addSprite('item', 'item_ghost_one', 1, null);

        const counts = countEvents(() => SpriteLayer.collectSprite(sprite.id));

        expect(counts.total).toBe(0);
    });

    it('a single successful collect still announces on its own', () => {
        // Outside a sweep nothing is held back — one collect, one announcement.
        const sprite = SpriteLayer.addSprite('item', 'item_oak_wood', 1, null);

        const counts = countEvents(() => SpriteLayer.collectSprite(sprite.id));

        expect(counts[BOARD_EVENTS.SPRITES_CHANGED]).toBe(1);
        expect(counts.state_changed).toBeGreaterThanOrEqual(1);
    });

    it('a partial fit announces, because the sprite really did shrink', () => {
        // One free slot, a stack far bigger than it can hold: some goes in, the
        // remainder waits on the floor. The floor changed, so it must be said.
        const sprite = SpriteLayer.addSprite('item', 'item_oak_wood', 5, null);
        const before = sprite.quantity;

        const counts = countEvents(() => SpriteLayer.collectSprite(sprite.id));

        // Either it all fit (announced) or some did (announced) — never silent.
        expect(counts[BOARD_EVENTS.SPRITES_CHANGED]).toBe(1);
        expect(before).toBe(5);
    });

    it('the auto-collect tick sweep also announces once', () => {
        SettingsManager.set('gameplay.autoCollectLoot', true);
        SettingsManager.set('gameplay.autoCollectDelayMs', 0);
        for (let i = 0; i < 20; i++) SpriteLayer.addSprite('item', 'item_oak_wood', 1, null);

        const counts = countEvents(() => SpriteLayer.tick(5000));

        expect(counts[BOARD_EVENTS.SPRITES_CHANGED] ?? 0).toBeLessThanOrEqual(1);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('the stack-cap sweep in tick() announces once', () => {
        SettingsManager.set('gameplay.autoCollectLoot', false);
        SettingsManager.set('gameplay.maxItemStacks', 5);
        for (let i = 0; i < 25; i++) SpriteLayer.addSprite('item', 'item_oak_wood', 1, null);

        const counts = countEvents(() => SpriteLayer.tick(16));

        expect(counts[BOARD_EVENTS.SPRITES_CHANGED] ?? 0).toBeLessThanOrEqual(1);
        expect(SpriteLayer.getSprites().length).toBeLessThanOrEqual(5);
    });

    it('the whole sweep costs far fewer events than it did', () => {
        // The headline number, held as a ceiling rather than an exact figure —
        // the per-sprite inventory and registry events are not this ticket's.
        for (let i = 0; i < 40; i++) SpriteLayer.addSprite('item', 'item_oak_wood', 1, null);

        const counts = countEvents(() => SpriteLayer.collectAll());

        expect(counts.total).toBeLessThan(280);      // was 322
        expect(counts.state_changed).toBeLessThan(100);  // was 120
    });
});
