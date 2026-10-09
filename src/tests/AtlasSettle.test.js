import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GameState } from '../state/GameState.js';
import { createEmptyBoard, createRegionRecord, validateSaveData } from '../state/StateSchema.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as Cartography from '../systems/atlas/Cartography.js';
import { budget, nodeLimit } from '../systems/atlas/Budget.js';
import { layout, hallSpot, HALL_CLEARING, HALL_TYPE_ID } from '../systems/atlas/Layout.js';
import { layoutOptions, shippedMat } from '../systems/atlas/layoutInputs.js';
import { nextSeed, seedFromText } from '../systems/atlas/seededRandom.js';
import { TEXT } from '../systems/atlas/regionNames.js';
import { DEV_MAPS } from '../systems/atlas/devMaps.js';
import { canon } from '../../bench/lib/fingerprint.mjs';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ Settling a Region: the Cartography table's preview (a Node Summary and a seeded layout) becomes
 * a Region whose board holds every node where the layout put it, as a fixture; the ingredients
 * leave the stock only then. A reroll moves coordinates and nothing else, and no step draws from
 * `Math.random`.
 */

const OAK = 'fixture_producer';
const ORE = 'fixture_producer_alt';
const BERRY = 'fixture_atlas_berry';
const COLOSSUS = 'fixture_atlas_colossus';

registerTokenTypes({
    [BERRY]: {
        id: BERRY, name: 'Atlas Berry', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 25, sprite: 'skill_nature', config: null
    },
    // A 2×2: at the 256 cap a map of nothing else overfills the mat, so a layout leaves some unplaced.
    [COLOSSUS]: {
        id: COLOSSUS, name: 'Atlas Colossus', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        size: 2, uses: null, sprite: 'skill_nature', config: null
    }
});

const FORESTRY_RULE = Object.freeze({
    id: 'stm_test_region_forestry', keyword: 'provides',
    payload: Object.freeze({ type: 'YIELD', bucket: 'percentage', value: 0.1, category: 'forestry' })
});

const WOOD = Object.freeze({
    id: 'test_map_wood', name: 'Wood Map', kind: 'base', biome: 'forest', points: 24,
    nodes: [{ typeId: OAK, weight: 3 }, { typeId: BERRY, weight: 1 }]
});
const HILLS = Object.freeze({
    id: 'test_map_hills', name: 'Hills Map', kind: 'base', biome: 'mountain', points: 20,
    nodes: [{ typeId: ORE, weight: 1 }]
});
const THICKET = Object.freeze({
    id: 'test_mod_thicket', name: 'Thicket', kind: 'modifier',
    effects: [{ kind: 'density', typeId: OAK, points: 8 }],
    rules: [FORESTRY_RULE]
});
const GIANT = Object.freeze({
    id: 'test_map_giant', name: 'Giant Map', kind: 'base', biome: 'forest', points: 1000,
    nodes: [{ typeId: COLOSSUS, weight: 1 }]
});

/** WOOD and THICKET as the Map editor authors them: items, banked like any item. */
const WOOD_ITEM = 'map_test_wood';
const THICKET_ITEM = 'mod_test_thicket';
const NOT_A_MAP = 'fixture_atlas_plank';
registerItems({
    [WOOD_ITEM]: {
        id: WOOD_ITEM, name: 'Wood Map', type: 'map', stackable: true,
        cartography: { biome: WOOD.biome, points: WOOD.points, nodes: WOOD.nodes.map(n => ({ ...n })), camps: [], treasures: [] }
    },
    [THICKET_ITEM]: {
        id: THICKET_ITEM, name: 'Thicket', type: 'modifier', stackable: true,
        cartography: { effects: THICKET.effects.map(e => ({ ...e })) }
    },
    [NOT_A_MAP]: { id: NOT_A_MAP, name: 'Atlas Plank', type: 'material', stackable: true }
});
const bank = (id) => InventoryManager.getItemCount(id);

const copy = (v) => JSON.parse(JSON.stringify(v));
const centre = () => ({ x: Math.round(matW() / 2), y: Math.round(matH() / 2) });
const regionCount = () => Object.keys(GameState.state.atlas.regions).length;
/** A board's Tokens in arrival order. */
const tokensOf = (board) => Object.values(board.tokens).sort((a, b) => a.placedAt - b.placedAt);
/** `role|typeId` → count. */
const countsOf = (nodes) => nodes.reduce((out, n) => ({ ...out, [`${n.role}|${n.typeId}`]: (out[`${n.role}|${n.typeId}`] || 0) + 1 }), {});
const summaryCounts = (summary) => Object.fromEntries(summary.entries.map(e => [`${e.role}|${e.typeId}`, e.count]));

let hall;

/** A new game: the Guild Hall alone in the middle of the mat, the Starter Camp. */
function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const c = centre();
    hall = placeAt('token_guild_hall', c.x, c.y);
    Atlas.createStarterRegion();
    Cartography.clearStock();
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    newGame();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    GameLoop.stop();
    Cartography.clearStock();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('recipeOf: a recipe as it is, a map item as the recipe its Cartography block describes', () => {
    it('a recipe comes back as it is', () => {
        expect(Atlas.recipeOf(WOOD)).toBe(WOOD);
        expect(Atlas.recipeOf(THICKET)).toBe(THICKET);
    });

    it('a map item, by id or as the item, becomes its recipe', () => {
        const { name: _name, ...wood } = WOOD;
        expect(Atlas.recipeOf(WOOD_ITEM)).toEqual({ ...wood, id: WOOD_ITEM });
        expect(Atlas.recipeOf({ id: 'item_blank_map', type: 'map' }))
            .toEqual({ id: 'item_blank_map', kind: 'base', biome: null, points: 0, nodes: [] });
        expect(Atlas.recipeOf(THICKET_ITEM)).toEqual({ id: THICKET_ITEM, kind: 'modifier', effects: THICKET.effects });
    });

    it('anything else is refused loudly, naming what it was', () => {
        expect(() => Atlas.recipeOf('item_forest_map')).toThrow(/"item_forest_map" is not a map recipe or a map item/);
        expect(() => Atlas.recipeOf(NOT_A_MAP)).toThrow(TypeError);
        expect(() => Atlas.recipeOf({ id: NOT_A_MAP, type: 'material' })).toThrow(TypeError);
        expect(() => Atlas.recipeOf({ id: 'x', kind: 'plains' })).toThrow(/kind "plains"/);
        expect(() => Atlas.recipeOf(null)).toThrow(TypeError);
    });
});

describe('maps in the Bank: what the table may slot, and what Settle takes', () => {
    it('the Bank\'s map items are held, by id; other items are not', () => {
        InventoryManager.addItem(WOOD_ITEM, 2);
        InventoryManager.addItem(NOT_A_MAP, 5);
        Cartography.grant([HILLS], 1);
        expect(Atlas.heldCount(WOOD_ITEM)).toBe(2);
        expect(Atlas.heldCount(THICKET_ITEM)).toBe(0);
        expect(Atlas.held().map(h => [h.recipe.id, h.count])).toEqual([[WOOD_ITEM, 2], [HILLS.id, 1]]);
        // A map item granted from the console goes where map items live.
        Cartography.grant([WOOD_ITEM], 1);
        expect(bank(WOOD_ITEM)).toBe(3);
    });

    it('settling from Bank-held map items takes exactly those items, and nothing else', () => {
        InventoryManager.addItem(WOOD_ITEM, 2);
        InventoryManager.addItem(THICKET_ITEM, 1);
        InventoryManager.addItem(NOT_A_MAP, 5);
        Cartography.grant([WOOD], 1);
        const result = Atlas.settle({ ingredients: [WOOD_ITEM, THICKET_ITEM], seed: 9 });
        expect(result.success).toBe(true);
        expect([bank(WOOD_ITEM), bank(THICKET_ITEM), bank(NOT_A_MAP)]).toEqual([1, 0, 5]);
        expect(Atlas.heldCount(WOOD)).toBe(1);
        expect(result.region).toMatchObject({ ingredients: [WOOD_ITEM, THICKET_ITEM], practicalName: 'Thicket Wood' });
    });

    it('a Region settled from an authored Forest Map item gets the same layout as from the fixture recipe', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        const fromRecipe = Atlas.preview([WOOD], { seed: 13 });
        const { region, preview } = Atlas.settle({ ingredients: [WOOD_ITEM], seed: 13 });
        expect(preview.layout).toEqual(fromRecipe.layout);
        expect(preview.summary.entries).toEqual(fromRecipe.summary.entries);
        expect(tokensOf(region.board).map(t => [t.typeId, t.x, t.y]))
            .toEqual(fromRecipe.layout.nodes.map(n => [n.typeId, n.x, n.y]));
    });

    it('a map the Bank lacks a copy of is refused, taking nothing and writing nothing', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        const before = regionCount();
        const twice = Atlas.settle({ ingredients: [WOOD_ITEM, WOOD_ITEM], seed: 1 });
        expect(twice).toMatchObject({ success: false, reason: TEXT.REFUSE_NOT_HELD });
        expect(twice.missing).toEqual([{ id: WOOD_ITEM, needed: 2, held: 1 }]);
        const none = Atlas.settle({ ingredients: [WOOD_ITEM, THICKET_ITEM], seed: 1 });
        expect(none.missing).toEqual([{ id: THICKET_ITEM, needed: 1, held: 0 }]);
        expect(bank(WOOD_ITEM)).toBe(1);
        expect(regionCount()).toBe(before);
    });

    it('a Bank map and a dev-console recipe settle together, each taken from where it is held', () => {
        InventoryManager.addItem(WOOD_ITEM, 1);
        Cartography.grant([THICKET], 1);
        expect(Atlas.settle({ ingredients: [WOOD_ITEM, THICKET], seed: 2 }).success).toBe(true);
        expect([bank(WOOD_ITEM), Atlas.heldCount(THICKET)]).toEqual([0, 0]);
    });
});

describe('the preview', () => {
    it('is the node budget under today\'s Token cap, laid out with the game\'s own inputs', () => {
        const plan = Atlas.preview([WOOD, THICKET], { seed: 7 });
        expect(plan.summary).toEqual(budget([WOOD, THICKET], { cap: MatCap.matCap() }));
        expect(plan.layout).toEqual(layout(plan.summary, layoutOptions(plan.summary, 7)));
        expect(plan).toMatchObject({ seed: 7, ingredients: ['test_map_wood', 'test_mod_thicket'], fits: true });
        expect(countsOf(plan.layout.nodes)).toEqual(summaryCounts(plan.summary));
    });

    it('a Token cap upgrade (here the dev override) changes the budget', () => {
        setMatTuning('tokenCap', 40);
        const plan = Atlas.preview([WOOD, HILLS, THICKET], { seed: 7 });
        expect(plan.summary.limit).toBe(nodeLimit(40));
        expect(plan.summary.total).toBe(nodeLimit(40));
        expect(plan.summary.clamped).toBe(true);
    });

    it('changes nothing: no Region, no stock, no board', () => {
        Cartography.grant([WOOD], 1);
        const board = canon(GameState.state.board);
        const regions = canon(GameState.state.atlas.regions);
        Atlas.preview([WOOD], { seed: 3 });
        expect(canon(GameState.state.board)).toBe(board);
        expect(canon(GameState.state.atlas.regions)).toBe(regions);
        expect(Atlas.heldCount(WOOD)).toBe(1);
    });
});

describe('the seed: the guild\'s own, never Math.random', () => {
    it('the first preview seed is the guild seed stepped by nextSeed, and each preview steps it again', () => {
        GameState.state.atlas.seed = 1234;
        const first = Atlas.preview([WOOD]);
        expect(first.seed).toBe(nextSeed(1234));
        expect(GameState.state.atlas.seed).toBe(first.seed);
        const second = Atlas.preview([WOOD]);
        expect(second.seed).toBe(nextSeed(first.seed));
    });

    it('a new guild starts its seed from when the game was created, so two guilds see different layouts', () => {
        expect(GameState.state.atlas.seed).toBeNull();
        const createdAt = GameState.state.meta.createdAt;
        expect(Atlas.preview([WOOD]).seed).toBe(nextSeed(seedFromText(String(createdAt))));
    });

    it('the guild seed is saved: after a reload the previews carry on where they were', async () => {
        GameState.state.atlas.seed = 99;
        Atlas.preview([WOOD]);
        const data = JSON.parse(GameState.serializeJson());
        const expected = nextSeed(GameState.state.atlas.seed);
        await GameState.initFromSave(migrateState(data.state, data.version));
        expect(Atlas.preview([WOOD]).seed).toBe(expected);
    });

    it('previewing, rerolling and settling draw no random number', () => {
        Cartography.grant([WOOD, THICKET], 1);
        let draws = 0;
        const real = Math.random;
        const spy = vi.spyOn(Math, 'random').mockImplementation(() => { draws++; return real(); });
        try {
            let plan = Atlas.preview([WOOD, THICKET]);
            for (let i = 0; i < 3; i++) plan = Atlas.reroll(plan);
            expect(Atlas.settle({ ingredients: [WOOD, THICKET], seed: plan.seed }).success).toBe(true);
        } finally {
            spy.mockRestore();
        }
        expect(draws).toBe(0);
    });
});

describe('reroll: a new seed, and nothing else', () => {
    it('ten rerolls: the next seed each time, the very same Node Summary, every Token placed, the Tokens moved', () => {
        Cartography.grant([WOOD, HILLS, THICKET], 1);
        const first = Atlas.preview([WOOD, HILLS, THICKET]);
        const guildSeed = GameState.state.atlas.seed;
        const fresh = budget([WOOD, HILLS, THICKET], { cap: MatCap.matCap() });
        let plan = first;
        for (let i = 0; i < 10; i++) {
            const next = Atlas.reroll(plan);
            expect(next.seed).toBe(nextSeed(plan.seed));
            expect(next.summary).toBe(first.summary);
            expect(next.summary).toEqual(fresh);
            expect(next.layout.unplaced).toEqual([]);
            expect(countsOf(next.layout.nodes)).toEqual(summaryCounts(first.summary));
            expect(next.layout.hall).toEqual(first.layout.hall);
            const moved = next.layout.nodes.filter((n, k) => n.x !== plan.layout.nodes[k].x || n.y !== plan.layout.nodes[k].y);
            expect(moved.length).toBeGreaterThan(next.layout.nodes.length / 2);
            plan = next;
        }
        // Rerolling takes nothing; the guild seed has followed it to the last seed shown.
        expect(guildSeed).toBe(first.seed);
        expect(GameState.state.atlas.seed).toBe(plan.seed);
        expect(Atlas.held().map(h => h.count)).toEqual([1, 1, 1]);
    });

    it('a later preview never shows a seed already shown, so two Regions never share a seed', () => {
        Cartography.grant([WOOD, HILLS], 1);
        const shown = [];
        let plan = Atlas.preview([WOOD]);
        shown.push(plan.seed);
        for (let i = 0; i < 3; i++) shown.push((plan = Atlas.reroll(plan)).seed);
        const first = Atlas.settle({ ingredients: [WOOD], seed: plan.seed }).region;
        // The table opens again, for another map.
        let again = Atlas.preview([HILLS]);
        expect(shown).not.toContain(again.seed);
        shown.push(again.seed);
        // Closed without settling, opened once more: still nothing shown before.
        again = Atlas.reroll(again);
        shown.push(again.seed);
        const fresh = Atlas.preview([HILLS]);
        expect(shown).not.toContain(fresh.seed);
        const second = Atlas.settle({ ingredients: [HILLS], seed: fresh.seed }).region;
        expect(second.seed).not.toBe(first.seed);
    });

    it('takes only a preview', () => {
        expect(() => Atlas.reroll(42)).toThrow(/takes a preview/);
        expect(() => Atlas.reroll({ seed: 1 })).toThrow(/takes a preview/);
    });
});

describe('settle writes the previewed layout as a Region', () => {
    it('the Region records its ingredients, seed, biomes, ground, terrain and rules; the guild stays put', () => {
        Cartography.grant([WOOD, THICKET], 1);
        const plan = Atlas.reroll(Atlas.preview([WOOD, THICKET], { seed: 11 }));
        const home = Atlas.activeRegionId();
        const live = canon(GameState.state.board);

        const result = Atlas.settle({ ingredients: [WOOD, THICKET], seed: plan.seed });
        expect(result.success).toBe(true);
        const region = Atlas.getRegion(result.region.id);
        expect(region).toBe(result.region);
        expect(region).toMatchObject({
            kind: Atlas.REGION_KIND.SETTLED,
            practicalName: 'Thicket Wood',
            ingredients: ['test_map_wood', 'test_mod_thicket'],
            seed: plan.seed,
            biome: { forest: 1 },
            ground: plan.summary.ground,
            terrain: plan.layout.terrain,
            rules: [FORESTRY_RULE]
        });
        expect(region.flavourName).toBeTruthy();
        expect(Atlas.activeRegionId()).toBe(home);
        expect(canon(GameState.state.board)).toBe(live);
        // The same layout as the preview the player saw.
        expect(result.preview.layout).toEqual(plan.layout);
    });

    it('its board holds every node where the layout put it: placed, marked a fixture, with its biome', () => {
        Cartography.grant([WOOD, HILLS, THICKET], 1);
        const plan = Atlas.preview([WOOD, HILLS, THICKET], { seed: 5 });
        const { region } = Atlas.settle({ ingredients: [WOOD, HILLS, THICKET], seed: 5 });
        const tokens = tokensOf(region.board);
        expect(tokens).toHaveLength(plan.layout.nodes.length);
        tokens.forEach((t, i) => {
            const node = plan.layout.nodes[i];
            expect(t).toEqual({
                id: `tok_${region.id}_${i}`, typeId: node.typeId, x: node.x, y: node.y, placedAt: i,
                usesRemaining: tokenStartingUses(node.typeId), cycleElapsedMs: 0,
                origin: BoardState.ORIGIN.PLACED, fixture: true, biome: node.biome
            });
        });
        expect(new Set(tokens.map(t => t.biome))).toEqual(new Set(['forest', 'mountain']));
        expect(region.board.nextTokenOrder).toBe(tokens.length);
        // The Hall belongs to the guild and lands on arrival.
        expect(tokens.some(t => MatCap.isGuildHall(t))).toBe(false);
        expect(Object.keys(region.board).sort()).toEqual(Object.keys(createEmptyBoard()).sort());
    });

    it('every field it writes is declared, and the save still validates', () => {
        Cartography.grant([WOOD], 1);
        Atlas.settle({ ingredients: [WOOD], seed: 1 });
        const declared = Object.keys(createRegionRecord('x'));
        for (const region of Object.values(GameState.serialize().state.atlas.regions)) {
            expect(Object.keys(region).filter(k => !declared.includes(k))).toEqual([]);
        }
        expect(validateSaveData(GameState.serialize()).errors).toEqual([]);
    });

    it('saves at once when a slot is being played', () => {
        Cartography.grant([WOOD], 1);
        const save = vi.spyOn(SaveManager, 'save').mockImplementation(() => true);
        SaveManager.currentSlot = 0;
        try {
            Atlas.settle({ ingredients: [WOOD], seed: 1 });
            expect(save).toHaveBeenCalled();
        } finally {
            save.mockRestore();
        }
    });
});

describe('settle consumes the ingredients; nothing else does', () => {
    it('settling takes one of each slotted map; previewing, rerolling and closing the table take nothing', () => {
        Cartography.grant([WOOD, THICKET], 2);
        let plan = Atlas.preview([WOOD, THICKET]);
        for (let i = 0; i < 3; i++) plan = Atlas.reroll(plan);
        // The table closed: nothing settled, nothing taken.
        expect([Atlas.heldCount(WOOD), Atlas.heldCount(THICKET)]).toEqual([2, 2]);

        expect(Atlas.settle({ ingredients: [WOOD, THICKET], seed: plan.seed }).success).toBe(true);
        expect([Atlas.heldCount(WOOD), Atlas.heldCount(THICKET)]).toEqual([1, 1]);
    });

    it('two slots of one map need two of it; a refusal takes nothing and writes nothing', () => {
        Cartography.grant([WOOD], 1);
        const before = regionCount();
        const result = Atlas.settle({ ingredients: [WOOD, WOOD], seed: 1 });
        expect(result).toMatchObject({ success: false, reason: TEXT.REFUSE_NOT_HELD });
        expect(result.missing).toEqual([{ id: WOOD.id, needed: 2, held: 1 }]);
        expect(Atlas.heldCount(WOOD)).toBe(1);
        expect(regionCount()).toBe(before);
    });

    it('a map the guild does not hold is refused', () => {
        expect(Atlas.settle({ ingredients: [HILLS], seed: 1 })).toMatchObject({ success: false, reason: TEXT.REFUSE_NOT_HELD });
    });

    it('a layout with a Token that found no room is refused, taking nothing: the player rerolls', () => {
        setMatTuning('tokenCap', 256);
        Cartography.grant([GIANT], 1);
        const before = regionCount();
        const result = Atlas.settle({ ingredients: [GIANT], seed: 1 });
        expect(result).toMatchObject({ success: false, reason: TEXT.REFUSE_NO_ROOM });
        expect(result.unplaced.length).toBeGreaterThan(0);
        expect(result.unplaced.every(u => u.typeId === COLOSSUS)).toBe(true);
        expect(Atlas.heldCount(GIANT)).toBe(1);
        expect(regionCount()).toBe(before);
    });

    it('no ingredients is refused; an ingredient that is not a map throws before anything is taken', () => {
        expect(Atlas.settle({ ingredients: [] })).toMatchObject({ success: false, reason: TEXT.REFUSE_NO_MAPS });
        Cartography.grant([WOOD], 1);
        expect(() => Atlas.settle({ ingredients: [WOOD, 'item_forest_map'] })).toThrow(/not a map recipe/);
        expect(Atlas.heldCount(WOOD)).toBe(1);
    });
});

describe('travelling to a settled Region', () => {
    it('the Hall lands in its clearing at the layout\'s centre; every node stands where the layout put it', () => {
        Cartography.grant([WOOD, HILLS, THICKET], 1);
        const plan = Atlas.preview([WOOD, HILLS, THICKET], { seed: 21 });
        const { region } = Atlas.settle({ ingredients: [WOOD, HILLS, THICKET], seed: 21 });
        expect(Atlas.travel(region.id).success).toBe(true);

        expect({ x: hall.x, y: hall.y }).toEqual({ x: plan.layout.hall.x, y: plan.layout.hall.y });
        const nodes = BoardState.tokens().filter(t => BoardState.isFixture(t));
        expect(nodes.map(t => [t.typeId, t.x, t.y])).toEqual(plan.layout.nodes.map(n => [n.typeId, n.x, n.y]));
        for (const t of nodes) {
            const reach = HALL_CLEARING + 64;
            expect((t.x - hall.x) ** 2 + (t.y - hall.y) ** 2).toBeGreaterThanOrEqual(reach * reach);
        }
    });

    it('map nodes are placed Tokens, which no spawn may push', () => {
        Cartography.grant([WOOD], 1);
        const { region } = Atlas.settle({ ingredients: [WOOD], seed: 3 });
        Atlas.travel(region.id);
        const fixtures = BoardState.tokens().filter(t => BoardState.isFixture(t)).map(t => t.id);
        expect(fixtures.length).toBeGreaterThan(0);
        expect(BoardState.placedTokenIds()).toEqual(expect.arrayContaining(fixtures));
    });

    it('travel puts the Hall where every layout leaves its clearing (the shipped mat\'s centre)', () => {
        expect(centre()).toEqual(hallSpot(shippedMat()));
        expect(HALL_TYPE_ID).toBe('token_guild_hall');
    });

    it('a settled Region survives a reload whole: fixtures, biomes, ground and terrain', async () => {
        Cartography.grant([WOOD, HILLS], 1);
        const { region } = Atlas.settle({ ingredients: [WOOD, HILLS], seed: 8 });
        const record = copy(region);
        const data = JSON.parse(GameState.serializeJson());
        const state = migrateState(data.state, data.version);
        expect(validateSaveData({ version: data.version, state }).errors).toEqual([]);
        await GameState.initFromSave(state);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
        expect(copy(Atlas.getRegion(region.id))).toEqual(record);

        Atlas.travel(region.id);
        expect(BoardState.tokens().filter(t => BoardState.isFixture(t)).map(t => t.biome).sort())
            .toEqual(tokensOf(record.board).map(t => t.biome).sort());
    });
});

describe('a map node keeps its mark', () => {
    it('through a transform, as it keeps its origin', () => {
        const old = BoardState.createTokenInstance(OAK, 5, null, BoardState.ORIGIN.PLACED, 'tok_test_fixture');
        old.fixture = true;
        old.biome = 'forest';
        BoardState.addToken(old, 300, 300);
        const next = EffectActions.transformInstance(old, ORE, { fixPlaced: true });
        expect(next).toMatchObject({ typeId: ORE, fixture: true, biome: 'forest', origin: BoardState.ORIGIN.PLACED });

        const plain = placeAt(OAK, 600, 300);
        const after = EffectActions.transformInstance(plain, ORE, { fixPlaced: true });
        expect(after.fixture).toBeUndefined();
        expect(after.biome).toBeUndefined();
    });
});

describe('a board built off the mat', () => {
    it('is exactly the board addToken builds on the mat, and the live board is not touched', () => {
        const spots = [[400, 300, OAK], [700, 900, ORE], [1300, 200, BERRY]];
        const make = () => spots.map(([x, y, typeId], i) => ({
            instance: BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.PLACED, `tok_off_${i}`),
            x, y
        }));
        const version = BoardState.layoutVersion();
        const live = canon(GameState.state.board);
        const detached = BoardState.detachedBoard(make());
        expect(canon(GameState.state.board)).toBe(live);
        expect(BoardState.layoutVersion()).toEqual(version);

        GameState.state.board = createEmptyBoard();
        for (const { instance, x, y } of make()) BoardState.addToken(instance, x, y);
        expect(canon(detached)).toBe(canon(GameState.state.board));
    });
});

describe('the dev console', () => {
    it('grants the placeholder maps, previews a layout in words and text, and settles from the stock', () => {
        expect(Atlas.devSettle(['forest', 'overgrown'], 4)).toMatchObject({ success: false, reason: TEXT.REFUSE_NOT_HELD });

        const lines = Atlas.devGrantMaps(2);
        expect(lines).toHaveLength(Object.keys(DEV_MAPS).length);
        expect(Atlas.held().every(h => h.count === 2)).toBe(true);

        const view = Atlas.devPreview(['mountain', 'goblinCamp'], 4);
        expect(view.seed).toBe(4);
        expect(view.summary.split('\n')[0]).toMatch(/^\d+ Tokens/);
        expect(view.picture).toContain('H');
        expect(view.picture.split('\n').length).toBeGreaterThan(30);
        expect(Atlas.reroll(view.preview).summary).toBe(view.preview.summary);

        const result = Atlas.devSettle(['mountain', 'goblinCamp'], view.seed);
        expect(result.success).toBe(true);
        expect(result.region.practicalName).toBe('Goblin Camp Mountain');
        expect(result.preview.layout).toEqual(view.preview.layout);
        expect(Atlas.heldCount(DEV_MAPS.mountain)).toBe(1);
    });

    it('names the dev maps there are when given one that is not', () => {
        expect(() => Atlas.devPreview(['plains'])).toThrow(/forest, mountain/);
    });

    it('the dev Overgrown carries a Region rule; the Forest and Mountain write today\'s Tokens', () => {
        expect(DEV_MAPS.overgrown.rules[0]).toMatchObject({ keyword: 'provides', payload: { type: 'YIELD', category: 'forestry' } });
        expect(Cartography.isRecipe(DEV_MAPS.forest)).toBe(true);
    });
});
