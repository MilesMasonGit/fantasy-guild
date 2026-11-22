// each biome's terrain ranges: the water shapes it rolls, its sea's share, its Stone patches (pure, import-free: the CMS reads it too)

/**
 * The biome table (`data/world.json` `biomes`, authored on the CMS's World page): per biome,
 *
 *     { water: ['lake_river', 'lake_river', 'lake'],  // the inland water shapes it may roll, one picked by the
 *                                                     // layout's seed; a shape listed twice comes twice as often
 *       sea: [0.3, 0.3],                              // [least, most] share of the mat the edge sea takes
 *       stone: [1, 3] }                               // [least, most] Stone patches (outcrops) on its mat
 *
 * Grass is what is left. A new place rolls each range once from its own seed (`rollBiomeTerrain`).
 *
 * ⚠️ Without a `biomes` key (tables written before the table existed) the built-in rows below apply,
 * each biome's Stone taken from a kit of that biome's old `stone` count: so a game on such tables
 * makes exactly the places it always made. With the key, a biome without a row also takes its
 * built-in row, and the content check names it.
 */

/** The nine biomes, in the order the CMS lists them. */
export const BIOMES = Object.freeze(['meadow', 'flower_meadow', 'forest', 'cherry_grove', 'mountain', 'yellowstone', 'volcano', 'coast', 'bog']);

/** The inland water shapes a row may name (`WaterShapes.WATER_KIND`'s values; a test keeps the two the same). */
export const WATER_SHAPES = Object.freeze(['lake', 'lake_river', 'river', 'split', 'spring', 'mountain_river', 'pond', 'tarn', 'sulphur', 'marsh']);

const row = (water, sea, stone) => Object.freeze({ water: Object.freeze(water), sea: Object.freeze([sea, sea]), stone: Object.freeze([stone, stone]) });

/**
 * The built-in rows: the water the settled world rounds gave each biome (`world5.py` to `world7.py`
 * in `docs/active/research/ground_gen/`), the Coast's sea, and each kit's Stone as its biome's.
 * ⚠️ The order of each water list is part of the roll: reordering it changes which shape a seed picks.
 */
export const BIOME_TERRAIN_DEFAULTS = Object.freeze({
    meadow: row(['lake_river', 'lake_river', 'lake', 'river', 'split', 'spring'], 0, 1),
    flower_meadow: row(['lake_river', 'lake_river', 'lake', 'river', 'split', 'spring'], 0, 0),
    forest: row(['pond'], 0, 2),
    cherry_grove: row(['pond'], 0, 0),
    mountain: row(['tarn', 'mountain_river'], 0, 5),
    yellowstone: row(['sulphur'], 0, 0),
    volcano: row([], 0, 0),
    coast: row([], 0.3, 2),
    bog: row(['marsh'], 0, 1)
});

/** A biome nothing is known about: no inland water, no sea, no Stone. */
export const EMPTY_BIOME_ROW = row([], 0, 0);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** `[least, most]` from a pair or one number, each read by `read`; `most` never below `least`. */
function rangeOf(raw, read, fallback) {
    const pair = Array.isArray(raw) ? raw : [raw, raw];
    const lo = read(pair[0]);
    const hi = read(pair.length > 1 ? pair[1] : pair[0]);
    if (lo === null && hi === null) return [...fallback];
    const a = lo ?? hi;
    const b = hi ?? lo;
    return a <= b ? [a, b] : [b, a];
}

const share = (v) => (finite(v) ? Math.min(1, Math.max(0, v)) : null);
const patches = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

/** One row in its one shape, anything malformed taken from `fallback`. */
export function biomeRowOf(raw, fallback = EMPTY_BIOME_ROW) {
    const src = isObject(raw) ? raw : {};
    return {
        water: Array.isArray(src.water) ? src.water.filter(k => WATER_SHAPES.includes(k)) : [...fallback.water],
        sea: rangeOf(src.sea, share, fallback.sea),
        stone: rangeOf(src.stone, patches, fallback.stone)
    };
}

/**
 * The rows a record without a `biomes` key stands for: the built-in rows, each biome's Stone from
 * the first kit of that biome that still names a `stone` count. What the CMS seeds its table with.
 *
 * @param {object[]} [kits] the record's kits, as authored
 * @returns {Record<string, {water: string[], sea: number[], stone: number[]}>}
 */
export function seedBiomeTable(kits = []) {
    const out = {};
    for (const biome of BIOMES) out[biome] = biomeRowOf(BIOME_TERRAIN_DEFAULTS[biome]);
    const taken = new Set();
    for (const kit of Array.isArray(kits) ? kits : []) {
        const biome = isObject(kit) && typeof kit.biome === 'string' ? kit.biome.trim() : '';
        if (!out[biome] || taken.has(biome) || patches(kit.stone) === null) continue;
        taken.add(biome);
        out[biome].stone = [kit.stone, kit.stone];
    }
    return out;
}

/**
 * The biome table in force for a record: `{ biomes, missing }`, `biomes` holding a row for each of
 * the nine and any other row the record names, `missing` the biomes of the nine the record's table
 * leaves out (empty when it has no table at all: then every row is the seeded one).
 */
export function normaliseBiomeTable(rawBiomes, kits = []) {
    const seeded = seedBiomeTable(kits);
    if (!isObject(rawBiomes)) return { biomes: seeded, missing: [] };
    const biomes = {};
    const missing = [];
    for (const biome of BIOMES) {
        if (isObject(rawBiomes[biome])) biomes[biome] = biomeRowOf(rawBiomes[biome], BIOME_TERRAIN_DEFAULTS[biome]);
        else {
            biomes[biome] = seeded[biome];
            missing.push(biome);
        }
    }
    for (const [biome, raw] of Object.entries(rawBiomes)) {
        if (!(biome in biomes) && isObject(raw)) biomes[biome] = biomeRowOf(raw);
    }
    return { biomes, missing };
}

/** A biome's row in normalised tables: its own, else its built-in one, else none. */
export function biomeRow(tables, biome) {
    return tables?.biomes?.[biome] || BIOME_TERRAIN_DEFAULTS[biome] || EMPTY_BIOME_ROW;
}

/**
 * A place's draw from its biome's row: Stone patches, then the sea's share, one draw each from
 * `random` whether or not the range is wider than one value, so widening one range never moves the
 * other's roll. A range of one value gives exactly that value.
 *
 * @param {{sea: number[], stone: number[]}} row
 * @param {() => number} random the place's own generator
 * @returns {{stone: number, sea: number}}
 */
export function rollBiomeTerrain(row, random) {
    const [sLo, sHi] = row.stone;
    const [wLo, wHi] = row.sea;
    const s = random();
    const w = random();
    return {
        stone: sHi > sLo ? sLo + Math.min(sHi - sLo, Math.floor(s * (sHi - sLo + 1))) : sLo,
        sea: wHi > wLo ? wLo + (wHi - wLo) * w : wLo
    };
}
