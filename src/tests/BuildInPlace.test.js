import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { bandStationRecipes, BAND } from '../systems/board/RecipeBands.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Building in place (Token Lifecycle 6.1, DP-6, SP-42, SP-47, SP-49).
 *
 * A Foundation is a station whose recipes output a Token. The player picks the
 * recipe; a hero with the Foundation's skill works it; when the one cycle ends
 * the Foundation BECOMES that Token where it stands, origin `placed`.
 */

registerTokenTypes({
    fixture_bip_furnace: {
        id: 'fixture_bip_furnace', name: 'Fixture Built Furnace', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: 100,
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 16000, xp: 1 },
        statements: [{ id: 'stm_fixture_bip_furnace', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } }]
    },
    fixture_bip_crop: {
        id: 'fixture_bip_crop', name: 'Fixture Onion Crop', rarity: 'common', theme: 'fixture', uses: 1
    },
    fixture_bip_stone_foundation: {
        id: 'fixture_bip_stone_foundation', name: 'Fixture Stone Foundation',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'stone', skill: 'construction' }
    },
    fixture_bip_farmland: {
        id: 'fixture_bip_farmland', name: 'Fixture Farmland',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'farmland', skill: 'farming' }
    }
});

registerRecipePools({
    construction: [
        {
            id: 'fixture_bip_build_furnace', name: 'Build Furnace', levelRequirement: 3,
            foundationKinds: ['stone'],
            inputs: [{ itemId: 'item_coal', quantity: 5 }],
            outputs: [{ tokenId: 'fixture_bip_furnace', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 3000, xp: 10
        }
    ],
    farming: [
        {
            id: 'fixture_bip_plant_onion', name: 'Plant Onions', levelRequirement: 1,
            foundationKinds: ['farmland'],
            inputs: [],
            outputs: [{ tokenId: 'fixture_bip_crop', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 2000, xp: 1
        }
    ]
});

const AT = { x: 560, y: 520 };

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, point = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [hero('h1', { construction: 5, farming: 5 })];
});

describe('a Foundation never picks for the player', () => {
    it('is placed with no recipe selected, though its pool is not empty', () => {
        const f = put('fixture_bip_stone_foundation');
        expect(StationRecipe.poolFor(f && { foundation: { kind: 'stone', skill: 'construction' } }).length).toBe(1);
        expect(f.selectedRecipeId).toBeUndefined();
        expect(StationRecipe.defaultRecipeFor({ foundation: { kind: 'stone', skill: 'construction' } })).toBeNull();
    });

    it('with nothing picked, nobody works it and nothing happens', () => {
        InventoryManager.addItem('item_coal', 10);
        const f = put('fixture_bip_stone_foundation');
        Flags.plant('h1', AT);
        run(10000);

        expect(BoardState.workTokenOf('h1')).toBeFalsy();
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(onMat('fixture_bip_furnace')).toHaveLength(0);
        expect(InventoryManager.getItemCount('item_coal')).toBe(10);
        expect(Flags.skipsOf(f.id).map(s => s.reason)).toContain(ALERT.CHOOSE_BUILD);
    });
});

describe('building in place (DP-6)', () => {
    it('a Stone Foundation with Build Furnace picked becomes a Furnace after one Construction cycle', () => {
        InventoryManager.addItem('item_coal', 10);
        const f = put('fixture_bip_stone_foundation');
        const { x, y } = f;
        expect(StationRecipe.setSelectedRecipe(f, 'fixture_bip_build_furnace')).toBe(true);
        Flags.plant('h1', AT);
        expect(BoardState.workTokenOf('h1')).toBe(f.id);

        run(2500);
        expect(BoardState.getTokenById(f.id)).toBeTruthy();      // not yet

        run(1000);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        const built = onMat('fixture_bip_furnace');
        expect(built).toHaveLength(1);
        expect(built[0].x).toBe(x);
        expect(built[0].y).toBe(y);
        expect(BoardState.originOf(built[0])).toBe('placed');
        expect(InventoryManager.getItemCount('item_coal')).toBe(5);  // inputs paid once
        expect(SpriteLayer.getSprites().filter(s => s.kind === 'token')).toHaveLength(0); // not a dropped sprite
        expect(GameState.state.heroes[0].skills.construction.xp).toBeGreaterThan(0);

        // The hero moves on (SP-52): a construction-only hero has nothing
        // left to work, and the Furnace is not theirs.
        run(1000);
        expect(BoardState.workTokenOf('h1')).not.toBe(f.id);
        expect(onMat('fixture_bip_furnace')).toHaveLength(1);
    });

    it('Farmland is the same with Farming (SP-47)', () => {
        const f = put('fixture_bip_farmland');
        StationRecipe.setSelectedRecipe(f, 'fixture_bip_plant_onion');
        Flags.plant('h1', AT);
        run(2500);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        expect(onMat('fixture_bip_crop')).toHaveLength(1);
    });
});

describe('the level gate is the recipe’s (SP-49)', () => {
    beforeEach(() => {
        GameState.state.heroes = [hero('h1', { construction: 1 })];
    });

    it('a hero below the recipe’s level cannot work it', () => {
        InventoryManager.addItem('item_coal', 10);
        const f = put('fixture_bip_stone_foundation');
        StationRecipe.setSelectedRecipe(f, 'fixture_bip_build_furnace');
        Flags.plant('h1', AT);
        run(10000);

        expect(BoardState.workTokenOf('h1')).toBeFalsy();
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(InventoryManager.getItemCount('item_coal')).toBe(10);
        expect(Flags.skipsOf(f.id).map(s => s.reason)).toContain(ALERT.ACCESS);
    });

    it('the picker shows the recipe locked, with its level', () => {
        const f = put('fixture_bip_stone_foundation');
        const def = { id: f.typeId, foundation: { kind: 'stone', skill: 'construction' } };
        const banding = bandStationRecipes(def, null, GameState.state.heroes);
        expect(banding.skill).toBe('construction');
        expect(banding.rows).toHaveLength(1);
        expect(banding.rows[0].level).toBe(3);
        expect(banding.rows[0].band).toBe(BAND.LOCKED);
        expect(banding.rows[0].selectable).toBe(false);
    });
});

describe('no room to stand', () => {
    it('keeps the Foundation and its progress, spends nothing, and builds once room appears', () => {
        InventoryManager.addItem('item_coal', 10);
        const f = put('fixture_bip_stone_foundation');
        StationRecipe.setSelectedRecipe(f, 'fixture_bip_build_furnace');
        Flags.plant('h1', AT);

        const spy = vi.spyOn(MatPlacement, 'forceSpot').mockReturnValue(null);
        run(5000);
        expect(BoardState.getTokenById(f.id)).toBeTruthy();
        expect(f.alert).toBe(ALERT.NO_ROOM);
        expect(f.cycleElapsedMs).toBeGreaterThanOrEqual(3000);
        expect(InventoryManager.getItemCount('item_coal')).toBe(10);

        spy.mockRestore();
        run(200);
        expect(BoardState.getTokenById(f.id)).toBeNull();
        expect(onMat('fixture_bip_furnace')).toHaveLength(1);
        expect(InventoryManager.getItemCount('item_coal')).toBe(5);
    });
});
