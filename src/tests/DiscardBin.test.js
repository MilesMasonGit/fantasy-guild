import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as DiscardBin from '../systems/board/DiscardBin.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * B3.1 — **the discard bin and its refunds**.
 *
 * Fixtures are instruments: their prices copy the owner's worked examples
 * (a 15-wood Wood Foundation and a 5-wood Workbench build = 7 + 2 = 9 back;
 * an Anvil at 10 ingots with 30 of 60 charges = 2 back).
 */

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
const WOOD = 'fixture_oak_wood';
const INGOT = 'fixture_db_ingot';
const STONE = 'fixture_db_stone';
registerItems({
    [INGOT]: item(INGOT, 'Fixture Ingot'),
    [STONE]: item(STONE, 'Fixture Stone')
});

registerTokenTypes({
    fixture_db_forest: {
        id: 'fixture_db_forest', name: 'Fixture Db Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        shop: { price: [{ itemId: WOOD, quantity: 11 }, { itemId: STONE, quantity: 3 }], section: 'logging' },
        spawner: { spawns: [{ typeId: 'fixture_db_tree', weight: 1 }], allowance: 2, intervalMs: 5000, upkeep: [] }
    },
    fixture_db_tree: {
        id: 'fixture_db_tree', name: 'Fixture Db Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 3, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [], outputs: [{ itemId: WOOD, quantity: 1, chance: 100 }]
        }
    },
    fixture_db_anvil: {
        id: 'fixture_db_anvil', name: 'Fixture Db Anvil', tokenType: 'context',
        rarity: 'common', theme: 'fixture', uses: 60, sprite: 'skill_industry',
        shop: { price: [{ itemId: INGOT, quantity: 10 }], section: 'smithing' }
    },
    fixture_db_wood_foundation: {
        id: 'fixture_db_wood_foundation', name: 'Fixture Db Wood Foundation',
        rarity: 'common', theme: 'fixture', uses: 1,
        shop: { price: [{ itemId: WOOD, quantity: 15 }], section: 'construction' },
        foundation: { kind: 'fixture_db_wood', skill: 'construction' }
    },
    fixture_db_workbench: {
        id: 'fixture_db_workbench', name: 'Fixture Db Workbench', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: null,
        config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 16000, xp: 1 },
        statements: [{ id: 'stm_fixture_db_workbench', keyword: KEYWORD.STATION, payload: { skill: 'crafting' } }]
    },
    fixture_db_unsold: {
        id: 'fixture_db_unsold', name: 'Fixture Db Unsold', rarity: 'common', theme: 'fixture', uses: 5
    }
});

registerRecipePools({
    construction: [{
        id: 'fixture_db_build_workbench', name: 'Build Workbench', levelRequirement: 1,
        foundationKinds: ['fixture_db_wood'],
        inputs: [{ itemId: WOOD, quantity: 5 }],
        outputs: [{ tokenId: 'fixture_db_workbench', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 2000, xp: 1
    }]
});

const HALL = { x: 900, y: 700 };
const AT = { x: 400, y: 300 };
const ELSEWHERE = { x: 640, y: 300 };

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, point = AT, origin = BoardState.ORIGIN.PLACED) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, origin);
    return BoardState.addToken(instance, point.x, point.y);
}

const bank = (id) => InventoryManager.getItemCount(id);
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    SpawnerSystem.resetAlerts();
    clearMat();
    GameState.state.inventory.items = {};
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [hero('h1', { logging: 50, construction: 5 })];
});

describe('binning a Token (FB-34)', () => {
    it('lifts it off the mat into the bin, frees its spot, and keeps the instance whole', () => {
        const anvil = put('fixture_db_anvil');
        anvil.usesRemaining = 42;
        const res = DiscardBin.binToken(anvil.id);
        expect(res.success).toBe(true);
        expect(BoardState.getTokenById(anvil.id)).toBeNull();
        expect(DiscardBin.binContents()).toEqual([anvil]);
        expect(DiscardBin.isBinned(anvil.id)).toBe(true);
        expect(anvil.usesRemaining).toBe(42);
        expect(GameState.state.board.bin).toHaveLength(1);
    });

    it('a hero working it lets go and moves on (SP-52)', () => {
        const tree = put('fixture_db_tree');
        const other = put('fixture_db_tree', ELSEWHERE);
        Flags.setDisallowed(other.id, true);
        Flags.plant('h1', AT);
        expect(BoardState.workTokenOf('h1')).toBe(tree.id);
        Flags.setDisallowed(other.id, false);

        const res = DiscardBin.binToken(tree.id);
        expect(res.idledHeroId).toBe('h1');
        Flags.assign(0);
        expect(BoardState.workTokenOf('h1')).toBe(other.id);
    });

    it('is not a depletion, and says what changed', () => {
        const anvil = put('fixture_db_anvil');
        const seen = [];
        const offs = [BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.BIN_CHANGED, BOARD_EVENTS.TOKEN_DEPLETED, 'state_changed']
            .map(e => EventBus.subscribe(e, p => seen.push([e, p])));
        DiscardBin.binToken(anvil.id);
        offs.forEach(off => off?.());
        expect(seen.find(([e]) => e === BOARD_EVENTS.TILE_CHANGED)?.[1])
            .toMatchObject({ instanceId: anvil.id, x: AT.x, y: AT.y, typeId: null });
        expect(seen.find(([e]) => e === BOARD_EVENTS.BIN_CHANGED)?.[1])
            .toMatchObject({ action: 'binned', instanceId: anvil.id, count: 1 });
        expect(seen.some(([e]) => e === 'state_changed')).toBe(true);
        expect(seen.some(([e]) => e === BOARD_EVENTS.TOKEN_DEPLETED)).toBe(false);
    });

    it('still counts toward the mat cap until discarded (owner, B3 interview)', () => {
        const anvil = put('fixture_db_anvil');
        put('fixture_db_anvil', ELSEWHERE);
        expect(MatCap.placedCount()).toBe(2);
        DiscardBin.binToken(anvil.id);
        expect(MatCap.placedCount()).toBe(2);
        DiscardBin.discardAll();
        expect(MatCap.placedCount()).toBe(1);
    });

    it('refuses the Guild Hall, a full bin, and a Token in the hand', () => {
        const hall = put('token_guild_hall', HALL);
        expect(DiscardBin.binToken(hall.id)).toMatchObject({ success: false });
        expect(BoardState.getTokenById(hall.id)).toBe(hall);

        const nine = Array.from({ length: 9 }, (_, i) => put('fixture_db_unsold', { x: 100 + i * 170, y: 1200 }));
        for (const t of nine) expect(DiscardBin.binToken(t.id).success).toBe(true);
        const tenth = put('fixture_db_unsold', { x: 200, y: 200 });
        expect(DiscardBin.binToken(tenth.id)).toMatchObject({ success: false, reason: 'The bin is full (9 Tokens)' });
        expect(BoardState.getTokenById(tenth.id)).toBe(tenth);
        expect(DiscardBin.binContents()).toHaveLength(DiscardBin.BIN_SIZE);

        DiscardBin.discardAll();
        TimedChanges.setInHand(tenth.id, true);
        try {
            expect(DiscardBin.binToken(tenth.id)).toMatchObject({ success: false, reason: 'That Token is being carried' });
            // The drag that drops it INTO the bin says so (B3.2).
            expect(DiscardBin.binToken(tenth.id, { fromHand: true }).success).toBe(true);
        } finally {
            TimedChanges.setInHand(tenth.id, false);
        }
    });
});

describe('unbinning', () => {
    it('puts the same Token back, with its charges and its recipe', () => {
        const f = put('fixture_db_wood_foundation');
        expect(StationRecipe.setSelectedRecipe(f, 'fixture_db_build_workbench')).toBe(true);
        f.usesRemaining = 1;
        DiscardBin.binToken(f.id);

        const res = DiscardBin.unbinToken(f.id, ELSEWHERE);
        expect(res.success).toBe(true);
        const back = BoardState.getTokenById(f.id);
        expect(back).toBe(f);
        expect(back.usesRemaining).toBe(1);
        expect(back.selectedRecipeId).toBe('fixture_db_build_workbench');
        expect(back.origin).toBe('placed');
        expect(back.x).toBe(ELSEWHERE.x);
        expect(DiscardBin.binContents()).toHaveLength(0);
    });

    it('does not pour its charges into a copy it is dropped on', () => {
        const a = put('fixture_db_anvil');
        a.usesRemaining = 30;
        const b = put('fixture_db_anvil', ELSEWHERE);
        b.usesRemaining = 10;
        DiscardBin.binToken(a.id);
        const res = DiscardBin.unbinToken(a.id, ELSEWHERE);
        expect(res.success).toBe(true);
        expect(res.restocked).toBeFalsy();
        expect(BoardState.getTokenById(a.id).usesRemaining).toBe(30);
        expect(b.usesRemaining).toBe(10);
    });

    it('refuses what is not in the bin, and leaves it binned when placement refuses', () => {
        expect(DiscardBin.unbinToken('tok_nobody', AT)).toMatchObject({ success: false });
        const a = put('fixture_db_anvil');
        DiscardBin.binToken(a.id);
        expect(DiscardBin.unbinToken(a.id, { x: NaN, y: 0 })).toMatchObject({ success: false });
        expect(DiscardBin.isBinned(a.id)).toBe(true);
    });
});

describe('spawned Tokens (TL-13)', () => {
    it('can be binned for nothing, and the spawner has room to make another', () => {
        const forest = put('fixture_db_forest', AT);
        const t1 = put('fixture_db_tree', { x: 560, y: 300 }, BoardState.ORIGIN.SPAWNED);
        put('fixture_db_tree', { x: 240, y: 300 }, BoardState.ORIGIN.SPAWNED);
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 2, cap: 2 });

        expect(DiscardBin.binToken(t1.id).success).toBe(true);
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 1, cap: 2 });
        expect(DiscardBin.refundFor(t1)).toEqual([]);
        // Spawned Tokens never counted toward the cap, binned or not.
        expect(MatCap.placedCount()).toBe(1);

        run(6000);
        expect(SpawnerSystem.spawnerCounts(forest.id).count).toBe(2);
    });
});

describe('refunds (TL-13)', () => {
    it('a bought Token returns half its price, rounded down per item', () => {
        const forest = put('fixture_db_forest');
        // 11 wood + 3 stone → 5 + 1.
        expect(DiscardBin.refundFor(forest)).toEqual([
            { itemId: WOOD, quantity: 5 }, { itemId: STONE, quantity: 1 }
        ]);
    });

    it('a consumable returns price × charges left ÷ starting, halved, rounded down', () => {
        const anvil = put('fixture_db_anvil');
        anvil.usesRemaining = 30;                     // 30 of 60: ⌊10 × 30 / 120⌋ = 2
        expect(DiscardBin.refundFor(anvil)).toEqual([{ itemId: INGOT, quantity: 2 }]);
        anvil.usesRemaining = 60;                     // full: ⌊10 / 2⌋ = 5
        expect(DiscardBin.refundFor(anvil)).toEqual([{ itemId: INGOT, quantity: 5 }]);
        anvil.usesRemaining = 90;                     // restocked above its start: capped at full
        expect(DiscardBin.refundFor(anvil)).toEqual([{ itemId: INGOT, quantity: 5 }]);
        anvil.usesRemaining = 11;                     // ⌊110 / 120⌋ = 0: nothing
        expect(DiscardBin.refundFor(anvil)).toEqual([]);
    });

    it('a station built on a Foundation returns half the Foundation plus half the build (Workbench 7 + 2 = 9)', () => {
        InventoryManager.addItem(WOOD, 5);
        const f = put('fixture_db_wood_foundation');
        expect(StationRecipe.setSelectedRecipe(f, 'fixture_db_build_workbench')).toBe(true);
        Flags.plant('h1', AT);
        run(3000);

        const [bench] = BoardState.tokens().filter(t => t.typeId === 'fixture_db_workbench');
        expect(bench).toBeTruthy();
        expect(bench.builtFrom).toEqual({
            foundationTypeId: 'fixture_db_wood_foundation',
            buildCost: [{ itemId: WOOD, quantity: 5 }]
        });
        expect(DiscardBin.refundFor(bench)).toEqual([{ itemId: WOOD, quantity: 9 }]);
    });

    it('a built station from an older save (no record) returns half its Foundation, found from content', () => {
        const bench = put('fixture_db_workbench');
        expect(bench.builtFrom).toBeUndefined();
        expect(DiscardBin.foundationFromContent('fixture_db_workbench')).toBe('fixture_db_wood_foundation');
        expect(DiscardBin.refundFor(bench)).toEqual([{ itemId: WOOD, quantity: 7 }]);
    });

    it('the Guild Hall, and an unsold Token nothing builds, return nothing', () => {
        expect(DiscardBin.refundFor(put('token_guild_hall', HALL))).toEqual([]);
        expect(DiscardBin.refundFor(put('fixture_db_unsold'))).toEqual([]);
    });

    it('binRefundTotal merges the bin per item', () => {
        const forest = put('fixture_db_forest');
        const anvil = put('fixture_db_anvil', ELSEWHERE);
        const found = put('fixture_db_wood_foundation', { x: 400, y: 600 });
        DiscardBin.binToken(forest.id);
        DiscardBin.binToken(anvil.id);
        DiscardBin.binToken(found.id);
        // Forest 5 wood + 1 stone; Anvil (full) 5 ingots; Foundation 7 wood.
        expect(DiscardBin.binRefundTotal()).toEqual([
            { itemId: WOOD, quantity: 12 }, { itemId: STONE, quantity: 1 }, { itemId: INGOT, quantity: 5 }
        ]);
    });
});

describe('discard all (B3 confirm)', () => {
    it('empties the bin and pays the refund into the Bank', () => {
        const forest = put('fixture_db_forest');
        const anvil = put('fixture_db_anvil', ELSEWHERE);
        DiscardBin.binToken(forest.id);
        DiscardBin.binToken(anvil.id);

        const seen = [];
        const offs = [BOARD_EVENTS.BIN_CHANGED, 'state_changed'].map(e => EventBus.subscribe(e, p => seen.push([e, p])));
        const res = DiscardBin.discardAll();
        offs.forEach(off => off?.());

        expect(res).toMatchObject({ success: true, discarded: 2 });
        expect(res.refunded).toEqual([
            { itemId: WOOD, quantity: 5 }, { itemId: STONE, quantity: 1 }, { itemId: INGOT, quantity: 5 }
        ]);
        expect(bank(WOOD)).toBe(5);
        expect(bank(STONE)).toBe(1);
        expect(bank(INGOT)).toBe(5);
        expect(DiscardBin.binContents()).toEqual([]);
        expect(BoardState.getTokenById(forest.id)).toBeNull();
        expect(seen.find(([e]) => e === BOARD_EVENTS.BIN_CHANGED)?.[1])
            .toMatchObject({ action: 'discarded', count: 0, refunded: res.refunded });
        expect(seen.some(([e]) => e === 'state_changed')).toBe(true);
    });

    it('goes through InventoryManager, so a full Bank drops the refund as loot (D-138)', () => {
        const spy = vi.spyOn(InventoryManager, 'addItem');
        GameState.state.inventory.maxSlots = 0;
        const anvil = put('fixture_db_anvil');
        DiscardBin.binToken(anvil.id);
        DiscardBin.discardAll();
        expect(spy).toHaveBeenCalledWith(INGOT, 5, 'discard_refund');
        expect(bank(INGOT)).toBe(0);
        const loot = SpriteLayer.getSprites().filter(s => s.refId === INGOT || s.itemId === INGOT);
        expect(loot.reduce((n, s) => n + (s.quantity || 0), 0)).toBe(5);
        spy.mockRestore();
    });

    it('an empty bin does nothing', () => {
        expect(DiscardBin.discardAll()).toEqual({ success: true, discarded: 0, refunded: [] });
    });
});

describe('saving the bin', () => {
    it('a save → load round trip keeps the bin, whole', () => {
        const anvil = put('fixture_db_anvil');
        anvil.usesRemaining = 17;
        anvil.selectedRecipeId = 'fixture_kept';
        anvil.builtFrom = { foundationTypeId: 'fixture_db_wood_foundation', buildCost: [{ itemId: WOOD, quantity: 5 }] };
        DiscardBin.binToken(anvil.id);

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);

        const [back] = DiscardBin.binContents();
        expect(back).toMatchObject({
            id: anvil.id, typeId: 'fixture_db_anvil', usesRemaining: 17,
            selectedRecipeId: 'fixture_kept', origin: 'placed', builtFrom: anvil.builtFrom
        });
        expect(MatCap.placedCount()).toBe(1);
        expect(DiscardBin.unbinToken(anvil.id, AT).success).toBe(true);
    });

    it('an older save without a bin loads with an empty one', async () => {
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        delete saved.state.board.bin;
        const migrated = migrateState(saved.state, saved.version);
        expect(migrated.board.bin).toEqual([]);
        await GameState.initFromSave(migrated);
        expect(DiscardBin.binContents()).toEqual([]);
    });
});
