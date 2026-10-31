import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { validateSaveData, INITIAL_STATE } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import * as World from '../systems/world/World.js';
import { worldFindings, WORLD_CHECK } from '../systems/world/checks.js';
import { generateWorld, PROBLEM } from '../systems/world/generate.js';
import { materialsFromTokens, hallOriginsOf, materialsOfToken } from '../systems/world/materials.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import {
    worldTables, isPlaceholderTables, setWorldTablesForTests, resetWorldTablesForTests
} from '../config/registries/worldTablesRegistry.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { FIXTURE_WORLD_RAW } from './fixtures/worldTables.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ A new game generates its world once and keeps it whole in the save (brief 330 W1): the same
 * run seed always gives the same world, a save brings it back to the last field, and a save made
 * before worlds existed loads with none (old saves are abandoned, owner 2026-10-30).
 */

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
}

beforeEach(() => resetMatTuning());
afterEach(() => {
    resetWorldTablesForTests();
    resetMatTuning();
    vi.restoreAllMocks();
});

describe('⭐ a new game\'s world', () => {
    it('⭐ is generated at a new game from the run seed, and kept in the save', () => {
        newGame();
        const world = World.currentWorld();
        expect(world).not.toBeNull();
        expect(GameState.state.world).toBe(world);
        expect(world.seed).toBe(World.runSeedOf(GameState.state));
        expect(world.cells[0]).toMatchObject({ id: '0,0', ring: 0 });
        expect(world.cells.length).toBe(1 + 6 * (1 + 2 + 3) + 6 * (4 + 5 + 6));
    });

    it('the Hall\'s cell holds the Starter Camp\'s origins', () => {
        newGame();
        const { materialsOf } = World.lookups();
        const expected = hallOriginsOf(StarterCamp.starterCamp().tokens, materialsOf);
        expect(expected.length).toBeGreaterThan(0);
        expect(World.currentWorld().cells[0].origins.map(o => o.id)).toEqual(expected);
    });

    it('two games made at the same moment get the same world; another moment, another world', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        newGame();
        const first = JSON.stringify(World.currentWorld());
        newGame();
        expect(JSON.stringify(World.currentWorld())).toBe(first);
        Date.now.mockReturnValue(1_800_000_000_001);
        newGame();
        expect(JSON.stringify(World.currentWorld())).not.toBe(first);
    });

    it('generating it draws nothing from Math.random, so the game rolls what it would have', () => {
        newGame();
        const spy = vi.spyOn(Math, 'random');
        World.createWorld({ seed: 31337 });
        expect(spy).not.toHaveBeenCalled();
    });

    it('a save brings the world back to the last field', () => {
        newGame();
        const before = JSON.stringify(World.currentWorld());
        const saved = JSON.parse(GameState.serializeJson());
        expect(validateSaveData(saved).valid).toBe(true);
        const loaded = migrateState(saved.state, saved.version);
        expect(JSON.stringify(loaded.world)).toBe(before);
    });

    it('a save from before worlds loads with none, and is still a valid save', () => {
        newGame();
        const saved = JSON.parse(GameState.serializeJson());
        delete saved.state.world;
        expect(validateSaveData(saved).valid).toBe(true);
        const loaded = migrateState(saved.state, saved.version);
        expect(loaded.world).toBeNull();
        GameState.state = loaded;
        expect(World.currentWorld()).toBeNull();
        expect(INITIAL_STATE.world).toBeNull();
    });

    it('a preview never touches the save', () => {
        newGame();
        const kept = World.currentWorld();
        const preview = World.previewWorld(7);
        expect(preview.seed).toBe(7);
        expect(World.currentWorld()).toBe(kept);
    });

    it('in words: every ring, every cell, and what the checks found', () => {
        newGame();
        const text = World.describeWorld(World.currentWorld());
        expect(text).toMatch(/^World \d+ · 127 cells · rings 0–6 \(strict 1–3, wild 4–6\)/);
        for (let n = 0; n <= 6; n++) expect(text).toContain(`Ring ${n}`);
        for (const cell of World.currentWorld().cells) expect(text).toContain(cell.id);
        expect(text).toContain('What the checks found:');
        expect(text).toContain('Copper Ore Vein');
    });
});

describe('the placeholder tables', () => {
    const lookups = () => World.lookups();

    it('are in force until the CMS syncs data/world.json', () => {
        expect(isPlaceholderTables()).toBe(true);
        expect(worldTables().lines.map(l => l.id)).toEqual(['ores', 'trees', 'crops', 'herbs', 'waters', 'arcane']);
        expect(worldTables().issues).toEqual([]);
    });

    it('every origin they name is a Token type the game has', () => {
        const tables = normaliseWorldTables(PLACEHOLDER_WORLD_TABLES);
        const ids = tables.lines.flatMap(l => [1, 2, 3].flatMap(n => l.origins[n].map(o => o.id)));
        const keys = [1, 2, 3].flatMap(n => tables.keys[n]);
        const treasures = tables.extras.filter(e => e.kind === 'treasure').map(e => e.id);
        for (const id of [...ids, ...keys, ...treasures]) expect(getTokenType(id), id).toBeTruthy();
    });

    it('over 500 seeds the only findings are today\'s holes, each one also listed by the generation', () => {
        // Herbs and Arcane have too few origins; a cell whose only origins yield nothing a price may
        // name (a Wild Wheat Patch's crop is not read) leaves the cell beyond it nothing to ask for.
        const tables = worldTables();
        const { materialsOf, hallOrigins } = lookups();
        const kinds = new Set();
        for (let seed = 1; seed <= 500; seed++) {
            const world = generateWorld({ seed, tables, materialsOf, hallOrigins });
            const noSource = new Set();
            for (const p of world.problems) {
                expect([PROBLEM.EMPTY_TABLE, PROBLEM.NO_PRICE_SOURCE]).toContain(p.kind);
                if (p.kind === PROBLEM.EMPTY_TABLE) expect(['herbs', 'arcane']).toContain(p.line);
                else noSource.add(p.cellId);
            }
            const cells = new Map(world.cells.map(c => [c.id, c]));
            for (const f of worldFindings(world, tables, { materialsOf, hallOrigins })) {
                kinds.add(f.check);
                expect([WORLD_CHECK.NO_MAIN, WORLD_CHECK.PRICE_PLACES]).toContain(f.check);
                if (f.check === WORLD_CHECK.NO_MAIN) expect(['herbs', 'arcane']).toContain(cells.get(f.cellId).wedge);
                else expect(noSource.has(f.cellId)).toBe(true);
            }
        }
        expect(kinds.has(WORLD_CHECK.NO_MAIN)).toBe(true);
    }, 60000);

    it('iron and fir always lie a step out from every ring-1 cell', () => {
        const tables = worldTables();
        const { materialsOf, hallOrigins } = lookups();
        for (let seed = 1; seed <= 300; seed++) {
            const world = generateWorld({ seed, tables, materialsOf, hallOrigins });
            expect(worldFindings(world, tables, { materialsOf, hallOrigins }).filter(f => f.check === WORLD_CHECK.KEY_REACH)).toEqual([]);
        }
    }, 60000);
});

describe('what a price may ask for, read from the Tokens', () => {
    it('sure outputs and a basic pool\'s main catch, never a rare drop', () => {
        expect(materialsOfToken(getTokenType('token_oak_tree'))).toEqual(['item_oak_wood']);
        expect(materialsOfToken(getTokenType('token_copper_ore_vein'))).toEqual(['item_copper_ore']);
        const river = materialsOfToken(getTokenType('token_river'));
        expect(river.length).toBeGreaterThan(0);
        expect(materialsOfToken(null)).toEqual([]);
        const memo = materialsFromTokens(getTokenType);
        expect(memo('token_oak_tree')).toBe(memo('token_oak_tree'));
    });
});

describe('the world tables\' shape', () => {
    it('six lines with distinct ids, or nothing to generate from', () => {
        expect(normaliseWorldTables(null)).toBeNull();
        expect(normaliseWorldTables({ lines: FIXTURE_WORLD_RAW.lines.slice(0, 5) })).toBeNull();
        const twice = { ...FIXTURE_WORLD_RAW, lines: [...FIXTURE_WORLD_RAW.lines.slice(0, 5), FIXTURE_WORLD_RAW.lines[0]] };
        expect(normaliseWorldTables(twice)).toBeNull();
    });

    it('defaults what is missing, and says what it dropped', () => {
        const bare = normaliseWorldTables({ lines: FIXTURE_WORLD_RAW.lines.map(l => ({ id: l.id })) });
        expect(bare).toMatchObject({ neighbourStrength: 8, mainPerCell: 1, blendsPerNeighbour: 1, pityWindow: 4, valueTolerance: 0.1 });
        expect(bare.wild).toMatchObject({ rings: 3, priceGrowth: 1.5, levelStep: 10 });
        expect(bare.lines[0].origins).toEqual({ 1: [], 2: [], 3: [] });

        const messy = normaliseWorldTables({
            ...FIXTURE_WORLD_RAW,
            lines: FIXTURE_WORLD_RAW.lines.map((l, i) => (i === 0 ? { ...l, kits: { volcano: 2 } } : l)),
            neighbours: [{ a: 'waters', b: 'nowhere' }],
            extras: [{ id: 'mod_x', kind: 'curse', value: 3 }],
            prices: { 1: { items: [{ qty: 50 }] }, 2: { items: [{ qty: 10 }] }, 3: { items: [{ qty: 90 }] } }
        });
        expect(messy.lines[0].kits).toEqual({});
        expect(messy.neighbours).toEqual([]);
        expect(messy.extras).toEqual([]);
        expect(messy.issues).toHaveLength(4);
    });

    it('tests may swap the tables in force; tables that cannot generate are refused', () => {
        setWorldTablesForTests(FIXTURE_WORLD_RAW);
        expect(isPlaceholderTables()).toBe(false);
        expect(worldTables().lines[0].origins[1][0].id).toBe('f_ores_1a');
        expect(() => setWorldTablesForTests({ lines: [] })).toThrow();
        resetWorldTablesForTests();
        expect(isPlaceholderTables()).toBe(true);
    });
});
