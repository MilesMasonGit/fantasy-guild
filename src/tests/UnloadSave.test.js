// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { SaveManager } from '../systems/core/SaveManager.js';

/**
 * The browser and dev builds save as the page is left, whatever the Auto-save setting: Off means
 * no timer, not that a closed tab loses the session. Its own file, so the page's one listener is
 * not already bound by another test.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));

const interval = { minutes: 0 };
vi.mock('../systems/core/SettingsManager.js', () => ({
    SettingsManager: { get: vi.fn(() => interval.minutes) }
}));

const leave = () => window.dispatchEvent(new Event('beforeunload'));
const played = () => JSON.parse(localStorage.getItem(SaveManager.getSlotKey(0))).state.time.gameTimeMs;

beforeEach(() => {
    localStorage.clear();
    SaveManager.currentSlot = null;
    SaveManager.isResetting = false;
    SaveManager.resumeSaving();
});

afterEach(() => {
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    interval.minutes = 0;
    SaveManager.syncSettings();
});

describe('leaving the page saves the game', () => {
    it('with Auto-save Off from the start: no timer, and closing the tab still saves', () => {
        interval.minutes = 0;
        SaveManager.syncSettings();
        SaveManager.newGame(0);
        expect(SaveManager.autoSaveTimer).toBeNull();

        GameState.state.time.gameTimeMs = 3_600_000;
        leave();
        expect(played()).toBe(3_600_000);
    });

    it('nothing is saved with no slot open, while resetting, or while saving is suspended', () => {
        SaveManager.newGame(0);
        GameState.state.time.gameTimeMs = 100;
        leave();
        expect(played()).toBe(100);

        GameState.state.time.gameTimeMs = 200;
        SaveManager.suspendSaving();
        leave();
        SaveManager.resumeSaving();
        SaveManager.isResetting = true;
        leave();
        SaveManager.isResetting = false;
        SaveManager.currentSlot = null;
        leave();
        expect(played()).toBe(100);
    });

    it('a timer still runs when Auto-save is on', () => {
        interval.minutes = 10;
        SaveManager.syncSettings();
        SaveManager.newGame(0);
        expect(SaveManager.autoSaveTimer).not.toBeNull();
    });
});
