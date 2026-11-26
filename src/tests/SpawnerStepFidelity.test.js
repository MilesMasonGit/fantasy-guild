import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Growth from '../systems/board/Growth.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { reachRadius } from '../systems/board/nearby.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * A catch-up plays the board in 1000 ms steps where live play ticks every 100 ms. A spawner must
 * spawn as often either way: one that counts its family within its reach and lands there, and an
 * enemy camp that counts what it spawned. Their intervals are not whole seconds, so a 1000 ms step
 * overshoots every due time and only the carried leftover keeps the laps the same length.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const HOUR_MS = 3_600_000;
const FOREST_MS = 4300;
const CAMP_MS = 7300;

const plain = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
registerTokenTypes({
    sf_forest: plain('sf_forest', {
        tokenType: 'spawner',
        spawner: { spawns: [{ typeId: 'sf_tree', weight: 1 }], allowance: 3, intervalMs: FOREST_MS, upkeep: [] }
    }),
    sf_tree: plain('sf_tree', { artSize: 'small' }),
    // Spawns a Sapling that grows within a fifth of a second.
    sf_nursery: plain('sf_nursery', {
        tokenType: 'spawner',
        spawner: { spawns: [{ typeId: 'sf_quick_sapling', weight: 1 }], allowance: 3, intervalMs: FOREST_MS, upkeep: [] }
    }),
    sf_quick_sapling: plain('sf_quick_sapling', { artSize: 'small', grows: { into: 'sf_tree', afterMs: 200 } }),
    sf_camp: plain('sf_camp', {
        tokenType: 'spawner', sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'sf_goblin', weight: 1 }], allowance: 2, intervalMs: CAMP_MS, upkeep: [] }
    }),
    sf_goblin: plain('sf_goblin', {
        tokenType: 'enemy', uses: 1, sprite: 's_crime', requiresHero: true,
        enemy: { level: 1, style: 'melee', hp: 6, xp: 3 }
    })
});

/** How often the oldest Token of each family leaves: whole seconds, so both step sizes see it at once. */
const LOSS_EVERY_MS = 3000;

/**
 * One game-hour in `stepMs` steps. Every {@link LOSS_EVERY_MS} the oldest Token of each family
 * leaves the mat, as a felled tree or a beaten goblin does, so both spawners stay under their
 * allowance and spawn on almost every lap.
 *
 * @returns {{forest: number, camp: number}} spawns by each over the hour
 */
function playHour(stepMs) {
    const forest = placeAt('sf_forest', 500, 500);
    const camp = placeAt('sf_camp', 1300, 500);
    const spawned = { [forest.id]: 0, [camp.id]: 0 };
    const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, (p) => {
        if (p.spawnerId in spawned) spawned[p.spawnerId] += 1;
    });
    try {
        for (let played = stepMs; played <= HOUR_MS; played += stepMs) {
            BoardRunner.tick(stepMs);
            if (played % LOSS_EVERY_MS !== 0) continue;
            for (const typeId of ['sf_tree', 'sf_goblin']) {
                const oldest = BoardState.tokens().find(t => t.typeId === typeId);
                if (oldest) BoardState.removeToken(oldest.id);
            }
        }
    } finally {
        off();
    }
    // The Forest's family stood within its reach the whole hour (it counts and lands only there).
    for (const tree of BoardState.tokens().filter(t => t.typeId === 'sf_tree')) {
        expect(Math.hypot(tree.x - forest.x, tree.y - forest.y)).toBeLessThanOrEqual(reachRadius());
    }
    return { forest: spawned[forest.id], camp: spawned[camp.id] };
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [];
    clearMat();
    SpawnerSystem.resetAlerts();
    Growth.resetGrowthAlerts();
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
    resetMatTuning();
});

describe('a spawner over a game-hour: 1000 ms steps against 100 ms ticks', () => {
    it('spawns exactly as often, its family taken every 3 s', () => {
        const ticks = playHour(100);
        clearMat();
        SpawnerSystem.resetAlerts();
        const steps = playHour(1000);

        expect(steps).toEqual(ticks);
        // Under its allowance on nearly every lap: one spawn per interval, give or take the first.
        expect(ticks.forest).toBeGreaterThanOrEqual(Math.floor(HOUR_MS / FOREST_MS) - 1);
        expect(ticks.camp).toBeGreaterThanOrEqual(Math.floor(HOUR_MS / CAMP_MS) - 1);
    });
});

describe('a Token spawned part-way through a step', () => {
    /** The spawner at the middle, stepped until its first spawn: what came this tick, by type. */
    function firstSpawn(typeId, stepMs) {
        placeAt(typeId, 800, 500);
        for (let played = 0; played < 10_000; played += stepMs) {
            BoardRunner.tick(stepMs);
            const came = [...TimedChanges.arrivalsThisTick()];
            if (came.length) return { at: played + stepMs, came: came.map(([id, sinceMs]) => [BoardState.getTokenById(id)?.typeId, sinceMs]) };
        }
        return null;
    }

    it('is said to have come when it fell due, so it is worked only from then', () => {
        // Due at 4.3 s: 700 ms before the end of the step ending at 5 s, at the very end of the tick ending at 4.3 s.
        expect(firstSpawn('sf_forest', 1000)).toEqual({ at: 5000, came: [['sf_tree', 700]] });
        clearMat();
        expect(firstSpawn('sf_forest', 100)).toEqual({ at: 4300, came: [['sf_tree', 0]] });
    });

    it('one that grows within the step hands that moment on to what it became', () => {
        // Spawned 700 ms before the step's end, a Tree 200 ms later: the Tree came 500 ms before it.
        expect(firstSpawn('sf_nursery', 1000)).toEqual({ at: 5000, came: [['sf_tree', 500]] });
    });
});
