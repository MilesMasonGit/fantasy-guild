import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { reachRadius } from '../systems/board/nearby.js';
import { resetMatTuning } from '../config/matTuning.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { clearMat, placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ A planter that plants within its reach gives a Token that will grow the room its grown form
 * will need, or plants nothing, so growing moves nothing and no tree drifts out of the reach its
 * Stump needs. Content-free: its own types, the real rules.
 */

const base = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 't', uses: null, sprite: 's_nature', requiresHero: false, ...extra });
const FOREST = 'pr_forest', STUMP = 'pr_stump', SAPLING = 'pr_sapling', TREE = 'pr_tree', BUSH = 'pr_bush', THICKET = 'pr_thicket', LOOP_A = 'pr_loop_a', LOOP_B = 'pr_loop_b';

beforeAll(() => {
    registerTokenTypes({
        [FOREST]: base(FOREST, { tokenType: 'spawner', spawner: { spawns: [{ typeId: SAPLING, weight: 1 }], allowance: 5, intervalMs: 1000, withinReach: true } }),
        [THICKET]: base(THICKET, { tokenType: 'spawner', spawner: { spawns: [{ typeId: BUSH, weight: 1 }], allowance: 5, intervalMs: 1000, withinReach: true } }),
        // A 2×2: every Token is drawn at its footprint's size, so a Sapling's tree is bigger only
        // by being a 2×2.
        [TREE]: base(TREE, { staysPut: true, size: 2 }),
        [STUMP]: base(STUMP, { artSize: 'small', grows: { into: SAPLING, afterMs: 1000, needsNearby: [FOREST] } }),
        [SAPLING]: base(SAPLING, { artSize: 'small', grows: { into: TREE, afterMs: 1000 } }),
        [BUSH]: base(BUSH, { artSize: 'small' }),
        [LOOP_A]: base(LOOP_A, { artSize: 'small', grows: { into: LOOP_B, afterMs: 1000 } }),
        [LOOP_B]: base(LOOP_B, { size: 2, grows: { into: LOOP_A, afterMs: 1000 } })
    });
});
beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    clearMat();
});
afterEach(() => { clearMat(); resetMatTuning(); });

const plant = (planter) => EffectActions.spawn(
    { payload: { typeId: getTokenType(planter.typeId).spawner.spawns[0].typeId } },
    { self: planter.id },
    Math.random,
    { within: reachRadius() }
);
const gapTo = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const grow = (t) => EffectActions.transformInstance(t, getTokenType(t.typeId).grows.into, { fixPlaced: true, cause: 'grow' });

describe('⭐ a Sapling is planted with room for its tree', () => {
    it('the room a Token takes: its chain\'s largest body; its own if it does not grow; a loop stops', () => {
        expect(MatPlacement.roomRadiusOf(STUMP)).toBe(artRadiusOf(TREE));
        expect(MatPlacement.roomRadiusOf(SAPLING)).toBe(artRadiusOf(TREE));
        expect(MatPlacement.roomRadiusOf(TREE)).toBe(artRadiusOf(TREE));
        expect(MatPlacement.roomRadiusOf(BUSH)).toBe(artRadiusOf(BUSH));
        expect(MatPlacement.roomRadiusOf(LOOP_A)).toBe(artRadiusOf(LOOP_B));
        expect(artRadiusOf(LOOP_A)).toBeLessThan(artRadiusOf(LOOP_B));
    });

    it('stands the tree\'s gap from its planter: a Sapling\'s gap is its tree\'s', () => {
        const forest = placeAt(FOREST, 900, 500);
        const landed = plant(forest);
        expect(gapTo(landed, forest)).toBeGreaterThanOrEqual(MatPlacement.minGap(TREE, FOREST) - 1e-6);
        expect(MatPlacement.minGap(SAPLING, FOREST)).toBe(MatPlacement.minGap(TREE, FOREST));
    });

    it('⭐ stands the tree\'s gap from a neighbour small today, a Stump that will be a tree too', () => {
        const forest = placeAt(FOREST, 900, 500);
        const stump = placeAt(STUMP, 1108, 500);
        const landed = plant(forest);
        expect(gapTo(landed, stump)).toBeGreaterThanOrEqual(MatPlacement.minGap(TREE, TREE) - 1e-6);
        expect(gapTo(landed, forest)).toBeLessThanOrEqual(reachRadius());
    });

    it('⭐ the tree in line behind it stays in reach when both have grown: nothing moves', () => {
        const forest = placeAt(FOREST, 900, 500);
        const behind = placeAt(SAPLING, 1108, 500);
        const planted = plant(forest);

        const grownPlanted = grow(BoardState.getTokenById(planted.instanceId));
        const grownBehind = grow(behind);
        // Growing rounds a point to whole units, and moves it no further.
        expect(gapTo(grownPlanted, planted)).toBeLessThanOrEqual(1);
        expect({ x: grownBehind.x, y: grownBehind.y }).toEqual({ x: 1108, y: 500 });
        expect(gapTo(grownBehind, forest)).toBeLessThanOrEqual(reachRadius());
    });

    it('with no room for a tree in reach it plants nothing: a Sapling is never squeezed in at its drawn size', () => {
        const forest = placeAt(FOREST, 900, 500);
        const within = 70;
        expect(within).toBeLessThan(MatPlacement.minGap(TREE, FOREST));
        expect(MatPlacement.findSpot(SAPLING, forest, { reach: within })).toBeNull();

        const landed = EffectActions.spawn({ payload: { typeId: SAPLING } }, { self: forest.id }, Math.random, { within });
        expect(landed).toBeNull();
        expect(BoardState.tokens().filter(t => t.typeId === SAPLING)).toHaveLength(0);
    });

    it('a Token that does not grow plants as it always did: nearest, at its own gap', () => {
        const thicket = placeAt(THICKET, 900, 500);
        const plain = MatPlacement.findSpot(BUSH, thicket, { reach: reachRadius() });
        const landed = plant(thicket);
        expect({ x: landed.x, y: landed.y }).toEqual({ x: plain.x, y: plain.y });
        expect(gapTo(landed, thicket)).toBeLessThan(MatPlacement.minGap(TREE, THICKET));
    });

    it('through the spawner: a planted Sapling is the tree\'s gap from its Forest', () => {
        const forest = placeAt(FOREST, 900, 500);
        expect(SpawnerSystem.attemptSpawn(forest, getTokenType(FOREST), Math.random)).toBeTruthy();
        const sapling = BoardState.tokens().find(t => t.typeId === SAPLING);
        expect(gapTo(sapling, forest)).toBeGreaterThanOrEqual(MatPlacement.minGap(TREE, FOREST) - 1e-6);
    });

    it('a Sapling nobody planted takes its Tree\'s room on an ordinary drop too', () => {
        placeAt(TREE, 900, 500);
        const gap = MatPlacement.minGap(TREE, TREE);
        expect(MatPlacement.isLegal(SAPLING, { x: 900 + gap + 0.2, y: 500 })).toBe(true);
        expect(MatPlacement.isLegal(SAPLING, { x: 900 + gap - 1, y: 500 })).toBe(false);
    });
});
