import { describe, it, expect } from 'vitest';
import { budget, groundOf, BIOME_GROUND, BIOME_WATER, BIOME_SMALL_WATER } from '../systems/atlas/Budget.js';
import { layout, HALL_CLEARING } from '../systems/atlas/Layout.js';
import { TERRAIN, TERRAIN_CELL, decodeTerrain } from '../systems/atlas/TerrainMap.js';
import { planWater, WATER_KIND, SMALL_WATER, SHAPE } from '../systems/atlas/WaterShapes.js';
import { mulberry32, seedFromText } from '../systems/atlas/seededRandom.js';
import { looksForGround } from '../systems/atlas/regionGround.js';
import { LOOKS, generatedOf, propsOf } from '../config/registries/terrainRegistry.js';
import { CLEAN_LOOKS } from '../config/playmatTuning.js';
import { defaultBannerFor } from '../config/areaBanners.js';
import { DEV_MAPS } from '../systems/atlas/devMaps.js';
import { TERRAIN_DEV_REGIONS } from '../ui/dev/terrainDev.js';

/**
 * ⭐ The Bog (brief 240 K0.4): a plane-2 biome on grass, drawn darker than the forest from the
 * existing ground sheets, with marsh water: many small ponds where a forest has one. The meadow has
 * its own ground entry too. Content-free: synthetic Tokens, the real rules.
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });
const CLEAR = Object.freeze({ x: 880, y: 563, r: HALL_CLEARING + 2 * TERRAIN_CELL });
const SEEDS = Array.from({ length: 6 }, (_, i) => seedFromText(`bog-${i}`));
const mapOf = (biome, extra = {}) => ({
    id: `b_${biome}`, kind: 'base', biome, points: 30,
    nodes: [{ typeId: `${biome}_tree`, weight: 3 }, { typeId: `${biome}_bush`, weight: 1 }], ...extra
});
const settle = (maps, seed) => layout(budget(maps, { cap: 128 }), { seed, mat: MAT, crowding: { hitboxPct: 80, overlapPct: 40 }, artRadius: () => 64 });
const ponds = (result) => (result.terrain.water?.shapes || []).filter(s => s.k === SHAPE.LAKE);
const waterCells = (result) => {
    const map = decodeTerrain(result.terrain);
    return [...map.cells].filter(i => map.legend[i] === TERRAIN.WATER).length;
};

describe('⭐ the Bog\'s ground', () => {
    it('is grass, no sea; and the meadow has an entry of its own, the same as it fell back to', () => {
        expect(BIOME_GROUND.bog).toEqual({ terrain: TERRAIN.GRASS, water: 0 });
        expect(BIOME_GROUND.meadow).toEqual({ terrain: TERRAIN.GRASS, water: 0 });
        expect(groundOf({ biome: 'bog' })).toEqual({ terrain: TERRAIN.GRASS, water: 0, inland: [WATER_KIND.MARSH] });
        expect(groundOf({ biome: 'meadow' }).terrain).toBe(TERRAIN.GRASS);
    });

    it('brings marsh water as the main biome and a pond as a minor one', () => {
        expect(BIOME_WATER.bog).toEqual([WATER_KIND.MARSH]);
        expect(BIOME_SMALL_WATER.bog).toBe(SMALL_WATER.POND);
        expect(budget([mapOf('bog')], { cap: 128 }).ground.inland).toEqual([WATER_KIND.MARSH]);
    });

    it('a marsh is many small ponds, the same ones for the same seed', () => {
        for (const seed of [1, 7, 42]) {
            const { record, kind } = planWater({ sea: 0, kinds: [WATER_KIND.MARSH] }, mulberry32(seed), MAT, CLEAR);
            expect(kind).toBe(WATER_KIND.MARSH);
            expect(record.shapes.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
            expect(record.shapes.every(s => s.k === SHAPE.LAKE)).toBe(true);
            // Small: each lobe smaller than a forest's pond's biggest.
            for (const s of record.shapes) for (const [, , r] of s.lobes) expect(r).toBeLessThanOrEqual(66);
            expect(planWater({ sea: 0, kinds: [WATER_KIND.MARSH] }, mulberry32(seed), MAT, CLEAR).record).toEqual(record);
        }
    });

    it('⭐ a settled Bog has more ponds and more water than a settled forest, and stays dry by the Hall', () => {
        for (const seed of SEEDS) {
            const bog = settle([mapOf('bog')], seed);
            const forest = settle([mapOf('forest')], seed);
            expect(ponds(bog).length, `seed ${seed}`).toBeGreaterThan(ponds(forest).length);
            expect(ponds(bog).length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
            expect(waterCells(bog), `seed ${seed}`).toBeGreaterThan(waterCells(forest));
            for (const s of ponds(bog)) {
                for (const [x, y] of s.lobes) expect(Math.hypot(x - CLEAR.x, y - CLEAR.y)).toBeGreaterThan(HALL_CLEARING);
            }
            expect(settle([mapOf('bog')], seed)).toEqual(bog);
        }
    });
});

describe('⭐ the Bog\'s look', () => {
    it('owns its grass in a Region, with a look of its own on the forest\'s darker sheet', () => {
        const ground = budget([mapOf('bog')], { cap: 128 }).ground;
        expect(looksForGround(ground, [TERRAIN.GRASS])).toEqual({ [TERRAIN.GRASS]: 'bog' });
        expect(LOOKS.bog.terrain).toBe(TERRAIN.GRASS);
        expect(LOOKS.bog.sheets).toEqual(['grass_dark']);
        expect(CLEAN_LOOKS.bog).toBeTruthy();
        expect(propsOf('bog').props.map(p => p.sheet)).toEqual(expect.arrayContaining(['p_bush_dark', 'p_mushroom']));
    });

    it('is darker than the forest, and its bare ground is mud: more of it than the forest\'s', () => {
        const [, light] = generatedOf('bog').grass;
        expect(light).toBeLessThan(generatedOf('forest').grass[1]);
        expect(light).toBeLessThan(generatedOf('meadow').grass[1]);
        expect(generatedOf('bog').earthShare).toBeGreaterThan(generatedOf('forest').earthShare);
    });

    it('shows the swamp banner, has a dev map and a Terrain button', () => {
        expect(defaultBannerFor('bog')).toBe('b_swamp');
        expect(DEV_MAPS.bog.biome).toBe('bog');
        expect(TERRAIN_DEV_REGIONS.find(v => v.id === 'bog')?.maps).toEqual(['bog']);
    });
});
