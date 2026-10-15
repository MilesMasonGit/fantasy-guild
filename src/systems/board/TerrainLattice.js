// the ground's pixel map: which terrain at every plan pixel, cell edges wiggled, beaches cut

import { TERRAIN_CELL } from '../atlas/TerrainMap.js';
import { fringeOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * The ground plan is built at one pixel per 2 mat units, whatever the window: a ground pixel is
 * then a Token pixel at the shipped scale (a 64-pixel Token is 128 units). A 32-unit terrain cell
 * is 16 plan pixels, one 16-pixel ground art piece.
 *
 * Pure arithmetic over a Region's ground (`regionGround`), no game state, no React: the same
 * ground and seed give the same pixels on every build.
 */

/** Mat units in one plan pixel. */
export const PLAN_PIXEL_U = 2;

/** Plan pixels across one terrain cell. */
export const CELL_PX = TERRAIN_CELL / PLAN_PIXEL_U;

/** The plan's size for a mat: whole pixels, the last row and column covering the mat's edge. */
export function planSize(mat) {
    return { width: Math.ceil(mat.w / PLAN_PIXEL_U), height: Math.ceil(mat.h / PLAN_PIXEL_U) };
}

/**
 * A stable pseudo-random number in [0, 1) from a handful of integers.
 *
 * Deliberately not `Math.random`: the same pixel must come out the same on every build and every
 * load, or the ground would shimmer as you played and come back different after a save.
 */
export function hash01(...values) {
    let h = 0x811c9dc5;
    for (const value of values) {
        h ^= (value | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2);
        h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
        h ^= h >>> 12;
    }
    return ((h >>> 0) % 100000) / 100000;
}

/**
 * The two dials that decide how a coastline reads, both as a share of a cell, so the shape stays
 * the same whatever the pixel size and only how finely it is cut changes.
 *
 * `edgeSwing` is how far the frontier travels from the cell line, the scale of the bays and
 * headlands. `edgeRoughness` is how spiky it is between its pinned ends.
 *
 * ⚠️ The shipped values (0.3125 / 0.070) are the owner's middle ground between too jagged
 * (0.3125 / 0.1125) and too calm (0.25 / 0.055); not a simple average.
 */
const edgeSwing = () => tuning('edgeSwing');
const edgeRoughness = () => tuning('edgeRoughness');

/**
 * How far, in pixels, a terrain may push across a cell boundary.
 *
 * ⚠️ Kept under half a cell: a frontier is drawn relative to one boundary and knows nothing about
 * the cell's opposite side, so two boundaries each displaced by more than half could cross.
 */
export function edgeAmplitude(cellPx = CELL_PX) {
    return Math.max(1, Math.round(cellPx * edgeSwing()));
}

/**
 * Where two neighbouring cells actually divide, rather than where the grid says they do.
 *
 * Returns one signed displacement per pixel along the boundary. Positive pushes the first cell's
 * terrain into the second; negative pulls the second into the first.
 *
 * ⚠️ Why the ends are pinned, and to what: a coastline crossing from one boundary segment into the
 * next steps if each segment wandered off on its own. So a segment's endpoints are properties of
 * the junction, not of the segment: both boundaries meeting at a junction read the same hash of
 * that junction's coordinates and agree without knowing about each other. The depth varies per
 * junction, or the coast reads as a scalloped fringe.
 *
 * @param {number} cx Column of the first cell.
 * @param {number} cy Row of the first cell.
 * @param {'v'|'h'} axis 'v' for the boundary with the cell to the right, 'h' with the cell below.
 * @param {number} seed The Region's seed.
 * @returns {number[]} One signed displacement per pixel, in pixels.
 */
export function edgeProfile(cx, cy, axis, seed, cellPx = CELL_PX) {
    const endJunction = axis === 'v' ? [cx, cy + 1] : [cx + 1, cy];
    const amplitude = edgeAmplitude(cellPx);
    const wobble = cellPx * edgeRoughness();

    const depthAt = ([jx, jy]) =>
        Math.round((hash01(jx, jy, axis === 'v' ? 0x11 : 0x22, seed) * 2 - 1) * amplitude);

    const from = depthAt([cx, cy]);
    const to = depthAt(endJunction);

    const out = new Array(cellPx);
    for (let i = 0; i < cellPx; i++) {
        // ⚠️ `i / (N - 1)`, not `(i + 0.5) / N`: the first and last samples land exactly on the two
        // junction depths, which makes the seam guarantee structural rather than a rounding hope.
        const t = i / (cellPx - 1);
        const base = from + (to - from) * t;
        // A little wander so the run between two junctions is not a straight ramp, tapered to
        // nothing at both ends so neighbouring segments still meet exactly.
        const taper = Math.sin(Math.PI * t);
        const wander = (hash01(cx, cy, i, seed) * 2 - 1) * wobble * taper;
        const value = Math.max(-amplitude, Math.min(amplitude, Math.round(base + wander)));
        // `Math.round(-0.4)` is `-0`; normalised so "no displacement" is one value.
        out[i] = value === 0 ? 0 : value;
    }
    return out;
}

/**
 * The strips of one terrain that spill across a boundary into its neighbour: the edge geometry,
 * as data so it can be tested. Each strip says where it is (`x`, `y`, `w`, `h`, in plan pixels),
 * which terrain it carries and which cell it is painted into (`intoCx`, `intoCy`).
 *
 * @returns {Array<{x:number,y:number,w:number,h:number,terrainId:string,intoCx:number,intoCy:number}>}
 */
export function edgeStrips(cx, cy, axis, here, there, seed = 0, cellPx = CELL_PX) {
    if (!here || !there || here === there) return [];

    const profile = edgeProfile(cx, cy, axis, seed, cellPx);
    const vertical = axis === 'v';
    const nextCx = vertical ? cx + 1 : cx;
    const nextCy = vertical ? cy : cy + 1;
    const boundary = (vertical ? cx + 1 : cy + 1) * cellPx;

    const out = [];
    for (let i = 0; i < cellPx; i++) {
        const push = profile[i];
        if (push === 0) continue;
        // Positive: `here` spills forward into `there`'s cell. Negative: `there` reaches back
        // into `here`'s. Either way the strip is painted into the loser.
        const forward = push > 0;
        const depth = Math.abs(push);
        const from = forward ? boundary : boundary - depth;
        out.push({
            x: vertical ? from : cx * cellPx + i,
            y: vertical ? cy * cellPx + i : from,
            w: vertical ? depth : 1,
            h: vertical ? 1 : depth,
            terrainId: forward ? here : there,
            intoCx: forward ? nextCx : cx,
            intoCy: forward ? nextCy : cy
        });
    }
    return out;
}

/** Plan pixels in one of the ground's cells. */
export function cellPxOf(ground) {
    const px = ground.cell / PLAN_PIXEL_U;
    if (!Number.isInteger(px) || px < 2) throw new RangeError(`a ${ground.cell}-unit cell is not a whole number of plan pixels`);
    return px;
}

/**
 * Which terrain is at every plan pixel, after the cell boundaries have been wiggled and the beach
 * cut: what the shore bands, the wear and the scatter all measure against.
 *
 * @param {object} ground A Region's ground, from `regionGround`.
 * @param {boolean} [withFringes] Whether to cut the beach (a fringe pushed onto the neighbours).
 * @returns {{width: number, height: number, cellPx: number, palette: string[], at: Uint8Array,
 *   present: Uint8Array, fields: object, fringes: Array<{terrainId: string, mask: Uint8Array}>}}
 *   `at` holds an index into `palette` per pixel, row by row; the palette starts as the ground's
 *   own terrains, in order. `present` is 1 per palette entry some pixel shows; `fields` the
 *   distance fields measured so far ({@link distanceFields}), for the bands to reuse.
 */
export function resolveArtPixels(ground, withFringes = true) {
    const cellPx = cellPxOf(ground);
    const { width, height } = planSize(ground.mat);
    const { cols, rows, cells, terrains, seed } = ground;

    const palette = [...terrains];
    const indexOf = new Map(palette.map((t, i) => [t, i]));
    const idFor = (terrainId) => {
        let i = indexOf.get(terrainId);
        if (i === undefined) {
            i = palette.length;
            palette.push(terrainId);
            indexOf.set(terrainId, i);
        }
        return i;
    };

    const at = new Uint8Array(width * height);

    // Every cell its own terrain first.
    for (let cy = 0; cy < rows; cy++) {
        const y0 = cy * cellPx;
        if (y0 >= height) break;
        const y1 = Math.min(height, y0 + cellPx);
        for (let cx = 0; cx < cols; cx++) {
            const x0 = cx * cellPx;
            if (x0 >= width) break;
            const x1 = Math.min(width, x0 + cellPx);
            const id = cells[cy * cols + cx];
            for (let y = y0; y < y1; y++) at.fill(id, y * width + x0, y * width + x1);
        }
    }

    // Then the strips where two terrains meet.
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const here = terrains[cells[cy * cols + cx]];
            for (const axis of ['v', 'h']) {
                const nx = axis === 'v' ? cx + 1 : cx;
                const ny = axis === 'v' ? cy : cy + 1;
                if (nx >= cols || ny >= rows) continue;
                const there = terrains[cells[ny * cols + nx]];
                if (there === here) continue;
                for (const strip of edgeStrips(cx, cy, axis, here, there, seed, cellPx)) {
                    const id = idFor(strip.terrainId);
                    const yEnd = Math.min(height, strip.y + strip.h);
                    const xEnd = Math.min(width, strip.x + strip.w);
                    for (let y = strip.y; y < yEnd; y++) at.fill(id, y * width + strip.x, y * width + Math.max(strip.x, xEnd));
                }
            }
        }
    }

    const fields = distanceFields(at, width, height);
    const fringes = withFringes ? applyFringes(at, palette, indexOf, idFor, ground.looks, fields) : [];
    const present = new Uint8Array(palette.length);
    for (let i = 0; i < at.length; i++) present[at[i]] = 1;
    return { width, height, cellPx, palette, at, present, fields, fringes };
}

const INF = 0x3fff;

/**
 * How far each pixel is from the nearest seed, ×3: the chamfer weights are 3 sideways and 4
 * diagonally, the standard cheap approximation to Euclidean distance.
 *
 * ⚠️ Pass `maxDist` whenever you have one. Bounded, it walks outward from the seeds and stops,
 * touching only the band asked about; and it starts only from seeds with a non-seed neighbour,
 * since the last seed on any shortest path is one of those. The shallows' seeds are all the land,
 * almost every pixel, and walking from each of them was most of a coast's build.
 *
 * @param {Uint8Array} seeds 1 per seed pixel, row by row.
 * @param {number} [maxDist] In the same ×3 units. Pixels beyond it come back as at least that.
 * @returns {Int16Array}
 */
export function distanceFromSeeds(seeds, width, height, maxDist = Infinity) {
    const n = width * height;
    const dist = new Int16Array(n);
    let seedCount = 0;
    for (let i = 0; i < n; i++) {
        if (seeds[i]) seedCount++;
        else dist[i] = INF;
    }
    if (!Number.isFinite(maxDist)) return fullTransform(dist, width, height);

    const limit = Math.min(INF - 1, Math.ceil(maxDist));
    const buckets = Array.from({ length: limit + 1 }, () => []);
    const start = buckets[0];
    // The seeds on the edge of their region, found from whichever side is smaller: each seed
    // with a non-seed neighbour, or each seed beside a non-seed (queued once).
    const fromSeeds = seedCount * 2 <= n;
    const queued = fromSeeds ? null : new Uint8Array(n);
    for (let y = 0; y < height; y++) {
        const y0 = y > 0 ? -1 : 0;
        const y1 = y < height - 1 ? 1 : 0;
        for (let x = 0, i = y * width; x < width; x++, i++) {
            if (fromSeeds !== Boolean(seeds[i])) continue;
            const x0 = x > 0 ? -1 : 0;
            const x1 = x < width - 1 ? 1 : 0;
            let found = false;
            for (let dy = y0; dy <= y1 && !found; dy++) {
                const row = i + dy * width;
                for (let dx = x0; dx <= x1; dx++) {
                    const j = row + dx;
                    if (fromSeeds) {
                        if (!seeds[j]) { found = true; break; }
                    } else if (seeds[j] && !queued[j]) {
                        queued[j] = 1;
                        start.push(j);
                    }
                }
            }
            if (found) start.push(i);
        }
    }
    for (let d = 0; d <= limit; d++) {
        const bucket = buckets[d];
        for (let b = 0; b < bucket.length; b++) {
            const i = bucket[b];
            if (dist[i] !== d) continue;          // superseded since queued
            const x = i % width;
            const y = (i - x) / width;
            for (let dy = -1; dy <= 1; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= height) continue;
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const nx = x + dx;
                    if (nx < 0 || nx >= width) continue;
                    const nd = d + (dx && dy ? 4 : 3);
                    if (nd > limit) continue;
                    const j = ny * width + nx;
                    if (nd < dist[j]) { dist[j] = nd; buckets[nd].push(j); }
                }
            }
        }
    }
    return dist;
}

/** The unbounded two-pass chamfer transform, from `dist` already 0 on the seeds and INF elsewhere. */
function fullTransform(dist, width, height) {
    const relax = (i, j, cost) => {
        const d = dist[j] + cost;
        if (d < dist[i]) dist[i] = d;
    };
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (x > 0) relax(i, i - 1, 3);
            if (y > 0) relax(i, i - width, 3);
            if (x > 0 && y > 0) relax(i, i - width - 1, 4);
            if (x < width - 1 && y > 0) relax(i, i - width + 1, 4);
        }
    }
    for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
            const i = y * width + x;
            if (x < width - 1) relax(i, i + 1, 3);
            if (y < height - 1) relax(i, i + width, 3);
            if (x < width - 1 && y < height - 1) relax(i, i + width + 1, 4);
            if (x > 0 && y < height - 1) relax(i, i + width - 1, 4);
        }
    }
    return dist;
}

/**
 * Distance fields over one pixel map, shared by the beach and the bands of one build: the beach
 * and the wet sand both measure from the water, and the second measurement is the first again.
 *
 * `from(set, outside, limit)` is the distance (×3, bounded) from every pixel whose palette index
 * is in `set` (or, with `outside`, is not). `rewrote(fromFlags, to)` says pixels of the flagged
 * palette entries became `to`, and drops every field whose seeds that changed.
 */
export function distanceFields(at, width, height) {
    const entries = [];
    const isSeed = (e, t) => e.outside !== e.set.has(t);
    return {
        from(set, outside, limit) {
            const key = `${outside ? '!' : ''}${[...set].sort((a, b) => a - b).join(',')}`;
            const hit = entries.find(e => e.key === key && e.limit >= limit);
            if (hit) return hit.dist;
            const members = new Uint8Array(256);
            for (const t of set) members[t] = 1;
            const want = outside ? 0 : 1;
            const seeds = new Uint8Array(at.length);
            for (let i = 0; i < at.length; i++) if (members[at[i]] === want) seeds[i] = 1;
            const dist = distanceFromSeeds(seeds, width, height, limit);
            entries.push({ key, set: new Set(set), outside, limit, dist });
            return dist;
        },
        rewrote(fromFlags, to) {
            for (let k = entries.length - 1; k >= 0; k--) {
                const e = entries[k];
                for (let t = 0; t < fromFlags.length; t++) {
                    if (fromFlags[t] && isSeed(e, t) !== isSeed(e, to)) { entries.splice(k, 1); break; }
                }
            }
        }
    };
}

/**
 * Push a terrain's fringe out onto its neighbours: the beach the sea cuts into the land.
 *
 * ⚠️ The opposite direction to a band. A band shades a terrain's own edge; a fringe writes a
 * **different terrain** onto the ground beside it. Rewriting the map rather than drawing sand
 * over the top is what makes everything downstream behave: the wet sand sees real shore, the
 * forest's earth stops at it, and nothing of the forest's scatter stands on it.
 *
 * Mutates `at` and returns what each fringe changed.
 */
function applyFringes(at, palette, indexOf, idFor, looks, fields) {
    const changed = [];
    const sources = palette.length;
    for (let source = 0; source < sources; source++) {
        const fringe = fringeOf(looks[palette[source]]);
        if (!fringe) continue;
        const pixels = tuning(fringe.widthTuning) / PLAN_PIXEL_U;
        if (!(pixels > 0)) continue;

        const limit = pixels * 3;
        const dist = fields.from([source], false, limit);
        const spared = new Uint8Array(256);
        for (const id of fringe.except || []) if (indexOf.has(id)) spared[indexOf.get(id)] = 1;
        const existing = indexOf.get(fringe.terrain);
        const mask = new Uint8Array(at.length);
        const fromFlags = new Uint8Array(256);
        // ⚠️ The target is claimed on the first write, so a fringe that writes nothing adds no
        // terrain to the palette.
        let target = -1;
        for (let i = 0; i < at.length; i++) {
            if (dist[i] >= limit) continue;
            const here = at[i];
            if (here === source || here === existing || spared[here]) continue;
            if (target < 0) target = idFor(fringe.terrain);
            fromFlags[here] = 1;
            at[i] = target;
            mask[i] = 1;
        }
        if (target >= 0) {
            fields.rewrote(fromFlags, target);
            changed.push({ terrainId: fringe.terrain, mask });
        }
    }
    return changed;
}
