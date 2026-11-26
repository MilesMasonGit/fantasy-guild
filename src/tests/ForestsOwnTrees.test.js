import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Growth from '../systems/board/Growth.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as Groves from '../systems/board/Groves.js';
import * as Cartography from '../systems/atlas/Cartography.js';
import { withWildForests } from '../systems/atlas/wildForests.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { growsTermsOf, ownerTypesOf, isGroveSpawnerDef } from '../config/registries/tokenConstants.js';
import { reachRadius } from '../systems/board/nearby.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * ⭐ Forests and Orchards own their trees: a Forest plants a few trees of its species in its reach
 * (its allowance), each one its own, and regrows only its own Stumps, for free, in the species'
 * time as the Grow Time reaching them shortens it (a Hall star such as Green Thumb; the content no
 * longer gives a Forest one). A demolished Forest's trees stay, and their Stumps never regrow.
 * An Orchard does the same with its fruit trees, which rest and fruit again. An older save's trees
 * join the Forest in their reach once; a new Region's map trees each belong to a wild Forest.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const SEED = 'fixture_ot_seed';
registerItems({
    [SEED]: {
        id: SEED, name: 'Fixture OT Seed', type: 'material', sprite: 'i_wood_oak', description: '', tags: [],
        stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
    }
});

const plain = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
const work = { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] };
// What today's content still holds: a seed per spawn and a seed per regrowth, which the rules
// retire, and a Grow Time boost on the species, which reaches its trees like any Grow Time (the R2
// pack takes it off the Forests).
const speedUp = [{ id: 'stm_ot_fast', keyword: 'provides', to: { mode: 'tag', value: 'OtOak' },
    payload: { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 } }];
registerTokenTypes({
    ot_forest: plain('ot_forest', {
        tokenType: 'spawner', statements: speedUp,
        spawner: { spawns: [{ typeId: 'ot_tree', weight: 1 }], allowance: 3, intervalMs: 1000, upkeep: [{ itemId: SEED, quantity: 1 }] }
    }),
    ot_tree: plain('ot_tree', { tags: ['OtOak'], uses: 2, staysPut: true, respawn: { mode: 'regrow', into: 'ot_stump' }, config: work }),
    ot_stump: plain('ot_stump', {
        tags: ['OtOak'], staysPut: true,
        grows: { into: 'ot_tree', afterMs: 20000, needsNearby: ['ot_forest'], cost: [{ itemId: SEED, quantity: 1 }] }
    }),
    ot_orchard: plain('ot_orchard', {
        tokenType: 'spawner', statements: speedUp,
        spawner: { spawns: [{ typeId: 'ot_apple', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [{ itemId: SEED, quantity: 1 }] }
    }),
    ot_apple: plain('ot_apple', {
        tags: ['OtOak'], uses: 2, staysPut: true,
        respawn: { mode: 'refill', afterMs: 30000, needsNearby: ['ot_orchard'] },
        config: { ...work, skill: 'farming' }
    }),
    // A spawner whose spawns need nothing of it: it keeps counting what stands in its reach.
    ot_quarry: plain('ot_quarry', {
        tokenType: 'spawner',
        spawner: { spawns: [{ typeId: 'ot_rock', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [] }
    }),
    ot_rock: plain('ot_rock', { uses: 2, respawn: { mode: 'refill', afterMs: 5000 }, config: { ...work, skill: 'mining' } })
});

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };
const tickClocks = (ms, step = 100) => { for (let t = 0; t < ms; t += step) TimedChanges.tick(step); };
const ofType = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const seeds = () => InventoryManager.getItemCount(SEED);

/** Put a Token down at a point, no rules. ⚠️ Tokens stand edges touching at the closest, 128 u. */
function arrive(typeId, x, y) {
    const t = placeAt(typeId, x, y);
    TileModifiers.rebuildAround([{ x, y }]);
    return t;
}
function leave(instance) {
    const at = { x: instance.x, y: instance.y };
    BoardState.removeToken(instance.id);
    TileModifiers.rebuildAround([at]);
}
/** Fell (or pick empty) a Token as a last chance roll does: out of charges, resting. */
function useUp(instance) {
    instance.usesRemaining = 0;
    expect(Respawn.restInstead(instance)).toBe(true);
}
const at = (x, y) => BoardState.tokensAtPoint(x, y)[0] ?? null;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    getGlobalAggregator().clearAll();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [];
    clearMat();
    // A board the old-save pass has already seen, so it does not adopt these tests' Tokens.
    GameState.state.board.groveTethers = 1;
    SpawnerSystem.resetAlerts();
    Growth.resetGrowthAlerts();
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
    clearMat();
    vi.restoreAllMocks();
});

describe('what a Token needs of its own (the pure rules)', () => {
    const lookup = (id) => getTokenType(id);

    it('a tree needs its Forest through its Stump; a fruit tree its Orchard; a rock nothing', () => {
        expect(ownerTypesOf(getTokenType('ot_tree'), lookup)).toEqual(['ot_forest']);
        expect(ownerTypesOf(getTokenType('ot_stump'), lookup)).toEqual(['ot_forest']);
        expect(ownerTypesOf(getTokenType('ot_apple'), lookup)).toEqual(['ot_orchard']);
        expect(ownerTypesOf(getTokenType('ot_rock'), lookup)).toEqual([]);
    });

    it('a Forest and an Orchard own their spawns; a Quarry does not', () => {
        expect(isGroveSpawnerDef(getTokenType('ot_forest'), lookup)).toBe(true);
        expect(isGroveSpawnerDef(getTokenType('ot_orchard'), lookup)).toBe(true);
        expect(isGroveSpawnerDef(getTokenType('ot_quarry'), lookup)).toBe(false);
    });

    it('a growth that needs its own Forest costs nothing: no seedling per tree', () => {
        expect(growsTermsOf(getTokenType('ot_stump'))).toEqual({ needsNearby: ['ot_forest'], cost: [] });
        expect(growsTermsOf({ grows: { into: 'x', afterMs: 1, cost: [{ itemId: SEED, quantity: 1 }] } }).cost)
            .toEqual([{ itemId: SEED, quantity: 1 }]);
    });
});

describe('⭐ a Forest plants its own trees', () => {
    it('plants up to its allowance in its reach, for free, each tree its own', () => {
        const forest = arrive('ot_forest', 800, 500);
        run(10000);
        const trees = ofType('ot_tree');
        expect(trees).toHaveLength(3);
        expect(seeds()).toBe(0);
        for (const t of trees) {
            expect(t.tether).toBe(forest.id);
            expect(Math.hypot(t.x - forest.x, t.y - forest.y)).toBeLessThanOrEqual(reachRadius());
        }
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 3, cap: 3 });
    });

    it('counts only its own: a lone tree of its species in its reach does not fill it', () => {
        const forest = arrive('ot_forest', 800, 500);
        const lone = arrive('ot_tree', 928, 500);
        BoardState.setTether(lone, null);
        run(10000);
        expect(ofType('ot_tree').filter(t => t.tether === forest.id)).toHaveLength(3);
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 3, cap: 3 });
    });

    it('a spawner whose spawns need nothing of it still counts what stands in its reach', () => {
        const quarry = arrive('ot_quarry', 800, 500);
        arrive('ot_rock', 928, 500);
        run(10000);
        expect(ofType('ot_rock')).toHaveLength(2);
        expect(ofType('ot_rock').every(r => r.tether === undefined)).toBe(true);
        expect(SpawnerSystem.spawnerCounts(quarry.id)).toEqual({ count: 2, cap: 2 });
    });
});

describe('⭐ a Forest regrows only its own Stumps, for free, in their Grow Time', () => {
    function ownTree() {
        const forest = arrive('ot_forest', 800, 500);
        const tree = arrive('ot_tree', 928, 500);
        BoardState.setTether(tree, forest.id);
        return { forest, tree };
    }

    it('its felled tree becomes its Stump, which grows back in the species time as the Grow Time reaching it shortens it, no seedling', () => {
        const { forest, tree } = ownTree();
        useUp(tree);
        tickClocks(100);
        const stump = at(928, 500);
        expect(stump.typeId).toBe('ot_stump');
        expect(stump.tether).toBe(forest.id);
        // The fixture Forest's own −50 % on its species reaches the Stump, as Green Thumb would.
        expect(TimedChanges.nextGrowth(stump).totalMs).toBe(10000);
        tickClocks(9800);
        expect(at(928, 500).typeId).toBe('ot_stump');
        tickClocks(200);
        expect(at(928, 500).typeId).toBe('ot_tree');
        expect(at(928, 500).tether).toBe(forest.id);
        expect(seeds()).toBe(0);
    });

    it('a Stump beside a Forest of its species that is not its own never regrows', () => {
        arrive('ot_forest', 800, 500);
        const stump = arrive('ot_stump', 928, 500);
        BoardState.setTether(stump, null);
        tickClocks(60000);
        expect(at(928, 500).typeId).toBe('ot_stump');
        expect(Growth.growthAlertOf(stump.id)?.needs).toEqual(['ot_forest']);
    });

    it('a demolished Forest leaves its trees standing, and their Stumps never regrow', () => {
        // Seeds in the Bank, so only ownership can stop the regrowth.
        InventoryManager.addItem(SEED, 5);
        const { forest, tree } = ownTree();
        leave(forest);
        expect(at(928, 500).typeId).toBe('ot_tree');
        useUp(tree);
        tickClocks(60000);
        expect(at(928, 500).typeId).toBe('ot_stump');
        // A new Forest of the species does not take them in.
        const next = arrive('ot_forest', 800, 500);
        tickClocks(60000);
        expect(at(928, 500).typeId).toBe('ot_stump');
        expect(next.id).not.toBe(forest.id);
    });
});

describe('⭐ an Orchard plants its own fruit trees, which rest and fruit again', () => {
    it('its own picked-empty tree fruits again in its rest (Grow Time reaching it shortens it); one not its own stays bare', () => {
        const orchard = arrive('ot_orchard', 800, 500);
        const own = arrive('ot_apple', 928, 500);
        BoardState.setTether(own, orchard.id);
        const stranger = arrive('ot_apple', 800, 628);
        BoardState.setTether(stranger, null);
        useUp(own);
        useUp(stranger);
        expect(Respawn.restMsOf(own)).toBe(15000);
        tickClocks(15000);
        expect(own.usesRemaining).toBeGreaterThan(0);
        expect(stranger.usesRemaining).toBe(0);
        expect(Respawn.isComingBack(stranger)).toBe(false);
    });

    it('plants up to its allowance, for free, each its own', () => {
        const orchard = arrive('ot_orchard', 800, 500);
        run(10000);
        expect(ofType('ot_apple').filter(t => t.tether === orchard.id)).toHaveLength(2);
        expect(seeds()).toBe(0);
    });
});

describe('an older save: its trees join the Forest in their reach, once', () => {
    it('untethered trees and Stumps take the nearest Forest of their species in reach; one with none in reach belongs to none', () => {
        GameState.state.board.groveTethers = 0;
        const forest = arrive('ot_forest', 800, 500);
        const far = arrive('ot_forest', 1500, 500);
        const tree = arrive('ot_tree', 928, 500);
        const stump = arrive('ot_stump', 672, 500);
        const lone = arrive('ot_tree', 300, 900);
        const apple = arrive('ot_apple', 1400, 500);
        expect(Groves.attachUntethered()).toBe(2);
        expect(tree.tether).toBe(forest.id);
        expect(stump.tether).toBe(forest.id);
        expect(lone.tether).toBe(null);
        expect(apple.tether).toBe(null);
        expect(far.id).not.toBe(forest.id);
        expect(GameState.state.board.groveTethers).toBe(1);
        // Once: a tree placed later is not adopted by a reload.
        const later = arrive('ot_tree', 850, 640);
        expect(Groves.attachUntethered()).toBe(0);
        expect('tether' in later).toBe(false);
    });

    it('the board tick runs it, so an old save Stump beside its Forest regrows', () => {
        GameState.state.board.groveTethers = 0;
        arrive('ot_forest', 800, 500);
        arrive('ot_stump', 928, 500);
        run(20100);
        expect(at(928, 500).typeId).toBe('ot_tree');
    });
});

describe('⭐ every map tree belongs to a wild Forest', () => {
    const headOf = (typeId) => ({ ot_tree: 'ot_forest', ot_apple: 'ot_orchard' })[typeId] || null;

    it('each clump of a species gets its Forest in place of its middle tree, and every tree is its own', () => {
        const nodes = [
            { typeId: 'ot_tree', x: 100, y: 100 }, { typeId: 'ot_tree', x: 200, y: 100 }, { typeId: 'ot_tree', x: 150, y: 180 },
            { typeId: 'ot_rock', x: 400, y: 400 },
            { typeId: 'ot_tree', x: 1500, y: 900 }, { typeId: 'ot_tree', x: 1600, y: 900 }
        ];
        const out = withWildForests(nodes, { headOf, reach: 240 });
        expect(out.map(n => n.typeId)).toEqual(['ot_tree', 'ot_tree', 'ot_forest', 'ot_rock', 'ot_forest', 'ot_tree']);
        expect(out[0].owner).toBe(2);
        expect(out[1].owner).toBe(2);
        expect(out[2].owner).toBeUndefined();
        expect(out[3].owner).toBeUndefined();
        expect(out[5].owner).toBe(4);
        expect(out.map(n => [n.x, n.y])).toEqual(nodes.map(n => [n.x, n.y]));
    });

    it('a lone tree joins the nearest Forest of its species; a species with no clump is one, so a lone Apple Tree is an Orchard', () => {
        const nodes = [
            { typeId: 'ot_tree', x: 100, y: 100 }, { typeId: 'ot_tree', x: 200, y: 100 },
            { typeId: 'ot_tree', x: 1500, y: 900 },
            { typeId: 'ot_apple', x: 900, y: 500 }
        ];
        const out = withWildForests(nodes, { headOf, reach: 240 });
        expect(out.map(n => n.typeId)).toEqual(['ot_forest', 'ot_tree', 'ot_tree', 'ot_orchard']);
        expect(out[1].owner).toBe(0);
        expect(out[2].owner).toBe(0);
        expect(out[3].owner).toBeUndefined();
    });

    it('a settled board ties each map tree to its wild Forest', () => {
        const board = Cartography.regionBoard({ nodes: withWildForests([
            { typeId: 'ot_tree', x: 100, y: 100 }, { typeId: 'ot_tree', x: 200, y: 100 }, { typeId: 'ot_tree', x: 150, y: 180 }
        ], { headOf, reach: 240 }) }, 'region_9');
        const tokens = Object.values(board.tokens);
        const forest = tokens.find(t => t.typeId === 'ot_forest');
        const trees = tokens.filter(t => t.typeId === 'ot_tree');
        expect(trees).toHaveLength(2);
        expect(trees.every(t => t.tether === forest.id)).toBe(true);
        expect('tether' in forest).toBe(false);
    });
});

describe('the lifecycle audit', () => {
    it('says nothing of a Forest planting for free, but still notes a free Quarry', async () => {
        const { auditLifecycleBlocks } = await import('../systems/core/lifecycleAudit.js');
        const free = (id) => ({ ...getTokenType(id), spawner: { ...getTokenType(id).spawner, upkeep: [] } });
        const tokens = Object.fromEntries(['ot_tree', 'ot_stump', 'ot_apple', 'ot_rock'].map(id => [id, getTokenType(id)]));
        Object.assign(tokens, { ot_forest: free('ot_forest'), ot_orchard: free('ot_orchard'), ot_quarry: free('ot_quarry') });
        const notes = auditLifecycleBlocks({ tokens, items: {}, recipes: [], skills: {} })
            .filter(f => f.field === 'spawner.upkeep').map(f => f.entityId);
        expect(notes).toEqual(['ot_quarry']);
    });
});
