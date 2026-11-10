import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatCap from '../systems/board/MatCap.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as World from '../systems/world/World.js';
import { HALL_CELL } from '../systems/world/frontier.js';
import { recipesOfCell } from '../systems/world/cellRegion.js';
import { cellGroundCounts, groundShares } from '../systems/world/placeGround.js';
import { budget } from '../systems/atlas/Budget.js';
import { layout, groundCounts } from '../systems/atlas/Layout.js';
import { layoutOptions, shippedMat } from '../systems/atlas/layoutInputs.js';
import { regionGroundCounts } from '../systems/atlas/regionGround.js';
import { decodeTerrain, TERRAIN } from '../systems/atlas/TerrainMap.js';
import { worldTables } from '../config/registries/worldTablesRegistry.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ What the World Map drawer reads of a place (brief 570 D4): its ground as three dials, Water,
 * Grass and Stone, before and after it is settled, and a settled place's Tokens over the cap.
 */

const SEED = 4242;

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: SEED });
}

const world = () => World.currentWorld();
const skillOf = (typeId) => getTokenType(typeId)?.config?.skill || null;
const hallOrigins = () => (world().cells.find(c => c.ring === 0)?.origins || []).map(o => o.id);

/** A cell's one recipe, budgeted as settling budgets it. */
function summaryOf(cell) {
    const { recipes } = recipesOfCell(cell, { tables: worldTables(), skillOf, hallOrigins: hallOrigins() });
    return budget(recipes, { cap: MatCap.matCap() });
}

/** Counts of a stored or laid-out terrain map, as the dials read them. */
function countsOfMap(terrain) {
    const map = decodeTerrain(terrain);
    const water = [...map.cells].filter(k => map.legend[k] === TERRAIN.WATER).length;
    const stone = [...map.cells].filter(k => map.legend[k] === TERRAIN.STONE).length;
    return { water, stone, land: map.cells.length - water - stone, cells: map.cells.length };
}

beforeEach(() => newGame());
afterEach(() => resetMatTuning());

describe('the ground dials', () => {
    it('⭐ a ground-only reading is the very ground a layout with that seed writes: sea, inland water and Stone', () => {
        // One cell of each kit: the Highland's Stone, the Riverside's sea, the others' inland water.
        const byKit = new Map();
        for (const cell of world().cells) if (cell.ring > 0 && !byKit.has(cell.kit)) byKit.set(cell.kit, cell);
        expect(byKit.size).toBeGreaterThanOrEqual(5);
        let wet = 0;
        let rock = 0;
        for (const cell of byKit.values()) {
            const summary = summaryOf(cell);
            for (const seed of [cell.seed >>> 0, 12345]) {
                const read = groundCounts(summary, { seed, mat: shippedMat() });
                const laid = layout(summary, layoutOptions(summary, seed));
                expect(read, `${cell.kit} ${seed}`).toEqual(countsOfMap(laid.terrain));
                wet += read.water;
                rock += read.stone;
            }
        }
        // The check means something only if some of it is water and some Stone.
        expect(wet).toBeGreaterThan(0);
        expect(rock).toBeGreaterThan(0);
    });

    it('⭐ before a place is settled, its dials read what settling it then writes', () => {
        for (const cell of world().cells.filter(c => c.ring === 1)) {
            const before = World.placeGround(cell.id);
            const written = World.writePlace(cell, { cellId: cell.id });
            expect(written.success).toBe(true);
            expect(Atlas.getRegion(written.region.id).cellId).toBe(cell.id);
            const after = World.placeGround(cell.id);
            expect(after, cell.id).toEqual(before);
            expect(after).toEqual(groundShares(regionGroundCounts(written.region)));
            expect(after.water + after.grass + after.stone).toBe(100);
        }
    });

    it('a settled place reads its stored ground; the Hall\'s cell is the Starter Camp\'s', () => {
        const camp = Atlas.getRegion(World.regionIdOfCell(HALL_CELL));
        expect(World.placeGround(HALL_CELL)).toEqual(groundShares(regionGroundCounts(camp)));
        // A Region with no stored map is meadow: all grass.
        expect(groundShares(regionGroundCounts({ terrain: null }))).toEqual({ water: 0, grass: 100, stone: 0 });
        expect(World.placeGround('no,such')).toBeNull();
    });

    it('shares are whole percent adding up to 100, the dry land that is not Stone counting as grass', () => {
        expect(groundShares({ water: 1, stone: 1, land: 1, cells: 3 })).toEqual({ grass: 34, stone: 33, water: 33 });
        expect(groundShares({ water: 0, stone: 0, land: 0, cells: 0 })).toEqual({ water: 0, grass: 100, stone: 0 });
        for (const cell of world().cells.filter(c => c.ring > 0).slice(0, 20)) {
            const counts = cellGroundCounts(cell);
            const s = groundShares(counts);
            expect(s.water + s.grass + s.stone).toBe(100);
            expect(counts.water + counts.stone + counts.land).toBe(counts.cells);
        }
    });

    it('a cell is read once: the second reading is the same object', () => {
        const cell = world().cells.find(c => c.ring === 2);
        expect(cellGroundCounts(cell)).toBe(cellGroundCounts(cell));
    });
});

describe('a settled place\'s Tokens over the cap', () => {
    it('⭐ the place the guild is on counts as the cap does; another counts its frozen board; the cap is the guild\'s', () => {
        const home = Atlas.activeRegionId();
        expect(Atlas.capStatusOf(home)).toEqual({ count: MatCap.tokenCount(), cap: MatCap.matCap() });

        const cell = world().cells.find(c => c.ring === 1);
        const { region } = World.writePlace(cell, { cellId: cell.id });
        const ownCount = (board) => Object.values(board.tokens).filter(t => MatCap.countsTowardCap(t)).length;
        expect(Atlas.capStatusOf(region.id)).toEqual({ count: ownCount(region.board), cap: MatCap.matCap() });
        expect(Atlas.capStatusOf(region.id).count).toBeGreaterThan(0);

        const homeCount = MatCap.tokenCount();
        expect(Atlas.travel(region.id).success).toBe(true);
        // The Hall and the quests travel with the guild and never count: home keeps its count.
        expect(Atlas.capStatusOf(home).count).toBe(homeCount);
        expect(Atlas.capStatusOf(region.id).count).toBe(MatCap.tokenCount());
        expect(BoardState.tokens().length).toBeGreaterThan(0);

        // A Mat Tuner cap override is this device's cap everywhere.
        setMatTuning('tokenCap', 40);
        expect(Atlas.capStatusOf(home).cap).toBe(40);
        expect(Atlas.capStatusOf(region.id).cap).toBe(40);
        expect(Atlas.capStatusOf('region_none')).toBeNull();
    });
});
