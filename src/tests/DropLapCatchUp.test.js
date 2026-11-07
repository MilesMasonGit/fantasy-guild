// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as PassiveProduction from '../systems/board/PassiveProduction.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { registerHallSky, authoredHallSky } from '../config/registries/hallStarRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';

const LAP_STAR_ID = 'star_well_lap';

/**
 * Brief 390 G5: the drop lap away from the game agrees with the lap at the table. A save holding
 * the Guild Hall (Wishing Well rank 1, 10 Water a lap) is loaded an hour after it was written and
 * caught up in the catch-up's 1 s steps, through the real load (`EngineBootstrap.onSlotSelected`),
 * and the same hour is played at live play's 100 ms ticks: both pay the same Water, at the lap the
 * save's lap star gives (10 minutes with none, 5 at its top rank).
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

/** The authored sky, which holds the lap star. */
function skyWithLap() {
    const authored = authoredHallSky();
    return { constellations: { ...authored.constellations }, stars: { ...authored.stars } };
}

/** Slot 0 holds a game with the Guild Hall on the mat, saved at `savedAt` with the lap star at `rank`. */
function writeSlot(savedAt, rank) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    const hall = BoardState.createTokenInstance('token_guild_hall');
    expect(Placement.placeTokenAt(hall, { x: 900, y: 600 })?.success).toBe(true);
    GameState.state.progress.guildUpgrades = { wishing_well: 1, [LAP_STAR_ID]: rank };
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = savedAt;
    localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(save));
}

const water = () => InventoryManager.getItemCount('item_water') + SpriteLayer.countOnBoard('item_water');

/** The hour away, caught up on load: the real path, rules applied by the load before the catch-up plays. */
async function awayAnHour(rank) {
    writeSlot(NOW - HOUR, rank);
    expect(await SaveManager.loadSlot(0)).toBe(true);
    await EngineBootstrap.onSlotSelected(0, false);
    GameLoop.stop();
    expect(CatchUp.lastResult()).toMatchObject({ simulatedMs: HOUR, droppedMs: 0 });
    return { water: water(), lap: PassiveProduction.lapMs() };
}

/** The same hour at the table: the save loaded with no catch-up, then 100 ms ticks. */
async function liveAnHour(rank, stepMs = 100) {
    writeSlot(NOW, rank);
    expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
    GameLoop.stop();
    for (let t = 0; t < HOUR; t += stepMs) GameLoop.runHandlers(stepMs);
    return { water: water(), lap: PassiveProduction.lapMs() };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerHallSky(skyWithLap());
});

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
    GameLoop.stop();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    CatchUp.forgetUndo();
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(Date.now).mockRestore();
});

afterAll(() => {
    registerHallSky(null);
    HallRules.apply({});
    GuildUpgradeManager.recompute();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ an hour away pays what an hour at the table does, at either lap', () => {
    it('no lap star: a 10-minute lap, six laps of Water both ways', async () => {
        const away = await awayAnHour(0);
        const live = await liveAnHour(0);
        expect(away).toEqual({ water: 60, lap: 10 * MIN });
        expect(live).toEqual(away);
    });

    it('the lap star at its top rank: a 5-minute lap, twelve laps both ways', async () => {
        const away = await awayAnHour(3);
        const live = await liveAnHour(3);
        expect(away).toEqual({ water: 120, lap: 5 * MIN });
        expect(live).toEqual(away);
        // The catch-up's own step length, played plainly, agrees too.
        expect(await liveAnHour(3, 1000)).toEqual(away);
    });
});
