import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Growth from '../systems/board/Growth.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { reachRadius } from '../systems/board/nearby.js';
import { matW } from '../config/matGeometry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ A Sapling on the edge of its Forest's reach. A Forest plants only where the Sapling counts as
 * inside its reach, never on the reach's very limit, where a hair of float error reads it as
 * outside: the Forest would not count it, pay for another, and the Stump it leaves would never
 * regrow. And a Token that grows or regrows is tested for room where it stands, not at its point
 * rounded to whole units, so one standing just clear of a neighbour does not hop.
 * Content-free: its own types, the real rules.
 */

const SEED = 'se_seed';
const plain = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false, ...extra });
const FOREST = 'se_forest', SAPLING = 'se_sapling', TREE = 'se_tree', STUMP = 'se_stump';
const QUICK_SAPLING = 'se_quick_sapling', QUICK_TREE = 'se_quick_tree', QUICK_STUMP = 'se_quick_stump';
const FURNACE = 'se_furnace';

beforeAll(() => {
    registerItems({
        [SEED]: {
            id: SEED, name: SEED, type: 'material', sprite: 'i_wood_oak', description: '', tags: [],
            stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
        }
    });
    registerTokenTypes({
        // A large Forest: its own room keeps a Sapling out to about 132 u from its centre.
        [FOREST]: plain(FOREST, {
            tokenType: 'spawner', size: 2,
            spawner: { spawns: [{ typeId: SAPLING, weight: 1 }], allowance: 1, intervalMs: 1000, upkeep: [{ itemId: SEED, quantity: 1 }], withinReach: true }
        }),
        [SAPLING]: plain(SAPLING, { artSize: 'small', grows: { into: TREE, afterMs: 600000 } }),
        [TREE]: plain(TREE, { uses: 1, respawn: { mode: 'regrow', into: STUMP } }),
        [STUMP]: plain(STUMP, { artSize: 'small', grows: { into: SAPLING, afterMs: 600000, needsNearby: [FOREST] } }),
        [QUICK_SAPLING]: plain(QUICK_SAPLING, { artSize: 'small', grows: { into: QUICK_TREE, afterMs: 1000 } }),
        [QUICK_TREE]: plain(QUICK_TREE, { uses: 1, respawn: { mode: 'regrow', into: QUICK_STUMP } }),
        [QUICK_STUMP]: plain(QUICK_STUMP, { artSize: 'small', staysPut: true }),
        [FURNACE]: plain(FURNACE, { tokenType: 'station' })
    });
});

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
    clearMat();
    resetMatTuning();
});

const run = (ms, step = 1000) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
const only = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const pointOf = (t) => ({ x: t.x, y: t.y });
const inReach = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= reachRadius() ** 2;

describe('⭐ a Forest plants a Sapling only where it counts as inside its reach', () => {
    // The Forest's own room keeps a Sapling 205.92 u off (edges touching, 208 u, less a 1 %
    // overlap, so the gap falls between two of the search's 4 u rings), so with a 208 u reach the
    // only free ring within reach is the reach itself. The Forest stands by the mat's right edge, so
    // the search passes the exact ring points straight out and reaches ones that measure a hair over.
    const REACH = 208;
    const forestAt = () => ({ x: matW() - 150.3, y: 400.7 });
    beforeEach(() => setMatTuning('overlapPct', 1));

    it('the case: the only room within reach is on the reach itself, and a spot found there reads as outside', () => {
        setMatTuning('reach', REACH);
        expect(reachRadius()).toBe(REACH);
        const gap = MatPlacement.minGap(FOREST, SAPLING);
        expect(gap).toBeGreaterThan(REACH - 4);
        expect(gap).toBeLessThan(REACH);
        const forest = placeAt(FOREST, forestAt().x, forestAt().y);
        const spot = MatPlacement.findSpot(SAPLING, pointOf(forest), { reach: REACH });
        expect(spot.nudge).toBe(REACH);
        expect(inReach(spot, forest)).toBe(false);
    });

    it('it waits with no room and pays nothing rather than plant a Sapling it would not count', () => {
        setMatTuning('reach', REACH);
        InventoryManager.addItem(SEED, 5);
        const forest = placeAt(FOREST, forestAt().x, forestAt().y);
        TileModifiers.rebuildAll();
        run(5000);
        for (const sapling of only(SAPLING)) expect(inReach(sapling, forest)).toBe(true);
        expect(only(SAPLING)).toHaveLength(0);
        expect(InventoryManager.getItemCount(SEED)).toBe(5);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'no_room', count: 0, cap: 1 });
    });

    it('with room just inside its reach it plants there, and counts what it planted', () => {
        setMatTuning('reach', REACH + 4);
        InventoryManager.addItem(SEED, 5);
        const forest = placeAt(FOREST, forestAt().x, forestAt().y);
        TileModifiers.rebuildAll();
        run(5000);
        expect(only(SAPLING)).toHaveLength(1);
        expect(inReach(only(SAPLING)[0], forest)).toBe(true);
        // A Forest plants for free.
        expect(InventoryManager.getItemCount(SEED)).toBe(5);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'at_cap', count: 1, cap: 1 });
    });
});

describe('⭐ a Token that grows is tested for room where it stands, not at a rounded point', () => {
    // A Sapling on a fractional point (a Forest's ring, a hand nudge), a placed Furnace just clear
    // of it on the side its point would round toward.
    const at = { x: 800.6, y: 500.4 };
    const besideIt = () => ({ x: at.x + MatPlacement.minGap(FURNACE, QUICK_SAPLING) + 0.1, y: at.y });

    it('a Sapling grows into its Tree on its own point, though the point rounded would be too close to the Furnace', () => {
        placeAt(BoardState.createTokenInstance(QUICK_SAPLING, null, null, BoardState.ORIGIN.SPAWNED), at.x, at.y);
        const furnace = placeAt(BoardState.createTokenInstance(FURNACE, null, null, BoardState.ORIGIN.PLACED), besideIt().x, besideIt().y);
        const furnaceAt = pointOf(furnace);
        expect(MatPlacement.isLegal(QUICK_TREE, { x: Math.round(at.x), y: Math.round(at.y) }, { excludeId: only(QUICK_SAPLING)[0].id })).toBe(false);
        for (let t = 0; t < 1100; t += 100) TimedChanges.tick(100);
        expect(only(QUICK_TREE).map(pointOf)).toEqual([at]);
        expect(pointOf(only(FURNACE)[0])).toEqual(furnaceAt);
    });

    it('a felled Tree leaves its Stump on its own point', () => {
        const tree = placeAt(BoardState.createTokenInstance(QUICK_TREE, 1, null, BoardState.ORIGIN.SPAWNED), at.x, at.y);
        placeAt(BoardState.createTokenInstance(FURNACE, null, null, BoardState.ORIGIN.PLACED), besideIt().x, besideIt().y);
        tree.usesRemaining = 0;
        TimedChanges.tick(100);
        expect(only(QUICK_STUMP).map(pointOf)).toEqual([at]);
    });
});
