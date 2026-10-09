// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { resetMatTuning } from '../config/matTuning.js';

/**
 * "Load as I left it": the summary's undo. The catch-up keeps the save from before it played;
 * turning the catch-up down writes that save back to the slot, dated now, and reloads the page,
 * which loads the slot again without a catch-up. Here `SaveManager`'s side is faked where the
 * catch-up is under test, and the page reload is faked where `SaveManager` is.
 */

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

function emptyGame(gameTimeMs = 5000) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    GameState.state.time.gameTimeMs = gameTimeMs;
}

const run = (opts) => CatchUp.run({ yieldFn: () => Promise.resolve(), now: NOW, ...opts });
const slotJson = (i = 0) => localStorage.getItem(SaveManager.getSlotKey(i));

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    CatchUp.forgetUndo();
});

afterEach(() => {
    vi.mocked(Date.now).mockRestore();
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
    sessionStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('what the catch-up keeps to go back to', () => {
    it('a catch-up that shows and saves keeps the game as it stood before it played', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        const before = JSON.parse(GameState.serializeJson());
        expect(CatchUp.canUndo()).toBe(false);
        await run({ savedAt: NOW - 3 * HOUR });
        expect(GameState.state.time.gameTimeMs).toBe(5000 + 3 * HOUR);
        expect(CatchUp.canUndo()).toBe(true);

        const restore = vi.spyOn(SaveManager, 'restoreAndReload').mockImplementation(() => true);
        try {
            expect(CatchUp.undoLast()).toBe(true);
            expect(restore).toHaveBeenCalledTimes(1);
            const [slot, json] = restore.mock.calls[0];
            expect(slot).toBe(0);
            expect(JSON.parse(json)).toEqual(before);
        } finally {
            restore.mockRestore();
        }
    });

    it('a load hands over the save it read, byte for byte', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        const raw = '{"untouched":"the bytes the slot held"}';
        await run({ savedAt: NOW - 3 * HOUR, before: raw });
        const restore = vi.spyOn(SaveManager, 'restoreAndReload').mockImplementation(() => true);
        try {
            CatchUp.undoLast();
            expect(restore).toHaveBeenCalledWith(0, raw);
        } finally {
            restore.mockRestore();
        }
    });

    it('nothing is kept for a silent catch-up, one that does not save (the bench), or a game with no slot', async () => {
        emptyGame();
        SaveManager.currentSlot = 0;
        await run({ savedAt: NOW - 90 * 1000 });                    // under 2 min: silent
        expect(CatchUp.canUndo()).toBe(false);
        await run({ savedAt: NOW - 3 * HOUR, save: false });
        expect(CatchUp.canUndo()).toBe(false);
        SaveManager.currentSlot = null;
        await run({ savedAt: NOW - 3 * HOUR });
        expect(CatchUp.canUndo()).toBe(false);
        expect(CatchUp.undoLast()).toBe(false);
    });

    it('a silent catch-up after the summary leaves the undo in place; forgetting it lets it go', async () => {
        emptyGame();
        SaveManager.currentSlot = 0;
        await run({ savedAt: NOW - 3 * HOUR });
        await run({ savedAt: NOW - 30 * 1000, save: false });
        expect(CatchUp.canUndo()).toBe(true);
        CatchUp.forgetUndo();
        expect(CatchUp.canUndo()).toBe(false);
    });

    it('a catch-up that dies half-way keeps nothing to go back to', async () => {
        emptyGame();
        SaveManager.currentSlot = 0;
        await expect(run({
            savedAt: NOW - 3 * HOUR, sliceMs: 0,
            onProgress: (f) => { if (f > 0.5 && f < 1) throw new Error('the window closed'); }
        })).rejects.toThrow('the window closed');
        expect(CatchUp.canUndo()).toBe(false);
    });
});

describe('SaveManager: writing the old save back and reloading', () => {
    it('writes the save back dated now, refuses every later save, and reloads once into that slot', () => {
        emptyGame(5000);
        const old = JSON.parse(GameState.serializeJson());
        old.savedAt = NOW - 3 * HOUR;
        old.state.meta.lastSavedAt = NOW - 3 * HOUR;
        const oldJson = JSON.stringify(old);

        // The slot holds the caught-up game.
        SaveManager.currentSlot = 1;
        SaveManager.startAutoSave();                         // binds the save on closing the window
        GameState.state.time.gameTimeMs = 5000 + 3 * HOUR;
        SaveManager.save(false);
        const caughtUp = slotJson(1);

        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            expect(SaveManager.restoreAndReload(1, oldJson)).toBe(true);
            expect(reload).toHaveBeenCalledTimes(1);
        } finally {
            reload.mockRestore();
        }

        const written = JSON.parse(slotJson(1));
        expect(written.savedAt).toBe(NOW);
        expect(written.state.meta.lastSavedAt).toBe(NOW);
        expect({ ...written, savedAt: old.savedAt, state: { ...written.state, meta: { ...written.state.meta, lastSavedAt: old.savedAt } } })
            .toEqual(old);
        expect(written.state.time.gameTimeMs).toBe(5000);
        expect(localStorage.getItem(`${SaveManager.getSlotKey(1)}_backup`)).toBe(caughtUp);

        // The window closing, or an autosave, must not write the turned-down game over it.
        const restored = slotJson(1);
        expect(SaveManager.save(false)).toBe(false);
        window.dispatchEvent(new Event('beforeunload'));
        expect(slotJson(1)).toBe(restored);

        // The page that loads next opens that slot, once.
        expect(SaveManager.takeResumeSlot()).toBe(1);
        expect(SaveManager.takeResumeSlot()).toBe(null);
    });

    it('a resume flag for an empty slot opens nothing', () => {
        sessionStorage.setItem('fantasy_guild_resume_slot', '2');
        expect(SaveManager.takeResumeSlot()).toBe(null);
    });

    it('a slot loaded without a catch-up has nothing to catch up', async () => {
        emptyGame(5000);
        const save = JSON.parse(GameState.serializeJson());
        save.savedAt = NOW - 3 * HOUR;
        localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(save));
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect(SaveManager.loadedSavedAt).toBe(null);
        expect(await SaveManager.loadSlot(0)).toBe(true);
        expect(SaveManager.loadedSavedAt).toBe(NOW - 3 * HOUR);
    });
});
