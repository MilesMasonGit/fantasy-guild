// Fantasy Guild — test helper: a Region standing on a hand-drawn terrain grid

/**
 * **For tests only.** Builds the stored map with `encodeTerrain` and reads it back through
 * `regionGround`, so the terrain suites exercise the same path the game does.
 */

import { encodeTerrain, TERRAIN_CELL } from '../../systems/atlas/TerrainMap.js';
import { regionGround } from '../../systems/atlas/regionGround.js';

/** Every first biome on its own ground: grass takes the forest look, rock the mountain's, sand the coast's. */
export const ALL_BIOMES = Object.freeze({
    main: 'forest',
    terrains: Object.freeze({ forest: 'grass', mountain: 'rock', coast: 'sand' }),
    water: 0.3,
    shore: Object.freeze(['coast'])
});

/** The cell terrains `fill(c, r)` names, row by row. */
export function cellsOf(cols, rows, fill) {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(fill(c, r));
    return out;
}

/**
 * A Region record on a `cols × rows` grid. `biomes` is the maps' ground summary
 * (`Budget.budget().ground`); null gives every terrain its default look.
 */
export function regionWith(cols, rows, fill, { seed = 5, biomes = ALL_BIOMES } = {}) {
    return { seed, ground: biomes, terrain: encodeTerrain({ cols, rows }, cellsOf(cols, rows, fill)) };
}

/** The ground of {@link regionWith} on a mat exactly its grid's size. */
export function groundWith(cols, rows, fill, options) {
    return regionGround(regionWith(cols, rows, fill, options), { w: cols * TERRAIN_CELL, h: rows * TERRAIN_CELL });
}

/** One terrain everywhere. */
export const flat = (terrain) => () => terrain;
