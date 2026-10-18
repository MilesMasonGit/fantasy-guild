import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatCap from '../systems/board/MatCap.js';
import { matW, matH } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as Cartography from '../systems/atlas/Cartography.js';
import { decodeTerrain, islandsOf, cellIndex } from '../systems/atlas/TerrainMap.js';
import { looksForGround } from '../systems/atlas/regionGround.js';
import { BIOME_GROUND } from '../systems/atlas/Budget.js';
import * as GroundRules from '../systems/board/GroundRules.js';
import { standsOnOf } from '../config/registries/tokenRegistry.js';
import { nextSeed } from '../systems/atlas/seededRandom.js';
import {
    TERRAIN_DEV_REGIONS, TERRAIN_DEV_WATER, goToDevRegion, rerollDevRegion, backToStarterCamp, isDevRegion, devMapsOf, viewOf, firstSeedOf,
    DEV_GROUND_TOKENS, placeGroundTestTokens, TERRAIN_DEV_PLACEMENT, DEV_CHEST, hasIsland
} from '../ui/dev/terrainDev.js';
import { SHAPE } from '../systems/atlas/WaterShapes.js';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The Terrain dev section's buttons (dev builds only): every view of the ground the eye-check
 * needs is one click, never a console line. Each settles a dev Region for free and travels there;
 * the dev Region left behind is removed.
 */

const regionIds = () => Object.keys(GameState.state.atlas.regions).sort();

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    placeAt('token_guild_hall', Math.round(matW() / 2), Math.round(matH() / 2));
    Atlas.createStarterRegion();
    Cartography.clearStock();
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

describe('⭐ each view is one click', () => {
    it('⭐ every button settles its Region for free and takes the guild there, with its ground stored', () => {
        const home = Atlas.activeRegionId();
        const guildSeed = GameState.state.atlas.seed;
        for (const view of TERRAIN_DEV_REGIONS) {
            const result = goToDevRegion(view.maps);
            expect(result.success, view.label).toBe(true);
            const here = Atlas.activeRegion();
            expect(here.id).toBe(result.region.id);
            expect(viewOf(here)).toBe(view);
            expect(devMapsOf(here)).toEqual(view.maps);
            const map = decodeTerrain(here.terrain);
            expect(map, view.label).not.toBeNull();
            const terrains = new Set([...map.cells].map(i => map.legend[i]));
            if (view.maps.includes('coast')) expect(terrains.has('water'), view.label).toBe(true);
            if (view.maps.includes('mountain')) expect(terrains.has('rock'), view.label).toBe(true);
            if (view.maps.includes('forest')) expect(terrains.has('grass'), view.label).toBe(true);
            // A newer biome's ground takes its own look.
            for (const biome of ['flower_meadow', 'cherry_grove', 'yellowstone', 'volcano']) {
                if (!view.maps.includes(biome)) continue;
                const terrain = BIOME_GROUND[biome].terrain;
                expect(terrains.has(terrain), view.label).toBe(true);
                expect(looksForGround(here.ground, [terrain])[terrain], view.label).toBe(biome);
            }
            // Free: nothing is left in the dev stock, and the Hall came along.
            expect(Cartography.held(), view.label).toEqual([]);
            expect(BoardState.tokens().some(t => MatCap.isGuildHall(t)), view.label).toBe(true);
        }
        // Only the last one is left beside the Starter Camp; the guild seed never moved.
        expect(regionIds()).toEqual([home, Atlas.activeRegionId()].sort());
        expect(GameState.state.atlas.seed).toBe(guildSeed);
    });

    it('⭐ every water button makes a Region with that water, stored as its shapes, and a reroll keeps the kind', () => {
        const want = {
            water_lake_river: [SHAPE.LAKE, SHAPE.RIVER], water_lake: [SHAPE.LAKE], water_river: [SHAPE.RIVER],
            water_split: [SHAPE.RIVER], water_spring: [SHAPE.LAKE, SHAPE.RIVER], water_mountain_river: [SHAPE.RIVER],
            water_pond: [SHAPE.LAKE], water_tarn: [SHAPE.LAKE], water_sulphur: [SHAPE.POOL], water_sea: [SHAPE.SEA]
        };
        expect(TERRAIN_DEV_WATER.map(v => v.id).sort()).toEqual(Object.keys(want).sort());
        for (const view of TERRAIN_DEV_WATER) {
            const result = goToDevRegion(view.maps);
            expect(result.success, view.label).toBe(true);
            const here = Atlas.activeRegion();
            expect(viewOf(here)).toBe(view);
            const kinds = new Set(here.terrain.water.shapes.map(s => s.k));
            for (const k of want[view.id]) expect(kinds.has(k), `${view.label}: ${k}`).toBe(true);
            const map = decodeTerrain(here.terrain);
            expect(map.water.shapes.length, view.label).toBeGreaterThan(0);
            expect([...map.cells].some(i => map.legend[i] === 'water'), view.label).toBe(true);
        }
        // The split river's view rerolled is still a split river: a main arm, its side channel.
        goToDevRegion(['water_split']);
        const first = Atlas.activeRegion().terrain.water;
        expect(rerollDevRegion().success).toBe(true);
        const again = Atlas.activeRegion().terrain.water;
        expect(again).not.toEqual(first);
        expect(again.shapes.filter(s => s.k === SHAPE.RIVER).length).toBeGreaterThanOrEqual(2);
        expect(again.shapes.some(s => s.w[0] === 16 && s.w[1] === 16)).toBe(true);
    });

    it('⭐ every placement button makes a Region with a camp and a Test Chest; the lake view\'s chest stands on its island', () => {
        expect(TERRAIN_DEV_PLACEMENT.length).toBeGreaterThan(0);
        for (const view of TERRAIN_DEV_PLACEMENT) {
            const result = goToDevRegion(view.maps);
            expect(result.success, view.label).toBe(true);
            const here = Atlas.activeRegion();
            expect(viewOf(here)).toBe(view);
            const camp = BoardState.tokens().find(t => t.typeId === 'token_goblin_camp');
            const chest = BoardState.tokens().find(t => t.typeId === DEV_CHEST.id);
            expect(camp, view.label).toBeTruthy();
            expect(chest, view.label).toBeTruthy();
            if (view.wants !== 'island') continue;
            const hall = { x: Math.round(matW() / 2), y: Math.round(matH() / 2) };
            expect(hasIsland({ terrain: here.terrain, hall }), view.label).toBe(true);
            const map = decodeTerrain(here.terrain);
            const wet = map.legend.indexOf('water');
            const isles = islandsOf(map, map.cells.map(k => (k === wet ? 1 : 0)), cellIndex(map, hall.x, hall.y, map.cell));
            expect(isles.some(i => i.includes(cellIndex(map, chest.x, chest.y, map.cell))), view.label).toBe(true);
        }
    });

    it('the same button gives the same Region every time', () => {
        const first = goToDevRegion(['forest', 'coast']).region;
        backToStarterCamp();
        const again = goToDevRegion(['forest', 'coast']).region;
        expect(again.seed).toBe(first.seed);
        expect(again.terrain).toEqual(first.terrain);
        expect(first.seed === firstSeedOf(['forest', 'coast']) || first.seed === nextSeed(firstSeedOf(['forest', 'coast']))).toBe(true);
    });

    it('Reroll it: the same maps on the next seed, the old one removed; refused away from a dev Region', () => {
        expect(rerollDevRegion()).toMatchObject({ success: false });
        const first = goToDevRegion(['mountain', 'coast']).region;
        const result = rerollDevRegion();
        expect(result.success).toBe(true);
        const here = Atlas.activeRegion();
        expect(here.id).not.toBe(first.id);
        expect(devMapsOf(here)).toEqual(['mountain', 'coast']);
        expect(here.seed).not.toBe(first.seed);
        expect(here.terrain).not.toEqual(first.terrain);
        expect(Atlas.getRegion(first.id)).toBeNull();
    });

    it('Back to the Starter Camp: home, the dev Region removed; refused when already home', () => {
        const home = Atlas.activeRegionId();
        expect(backToStarterCamp()).toMatchObject({ success: false });
        const dev = goToDevRegion(['forest']).region;
        expect(backToStarterCamp().success).toBe(true);
        expect(Atlas.activeRegionId()).toBe(home);
        expect(Atlas.getRegion(dev.id)).toBeNull();
        expect(regionIds()).toEqual([home]);
    });

    it('never removes a Region the player settled, or the Starter Camp', () => {
        const home = Atlas.activeRegionId();
        const players = Atlas.createRegion({ ingredients: ['map_forest'], seed: 9 }).region;
        expect(isDevRegion(players)).toBe(false);
        expect(isDevRegion(Atlas.getRegion(home))).toBe(false);
        expect(Atlas.travel(players.id).success).toBe(true);
        expect(goToDevRegion(['coast']).success).toBe(true);
        expect(Atlas.getRegion(players.id)).not.toBeNull();
        expect(backToStarterCamp().success).toBe(true);
        expect(regionIds()).toEqual([home, players.id].sort());
    });
});

describe('⭐ the ground test Tokens are one click', () => {
    const onMat = (id) => BoardState.tokens().filter(t => t.typeId === id);

    it('on a Coast hybrid: a Boat on water, a Dock on the shore, a Mineshaft on rock, each where placement allows', () => {
        expect(goToDevRegion(['mountain', 'coast']).success).toBe(true);
        const res = placeGroundTestTokens();
        expect(res).toMatchObject({ success: true });
        expect(DEV_GROUND_TOKENS.map(t => t.standsOn[0])).toEqual(['water', 'shore', 'rock']);
        for (const t of DEV_GROUND_TOKENS) {
            expect(standsOnOf(t.id)).toEqual(t.standsOn);
            const [token] = onMat(t.id);
            expect(token, t.id).toBeTruthy();
            expect(GroundRules.mayStandAt(t.id, token)).toBe(true);
        }
    });

    it('on the meadow (no water, no rock) each is refused with its reason, and nothing is placed', () => {
        const res = placeGroundTestTokens();
        expect(res.success).toBe(false);
        for (const reason of ['Needs water.', 'Needs the shore.', 'Needs rock.']) expect(res.reason).toContain(reason);
        expect(res.placed).toEqual([]);
        for (const t of DEV_GROUND_TOKENS) expect(onMat(t.id)).toHaveLength(0);
    });
});
