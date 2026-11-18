// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as Banners from '../systems/notifications/banners.js';
import { resetMatTuning } from '../config/matTuning.js';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { CatchUpOverlay } from '../ui/components/hud/CatchUpOverlay.jsx';

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
/** A save as it was serialized, dated `at` instead. */
const datedAt = (save, at) => ({ ...save, savedAt: at, state: { ...save.state, meta: { ...save.state.meta, lastSavedAt: at } } });

/** Writes to the slot's key throw, as a full browser storage does; the returned function stops it. */
function fillStorage(slot = 0) {
    const setItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
        if (key === SaveManager.getSlotKey(slot)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return setItem.call(this, key, value);
    });
    return () => spy.mockRestore();
}

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
    it('a catch-up that shows and saves keeps the game as it stood before it played, dated when the time away began', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        const before = JSON.parse(GameState.serializeJson());
        expect(CatchUp.canUndo()).toBe(false);
        await run({ savedAt: NOW - 3 * HOUR });
        expect(GameState.state.time.gameTimeMs).toBe(5000 + 3 * HOUR);
        expect(CatchUp.canUndo()).toBe(true);
        expect(CatchUp.undoSince()).toBe(NOW - 3 * HOUR);

        const restore = vi.spyOn(SaveManager, 'restoreAndReload').mockImplementation(() => true);
        try {
            expect(await CatchUp.undoLast()).toBe(true);
            expect(restore).toHaveBeenCalledTimes(1);
            const [slot, json] = restore.mock.calls[0];
            expect(slot).toBe(0);
            expect(JSON.parse(json)).toEqual(datedAt(before, NOW - 3 * HOUR));
        } finally {
            restore.mockRestore();
        }
    });

    it('a load hands over the save it read, byte for byte, and writes nothing before it plays', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        const raw = '{"untouched":"the bytes the slot held"}';
        localStorage.setItem(SaveManager.getSlotKey(0), raw);
        let atStart = null;
        const off = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_STARTED, () => { atStart = slotJson(0); });
        try {
            await run({ savedAt: NOW - 3 * HOUR, before: raw });
        } finally {
            off();
        }
        expect(atStart).toBe(raw);
        expect(CatchUp.undoSince()).toBe(NOW - 3 * HOUR);
        const restore = vi.spyOn(SaveManager, 'restoreAndReload').mockImplementation(() => true);
        try {
            await CatchUp.undoLast();
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
        const slotBefore = slotJson(0);
        await run({ savedAt: NOW - 3 * HOUR, save: false });
        expect(CatchUp.canUndo()).toBe(false);
        expect(slotJson(0)).toBe(slotBefore);                       // the bench's: nothing written, before or after
        SaveManager.currentSlot = null;
        await run({ savedAt: NOW - 3 * HOUR });
        expect(CatchUp.canUndo()).toBe(false);
        expect(await CatchUp.undoLast()).toBe(false);
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

    it('a second time away while the summary is open: the undo still goes back before the first, and says since when', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        const asLeft = JSON.parse(GameState.serializeJson());
        const first = await run({ savedAt: NOW - 3 * HOUR });
        expect(first.savedAt).toBe(NOW - 3 * HOUR);
        // The summary is still open when the PC sleeps for two hours.
        const second = await run({ savedAt: NOW, now: NOW + 2 * HOUR });
        expect(second).toMatchObject({ show: true, savedAt: NOW });
        expect(CatchUp.undoSince()).toBe(NOW - 3 * HOUR);

        const restore = vi.spyOn(SaveManager, 'restoreAndReload').mockImplementation(() => true);
        try {
            expect(await CatchUp.undoLast()).toBe(true);
            expect(JSON.parse(restore.mock.calls[0][1])).toEqual(datedAt(asLeft, NOW - 3 * HOUR));
        } finally {
            restore.mockRestore();
        }
    });
});

describe('a write back that fails can be tried again', () => {
    afterEach(() => Banners.reset());

    it('a full browser storage: the undo is kept, nothing reloads, the game saves again; the retry works', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        await run({ savedAt: NOW - 3 * HOUR });
        const caughtUp = slotJson(0);
        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            const stopFilling = fillStorage(0);
            try {
                expect(await CatchUp.undoLast()).toBe(false);
            } finally {
                stopFilling();
            }
            expect(reload).not.toHaveBeenCalled();
            expect(CatchUp.canUndo()).toBe(true);
            expect(SaveManager.savingSuspended).toBe(false);
            expect(sessionStorage.getItem('fantasy_guild_resume_slot')).toBeNull();
            expect(slotJson(0)).toBe(caughtUp);
            expect(Banners.getAll().map(b => b.parts?.title)).toContain('Load Failed');

            // Space freed: the same button again.
            expect(await CatchUp.undoLast()).toBe(true);
            expect(reload).toHaveBeenCalledTimes(1);
            expect(JSON.parse(slotJson(0)).state.time.gameTimeMs).toBe(5000);
            expect(CatchUp.canUndo()).toBe(false);
            expect(SaveManager.takeResumeSlot()).toBe(0);
        } finally {
            reload.mockRestore();
        }
    });

    it('a second press while the first is being written gets the first one\'s answer and writes nothing more', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        await run({ savedAt: NOW - 3 * HOUR });
        let finish;
        const restore = vi.spyOn(SaveManager, 'restoreAndReload').mockImplementation(() => new Promise(r => { finish = r; }));
        try {
            const first = CatchUp.undoLast();
            const second = CatchUp.undoLast();
            expect(second).toBe(first);
            expect(restore).toHaveBeenCalledTimes(1);
            finish(false);
            expect(await first).toBe(false);
            expect(CatchUp.canUndo()).toBe(true);
            // Once answered, a new press writes again.
            const third = CatchUp.undoLast();
            expect(third).not.toBe(first);
            expect(restore).toHaveBeenCalledTimes(2);
            finish(true);
            expect(await third).toBe(true);
            expect(CatchUp.canUndo()).toBe(false);
        } finally {
            restore.mockRestore();
        }
    });
});

describe('SaveManager: writing the old save back and reloading', () => {
    it('writes the save back dated now, refuses every later save, and reloads once into that slot', async () => {
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
            const written = SaveManager.restoreAndReload(1, oldJson);
            // A browser writes and reloads at once; the answer follows.
            expect(reload).toHaveBeenCalledTimes(1);
            expect(await written).toBe(true);
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

describe('the summary: only a confirmed Load as I left it writes the old save back', () => {
    afterEach(() => cleanup());

    it('cancelling keeps the catch-up and its undo; confirming restores the save from before', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        const before = JSON.parse(GameState.serializeJson());
        render(React.createElement(CatchUpOverlay));
        await act(async () => { await run({ savedAt: NOW - 3 * HOUR }); });
        const q = (sel) => document.querySelector(sel);
        expect(q('[data-catch-up-summary]')).not.toBeNull();

        const restore = vi.spyOn(SaveManager, 'restoreAndReload').mockImplementation(() => true);
        try {
            act(() => { fireEvent.click(q('[data-summary-undo]')); });
            act(() => { fireEvent.click(q('[data-summary-confirm-no]')); });
            act(() => { fireEvent.click(q('[data-summary-undo]')); });
            act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
            expect(restore).not.toHaveBeenCalled();
            expect(CatchUp.canUndo()).toBe(true);
            expect(GameState.state.time.gameTimeMs).toBe(5000 + 3 * HOUR);

            act(() => { fireEvent.click(q('[data-summary-undo]')); });
            await act(async () => { fireEvent.click(q('[data-summary-confirm-yes]')); });
            expect(restore).toHaveBeenCalledTimes(1);
            const [slot, json] = restore.mock.calls[0];
            expect(slot).toBe(0);
            expect(JSON.parse(json)).toEqual(datedAt(before, NOW - 3 * HOUR));
        } finally {
            restore.mockRestore();
        }
    });

    it('a write that fails leaves the summary open, says so, and Load as I left it works again', async () => {
        emptyGame(5000);
        SaveManager.currentSlot = 0;
        render(React.createElement(CatchUpOverlay));
        await act(async () => { await run({ savedAt: NOW - 3 * HOUR }); });
        const q = (sel) => document.querySelector(sel);
        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            const stopFilling = fillStorage(0);
            try {
                act(() => { fireEvent.click(q('[data-summary-undo]')); });
                await act(async () => { fireEvent.click(q('[data-summary-confirm-yes]')); });
            } finally {
                stopFilling();
            }
            expect(reload).not.toHaveBeenCalled();
            expect(q('[data-catch-up-summary]')).not.toBeNull();
            expect(q('[data-summary-undo-failed]')?.textContent).toBe('Could not load the game as you left it. You can try again.');
            expect(q('[data-summary-undo]')).not.toBeNull();
            expect(CatchUp.canUndo()).toBe(true);

            act(() => { fireEvent.click(q('[data-summary-undo]')); });
            await act(async () => { fireEvent.click(q('[data-summary-confirm-yes]')); });
            expect(reload).toHaveBeenCalledTimes(1);
            expect(JSON.parse(slotJson(0)).state.time.gameTimeMs).toBe(5000);
        } finally {
            reload.mockRestore();
            Banners.reset();
        }
    });
});
