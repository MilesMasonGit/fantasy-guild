// a node budget and a seed → where each Token stands, and the ground under them

import { mulberry32 } from './seededRandom.js';
import {
    TERRAIN, DEFAULT_TERRAIN, TERRAIN_CELL, MAX_WATER_SHARE, terrainGrid, cellIndex, cellCentre,
    shoreDistance, islandsOf, followNodes, encodeTerrain
} from './TerrainMap.js';
import { planWater, readWater, sampleWater, fieldAt, withoutInland, smallWater, emptyWater } from './WaterShapes.js';

/**
 * The layout half of generation: places every Token a budget (`Budget.js`) writes, on a mat of a
 * given size, around a clear ring for the Guild Hall at the centre, and makes the terrain grid
 * the Tokens stand on (`TerrainMap.js`). A pure function of the budget, the seed and the geometry
 * it is handed: a reroll is a new seed, and moves only coordinates and ground.
 *
 * The placement follows the owner's settled placement rounds (`place1.py`, `place2.py` in
 * `docs/active/research/ground_gen/`):
 *
 * - **Water** first, as shapes (`WaterShapes`): maps that bring a sea (`summary.ground.water`)
 *   get one along an edge, and the main biome its inland water (`summary.ground.inland`, one
 *   variety picked by the seed). A cell is water when the water covers half of it; the shapes are
 *   stored with the cells, so the drawing follows them.
 * - **A treasure's island** is kept free: a treasure takes the driest spot of an island of dry
 *   cells the water surrounds, when one is dry enough, one island per treasure.
 * - **Camps** pick their nook in the outer band ({@link NOOK_BAND}), and a grove of the budget's
 *   commonest tree wraps the side of it facing the Hall. The camp itself stands there once every
 *   node does, so it is judged on the ground the nodes bring.
 * - **Nodes** grow in natural clumps, one species per grove: groves of uneven sizes
 *   ({@link GROVE_SIZES}), each stretched along a seeded direction, tight in the middle and looser
 *   at the rim, and about one node in eight standing alone between groves. Species with the
 *   biggest bodies go first; a species of a biome that brings the sea starts its groves on the
 *   shore. **Kinds where they belong** (`affinity`): berry bushes start their groves near inland
 *   water and stay by it; ore and stone whose own biome's ground is not rock lean to rock ground
 *   (and trees on rock to grass), when the Region has some. **Rarer further out**: a species
 *   the budget gives at most {@link RARE_COUNT} of, beside others it gives more of, grows at the
 *   mat's edge. Every preference gives way, last first, when no spot has it.
 * - **Treasures** last, on their island, else in the most hidden spot away from the Hall
 *   ({@link HIDE_BAND}): the one with the most nodes round it, those nearer the Hall than it
 *   (screening it) counting double.
 * - **Small waters** after that, once every Token stands: each other biome's
 *   (`summary.ground.small`) in a gap of its own ground, clear of every Token and of the other
 *   water, or none where none fits. Nothing placed moves for them.
 *
 * **The ground follows the nodes**: a node's own cell takes its biome's terrain, any other dry
 * cell the terrain of the nearest node in reach, else the Region's main biome's. Camps and
 * treasures take the ground where they land. Every placed Token records its biome, so the cell
 * under its centre always has that biome's terrain, except a node that stands in the water (a
 * boat): its cell stays water, while the dry cells round it follow it like any node's.
 *
 * The result lists the Tokens in budget order (nodes, then camps, then treasures), whatever
 * order they were placed in, so a reroll moves only coordinates; a tie for the nearest node
 * goes to the one listed first.
 *
 * A spot is legal by `MatPlacement`'s rules restated on explicit numbers: the art circle inside the
 * mat, centres at least the hitbox gap apart, plus clear of the Hall's ring, on a terrain the
 * `terrainAllows` seam accepts (by default anywhere dry; `layoutInputs` supplies each Token's
 * "Stands on"), and not refused by the optional `allows` hook (`layoutInputs.cannotCheck` asks the
 * game's `Cannot` rules). A grove, camp or treasure also starts on ground its Token may stand on.
 * Nodes are spaced more loosely than that when the budget leaves room ({@link COMFORT_GAP}),
 * packing tighter as density modifiers add more.
 *
 * ⚠️ Determinism: every number comes from the seeded generator, whole-unit coordinates, and
 * arithmetic IEEE fixes exactly (+ − × ÷ sqrt). No trigonometry, no `Math.hypot`, no `**`: their
 * last bit may differ between browser engines, and a layout must be the same on every machine.
 * Directions come from the generator by rejection, bell shapes from sums of uniform draws, and the
 * camp's arc from a table of fixed numbers.
 */

/** The Token that stands at the centre of every Region. */
export const HALL_TYPE_ID = 'token_guild_hall';

/**
 * How far from the Hall's centre no generated Token's art may reach, in mat units: the Hall's art
 * (64) plus the shipped nudge reach (160), within which the Hall lands the quest Tokens it spawns.
 */
export const HALL_CLEARING = 224;

/** The spacing two standard Tokens get when the budget leaves room: a little art overlap reads as a grove. */
export const COMFORT_GAP = 112;

/**
 * The most of the free mat a layout fills when it spaces nodes out, so a dense budget packs its
 * nodes tighter rather than spreading them over the room left for building.
 */
export const NODE_AREA_SHARE = 0.5;

/**
 * Camps stand at least this far out from the centre towards the mat's edge (0 = the centre, 1 = a
 * Token touching the edge), measured on the nearer axis: their enemies wander and attack heroes
 * near them, so they stay away from the Hall.
 */
export const CAMP_BAND = 0.7;

/** Where a camp looks for its nook first: in the outer band, short of the very edge. */
export const NOOK_BAND = Object.freeze([0.78, 0.92]);

/** A shore species' grove starts within this many cells of the water. */
export const SHORE_CELLS = 3;

/** What a kind of Token prefers to stand near, as the `affinity` seam names it. */
export const AFFINITY = Object.freeze({ ROCK: 'rock', WATER: 'water', GRASS: 'grass' });

/** The grove sizes a species' nodes are split into, one drawn per grove, so groves come uneven. */
export const GROVE_SIZES = Object.freeze([3, 4, 6, 8, 10, 12]);

/** About one node in eight of a species of more than {@link STRAY_MIN} stands alone between the groves. */
export const STRAY_SHARE = 0.12;
const STRAY_MIN = 4;

/** A species the budget gives at most this many of, while it gives another more, grows at the mat's edge. */
export const RARE_COUNT = 2;

/** How far out (as {@link campBand}) a rare species' grove starts, and its members keep. */
export const RARE_BAND = 0.85;
export const RARE_KEEP = 0.78;

/** A water kind's grove starts one to this many cells from inland water, and its members keep within it. */
export const NEAR_WATER = 3;

/** A hidden treasure stands at least this far out (as {@link campBand}). */
export const HIDE_BAND = 0.6;

/** How far round a treasure's spot the Tokens that hide it are counted, in mat units. */
const HIDE_REACH = 240;

/** Accepted draws when looking for the most hidden spot. */
const HIDE_DRAWS = 40;

/**
 * A grove's bell: its width as a share of the comfortable gap for a grove of {@link GROVE_MEAN}
 * (wider by the square root of its size over that), stretched along its direction by a factor
 * between the two `GROVE_STRETCH` numbers.
 */
const GROVE_SPREAD = Object.freeze([0.5, 0.75]);
const GROVE_MEAN = 6;
const GROVE_STRETCH = Object.freeze([1, 2.2]);

/**
 * Inside a grove two nodes keep `TIGHT` of the comfortable gap in the middle, `LOOSE` more per
 * bell width out, up to `RIM` widths: tight in the middle, looser at the rim. Never under the
 * game's own gap.
 */
const TIGHT = 0.64;
const LOOSE = 0.25;
const RIM = 1.5;

/** A new grove's middle keeps this many comfortable gaps from every Token; a straggler this many. */
const GROVE_APART = 2;
const STRAY_APART = 1.25;

/** When nothing is that far from everything, the distance shrinks by these shares in turn. */
const APART_STEPS = Object.freeze([1, 0.7, 0.49]);

/** Draws for a grove's middle at each distance, and for each member of a grove. */
const CENTRE_DRAWS = 40;
const GROW_TRIES = 40;

/** How many nodes wrap a camp: between the two, and only from a species with at least `WRAP_MIN` left. */
const WRAP_SIZE = Object.freeze([7, 9]);
const WRAP_MIN = 3;

/** The wrap's rows: how far from the camp each stands, as shares of the camp's own spacing from a node. */
const WRAP_REACH = Object.freeze([1, 1.3, 1.6]);

/**
 * The wrap's arc: turns from the direction of the Hall as fixed cosines and sines of 0, ±0.4,
 * ±0.8, ±1.2 and ±1.6 radians, nearest the Hall's side first.
 */
const ARC = Object.freeze([
    [1, 0], [0.9211, 0.3894], [0.9211, -0.3894], [0.6967, 0.7174], [0.6967, -0.7174],
    [0.3624, 0.9320], [0.3624, -0.9320], [-0.0292, 0.9996], [-0.0292, -0.9996]
]);

/** How hard a shore grove leans to the water as it grows: a cell inland weighs as four further along. */
const SHORE_PULL = 16;

/** How much more room a camp's preferred spacing gets, so its enemies have somewhere to stand. */
const CAMP_ROOM = 1.5;

/** The Hall's clearing stays dry this far past the ring, so the quests and the first buildings have land. */
const DRY_MARGIN = 2 * TERRAIN_CELL;

/**
 * How far a dry Token's centre keeps from the drawn water, in mat units: a cell is dry when water
 * covers less than half of it, so a shore cell may still show some.
 */
export const DRY_GAP = 8;

/** Places a small water tries in its biome's ground before it is left out. */
const SMALL_TRIES = 24;

/** How far a small water's middle keeps in from the mat's edge, in mat units. */
const SMALL_EDGE = 4 * TERRAIN_CELL;

/** How many cells a small water's drawn edge keeps from any other water's cells. */
const SMALL_APART = 2;

const STANDARD_ART = 64;
const HEX = Math.sqrt(3) / 2;
const EPS = 1e-6;

/** Best-candidate draws when choosing a camp, grove or treasure centre. */
const CAMP_DRAWS = 8;
const GROVE_DRAWS = 10;
const TREASURE_DRAWS = 16;

/** Growing a grove the old way (a member that found no spot in its bell): rounds of draws, each round reaching further. */
const GROW_ROUNDS = 4;
const GROW_DRAWS = 20;

/** Grid spacing of the last-resort scan, in mat units (as `MatPlacement.findSpotAnywhere`). */
const SCAN_STEP = 8;

const ROLE_CAMP = 'camp';
const ROLE_NODE = 'node';
const ROLE_TREASURE = 'treasure';

const KINDS = Object.values(AFFINITY);

/** Where the Hall stands on a mat of this size: its centre, in whole units. */
export function hallSpot(mat) {
    return { x: Math.round(mat.w / 2), y: Math.round(mat.h / 2) };
}

/**
 * How far out from the centre a Token of art radius `art` stands, 0 at the centre and 1 touching
 * the mat's edge, by whichever axis is further out.
 */
export function campBand(point, art, mat) {
    const cx = mat.w / 2;
    const cy = mat.h / 2;
    const ex = Math.abs(point.x - cx) / Math.max(1, cx - art);
    const ey = Math.abs(point.y - cy) / Math.max(1, cy - art);
    return Math.max(ex, ey);
}

/** The default terrain rule: anything may stand anywhere dry. */
export function anywhereDry(typeId, terrain) {
    return terrain !== TERRAIN.WATER;
}

/**
 * Lay a budget out on the mat.
 *
 * @param {object|object[]} summary  a `Budget.budget()` result, or its `entries` (then no water,
 *   and every Token on the default ground)
 * @param {object} options
 * @param {number} options.seed  any 32-bit number; a reroll passes a new one
 * @param {{w: number, h: number}} options.mat  the mat size in mat units, given explicitly so a
 *   layout means the same on every machine (the live mat size is a per-device dev setting)
 * @param {{hitboxPct: number, overlapPct: number}} options.crowding  the hitbox and overlap rules
 * @param {(typeId: string) => number} options.artRadius  a Token type's art radius
 * @param {(typeId: string, terrain: string, shore: boolean) => boolean} [options.terrainAllows]
 *   whether a Token may stand on a cell of a terrain, `shore` saying whether that cell is dry land
 *   touching water; {@link anywhereDry} by default. `layoutInputs` plugs each Token's "Stands on" in.
 * @param {(typeId: string, point: {x: number, y: number}, placed: {typeId: string, x: number, y: number}[]) => boolean} [options.allows]
 *   a last say on a spot that passes every other rule; `placed` includes the Hall
 * @param {(typeId: string) => string|null} [options.affinity]  what a node's kind prefers to stand
 *   near, one of {@link AFFINITY} or null (no preference, the default for every Token);
 *   `layoutInputs.affinityRule` reads it from the Token registry
 * @param {string} [options.hallTypeId]
 * @returns {{seed: number, mat: {w: number, h: number}, hall: {typeId: string, x: number, y: number},
 *   nodes: {typeId: string, role: string, biome: string|null, x: number, y: number}[],
 *   unplaced: {typeId: string, role: string}[],
 *   terrain: {cell: number, cols: number, rows: number, legend: string[], cells: string, water?: object}}}
 */
export function layout(summary, {
    seed, mat, crowding, artRadius, terrainAllows = anywhereDry, allows = null, affinity = null, hallTypeId = HALL_TYPE_ID
} = {}) {
    if (!mat || !(mat.w > 0) || !(mat.h > 0)) throw new TypeError('layout() needs the mat size: { mat: { w, h } }');
    if (!crowding || !Number.isFinite(crowding.hitboxPct) || !Number.isFinite(crowding.overlapPct)) {
        throw new TypeError('layout() needs the crowding rules: { crowding: { hitboxPct, overlapPct } }');
    }
    if (typeof artRadius !== 'function') throw new TypeError('layout() needs artRadius(typeId)');

    const seed32 = (Number(seed) || 0) >>> 0;
    const random = mulberry32(seed32);
    const { w, h } = mat;
    const hall = hallSpot(mat);
    const factor = 1 - crowding.overlapPct / 100;

    const bodies = new Map();
    const bodyOf = (typeId) => {
        let body = bodies.get(typeId);
        if (!body) {
            const art = artRadius(typeId);
            body = { art, hit: Math.round(art * crowding.hitboxPct / 100) };
            bodies.set(typeId, body);
        }
        return body;
    };

    const items = expand(summary);
    const ground = groundOf(summary);
    const terrainOf = (biome) => (biome && ground.terrains[biome]) || DEFAULT_TERRAIN;
    const mainGround = { terrain: terrainOf(ground.main), biome: ground.main };

    // The ground first: water is where nothing dry may stand.
    const cells = terrainGrid(mat);
    const dryReach = HALL_CLEARING + DRY_MARGIN;
    const keepDry = (i) => {
        const c = cellCentre(cells, i);
        const dx = c.x - hall.x;
        const dy = c.y - hall.y;
        return dx * dx + dy * dy < dryReach * dryReach;
    };
    const sea = Math.min(MAX_WATER_SHARE, Math.max(0, ground.water));
    let { record } = planWater({ sea, kinds: ground.inland }, random, mat, { x: hall.x, y: hall.y, r: dryReach });
    let sampled = record ? sampleWater(readWater(record), cells, TERRAIN_CELL, keepDry) : null;
    const share = (w) => w.reduce((n, v) => n + v, 0) / w.length;
    // Over the most a mat may hold: the inland water goes, the sea stays.
    if (sampled && share(sampled.water) > MAX_WATER_SHARE + 0.01) {
        record = withoutInland(record);
        sampled = record ? sampleWater(readWater(record), cells, TERRAIN_CELL, keepDry) : null;
    }
    const water = sampled ? sampled.water.slice() : new Uint8Array(cells.cols * cells.rows);
    const drawnAt = sampled ? (x, y) => fieldAt(sampled.sample, x, y) : null;
    const waterCells = water.reduce((n, v) => n + v, 0);
    const shore = waterCells > 0 ? shoreDistance(cells, water) : null;
    // The groves of a biome that brings the sea line the sea, not a pond.
    const seaShore = sampled?.sea.some(Boolean) ? shoreDistance(cells, sampled.sea) : null;
    // Berry bushes keep to a lake, a river or a pond, not the sea.
    const inland = sampled ? water.map((v, i) => (v && !sampled.sea[i] ? 1 : 0)) : null;
    const nearWater = inland?.some(Boolean) ? shoreDistance(cells, inland) : null;
    const shoreBiomes = new Set(ground.shore);
    const cellAt = (x, y) => cellIndex(cells, x, y);
    // Dry land touching water, a diagonal counting: the "shore" a Token's "Stands on" may name.
    const isShore = (i) => shore !== null && shore[i] === 1;
    // The cell each node stands in, with its ground; and the nodes in budget order, which the rest
    // of the ground follows.
    const owned = new Map();
    const marks = [];
    const groundAt = (x, y) => {
        const i = cellAt(x, y);
        if (water[i]) return { terrain: TERRAIN.WATER, biome: null };
        return owned.get(i) || followNodes(cellCentre(cells, i), marks, mainGround);
    };

    // Squares written as products: `**` is `Math.pow`, which engines need not round alike.
    const units = items.reduce((n, it) => {
        const scale = bodyOf(it.typeId).art / STANDARD_ART;
        return n + scale * scale;
    }, 0);
    const ringReach = HALL_CLEARING + STANDARD_ART;
    const freeArea = Math.max(1, (w - 2 * STANDARD_ART) * (h - 2 * STANDARD_ART)
        - Math.PI * ringReach * ringReach - waterCells * TERRAIN_CELL * TERRAIN_CELL);
    const spacing = units > 0 ? Math.min(COMFORT_GAP, Math.sqrt(NODE_AREA_SHARE * freeArea / (HEX * units))) : COMFORT_GAP;

    const minGap = (a, b) => (a.hit + b.hit) * factor;
    const prefGap = (a, aRole, b, bRole) => Math.max(minGap(a, b),
        spacing * (a.art + b.art) / (2 * STANDARD_ART) * (aRole === ROLE_CAMP || bRole === ROLE_CAMP ? CAMP_ROOM : 1));

    // Neighbours in square cells as wide as the widest gap any pair can ask for, so a spot only has
    // to look at the 3×3 cells round it.
    const hallBody = bodyOf(hallTypeId);
    let widest = hallBody;
    for (const it of items) if (bodyOf(it.typeId).art > widest.art) widest = bodyOf(it.typeId);
    const cell = Math.max(1, prefGap(widest, ROLE_CAMP, widest, ROLE_CAMP));
    const cols = Math.ceil(w / cell) + 1;
    const grid = new Map();
    const placed = [];
    // Spots kept for a camp or a treasure while the nodes grow: in the grid, so nodes keep their
    // distance, but not yet placed.
    const held = [];

    const keyOf = (record) => Math.floor(record.y / cell) * cols + Math.floor(record.x / cell);
    const inGrid = (record) => {
        const key = keyOf(record);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(record);
    };
    const put = (record) => {
        inGrid(record);
        placed.push(record);
    };
    const hold = (record) => {
        inGrid(record);
        held.push(record);
        return record;
    };
    const release = (record) => {
        const bucket = grid.get(keyOf(record));
        bucket.splice(bucket.indexOf(record), 1);
        held.splice(held.indexOf(record), 1);
    };

    /**
     * `scale` tightens the comfortable gap between two nodes (a grove's middle); `loose` keeps only
     * the game's own gap (the last resort).
     */
    const clearAt = (x, y, body, role, loose, scale = 1) => {
        const cx = Math.floor(x / cell);
        const cy = Math.floor(y / cell);
        for (let iy = cy - 1; iy <= cy + 1; iy++) {
            for (let ix = cx - 1; ix <= cx + 1; ix++) {
                if (ix < 0 || iy < 0 || ix >= cols) continue;
                const bucket = grid.get(iy * cols + ix);
                if (!bucket) continue;
                for (const p of bucket) {
                    let gap;
                    if (loose) gap = minGap(body, p.body);
                    else if (scale !== 1 && role === ROLE_NODE && p.role === ROLE_NODE) gap = Math.max(minGap(body, p.body), prefGap(body, role, p.body, p.role) * scale);
                    else gap = prefGap(body, role, p.body, p.role);
                    const dx = x - p.x;
                    const dy = y - p.y;
                    if (dx * dx + dy * dy < gap * gap - EPS) return false;
                }
            }
        }
        return true;
    };

    const outsideRing = (x, y, art) => {
        const dx = x - hall.x;
        const dy = y - hall.y;
        const reach = HALL_CLEARING + art;
        return dx * dx + dy * dy >= reach * reach;
    };

    /**
     * `loose`: only the game's own gap, not the comfortable one (the last resort); `scale`: a
     * grove's tighter gap between nodes. A node brings its own ground to its cell, so it is judged
     * on its biome's terrain and may not share a cell with a node of another; a camp or treasure is
     * judged on the ground already there.
     */
    const legal = (item, x, y, loose = false, scale = 1) => {
        const body = bodyOf(item.typeId);
        if (x < body.art || y < body.art || x > w - body.art || y > h - body.art) return false;
        if (!outsideRing(x, y, body.art)) return false;
        if (item.role === ROLE_CAMP && campBand({ x, y }, body.art, mat) < CAMP_BAND) return false;
        const i = cellAt(x, y);
        // The drawn water as well as the cells: a boat on it, anything dry a little way off it.
        if (drawnAt) {
            const f = drawnAt(x, y);
            if (water[i] === 1 ? f <= 0 : f > -DRY_GAP) return false;
        }
        const coast = isShore(i);
        let here = null;
        if (water[i] === 1) {
            here = TERRAIN.WATER;
        } else if (item.role === ROLE_NODE) {
            here = terrainOf(item.biome);
            const holder = owned.get(i);
            if (holder && holder.terrain !== here) return false;
        }
        if (here !== null && !terrainAllows(item.typeId, here, coast)) return false;
        if (!clearAt(x, y, body, item.role, loose, scale)) return false;
        if (here === null && !terrainAllows(item.typeId, groundAt(x, y).terrain, coast)) return false;
        return !allows || allows(item.typeId, { x, y }, placed) === true;
    };

    /**
     * Whether a Token could stand on the ground under `p`, by its terrain alone: where a grove, a
     * camp or a treasure starts. A node brings its biome's terrain to a dry cell; anything else is
     * judged on the ground already there.
     */
    const groundFits = (item, p) => {
        const i = cellAt(p.x, p.y);
        if (water[i] === 1) return terrainAllows(item.typeId, TERRAIN.WATER, false);
        const terrain = item.role === ROLE_NODE ? terrainOf(item.biome) : groundAt(p.x, p.y).terrain;
        return terrainAllows(item.typeId, terrain, isShore(i));
    };

    const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
    const uniform = (lo, hi) => lo + (hi - lo) * random();
    const onMat = (art) => ({ x: between(Math.ceil(art), Math.floor(w - art)), y: between(Math.ceil(art), Math.floor(h - art)) });
    // A bell of width 1 from three uniform draws (their sum's spread), no trigonometry.
    const bell = () => (random() + random() + random() - 1.5) * 2;

    /** A unit direction, by rejection: a point in the square kept if it lies in the ring. */
    const direction = () => {
        for (let k = 0; k < 32; k++) {
            const x = random() * 2 - 1;
            const y = random() * 2 - 1;
            const d = x * x + y * y;
            if (d > 0.04 && d <= 1) {
                const l = Math.sqrt(d);
                return { x: x / l, y: y / l };
            }
        }
        return { x: 1, y: 0 };
    };

    /** A whole-unit point between `lo` and `hi` from `(cx, cy)`, by rejection: no trigonometry. */
    const around = (cx, cy, lo, hi) => {
        for (let tries = 0; tries < 16; tries++) {
            const dx = (random() * 2 - 1) * hi;
            const dy = (random() * 2 - 1) * hi;
            const d2 = dx * dx + dy * dy;
            if (d2 >= lo * lo && d2 <= hi * hi) return { x: Math.round(cx + dx), y: Math.round(cy + dy) };
        }
        return null;
    };

    /** Of `draws` accepted random points, the one furthest from everything in `from`; else `none`. */
    const roomiest = (art, draws, accept, from, none = { x: hall.x, y: hall.y }) => {
        let best = null;
        let bestScore = -1;
        let accepted = 0;
        for (let tries = 0; accepted < draws && tries < draws * 40; tries++) {
            const p = onMat(art);
            if (!accept(p)) continue;
            accepted++;
            let score = Infinity;
            for (const a of from) {
                const dx = p.x - a.x;
                const dy = p.y - a.y;
                score = Math.min(score, dx * dx + dy * dy);
            }
            if (score > bestScore) {
                best = p;
                bestScore = score;
            }
        }
        return best || none;
    };

    /** Whether `p` is at least `d` from every Token placed or held. */
    const clearOf = (p, d) => {
        const d2 = d * d;
        for (const list of [placed, held]) {
            for (const q of list) {
                const dx = p.x - q.x;
                const dy = p.y - q.y;
                if (dx * dx + dy * dy < d2) return false;
            }
        }
        return true;
    };

    /**
     * The nearest legal grid spot to `anchor`, walking out in square rings and stopping once no
     * further ring can hold anything nearer.
     */
    const scan = (item, anchor, loose) => {
        const { art } = bodyOf(item.typeId);
        const x0 = Math.ceil(art);
        const y0 = Math.ceil(art);
        const iMax = Math.floor((Math.floor(w - art) - x0) / SCAN_STEP);
        const jMax = Math.floor((Math.floor(h - art) - y0) / SCAN_STEP);
        if (iMax < 0 || jMax < 0) return null;
        const ci = Math.min(iMax, Math.max(0, Math.round((anchor.x - x0) / SCAN_STEP)));
        const cj = Math.min(jMax, Math.max(0, Math.round((anchor.y - y0) / SCAN_STEP)));
        let best = null;
        let bestD = Infinity;
        const tryAt = (i, j) => {
            if (i < 0 || j < 0 || i > iMax || j > jMax) return;
            const x = x0 + i * SCAN_STEP;
            const y = y0 + j * SCAN_STEP;
            const dx = x - anchor.x;
            const dy = y - anchor.y;
            const d = dx * dx + dy * dy;
            if (d < bestD && legal(item, x, y, loose)) {
                best = { x, y };
                bestD = d;
            }
        };
        const kMax = Math.max(ci, iMax - ci, cj, jMax - cj);
        for (let k = 0; k <= kMax; k++) {
            const near = (k - 1) * SCAN_STEP;
            if (best && near > 0 && bestD <= near * near) break;
            if (k === 0) { tryAt(ci, cj); continue; }
            for (let i = ci - k; i <= ci + k; i++) { tryAt(i, cj - k); tryAt(i, cj + k); }
            for (let j = cj - k + 1; j <= cj + k - 1; j++) { tryAt(ci - k, j); tryAt(ci + k, j); }
        }
        return best;
    };

    /**
     * A spot for `item` as near `anchor` as the grove allows, else anywhere legal, else null. A
     * grove on the shore also leans towards the water, so it lines the beach.
     */
    const spotNear = (item, anchor, members, onShore = false) => {
        if (!members.length && legal(item, anchor.x, anchor.y)) return { x: anchor.x, y: anchor.y };
        const body = bodyOf(item.typeId);
        const gap = prefGap(body, item.role, body, item.role);
        for (let round = 0; round < GROW_ROUNDS; round++) {
            const reach = gap * (1.6 + 0.8 * round);
            let best = null;
            let bestScore = Infinity;
            for (let k = 0; k < GROW_DRAWS; k++) {
                const from = members.length ? members[Math.floor(random() * members.length)] : anchor;
                const p = around(from.x, from.y, members.length ? gap : 0, reach);
                if (!p || !legal(item, p.x, p.y)) continue;
                const dx = p.x - anchor.x;
                const dy = p.y - anchor.y;
                const inland = onShore ? seaShore[cellAt(p.x, p.y)] * TERRAIN_CELL : 0;
                // A little jitter, so a grove's edge is ragged rather than a perfect disc.
                const score = (dx * dx + dy * dy + SHORE_PULL * inland * inland) * (0.8 + 0.4 * random());
                if (score < bestScore) {
                    best = p;
                    bestScore = score;
                }
            }
            if (best) return best;
        }
        return scan(item, anchor, false) || scan(item, anchor, true);
    };

    const nodes = [];
    const unplaced = [];
    const place = (item, spot) => {
        if (!spot) {
            unplaced.push({ typeId: item.typeId, role: item.role, order: item.order });
            return null;
        }
        let under;
        if (item.role === ROLE_NODE) {
            // A node in the water (a boat) keeps this too: its own cell stays water (every reader
            // asks `water` first), and the dry cells round it follow it like any node's.
            under = { terrain: terrainOf(item.biome), biome: item.biome };
            owned.set(cellAt(spot.x, spot.y), under);
            let k = marks.length;
            while (k > 0 && marks[k - 1].order > item.order) k--;
            marks.splice(k, 0, { x: spot.x, y: spot.y, ...under, order: item.order });
        } else {
            under = groundAt(spot.x, spot.y);
        }
        const record = { typeId: item.typeId, role: item.role, biome: under.biome, x: spot.x, y: spot.y, body: bodyOf(item.typeId), order: item.order };
        put(record);
        nodes.push(record);
        return record;
    };

    put({ typeId: hallTypeId, role: 'hall', x: hall.x, y: hall.y, body: hallBody });

    // Each node species, with what it prefers. A rare species is one the budget gives only one or
    // two of beside a species it gives more of: a map's next tier.
    const kindOf = (typeId) => {
        const kind = affinity ? affinity(typeId) : null;
        return KINDS.includes(kind) ? kind : null;
    };
    const regionHas = (terrain) => mainGround.terrain === terrain || Object.values(ground.terrains).includes(terrain);
    const groups = speciesOf(items);
    const most = groups.reduce((n, s) => Math.max(n, s.items.length), 0);
    const species = groups.map(s => {
        const body = bodyOf(s.typeId);
        const terrain = terrainOf(s.biome);
        const kind = kindOf(s.typeId);
        // Ore and stone whose own ground is not rock lean to rock ground; trees on rock to grass.
        let leans = null;
        if (kind === AFFINITY.ROCK && terrain !== TERRAIN.ROCK && regionHas(TERRAIN.ROCK)) leans = TERRAIN.ROCK;
        if (kind === AFFINITY.GRASS && terrain === TERRAIN.ROCK && regionHas(TERRAIN.GRASS)) leans = TERRAIN.GRASS;
        return {
            ...s, body, terrain, kind, leans,
            gap: prefGap(body, ROLE_NODE, body, ROLE_NODE),
            onShore: Boolean(seaShore && shoreBiomes.has(s.biome)),
            rare: s.items.length <= RARE_COUNT && most > RARE_COUNT,
            byWater: kind === AFFINITY.WATER && nearWater !== null,
            queue: s.items.slice()
        };
    });

    // A treasure's island, kept before anything else can stand on it.
    const treasurePlans = items.filter(it => it.role === ROLE_TREASURE).map(item => ({ item, held: null }));
    if (treasurePlans.length && drawnAt) {
        const isles = islandSpots(cells, water, cellAt(hall.x, hall.y), drawnAt);
        let next = 0;
        for (const plan of treasurePlans) {
            if (next >= isles.length) break;
            const spot = isles[next].find(p => legal(plan.item, p.x, p.y));
            if (!spot) continue;
            next++;
            plan.held = hold({ typeId: plan.item.typeId, role: ROLE_TREASURE, x: spot.x, y: spot.y, body: bodyOf(plan.item.typeId) });
        }
    }

    // Each camp's nook, and a grove wrapped round the side of it facing the Hall.
    const wrapRank = (s) => (s.kind === AFFINITY.GRASS ? 0 : s.kind === AFFINITY.WATER ? 2 : 1);
    const wrapSpecies = () => {
        let best = null;
        for (const s of species) {
            if (s.onShore || s.rare || s.queue.length < WRAP_MIN) continue;
            if (!best || wrapRank(s) < wrapRank(best) || (wrapRank(s) === wrapRank(best) && s.queue.length > best.queue.length)) best = s;
        }
        return best;
    };
    const wrapCamp = (camp) => {
        const s = wrapSpecies();
        if (!s) return;
        const want = Math.min(s.queue.length, between(WRAP_SIZE[0], WRAP_SIZE[1]));
        const tx = hall.x - camp.x;
        const ty = hall.y - camp.y;
        const l = Math.sqrt(tx * tx + ty * ty) || 1;
        const ux = tx / l;
        const uy = ty / l;
        const side = random() < 0.5 ? 1 : -1;
        const r0 = prefGap(camp.body, ROLE_CAMP, s.body, ROLE_NODE);
        // Row by row, so the second row fills the gaps the first leaves: a crescent two trees deep.
        let got = 0;
        for (const f of WRAP_REACH) {
            for (const [c, sn] of ARC) {
                if (got >= want) return;
                const x = Math.round(camp.x + (ux * c - uy * sn * side) * r0 * f);
                const y = Math.round(camp.y + (ux * sn * side + uy * c) * r0 * f);
                if (!legal(s.queue[0], x, y, false, TIGHT)) continue;
                place(s.queue.shift(), { x, y });
                got++;
            }
        }
    };
    const campPlans = [];
    for (const item of items.filter(it => it.role === ROLE_CAMP)) {
        const body = bodyOf(item.typeId);
        const nook = (p) => {
            const band = campBand(p, body.art, mat);
            return band >= NOOK_BAND[0] && band <= NOOK_BAND[1] && legal(item, p.x, p.y);
        };
        const spot = roomiest(body.art, CAMP_DRAWS, nook, campPlans.filter(c => c.held).map(c => c.held), null);
        const plan = { item, held: spot ? hold({ typeId: item.typeId, role: ROLE_CAMP, x: spot.x, y: spot.y, body }) : null };
        campPlans.push(plan);
        if (plan.held) wrapCamp(plan.held);
    }

    /**
     * Where a species' grove (or a straggler, with `check` its legality) may start, by its
     * preferences: the edge for a rare one, inland water for a water kind, the ground it leans to.
     * Each gives way, the last first, when no spot has it; null when none fits at all.
     */
    const groveSpot = (s, apart, check = null) => {
        const { art } = s.body;
        const tests = [];
        if (s.rare) tests.push({ rare: true, ok: p => campBand(p, art, mat) >= RARE_BAND });
        if (s.byWater) tests.push({ water: true, ok: p => { const d = nearWater[cellAt(p.x, p.y)]; return d >= 1 && d <= NEAR_WATER; } });
        if (s.leans) tests.push({ ok: p => groundAt(p.x, p.y).terrain === s.leans });
        for (let keep = tests.length; keep >= 0; keep--) {
            const kept = tests.slice(0, keep);
            for (const step of APART_STEPS) {
                const d = apart * step * s.gap;
                for (let k = 0; k < CENTRE_DRAWS; k++) {
                    const p = onMat(art);
                    if (!outsideRing(p.x, p.y, art) || !groundFits(s.items[0], p)) continue;
                    if (s.onShore && seaShore[cellAt(p.x, p.y)] > SHORE_CELLS) continue;
                    if (!kept.every(t => t.ok(p)) || !clearOf(p, d)) continue;
                    if (check && !check(p)) continue;
                    return { x: p.x, y: p.y, rare: kept.some(t => t.rare), water: kept.some(t => t.water) };
                }
            }
        }
        return null;
    };

    /** Today's way to a grove's middle when no spot is clear enough: the roomiest. */
    const roomiestFor = (s) => roomiest(s.body.art, GROVE_DRAWS, p => outsideRing(p.x, p.y, s.body.art) && groundFits(s.items[0], p)
        && (!s.onShore || seaShore[cellAt(p.x, p.y)] <= SHORE_CELLS), [...placed, ...held]);

    /** What a grove's members keep to, by what its middle kept to. */
    const keepTest = (s, centre) => {
        const tests = [];
        if (centre.rare) tests.push((x, y) => campBand({ x, y }, s.body.art, mat) >= RARE_KEEP);
        if (centre.water) tests.push((x, y) => nearWater[cellAt(x, y)] <= NEAR_WATER);
        if (s.onShore) tests.push((x, y) => seaShore[cellAt(x, y)] <= SHORE_CELLS + 1);
        return (x, y) => tests.every(t => t(x, y));
    };

    /** A grove: a stretched bell round its middle, tight in the middle and looser at the rim. */
    const grow = (s, list, centre) => {
        const sig = s.gap * uniform(GROVE_SPREAD[0], GROVE_SPREAD[1]) * Math.sqrt(list.length / GROVE_MEAN);
        const stretch = uniform(GROVE_STRETCH[0], GROVE_STRETCH[1]);
        const dir = direction();
        const keep = keepTest(s, centre);
        const grown = [];
        for (const item of list) {
            let spot = null;
            for (let t = 0; t < GROW_TRIES && !spot; t++) {
                const a = bell();
                const b = bell();
                const u = a * sig * stretch;
                const v = b * sig;
                const x = Math.round(centre.x + u * dir.x - v * dir.y);
                const y = Math.round(centre.y + u * dir.y + v * dir.x);
                const scale = TIGHT + LOOSE * Math.min(RIM, Math.sqrt(a * a + b * b));
                if (keep(x, y) && legal(item, x, y, false, scale)) spot = { x, y };
            }
            const record = place(item, spot || spotNear(item, centre, grown, s.onShore));
            if (record) grown.push(record);
        }
    };

    // Biggest bodies first, as in any packing: a 2×2 placed last finds only the gaps small Tokens
    // left, which on a dense mat are too small for it. Then shore species, before a forest takes
    // the beach; a rare species before the edge fills; one that leans to another biome's ground
    // after the species that bring it.
    const order = species.slice().sort((a, b) => b.body.art - a.body.art
        || (a.onShore ? 0 : 1) - (b.onShore ? 0 : 1)
        || (a.leans ? 1 : 0) - (b.leans ? 1 : 0)
        || (a.rare ? 0 : 1) - (b.rare ? 0 : 1));
    for (const s of order) {
        const n = s.queue.length;
        const strays = n > STRAY_MIN ? Math.round(n * STRAY_SHARE) : 0;
        let next = 0;
        while (next < n - strays) {
            const size = Math.min(n - strays - next, GROVE_SIZES[Math.floor(random() * GROVE_SIZES.length)]);
            const centre = groveSpot(s, GROVE_APART) || roomiestFor(s);
            grow(s, s.queue.slice(next, next + size), centre);
            next += size;
        }
        for (; next < n; next++) {
            const item = s.queue[next];
            const alone = groveSpot(s, STRAY_APART, p => legal(item, p.x, p.y));
            place(item, alone || spotNear(item, roomiestFor(s), [], s.onShore));
        }
    }

    for (const plan of campPlans) {
        const { item } = plan;
        const { art } = bodyOf(item.typeId);
        let anchor = plan.held;
        if (anchor) release(anchor);
        else anchor = roomiest(art, CAMP_DRAWS, p => campBand(p, art, mat) >= CAMP_BAND && groundFits(item, p), placed);
        place(item, spotNear(item, anchor, []));
    }

    /** The legal spot far from the Hall with the most nodes round it, those nearer the Hall (screening it) counting double. */
    const hidden = (item) => {
        const { art } = bodyOf(item.typeId);
        let best = null;
        let bestScore = -1;
        let bestFar = -1;
        let accepted = 0;
        for (let tries = 0; accepted < HIDE_DRAWS && tries < HIDE_DRAWS * 40; tries++) {
            const p = onMat(art);
            if (campBand(p, art, mat) < HIDE_BAND || !groundFits(item, p) || !legal(item, p.x, p.y)) continue;
            accepted++;
            const far = (p.x - hall.x) * (p.x - hall.x) + (p.y - hall.y) * (p.y - hall.y);
            let score = 0;
            for (const q of placed) {
                if (q.role !== ROLE_NODE) continue;
                const dx = q.x - p.x;
                const dy = q.y - p.y;
                if (dx * dx + dy * dy >= HIDE_REACH * HIDE_REACH) continue;
                score += (q.x - hall.x) * (q.x - hall.x) + (q.y - hall.y) * (q.y - hall.y) < far ? 2 : 1;
            }
            if (score > bestScore || (score === bestScore && far > bestFar)) {
                best = p;
                bestScore = score;
                bestFar = far;
            }
        }
        return best;
    };

    for (const plan of treasurePlans) {
        const { item } = plan;
        if (plan.held) {
            release(plan.held);
            if (legal(item, plan.held.x, plan.held.y)) {
                place(item, { x: plan.held.x, y: plan.held.y });
                continue;
            }
        }
        const spot = hidden(item);
        if (spot) {
            place(item, spot);
            continue;
        }
        const { art } = bodyOf(item.typeId);
        const anchor = roomiest(art, TREASURE_DRAWS, p => outsideRing(p.x, p.y, art) && groundFits(item, p), placed);
        place(item, spotNear(item, anchor, []));
    }

    // The other biomes' small waters, into gaps of their own ground.
    const smalls = Object.entries(ground.small);
    if (smalls.length) {
        const n = cells.cols * cells.rows;
        const biomeAt = new Array(n);
        for (let i = 0; i < n; i++) biomeAt[i] = water[i] ? null : (owned.get(i) || followNodes(cellCentre(cells, i), marks, mainGround)).biome;
        const standing = [{ x: hall.x, y: hall.y }, ...placed];
        const standingCells = new Set(standing.map(p => cellAt(p.x, p.y)));
        for (const [biome, kind] of smalls) {
            const own = [];
            for (let i = 0; i < n; i++) if (biomeAt[i] === biome) own.push(i);
            if (!own.length) continue;
            if (!record) record = emptyWater(random, mat, { x: hall.x, y: hall.y, r: dryReach });
            for (let t = 0; t < SMALL_TRIES; t++) {
                const c = cellCentre(cells, own[Math.floor(random() * own.length)]);
                // Its middle a few cells in from the mat's edge, so it is seen whole.
                if (c.x < SMALL_EDGE || c.y < SMALL_EDGE || c.x > w - SMALL_EDGE || c.y > h - SMALL_EDGE) continue;
                const shape = smallWater(kind, c.x, c.y, random);
                const alone = sampleWater(readWater({ ...record, shapes: [shape] }), cells, TERRAIN_CELL, keepDry);
                if (!smallFits(alone, biome, biomeAt, water, standing, standingCells, cells)) continue;
                const wet = water.reduce((m, v) => m + v, 0) + alone.water.reduce((m, v) => m + v, 0);
                if (wet / n > MAX_WATER_SHARE) continue;
                record.shapes.push(shape);
                for (let i = 0; i < n; i++) {
                    if (!alone.water[i]) continue;
                    water[i] = 1;
                    biomeAt[i] = null;
                }
                break;
            }
        }
        if (!record.shapes.length) record = null;
    }

    const terrains = new Array(cells.cols * cells.rows);
    for (let i = 0; i < terrains.length; i++) {
        terrains[i] = water[i] ? TERRAIN.WATER
            : (owned.get(i) || followNodes(cellCentre(cells, i), marks, mainGround)).terrain;
    }

    const byOrder = (a, b) => a.order - b.order;
    return {
        seed: seed32,
        mat: { w, h },
        hall: { typeId: hallTypeId, x: hall.x, y: hall.y },
        nodes: nodes.sort(byOrder).map(({ typeId, role, biome, x, y }) => ({ typeId, role, biome, x, y })),
        unplaced: unplaced.sort(byOrder).map(({ typeId, role }) => ({ typeId, role })),
        terrain: encodeTerrain(cells, terrains, record)
    };
}

/**
 * Each island the water surrounds, as the points a treasure could stand on there: every point
 * of a 8-unit lattice in its cells that the drawn water leaves dry by {@link DRY_GAP}, the
 * driest (its middle) first. The islands with the driest middles first; none that is too wet.
 */
function islandSpots(cells, water, home, drawnAt) {
    const out = [];
    for (const isle of islandsOf(cells, water, home)) {
        const points = [];
        for (const i of isle) {
            const c = cellCentre(cells, i);
            for (let j = 0; j < 4; j++) {
                for (let k = 0; k < 4; k++) {
                    const x = c.x - 12 + 8 * k;
                    const y = c.y - 12 + 8 * j;
                    const f = drawnAt(x, y);
                    if (f <= -DRY_GAP) points.push({ x, y, f });
                }
            }
        }
        if (!points.length) continue;
        points.sort((a, b) => a.f - b.f);
        out.push(points);
    }
    return out.sort((a, b) => a[0].f - b[0].f);
}

/**
 * Whether a small water, sampled alone, fits where it lies: some cells of its own, every one of
 * them and every point it draws on in its biome's dry ground and two cells clear of other water,
 * and every standing Token's centre off it by the dry gap.
 */
function smallFits(alone, biome, biomeAt, water, standing, standingCells, cells) {
    const { cols, rows } = cells;
    const { f, lattice } = alone.sample;
    const per = lattice.nx / cols;
    let any = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            let drawn = false;
            for (let j = 0; j < per && !drawn; j++) {
                const row = (r * per + j) * lattice.nx + c * per;
                for (let k = 0; k < per; k++) if (f[row + k] > 0) { drawn = true; break; }
            }
            if (!drawn) continue;
            if (biomeAt[i] !== biome || standingCells.has(i)) return false;
            for (let dr = -SMALL_APART; dr <= SMALL_APART; dr++) {
                for (let dc = -SMALL_APART; dc <= SMALL_APART; dc++) {
                    const rr = r + dr;
                    const cc = c + dc;
                    if (rr >= 0 && cc >= 0 && rr < rows && cc < cols && water[rr * cols + cc]) return false;
                }
            }
            if (alone.water[i]) any = true;
        }
    }
    if (!any) return false;
    return standing.every(p => fieldAt(alone.sample, p.x, p.y) <= -DRY_GAP);
}

/** The budget's ground, or none (no water, everything on the default ground) for bare entries. */
function groundOf(summary) {
    const g = Array.isArray(summary) ? null : summary?.ground;
    return {
        main: g?.main ?? null,
        terrains: g?.terrains || {},
        water: Number(g?.water) || 0,
        shore: g?.shore || [],
        inland: Array.isArray(g?.inland) ? g.inland : [],
        small: g?.small && typeof g.small === 'object' ? g.small : {}
    };
}

/** One item per Token to place, nodes, then camps, then treasures, in budget order; `order` its place in that list. */
function expand(summary) {
    const entries = Array.isArray(summary) ? summary : (summary?.entries || []);
    const items = [];
    for (const role of [ROLE_NODE, ROLE_CAMP, ROLE_TREASURE]) {
        for (const e of entries) {
            if (e?.role !== role || !e.typeId) continue;
            const count = Math.max(0, Math.floor(e.count) || 0);
            for (let i = 0; i < count; i++) items.push({ typeId: e.typeId, role, biome: e.biome ?? null, order: items.length });
        }
    }
    return items;
}

/** The node items grouped by species, in the order they first appear. */
function speciesOf(items) {
    const bySpecies = new Map();
    for (const item of items) {
        if (item.role !== ROLE_NODE) continue;
        if (!bySpecies.has(item.typeId)) bySpecies.set(item.typeId, { typeId: item.typeId, biome: item.biome, items: [] });
        bySpecies.get(item.typeId).items.push(item);
    }
    return [...bySpecies.values()];
}
