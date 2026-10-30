import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { flagStatusLine } from '../ui/components/board/flagText.js';
import { idleMomentOf } from '../ui/components/board/heroSpeech.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * A forester waits for a Stump or a Sapling (brief 230 S2a, extending S1b's silent wait): with
 * nothing ready in reach but a felled tree growing back, they wait silently, not idle, and the flag
 * says "Waiting for Oak Stump", then "Waiting for Oak Sapling", then they fell the Oak again. A
 * Stump that is not coming back (no Forest in reach, no seedling for it) is nothing to wait for:
 * the hero is idle as before.
 */

const SEEDLING = 'item_oak_seedling';
const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
const felling = { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [],
    outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }] };
registerTokenTypes({
    fw_forest: plain('fw_forest', 'Test Oak Forest', { tokenType: 'buff' }),
    fw_tree: plain('fw_tree', 'Test Oak', { uses: 2, requiresHero: true, staysPut: true, config: felling, respawn: { mode: 'regrow', into: 'fw_stump' } }),
    fw_stump: plain('fw_stump', 'Test Oak Stump', { grows: { into: 'fw_sapling', afterMs: 20000, needsNearby: ['fw_forest'], cost: [{ itemId: SEEDLING, quantity: 1 }] } }),
    fw_sapling: plain('fw_sapling', 'Test Oak Sapling', { artSize: 'small', grows: { into: 'fw_tree', afterMs: 10000 } }),
    fw_axe_tree: plain('fw_axe_tree', 'Test Axe Oak', { uses: 2, requiresHero: true, config: felling, needsTool: { kind: 'woodaxe', minTier: 1 }, respawn: { mode: 'regrow', into: 'fw_axe_stump' } }),
    fw_axe_stump: plain('fw_axe_stump', 'Test Axe Stump', { grows: { into: 'fw_axe_tree', afterMs: 20000 } }),
    fw_logging: plain('fw_logging', 'Test Logging Camp', { tokenType: 'camp', requiresHero: false, config: null, camp: { skill: 'forestry', reach: 300 } })
});

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, x, y) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, { x, y });
    expect(res?.success, res?.reason).not.toBe(false);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const at = (x, y) => BoardState.tokensAtPoint(x, y)[0] ?? null;
const TREE = { x: 800, y: 500 };

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    GameState.state.heroes = [hero('forester', { forestry: 10 }), hero('miner', { mining: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

/** A Forest and an Oak beside it, a forester sent to the Oak, run until it is a Stump. */
function felledInAForest({ seedlings = 1, forest = true } = {}) {
    if (seedlings) InventoryManager.addItem(SEEDLING, seedlings);
    if (forest) put('fw_forest', TREE.x + 150, TREE.y);
    put('fw_tree', TREE.x, TREE.y);
    Orders.orderAt('forester', { x: TREE.x, y: TREE.y });
    run(3000);
    expect(at(TREE.x, TREE.y)?.typeId).toBe('fw_stump');
    return at(TREE.x, TREE.y);
}

describe('⭐ a forester waits silently for the felled Oak to grow back', () => {
    it('waits for the Stump: not idle, nothing said, "Waiting for Test Oak Stump"', () => {
        const stump = felledInAForest();
        expect(Flags.statusOf('forester').state).toBe('idle');
        expect(Flags.waitingOf('forester')).toEqual({ instanceId: stump.id, kind: 'node' });
        expect(flagStatusLine('forester')).toBe('Waiting for Test Oak Stump');
        expect(BoardRunner.isHeroIdle('forester')).toBe(false);
        expect(idleMomentOf(Flags.waitingOf('forester'), 'Test Oak Stump')).toBeNull();
        // Read when asked, not recorded on the flag's pass: the pennant lists no skip for it.
        expect(Flags.skipsOfHero('forester').some(sk => sk.instanceId === stump.id)).toBe(false);
    });

    it('then for the Sapling, then fells the Oak again the moment it stands', () => {
        felledInAForest();
        run(20000);
        expect(at(TREE.x, TREE.y)?.typeId).toBe('fw_sapling');
        expect(flagStatusLine('forester')).toBe('Waiting for Test Oak Sapling');
        expect(BoardRunner.isHeroIdle('forester')).toBe(false);
        run(10000);
        expect(at(TREE.x, TREE.y)?.typeId).toBe('fw_tree');
        run(200);
        expect(Flags.statusOf('forester')).toMatchObject({ state: 'working', typeId: 'fw_tree' });
        expect(InventoryManager.getItemCount(SEEDLING)).toBe(0);
    });

    it('sent to a Logging Camp, waits for a Forest\'s fresh Sapling in its reach, though nothing was felled', () => {
        const sapling = put('fw_sapling', TREE.x, TREE.y);
        const camp = put('fw_logging', TREE.x, TREE.y + 160);
        expect(Orders.orderAt('forester', { x: camp.x, y: camp.y }).success).toBe(true);
        run(200);
        expect(Flags.waitingOf('forester')).toEqual({ instanceId: sapling.id, kind: 'node' });
        expect(BoardRunner.isHeroIdle('forester')).toBe(false);
    });
});

describe('nothing on its way back is nothing to wait for', () => {
    it('a Stump with no Forest in reach: idle, as before', () => {
        felledInAForest({ forest: false });
        run(1000);
        expect(Flags.waitingOf('forester')).toBeNull();
        expect(flagStatusLine('forester')).toBe('Idle');
        expect(BoardRunner.isHeroIdle('forester')).toBe(true);
    });

    it('a Stump stopped with no seedling for it: idle, as before (while it still counts down, one may come)', () => {
        const stump = felledInAForest({ seedlings: 0 });
        run(1000);
        expect(Flags.waitingOf('forester')).toEqual({ instanceId: stump.id, kind: 'node' });
        run(20000);
        expect(at(TREE.x, TREE.y)?.typeId).toBe('fw_stump');
        expect(Growth.growthAlertOf(stump.id)?.alert).toBe('grow_needs_item');
        expect(Flags.waitingOf('forester')).toBeNull();
        expect(BoardRunner.isHeroIdle('forester')).toBe(true);
    });

    it('a hero without Forestry does not wait on it', () => {
        felledInAForest();
        Orders.orderAt('miner', { x: TREE.x, y: TREE.y + 60 });
        run(1000);
        expect(Flags.waitingOf('miner')).toBeNull();
        expect(BoardRunner.isHeroIdle('miner')).toBe(true);
    });

    it("nor one out of a camp's reach", () => {
        felledInAForest();
        const camp = put('fw_logging', TREE.x + 700, TREE.y);
        expect(Orders.orderAt('forester', { x: camp.x, y: camp.y }).success).toBe(true);
        run(200);
        expect(Flags.waitingOf('forester')).toBeNull();
    });

    it('a hero who could not fell what it grows into (no woodaxe in hand) does not wait on it', () => {
        put('fw_axe_stump', TREE.x, TREE.y);
        const camp = put('fw_logging', TREE.x, TREE.y + 160);
        expect(Orders.orderAt('forester', { x: camp.x, y: camp.y }).success).toBe(true);
        run(1000);
        expect(Flags.waitingOf('forester')).toBeNull();
        expect(BoardRunner.isHeroIdle('forester')).toBe(true);
    });
});
