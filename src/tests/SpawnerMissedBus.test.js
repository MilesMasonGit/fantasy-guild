import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * A spawner with nowhere to land misses that spawn and waits one whole interval for its next try
 * (owner: a missed bus waits for the next one). It never searches the mat again on the ticks in
 * between, whatever leaves the mat meanwhile, and big catch-up steps end exactly as small ticks do.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const INTERVAL = 5000;

registerTokenTypes({
    fixture_bus_forest: {
        id: 'fixture_bus_forest', name: 'Fixture Bus Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_passive', weight: 1 }], allowance: 3, intervalMs: INTERVAL, upkeep: [] }
    }
});

const FOREST_AT = { x: 200, y: 200 };

/** A 6-step mat packed with placed blockers at the minimum gap, clear only round `FOREST_AT`. */
function packedMat() {
    setMatTuning('matSteps', 6);
    setMatTuning('tokenCap', 2000);   // crowding is the point, not the Token cap
    const gap = Math.ceil(MatPlacement.minGap('fixture_kitchen', 'fixture_kitchen'));
    const x0 = 64 + ((matW() - 128) % gap) / 2;
    const y0 = 64 + ((matH() - 128) % gap) / 2;
    const blockers = [];
    for (let x = x0; x <= matW() - 64; x += gap) {
        for (let y = y0; y <= matH() - 64; y += gap) {
            if (Math.hypot(x - FOREST_AT.x, y - FOREST_AT.y) < gap) continue;
            blockers.push(placeAt('fixture_kitchen', x, y));
        }
    }
    return blockers;
}

/** Take every blocker within 400 u of the Forest off the mat: room for its spawns. */
function makeRoom(blockers) {
    for (const b of blockers) {
        if (Math.hypot(b.x - FOREST_AT.x, b.y - FOREST_AT.y) < 400) BoardState.removeToken(b.id);
    }
}

const spawned = () => BoardState.tokens().filter(t => t.typeId === 'fixture_passive');

/** How many placement searches a call made (every landing asks `findSpot` first). */
function searchesDuring(fn) {
    const spy = vi.spyOn(MatPlacement, 'findSpot');
    try {
        fn();
        return spy.mock.calls.length;
    } finally {
        spy.mockRestore();
    }
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
    SpawnerSystem.resetAlerts();
});

afterEach(() => resetMatTuning());

describe('⭐ a spawner with no room misses that spawn and waits a whole interval', () => {
    it('tries once when its clock comes round, then not on any tick until the next lap', () => {
        packedMat();
        const forest = placeAt('fixture_bus_forest', FOREST_AT.x, FOREST_AT.y);

        expect(searchesDuring(() => TimedChanges.tick(INTERVAL - 100))).toBe(0);
        expect(searchesDuring(() => TimedChanges.tick(100))).toBeGreaterThan(0);   // the try, missed
        expect(spawned()).toHaveLength(0);
        expect(forest.clocks.spawnMs).toBe(0);                                     // a fresh lap
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'no_room', nextInMs: INTERVAL });

        let between = 0;
        for (let t = 0; t < INTERVAL - 100; t += 100) between += searchesDuring(() => TimedChanges.tick(100));
        expect(between).toBe(0);                                                   // no search per tick
        expect(searchesDuring(() => TimedChanges.tick(100))).toBeGreaterThan(0);   // the next try
        expect(spawned()).toHaveLength(0);
    });

    it('room that appears just after a miss is taken at the next try, not before', () => {
        const blockers = packedMat();
        const forest = placeAt('fixture_bus_forest', FOREST_AT.x, FOREST_AT.y);

        TimedChanges.tick(INTERVAL);                      // missed
        makeRoom(blockers);
        for (let t = 0; t < INTERVAL - 100; t += 100) TimedChanges.tick(100);
        expect(spawned()).toHaveLength(0);
        expect(SpawnerSystem.spawnerStatus(forest.id).state).toBe('no_room');

        TimedChanges.tick(100);                           // one whole interval after the miss
        expect(spawned()).toHaveLength(1);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'spawning', nextInMs: INTERVAL });
    });

    it('a time step longer than the interval tries once a lap, as small ticks do', () => {
        packedMat();
        placeAt('fixture_bus_forest', FOREST_AT.x, FOREST_AT.y);
        // 3.5 intervals in one step: three tries, each missed, and half a lap left on the clock.
        expect(searchesDuring(() => TimedChanges.tick(3.5 * INTERVAL))).toBeGreaterThan(0);
        const [forest] = BoardState.tokens().filter(t => t.typeId === 'fixture_bus_forest');
        expect(forest.clocks.spawnMs).toBe(INTERVAL / 2);
    });
});

describe('⭐ catch-up steps end exactly as live ticks do', () => {
    /** One game-minute on a fresh packed mat in `step` ms steps, room made at 13 s; the end state. */
    function playMinute(step) {
        clearMat();
        SpawnerSystem.resetAlerts();
        const blockers = packedMat();
        const forest = placeAt('fixture_bus_forest', FOREST_AT.x, FOREST_AT.y);
        const spawnTimes = [];
        let t = 0;
        let roomMade = false;
        while (t < 60000) {
            if (!roomMade && t >= 13000) {
                makeRoom(blockers);
                roomMade = true;
            }
            TimedChanges.tick(step);
            t += step;
            while (spawnTimes.length < spawned().length) spawnTimes.push(t);
        }
        return {
            spawnTimes,
            points: spawned().map(s => [s.x, s.y]),
            clock: forest.clocks.spawnMs,
            status: SpawnerSystem.spawnerStatus(forest.id).state
        };
    }

    it('100 ms ticks and 1000 ms steps spawn the same Tokens at the same tries, in the same places', () => {
        const live = playMinute(100);
        const catchUp = playMinute(1000);
        // Missed at 5 and 10 s; room from 13 s; spawns at 15, 20 and 25 s, then at its cap.
        expect(live.spawnTimes).toEqual([15000, 20000, 25000]);
        expect(catchUp).toEqual(live);
    });
});
