// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { QuestManager } from '../systems/quests/QuestManager.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The headless boot: `EngineBootstrap.startSlot` starts a game with no React at all, the one
 * way a game starts (the slot screen calls it too).
 *
 * It also keeps the new-game save honest: `SaveManager.newGame` claims the slot with a save
 * written **before** the opening Tokens and items exist. The next save used to be the autosave,
 * ten minutes on, so a game that died in its first ten minutes loaded as an empty table: no Guild
 * Hall, no way to recruit, a dead slot. This reads the stored slot back, the way a load would.
 */

const stored = (slot = 0) => JSON.parse(localStorage.getItem(SaveManager.getSlotKey(slot)));
const typesOf = (board) => Object.values(board.tokens || {}).map(t => t.typeId).sort();

describe('a slot starts with no React (EngineBootstrap.startSlot)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        GameLoop.stop();
        if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
        SaveManager.autoSaveTimer = null;
        SaveManager.currentSlot = null;
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('an empty slot: a new game, saved complete straight away, the loop running', async () => {
        const opened = vi.fn();
        expect(await EngineBootstrap.startSlot(0, { onOpened: opened })).toBe(true);
        expect(opened).toHaveBeenCalledTimes(1);
        expect(GameLoop.getIsRunning()).toBe(true);
        expect(SaveManager.currentSlot).toBe(0);

        const save = stored();
        expect(typesOf(save.state.board)).toContain('token_guild_hall');
        expect(save.state.inventory.items.item_oak_seedling).toBeTruthy();
        // And it is the same starter set the live game holds.
        expect(typesOf(save.state.board)).toEqual(typesOf(GameState.state.board));
    });

    it('a saved slot: loaded, the loop running, every saved Token back', async () => {
        await EngineBootstrap.startSlot(0);
        GameLoop.stop();
        const saved = Object.keys(stored().state.board.tokens).sort();

        GameState.initNew();
        expect(await EngineBootstrap.startSlot(0, { catchUp: false })).toBe(true);
        expect(GameLoop.getIsRunning()).toBe(true);
        // The tutorial's first quest may join them as the slot opens.
        expect(Object.keys(GameState.state.board.tokens)).toEqual(expect.arrayContaining(saved));
        expect(typesOf(GameState.state.board)).toContain('token_guild_hall');
    });

    it('the quests are checked as the slot opens, before the game boots', async () => {
        const order = [];
        vi.spyOn(QuestManager, 'onSlotOpened').mockImplementation(() => order.push('quests'));
        const boot = EngineBootstrap.onSlotSelected.bind(EngineBootstrap);
        vi.spyOn(EngineBootstrap, 'onSlotSelected').mockImplementation((...args) => {
            order.push('boot');
            return boot(...args);
        });
        await EngineBootstrap.startSlot(0);
        expect(order).toEqual(['quests', 'boot']);
    });

    it('a save that will not load: refused, nothing opened, the loop still', async () => {
        localStorage.setItem(SaveManager.getSlotKey(1), '{ not a save');
        const opened = vi.fn();
        expect(await EngineBootstrap.startSlot(1, { onOpened: opened })).toBe(false);
        expect(opened).not.toHaveBeenCalled();
        expect(GameLoop.getIsRunning()).toBe(false);
    });
});
