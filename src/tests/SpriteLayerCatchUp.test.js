import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as GameClock from '../systems/core/GameClock.js';
import { GameState } from '../state/GameState.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import './fixtures/fixtureItems.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Loot's timings are game time: during a catch-up the wall clock barely moves, so loot timed by it
 * would never merge into its stack or be auto-collected until the 40-stack cap swept it.
 */

const NOW = 1_800_000_000_000;
const SAVED_AT = NOW - 24 * 3_600_000;
const AT = { centre: { x: 400, y: 400 } };

function step(ms) {
    GameClock.advance(ms);
    SpriteLayer.tick(ms);
}

const bankWood = () => GameState.state.inventory.items.fixture_oak_wood?.quantity ?? 0;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);   // never advanced: the wall clock stands still through the catch-up
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    SettingsManager.set('gameplay.autoCollectLoot', true);
    SettingsManager.set('gameplay.autoCollectDelayMs', 2500);
    SettingsManager.set('gameplay.maxItemStacks', 40);
});

afterEach(() => {
    GameClock.end();
    vi.useRealTimers();
});

describe('loot during a catch-up', () => {
    it('loot made in a catch-up is absorbed 1.1 s and auto-collected 2.5 s of game time after it lands', () => {
        GameClock.begin(SAVED_AT);
        const first = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, AT);
        const second = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, AT);
        expect(second.targetStackId).toBe(first.id);
        expect(second.absorbAt).toBe(SAVED_AT + 1100);
        expect(first.bornAt).toBe(SAVED_AT);

        for (let i = 0; i < 10; i++) step(100);
        expect(SpriteLayer.getSprites()).toHaveLength(2);     // 1.0 s: still lingering
        step(100);
        expect(SpriteLayer.getSprites()).toHaveLength(1);     // 1.1 s: merged into its stack
        expect(first.quantity).toBe(2);

        for (let i = 11; i < 24; i++) step(100);
        expect(SpriteLayer.getSprites()).toHaveLength(1);     // 2.4 s: still on the floor
        expect(bankWood()).toBe(0);
        step(100);
        expect(SpriteLayer.getSprites()).toHaveLength(0);     // 2.5 s: collected
        expect(bankWood()).toBe(2);
    });

    it('live, loot is stamped with the wall clock', () => {
        const sprite = SpriteLayer.addSprite('item', 'fixture_oak_wood', 1, AT);
        expect(sprite.bornAt).toBe(NOW);
    });
});
