import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Placement from '../systems/board/Placement.js';
import * as GroundRules from '../systems/board/GroundRules.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatResize from '../systems/board/MatResize.js';
import * as Shop from '../systems/board/Shop.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, standsOnOf } from '../config/registries/tokenRegistry.js';
import { matW, matH, artRadiusOf } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { mulberry32 } from '../systems/atlas/seededRandom.js';
import {
    TERRAIN, TERRAIN_CELL, STANDS_ON, STANDS_ON_CHOICES, terrainGrid, encodeTerrain, terrainAt,
    allowsTerrain, isStandsOnWord, needsText
} from '../systems/atlas/TerrainMap.js';
import { createRegionRecord } from '../state/StateSchema.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⚠️ `GroundRules.allowsAt` is wrapped so the cost gate below can count it: on a meadow a plain
 * Token's search must never ask the ground about a single candidate.
 */
vi.mock('../systems/board/GroundRules.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, allowsAt: vi.fn(actual.allowsAt) };
});

/**
 * ⭐ **Terrain in placement** (terrain roadmap T3, decision 14): the cell under a Token's centre
 * must be one its "Stands on" (`standsOn`) allows; a Token with no list may stand anywhere dry.
 * Every placement path goes through the rule: drops, nudges, pushes, spawns, Shop arrivals, a
 * recipe's Token, travel, the mat shrinking.
 *
 * The test Region's ground, on the shipped 1760 × 1126 mat (55 × 36 cells of 32 u):
 *
 *     cols  0–9   water (the sea along the left edge)
 *     cols 10–24  sand (col 10 is the shore)
 *     cols 25–39  grass, with a one-cell pond at col 32, row 10
 *     cols 40–54  rock
 */

const base = { tokenType: 'resource', size: 1, uses: 100, requiresHero: false, config: { cycleTimeMs: 5000, inputs: [], outputs: [] } };
registerTokenTypes({
    gp_plain: { ...base, id: 'gp_plain', name: 'GP Plain' },
    gp_water: { ...base, id: 'gp_water', name: 'GP Boat', standsOn: ['water'] },
    gp_shore: { ...base, id: 'gp_shore', name: 'GP Dock', standsOn: ['shore'] },
    gp_rock: { ...base, id: 'gp_rock', name: 'GP Mineshaft', standsOn: ['rock'] },
    gp_beach: { ...base, id: 'gp_beach', name: 'GP Beach Hut', standsOn: ['sand', 'shore'] },
    gp_typo: { ...base, id: 'gp_typo', name: 'GP Typo', standsOn: ['lava'] },
    gp_shop_boat: { ...base, id: 'gp_shop_boat', name: 'GP Shop Boat', standsOn: ['water'], shop: { price: [], section: 'general' } },
    gp_station: { ...base, id: 'gp_station', name: 'GP Station' }
});

const GRID = terrainGrid({ w: 1760, h: 1126 });
const POND = { col: 32, row: 10 };

function terrainOfCell(col, row) {
    if (col === POND.col && row === POND.row) return TERRAIN.WATER;
    if (col <= 9) return TERRAIN.WATER;
    if (col <= 24) return TERRAIN.SAND;
    if (col <= 39) return TERRAIN.GRASS;
    return TERRAIN.ROCK;
}

const CELLS = Array.from({ length: GRID.cols * GRID.rows }, (_, i) => terrainOfCell(i % GRID.cols, Math.floor(i / GRID.cols)));
const MAP = encodeTerrain(GRID, CELLS);

/** Whether a cell is dry land touching water, a diagonal counting: restated, not trusted. */
function isShoreCell(col, row) {
    if (terrainOfCell(col, row) === TERRAIN.WATER) return false;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;
            const r = row + dr;
            if (c < 0 || r < 0 || c >= GRID.cols || r >= GRID.rows) continue;
            if (terrainOfCell(c, r) === TERRAIN.WATER) return true;
        }
    }
    return false;
}

const WATER_PT = { x: 160, y: 563 };
const SHORE_PT = { x: 336, y: 563 };
const SAND_PT = { x: 560, y: 563 };
const GRASS_PT = { x: 960, y: 900 };
const ROCK_PT = { x: 1500, y: 563 };
const POND_PT = { x: 1040, y: 336 };

const underfoot = (p) => terrainAt(MAP, p.x, p.y);
const fresh = (typeId) => BoardState.createTokenInstance(typeId, 100);

/** Make `map` the ground of the Region the guild is in (null: the meadow). */
function standOn(map) {
    const region = createRegionRecord('region_7');
    region.kind = 'settled';
    region.terrain = map;
    GameState.state.atlas = { activeRegionId: region.id, nextRegionNumber: 8, regions: { [region.id]: region }, seed: null };
    return region;
}

/** Every cell centre a 1×1 Token fits at, with its column and row. */
function* fittingCentres() {
    const r = artRadiusOf('gp_plain');
    for (let row = 0; row < GRID.rows; row++) {
        for (let col = 0; col < GRID.cols; col++) {
            const x = (col + 0.5) * TERRAIN_CELL;
            const y = (row + 0.5) * TERRAIN_CELL;
            if (x < r || y < r || x > matW() - r || y > matH() - r) continue;
            yield { col, row, x, y };
        }
    }
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 64;
    SpriteLayer.init();
    TileModifiers.init();
    clearMat();
    standOn(MAP);
    GroundRules.allowsAt.mockClear();
});

afterEach(() => resetMatTuning());

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

describe('the "Stands on" words (TD-1 A)', () => {
    it('are Water, Shore, Grass, Rock and Sand, in the CMS\'s order', () => {
        expect(STANDS_ON_CHOICES.map(c => c.id)).toEqual(['water', 'shore', 'grass', 'rock', 'sand']);
        expect(STANDS_ON_CHOICES.map(c => c.label)).toEqual(['Water', 'Shore', 'Grass', 'Rock', 'Sand']);
        expect(Object.values(STANDS_ON).sort()).toEqual(['grass', 'rock', 'sand', 'shore', 'water']);
        expect(isStandsOnWord('shore')).toBe(true);
        expect(isStandsOnWord('lava')).toBe(false);
    });

    it('a cell passes if it is any one the list names; shore is dry land touching water', () => {
        expect(allowsTerrain(['water'], TERRAIN.WATER, false)).toBe(true);
        expect(allowsTerrain(['water'], TERRAIN.SAND, true)).toBe(false);
        expect(allowsTerrain(['shore'], TERRAIN.SAND, true)).toBe(true);
        expect(allowsTerrain(['shore'], TERRAIN.GRASS, true)).toBe(true);
        expect(allowsTerrain(['shore'], TERRAIN.SAND, false)).toBe(false);
        expect(allowsTerrain(['shore'], TERRAIN.WATER, true)).toBe(false);
        expect(allowsTerrain(['rock', 'sand'], TERRAIN.SAND, false)).toBe(true);
        expect(allowsTerrain(['rock', 'sand'], TERRAIN.GRASS, false)).toBe(false);
    });

    it('no list means anywhere dry, any dry ground content may name included', () => {
        for (const terrain of [TERRAIN.GRASS, TERRAIN.ROCK, TERRAIN.SAND, 'snow']) {
            expect(allowsTerrain([], terrain, false)).toBe(true);
        }
        expect(allowsTerrain([], TERRAIN.WATER, false)).toBe(false);
    });

    it('a refusal says what the Token needs, in one sentence', () => {
        expect(needsText([])).toBe('Needs dry land.');
        expect(needsText(['water'])).toBe('Needs water.');
        expect(needsText(['shore'])).toBe('Needs the shore.');
        expect(needsText(['rock'])).toBe('Needs rock.');
        expect(needsText(['sand', 'shore'])).toBe('Needs the shore or sand.');
        expect(needsText(['grass', 'rock', 'sand'])).toBe('Needs grass, rock or sand.');
    });

    it('a Token type\'s list keeps only the words the game knows', () => {
        expect(standsOnOf('gp_plain')).toEqual([]);
        expect(standsOnOf('gp_water')).toEqual(['water']);
        expect(standsOnOf('gp_beach')).toEqual(['shore', 'sand']);
        // An unknown word is ignored (the boot audit names it), so a typo never strands a Token.
        expect(standsOnOf('gp_typo')).toEqual([]);
        expect(standsOnOf('no_such_type')).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Where each kind of Token may stand
// ---------------------------------------------------------------------------

describe('⭐ the fourth rule: the cell under the Token\'s centre', () => {
    it('a water-only Token is refused on land, and lands on water', () => {
        for (const p of [SHORE_PT, SAND_PT, GRASS_PT, ROCK_PT]) expect(MatPlacement.isLegal('gp_water', p), JSON.stringify(p)).toBe(false);
        expect(MatPlacement.isLegal('gp_water', WATER_PT)).toBe(true);
        expect(MatPlacement.isLegal('gp_water', POND_PT)).toBe(true);

        const res = Placement.placeTokenAt(fresh('gp_water'), WATER_PT);
        expect(res).toMatchObject({ success: true, x: WATER_PT.x, y: WATER_PT.y, nudged: false });
    });

    it('a shore Token lands only on dry cells touching water, a diagonal counting', () => {
        let shore = 0;
        for (const { col, row, x, y } of fittingCentres()) {
            const want = isShoreCell(col, row);
            if (want) shore++;
            expect(MatPlacement.isLegal('gp_shore', { x, y }), `cell ${col},${row}`).toBe(want);
        }
        // The sea's edge (the 31 rows a Token fits in), and the eight cells round the pond.
        expect(shore).toBe(31 + 8);
        expect(MatPlacement.isLegal('gp_shore', { x: (POND.col - 0.5) * TERRAIN_CELL, y: (POND.row - 0.5) * TERRAIN_CELL })).toBe(true);
    });

    it('a Token with no list is refused on water and allowed everywhere dry', () => {
        for (const { col, row, x, y } of fittingCentres()) {
            expect(MatPlacement.isLegal('gp_plain', { x, y }), `cell ${col},${row}`).toBe(terrainOfCell(col, row) !== TERRAIN.WATER);
        }
    });

    it('a list may name several grounds; an unknown word is ignored', () => {
        for (const { col, row, x, y } of fittingCentres()) {
            const t = terrainOfCell(col, row);
            expect(MatPlacement.isLegal('gp_rock', { x, y })).toBe(t === TERRAIN.ROCK);
            expect(MatPlacement.isLegal('gp_beach', { x, y })).toBe(t === TERRAIN.SAND || isShoreCell(col, row));
            expect(MatPlacement.isLegal('gp_typo', { x, y })).toBe(t !== TERRAIN.WATER);
        }
    });

    it('the rest of the rules still hold on allowed ground', () => {
        placeAt('gp_water', WATER_PT.x, WATER_PT.y);
        expect(MatPlacement.isLegal('gp_water', { x: WATER_PT.x + 30, y: WATER_PT.y })).toBe(false);
        expect(MatPlacement.isLegal('gp_water', { x: 40, y: WATER_PT.y })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Drops: nudge, or fly back saying why
// ---------------------------------------------------------------------------

describe('⭐ a drop on a forbidden cell', () => {
    it('nudges to the nearest allowed spot within reach', () => {
        const aim = { x: 360, y: 563 };
        const res = Placement.placeTokenAt(fresh('gp_water'), aim);

        expect(res.success).toBe(true);
        expect(res.nudged).toBe(true);
        expect(underfoot(res)).toBe(TERRAIN.WATER);
        // The nearest water is just past x = 320, 40 u away; the rings step 4 u.
        expect(Math.hypot(res.x - aim.x, res.y - aim.y)).toBeLessThanOrEqual(44 + 1e-6);
    });

    it('a plain Token dropped just off the shore is nudged onto dry land', () => {
        const res = Placement.placeTokenAt(fresh('gp_plain'), { x: 300, y: 563 });
        expect(res).toMatchObject({ success: true, nudged: true });
        expect(underfoot(res)).not.toBe(TERRAIN.WATER);
    });

    it('flies back saying what it needs when nothing in reach will do', () => {
        const alerts = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (e) => alerts.push(e));
        const cases = [
            ['gp_water', GRASS_PT, 'Needs water.'],
            ['gp_plain', { x: 100, y: 563 }, 'Needs dry land.'],
            ['gp_rock', SAND_PT, 'Needs rock.'],
            ['gp_shore', ROCK_PT, 'Needs the shore.']
        ];
        for (const [typeId, aim, why] of cases) {
            const homeless = fresh(typeId);
            const res = Placement.placeTokenAt(homeless, aim);
            expect(res, typeId).toMatchObject({ success: false, full: true, reason: why });
            expect(BoardState.getTokenById(homeless.id)).toBeNull();
        }
        off?.();
        // The refused-drop mark carries the same words.
        expect(alerts.map(a => a.rulesText)).toEqual(cases.map(c => c[2]));
    });

    it('crowding on allowed ground still says there is no room', () => {
        // Water Tokens packed along the sea at the minimum gap: the only water in reach is taken.
        for (let y = 64; y <= 1062; y += 61.2) {
            for (let x = 64; x < 320; x += 61.2) placeAt('gp_water', x, y);
        }
        const res = Placement.placeTokenAt(fresh('gp_water'), { x: 64 + 61.2, y: 64 + 5 * 61.2 + 30 });
        expect(res.success).toBe(false);
        expect(res.reason).toBe(MatPlacement.NO_ROOM);
    });

    it('a moved Token obeys the rule from its next move; until then it stays where it stands', () => {
        // A plain Token stood on the water before the rule (an older layout, a load): left alone.
        const wet = placeAt('gp_plain', 100, 300);
        MatResize.fitToMat();
        expect(BoardState.getTokenById(wet.id)).toMatchObject({ x: 100, y: 300 });

        // Moved within the sea, it is refused the water.
        const res = Placement.moveTokenTo(wet.id, { x: 100, y: 800 });
        expect(res).toMatchObject({ success: false, reason: 'Needs dry land.' });
        expect(BoardState.getTokenById(wet.id)).toMatchObject({ x: 100, y: 300 });
    });
});

// ---------------------------------------------------------------------------
// Pushes
// ---------------------------------------------------------------------------

describe('⭐ a push never shoves a Token onto a cell it may not stand on', () => {
    it('a plain Token at the water\'s edge is not pushed into the sea', () => {
        const edge = placeAt('gp_plain', 350, 563);
        const where = MatPlacement.forceSpot('gp_plain', { x: 380, y: 563 });

        expect(where).not.toBeNull();
        expect(where.pushed.find(p => p.id === edge.id)).toBeUndefined();
        expect(underfoot(where)).not.toBe(TERRAIN.WATER);
        expect(Math.hypot(where.x - edge.x, where.y - edge.y)).toBeGreaterThanOrEqual(MatPlacement.minGap('gp_plain', 'gp_plain') - 1e-6);
        for (const p of where.pushed) expect(underfoot(p)).not.toBe(TERRAIN.WATER);
    });

    it('on the meadow the very same push goes ahead (the ground is what refused it)', () => {
        standOn(null);
        const edge = placeAt('gp_plain', 350, 563);
        const where = MatPlacement.forceSpot('gp_plain', { x: 380, y: 563 });
        expect(where).toMatchObject({ x: 380, y: 563 });
        expect(where.pushed).toEqual([{ id: edge.id, x: expect.any(Number), y: 563 }]);
        expect(where.pushed[0].x).toBeLessThan(320);
    });

    it('a water Token is not pushed up the beach', () => {
        const boat = placeAt('gp_water', 290, 563);
        const where = MatPlacement.forceSpot('gp_water', { x: 260, y: 563 });

        expect(where).not.toBeNull();
        expect(where.pushed.find(p => p.id === boat.id)).toBeUndefined();
        expect(underfoot(where)).toBe(TERRAIN.WATER);
    });

    it('an arrival aimed at a cell it may not stand on lands on the nearest one it may', () => {
        const where = MatPlacement.forceSpot('gp_water', { x: 400, y: 563 });
        expect(where.pushed).toEqual([]);
        expect(underfoot(where)).toBe(TERRAIN.WATER);
        expect(where.x).toBeGreaterThan(250);
    });

    it('a push that keeps everyone on their ground still pushes', () => {
        const dry = placeAt('gp_plain', 900, 700);
        const where = MatPlacement.forceSpot('gp_plain', { x: 920, y: 700 });
        expect(where).toMatchObject({ x: 920, y: 700 });
        expect(where.pushed.map(p => p.id)).toEqual([dry.id]);
    });
});

// ---------------------------------------------------------------------------
// Arrivals and spawns
// ---------------------------------------------------------------------------

describe('⭐ arrivals and spawns land on allowed cells', () => {
    it('a Shop purchase that needs water lands on water, wherever the Hall is', () => {
        const res = Shop.buy('gp_shop_boat');
        expect(res.success).toBe(true);
        const boat = BoardState.getTokenById(res.instance.id);
        expect(underfoot(boat)).toBe(TERRAIN.WATER);
    });

    it('a Token a recipe makes lands on ground it may stand on', () => {
        const station = placeAt('gp_station', 560, 563);
        expect(Placement.hasRoomForProduct(station.id, 'gp_water')).toBe(true);
        const res = Placement.placeProduct(station.id, 'gp_water');
        expect(res.success).toBe(true);
        expect(underfoot(BoardState.getTokenById(res.instance.id))).toBe(TERRAIN.WATER);
    });

    it('an arrival with no cell at all to stand on here says what it needs', () => {
        standOn(null);
        const res = Placement.placeArrivalNear(fresh('gp_water'), { x: 880, y: 563 });
        expect(res).toMatchObject({ success: false, full: true, reason: 'Needs water.' });
        const station = placeAt('gp_station', 560, 563);
        expect(Placement.hasRoomForProduct(station.id, 'gp_water')).toBe(false);
    });

    it('spawns: nearest free and random free never land a Token on ground it may not stand on', () => {
        const random = mulberry32(42);
        const bearer = placeAt('gp_plain', 420, 563);
        const near = EffectActions.spawn({ payload: { typeId: 'gp_water', placement: PLACEMENT.NEAREST_FREE } }, { self: bearer.id }, random);
        expect(near).not.toBeNull();
        expect(underfoot(near)).toBe(TERRAIN.WATER);

        let landed = 0;
        for (let i = 0; i < 30; i++) {
            const out = EffectActions.spawn({ payload: { typeId: 'gp_plain', placement: PLACEMENT.RANDOM_FREE } }, { self: bearer.id }, random);
            if (!out) continue;
            landed++;
            expect(underfoot(out)).not.toBe(TERRAIN.WATER);
        }
        expect(landed).toBeGreaterThan(20);
        for (let i = 0; i < 10; i++) {
            const out = EffectActions.spawn({ payload: { typeId: 'gp_water', placement: PLACEMENT.RANDOM_FREE } }, { self: bearer.id }, random);
            if (out) expect(underfoot(out)).toBe(TERRAIN.WATER);
        }
    });
});

// ---------------------------------------------------------------------------
// The cached ground, travel and load
// ---------------------------------------------------------------------------

describe('⭐ the ground is the Region the guild is in', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        clearMat();
    });

    it('travel resets the cached ground, both ways', () => {
        const camp = Atlas.createStarterRegion();
        // The Starter Camp is meadow: no water anywhere, so a boat has nowhere to go.
        expect(MatPlacement.isLegal('gp_water', WATER_PT)).toBe(false);
        expect(MatPlacement.findSpot('gp_water', WATER_PT)).toBeNull();
        expect(MatPlacement.isLegal('gp_plain', WATER_PT)).toBe(true);

        const { region } = Atlas.createRegion({ terrain: MAP });
        expect(Atlas.travel(region.id).success).toBe(true);
        expect(MatPlacement.isLegal('gp_water', WATER_PT)).toBe(true);
        expect(MatPlacement.findSpot('gp_water', WATER_PT)).toMatchObject({ ...WATER_PT, nudge: 0 });
        expect(MatPlacement.isLegal('gp_plain', WATER_PT)).toBe(false);

        expect(Atlas.travel(camp.id).success).toBe(true);
        expect(MatPlacement.isLegal('gp_water', WATER_PT)).toBe(false);
        expect(MatPlacement.isLegal('gp_plain', WATER_PT)).toBe(true);
    });

    it('a load brings a fresh map, read afresh (no event needed)', () => {
        const region = standOn(MAP);
        expect(MatPlacement.isLegal('gp_water', WATER_PT)).toBe(true);
        // A load rebuilds every object from the save: an equal map is a new object.
        region.terrain = JSON.parse(JSON.stringify(MAP));
        expect(MatPlacement.isLegal('gp_water', WATER_PT)).toBe(true);
        region.terrain = encodeTerrain(GRID, CELLS.map(() => TERRAIN.GRASS));
        expect(MatPlacement.isLegal('gp_water', WATER_PT)).toBe(false);
        expect(MatPlacement.isLegal('gp_plain', WATER_PT)).toBe(true);
    });

    it('a remembered failure is forgotten when the ground changes, even with the board untouched', () => {
        const region = standOn(null);
        expect(MatPlacement.findSpot('gp_water', WATER_PT)).toBeNull();
        region.terrain = MAP;
        expect(MatPlacement.findSpot('gp_water', WATER_PT)).toMatchObject({ ...WATER_PT, nudge: 0 });
    });

    it('the Hall and the quests land on dry ground in a Region they have never been to', () => {
        Atlas.createStarterRegion();
        placeAt('token_guild_hall', 880, 563);
        // A sea over the middle of the mat, where the Hall would land.
        const flooded = encodeTerrain(GRID, CELLS.map((t, i) => ((i % GRID.cols) >= 20 && (i % GRID.cols) <= 34 ? TERRAIN.WATER : t)));
        const { region } = Atlas.createRegion({ terrain: flooded });
        Atlas.travel(region.id);
        const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall');
        expect(terrainAt(flooded, hall.x, hall.y)).not.toBe(TERRAIN.WATER);
    });
});

// ---------------------------------------------------------------------------
// The cost
// ---------------------------------------------------------------------------

describe('⚠️ the cost of the ground', () => {
    it('⭐ on a meadow, a plain Token\'s crowded drop never asks the ground about a candidate', () => {
        standOn(null);
        for (let i = 0; i < 60; i++) placeAt('gp_plain', 500 + (i % 10) * 70, 400 + Math.floor(i / 10) * 70);
        GroundRules.allowsAt.mockClear();

        const res = Placement.placeTokenAt(fresh('gp_plain'), { x: 500 + 9 * 70, y: 400 + 5 * 70 });

        expect(res).toMatchObject({ success: true, nudged: true });
        expect(GroundRules.allowsAt).not.toHaveBeenCalled();
        expect(GroundRules.rulesFor('gp_plain')).toBeNull();
    });

    it('nor on a Region whose map has no water', () => {
        standOn(encodeTerrain(GRID, CELLS.map(t => (t === TERRAIN.WATER ? TERRAIN.SAND : t))));
        expect(GroundRules.rulesFor('gp_plain')).toBeNull();
        Placement.placeTokenAt(fresh('gp_plain'), GRASS_PT);
        expect(GroundRules.allowsAt).not.toHaveBeenCalled();
        // A Token with a list is still judged there.
        expect(GroundRules.rulesFor('gp_rock')).not.toBeNull();
    });

    it('but it does once the Region has water, or the Token has a list', () => {
        expect(GroundRules.rulesFor('gp_plain')).not.toBeNull();
        Placement.placeTokenAt(fresh('gp_plain'), GRASS_PT);
        expect(GroundRules.allowsAt).toHaveBeenCalled();
        standOn(null);
        expect(GroundRules.rulesFor('gp_water')).not.toBeNull();
    });

    it('a Token with no cell at all to stand on here gives up without searching the mat', () => {
        // A station whose recipe makes a boat, in a Region with no water, asks every tick.
        standOn(null);
        expect(MatPlacement.findSpotAnywhere('gp_water', { x: 880, y: 563 })).toBeNull();
        expect(MatPlacement.findSpot('gp_water', { x: 700, y: 400 })).toBeNull();
        expect(GroundRules.allowsAt).not.toHaveBeenCalled();
    });

    it('the ground is decoded once per map, not once per search', () => {
        const first = GroundRules.groundHere();
        for (let i = 0; i < 5; i++) MatPlacement.findSpot('gp_water', SAND_PT);
        expect(GroundRules.groundHere()).toBe(first);
        expect(GroundRules.rulesFor('gp_water')).toBe(GroundRules.rulesFor('gp_water'));
    });
});
