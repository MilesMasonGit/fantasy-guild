// Fantasy Guild — test helper: a Region with a sea along its foot and a lake up on its left

/**
 * **For tests and the bench.** A hand-drawn water record (`WaterShapes.readWater` reads it), its
 * cells sampled the way a settle samples them, stored with `encodeTerrain`, so the ground the
 * fishing spots land on is read through the same path a settled Region's is.
 *
 * On the shipped 1920 × 1040 mat: the sea covers about the bottom 220 units, the lake is a disc of
 * radius 170 around (360, 300), and the Hall's clearing (960, 520, 140) stays dry.
 */

import { encodeTerrain, terrainGrid, TERRAIN, TERRAIN_CELL } from '../../systems/atlas/TerrainMap.js';
import { readWater, sampleWater, WATER_VERSION } from '../../systems/atlas/WaterShapes.js';
import { createRegionRecord } from '../../state/StateSchema.js';
import { GameState } from '../../state/GameState.js';

export const WATER_MAT = Object.freeze({ w: 1920, h: 1040 });

/** Points well inside each water, and one on dry land. */
export const SEA_POINT = Object.freeze({ x: 960, y: 980 });
export const LAKE_POINT = Object.freeze({ x: 360, y: 300 });
export const LAND_POINT = Object.freeze({ x: 1300, y: 400 });

export const WATER_RECORD = Object.freeze({
    v: WATER_VERSION,
    salt: 11,
    mat: [WATER_MAT.w, WATER_MAT.h],
    clear: [960, 520, 140],
    shapes: [
        { k: 'sea', side: 2, step: 192, d: Array(13).fill(220) },
        { k: 'lake', lobes: [[360, 300, 170]], holes: [] }
    ]
});

/** The stored terrain map: water where the record's water covers a cell, grass elsewhere. */
export function waterMap() {
    const grid = terrainGrid(WATER_MAT);
    const { water } = sampleWater(readWater(WATER_RECORD), grid, TERRAIN_CELL);
    const terrains = Array.from(water, wet => (wet ? TERRAIN.WATER : TERRAIN.GRASS));
    return encodeTerrain(grid, terrains, structuredClone(WATER_RECORD));
}

/**
 * Make a Region of this ground the one the guild is in. `biome`: its biome weights (the Region's
 * biomes are those with weight).
 */
export function standOnWater({ biome = { coast: 1 }, map = waterMap(), id = 'region_fish' } = {}) {
    const region = createRegionRecord(id);
    region.kind = 'settled';
    region.terrain = map;
    region.biome = biome;
    GameState.state.atlas = { activeRegionId: region.id, nextRegionNumber: 2, regions: { [region.id]: region }, seed: null };
    return region;
}
