// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SaveFiles from '../systems/core/SaveFiles.js';
import * as SlotHelper from '../systems/core/SaveSlotHelper.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import * as Banners from '../systems/notifications/banners.js';
import * as World from '../systems/world/World.js';
import * as Occupation from '../systems/board/Occupation.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { isGuildHall } from '../systems/board/MatCap.js';
import { resetMatTuning } from '../config/matTuning.js';
import { fakeSaveDisk } from './fixtures/fakeSaveDisk.js';
import { stockSettleCoins } from './fixtures/worldQa.js';

/**
 * Settling a place and starting a new game each write one save, of the finished result: a crash
 * can only leave the save from before or the save from after, never one cut in half (a place
 * settled but unpaid, or with no arrival enemies; a slot with no Guild Hall).
 */

const NOW = 1_800_000_000_000;

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

let disk;

const hallOf = (save) => Object.values(save.state.board.tokens || {}).some(t => isGuildHall(t));

/** Every `SaveManager.save` from here on, with what the game held at that moment. */
function watchSaves() {
    const real = SaveManager.save;
    const seen = [];
    const spy = vi.spyOn(SaveManager, 'save').mockImplementation(function (...args) {
        seen.push({
            hall: Object.values(GameState.state.board?.tokens || {}).some(t => isGuildHall(t)),
            occupied: Occupation.isOccupied(),
            activeRegionId: GameState.state.atlas?.activeRegionId ?? null
        });
        return real.apply(this, args);
    });
    return { seen, stop: () => spy.mockRestore() };
}

async function startNewGame(slot = 0) {
    expect(SaveManager.hasSlot(slot)).toBe(false);
    expect(await EngineBootstrap.startSlot(slot)).toBe(true);
    await SaveFiles.flush();
    GameLoop.stop();
}

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
    resetMatTuning();
    CatchUp.forgetUndo();
    Banners.reset();
    disk = fakeSaveDisk();
    SaveFiles.useBackend(disk);
    await SaveManager.loadSaveFiles();
});

afterEach(async () => {
    await SaveFiles.flush();
    GameLoop.stop();
    vi.mocked(Date.now).mockRestore();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    SaveFiles.useBackend(null);
    localStorage.clear();
    sessionStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a new game saves once, the finished opening', () => {
    it('the desktop build writes one file, with the Guild Hall on the mat, and no empty backup', async () => {
        const saves = watchSaves();
        try {
            await startNewGame(0);
        } finally {
            saves.stop();
        }
        expect(saves.seen).toEqual([expect.objectContaining({ hall: true })]);
        expect(disk.writes()).toHaveLength(1);
        expect(hallOf(JSON.parse(disk.main(0)))).toBe(true);
        expect(disk.backup(0)).toBeNull();
    });

    it('the browser build writes one save, with the Guild Hall on the mat, and no empty backup', async () => {
        SaveFiles.useBackend(null);
        const saves = watchSaves();
        try {
            await startNewGame(1);
        } finally {
            saves.stop();
        }
        expect(saves.seen).toEqual([expect.objectContaining({ hall: true })]);
        expect(hallOf(JSON.parse(localStorage.getItem(SlotHelper.getSlotKey(1))))).toBe(true);
        expect(localStorage.getItem(SlotHelper.getBackupKey(1))).toBeNull();
    });
});

describe('settling a place saves once, at the very end', () => {
    it('one save, after the price is paid, the guild has moved and the arrival enemies stand on the mat', async () => {
        await startNewGame(0);
        const cell = World.currentWorld().cells.find(c => c.ring === 1);
        const hero = GameState.heroes[0];
        for (const { skill, level } of cell.requires.skills) addXP(hero.id, skill, xpForLevel(level) - (hero.skills[skill]?.xp || 0));
        for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
        stockSettleCoins(cell);
        const bankBefore = Object.fromEntries(cell.requires.items.map(({ itemId }) => [itemId, InventoryManager.getItemCount(itemId)]));
        const writesBefore = disk.writes().length;

        const saves = watchSaves();
        let result;
        try {
            result = World.settleCell(cell.id);
        } finally {
            saves.stop();
        }
        expect(result.success, result.reason).toBe(true);
        expect(result.arrival.ids.length).toBeGreaterThan(0);
        expect(saves.seen).toEqual([{ hall: true, occupied: true, activeRegionId: result.region.id }]);

        await SaveFiles.flush();
        expect(disk.writes().length - writesBefore).toBe(1);
        const saved = JSON.parse(disk.main(0));
        expect(saved.state.atlas.activeRegionId).toBe(result.region.id);
        expect(saved.state.atlas.regions[result.region.id].cellId).toBe(cell.id);
        expect(saved.state.board.arrival.ids).toEqual(result.arrival.ids);
        for (const id of result.arrival.ids) expect(saved.state.board.tokens[id]).toBeTruthy();
        for (const { itemId, need } of result.price.items) {
            expect(InventoryManager.getItemCount(itemId)).toBe(bankBefore[itemId] - need);
        }
    });

    it('a refused settle writes nothing', async () => {
        await startNewGame(0);
        const cell = World.currentWorld().cells.find(c => c.ring === 1);
        const writesBefore = disk.writes().length;
        const saves = watchSaves();
        try {
            expect(World.settleCell(cell.id).success).toBe(false);
        } finally {
            saves.stop();
        }
        expect(saves.seen).toEqual([]);
        await SaveFiles.flush();
        expect(disk.writes().length).toBe(writesBefore);
    });
});
