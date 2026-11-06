import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { validateSaveData } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as World from '../systems/world/World.js';
import { SETTLE_TEXT } from '../systems/world/Settling.js';
import { HALL_CELL, CELL_STATE, settledIds, cellStates, priceRows, cellOutputs } from '../systems/world/frontier.js';
import { cellsWithin, cellId } from '../systems/world/hex.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
const catchUp = vi.hoisted(() => ({ running: false }));
vi.mock('../systems/core/CatchUp.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isRunning: () => catchUp.running
}));

/**
 * ⭐ Settling the world map's places: the Hall's cell is settled from the start, the cells beside a
 * settled one are the frontier, and Settle pays a frontier cell's whole price at once, writes its
 * Region (carrying the cell's id) and takes the guild there. A refusal takes nothing.
 */

const SEED = 4242;

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: SEED });
}

/** A hero at every skill level the price of `cell` asks for. */
function heroFor(cell) {
    GameState.state.progress.rosterLimit = 4;
    const hero = HeroManager.addHero(generateHero());
    for (const { skill, level } of cell.requires.skills) {
        addXP(hero.id, skill, xpForLevel(level) - (hero.skills[skill]?.xp || 0));
    }
    return hero;
}

/** Everything `cell`'s price asks for, put in the Bank. */
function stock(cell, extra = 0) {
    for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty + extra);
}

const world = () => World.currentWorld();
const ringOne = () => world().cells.filter(c => c.ring === 1);
const bankOf = (ids) => Object.fromEntries(ids.map(id => [id, InventoryManager.getItemCount(id)]));

beforeEach(() => {
    catchUp.running = false;
    resetMatTuning();
    newGame();
});
afterEach(() => {
    resetMatTuning();
    vi.restoreAllMocks();
});

describe('which cells can be settled (pure)', () => {
    const grid = { cells: cellsWithin(3).map(c => ({ ...c, id: cellId(c.q, c.r) })) };

    it('the Hall\'s cell is always settled; ring 1 is the frontier; the rest lie beyond', () => {
        const settled = settledIds(grid, []);
        expect([...settled]).toEqual([HALL_CELL]);
        const states = cellStates(grid, settled);
        for (const c of grid.cells) {
            expect(states.get(c.id), c.id).toBe(c.ring === 0 ? CELL_STATE.SETTLED : c.ring === 1 ? CELL_STATE.FRONTIER : CELL_STATE.BEYOND);
        }
    });

    it('a Region carrying a cell settles it, and its outer neighbours join the frontier', () => {
        const settled = settledIds(grid, [{ cellId: '1,0' }, { cellId: 'not,a-cell' }, { cellId: null }]);
        expect([...settled].sort()).toEqual(['0,0', '1,0']);
        const states = cellStates(grid, settled);
        expect(['2,0', '2,-1', '1,1'].map(id => states.get(id))).toEqual([CELL_STATE.FRONTIER, CELL_STATE.FRONTIER, CELL_STATE.FRONTIER]);
        expect(states.get('-2,0')).toBe(CELL_STATE.BEYOND);
    });

    it('reads a price as have/need: each item against the Bank, each skill against the best hero', () => {
        const cell = { requires: { items: [{ itemId: 'a', qty: 20 }, { itemId: 'b', qty: 5 }], skills: [{ skill: 'mining', level: 5 }] } };
        const have = { a: 7, b: 9 };
        const rows = priceRows(cell, { itemCount: (id) => have[id] || 0, skillLevel: () => 5 });
        expect(rows).toEqual({
            items: [{ itemId: 'a', need: 20, have: 7, short: true }, { itemId: 'b', need: 5, have: 9, short: false }],
            skills: [{ skill: 'mining', need: 5, have: 5, short: false }],
            met: false
        });
        have.a = 20;
        expect(priceRows(cell, { itemCount: (id) => have[id] || 0, skillLevel: () => 5 }).met).toBe(true);
        expect(priceRows(cell, { itemCount: (id) => have[id] || 0, skillLevel: () => 4 }).met).toBe(false);
        expect(priceRows({ requires: null }, { itemCount: () => 0, skillLevel: () => 0 }).met).toBe(true);
    });

    it('a cell shows what its origins yield, its own line\'s first and the blends after, each once', () => {
        const cell = { origins: [{ id: 'blend_tree', role: 'blend' }, { id: 'vein', role: 'main' }, { id: 'key_vein', role: 'key' }] };
        const yields = { blend_tree: ['wood'], vein: ['ore', 'stone'], key_vein: ['ore', 'gem'] };
        expect(cellOutputs(cell, (id) => yields[id])).toEqual(['ore', 'stone', 'gem', 'wood']);
    });
});

describe('⭐ settling a cell', () => {
    it('⭐ pays the whole price at once, writes the Region on the cell and takes the guild there', () => {
        const cell = ringOne()[0];
        heroFor(cell);
        stock(cell, 3);
        const ids = cell.requires.items.map(i => i.itemId);
        const before = bankOf(ids);
        const home = Atlas.activeRegionId();
        expect(World.priceOf(cell).met).toBe(true);

        const result = World.settleCell(cell.id);
        expect(result.success, result.reason).toBe(true);
        for (const { itemId, qty } of cell.requires.items) expect(InventoryManager.getItemCount(itemId), itemId).toBe(before[itemId] - qty);
        expect(result.region.cellId).toBe(cell.id);
        expect(Atlas.activeRegionId()).toBe(result.region.id);
        expect(Atlas.activeRegionId()).not.toBe(home);
        expect(World.activeCellId()).toBe(cell.id);
        expect(World.regionIdOfCell(cell.id)).toBe(result.region.id);
        expect(World.regionIdOfCell(HALL_CELL)).toBe(home);
        expect(result.region.practicalName).toBe(World.cellName(cell));
        // Its board holds the cell's origins as the Region's own nodes.
        const typeIds = new Set(BoardState.tokens().filter(t => BoardState.isFixture(t)).map(t => t.typeId));
        for (const o of cell.origins) expect(typeIds.has(o.id), o.id).toBe(true);
        // The cell is settled, and its outer neighbours are the frontier now.
        const states = World.cellStatesNow();
        expect(states.get(cell.id)).toBe(CELL_STATE.SETTLED);
        expect(world().cells.filter(c => c.ring === 2 && states.get(c.id) === CELL_STATE.FRONTIER).length).toBeGreaterThan(0);
    });

    it('announces the Region written, the arrival there, the enemies holding it, and last the guild arrived, the ceremony cue', () => {
        const cell = ringOne()[1];
        heroFor(cell);
        stock(cell);
        const said = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, (d) => said.push(d));
        let result;
        try {
            result = World.settleCell(cell.id);
            expect(result.success).toBe(true);
        } finally {
            off();
        }
        expect(said.map(d => d.reason)).toEqual(['created', 'travelled', 'occupied', 'arrived']);
        expect(said[3]).toEqual({ reason: 'arrived', regionId: result.region.id, cellId: cell.id });
    });

    it('travel to a place settled before never says arrived', () => {
        const cell = ringOne()[1];
        heroFor(cell);
        stock(cell);
        const { region } = World.settleCell(cell.id);
        const home = Atlas.list().find(r => r.kind === Atlas.REGION_KIND.STARTER).id;
        const reasons = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, (d) => reasons.push(d.reason));
        try {
            expect(Atlas.travel(home).success).toBe(true);
            expect(Atlas.travel(region.id).success).toBe(true);
        } finally {
            off();
        }
        expect(reasons).toEqual(['travelled', 'travelled']);
    });

    it('draws no random number', () => {
        const cell = ringOne()[2];
        heroFor(cell);
        stock(cell);
        const spy = vi.spyOn(Math, 'random');
        expect(World.settleCell(cell.id).success).toBe(true);
        expect(spy).not.toHaveBeenCalled();
    });

    it('a price the guild cannot meet is refused, taking nothing and writing nothing', () => {
        const cell = ringOne()[0];
        stock(cell);
        const ids = cell.requires.items.map(i => i.itemId);
        const before = bankOf(ids);
        const regions = Object.keys(GameState.state.atlas.regions).length;

        // No hero has the skill.
        const short = World.settleCell(cell.id);
        expect(short).toMatchObject({ success: false, reason: SETTLE_TEXT.SHORT });
        expect(short.price.skills.some(s => s.short)).toBe(true);
        // A hero has it, but one item is a little short.
        heroFor(cell);
        InventoryManager.removeItem(ids[0], 1);
        expect(World.settleCell(cell.id)).toMatchObject({ success: false, reason: SETTLE_TEXT.SHORT });
        expect(bankOf(ids)).toEqual({ ...before, [ids[0]]: before[ids[0]] - 1 });
        expect(Object.keys(GameState.state.atlas.regions)).toHaveLength(regions);
        expect(World.activeCellId()).toBe(HALL_CELL);
    });

    it('only a frontier cell: never one beyond it, one settled, the Hall\'s, or one that is not there', () => {
        const beyond = world().cells.find(c => c.ring === 2);
        heroFor(beyond);
        stock(beyond);
        expect(World.settleCell(beyond.id)).toMatchObject({ success: false, reason: SETTLE_TEXT.BEYOND });
        expect(World.settleCell(HALL_CELL)).toMatchObject({ success: false, reason: SETTLE_TEXT.SETTLED });
        expect(World.settleCell('99,99')).toMatchObject({ success: false, reason: SETTLE_TEXT.NO_CELL });

        const cell = ringOne()[3];
        heroFor(cell);
        stock(cell, cell.requires.items.reduce((n, i) => n + i.qty, 0));
        expect(World.settleCell(cell.id).success).toBe(true);
        expect(World.settleCell(cell.id)).toMatchObject({ success: false, reason: SETTLE_TEXT.SETTLED });
    });

    it('waits while the time away plays, taking nothing', () => {
        const cell = ringOne()[0];
        heroFor(cell);
        stock(cell);
        const before = bankOf(cell.requires.items.map(i => i.itemId));
        catchUp.running = true;
        expect(World.settleCell(cell.id)).toMatchObject({ success: false, reason: SETTLE_TEXT.CATCHING_UP });
        expect(bankOf(cell.requires.items.map(i => i.itemId))).toEqual(before);
    });

    it('a game with no world (a save from before it) settles nothing and reads no cell', () => {
        GameState.state.world = null;
        expect(World.settleCell('1,0')).toMatchObject({ success: false, reason: SETTLE_TEXT.NO_WORLD });
        expect(World.cellStatesNow().size).toBe(0);
        expect(World.activeCellId()).toBeNull();
    });
});

describe('a settled place afterwards', () => {
    it('travel between settled places is the Atlas\'s, free and instant, both ways', () => {
        const cell = ringOne()[0];
        heroFor(cell);
        stock(cell);
        const home = Atlas.activeRegionId();
        const { region } = World.settleCell(cell.id);
        const bank = JSON.stringify(GameState.state.inventory.items);
        expect(Atlas.travel(home).success).toBe(true);
        expect(World.activeCellId()).toBe(HALL_CELL);
        expect(Atlas.travel(region.id).success).toBe(true);
        expect(World.activeCellId()).toBe(cell.id);
        expect(JSON.stringify(GameState.state.inventory.items)).toBe(bank);
    });

    it('stays settled when archived; abandoned, the place returns to the frontier', () => {
        const cell = ringOne()[0];
        heroFor(cell);
        stock(cell);
        const home = Atlas.activeRegionId();
        const { region } = World.settleCell(cell.id);
        Atlas.travel(home);
        Atlas.archive(region.id);
        expect(World.cellStatesNow().get(cell.id)).toBe(CELL_STATE.SETTLED);
        Atlas.abandon(region.id);
        expect(World.cellStatesNow().get(cell.id)).toBe(CELL_STATE.FRONTIER);
    });

    it('survives a save and a load: the Region keeps its cell, and the save validates', async () => {
        const cell = ringOne()[0];
        heroFor(cell);
        stock(cell);
        const { region } = World.settleCell(cell.id);
        const data = JSON.parse(GameState.serializeJson());
        const state = migrateState(data.state, data.version);
        expect(validateSaveData({ version: data.version, state }).errors).toEqual([]);
        await GameState.initFromSave(state);
        expect(Atlas.getRegion(region.id).cellId).toBe(cell.id);
        expect(World.activeCellId()).toBe(cell.id);
        expect(World.cellStatesNow().get(cell.id)).toBe(CELL_STATE.SETTLED);
    });
});
