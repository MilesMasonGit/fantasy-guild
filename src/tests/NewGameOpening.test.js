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
import { getItem, getAllItems, registerItems } from '../config/registries/itemRegistry.js';
import { starterToolIds, toolOf, toolMeets } from '../config/registries/toolKinds.js';
import { matW, matH } from '../config/matGeometry.js';
import { catchPoolsOf } from '../config/registries/catchPools.js';
import { itemUseDropsOf } from '../config/registries/itemUse.js';
import { stationSkillOf } from '../systems/effects/statements.js';
import {
    getUpgradeDef, getUpgradePrice, WISHING_WELL_STAR
} from '../config/guildUpgrades.js';

import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import {
    effectYields, worldTokens, arrivingSpots, planeWorld, wellItems, poolsOnPlanes, planeNeedOf, rareFindsOf
} from './fixtures/planeReach.js';

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
 * circularity check: from the Starter Camp, its Bank and the Shop, every chain is reachable; and
 * every material, tool and building of planes 1 and 2 is, on the SHIPPED data. A plane is a ring of
 * the world map now: map items are retired, and a world cell of ring n writes its origins and its
 * hidden extras.
 *
 * ⚠️ The fixtures are registered here, not through `fixtures/testTokens.js`: that file registers
 * fixture recipe pools over the shipped ones, which would falsify the circularity check.
 */

registerItems({
    fixture_ngo_wood: { id: 'fixture_ngo_wood', name: 'Fixture Camp Wood', type: 'material', sprite: 'i_wood_oak', stackable: true },
    fixture_ngo_ore: { id: 'fixture_ngo_ore', name: 'Fixture Camp Ore', type: 'material', sprite: 'i_ore_copper', stackable: true }
});
registerTokenTypes({
    fixture_ngo_producer: {
        id: 'fixture_ngo_producer', name: 'Fixture Camp Producer', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 50, size: 1, sprite: 's_nature'
    },
    fixture_ngo_site: {
        id: 'fixture_ngo_site', name: 'Fixture Endgame Site', tokenType: 'resource', landmark: true,
        rarity: 'common', theme: 'fixture', uses: null, size: 1, sprite: 's_nature',
        config: { skill: 'forestry', skillRequired: 99, cycleTimeMs: 60000, xp: 0, inputs: [], outputs: [] }
    }
});

/** A Starter Camp as the CMS writes it, laid out on a 1760 × 1126 mat (the game's is 1920 × 1040). */
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

/** Besides the camp's Bank, a new game holds one of each starter tool (none until content marks some). */
const withStarterTools = (ids) => [...new Set([...ids, ...starterToolIds(getAllItems())])].sort();

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
        expect(at(onMat[0])).toEqual({ typeId: 'token_guild_hall', x: 960, y: 520 });
        expect(onMat.every(t => t.origin === 'placed')).toBe(true);
        // The Hall is exempt from the mat cap; the other two count.
        expect(MatCap.tokenCount()).toBe(2);
        // Spawners carry no charges.
        expect(onMat.find(t => t.typeId === 'token_oak_forest').usesRemaining ?? null).toBeNull();
    });

    it('the Bank holds 3 Oak Seedling, 10 Oak Wood and 2 Wheat Seed, the starter tools, and nothing else', () => {
        expect(InventoryManager.getItemCount('item_oak_seedling')).toBe(3);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10);
        expect(InventoryManager.getItemCount('item_wheat_seed')).toBe(2);
        expect(Object.keys(GameState.state.inventory.items).sort())
            .toEqual(withStarterTools(['item_oak_seedling', 'item_oak_wood', 'item_wheat_seed']));
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

    it('has its first hero, in the free first rank of Bunk Beds', () => {
        expect(GameState.state.heroes).toHaveLength(1);
        expect(GameState.state.progress.guildUpgrades.roster_size).toBe(1);
        expect(GameState.state.progress.rosterLimit).toBe(1);
    });
});

describe('a new game opens in the Starter Camp the owner laid out', () => {
    beforeEach(() => {
        setStarterCampForTests(CAMP);
        newGame();
    });

    it('every Token stands where the camp says, the Guild Hall first, in the middle of the mat', () => {
        // Saved on a mat of another size: the whole camp moves so the two middles meet.
        const shift = { x: 960 - 880, y: 520 - 563 };
        expect(BoardState.tokens().map(at)).toEqual([
            { typeId: 'token_guild_hall', x: 960, y: 520 },
            ...CAMP.tokens.map(t => ({ ...t, x: t.x + shift.x, y: t.y + shift.y }))
        ]);
        expect(openingMat()).toEqual(BoardState.tokens().map(at));
        expect(BoardState.tokens().every(t => t.origin === 'placed')).toBe(true);
    });

    it('the Bank holds the camp\'s Bank, the starter tools, and nothing else', () => {
        expect(InventoryManager.getItemCount('fixture_ngo_wood')).toBe(7);
        expect(InventoryManager.getItemCount('fixture_ngo_ore')).toBe(2);
        expect(Object.keys(GameState.state.inventory.items).sort()).toEqual(withStarterTools(['fixture_ngo_ore', 'fixture_ngo_wood']));
    });

    it('the endgame sites count toward the Token cap: the two sites and the two producers', () => {
        expect(BoardState.tokens()).toHaveLength(5);
        expect(MatCap.tokenCount()).toBe(4);
    });

    it('a camp with all 25 endgame sites and its opening producers leaves room to build', () => {
        // Four rows along the top and bottom edges, clear of the Hall and the producers.
        const sites = [];
        for (const y of [100, 260, 866, 1026]) {
            for (let x = 100; x <= 1500 && sites.length < 25; x += 200) sites.push({ typeId: 'fixture_ngo_site', x, y });
        }
        setStarterCampForTests({ ...CAMP, tokens: [...sites, ...CAMP.tokens.filter(t => t.typeId !== 'fixture_ngo_site')] });
        newGame();
        expect(BoardState.tokens().filter(t => t.typeId === 'fixture_ngo_site')).toHaveLength(25);
        expect(MatCap.tokenCount()).toBe(27);
        expect(MatCap.matCap()).toBe(128);
        expect(MatCap.matCap() - MatCap.tokenCount()).toBeGreaterThanOrEqual(90);
        expect(MatCap.canPlaceMore(90)).toBe(true);
    });

    it('it is the guild\'s first Region, the Starter Camp', () => {
        const [starter] = Atlas.list();
        expect(Atlas.list()).toHaveLength(1);
        expect(starter).toMatchObject({ kind: REGION_KIND.STARTER, practicalName: TEXT.STARTER_CAMP, active: true });
        const away = Atlas.devCreateEmptyRegion().id;
        expect(Atlas.travel(away).success).toBe(true);
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
 * Close over what the player can get: Tokens (in the Starter Camp, drifting in on its water or a
 * world cell's ({@link arrivingSpots}), bought, spawned, grown,
 * built, ambushing) and items (the camp's Bank and the starter tools, trickle, worked from a
 * Token whose inputs are already reachable with its rare finds, caught from the catch pools that
 * bite on the planes' ground ({@link poolsOnPlanes}), a bonus drop of an
 * effect on a reachable Token or item, the Wishing Well's Water). A Token is bought
 * once its whole price is reachable; a recipe runs once its inputs are; a Token whose work needs a
 * tool is worked once a tool that will do is. The world map's cells of rings up to `maxPlane` write
 * their Tokens ({@link worldTokens}): a cell is settled with materials of earlier rings, which this
 * close-over does not gate, as no skill level gates a recipe.
 *
 * The fight rule: an enemy Token that is reachable is beaten and drops its whole loot table
 * (its Outputs). Heroes fight bare-handed when nothing better is in
 * hand, and levels are earned by playing, so neither gear nor level gates a fight here, as no
 * skill level gates a recipe.
 */
function reachable({ maxPlane = 2 } = {}) {
    const camp = StarterCamp.starterCamp();
    const tokens = new Set([...StarterCamp.placementsOf(camp).map(t => t.typeId), ...worldTokens(maxPlane), ...arrivingSpots()]);
    const items = new Set([
        ...StarterCamp.openingBank(camp).map(i => i.itemId),
        ...starterToolIds(getAllItems()),
    ]);
    const all = Object.values(getAllTokenTypes());
    const have = (list) => (list || []).every(x => items.has(x.itemId));
    const toolFor = (def) => {
        const need = planeNeedOf(def);
        return !need || [...items].some(id => toolMeets(toolOf(getItem(id)), need));
    };
    const gain = (outputs) => {
        for (const o of outputs || []) {
            if (o.itemId) items.add(o.itemId);
            if (o.tokenId) tokens.add(o.tokenId);
        }
    };

    let grew = true;
    while (grew) {
        const before = tokens.size + items.size;
        for (const typeId of [...tokens]) {
            const def = getTokenType(typeId);
            if (!def) continue;
            for (const t of def.trickle || []) items.add(t.itemId);
            for (const s of def.spawner?.spawns || []) tokens.add(s.typeId);
            if (def.grows?.into && have(def.grows.cost)) tokens.add(def.grows.into);
            const works = !!def.config && have(def.config.inputs) && toolFor(def);
            if (works) {
                gain(def.config.outputs);
                const fx = effectYields(def);
                for (const id of fx.items) items.add(id);
                for (const id of fx.tokens) tokens.add(id);
                for (const id of rareFindsOf(def)) items.add(id);
            }
            // Water lands its catch instead of its Outputs: a pool bites once a tool of its kind is
            // in hand and its bait (if any) can be had.
            for (const pool of poolsOnPlanes(def)) {
                const tool = [...items].some(id => toolOf(getItem(id))?.kind === pool.tool);
                if (!tool || (pool.bait && !items.has(pool.bait))) continue;
                for (const c of pool.catches) items.add(c.itemId);
            }
            for (const r of recipesForToken(def) || []) {
                if (have(r.inputs)) gain(r.outputs);
            }
        }
        for (const def of all) {
            if (def.shop && have(def.shop.price)) tokens.add(def.id);
        }
        for (const id of [...items]) {
            // A consumable's effect works on whoever uses it, so its bonus drops come with it.
            for (const bonus of effectYields(getItem(id)).items) items.add(bonus);
            // An item used from the Bank opens into its drops: no hero, no tool.
            for (const d of itemUseDropsOf(getItem(id))) items.add(d.itemId);
        }
        const well = getUpgradeDef(WISHING_WELL_STAR);
        if (well && have(getUpgradePrice(well, 0))) for (const id of wellItems()) items.add(id);
        grew = tokens.size + items.size > before;
    }
    return { tokens, items };
}

describe('the §6 circularity check: every chain is reachable from the Starter Camp and the Shop', () => {
    const { tokens, items } = reachable();

    const SIX = {
        Forestry: ['token_oak_forest', 'token_oak_tree'],
        Mining: ['token_copper_mine', 'token_coal_mine', 'token_quarry', 'token_copper_ore_vein', 'token_coal_vein', 'token_stone_outcrop'],
        Fishing: ['token_fishing_spot', 'token_dock'],
        Farming: ['token_farmland', 'token_wheat_field', 'token_herb_garden', 'token_windmill', 'token_apple_orchard', 'token_apple_tree'],
        Construction: ['token_wood_foundation', 'token_stone_foundation', 'token_well'],
        Crafting: ['token_workbench'],
        Smithing: ['token_furnace'],
        Cooking: ['token_cooking_pot'],
        Combat: ['token_goblin_camp', 'token_goblin', 'token_chief_tent', 'token_goblin_chief']
    };

    for (const [chain, ids] of Object.entries(SIX)) {
        it(`${chain}: every Token is reachable`, () => {
            for (const id of ids) expect(tokens.has(id), id).toBe(true);
        });
    }

    it('every chain item is reachable', () => {
        for (const id of [
            'item_oak_wood', 'item_oak_seedling', 'item_copper_ore', 'item_coal', 'item_stone',
            'item_raw_shrimp', 'item_wheat', 'item_wheat_seed', 'item_apple', 'item_apple_seed',
            'item_charcoal', 'item_torch', 'item_copper_ingot', 'item_shrimp', 'item_flour', 'item_apple_juice'
        ]) {
            expect(items.has(id), id).toBe(true);
        }
    });
});


/**
 * Items a plane-1 or plane-2 recipe asks for (or makes) that nothing in those planes places yet,
 * with why. ⚠️ Each is a finding for the owner, not a pass: the last check below fails once one of
 * them becomes reachable or stops being asked for, so the list cannot outlive its reason.
 */
const NOT_YET_PLACED = Object.freeze({
    // The furnace offers every metal; only copper, iron, silver and mythril have veins on a plane-1 or plane-2 map.
    item_gold_ore: 'a later plane: only the Gold Ore Vein makes it, and no map places one',
    item_gold_ingot: 'a later plane: smelted from Gold Ore (furnace, level 45)',
    item_adamantine_ore: 'a later plane: only the Adamantine veins make it, and no map places one',
    item_adamantine_ingot: 'a later plane: smelted from Adamantine Ore (furnace, level 75)',
    item_darkmetal_ore: 'a later plane: only the Darkmetal Ore Vein makes it, and no map places one',
    item_darkmetal_ingot: 'a later plane: smelted from Darkmetal Ore (furnace, level 90)',
    // The brewery offers limeade (level 25), but no map places the Lime Tree.
    item_lime: 'only the Lime Tree makes it, and no map places one (the brewery asks for it at level 25)',
    // Ring 3 of the world (brief 330 W6): Farmland plants their forests and the smithy forges the
    // pickaxes past iron, but their trees and metals stand only in ring 3.
    item_mahogany_seedling: 'ring 3: only the Mahogany Tree drops it (Farmland plants a Mahogany Forest from it)',
    item_mahogany_wood: 'ring 3: only the Mahogany Tree and a planted Mahogany Forest make it',
    item_adamantium_pickaxe: 'ring 3: forged from Adamantine Ingots (smithy, level 75)',
    item_darkmetal_pickaxe: 'ring 3: forged from Darkmetal Ingots (smithy, level 90)',
    token_mahogany_forest: 'ring 3: planted from Mahogany Seedlings',
    // Later-ring content Synced since: its veins and trees, the planks, frames, blocks, chains and
    // tools made from them, and the better buildings built from those.
    item_adamantine_woodaxe: 'made from Adamantine Ingot, Cedar Wood, which the two planes do not reach yet',
    item_basalt: 'only the Basalt Vein makes it, and no plane-1 or plane-2 map places one',
    item_basalt_block: 'made from Basalt, which the two planes do not reach yet',
    item_cedar_seedling: 'only the Cedar Tree makes it, and it needs a Mythril Woodaxe the two planes cannot make yet',
    item_darkmetal_woodaxe: 'made from Darkmetal Ingot, Mahogany Wood, which the two planes do not reach yet',
    item_dragonscale: 'made from Red Scale, which the two planes do not reach yet',
    item_ebony_frame: 'made from Ebony Plank, Mythril Nails, which the two planes do not reach yet',
    item_ebony_plank: 'made from Ebony Wood, which the two planes do not reach yet',
    item_ebony_seedling: 'only the Ebony Tree makes it, and it needs a Darkmetal Woodaxe the two planes cannot make yet',
    item_ebony_wood: 'only the Ebony Tree makes it, and it needs a Darkmetal Woodaxe the two planes cannot make yet',
    item_gold_chain: 'made from Gold Ingot, which the two planes do not reach yet',
    item_gold_ring_band: 'made from Gold Ingot, which the two planes do not reach yet',
    item_mahogany_frame: 'made from Mahogany Plank, Mythril Nails, which the two planes do not reach yet',
    item_mahogany_plank: 'made from Mahogany Wood, which the two planes do not reach yet',
    item_red_scale: 'only the Fossil Bed makes it, and no plane-1 or plane-2 map places one',
    token_banquet_hall: 'built from Mahogany Frame, Marble Block, Roof Tiles, Iron Gears, which the two planes do not reach yet',
    token_cedar_forest: 'built from Cedar Seedling, which the two planes do not reach yet',
    token_deep_workings: 'built from Mahogany Frame, Marble Block, Roof Tiles, Iron Gears, which the two planes do not reach yet',
    token_ebony_forest: 'built from Ebony Seedling, which the two planes do not reach yet',
    token_fish_market: 'built from Mahogany Frame, Marble Block, Roof Tiles, Iron Gears, which the two planes do not reach yet',
    token_grand_forge: 'built from Mahogany Frame, Marble Block, Roof Tiles, Iron Gears, which the two planes do not reach yet',
    token_grovekeepers_hut: 'built from Mahogany Frame, Marble Block, Roof Tiles, Iron Gears, which the two planes do not reach yet',
    token_jewellers_hall: 'built from Mahogany Frame, Marble Block, Roof Tiles, Iron Gears, which the two planes do not reach yet',
    token_manor_farm: 'built from Mahogany Frame, Marble Block, Roof Tiles, Iron Gears, which the two planes do not reach yet',
    token_masters_study: 'built from Mahogany Frame, Marble Block, Roof Tiles, Iron Gears, which the two planes do not reach yet',
    token_town_square: 'built from Ebony Frame, Basalt Block, Gold Ingot, which the two planes do not reach yet',
    // A station offers every tier, and the later tiers wait for later planes (content session,
    // 2026-11-26): the Excavation offers a Dig for every vein, but a later vein's Prospecting Map
    // comes only from that vein's own rare finds, as no copper-tier drop feeds a late material.
    item_gold_prospecting_map: 'a later plane: only the Gold Ore Vein finds it (the Excavation\'s Dig Gold Vein asks for it)',
    item_adamantine_prospecting_map: 'a later plane: only the Adamantine veins find it (the Excavation\'s Dig Adamantine Vein asks for it)',
    item_darkmetal_prospecting_map: 'a later plane: only the Darkmetal Ore Vein finds it (the Excavation\'s Dig Darkmetal Vein asks for it)',
    token_gold_ore_vein: 'a later plane: dug from a Gold Prospecting Map, which only a Gold Ore Vein finds',
    token_adamantium_ore: 'a later plane: dug from an Adamantine Prospecting Map, which only an Adamantine vein finds',
    token_darkmetal_ore_vein: 'a later plane: dug from a Darkmetal Prospecting Map, which only a Darkmetal Ore Vein finds',
    // The harpoon fish moved later (Shark Waters arrive only in Flower Meadow, the Fishing Spot's
    // harpoon pool bites only in Flower Meadow and Cherry Grove), and so did the harpoons.
    item_shark: 'a later plane: only Shark Waters land it, in Flower Meadow (Cooked Shark, cooking level 83, and Bait from Shark ask for it)',
    item_cooked_shark: 'a later plane: cooked from Shark (cooking, level 83)',
    item_stingray: 'a later plane: only a harpoon in Flower Meadow or Cherry Grove lands it (Bait from Stingray, fishing level 54, asks for it)',
    item_adamantine_harpoon: 'a later plane: forged from Adamantine Ingots and Mahogany Planks (smithy, level 63)',
    item_darkmetal_harpoon: 'a later plane: forged from Darkmetal Ingots and Ebony Planks (smithy, level 83)',
    // Plane 3's lairs: the Battlefield offers a Build for every lair, but a lair's map drops only
    // from its own enemy, which only that lair on plane 3 spawns.
    item_troll_bridge_map: 'plane 3: only the Troll drops it (the Battlefield\'s Build Troll Bridge asks for it)',
    item_phoenix_nest_map: 'plane 3: only the Phoenix drops it (the Battlefield\'s Build Phoenix Nest asks for it)',
    item_void_rift_map: 'plane 3: only the Void Beast drops it (the Battlefield\'s Build Void Rift asks for it)',
    token_troll_bridge: 'plane 3: built from a Troll Bridge Map, which only a Troll drops',
    token_phoenix_nest: 'plane 3: built from a Phoenix Nest Map, which only a Phoenix drops',
    token_void_rift: 'plane 3: built from a Void Rift Map, which only a Void Beast drops'
});

/**
 * Tokens the two planes place whose work needs a tool tier nothing in them makes yet, with why. ⚠️ A
 * finding for the owner, like {@link NOT_YET_PLACED}: the check below fails once a tool reaches one.
 */
const NO_TOOL_YET = Object.freeze({
    token_mahogany_tree: 'a tier-4 woodaxe: the Adamantine Woodaxe, from Adamantine Ingots the two planes do not reach',
    token_ebony_tree: 'a tier-5 woodaxe: the Darkmetal Woodaxe, from Darkmetal Ingots the two planes do not reach',
    // The later veins the Excavation's Digs offer (NOT_YET_PLACED: their maps wait for later planes).
    token_darkmetal_ore_vein: 'a tier-4 pickaxe: the Adamantine Pickaxe, from Adamantine Ingots the two planes do not reach'
});

/** What makes an item anywhere in the content: Token ids and recipe ids. */
function makersOf(itemId) {
    const makers = [];
    for (const def of Object.values(getAllTokenTypes())) {
        const lines = [
            ...(def.config?.outputs || []),
            ...(def.trickle || []),
            ...catchPoolsOf(def).flatMap(p => p.catches),
            ...effectYields(def).items.map(id => ({ itemId: id })),
            ...rareFindsOf(def).map(id => ({ itemId: id }))
        ];
        if (lines.some(o => o.itemId === itemId)) makers.push(def.id);
        for (const r of recipesForToken(def) || []) {
            if ((r.outputs || []).some(o => o.itemId === itemId) && !makers.includes(r.id)) makers.push(r.id);
        }
    }
    return makers;
}

describe('K4: from the Starter Camp, every plane-1 and plane-2 thing is reachable', () => {
    const world = planeWorld(2);
    const { tokens, items } = reachable({ maxPlane: 2 });
    const named = new Set([...world.produced, ...world.asked.keys()]);
    const why = (id) => {
        const asks = world.asked.get(id);
        const makers = makersOf(id);
        return `${id}: made by ${makers.length ? makers.join(', ') : 'nothing'}`
            + (asks ? `; asked for by ${[...asks].join(', ')}` : '');
    };
    const unreached = (ids, have) => ids.filter(id => !have.has(id) && !NOT_YET_PLACED[id]).sort().map(why);

    const materials = [...named].filter(id => getItem(id)?.type === 'material');
    const tools = [...named].filter(id => toolOf(getItem(id)));
    const buildings = [...world.tokens].filter(id => world.built.has(id) || stationSkillOf(getTokenType(id)));

    it('every item the two planes name exists', () => {
        expect([...named].filter(id => !getItem(id)).sort()).toEqual([]);
    });

    it('every material', () => {
        expect(materials.length).toBeGreaterThan(0);
        expect(unreached(materials, items)).toEqual([]);
    });

    it('every tool, and a tool for every Token whose work needs one', () => {
        expect(tools.length).toBeGreaterThan(0);
        expect(unreached(tools, items)).toEqual([]);
        const toolless = [...world.needs].filter(([, need]) => ![...items].some(id => toolMeets(toolOf(getItem(id)), need)));
        const noTool = toolless
            .filter(([typeId]) => !NO_TOOL_YET[typeId])
            .map(([typeId, need]) => `${typeId} needs a ${need.kind} of tier ${need.minTier}`);
        expect(noTool).toEqual([]);
        const toollessIds = new Set(toolless.map(([typeId]) => typeId));
        expect(Object.keys(NO_TOOL_YET).filter(id => !toollessIds.has(id)), 'remove these from NO_TOOL_YET').toEqual([]);
    });

    it('every building: built on a foundation, sold in the Shop, or a station', () => {
        expect(buildings.length).toBeGreaterThan(0);
        const builtBy = (id) => {
            const by = Object.values(getAllTokenTypes()).flatMap(def => (recipesForToken(def) || [])
                .filter(r => (r.outputs || []).some(o => o.tokenId === id)).map(r => r.id));
            const shop = getTokenType(id)?.shop ? '; sold in the Shop' : '';
            return `${id}: built by ${[...new Set(by)].join(', ') || 'no recipe'}${shop}`;
        };
        expect(buildings.filter(id => !tokens.has(id) && !NOT_YET_PLACED[id]).sort().map(builtBy)).toEqual([]);
    });

    it('every exclusion is still named by the two planes and still unreached', () => {
        const stale = Object.keys(NOT_YET_PLACED).filter(id => (id.startsWith('token_')
            ? !buildings.includes(id) || tokens.has(id)
            : !named.has(id) || items.has(id)));
        expect(stale, 'remove these from NOT_YET_PLACED').toEqual([]);
    });
});
