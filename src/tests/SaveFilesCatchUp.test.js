// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SaveFiles from '../systems/core/SaveFiles.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import * as Banners from '../systems/notifications/banners.js';
import { resetMatTuning } from '../config/matTuning.js';
import { fakeSaveDisk } from './fixtures/fakeSaveDisk.js';

/**
 * The catch-up's promises with the desktop build's save files (`SaveFiles.js`): the slot's file is
 * left exactly as it was until the catch-up's one save at the end, so a window closed or a game
 * killed part-way loses nothing and the next load plays the same time again; and "Load as I
 * left it" puts the file from before back, reloading only once it is on the disk.
 */

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const PLAYED_BEFORE = 5000;

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

let disk;

/** Slot 1's file: an empty game with 5 s played, saved `hoursAgo` ago. */
function plantSave(hoursAgo) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    GameState.state.time.gameTimeMs = PLAYED_BEFORE;
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = NOW - hoursAgo * HOUR;
    const text = JSON.stringify(save);
    disk.files.set('slot1.json', text);
    return text;
}

const played = (text) => JSON.parse(text).state.time.gameTimeMs;
const close = () => window.dispatchEvent(new CustomEvent(SaveFiles.CLOSE_REQUESTED_EVENT));

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    CatchUp.forgetUndo();
    Banners.reset();
    disk = fakeSaveDisk();
    SaveFiles.useBackend(disk);
    await SaveManager.loadSaveFiles();
    SaveManager.installCloseSave();
});

afterEach(async () => {
    await SaveFiles.flush();
    GameLoop.stop();
    vi.mocked(Date.now).mockRestore();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    CatchUp.forgetUndo();
    SaveFiles.useBackend(null);
    localStorage.clear();
    sessionStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a catch-up and the slot file', () => {
    it('loading leaves the file untouched while the catch-up plays, then saves once at the end', async () => {
        const before = plantSave(3);
        await SaveFiles.refreshAll();
        const seen = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_PROGRESS, ({ fraction }) => {
            // An autosave and a closing window while it plays: both refused, nothing written.
            const refused = fraction < 1 ? SaveManager.save(false) === false : true;
            if (fraction < 1) close();
            seen.push({ fraction, refused, writes: disk.writes().length, file: disk.main(0) });
        });
        try {
            expect(await EngineBootstrap.startSlot(0)).toBe(true);
        } finally {
            off();
        }
        await SaveFiles.flush();

        // Progress at the start and the end at least; the end's comes just before the save.
        expect(seen.map(s => s.fraction)).toEqual(expect.arrayContaining([0, 1]));
        for (const s of seen) {
            expect(s.refused).toBe(true);
            expect(s.writes).toBe(0);
            expect(s.file).toBe(before);
        }
        // The window was let close with the file as it was.
        expect(disk.closed).toBeGreaterThan(0);
        // The one save at the end: the caught-up game, the save from before kept as the backup.
        expect(disk.writes()).toHaveLength(1);
        expect(played(disk.main(0))).toBe(PLAYED_BEFORE + 3 * HOUR);
        expect(disk.backup(0)).toBe(before);
    });

    it('a catch-up cut off part-way leaves the file as it was, so the next load plays it again', async () => {
        const before = plantSave(3);
        await SaveFiles.refreshAll();
        expect(await SaveManager.loadSlot(0)).toBe(true);
        await expect(CatchUp.run({
            savedAt: SaveManager.loadedSavedAt, now: NOW, sliceMs: 0, yieldFn: () => Promise.resolve(),
            before: SaveManager.takeLoadedJson(),
            onProgress: (f) => {
                if (f > 0.5 && f < 1) {
                    close();
                    throw new Error('the game was killed');
                }
            }
        })).rejects.toThrow('the game was killed');
        await SaveFiles.flush();
        expect(disk.writes()).toHaveLength(0);
        expect(disk.main(0)).toBe(before);
        expect(disk.backup(0)).toBeNull();

        // The next load starts from the same save, and the same time away.
        SaveManager.currentSlot = null;
        expect(await SaveManager.loadSlot(0)).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
        expect(SaveManager.loadedSavedAt).toBe(NOW - 3 * HOUR);
    });
});

describe('a sleeping PC with the game open', () => {
    it('closing the window while it catches up keeps the game as it stood when the PC slept, dated then', async () => {
        const autosave = plantSave(0);
        await SaveFiles.refreshAll();
        expect(await EngineBootstrap.startSlot(0)).toBe(true);
        await SaveFiles.flush();
        GameLoop.stop();
        expect(disk.writes()).toHaveLength(0);
        // Played since the last autosave, then the lid closes for half an hour.
        GameState.state.time.gameTimeMs += 60_000;
        GameState.state.meta.guildName = 'Renamed before the sleep';
        const sleptAt = NOW - 30 * 60_000;

        let atClose = null;
        const closeWindow = disk.closeWindow;
        disk.closeWindow = async () => {
            atClose = { main: disk.main(0), backup: disk.backup(0), writes: disk.writes().length };
            return closeWindow();
        };
        let closed = false;
        await expect(CatchUp.run({
            savedAt: sleptAt, now: NOW, sliceMs: 0,
            onProgress: (f) => {
                if (f <= 0 || f >= 1) return;
                if (!closed) {
                    closed = true;
                    close();                               // the X, while the bar is up
                } else if (atClose) {
                    throw new Error('the window is gone');
                }
            }
        })).rejects.toThrow('the window is gone');
        await SaveFiles.flush();

        // The window waited for the save written before the catch-up, and nothing after it.
        expect(atClose.writes).toBe(1);
        expect(disk.writes()).toHaveLength(1);
        expect(disk.main(0)).toBe(atClose.main);
        const kept = JSON.parse(atClose.main);
        expect(kept.savedAt).toBe(sleptAt);
        expect(played(atClose.main)).toBe(PLAYED_BEFORE + 60_000);
        expect(kept.state.meta.guildName).toBe('Renamed before the sleep');
        expect(atClose.backup).toBe(autosave);

        // The next start: what was done before the sleep, and the whole sleep to catch up.
        SaveManager.currentSlot = null;
        CatchUp.forgetUndo();
        expect(await SaveManager.loadSlot(0)).toBe(true);
        expect(GameState.state.meta.guildName).toBe('Renamed before the sleep');
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 60_000);
        expect(SaveManager.loadedSavedAt).toBe(sleptAt);
    });
});

describe('opening a slot', () => {
    it('a second Load while the first is still reading the file is the same start: the save loads once', async () => {
        plantSave(3);
        await SaveFiles.refreshAll();
        let loads = 0;
        const off = EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => { loads++; });
        // As on the desktop: the catch-up takes several slices (a clock that moves with every
        // look), and the second click's own file reads come back while it plays.
        let clock = 0;
        const perf = vi.spyOn(performance, 'now').mockImplementation(() => (clock += 0.05));
        let playing;
        const catchUpPlaying = new Promise(resolve => { playing = resolve; });
        const offPlaying = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_PROGRESS, ({ fraction }) => {
            if (fraction > 0 && fraction < 1) playing();
        });
        // Unguarded, the second read out is the second click's: it comes back once the catch-up
        // plays. Guarded, it is the first click's own, which waits a moment and goes on.
        const read = disk.read;
        let reads = 0;
        disk.read = async (...args) => {
            if (++reads === 2) await Promise.race([catchUpPlaying, new Promise(r => setTimeout(r, 50))]);
            return read(...args);
        };
        try {
            const first = EngineBootstrap.startSlot(0);
            const second = EngineBootstrap.startSlot(0);  // the double-click
            expect(second).toBe(first);
            expect(await first).toBe(true);
        } finally {
            off();
            offPlaying();
            perf.mockRestore();
            disk.read = read;
        }
        await SaveFiles.flush();
        GameLoop.stop();
        expect(loads).toBe(1);
        expect(CatchUp.lastResult().simulatedMs).toBe(3 * HOUR);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 3 * HOUR);
        expect(disk.writes()).toHaveLength(1);
    });

    it('a refused load leaves Load working: the next click starts afresh', async () => {
        await SaveFiles.refreshAll();
        disk.files.set('slot1.json', 'not a save');
        expect(await EngineBootstrap.startSlot(0)).toBe(false);
        plantSave(0);
        expect(await EngineBootstrap.startSlot(0)).toBe(true);
        await SaveFiles.flush();
        GameLoop.stop();
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
    });

    it('a save copied into the folder after the slot screen read it is loaded, never overwritten by a new game', async () => {
        await SaveFiles.refreshAll();
        expect(SaveManager.hasSlot(0)).toBe(false);
        const copied = plantSave(0);
        expect(await EngineBootstrap.startSlot(0)).toBe(true);
        await SaveFiles.flush();
        GameLoop.stop();
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
        expect(disk.writes()).toHaveLength(0);
        expect(disk.main(0)).toBe(copied);
    });
});

describe('"Load as I left it" with files', () => {
    async function loadAndCatchUp() {
        const before = plantSave(3);
        await SaveFiles.refreshAll();
        expect(await EngineBootstrap.startSlot(0)).toBe(true);
        await SaveFiles.flush();
        GameLoop.stop();
        expect(CatchUp.canUndo()).toBe(true);
        return before;
    }

    it('writes the save from before back, dated now, and reloads only once it is on the disk', async () => {
        const before = await loadAndCatchUp();
        const caughtUp = disk.main(0);
        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            const release = disk.holdWrites();
            const undoing = CatchUp.undoLast();
            await new Promise(r => setTimeout(r, 0));
            // The file is still being written: no reload yet, and nothing else may save.
            expect(reload).not.toHaveBeenCalled();
            expect(sessionStorage.getItem('tabletop_guild_resume_slot')).toBeNull();
            expect(SaveManager.save(false)).toBe(false);
            // A second Confirm meanwhile is the same write.
            expect(CatchUp.undoLast()).toBe(undoing);
            release();
            expect(await undoing).toBe(true);
            await SaveFiles.flush();
            expect(reload).toHaveBeenCalledTimes(1);
            expect(disk.writes()).toHaveLength(2);           // the catch-up's end, and this one
            expect(CatchUp.canUndo()).toBe(false);
        } finally {
            reload.mockRestore();
        }

        const restored = JSON.parse(disk.main(0));
        expect(restored.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
        expect(restored.savedAt).toBe(NOW);
        expect(JSON.parse(before).savedAt).toBe(NOW - 3 * HOUR);
        // Written without rolling: the backup is the save being written back, which a roll first
        // would have lost to a write that then failed.
        expect(disk.backup(0)).toBe(before);
        expect(caughtUp).not.toBe(before);

        // The reloaded page opens the slot by itself, as it was left, with no catch-up.
        SaveManager.currentSlot = null;
        SaveManager.resumeSaving();
        expect(SaveManager.takeResumeSlot()).toBe(0);
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
        expect(SaveManager.loadedSavedAt).toBeNull();
    });

    it('a write that fails reloads nothing: the problem banner, the game saves again, and it can be tried again', async () => {
        const before = await loadAndCatchUp();
        const caughtUp = disk.main(0);
        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            disk.failWrites();
            expect(await CatchUp.undoLast()).toBe(false);
            await SaveFiles.flush();
            expect(reload).not.toHaveBeenCalled();
            expect(Banners.getAll().map(b => b.parts?.title)).toContain('Load failed');
            expect(sessionStorage.getItem('tabletop_guild_resume_slot')).toBeNull();
            expect(SaveManager.savingSuspended).toBe(false);
            expect(disk.main(0)).toBe(caughtUp);
            expect(CatchUp.canUndo()).toBe(true);

            // The disk is back: the same choice again puts the save from before back.
            disk.failWrites(null);
            expect(await CatchUp.undoLast()).toBe(true);
            await SaveFiles.flush();
            expect(reload).toHaveBeenCalledTimes(1);
            expect(played(disk.main(0))).toBe(played(before));
            expect(JSON.parse(disk.main(0)).savedAt).toBe(NOW);
            expect(sessionStorage.getItem('tabletop_guild_resume_slot')).toBe('0');
        } finally {
            reload.mockRestore();
        }
    });
});
