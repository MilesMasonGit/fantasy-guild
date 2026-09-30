import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameLoop } from '../systems/core/GameLoop.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * CR3-100 — a brand-new game is saved complete straight away.
 *
 * `SaveManager.newGame` claims the slot with a save written **before** the
 * opening Tokens and items exist (they are made later, in `onSlotSelected`).
 * The next save was the autosave, ten minutes on, so a game that died in its
 * first ten minutes loaded as an empty table: no Guild Hall, no way to recruit,
 * a dead slot. This reads the stored slot back, the way a load would.
 */

describe('a new game is saved complete straight away (CR3-100)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        GameLoop.stop();
        if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
        SaveManager.autoSaveTimer = null;
        SaveManager.currentSlot = null;
        localStorage.clear();
    });

    it('the stored slot holds the Guild Hall and the opening items', () => {
        SaveManager.newGame(0);
        EngineBootstrap.onSlotSelected(0, true);
        GameLoop.stop();

        const stored = JSON.parse(localStorage.getItem(SaveManager.getSlotKey(0)));
        const tokens = Object.values(stored.state.board.tokens || {}).map(t => t.typeId);
        expect(tokens).toContain('token_guild_hall');
        expect(stored.state.inventory.items.item_oak_seed).toBeTruthy();

        // And it is the same starter set the live game holds.
        expect(tokens.sort()).toEqual(Object.values(GameState.state.board.tokens).map(t => t.typeId).sort());
    });
});
