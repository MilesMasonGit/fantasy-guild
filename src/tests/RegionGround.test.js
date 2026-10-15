import { describe, it, expect } from 'vitest';
import { budget } from '../systems/atlas/Budget.js';
import { layout } from '../systems/atlas/Layout.js';
import { DEV_MAPS } from '../systems/atlas/devMaps.js';
import {
    TERRAIN, TERRAIN_CELL, terrainGrid, encodeTerrain, decodeTerrain, terrainAt
} from '../systems/atlas/TerrainMap.js';
import { regionGround, decodedTerrain, looksForGround } from '../systems/atlas/regionGround.js';
import { createRegionRecord } from '../state/StateSchema.js';
import { hash01 } from '../systems/board/TerrainLattice.js';
import { cellsOf, regionWith } from './fixtures/ground.js';

/**
 * Reading a Region's ground (terrain roadmap B2): the stored cell map decoded once, the meadow
 * where no map was stored, and one look per terrain from the biome that owns it.
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });
const layoutOf = (maps, seed) => {
    const summary = budget(maps, { cap: 128 });
    const result = layout(summary, {
        seed, mat: MAT, crowding: { hitboxPct: 80, overlapPct: 40 }, artRadius: () => 64
    });
    return { summary, result, region: { seed, ground: summary.ground, terrain: result.terrain } };
};

describe('⭐ decodeTerrain', () => {
    it('⭐ reads a 55 × 36 map back to exactly what encodeTerrain wrote', () => {
        const grid = terrainGrid(MAT);
        expect([grid.cols, grid.rows]).toEqual([55, 36]);
        const kinds = ['grass', 'rock', 'sand', 'water', 'mud'];
        const terrains = cellsOf(grid.cols, grid.rows, (c, r) => kinds[Math.floor(hash01(c, r, 3) * kinds.length)]);
        const map = encodeTerrain(grid, terrains);
        const decoded = decodeTerrain(map);
        expect(decoded).toMatchObject({ cell: TERRAIN_CELL, cols: 55, rows: 36, legend: map.legend });
        expect(Array.from(decoded.cells, i => decoded.legend[i])).toEqual(terrains);
        // And back again, character for character.
        expect(encodeTerrain(grid, Array.from(decoded.cells, i => decoded.legend[i]))).toEqual(map);
        // Every cell agrees with the point reader the layout's tests use.
        for (let i = 0; i < terrains.length; i++) {
            const c = i % grid.cols;
            const r = (i - c) / grid.cols;
            expect(decoded.legend[decoded.cells[i]]).toBe(terrainAt(map, (c + 0.5) * TERRAIN_CELL, (r + 0.5) * TERRAIN_CELL));
        }
    });

    it('refuses what is not a stored map, rather than drawing garbage', () => {
        const map = encodeTerrain({ cols: 3, rows: 2 }, ['grass', 'rock', 'sand', 'water', 'grass', 'rock']);
        expect(decodeTerrain(null)).toBeNull();
        expect(decodeTerrain({ ...map, cells: map.cells.slice(1) })).toBeNull();
        expect(decodeTerrain({ ...map, cells: 'zzzzzz' })).toBeNull();
        expect(decodeTerrain({ ...map, cols: 0 })).toBeNull();
        expect(decodeTerrain({ ...map, legend: 'grass' })).toBeNull();
    });
});

describe('⭐ A Region with no stored map is meadow (decision 3)', () => {
    it('⭐ gives the Starter Camp\'s record, terrain null, all grass with the meadow look', () => {
        const record = createRegionRecord('region_1');
        expect(record.terrain).toBeNull();
        const ground = regionGround(record, MAT);
        expect([ground.cols, ground.rows]).toEqual([55, 36]);
        expect(new Set(Array.from(ground.cells, i => ground.terrains[i]))).toEqual(new Set([TERRAIN.GRASS]));
        expect(ground.looks.grass).toBe('meadow');
        expect(ground.meadow).toBe(true);
    });

    it('ignores a ground summary that came with no map, and a map it cannot read', () => {
        const forestOnly = { seed: 4, ground: { main: 'forest', terrains: { forest: 'grass' } }, terrain: null };
        expect(regionGround(forestOnly, MAT).looks.grass).toBe('meadow');
        const broken = { ...forestOnly, terrain: { cell: 32, cols: 2, rows: 2, legend: ['grass'], cells: 'x' } };
        expect(regionGround(broken, MAT).looks.grass).toBe('meadow');
        expect(regionGround(null, MAT).looks.grass).toBe('meadow');
    });
});

describe('⭐ One look per terrain, from the biome that owns it (decision 5)', () => {
    it('⭐ gives a hybrid\'s grass the forest look and its rock the mountain look', () => {
        const { region, result } = layoutOf([DEV_MAPS.forest, DEV_MAPS.mountain], 77);
        const used = new Set(result.terrain.cells);
        expect(used.size).toBeGreaterThan(1);
        const ground = regionGround(region, MAT);
        expect(ground.looks.grass).toBe('forest');
        expect(ground.looks.rock).toBe('mountain');
        expect(ground.meadow).toBe(false);
    });

    it('gives a Forest + Coast its forest grass, coast sand and the sea', () => {
        const { region } = layoutOf([DEV_MAPS.forest, DEV_MAPS.coast], 78);
        expect(regionGround(region, MAT).looks).toMatchObject({ grass: 'forest', sand: 'coast', water: 'sea' });
    });

    it('gives grass no biome owns the meadow look, and every terrain some look', () => {
        const { region } = layoutOf([DEV_MAPS.mountain, DEV_MAPS.coast], 79);
        const looks = regionGround(region, MAT).looks;
        expect(looks).toMatchObject({ grass: 'meadow', rock: 'mountain', sand: 'coast', water: 'sea' });
    });

    it('falls back to the terrain\'s own look when a biome\'s look does not fit its ground', () => {
        // A Coast map authored with grass for its ground: the coast look is sand, so the grass is meadow.
        expect(looksForGround({ main: 'coast', terrains: { coast: 'grass' } }, ['grass'])).toEqual({ grass: 'meadow' });
        // A biome with no look of its own.
        expect(looksForGround({ main: 'plains', terrains: { plains: 'grass' } }, ['grass'])).toEqual({ grass: 'meadow' });
        // A terrain no look draws yet reads as meadow, not as nothing.
        expect(looksForGround(null, ['mud']).mud).toBe('meadow');
    });

    it('picks the biome whose look fits when two biomes share a terrain', () => {
        // ⚠️ Only one first-three biome draws each terrain, so two looks never compete yet; a
        // biome without a look of its own (a future Plains) gives way to one that has.
        const ground = { main: 'mountain', terrains: { plains: 'grass', mountain: 'rock', forest: 'grass' } };
        expect(looksForGround(ground, ['grass', 'rock'])).toEqual({ grass: 'forest', rock: 'mountain' });
    });
});

describe('Reading the stored map', () => {
    it('decodes a map once, and a loaded copy afresh', () => {
        const { region } = layoutOf([DEV_MAPS.forest, DEV_MAPS.coast], 80);
        const first = decodedTerrain(region.terrain);
        expect(decodedTerrain(region.terrain)).toBe(first);
        const loaded = JSON.parse(JSON.stringify(region.terrain));
        expect(decodedTerrain(loaded)).not.toBe(first);
        expect(Array.from(decodedTerrain(loaded).cells)).toEqual(Array.from(first.cells));
    });

    it('never writes into the Region record (the save stays as it was)', () => {
        const { region } = layoutOf([DEV_MAPS.forest, DEV_MAPS.coast], 81);
        const before = JSON.stringify(region);
        regionGround(region, MAT);
        expect(JSON.stringify(region)).toBe(before);
    });

    it('hands back the Region\'s seed and its cells on the shipped mat', () => {
        const { region, result } = layoutOf([DEV_MAPS.forest, DEV_MAPS.coast], 82);
        const ground = regionGround(region, MAT);
        expect(ground.seed).toBe(82);
        expect(ground.mat).toEqual(MAT);
        expect(ground.cell).toBe(TERRAIN_CELL);
        for (let i = 0; i < ground.cells.length; i++) {
            expect(ground.terrains[ground.cells[i]]).toBe(result.terrain.legend[parseInt(result.terrain.cells[i], 36)]);
        }
    });

    it('reads clamped cells on a mat bigger or smaller than the one the map was made for', () => {
        // A device whose Mat Tuner resized the mat (until T-097 fixes the size): the edge cells
        // carry on outward, and a smaller mat reads the map's top-left part.
        const region = regionWith(4, 3, (c, r) => (c === 3 ? 'water' : r === 2 ? 'rock' : 'grass'));
        const bigger = regionGround(region, { w: 6 * TERRAIN_CELL, h: 4 * TERRAIN_CELL });
        expect([bigger.cols, bigger.rows]).toEqual([6, 4]);
        const at = (g, c, r) => g.terrains[g.cells[r * g.cols + c]];
        expect(at(bigger, 5, 0)).toBe('water');
        expect(at(bigger, 0, 3)).toBe('rock');
        expect(at(bigger, 5, 3)).toBe('water');
        const smaller = regionGround(region, { w: 2 * TERRAIN_CELL, h: 2 * TERRAIN_CELL });
        expect([smaller.cols, smaller.rows]).toEqual([2, 2]);
        expect(Array.from(smaller.cells, i => smaller.terrains[i])).toEqual(['grass', 'grass', 'grass', 'grass']);
    });
});
