import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Growth from '../systems/board/Growth.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getSpawnerKindCounts } from '../systems/core/DevTools.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { nearRadius } from '../systems/board/nearby.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * A Forest that plants within its own reach (brief 230 S2a, `spawner.withinReach`): it lands its
 * Saplings only within Near of itself, and its allowance counts the trees (Saplings, Trees,
 * Stumps) standing in its reach, map trees included, not every one on the mat. A spawner without
 * the mark (an enemy camp, today's Forests) keeps the mat-wide family cap.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const SEED = 'fixture_wr_seed';
registerItems({
    [SEED]: {
        id: SEED, name: 'Fixture WR Seed', type: 'material', sprite: 'i_wood_oak', description: '', tags: [],
        stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
    }
});

const plain = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
const spawner = (allowance, withinReach) => ({
    spawns: [{ typeId: 'wr_sapling', weight: 1 }], allowance, intervalMs: 10000,
    upkeep: [{ itemId: SEED, quantity: 1 }], ...(withinReach ? { withinReach: true } : {})
});
registerTokenTypes({
    wr_forest: plain('wr_forest', { tokenType: 'spawner', spawner: spawner(3, true) }),
    wr_wide_forest: plain('wr_wide_forest', { tokenType: 'spawner', spawner: spawner(3, false) }),
    wr_sapling: plain('wr_sapling', { artSize: 'small', grows: { into: 'wr_tree', afterMs: 600000 } }),
    wr_tree: plain('wr_tree', {
        uses: 2, respawn: { mode: 'regrow', into: 'wr_stump' },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] }
    }),
    wr_stump: plain('wr_stump', { grows: { into: 'wr_sapling', afterMs: 600000, needsNearby: ['wr_forest'] } })
});

const run = (ms, step = 1000) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
const FAMILY = new Set(['wr_sapling', 'wr_tree', 'wr_stump']);
const family = () => BoardState.tokens().filter(t => FAMILY.has(t.typeId));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (forest) => family().filter(t => dist(t, forest) <= nearRadius());
const seeds = () => InventoryManager.getItemCount(SEED);

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

describe('⭐ a Forest that plants within its reach', () => {
    it('lands every Sapling within its reach, up to its own allowance, a seedling each', () => {
        InventoryManager.addItem(SEED, 10);
        const forest = placeAt('wr_forest', 800, 500);
        run(10 * 60000);
        expect(family()).toHaveLength(3);
        for (const t of family()) expect(dist(t, forest)).toBeLessThanOrEqual(nearRadius());
        expect(seeds()).toBe(7);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'at_cap', count: 3, cap: 3 });
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 3, cap: 3 });
    });

    it('its allowance counts the trees already in its reach (a map\'s included), not those beyond it', () => {
        InventoryManager.addItem(SEED, 10);
        const forest = placeAt('wr_forest', 800, 500);
        placeAt('wr_tree', 800 + 150, 500);           // in reach
        placeAt('wr_tree', 800, 500 + 150);           // in reach
        placeAt('wr_tree', 800 + 600, 500);           // far away: not its
        placeAt('wr_tree', 800 - 600, 500);
        TileModifiers.rebuildAll();
        run(10 * 60000);
        expect(near(forest)).toHaveLength(3);
        expect(family()).toHaveLength(5);
        expect(seeds()).toBe(9);
    });

    it('a felled tree\'s Stump in its reach still counts toward it', () => {
        InventoryManager.addItem(SEED, 10);
        const forest = placeAt('wr_forest', 800, 500);
        placeAt('wr_stump', 800 + 150, 500);
        placeAt('wr_stump', 800 - 150, 500);
        placeAt('wr_stump', 800, 500 + 150);
        TileModifiers.rebuildAll();
        run(60000);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'at_cap', count: 3, cap: 3 });
        expect(family()).toHaveLength(3);
        expect(seeds()).toBe(10);
    });

    it('two such Forests far apart each fill their own allowance; their allowances are not pooled', () => {
        InventoryManager.addItem(SEED, 20);
        const a = placeAt('wr_forest', 400, 500);
        const b = placeAt('wr_forest', 1400, 500);
        run(10 * 60000);
        expect(near(a)).toHaveLength(3);
        expect(near(b)).toHaveLength(3);
        expect(family()).toHaveLength(6);
    });

    it('with no free spot in its reach it waits, says no room, and pays nothing', () => {
        InventoryManager.addItem(SEED, 10);
        const forest = placeAt('wr_forest', 800, 500);
        // Other Tokens packed round it leave no free spot in its reach, though the mat has room
        // elsewhere.
        const gap = Math.ceil(MatPlacement.minGap('fixture_kitchen', 'fixture_kitchen'));
        const clear = MatPlacement.minGap('fixture_kitchen', 'wr_forest');
        for (let x = 800 - 4 * gap; x <= 800 + 4 * gap; x += gap) {
            for (let y = 500 - 4 * gap; y <= 500 + 4 * gap; y += gap) {
                if (Math.hypot(x - 800, y - 500) < clear) continue;
                placeAt('fixture_kitchen', x, y);
            }
        }
        expect(MatPlacement.findSpot('wr_sapling', { x: 800, y: 500 }, { reach: nearRadius() })).toBeNull();
        expect(MatPlacement.findSpot('wr_sapling', { x: 200, y: 900 })).not.toBeNull();
        TileModifiers.rebuildAll();
        run(15000);
        expect(family()).toHaveLength(0);
        expect(seeds()).toBe(10);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'no_room', count: 0, cap: 3 });
    });

    it('the dev counts list it on its own row', () => {
        InventoryManager.addItem(SEED, 10);
        placeAt('wr_forest', 800, 500);
        run(10 * 60000);
        expect(getSpawnerKindCounts()).toEqual([{ kind: 'wr_forest (its reach)', count: 3, cap: 3 }]);
    });
});

describe('a spawner without the mark keeps the mat-wide cap', () => {
    it('counts the family across the mat, and a within-reach Forest\'s allowance is not added to it', () => {
        InventoryManager.addItem(SEED, 20);
        const wide = placeAt('wr_wide_forest', 400, 500);
        placeAt('wr_forest', 1400, 500);
        run(10 * 60000);
        const status = SpawnerSystem.spawnerStatus(wide.id);
        expect(status.cap).toBe(3);
        expect(status.state).toBe('at_cap');
        // Each counts its own way: the wide one sees every tree on the mat.
        expect(status.count).toBe(family().length);
    });
});
