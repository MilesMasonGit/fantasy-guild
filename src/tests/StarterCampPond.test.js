import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as GroundRules from '../systems/board/GroundRules.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { REGION_KIND } from '../systems/atlas/Atlas.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import { HALL_CLEARING } from '../systems/atlas/Layout.js';
import { TERRAIN, TERRAIN_CELL, terrainAt, decodeTerrain } from '../systems/atlas/TerrainMap.js';
import { readWater, waterFieldAt, SHAPE } from '../systems/atlas/WaterShapes.js';
import { regionGround } from '../systems/atlas/regionGround.js';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setStarterCampForTests, resetStarterCampForTests } from '../config/registries/starterCampRegistry.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * A new game's Starter Camp has a small pond near the camp, where nothing stands: stored like a
 * settled Region's water, so it is drawn and the Tokens keep off it. Every other Starter Camp (an
 * older save, a board built without a camp) stays all meadow.
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
}

beforeEach(() => resetMatTuning());
afterEach(() => {
    resetStarterCampForTests();
    resetMatTuning();
});

describe('⭐ the Starter Camp\'s pond', () => {
    it('⭐ a new game opens with a pond near the camp, off every Token, out of the Hall\'s clearing', () => {
        for (const camp of [null, StarterCamp.starterCamp()]) {
            setStarterCampForTests(camp);
            newGame();
            const region = Atlas.activeRegion();
            expect(region.kind).toBe(REGION_KIND.STARTER);
            const map = decodeTerrain(region.terrain);
            expect(map.water.shapes.map(s => s.k)).toEqual([SHAPE.LAKE]);
            const water = readWater(region.terrain.water);
            const wet = [...map.cells].filter(i => map.legend[i] === TERRAIN.WATER).length;
            expect(wet).toBeGreaterThan(3);
            const hall = BoardState.tokens().find(t => t.typeId === StarterCamp.GUILD_HALL_TYPE);
            for (const t of BoardState.tokens()) {
                expect(terrainAt(region.terrain, t.x, t.y), t.typeId).toBe(TERRAIN.GRASS);
                expect(waterFieldAt(water, t.x, t.y).f, t.typeId).toBeLessThan(-artRadiusOf(t.typeId));
            }
            // Near the camp: its middle a few Tokens out from the Hall, past its clearing.
            const [{ lobes: [[x, y]] }] = water.shapes;
            const d = Math.sqrt((x - hall.x) * (x - hall.x) + (y - hall.y) * (y - hall.y));
            expect(d).toBeGreaterThan(HALL_CLEARING);
            expect(d).toBeLessThan(700);
            for (let a = -HALL_CLEARING; a <= HALL_CLEARING; a += TERRAIN_CELL) {
                expect(waterFieldAt(water, hall.x + a, hall.y).f).toBeLessThan(0);
                expect(waterFieldAt(water, hall.x, hall.y + a).f).toBeLessThan(0);
            }
        }
    });

    it('⭐ keeps a dry Token out of the pond and lets it stand beside it, and draws it', () => {
        newGame();
        const region = Atlas.activeRegion();
        const map = decodeTerrain(region.terrain);
        const wetCell = [...map.cells].findIndex(i => map.legend[i] === TERRAIN.WATER);
        const x = (wetCell % map.cols + 0.5) * TERRAIN_CELL;
        const y = (Math.floor(wetCell / map.cols) + 0.5) * TERRAIN_CELL;
        expect(GroundRules.mayStandAt('token_oak_tree', { x, y })).toBe(false);
        expect(GroundRules.mayStandAt('token_oak_tree', { x: 880, y: 563 + HALL_CLEARING })).toBe(true);
        const plan = buildGroundPlan(regionGround(region, MAT));
        expect(plan.grass.looks).toContain('lake');
        expect(plan.palette[plan.terrainAt[Math.floor(y / 2) * plan.width + Math.floor(x / 2)]]).toBe('water:lake');
    });

    it('is the same for the same camp, and leaves a camp with nowhere to put it all meadow', () => {
        const standing = StarterCamp.placementsOf(StarterCamp.builtInCamp());
        expect(StarterCamp.starterCampTerrain(standing, MAT, 1)).toEqual(StarterCamp.starterCampTerrain(standing, MAT, 1));
        // Tokens all round the Hall, everywhere a pond could go.
        const crowded = [...standing];
        for (let y = 100; y < MAT.h; y += 150) for (let x = 100; x < MAT.w; x += 150) crowded.push({ typeId: 'token_oak_tree', x, y });
        expect(StarterCamp.starterCampTerrain(crowded, MAT, 1)).toBeNull();
    });

    it('a Starter Camp made without a camp (an older save, a test board) stays all meadow', () => {
        GameState.initNew();
        Atlas.createStarterRegion();
        expect(Atlas.activeRegion().terrain).toBeNull();
        expect(regionGround(Atlas.activeRegion(), MAT).water).toBeNull();
    });
});
