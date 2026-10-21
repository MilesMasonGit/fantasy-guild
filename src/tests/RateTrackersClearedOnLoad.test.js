// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../systems/core/SaveManager.js';
import { ItemRateTracker } from '../systems/inventory/ItemRateTracker.js';
import { XpRateTracker } from '../systems/hero/XpRateTracker.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * The production and XP rates are a window over the game being played. Loading another save (or
 * starting a new one) must not show the previous game's rates: its gains were stamped with that
 * game's clock, so they could linger for minutes or, from a later clock, never age out at all.
 */
describe('rate trackers are cleared when a game is loaded or started', () => {
    beforeEach(() => localStorage.clear());

    afterEach(() => {
        if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
        SaveManager.autoSaveTimer = null;
        SaveManager.currentSlot = null;
        ItemRateTracker.clearAll();
        XpRateTracker.clearAll();
        localStorage.clear();
    });

    function recordSomething() {
        ItemRateTracker.recordGain('item_oak_log', 5);
        XpRateTracker.recordGain('hero_1', 'forestry', 40);
        expect(ItemRateTracker.getRate('item_oak_log')).toBeGreaterThan(0);
        expect(XpRateTracker.getRate('hero_1', 'forestry')).toBeGreaterThan(0);
    }

    it('a new game starts with no rates', () => {
        recordSomething();
        SaveManager.newGame(0);
        expect(ItemRateTracker.getRate('item_oak_log')).toBe(0);
        expect(XpRateTracker.getRate('hero_1', 'forestry')).toBe(0);
    });

    it('loading a save starts with no rates', async () => {
        SaveManager.newGame(0);
        recordSomething();
        expect(await SaveManager.loadSlot(0)).toBe(true);
        expect(ItemRateTracker.getRate('item_oak_log')).toBe(0);
        expect(XpRateTracker.getRate('hero_1', 'forestry')).toBe(0);
    });
});
