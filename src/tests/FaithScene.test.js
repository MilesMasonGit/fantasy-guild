import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Shrines from '../systems/board/Shrines.js';
import { resetMatTuning } from '../config/matTuning.js';
import { setUpFaithScene, QA_FAITH_WOOD } from '../ui/dev/faithScene.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The QA panel's shrine scene (brief 810 K3's eye-check), played through the real loop: the QA
 * Shrine lights on its first offering, its vein keeps its charges while it is lit, and once the
 * wood is gone it burns down, goes out, and the vein runs out. ⚠️ Deleted with the scene once the
 * eye-check is accepted.
 */

const step = (ms) => { for (let t = 0; t < ms; t += 100) GameLoop.runHandlers(100); };

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});
afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
});
afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the QA shrine scene', () => {
    it('lit, the vein never runs out; the wood gone, it fades and the vein runs out', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        TileModifiers.clearAll();
        const r = setUpFaithScene();
        expect(r.ok, r.error).toBe(true);
        const shrine = () => BoardState.getTokenById(r.shrineId);
        const vein = () => BoardState.getTokenById(r.veinId);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(QA_FAITH_WOOD);

        step(1100);
        expect(Shrines.isLit(shrine())).toBe(true);
        // Lit for long enough to see: the vein works on past its three charges.
        step(20_000);
        expect(vein()?.usesRemaining).toBe(3);

        // Six offerings of 20 s, at most 90 s: the wood runs out, then the shrine burns down.
        step(150_000);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
        expect(Shrines.isLit(shrine())).toBe(false);
        step(10_000);
        expect(vein()).toBeNull();
    });
});
