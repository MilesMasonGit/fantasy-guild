// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as GroundRules from '../systems/board/GroundRules.js';
import * as FishingSpots from '../systems/board/FishingSpots.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import * as fixtures from '../../bench/fixtures.mjs';
import fishingScenario from '../../bench/scenarios/fs-fishing.mjs';
import { getTokenType, getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import { spotOf, isSpotKind, arrivesByItself } from '../config/registries/fishingSpots.js';

/**
 * The bench's fishing scenario (FS) does what it says: on its sea and lake, spots arrive by
 * themselves, the Fishing Huts' heroes fish them, and spots move on and arrive again, so the
 * measured window holds every part of the life cycle. Checked here so a board that quietly stopped
 * fishing is caught before a bench window is spent on it.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('FS, the fishing scenario', () => {
    it('stands on the 1920 × 1040 mat its water was drawn for, the huts beside dry land', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        fishingScenario.build({ fixtures, setMatTuning });
        expect([matW(), matH()]).toEqual([1920, 1040]);
        const huts = BoardState.tokens().filter(t => t.typeId === 'bench_fishing_hut');
        expect(huts).toHaveLength(2);
        for (const hut of huts) expect(GroundRules.waterKindAt(hut.x, hut.y)).toBeNull();
        // The spot building stands on the shore and raises the sea's rate, not by all of it.
        const chum = BoardState.tokens().find(t => t.typeId === 'bench_chum_station');
        expect(GroundRules.waterKindAt(chum.x, chum.y)).toBeNull();
        expect(FishingSpots.raisedRateOf('bench_spot')).toBeGreaterThan(1);
        expect(FishingSpots.raisedRateOf('bench_spot')).toBeLessThan(2);
        expect(GameState.state.heroes).toHaveLength(4);
        expect(GameState.state.heroes.every(h => h.equipment.includes('bench_rod') && h.equipment.includes('bench_bait'))).toBe(true);
        expect(GameState.state.heroes.filter(h => h.equipment.includes('bench_lure'))).toHaveLength(2);
    });

    it('over its warm-up and measured window spots arrive, are fished, and move on', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        fishingScenario.build({ fixtures, setMatTuning });
        TileModifiers.rebuildAll();
        const { warmup, measure } = fishingScenario.ticks();
        const seen = { landed: 0, left: 0, caught: 0 };
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.SPOT_LANDED, () => { seen.landed++; }),
            EventBus.subscribe(BOARD_EVENTS.SPOT_LEFT, () => { seen.left++; }),
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.produced?.length) seen.caught++; })
        ];
        try {
            for (let i = 0; i < warmup + measure; i++) GameLoop.runHandlers(100);
        } finally {
            offs.forEach(off => off());
        }
        expect(seen.landed).toBeGreaterThan(6);
        expect(seen.left).toBeGreaterThan(0);
        expect(seen.caught).toBeGreaterThan(20);
        // The lure is carried, picks its Cod and breaks now and then.
        expect(InventoryManager.getItemCount('bench_lure')).toBeLessThan(1000);
        expect(InventoryManager.getItemCount('bench_lure')).toBeGreaterThan(800);
        const spots = BoardState.tokens().filter(t => t.typeId === 'bench_spot' || t.typeId === 'bench_rare_spot');
        expect(spots.every(s => GroundRules.waterKindAt(s.x, s.y) !== null)).toBe(true);
        // Only the fixture kinds keep clocks and land: shipped spot kinds never move FS's work.
        expect(Object.keys(GameState.state.board.spotClocks || {}).sort()).toEqual(['bench_rare_spot', 'bench_spot']);
        expect(BoardState.tokens().filter(t => isSpotKind(getTokenType(t.typeId))).every(t => t.typeId.startsWith('bench_'))).toBe(true);
    });

    it('arrives only its own fixture spot kinds, whatever spot kinds the content ships', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        fishingScenario.build({ fixtures, setMatTuning });
        const arriving = Object.entries(getAllTokenTypes())
            .filter(([, def]) => arrivesByItself(spotOf(def)))
            .map(([id]) => id)
            .sort();
        expect(arriving).toEqual(['bench_rare_spot', 'bench_spot']);
    });
});
