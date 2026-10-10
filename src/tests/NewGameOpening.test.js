import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap, openingMat } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { REGION_KIND } from '../systems/atlas/Atlas.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import { TEXT } from '../systems/atlas/regionNames.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getTokenType, getAllTokenTypes, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setStarterCampForTests, resetStarterCampForTests } from '../config/registries/starterCampRegistry.js';
import { recipesForToken } from '../config/registries/recipePoolRegistry.js';
import { getItem, registerItems } from '../config/registries/itemRegistry.js';
import { matW, matH } from '../config/matGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ A new game opens in the Starter Camp: the Region the owner laid out in the game and synced from
 * the CMS (`data/starterCamp.json`), or the built-in camp while there is none. Then the roadmap §6
 * circularity check: from the Starter Camp, its Bank and the Shop, every chain is reachable, on the
 * SHIPPED data.
 *
 * ⚠️ The fixtures are registered here, not through `fixtures/testTokens.js`: that file registers
 * fixture recipe pools over the shipped ones, which would falsify the circularity check.
 */

registerItems({
    fixture_ngo_wood: { id: 'fixture_ngo_wood', name: 'Fixture Camp Wood', type: 'material', sprite: 'wood_oak', stackable: true },
    fixture_ngo_ore: { id: 'fixture_ngo_ore', name: 'Fixture Camp Ore', type: 'material', sprite: 'ore_copper', stackable: true }
});
registerTokenTypes({
    fixture_ngo_producer: {
        id: 'fixture_ngo_producer', name: 'Fixture Camp Producer', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 50, size: 1, sprite: 'skill_nature'
    },
    fixture_ngo_site: {
        id: 'fixture_ngo_site', name: 'Fixture Endgame Site', tokenType: 'resource', landmark: true,
        rarity: 'common', theme: 'fixture', uses: null, size: 1, sprite: 'skill_nature',
        config: { skill: 'forestry', skillRequired: 99, cycleTimeMs: 60000, xp: 0, inputs: [], outputs: [] }
    }
});

/** A Starter Camp as the CMS writes it, laid out on the shipped 1760 × 1126 mat. */
const CAMP = Object.freeze({
    version: 1,
    savedAt: '2026-10-09T14:02:00.000Z',
    mat: { w: 1760, h: 1126 },
    hall: { x: 880, y: 563 },
    tokens: [
        { typeId: 'fixture_ngo_site', x: 200, y: 200 },
        { typeId: 'fixture_ngo_site', x: 1560, y: 200 },
        { typeId: 'fixture_ngo_producer', x: 700, y: 563 },
        { typeId: 'fixture_ngo_producer', x: 1060, y: 563 }
    ],
    bank: { fixture_ngo_wood: 7, fixture_ngo_ore: 2 }
});

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
}

const at = (t) => ({ typeId: t.typeId, x: t.x, y: t.y });

beforeEach(() => {
    resetMatTuning();
});

afterEach(() => {
    resetStarterCampForTests();
    resetMatTuning();
});

describe('with no Starter Camp file, a new game opens on the built-in camp', () => {
    beforeEach(() => {
        setStarterCampForTests(null);
        newGame();
    });

    it('the Guild Hall in the middle, an Oak Forest and a Copper Mine beside it, all placed', () => {
        const onMat = BoardState.tokens();
        expect(onMat.map(t => t.typeId)).toEqual(['token_guild_hall', 'token_oak_forest', 'token_copper_mine']);
        expect(at(onMat[0])).toEqual({ typeId: 'token_guild_hall', x: 880, y: 563 });
        expect(onMat.every(t => t.origin === 'placed')).toBe(true);
        // The Hall is exempt from the mat cap; the other two count.
        expect(MatCap.tokenCount()).toBe(2);
        // Spawners carry no charges.
        expect(onMat.find(t => t.typeId === 'token_oak_forest').usesRemaining ?? null).toBeNull();
    });

    it('the Bank holds 3 Oak Seed, 10 Oak Wood and 2 Wheat Seed, and nothing else', () => {
        expect(InventoryManager.getItemCount('item_oak_seed')).toBe(3);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
        expect(InventoryManager.getItemCount('item_wheat_seed')).toBe(2);
        expect(Object.keys(GameState.state.inventory.items).sort())
            .toEqual(['item_oak_seed', 'item_oak_wood', 'item_wheat_seed']);
    });

    it('every built-in Token and item exists', () => {
        const camp = StarterCamp.builtInCamp();
        for (const { typeId } of StarterCamp.placementsOf(camp)) expect(getTokenType(typeId), typeId).toBeTruthy();
        for (const { itemId } of StarterCamp.openingBank(camp)) expect(getItem(itemId), itemId).toBeTruthy();
    });

    it('an empty camp (what the CMS Clear writes) opens on the built-in camp too', () => {
        setStarterCampForTests({ tokens: [], bank: {} });
        newGame();
        expect(BoardState.tokens().map(t => t.typeId)).toEqual(['token_guild_hall', 'token_oak_forest', 'token_copper_mine']);
    });

    it('still has no heroes', () => {
        expect(GameState.state.heroes).toEqual([]);
    });
});

describe('a new game opens in the Starter Camp the owner laid out', () => {
    beforeEach(() => {
        setStarterCampForTests(CAMP);
        newGame();
    });

    it('every Token stands where the camp says, the Guild Hall first, in the middle of the mat', () => {
        expect(BoardState.tokens().map(at)).toEqual([
            { typeId: 'token_guild_hall', x: 880, y: 563 },
            ...CAMP.tokens
        ]);
        expect(openingMat()).toEqual(BoardState.tokens().map(at));
        expect(BoardState.tokens().every(t => t.origin === 'placed')).toBe(true);
    });

    it('the Bank holds the camp\'s Bank, and nothing else', () => {
        expect(InventoryManager.getItemCount('fixture_ngo_wood')).toBe(7);
        expect(InventoryManager.getItemCount('fixture_ngo_ore')).toBe(2);
        expect(Object.keys(GameState.state.inventory.items).sort()).toEqual(['fixture_ngo_ore', 'fixture_ngo_wood']);
    });

    it('the endgame sites stand outside the Token cap: only the two producers count', () => {
        expect(BoardState.tokens()).toHaveLength(5);
        expect(MatCap.tokenCount()).toBe(2);
    });

    it('it is the guild\'s first Region, the Starter Camp, and it can never be abandoned', () => {
        const [starter] = Atlas.list();
        expect(Atlas.list()).toHaveLength(1);
        expect(starter).toMatchObject({ kind: REGION_KIND.STARTER, practicalName: TEXT.STARTER_CAMP, active: true });
        const away = Atlas.devCreateEmptyRegion().id;
        expect(Atlas.travel(away).success).toBe(true);
        expect(Atlas.abandon(starter.id)).toEqual({ success: false, reason: TEXT.REFUSE_STARTER });
        expect(Atlas.getRegion(starter.id)).toBeTruthy();
    });

    it('on a smaller mat the camp stays centred on the Hall, and nothing stands off the edge', () => {
        setMatTuning('matSteps', 8);
        newGame();
        const cx = Math.round(matW() / 2);
        const cy = Math.round(matH() / 2);
        const [hall, ...rest] = BoardState.tokens();
        expect(at(hall)).toEqual({ typeId: 'token_guild_hall', x: cx, y: cy });
        // The producers keep their offset from the Hall.
        const producers = rest.filter(t => t.typeId === 'fixture_ngo_producer');
        expect(producers.map(t => t.x - cx)).toEqual([-180, 180]);
        for (const t of rest) {
            expect(t.x - 64).toBeGreaterThanOrEqual(0);
            expect(t.y - 64).toBeGreaterThanOrEqual(0);
            expect(t.x + 64).toBeLessThanOrEqual(matW());
            expect(t.y + 64).toBeLessThanOrEqual(matH());
        }
    });

    it('a camp Token whose type no longer exists is left off; the rest stand', () => {
        setStarterCampForTests({ ...CAMP, tokens: [...CAMP.tokens, { typeId: 'token_renamed_away', x: 400, y: 900 }] });
        newGame();
        expect(BoardState.tokens().map(t => t.typeId)).not.toContain('token_renamed_away');
        expect(BoardState.tokens()).toHaveLength(5);
    });
});

/**
 * Close over what the player can get: Tokens (in the Starter Camp, bought, spawned, grown, turned
 * into, built) and items (the camp's Bank, trickle, worked from a Token whose inputs are already
 * reachable). A Token is bought once its whole price is reachable; a recipe runs once its inputs
 * are. The cartographer's maps join this once the tutorial gives them (Atlas A8).
 */
function reachable() {
    const camp = StarterCamp.starterCamp();
    const tokens = new Set(StarterCamp.placementsOf(camp).map(t => t.typeId));
    const items = new Set(StarterCamp.openingBank(camp).map(i => i.itemId));
    const all = Object.values(getAllTokenTypes());
    const have = (list) => (list || []).every(x => items.has(x.itemId));

    let grew = true;
    while (grew) {
        const before = tokens.size + items.size;
        for (const typeId of [...tokens]) {
            const def = getTokenType(typeId);
            if (!def) continue;
            for (const t of def.trickle || []) items.add(t.itemId);
            for (const s of def.spawner?.spawns || []) tokens.add(s.typeId);
            if (def.grows?.into) tokens.add(def.grows.into);
            for (const t of def.turns?.into || []) tokens.add(t.typeId);
            if (def.config && have(def.config.inputs)) {
                for (const o of def.config.outputs || []) {
                    if (o.itemId) items.add(o.itemId);
                    if (o.tokenId) tokens.add(o.tokenId);
                }
            }
            for (const r of recipesForToken(def) || []) {
                if (!have(r.inputs)) continue;
                for (const o of r.outputs || []) {
                    if (o.itemId) items.add(o.itemId);
                    if (o.tokenId) tokens.add(o.tokenId);
                }
            }
        }
        for (const def of all) {
            if (def.shop && have(def.shop.price)) tokens.add(def.id);
        }
        grew = tokens.size + items.size > before;
    }
    return { tokens, items };
}

describe('the §6 circularity check: every chain is reachable from the Starter Camp and the Shop', () => {
    const { tokens, items } = reachable();

    const SIX = {
        Forestry: ['token_oak_forest', 'token_oak_sapling', 'token_oak_tree'],
        Mining: ['token_copper_mine', 'token_coal_mine', 'token_quarry', 'token_copper_ore_vein', 'token_coal_vein', 'token_stone_outcrop'],
        Fishing: ['token_coast', 'token_shrimp_coast'],
        Farming: ['token_farmland', 'token_wheat_field', 'token_wheat_sprout', 'token_ripe_wheat', 'token_apple_orchard', 'token_apple_sapling', 'token_apple_tree'],
        Construction: ['token_wood_foundation', 'token_stone_foundation', 'token_fighter_s_academy'],
        Crafting: ['token_workbench'],
        Smithing: ['token_furnace', 'token_copper_anvil'],
        Cooking: ['token_cooking_pot'],
        Combat: ['token_goblin_camp', 'token_goblin', 'token_goblin_chief']
    };

    for (const [chain, ids] of Object.entries(SIX)) {
        it(`${chain}: every Token is reachable`, () => {
            for (const id of ids) expect(tokens.has(id), id).toBe(true);
        });
    }

    it('every chain item is reachable', () => {
        for (const id of [
            'item_oak_wood', 'item_oak_seed', 'item_copper_ore', 'item_coal', 'item_stone',
            'item_raw_shrimp', 'item_wheat', 'item_wheat_seed', 'item_apple', 'item_apple_seed',
            'item_charcoal', 'item_torch', 'item_copper_ingot', 'item_shrimp'
        ]) {
            expect(items.has(id), id).toBe(true);
        }
    });
});
