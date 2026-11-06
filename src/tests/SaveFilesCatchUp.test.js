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

describe('opening a slot', () => {
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
            expect(CatchUp.undoLast()).toBe(true);
            await new Promise(r => setTimeout(r, 0));
            // The file is still being written: no reload yet, and nothing else may save.
            expect(reload).not.toHaveBeenCalled();
            expect(sessionStorage.getItem('fantasy_guild_resume_slot')).toBeNull();
            expect(SaveManager.save(false)).toBe(false);
            release();
            await SaveFiles.flush();
            await new Promise(r => setTimeout(r, 0));
            expect(reload).toHaveBeenCalledTimes(1);
        } finally {
            reload.mockRestore();
        }

        const restored = JSON.parse(disk.main(0));
        expect(restored.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
        expect(restored.savedAt).toBe(NOW);
        expect(JSON.parse(before).savedAt).toBe(NOW - 3 * HOUR);
        expect(disk.backup(0)).toBe(caughtUp);

        // The reloaded page opens the slot by itself, as it was left, with no catch-up.
        SaveManager.currentSlot = null;
        SaveManager.resumeSaving();
        expect(SaveManager.takeResumeSlot()).toBe(0);
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
        expect(SaveManager.loadedSavedAt).toBeNull();
    });

    it('a write that fails reloads nothing: the problem banner, and the game saves again', async () => {
        await loadAndCatchUp();
        const caughtUp = disk.main(0);
        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            disk.failWrites();
            expect(CatchUp.undoLast()).toBe(true);
            await SaveFiles.flush();
            await new Promise(r => setTimeout(r, 0));
            expect(reload).not.toHaveBeenCalled();
        } finally {
            reload.mockRestore();
        }
        expect(Banners.getAll().map(b => b.parts?.title)).toContain('Load Failed');
        expect(sessionStorage.getItem('fantasy_guild_resume_slot')).toBeNull();
        expect(SaveManager.savingSuspended).toBe(false);
        expect(disk.main(0)).toBe(caughtUp);
    });
});
