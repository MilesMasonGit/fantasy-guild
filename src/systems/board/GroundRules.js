// the ground under the mat: which cells a Token type may stand on, in the Region the guild is in

import { GameState } from '../../state/GameState.js';
import { standsOnOf } from '../../config/registries/tokenRegistry.js';
import { WATER_KIND } from '../../config/registries/fishingSpots.js';
import {
    TERRAIN, DEFAULT_TERRAIN, TERRAIN_CELL, cellIndex, shoreDistance, allowsTerrain, needsText
} from '../atlas/TerrainMap.js';
import { readWater, rasterise, STYLE } from '../atlas/WaterShapes.js';

/**
 * Placement's fourth rule (`MatPlacement`): the cell under a Token's centre must be one its "Stands
 * on" allows (`TerrainMap.allowsTerrain`). The cells are the stored terrain map of the Region the
 * guild is in (`region.terrain`, written by the layout at settle). A Region with no stored map
 * (the Starter Camp, an empty dev Region, every bench and test board) is meadow: grass, no water.
 *
 * A map is decoded once, with its shore cells, and each list's allowed cells are worked out once
 * per map. The cache is keyed on the stored map object itself, so travel and a load, which bring a
 * different object, are read afresh with no event to miss, even in the middle of `Atlas.travel`
 * (the Hall lands in the new Region before `BOARD_SWAPPED` is announced).
 *
 * ⚠️ The fast path is what keeps a meadow placing exactly as before: a Token with no list on a
 * Region with no water may stand on every cell, so {@link rulesFor} returns null and a search asks
 * the ground nothing per candidate. Every bench board takes it.
 *
 * A device whose Mat Tuner made the mat bigger than the shipped one reads the edge cells past the
 * map's edge (`cellIndex` clamps) until the mat size is a fixed game value.
 */

/** No stored map: one grass cell standing for the whole mat. */
const MEADOW = {
    map: null,
    version: 0,
    cols: 1,
    rows: 1,
    cell: TERRAIN_CELL,
    terrains: [DEFAULT_TERRAIN],
    shore: new Uint8Array(1),
    hasWater: false,
    rules: new Map(),
    waterKinds: new Uint8Array(1),
    waterCells: new Map()
};

let decodedCount = 0;
let cached = { map: null, ground: MEADOW };

/** The stored map of the Region the guild is in, or null. Reads only; never repairs the Atlas. */
function activeMap() {
    const atlas = GameState.state?.atlas;
    const region = atlas?.regions?.[atlas?.activeRegionId];
    const map = region?.terrain;
    return map && typeof map === 'object' ? map : null;
}

/** A stored map's cells, shore and water, or the meadow when it cannot be read. */
function decode(map) {
    const cols = map.cols;
    const rows = map.rows;
    const count = cols * rows;
    if (!(Number.isInteger(cols) && cols > 0 && Number.isInteger(rows) && rows > 0)
        || typeof map.cells !== 'string' || map.cells.length !== count || !Array.isArray(map.legend)) {
        return MEADOW;
    }
    const terrains = new Array(count);
    const water = new Uint8Array(count);
    let hasWater = false;
    for (let i = 0; i < count; i++) {
        const terrain = map.legend[parseInt(map.cells[i], 36)] || DEFAULT_TERRAIN;
        terrains[i] = terrain;
        if (terrain === TERRAIN.WATER) {
            water[i] = 1;
            hasWater = true;
        }
    }
    const shore = new Uint8Array(count);
    if (hasWater) {
        const dist = shoreDistance({ cols, rows }, water);
        for (let i = 0; i < count; i++) if (dist[i] === 1) shore[i] = 1;
    }
    return {
        map,
        version: ++decodedCount,
        cols,
        rows,
        cell: map.cell > 0 ? map.cell : TERRAIN_CELL,
        terrains,
        shore,
        hasWater,
        rules: new Map(),
        waterKinds: null,
        waterCells: new Map()
    };
}

/**
 * The ground of the Region the guild is in: `{ version, cols, rows, cell, terrains, shore,
 * hasWater }`, decoded once per stored map. `version` changes whenever the ground does.
 */
export function groundHere() {
    const map = activeMap();
    if (!map) return MEADOW;
    if (cached.map !== map) cached = { map, ground: decode(map) };
    return cached.ground;
}

/** Which ground the mat is on now, for anything that remembers an answer the ground decided. */
export function groundVersion() {
    return groundHere().version;
}

/**
 * What the ground says about a Token type here, worked out once per map and list: `{ grid, cell,
 * mask, standsOn, allowed, reason }`, `mask` holding 1 for each cell it may stand on and `allowed`
 * counting them. Null when it may stand on every cell (no list, and no water here): the fast path.
 */
export function rulesFor(typeId) {
    return rulesForWords(standsOnOf(typeId));
}

/**
 * {@link rulesFor} for a "Stands on" list itself rather than a Token type's (an event's ground,
 * `EventClock`). The same answers, from the same per-map cache.
 */
export function rulesForWords(standsOn) {
    const ground = groundHere();
    if (standsOn.length === 0 && !ground.hasWater) return null;
    const key = standsOn.join('|');
    let rules = ground.rules.get(key);
    if (!rules) {
        const mask = new Uint8Array(ground.cols * ground.rows);
        let allowed = 0;
        for (let i = 0; i < mask.length; i++) {
            if (allowsTerrain(standsOn, ground.terrains[i], ground.shore[i] === 1)) {
                mask[i] = 1;
                allowed++;
            }
        }
        rules = Object.freeze({
            grid: Object.freeze({ cols: ground.cols, rows: ground.rows }),
            cell: ground.cell,
            mask,
            standsOn,
            allowed,
            reason: needsText(standsOn)
        });
        ground.rules.set(key, rules);
    }
    return rules;
}

/** Whether the cell under `(x, y)` is one `rules` (from {@link rulesFor}) allows. */
export function allowsAt(rules, x, y) {
    return rules.mask[cellIndex(rules.grid, x, y, rules.cell)] === 1;
}

/** Whether a Token of `typeId` may stand with its centre at `point`, as far as the ground goes. */
export function mayStandAt(typeId, point) {
    const rules = rulesFor(typeId);
    return !rules || allowsAt(rules, point.x, point.y);
}

/** What a Token of `typeId` needs, as the sentence a refused drop flies back with. */
export function refusalFor(typeId) {
    return needsText(standsOnOf(typeId));
}

// ---------------------------------------------------------------------------
// Which water: what a fishing spot's catch reads
// ---------------------------------------------------------------------------

/** The water kinds in the order {@link waterKindsOf} stores them, 0 being dry land. */
const KIND_CODES = Object.freeze([null, WATER_KIND.SEA, WATER_KIND.FRESH, WATER_KIND.SULPHUR]);
const CODE_OF_STYLE = Object.freeze({ [STYLE.SEA]: 1, [STYLE.LAKE]: 2, [STYLE.SULPHUR]: 3 });
const FRESH_CODE = 2;
const EMPTY_CELLS = Object.freeze([]);

/**
 * Each cell's water kind as a code into {@link KIND_CODES}, worked out once per map: the style of
 * the stored water shape strongest at the cell's centre (the sea, a lake or river, a sulphur
 * spring), read with the same field the drawing uses. A water cell no shape reaches, or a map whose
 * shapes cannot be read, is fresh water.
 */
function waterKindsOf(ground) {
    if (ground.waterKinds) return ground.waterKinds;
    const kinds = new Uint8Array(ground.cols * ground.rows);
    const record = readWater(ground.map?.water);
    const style = record
        ? rasterise(record, { x0: ground.cell / 2, y0: ground.cell / 2, step: ground.cell, nx: ground.cols, ny: ground.rows }).style
        : null;
    for (let i = 0; i < kinds.length; i++) {
        if (ground.terrains[i] !== TERRAIN.WATER) continue;
        kinds[i] = (style && CODE_OF_STYLE[style[i]]) || FRESH_CODE;
    }
    ground.waterKinds = kinds;
    return kinds;
}

/** The water kind under `(x, y)` in the Region the guild is in (`WATER_KIND`), or null on dry land. */
export function waterKindAt(x, y) {
    const ground = groundHere();
    if (!ground.hasWater) return null;
    return KIND_CODES[waterKindsOf(ground)[cellIndex(ground, x, y, ground.cell)]] || null;
}

/**
 * The cells of any of the water kinds `kinds` (`WATER_KIND`), as cell indices in order, worked out
 * once per map and list. Empty with no water here: a meadow asks nothing more.
 */
export function waterCellsOf(kinds) {
    const ground = groundHere();
    if (!ground.hasWater || !kinds?.length) return EMPTY_CELLS;
    const key = kinds.join('|');
    let cells = ground.waterCells.get(key);
    if (!cells) {
        const codes = waterKindsOf(ground);
        const wanted = kinds.map(k => KIND_CODES.indexOf(k)).filter(c => c > 0);
        const out = [];
        for (let i = 0; i < codes.length; i++) if (wanted.includes(codes[i])) out.push(i);
        cells = Object.freeze(out);
        ground.waterCells.set(key, cells);
    }
    return cells;
}

/** The biome of a Region no map wrote (the Starter Camp), as its ground is meadow. */
export const NO_MAP_BIOME = 'meadow';
const MEADOW_BIOMES = Object.freeze([NO_MAP_BIOME]);

/** The Region's biomes, kept on the weights object they were read from. */
let biomesKept = { weights: undefined, biomes: MEADOW_BIOMES };

/** The biomes of the Region the guild is in: those its maps gave any weight, else meadow. */
export function regionBiomes() {
    const atlas = GameState.state?.atlas;
    const weights = atlas?.regions?.[atlas?.activeRegionId]?.biome;
    if (biomesKept.weights === weights) return biomesKept.biomes;
    let biomes = MEADOW_BIOMES;
    if (weights && typeof weights === 'object') {
        const named = Object.keys(weights).filter(b => Number(weights[b]) > 0);
        if (named.length) biomes = Object.freeze(named);
    }
    biomesKept = { weights, biomes };
    return biomes;
}

/** Places by the biomes they were made for, then by water code: one object each, so pools keep per place. */
const places = new WeakMap();

/**
 * Where a Token at `(x, y)` stands, as the catch pools read it (`catchPools.poolsAt`): `{ water,
 * biomes }`, the water kind under it (null on dry land) and the Region's biomes. The same object
 * for the same answer.
 */
export function placeAt(x, y) {
    const biomes = regionBiomes();
    const water = waterKindAt(x, y);
    let byWater = places.get(biomes);
    if (!byWater) {
        byWater = new Map();
        places.set(biomes, byWater);
    }
    let place = byWater.get(water);
    if (!place) {
        place = Object.freeze({ water, biomes });
        byWater.set(water, place);
    }
    return place;
}
