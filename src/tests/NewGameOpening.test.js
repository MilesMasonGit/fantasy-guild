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
import { starterToolIds, neededToolOf, toolOf, toolMeets } from '../config/registries/toolKinds.js';
import { matW, matH } from '../config/matGeometry.js';
import { catchPoolsOf } from '../config/registries/catchPools.js';
import { isModifier, tokenRefsOf } from '../systems/atlas/mapItems.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { BOUNTY_REWARD_ITEMS, RANDOM_ITEMS, RANDOM_HUNTS } from '../systems/quests/questBounties.js';
import { worldTables } from '../config/registries/worldTablesRegistry.js';
import { getEffect } from '../config/registries/effectRegistry.js';
import { stationSkillOf } from '../systems/effects/statements.js';
import {
    getUpgradeDef, getUpgradePrice, WISHING_WELL_ITEM, TOKEN_CAP_PLANE_PRICES, CARTOGRAPHY_PLANE_PRICES
} from '../config/guildUpgrades.js';
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

/** The effects a Token or item carries, followed through `applies` (a potion's effect on its drinker). */
function effectsOf(def) {
    const out = [];
    const seen = new Set();
    const walk = (effectId) => {
        if (!effectId || seen.has(effectId)) return;
        seen.add(effectId);
        const effect = getEffect(effectId);
        if (!effect) return;
        out.push(effect);
        for (const s of effect.statements || []) if (s.keyword === 'applies') walk(s.payload?.effectId);
    };
    for (const e of def?.effects || []) walk(e?.effectId);
    return out;
}

/** What a Token's or item's effects add when it works or is used: bonus drops and spawned Tokens. */
function effectYields(def) {
    const items = [];
    const tokens = [];
    for (const effect of effectsOf(def)) {
        for (const s of effect.statements || []) {
            if (s.keyword === 'grants' && s.payload?.itemId) items.push(s.payload.itemId);
            if (s.keyword === 'spawns' && s.payload?.typeId) tokens.push(s.payload.typeId);
        }
    }
    for (const block of def?.effectBlocks || []) {
        for (const m of block.modifiers || []) if (m.type === 'BONUS_DROP' && m.itemId) items.push(m.itemId);
    }
    return { items, tokens };
}

const TUTORIAL_STEP_ITEMS = [...new Set(TUTORIAL_QUESTS.flatMap(q => (q.rewardItems || []).map(r => r.itemId)))];
const BOUNTY_ITEMS = BOUNTY_REWARD_ITEMS.map(r => r.itemId);

/**
 * Close over what the player can get: Tokens (in the Starter Camp, bought, spawned, grown, turned
 * into, built, ambushing) and items (the camp's Bank and the starter tools, trickle, worked from a
 * Token whose inputs are already reachable, caught from water's catch pools, a bonus drop of an
 * effect on a reachable Token or item, quest rewards, the Wishing Well's Water). A Token is bought
 * once its whole price is reachable; a recipe runs once its inputs are; a Token whose work needs a
 * tool is worked once a tool that will do is. The world map's cells of rings up to `maxPlane` write
 * their Tokens ({@link worldTokens}): a cell is settled with materials of earlier rings, which this
 * close-over does not gate, as no skill level gates a recipe.
 *
 * The fight rule: an enemy Token that is reachable is beaten and drops its whole loot table
 * (its Outputs), first-kill lines included. Heroes fight bare-handed when nothing better is in
 * hand, and levels are earned by playing, so neither gear nor level gates a fight here, as no
 * skill level gates a recipe.
 *
 * A bounty pays its items once anything it asks for can be had.
 */
function reachable({ maxPlane = 2 } = {}) {
    const camp = StarterCamp.starterCamp();
    const tokens = new Set([...StarterCamp.placementsOf(camp).map(t => t.typeId), ...worldTokens(maxPlane)]);
    const items = new Set([
        ...StarterCamp.openingBank(camp).map(i => i.itemId),
        ...starterToolIds(getAllItems()),
    ]);
    const all = Object.values(getAllTokenTypes());
    const have = (list) => (list || []).every(x => items.has(x.itemId));
    const toolFor = (def) => {
        const need = neededToolOf(def);
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
            for (const t of def.turns?.into || []) tokens.add(t.typeId);
            const works = !!def.config && have(def.config.inputs) && toolFor(def);
            if (works) {
                gain(def.config.outputs);
                const fx = effectYields(def);
                for (const id of fx.items) items.add(id);
                for (const id of fx.tokens) tokens.add(id);
            }
            // Water lands its catch instead of its Outputs: a pool bites once a tool of its kind is
            // in hand and its bait (if any) can be had.
            for (const pool of catchPoolsOf(def)) {
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
        }
        for (const id of TUTORIAL_STEP_ITEMS) items.add(id);
        const bountyAsks = RANDOM_ITEMS.some(r => items.has(r.id)) || RANDOM_HUNTS.some(h => tokens.has(h.id));
        if (bountyAsks) {
            for (const id of BOUNTY_ITEMS) items.add(id);
        }
        const well = getUpgradeDef('wishing_well');
        if (well && have(getUpgradePrice(well, 0))) items.add(WISHING_WELL_ITEM);
        grew = tokens.size + items.size > before;
    }
    return { tokens, items };
}

/**
 * The Tokens the world map's cells of rings 1 to `maxRing` write, from the world tables in force:
 * each line's origins and key origins of those rings, and their hidden extras (a treasure, or the
 * Tokens a modifier names). Any cell may draw any extra its ring allows.
 */
function worldTokens(maxRing) {
    const tables = worldTables();
    const out = new Set();
    for (let ring = 1; ring <= maxRing; ring++) {
        for (const line of tables.lines) for (const o of line.origins[ring] || []) out.add(o.id);
        for (const id of tables.keys[ring] || []) out.add(id);
    }
    for (const extra of tables.extras) {
        if (extra.rings && !extra.rings.some(r => r <= maxRing)) continue;
        if (extra.kind === 'treasure') out.add(extra.id);
        const def = getItem(extra.id);
        if (extra.kind === 'modifier' && isModifier(def)) for (const ref of tokenRefsOf(def)) out.add(ref.typeId);
    }
    return out;
}

/** The Hall's prices by plane: ranks 1-2 are plane 1's, ranks 3-4 plane 2's. */
const hallPlanePrices = (plane) => [TOKEN_CAP_PLANE_PRICES, CARTOGRAPHY_PLANE_PRICES]
    .flatMap(byRank => byRank.slice(plane === 1 ? 0 : 2, plane === 1 ? 2 : 4))
    .flatMap(rank => rank.map(([itemId]) => itemId));

/**
 * What planes 1 to `maxPlane` put in the game, on paper: the Starter Camp, the Shop, and every Token
 * the world map's rings up to it write, followed through everything those Tokens spawn, grow
 * into or build, whether or not their inputs can be had. `produced` is every item that world makes,
 * drops or pays; `asked` every item it asks for (inputs, prices, costs, bait), each with who asks;
 * `needs` the tools its work needs; `built` the Tokens it builds or sells. This is the list the
 * reachability check holds to account.
 */
function planeWorld(maxPlane = 2) {
    const camp = StarterCamp.starterCamp();
    const allItems = getAllItems();
    const all = Object.values(getAllTokenTypes());
    const tokens = new Set([...StarterCamp.placementsOf(camp).map(t => t.typeId), ...worldTokens(maxPlane)]);
    const built = new Set();
    for (const def of all) if (def.shop) { tokens.add(def.id); built.add(def.id); }
    const produced = new Set([
        ...StarterCamp.openingBank(camp).map(i => i.itemId),
        ...starterToolIds(allItems),
        ...TUTORIAL_STEP_ITEMS,
        ...BOUNTY_ITEMS,
        WISHING_WELL_ITEM
    ]);
    const asked = new Map();
    const ask = (list, by) => {
        for (const x of list || []) {
            if (!x?.itemId) continue;
            if (!asked.has(x.itemId)) asked.set(x.itemId, new Set());
            asked.get(x.itemId).add(by);
        }
    };
    const needs = new Map();
    const make = (outputs) => {
        for (const o of outputs || []) {
            if (o.itemId) produced.add(o.itemId);
            if (o.tokenId) { tokens.add(o.tokenId); built.add(o.tokenId); }
        }
    };

    let grew = true;
    while (grew) {
        const before = tokens.size + produced.size;
        for (const typeId of [...tokens]) {
            const def = getTokenType(typeId);
            if (!def) continue;
            for (const t of def.trickle || []) produced.add(t.itemId);
            for (const s of def.spawner?.spawns || []) tokens.add(s.typeId);
            if (def.grows?.into) { tokens.add(def.grows.into); ask(def.grows.cost, typeId); }
            for (const t of def.turns?.into || []) tokens.add(t.typeId);
            if (def.shop) ask(def.shop.price, `${typeId} (Shop)`);
            if (def.config) {
                make(def.config.outputs);
                ask(def.config.inputs, typeId);
                const fx = effectYields(def);
                for (const id of fx.items) produced.add(id);
                for (const id of fx.tokens) tokens.add(id);
            }
            const need = neededToolOf(def);
            if (need) needs.set(typeId, need);
            for (const pool of catchPoolsOf(def)) {
                for (const c of pool.catches) produced.add(c.itemId);
                if (pool.bait) ask([{ itemId: pool.bait }], `${typeId} (bait)`);
            }
            for (const r of recipesForToken(def) || []) {
                make(r.outputs);
                ask(r.inputs, r.id);
            }
        }
        for (const id of [...produced]) {
            for (const bonus of effectYields(getItem(id)).items) produced.add(bonus);
        }
        grew = tokens.size + produced.size > before;
    }
    for (let plane = 1; plane <= maxPlane; plane++) ask(hallPlanePrices(plane).map(itemId => ({ itemId })), `Guild Hall (plane ${plane})`);
    return { tokens, produced, asked, needs, built };
}

describe('the §6 circularity check: every chain is reachable from the Starter Camp and the Shop', () => {
    const { tokens, items } = reachable();

    const SIX = {
        Forestry: ['token_oak_forest', 'token_oak_sapling', 'token_oak_tree'],
        Mining: ['token_copper_mine', 'token_coal_mine', 'token_quarry', 'token_copper_ore_vein', 'token_coal_vein', 'token_stone_outcrop'],
        Fishing: ['token_coast', 'token_dock'],
        Farming: ['token_farmland', 'token_wheat_field', 'token_herb_garden', 'token_windmill', 'token_apple_orchard', 'token_apple_sapling', 'token_apple_tree'],
        Construction: ['token_wood_foundation', 'token_stone_foundation', 'token_fighter_s_academy'],
        Crafting: ['token_workbench'],
        Smithing: ['token_furnace', 'token_copper_smithy'],
        Cooking: ['token_cooking_pot', 'token_brewery'],
        Combat: ['token_goblin_camp', 'token_goblin']
    };

    for (const [chain, ids] of Object.entries(SIX)) {
        it(`${chain}: every Token is reachable`, () => {
            for (const id of ids) expect(tokens.has(id), id).toBe(true);
        });
    }

    // ⚠️ Expected to fail: only the retired Mountain Map placed the Goblin Chief's tent, and no world
    // cell writes a boss camp yet (the arrival encounter, sometimes a boss, and the world's content
    // pack will). When one does, this starts passing and fails as an it.fails: move the ids back
    // into Combat above.
    it.fails('Combat: the Goblin Chief and his tent are reachable', () => {
        for (const id of ['token_chief_tent', 'token_goblin_chief']) expect(tokens.has(id), id).toBe(true);
    });

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
    // The furnace offers every metal; only copper and iron have veins on a plane-1 or plane-2 map.
    item_silver_ore: 'a later plane: only the Silver Ore Vein makes it, and no map places one',
    item_silver_ingot: 'a later plane: smelted from Silver Ore (furnace, level 30)',
    item_gold_ore: 'a later plane: only the Gold Ore Vein makes it, and no map places one',
    item_gold_ingot: 'a later plane: smelted from Gold Ore (furnace, level 45)',
    item_mythril_ore: 'a later plane: only the Mythril Ore Vein makes it, and no map places one',
    item_mythril_ingot: 'a later plane: smelted from Mythril Ore (furnace, level 60)',
    item_adamantine_ore: 'a later plane: only the Adamantine veins make it, and no map places one',
    item_adamantine_ingot: 'a later plane: smelted from Adamantine Ore (furnace, level 75)',
    item_darkmetal_ore: 'a later plane: only the Darkmetal Ore Vein makes it, and no map places one',
    item_darkmetal_ingot: 'a later plane: smelted from Darkmetal Ore (furnace, level 90)',
    // The brewery offers lemonade (level 15) and limeade (level 25), but no map places their trees.
    item_lemon: 'only the Lemon Tree makes it, and no map places one (the brewery asks for it at level 15)',
    item_lime: 'only the Lime Tree makes it, and no map places one (the brewery asks for it at level 25)'
});

/** What makes an item anywhere in the content: Token ids and recipe ids. */
function makersOf(itemId) {
    const makers = [];
    for (const def of Object.values(getAllTokenTypes())) {
        const lines = [
            ...(def.config?.outputs || []),
            ...(def.trickle || []),
            ...catchPoolsOf(def).flatMap(p => p.catches),
            ...effectYields(def).items.map(id => ({ itemId: id }))
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
        const noTool = [...world.needs]
            .filter(([, need]) => ![...items].some(id => toolMeets(toolOf(getItem(id)), need)))
            .map(([typeId, need]) => `${typeId} needs a ${need.kind} of tier ${need.minTier}`);
        expect(noTool).toEqual([]);
    });

    it('every building: built on a foundation, sold in the Shop, or a station', () => {
        expect(buildings.length).toBeGreaterThan(0);
        const builtBy = (id) => {
            const by = Object.values(getAllTokenTypes()).flatMap(def => (recipesForToken(def) || [])
                .filter(r => (r.outputs || []).some(o => o.tokenId === id)).map(r => r.id));
            const shop = getTokenType(id)?.shop ? '; sold in the Shop' : '';
            return `${id}: built by ${[...new Set(by)].join(', ') || 'no recipe'}${shop}`;
        };
        expect(buildings.filter(id => !tokens.has(id)).sort().map(builtBy)).toEqual([]);
    });

    it('every exclusion is still named by the two planes and still unreached', () => {
        const stale = Object.keys(NOT_YET_PLACED).filter(id => !named.has(id) || items.has(id));
        expect(stale, 'remove these from NOT_YET_PLACED').toEqual([]);
    });
});
