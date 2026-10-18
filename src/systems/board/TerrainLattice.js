// the ground's pixel map: which terrain at every plan pixel, cell edges wiggled, beaches cut

import { TERRAIN, TERRAIN_CELL } from '../atlas/TerrainMap.js';
import { rasterise, STYLE_TERRAIN } from '../atlas/WaterShapes.js';
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
 * ⚠️ Held under half a cell whatever the slider says: a frontier is drawn relative to one
 * boundary and knows nothing about the cell's opposite side, so two boundaries each displaced by
 * more than half could cross; and `resolveArtPixels` looks for edges only in the cells beside a
 * different cell, which is exact only while a strip stops short of a cell's middle.
 */
export function edgeAmplitude(cellPx = CELL_PX) {
    return Math.max(1, Math.min(Math.ceil(cellPx / 2) - 1, Math.round(cellPx * edgeSwing())));
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
 * Each water cell given the terrain of the nearest dry cell, a diagonal step counting as one (the
 * first reached wins, in cell order): the land the water's shape leaves dry in a water cell.
 */
function dryFilled(cells, cols, rows, wet) {
    const out = cells.slice();
    if (wet < 0) return out;
    const queue = [];
    const done = new Uint8Array(cells.length);
    for (let i = 0; i < cells.length; i++) {
        if (cells[i] !== wet) {
            done[i] = 1;
            queue.push(i);
        }
    }
    for (let head = 0; head < queue.length; head++) {
        const i = queue[head];
        const c = i % cols;
        const r = (i - c) / cols;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nc = c + dc;
                const nr = r + dr;
                if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
                const n = nr * cols + nc;
                if (done[n]) continue;
                done[n] = 1;
                out[n] = out[i];
                queue.push(n);
            }
        }
    }
    return out;
}

/**
 * Which terrain is at every plan pixel, after the cell boundaries have been wiggled and the beach
 * cut: what the shore bands, the wear and the scatter all measure against.
 *
 * A ground with water shapes (`ground.water`, `WaterShapes`) draws its water where they say,
 * at every pixel rather than by the cells: its land first, each water cell taking the ground of
 * the nearest dry one, then the water laid over it in each shape's style (`STYLE_TERRAIN`).
 *
 * @param {object} ground A Region's ground, from `regionGround`.
 * @param {boolean} [withFringes] Whether to cut the beach (a fringe pushed onto the neighbours).
 * @returns {{width: number, height: number, cellPx: number, palette: string[], at: Uint8Array,
 *   present: Uint8Array, fields: object, fringes: Array<{terrainId: string, mask: Uint8Array}>,
 *   water: {f: Float64Array, style: Uint8Array}|null}}
 *   `at` holds an index into `palette` per pixel, row by row; the palette starts as the ground's
 *   own terrains, in order. `present[p]` is 1 when palette entry `p` is on the ground; `fields`
 *   the distance fields measured so far ({@link distanceFields}), for the bands to reuse; `water`
 *   the shapes' field at each pixel (mat units, above 0 in the water) and its style, null when
 *   the ground has no shapes.
 */
export function resolveArtPixels(ground, withFringes = true) {
    const cellPx = cellPxOf(ground);
    const { width, height } = planSize(ground.mat);
    const { cols, rows, terrains, seed } = ground;
    const shapes = ground.water || null;
    const cells = shapes ? dryFilled(ground.cells, cols, rows, terrains.indexOf(TERRAIN.WATER)) : ground.cells;

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

    // Every cell its own terrain: the first pixel row of each row of cells, copied down it.
    for (let cy = 0; cy < rows; cy++) {
        const y0 = cy * cellPx;
        if (y0 >= height) break;
        const y1 = Math.min(height, y0 + cellPx);
        const first = y0 * width;
        for (let cx = 0; cx < cols; cx++) {
            const x0 = cx * cellPx;
            if (x0 >= width) break;
            at.fill(cells[cy * cols + cx], first + x0, first + Math.min(width, x0 + cellPx));
        }
        for (let y = y0 + 1; y < y1; y++) at.copyWithin(y * width, first, first + width);
    }

    // The cells beside a different one, eight ways: the only cells two pixels can differ in,
    // since a strip reaches under half a cell.
    const border = new Uint8Array(cols * rows);
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const here = cells[cy * cols + cx];
            for (let r = Math.max(0, cy - 1); r <= Math.min(rows - 1, cy + 1) && !border[cy * cols + cx]; r++) {
                for (let c = Math.max(0, cx - 1); c <= Math.min(cols - 1, cx + 1); c++) {
                    if (cells[r * cols + c] !== here) { border[cy * cols + cx] = 1; break; }
                }
            }
        }
    }

    // Then the strips where two terrains meet.
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            if (!border[cy * cols + cx]) continue;
            const here = cells[cy * cols + cx];
            for (const axis of ['v', 'h']) {
                const nx = axis === 'v' ? cx + 1 : cx;
                const ny = axis === 'v' ? cy : cy + 1;
                if (nx >= cols || ny >= rows) continue;
                const there = cells[ny * cols + nx];
                if (there === here) continue;
                for (const strip of edgeStrips(cx, cy, axis, terrains[here], terrains[there], seed, cellPx)) {
                    const id = idFor(strip.terrainId);
                    const yEnd = Math.min(height, strip.y + strip.h);
                    const xEnd = Math.min(width, strip.x + strip.w);
                    for (let y = strip.y; y < yEnd; y++) at.fill(id, y * width + strip.x, y * width + Math.max(strip.x, xEnd));
                }
            }
        }
    }

    // Which palette entries some pixel shows: the cells' terrains (a strip only carries a
    // neighbouring cell's), the water's, and whatever a fringe writes.
    const present = new Uint8Array(256);
    for (let i = 0; i < cells.length; i++) present[cells[i]] = 1;
    let water = null;
    if (shapes) {
        water = rasterise(shapes, { x0: PLAN_PIXEL_U / 2, y0: PLAN_PIXEL_U / 2, step: PLAN_PIXEL_U, nx: width, ny: height });
        const ids = STYLE_TERRAIN.map(() => -1);
        const { f, style } = water;
        for (let i = 0; i < at.length; i++) {
            if (!(f[i] > 0)) continue;
            const s = style[i];
            if (ids[s] < 0) {
                ids[s] = idFor(STYLE_TERRAIN[s]);
                present[ids[s]] = 1;
            }
            at[i] = ids[s];
        }
    }
    // ⚠️ The shapes' shores lie anywhere, not only in the cells beside a different one.
    const fields = distanceFields(at, width, height, shapes ? null : { cols, rows, cellPx, border });
    const fringes = withFringes ? applyFringes(at, palette, indexOf, idFor, ground.looks, fields, present) : [];
    return { width, height, cellPx, palette, at, present, fields, fringes, water };
}

const INF = 0x3fff;

/**
 * The bounded walk every distance here comes from: outward from `start` (seeds on the edge of
 * their region) in order of distance, stopping at `limit`, never stepping onto a seed
 * (`members[at[i]] === want`). `dist` holds each reached pixel's distance plus one (0 is not
 * reached, so a fresh zeroed array needs no fill). Returns the reached pixels that are not
 * seeds, each once.
 *
 * ⚠️ Starting from edge seeds only is exact: the last seed on any shortest path has a non-seed
 * side neighbour, or a side neighbour that is itself a seed one step nearer (a diagonal step
 * costs more than a side one). Walking from every seed was most of a coast's build: the
 * shallows' seeds are all the land.
 */
function walk(at, members, want, dist, start, width, height, limit) {
    const buckets = Array.from({ length: limit + 1 }, () => []);
    const reached = [];
    for (const s of start) {
        if (dist[s] === 1) continue;
        dist[s] = 1;
        buckets[0].push(s);
    }
    for (let d = 0; d <= limit; d++) {
        const bucket = buckets[d];
        for (let b = 0; b < bucket.length; b++) {
            const i = bucket[b];
            if (dist[i] !== d + 1) continue;      // superseded since queued
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
                    const was = dist[j];
                    if ((was !== 0 && nd + 1 >= was) || members[at[j]] === want) continue;
                    if (was === 0) reached.push(j);
                    dist[j] = nd + 1;
                    buckets[nd].push(j);
                }
            }
        }
    }
    return reached;
}

/**
 * How far each pixel is from the nearest seed, ×3: the chamfer weights are 3 sideways and 4
 * diagonally, the standard cheap approximation to Euclidean distance. Seeds are 0.
 *
 * @param {Uint8Array} seeds 1 per seed pixel, row by row.
 * @param {number} [maxDist] In the same ×3 units: bounded, it walks outward from the seeds and
 *   stops. Pixels beyond it come back as at least that. Unbounded, two full sweeps.
 * @returns {Int16Array}
 */
export function distanceFromSeeds(seeds, width, height, maxDist = Infinity) {
    const n = width * height;
    if (!Number.isFinite(maxDist)) {
        const dist = new Int16Array(n).fill(INF);
        for (let i = 0; i < n; i++) if (seeds[i]) dist[i] = 0;
        return fullTransform(dist, width, height);
    }
    const flags = new Uint8Array(n);
    for (let i = 0; i < n; i++) flags[i] = seeds[i] ? 1 : 0;
    const start = [];
    for (let y = 0, i = 0; y < height; y++) {
        for (let x = 0; x < width; x++, i++) {
            if (x < width - 1 && flags[i] !== flags[i + 1]) start.push(flags[i] ? i : i + 1);
            if (y < height - 1 && flags[i] !== flags[i + width]) start.push(flags[i] ? i : i + width);
        }
    }
    const dist = new Int16Array(n);
    walk(flags, Uint8Array.of(0, 1), 1, dist, start, width, height, Math.min(INF - 1, Math.ceil(maxDist)));
    for (let i = 0; i < n; i++) dist[i] = flags[i] ? 0 : (dist[i] === 0 ? INF : dist[i] - 1);
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
 * Distance fields over one pixel map, shared by the beach and the bands of one build.
 *
 * `from(set, outside, limit)` measures from every pixel whose palette index is in `set` (or,
 * with `outside`, is not) and returns `{pixels}`: the pixels outside the set nearer than `limit`
 * (chamfer ×3 units), so a caller visits those rather than the whole plan. `distances` with the
 * same arguments returns the field itself, each reached pixel's distance plus one (0 where the walk
 * never reached; it may run past `limit` when an earlier, longer walk is reused, and it is shared,
 * so read it, never write it).
 *
 * Every edge between two terrains is found once, as the pairs of side neighbours that differ,
 * looking only in the cells `cellScan.border` marks (all of them without it); a field starts
 * from the pairs its set splits. The beach and the wet sand both measure from the water, so the
 * second request is the first one again.
 *
 * `rewrote(fromFlags, to, changed)` says the `changed` pixels, of the flagged palette entries,
 * became `to`: fields whose seeds that altered are dropped, and the new edges noted.
 */
export function distanceFields(at, width, height, cellScan = null) {
    const n = width * height;
    const entries = [];
    let edgeA = null;
    let edgeB = null;
    let edges = 0;

    const addEdge = (a, b) => {
        if (edges === edgeA.length) {
            const grownA = new Int32Array(edgeA.length * 2);
            const grownB = new Int32Array(edgeB.length * 2);
            grownA.set(edgeA);
            grownB.set(edgeB);
            edgeA = grownA;
            edgeB = grownB;
        }
        edgeA[edges] = a;
        edgeB[edges] = b;
        edges++;
    };
    const scan = (y, x0, x1) => {
        const last = y === height - 1;
        for (let x = x0, i = y * width + x0; x < x1; x++, i++) {
            const t = at[i];
            if (x < width - 1 && t !== at[i + 1]) addEdge(i, i + 1);
            if (!last && t !== at[i + width]) addEdge(i, i + width);
        }
    };
    const findEdges = () => {
        edgeA = new Int32Array(4096);
        edgeB = new Int32Array(4096);
        if (!cellScan) {
            for (let y = 0; y < height; y++) scan(y, 0, width);
            return;
        }
        const { cols, rows, cellPx, border } = cellScan;
        for (let cy = 0; cy < rows; cy++) {
            const y0 = cy * cellPx;
            const y1 = Math.min(height, y0 + cellPx);
            for (let cx = 0; cx < cols; cx++) {
                if (!border[cy * cols + cx]) continue;
                const x0 = cx * cellPx;
                const x1 = Math.min(width, x0 + cellPx);
                for (let y = y0; y < y1; y++) scan(y, x0, x1);
            }
        }
    };
    const isSeed = (e, t) => e.outside !== e.set.has(t);
    const within = (e, limit) => {
        const out = [];
        for (const i of e.reached) if (e.dist[i] - 1 < limit) out.push(i);
        return { pixels: out };
    };

    const entryFor = (set, outside, limit) => {
        const key = `${outside ? '!' : ''}${[...set].sort((a, b) => a - b).join(',')}`;
        const hit = entries.find(e => e.key === key && e.limit >= limit);
        if (hit) return hit;
        if (!edgeA) findEdges();
        const members = new Uint8Array(256);
        for (const t of set) members[t] = 1;
        const want = outside ? 0 : 1;
        const start = [];
        for (let k = 0; k < edges; k++) {
            const a = edgeA[k];
            const b = edgeB[k];
            const seedA = members[at[a]] === want;
            if (seedA !== (members[at[b]] === want)) start.push(seedA ? a : b);
        }
        const dist = new Int16Array(n);
        const reached = walk(at, members, want, dist, start, width, height, Math.min(INF - 1, Math.ceil(limit)));
        const entry = { key, set: new Set(set), outside, limit, dist, reached };
        entries.push(entry);
        return entry;
    };

    return {
        from(set, outside, limit) {
            return within(entryFor(set, outside, limit), limit);
        },
        /** {@link from}'s field alone, for a caller that reads it by pixel rather than visiting a list. */
        distances(set, outside, limit) {
            return entryFor(set, outside, limit).dist;
        },
        rewrote(fromFlags, to, changed) {
            for (let k = entries.length - 1; k >= 0; k--) {
                const e = entries[k];
                for (let t = 0; t < fromFlags.length; t++) {
                    if (fromFlags[t] && isSeed(e, t) !== isSeed(e, to)) { entries.splice(k, 1); break; }
                }
            }
            if (!edgeA) return;
            // Edges that stopped being edges are skipped when a field reads them; new ones can
            // only lie beside a changed pixel.
            for (const i of changed) {
                const x = i % width;
                if (x > 0 && at[i - 1] !== at[i]) addEdge(i - 1, i);
                if (x < width - 1 && at[i + 1] !== at[i]) addEdge(i, i + 1);
                if (i >= width && at[i - width] !== at[i]) addEdge(i - width, i);
                if (i + width < n && at[i + width] !== at[i]) addEdge(i, i + width);
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
 * Mutates `at` (and `present`) and returns what each fringe changed.
 */
function applyFringes(at, palette, indexOf, idFor, looks, fields, present) {
    const changed = [];
    const sources = palette.length;
    for (let source = 0; source < sources; source++) {
        if (!present[source]) continue;
        const fringe = fringeOf(looks[palette[source]]);
        if (!fringe) continue;
        const pixels = tuning(fringe.widthTuning) / PLAN_PIXEL_U;
        if (!(pixels > 0)) continue;

        const { pixels: near } = fields.from([source], false, pixels * 3);
        const spared = new Uint8Array(256);
        for (const id of fringe.except || []) if (indexOf.has(id)) spared[indexOf.get(id)] = 1;
        const existing = indexOf.get(fringe.terrain);
        const fromFlags = new Uint8Array(256);
        const written = [];
        // ⚠️ The target is claimed on the first write, so a fringe that writes nothing adds no
        // terrain to the palette.
        let target = -1;
        for (const i of near) {
            const here = at[i];
            if (here === existing || spared[here]) continue;
            if (target < 0) target = idFor(fringe.terrain);
            fromFlags[here] = 1;
            at[i] = target;
            written.push(i);
        }
        if (target < 0) continue;
        present[target] = 1;
        fields.rewrote(fromFlags, target, written);
        const mask = new Uint8Array(at.length);
        for (const i of written) mask[i] = 1;
        changed.push({ terrainId: fringe.terrain, mask });
    }
    return changed;
}
