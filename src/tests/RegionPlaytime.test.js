// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { GameState } from '../state/GameState.js';
import { createRegionRecord, validateSaveData } from '../state/StateSchema.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ A place's playtime (brief 570 D4; owner, 2026-11-10: time away counts too): every tick adds
 * its time to the Region the guild is in, live play and the catch-up alike, and the count is kept
 * in the save. An older save's Regions have none and start counting at 0.
 */

const NOW = 1_800_000_000_000;
const MIN = 60_000;

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
}

const tick = (n, ms = 100) => { for (let i = 0; i < n; i++) GameLoop.runHandlers(ms); };

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});
beforeEach(() => newGame());
afterEach(() => {
    SaveManager.currentSlot = null;
    GameLoop.stop();
});
afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a place\'s playtime', () => {
    it('is a declared Region field that starts at 0, the Starter Camp\'s included', () => {
        expect(createRegionRecord('x').playtimeMs).toBe(0);
        const home = Atlas.activeRegionId();
        expect(home).toBeTruthy();
        expect(Atlas.getRegion(home).playtimeMs).toBe(0);
        expect(Atlas.playtimeOf(home)).toBe(0);
    });

    it('⭐ live ticks add to the place the guild is on, and only there; travel moves the count with the guild', () => {
        const home = Atlas.activeRegionId();
        const away = Atlas.devCreateEmptyRegion().id;
        const total = GameState.state.meta.totalPlaytime;

        tick(50);
        expect(Atlas.playtimeOf(home)).toBe(5000);
        expect(Atlas.playtimeOf(away)).toBe(0);
        expect(GameState.state.meta.totalPlaytime - total).toBe(5000);

        expect(Atlas.travel(away).success).toBe(true);
        tick(30);
        expect(Atlas.playtimeOf(away)).toBe(3000);
        expect(Atlas.playtimeOf(home)).toBe(5000);
    });

    it('⭐ the catch-up adds the whole time away to the place the guild was on', async () => {
        const home = Atlas.activeRegionId();
        const away = Atlas.devCreateEmptyRegion().id;
        expect(Atlas.travel(away).success).toBe(true);
        tick(10);
        const r = await CatchUp.run({ savedAt: NOW - (10 * MIN + 500), now: NOW, save: false, reset: false, yieldFn: () => Promise.resolve() });
        expect(r.simulatedMs).toBe(10 * MIN + 500);
        expect(Atlas.playtimeOf(away)).toBe(1000 + 10 * MIN + 500);
        expect(Atlas.playtimeOf(home)).toBe(0);
    });

    it('is kept in the save and counts on after a load', () => {
        tick(20);
        const home = Atlas.activeRegionId();
        const data = JSON.parse(GameState.serializeJson());
        expect(data.state.atlas.regions[home].playtimeMs).toBe(2000);
        const state = migrateState(data.state, data.version);
        expect(validateSaveData({ version: data.version, state }).errors).toEqual([]);
        loadSavedState(state);
        expect(Atlas.playtimeOf(home)).toBe(2000);
        tick(5);
        expect(Atlas.playtimeOf(home)).toBe(2500);
    });

    it('an older save whose Regions have no count still loads, reads 0, and starts counting', () => {
        const home = Atlas.activeRegionId();
        const away = Atlas.devCreateEmptyRegion().id;
        const data = JSON.parse(GameState.serializeJson());
        for (const region of Object.values(data.state.atlas.regions)) delete region.playtimeMs;
        const state = migrateState(data.state, data.version);
        expect(validateSaveData({ version: data.version, state }).errors).toEqual([]);
        loadSavedState(state);
        expect(Atlas.getRegion(home).playtimeMs).toBeUndefined();
        expect(Atlas.playtimeOf(home)).toBe(0);
        tick(3);
        expect(Atlas.playtimeOf(home)).toBe(300);
        expect(Atlas.playtimeOf(away)).toBe(0);
    });

    it('nothing is counted before a game exists, nor for no time', () => {
        Atlas.addPlaytime(0);
        expect(Atlas.playtimeOf(Atlas.activeRegionId())).toBe(0);
        GameState.state.atlas = null;
        expect(() => Atlas.addPlaytime(100)).not.toThrow();
    });
});
