import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A finished work cycle carries the rest of its tick into the next cycle, so a cycle that ends
 * part-way through a tick loses nothing. Live ticks are ~100 ms and a catch-up's steps are 1000 ms;
 * both must produce the same number of cycles.
 */

const CYCLE_TIMES = [1000, 1234, 1500, 2500, 8000];

/** A hero-less station with one fixed cycle time; `inputs` optional. Unlimited charges. */
function stationType(cycleTimeMs, inputs = []) {
    return {
        id: `carry_station_${cycleTimeMs}_${inputs.length}`, name: `Carry ${cycleTimeMs}`, tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_industry',
        requiresHero: false,
        config: { skill: 'forestry', skillRequired: 0, cycleTimeMs, xp: 0, inputs, outputs: [] }
    };
}

registerTokenTypes(Object.fromEntries(CYCLE_TIMES.flatMap(ms => [
    [stationType(ms).id, stationType(ms)],
    [stationType(ms, [{ itemId: 'fixture_oak_wood', quantity: 1 }]).id,
        stationType(ms, [{ itemId: 'fixture_oak_wood', quantity: 1 }])]
])));

let completed;
let started;
const offs = [];

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.rebuildAll();
    while (offs.length) offs.pop()();
    completed = [];
    started = [];
    offs.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, p => completed.push(p.instanceId)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_START, p => started.push(p.instanceId)));
});

function placeStation(cycleTimeMs, inputs = []) {
    const station = placeAt(stationType(cycleTimeMs, inputs).id, 400, 400);
    TileModifiers.rebuildAll();
    return station;
}

/** Tick the board in `stepMs` steps for `totalMs`; how many cycles `station` completed. */
function cyclesOver(station, stepMs, totalMs) {
    for (let t = 0; t < totalMs; t += stepMs) BoardRunner.tick(stepMs);
    return completed.filter(id => id === station.id).length;
}

describe('a finished cycle keeps the rest of its tick', () => {
    it('a 1500 ms cycle completes 40 times in 60 s at 100 ms ticks and at 1000 ms steps', () => {
        expect(cyclesOver(placeStation(1500), 100, 60_000)).toBe(40);

        completed = [];
        clearMat();
        expect(cyclesOver(placeStation(1500), 1000, 60_000)).toBe(40);
    });

    it.each([1000, 1234, 2500, 8000])(
        'a %i ms cycle completes as many cycles, give or take one, over 10 game-minutes at either step',
        (cycleTimeMs) => {
            const expected = Math.floor(600_000 / cycleTimeMs);
            const atTicks = cyclesOver(placeStation(cycleTimeMs), 100, 600_000);

            completed = [];
            clearMat();
            const atSteps = cyclesOver(placeStation(cycleTimeMs), 1000, 600_000);

            expect(Math.abs(atTicks - expected)).toBeLessThanOrEqual(1);
            expect(Math.abs(atSteps - expected)).toBeLessThanOrEqual(1);
            expect(Math.abs(atTicks - atSteps)).toBeLessThanOrEqual(1);
        }
    );

    it('CYCLE_START fires once per cycle', () => {
        const station = placeStation(1234);
        const done = cyclesOver(station, 1000, 60_000);
        const starts = started.filter(id => id === station.id).length;
        // Every completed cycle started once, plus the one in progress when the minute ended, if any.
        expect(done).toBeGreaterThan(40);
        expect(starts).toBe(done + (station.cycleElapsedMs > 0 ? 1 : 0));
    });

    it('carries the overshoot into the cycle that starts on the next tick', () => {
        const station = placeStation(2500);
        BoardRunner.tick(1000);
        BoardRunner.tick(1000);
        BoardRunner.tick(1000);   // 3000 ≥ 2500: done, 500 left over
        expect(completed).toEqual([station.id]);
        expect(station.cycleElapsedMs).toBe(0);

        BoardRunner.tick(1000);
        expect(station.cycleElapsedMs).toBe(1500);
    });

    it('a station waiting for inputs after a cycle keeps no overshoot', () => {
        const station = placeStation(2500, [{ itemId: 'fixture_oak_wood', quantity: 1 }]);
        InventoryManager.addItem('fixture_oak_wood', 1);
        BoardRunner.tick(1000);
        BoardRunner.tick(1000);
        BoardRunner.tick(1000);   // done, the wood spent, 500 left over
        expect(completed).toEqual([station.id]);

        BoardRunner.tick(1000);   // no wood: it waits, and the 500 is gone
        expect(station.cycleElapsedMs).toBe(0);

        InventoryManager.addItem('fixture_oak_wood', 1);
        BoardRunner.tick(1000);
        expect(station.cycleElapsedMs).toBe(1000);
    });
});
