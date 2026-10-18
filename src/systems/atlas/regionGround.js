// a Region's ground as the drawing reads it: its cells and the look of each terrain

import { TERRAIN, DEFAULT_TERRAIN, TERRAIN_CELL, decodeTerrain } from './TerrainMap.js';
import { STYLE_TERRAIN } from './WaterShapes.js';
import { DEFAULT_LOOK, LAWN_TERRAIN, getLook } from '../../config/registries/terrainRegistry.js';

/**
 * The ground is the Atlas cell map a Region stored at settle (`region.terrain`): nothing else
 * writes it, and drawing and placement both read this one grid. A Region with no stored map is
 * meadow (the Starter Camp, the dev console's empty Regions, every bench and test board): worked
 * out on read, never written back, so no save changes.
 *
 * Pure: reads the record, never writes it.
 */

/** Decoded maps by the stored object, so travelling back reuses one and a load decodes afresh. */
const decoded = new WeakMap();

/** A stored map decoded, once per map object. Null for a map that is not one. */
export function decodedTerrain(map) {
    if (!map || typeof map !== 'object') return null;
    if (!decoded.has(map)) decoded.set(map, decodeTerrain(map));
    return decoded.get(map);
}

/**
 * The look each terrain takes in a Region: the look of the biome that owns that terrain
 * (`ground.terrains`, biome → terrain), when that look draws that terrain; else the terrain's
 * default look (grass no biome owns is meadow). A terrain no look draws reads as meadow.
 *
 * ⚠️ One look per terrain: two biomes owning one terrain (a future Plains beside a Forest) would
 * need the biome stored per cell. The first owner whose look fits wins, the main biome first.
 *
 * @param {{main?: string, terrains?: Record<string, string>}|null} ground  `Budget.budget().ground`
 * @param {string[]} terrains
 * @returns {Record<string, string>} terrain id → look id
 */
export function looksForGround(ground, terrains) {
    const owned = ground?.terrains && typeof ground.terrains === 'object' ? Object.entries(ground.terrains) : [];
    owned.sort(([a], [b]) => (b === ground.main) - (a === ground.main));
    const out = {};
    for (const terrain of terrains) {
        const owner = owned.find(([biome, t]) => t === terrain && getLook(biome)?.terrain === terrain);
        const fallback = Object.prototype.hasOwnProperty.call(DEFAULT_LOOK, terrain) ? DEFAULT_LOOK[terrain] : DEFAULT_LOOK[DEFAULT_TERRAIN];
        out[terrain] = owner ? owner[0] : fallback;
    }
    return out;
}

/**
 * A Region's ground over a mat: one terrain per cell and the look of each terrain.
 *
 * The grid covers `mat` in whole cells. A mat bigger or smaller than the one the map was made for
 * (a device's Mat Tuner) reads clamped cells: the edge cells carry on outward.
 *
 * @param {object|null} region  an Atlas Region record (`seed`, `ground`, `terrain`)
 * @param {{w: number, h: number}} mat  the mat in mat units
 * @returns {{seed: number, mat: {w: number, h: number}, cell: number, cols: number, rows: number,
 *   terrains: string[], cells: Uint8Array, looks: Record<string, string>, meadow: boolean,
 *   water: object|null}}
 *   `cells[r * cols + c]` indexes `terrains`; `looks` covers every terrain the drawing can meet
 *   (the map's, the first ones a beach may write, the water's own looks and a blend's lawn); `meadow` when no
 *   map was stored; `water` the water's shapes (`WaterShapes.readWater`), null when the map stored
 *   none: its water is then drawn from its cells
 */
export function regionGround(region, mat) {
    if (!(mat?.w > 0) || !(mat?.h > 0)) throw new TypeError('regionGround(region, mat) needs the mat size');
    const map = decodedTerrain(region?.terrain);
    const source = map || { cell: TERRAIN_CELL, cols: 1, rows: 1, legend: [DEFAULT_TERRAIN], cells: Uint8Array.of(0) };
    const { cell } = source;
    const cols = Math.ceil(mat.w / cell);
    const rows = Math.ceil(mat.h / cell);
    const cells = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
        const from = Math.min(r, source.rows - 1) * source.cols;
        for (let c = 0; c < cols; c++) cells[r * cols + c] = source.cells[from + Math.min(c, source.cols - 1)];
    }
    const terrains = [...source.legend];
    const named = [...new Set([...terrains, ...Object.values(TERRAIN), ...STYLE_TERRAIN.filter(Boolean), LAWN_TERRAIN])];
    return {
        seed: Number.isFinite(region?.seed) ? region.seed : 0,
        mat: { w: mat.w, h: mat.h },
        cell,
        cols,
        rows,
        terrains,
        cells,
        looks: looksForGround(map ? region.ground : null, named),
        meadow: !map,
        water: map?.water || null
    };
}
