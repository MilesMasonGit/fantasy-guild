// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import S2 from '../../bench/scenarios/s2-realistic.mjs';
import S3 from '../../bench/scenarios/s3-torture.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * the save is written without deep-copying the state first, and its bytes are
 * exactly what they were.
 */

/** The bench's seeded generator (bench/lib/prelude.mjs, mulberry32). */
function seeded(seed = 1) {
    let state = seed | 0;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function buildAndPlay(scenario, ticks) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    await scenario.build({ fixtures, setMatTuning, now: () => 0 });
    TileModifiers.rebuildAll();
    EventBus.publish('state_changed');
    for (let i = 0; i < ticks; i++) GameLoop.runHandlers(100);
}

function expectSameBytes() {
    const before = GameState.state.meta.lastSavedAt;
    const expected = JSON.stringify(GameState.serialize());
    const actual = GameState.serializeJson();
    expect(actual.length).toBe(expected.length);
    expect(actual === expected).toBe(true);

    // The runtime props really were there to strip, and the live state is
    // left as it was.
    expect(GameState.state.heroes.length).toBe(8);
    expect(GameState.state.heroes.every(h => h.aggregator)).toBe(true);
    expect(JSON.parse(actual).state.heroes.some(h => 'aggregator' in h || 'level' in h)).toBe(false);
    expect(GameState.state.meta.lastSavedAt).toBe(before);

    // What the save itself writes.
    SaveManager.currentSlot = 0;
    expect(SaveManager.save(false)).toBe(true);
    expect(localStorage.getItem(SaveManager.getSlotKey(0)) === expected).toBe(true);
    return expected.length;
}

describe('the save bytes are identical without the deep copy (CR3-109)', () => {
    beforeAll(() => {
        vi.spyOn(Math, 'random').mockImplementation(seeded(1));
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        SettingsManager.init();
        EngineBootstrap.init();
        GameLoop.stop();
    });

    afterEach(() => {
        SaveManager.currentSlot = null;
        localStorage.clear();
    });

    afterAll(() => {
        vi.restoreAllMocks();
        resetMatTuning();
    });

    it('on the S2 board (realistic late game) after 300 ticks', async () => {
        await buildAndPlay(S2, 300);
        expect(expectSameBytes()).toBeGreaterThan(20_000);
    }, 30000);

    it('on the S3 board (torture) after 100 ticks', async () => {
        await buildAndPlay(S3, 100);
        expect(expectSameBytes()).toBeGreaterThan(50_000);
    }, 60000);
});
