// water as shapes on the mat: lakes, ponds, tarns, rivers, sulphur springs and the edge sea

/**
 * A Region's water is a handful of shapes in mat units, made with its layout from its seed
 * ({@link planWater}) and stored with its terrain map (`TerrainMap.encodeTerrain`), so a loaded
 * save draws the same water. Each shape is a field over the mat, above 0 inside the water and
 * about the distance to its shore near it; the water is wherever the largest field is above 0.
 * The shapes are the owner's settled world rounds (`docs/active/research/ground_gen/`:
 * `world6.py`'s `big_lake`, `river` and `pond`, `world7.py`'s `wiggle`, uneven split and braid,
 * `gen.py`'s `pools` and `coast2`), a prototype pixel being two mat units.
 *
 * The cells ({@link sampleWater}) and the drawing ({@link rasterise} over the plan's pixels) read
 * the same field: a cell is water when the water covers at least half of it (8 of its 16 sample
 * points), and the layout keeps a dry Token's centre off the drawn water as well as off the water
 * cells ({@link fieldAt}).
 *
 * ⚠️ Determinism: the layout stores the cells this field makes, so it must come out the same on
 * every machine: + − × ÷ and sqrt only (no trigonometry, `Math.hypot` or `**`), noise from integer
 * hashes, every random number from the layout's seeded generator, coordinates stored whole.
 */

/** The stored form's version: a map whose water says another is drawn from its cells alone. */
export const WATER_VERSION = 1;

/** How a pixel of water is drawn, per pixel of the plan. */
export const STYLE = Object.freeze({ NONE: 0, SEA: 1, LAKE: 2, SULPHUR: 3 });

/**
 * The terrain id each style is drawn as on the plan's pixel map: the sea is the cells' water; a
 * lake and a sulphur spring are water too, drawn in looks of their own. ⚠️ Drawing ids only:
 * nothing stores them, and the cells say `water` for all three.
 */
export const STYLE_TERRAIN = Object.freeze(['', 'water', 'water:lake', 'water:sulphur']);

/** The shapes a stored record may hold. */
export const SHAPE = Object.freeze({ LAKE: 'lake', RIVER: 'river', POOL: 'pool', SEA: 'sea' });

const STYLE_OF = Object.freeze({ lake: STYLE.LAKE, river: STYLE.LAKE, pool: STYLE.SULPHUR, sea: STYLE.SEA });

/** The water varieties a biome's rules may name (`Budget.BIOME_WATER`). */
export const WATER_KIND = Object.freeze({
    LAKE: 'lake', LAKE_RIVER: 'lake_river', RIVER: 'river', SPLIT: 'split', SPRING: 'spring',
    BRAIDED: 'braided', POND: 'pond', TARN: 'tarn', SULPHUR: 'sulphur'
});

/** The field where no shape reaches: far below any shore, and finite so it interpolates. */
export const FAR = -1e6;

/** How far past a shore, on the land, the field is worked out: the banks and the crust are drawn there. */
const BANK_PAD = 16;

/** A lake's shore: warped twice (`big_lake`), its lobes squashed a little, holes for islands and bays. */
const LAKE = Object.freeze({ warpCell: 140, warp: 140, noiseCell: 60, noise: 44, fineCell: 24, fine: 14, squash: 1.1, holeFine: 12 });

/** A river's banks: its width wandering by a share of its upstream half-width, a little fine noise. */
const RIVER = Object.freeze({ widthCell: 180, width: 0.6, fineCell: 24, fine: 6 });

/**
 * A sulphur spring (`pools`): a squashed ring by distance from its middle with noise, water inside
 * `waterline` of its radius; the field is that in units of `scale` mat units, so the rings fall at
 * the same fractions of every spring's radius.
 */
const POOL = Object.freeze({ cell: 28, noise: 0.35, fineCell: 10, fineNoise: 0.08, squash: 0.75, waterline: 0.74, scale: 100, reach: 1.15 });

/** The edge sea: a depth knot every `step` units, its coastline bent by two noises. */
const SEA = Object.freeze({ step: 192, wiggle: 0.35, cell: 100, noise: 60, fineCell: 24, fine: 12.8 });

/** The Guild Hall's clearing: water never comes inside it, its edge bent outward a little. */
const CLEAR = Object.freeze({ cell: 60, bend: 30 });

/** `wiggle`: a noise along the path's length (`vnoise(16)` read at 0.32 and 0.9 of a pixel per pixel). */
const WIGGLE = Object.freeze({ cell: 16, slow: 0.16, quick: 0.45, slowAmp: 5, quickAmp: 0.6 });

/** Noise channels, each layer of a record its own. */
const CH = Object.freeze({
    WARP_X: 1, WARP_Y: 2, LAKE: 3, LAKE_FINE: 4, WIDTH: 5, RIVER_FINE: 6, POOL: 7, POOL_FINE: 8,
    SEA: 9, SEA_FINE: 10, CLEAR: 11, WIGGLE: 12
});

// ---------------------------------------------------------------------------------------------
// Noise

/** A 32-bit hash of two integers and a salt (lowbias32's finaliser). */
function hash(x, y, salt) {
    let h = Math.imul(x + 0x632be5ab, 0x9e3779b1) ^ Math.imul(y + 0x85157af5, 0x85ebca77) ^ salt;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
}

const corner = (gx, gy, salt) => (hash(gx, gy, salt) >>> 8) / 16777216;
const smooth = (t) => t * t * (3 - 2 * t);

/** A layer's salt from a record's. */
const layerSalt = (salt, channel) => hash(salt | 0, channel, 0x3c6ef372);

/**
 * Smooth value noise in [0, 1) on square cells of `cell` units, its corners hashed. The corners
 * over `box` are worked out once; a point outside it hashes its own, to the same values.
 */
export function noiseLayer(salt, cell, box = null) {
    if (!box) return (x, y) => noiseAt(x, y, cell, salt);
    const gx0 = Math.floor(box.x0 / cell) - 1;
    const gy0 = Math.floor(box.y0 / cell) - 1;
    const gw = Math.floor(box.x1 / cell) + 3 - gx0;
    const gh = Math.floor(box.y1 / cell) + 3 - gy0;
    const grid = new Float64Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) grid[j * gw + i] = corner(gx0 + i, gy0 + j, salt);
    return (x, y) => {
        const tx = x / cell;
        const ty = y / cell;
        const gx = Math.floor(tx);
        const gy = Math.floor(ty);
        const i = gx - gx0;
        const j = gy - gy0;
        if (i < 0 || j < 0 || i + 1 >= gw || j + 1 >= gh) return noiseAt(x, y, cell, salt);
        const fx = smooth(tx - gx);
        const fy = smooth(ty - gy);
        const k = j * gw + i;
        const c00 = grid[k];
        const c01 = grid[k + gw];
        const top = c00 + (grid[k + 1] - c00) * fx;
        const bottom = c01 + (grid[k + gw + 1] - c01) * fx;
        return top + (bottom - top) * fy;
    };
}

/** {@link noiseLayer}'s value at one point, every corner hashed: the reference. */
export function noiseAt(x, y, cell, salt) {
    const tx = x / cell;
    const ty = y / cell;
    const gx = Math.floor(tx);
    const gy = Math.floor(ty);
    const fx = smooth(tx - gx);
    const fy = smooth(ty - gy);
    const c00 = corner(gx, gy, salt);
    const c01 = corner(gx, gy + 1, salt);
    const top = c00 + (corner(gx + 1, gy, salt) - c00) * fx;
    const bottom = c01 + (corner(gx + 1, gy + 1, salt) - c01) * fx;
    return top + (bottom - top) * fy;
}

// ---------------------------------------------------------------------------------------------
// Paths

/** Chaikin's corner cutting, `k` times: each segment's quarter points, the ends kept. */
export function smoothPath(points, k) {
    let pts = points;
    for (let n = 0; n < k; n++) {
        const q = [pts[0]];
        for (let i = 0; i + 1 < pts.length; i++) {
            const [x1, y1] = pts[i];
            const [x2, y2] = pts[i + 1];
            q.push([x1 * 0.75 + x2 * 0.25, y1 * 0.75 + y2 * 0.25], [x1 * 0.25 + x2 * 0.75, y1 * 0.25 + y2 * 0.75]);
        }
        q.push(pts[pts.length - 1]);
        pts = q;
    }
    return pts;
}

const dist = (ax, ay, bx, by) => Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));

/**
 * `wiggle`: the path smoothed, then each point pushed along the path's normal by a noise read
 * along its length, slow and quick together, so no two stretches bend alike; the ends stay put
 * (the prototype's `sin` taper as `4t(1 − t)`). Every fourth point is kept and smoothed again.
 *
 * @param {number[][]} points  control points, mat units
 * @param {number} amp  the bend, mat units (the prototype's pixels × 2)
 * @param {(x: number, y: number) => number} noise  the record's wiggle layer
 * @param {number} row  which row of the noise this path reads, so no two paths bend alike
 */
export function wiggle(points, amp, noise, row) {
    const pts = smoothPath(points, 4);
    const n = pts.length;
    const out = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
        const [x, y] = pts[i];
        if (i) s += dist(x, y, pts[i - 1][0], pts[i - 1][1]);
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(n - 1, i + 1)];
        const L = dist(a[0], a[1], b[0], b[1]) || 1;
        const nx = -(b[1] - a[1]) / L;
        const ny = (b[0] - a[0]) / L;
        const t = i / (n - 1);
        const pin = 4 * t * (1 - t);
        const o = ((noise(s * WIGGLE.slow, row * WIGGLE.cell * 2.3) - 0.5) * WIGGLE.slowAmp * amp
            + (noise(s * WIGGLE.quick, row * WIGGLE.cell * 2.3 + 200) - 0.5) * amp * WIGGLE.quickAmp) * pin;
        out.push([x + nx * o, y + ny * o]);
    }
    const kept = out.filter((_, i) => i % 4 === 0);
    if ((n - 1) % 4 !== 0) kept.push(out[n - 1]);
    return smoothPath(kept, 3);
}

/** A point's distance to a segment, and how far along it the nearest point is (0 to 1). */
function toSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    return { d: dist(px, py, cx, cy), cx, cy };
}

/**
 * A path with the points it can do without left out (Douglas and Peucker): none of the path moves
 * further than `tol` from where it was.
 */
export function simplify(pts, tol) {
    const last = pts.length - 1;
    if (last < 2) return pts.slice();
    const keep = new Uint8Array(pts.length);
    keep[0] = 1;
    keep[last] = 1;
    const stack = [[0, last]];
    while (stack.length) {
        const [a, b] = stack.pop();
        let best = -1;
        let far = tol;
        for (let k = a + 1; k < b; k++) {
            const d = toSegment(pts[k][0], pts[k][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]).d;
            if (d > far) {
                far = d;
                best = k;
            }
        }
        if (best >= 0) {
            keep[best] = 1;
            stack.push([a, best], [best, b]);
        }
    }
    return pts.filter((_, i) => keep[i]);
}

/** A path's total length. */
function lengthOf(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += dist(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1]);
    return s;
}

/** The index of the path's vertex nearest `share` of its length along it. */
function vertexAt(pts, share) {
    const want = lengthOf(pts) * share;
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
        s += dist(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1]);
        if (s >= want) return i;
    }
    return pts.length - 1;
}

// ---------------------------------------------------------------------------------------------
// The field

/** Every layer a record's shapes read, over the box they are worked out in. */
function layersOf(record, box) {
    const s = record.salt >>> 0;
    const at = (channel, cell) => noiseLayer(layerSalt(s, channel), cell, box);
    return {
        warpX: at(CH.WARP_X, LAKE.warpCell), warpY: at(CH.WARP_Y, LAKE.warpCell),
        lake: at(CH.LAKE, LAKE.noiseCell), lakeFine: at(CH.LAKE_FINE, LAKE.fineCell),
        width: at(CH.WIDTH, RIVER.widthCell), riverFine: at(CH.RIVER_FINE, RIVER.fineCell),
        pool: at(CH.POOL, POOL.cell), poolFine: at(CH.POOL_FINE, POOL.fineCell),
        sea: at(CH.SEA, SEA.cell), seaFine: at(CH.SEA_FINE, SEA.fineCell),
        clear: at(CH.CLEAR, CLEAR.cell)
    };
}

/** The lattice points `[i0, i1] × [j0, j1]` inside the box `x0..x1, y0..y1` (mat units). */
function span(lattice, x0, y0, x1, y1) {
    const { step, nx, ny } = lattice;
    return {
        i0: Math.max(0, Math.ceil((x0 - lattice.x0) / step)),
        i1: Math.min(nx - 1, Math.floor((x1 - lattice.x0) / step)),
        j0: Math.max(0, Math.ceil((y0 - lattice.y0) / step)),
        j1: Math.min(ny - 1, Math.floor((y1 - lattice.y0) / step))
    };
}

function lakeInto(out, lattice, shape, L) {
    const { lobes, holes } = shape;
    const pad = LAKE.warp / 2 + LAKE.noise / 2 + LAKE.fine / 2 + BANK_PAD;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y, r] of lobes) {
        x0 = Math.min(x0, x - r);
        y0 = Math.min(y0, y - r);
        x1 = Math.max(x1, x + r);
        y1 = Math.max(y1, y + r);
    }
    const { i0, i1, j0, j1 } = span(lattice, x0 - pad, y0 - pad, x1 + pad, y1 + pad);
    const { f, style } = out;
    const { step, nx } = lattice;
    for (let j = j0; j <= j1; j++) {
        const y = lattice.y0 + j * step;
        for (let i = i0; i <= i1; i++) {
            const x = lattice.x0 + i * step;
            const u = x + (L.warpX(x, y) - 0.5) * LAKE.warp;
            const v = y + (L.warpY(x, y) - 0.5) * LAKE.warp;
            let val = FAR;
            for (let k = 0; k < lobes.length; k++) {
                const [cx, cy, r] = lobes[k];
                const dx = u - cx;
                const dy = (v - cy) * LAKE.squash;
                const g = r - Math.sqrt(dx * dx + dy * dy);
                if (g > val) val = g;
            }
            const fine = L.lakeFine(x, y);
            val += (L.lake(x, y) - 0.5) * LAKE.noise + (fine - 0.5) * LAKE.fine;
            for (let k = 0; k < holes.length; k++) {
                const [cx, cy, r] = holes[k];
                const g = dist(u, v, cx, cy) - r + (fine - 0.5) * LAKE.holeFine;
                if (g < val) val = g;
            }
            const p = j * nx + i;
            if (val > f[p]) {
                f[p] = val;
                style[p] = STYLE.LAKE;
            }
        }
    }
}

function riverInto(out, lattice, shape, L, scratch) {
    const pts = shape.points;
    const [hw0, hw1] = shape.w;
    const reach = Math.max(hw0, hw1) + hw0 * RIVER.width / 2 + RIVER.fine / 2 + BANK_PAD;
    const { step, nx } = lattice;
    const { near, seen, touched } = scratch;
    const stamp = ++scratch.stamp;
    touched.length = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        const { i0, i1, j0, j1 } = span(lattice, Math.min(ax, bx) - reach, Math.min(ay, by) - reach, Math.max(ax, bx) + reach, Math.max(ay, by) + reach);
        for (let j = j0; j <= j1; j++) {
            const y = lattice.y0 + j * step;
            for (let i = i0; i <= i1; i++) {
                const x = lattice.x0 + i * step;
                const d = toSegment(x, y, ax, ay, bx, by).d;
                if (d >= reach) continue;
                const p = j * nx + i;
                if (seen[p] !== stamp) {
                    seen[p] = stamp;
                    near[p] = d;
                    touched.push(p);
                } else if (d < near[p]) near[p] = d;
            }
        }
    }
    // How wide here: by how far along the river's chord the point is, so it widens downstream.
    const [xa, ya] = pts[0];
    const [xb, yb] = pts[pts.length - 1];
    const cx = xb - xa;
    const cy = yb - ya;
    const L2 = cx * cx + cy * cy || 1;
    const { f, style } = out;
    for (const p of touched) {
        const i = p % nx;
        const j = (p - i) / nx;
        const x = lattice.x0 + i * step;
        const y = lattice.y0 + j * step;
        let t = ((x - xa) * cx + (y - ya) * cy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const hw = hw0 + (hw1 - hw0) * t + (L.width(x, y) - 0.5) * hw0 * RIVER.width;
        const val = hw - near[p] + (L.riverFine(x, y) - 0.5) * RIVER.fine;
        if (val > f[p]) {
            f[p] = val;
            style[p] = STYLE.LAKE;
        }
    }
}

function poolInto(out, lattice, shape, L) {
    const { x: cx, y: cy, r } = shape;
    const rx = r * POOL.reach;
    const ry = r * POOL.squash * POOL.reach;
    const { i0, i1, j0, j1 } = span(lattice, cx - rx, cy - ry, cx + rx, cy + ry);
    const { f, style } = out;
    const { step, nx } = lattice;
    const ry0 = r * POOL.squash;
    for (let j = j0; j <= j1; j++) {
        const y = lattice.y0 + j * step;
        const dy = (y - cy) / ry0;
        for (let i = i0; i <= i1; i++) {
            const x = lattice.x0 + i * step;
            const dx = (x - cx) / r;
            const d = Math.sqrt(dx * dx + dy * dy) + (L.pool(x, y) - 0.5) * POOL.noise + (L.poolFine(x, y) - 0.5) * POOL.fineNoise;
            const val = (POOL.waterline - d) * POOL.scale;
            const p = j * nx + i;
            if (val > f[p]) {
                f[p] = val;
                style[p] = STYLE.SULPHUR;
            }
        }
    }
}

/** A point's distance along the sea's edge and in from it, for each side (0 top, 1 right, 2 bottom, 3 left). */
const along = (side, x, y) => (side % 2 === 0 ? x : y);
const across = (side, x, y, w, h) => (side === 0 ? y : side === 1 ? w - x : side === 2 ? h - y : x);

/** The sea's depth at `a` along its edge: its knots, eased into each other. */
function seaDepth(shape, a) {
    const { d, step } = shape;
    const t = Math.max(0, a) / step;
    const j = Math.min(d.length - 2, Math.floor(t));
    const k = smooth(Math.min(1, t - j));
    return d[j] * (1 - k) + d[j + 1] * k;
}

function seaInto(out, lattice, shape, L, mat) {
    const { side } = shape;
    const deepest = Math.max(...shape.d) + SEA.noise / 2 + SEA.fine / 2 + BANK_PAD;
    const [w, h] = mat;
    const box = side === 0 ? [-Infinity, -Infinity, Infinity, deepest]
        : side === 1 ? [w - deepest, -Infinity, Infinity, Infinity]
            : side === 2 ? [-Infinity, h - deepest, Infinity, Infinity]
                : [-Infinity, -Infinity, deepest, Infinity];
    const { i0, i1, j0, j1 } = span(lattice, ...box);
    const { f, style } = out;
    const { step, nx } = lattice;
    for (let j = j0; j <= j1; j++) {
        const y = lattice.y0 + j * step;
        for (let i = i0; i <= i1; i++) {
            const x = lattice.x0 + i * step;
            const val = seaDepth(shape, along(side, x, y)) - across(side, x, y, w, h)
                + (L.sea(x, y) - 0.5) * SEA.noise + (L.seaFine(x, y) - 0.5) * SEA.fine;
            const p = j * nx + i;
            if (val > f[p]) {
                f[p] = val;
                style[p] = STYLE.SEA;
            }
        }
    }
}

/** No water inside the Hall's clearing: the field held below the distance past its edge. */
function clearInto(out, lattice, record, L) {
    const [hx, hy, R] = record.clear;
    const reach = R + CLEAR.bend + BANK_PAD;
    const { i0, i1, j0, j1 } = span(lattice, hx - reach, hy - reach, hx + reach, hy + reach);
    const { f } = out;
    const { step, nx } = lattice;
    for (let j = j0; j <= j1; j++) {
        const y = lattice.y0 + j * step;
        for (let i = i0; i <= i1; i++) {
            const x = lattice.x0 + i * step;
            const p = j * nx + i;
            if (f[p] <= -BANK_PAD) continue;
            const g = dist(x, y, hx, hy) - R - L.clear(x, y) * CLEAR.bend;
            if (g < f[p]) f[p] = g;
        }
    }
}

/**
 * A stored record's shapes, read for drawing: every river's path as point pairs. Null for a record
 * that is not one this version wrote.
 */
export function readWater(record) {
    if (!record || record.v !== WATER_VERSION || !Array.isArray(record.shapes)) return null;
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    const triples = (list) => Array.isArray(list) && list.every(t => Array.isArray(t) && t.length === 3 && t.every(num));
    if (!num(record.salt) || !Array.isArray(record.mat) || !record.mat.every(num)) return null;
    if (!Array.isArray(record.clear) || record.clear.length !== 3 || !record.clear.every(num)) return null;
    const shapes = [];
    for (const s of record.shapes) {
        if (s?.k === SHAPE.LAKE && triples(s.lobes) && s.lobes.length && triples(s.holes || [])) {
            shapes.push({ k: s.k, lobes: s.lobes, holes: s.holes || [] });
        } else if (s?.k === SHAPE.RIVER && Array.isArray(s.p) && s.p.length >= 4 && s.p.length % 2 === 0 && s.p.every(num)
            && Array.isArray(s.w) && s.w.length === 2 && s.w.every(num)) {
            const points = [];
            for (let i = 0; i < s.p.length; i += 2) points.push([s.p[i], s.p[i + 1]]);
            shapes.push({ k: s.k, points, w: s.w });
        } else if (s?.k === SHAPE.POOL && num(s.x) && num(s.y) && num(s.r) && s.r > 0) {
            shapes.push({ k: s.k, x: s.x, y: s.y, r: s.r });
        } else if (s?.k === SHAPE.SEA && [0, 1, 2, 3].includes(s.side) && num(s.step) && s.step > 0
            && Array.isArray(s.d) && s.d.length >= 2 && s.d.every(num)) {
            shapes.push({ k: s.k, side: s.side, step: s.step, d: s.d });
        }
    }
    return { v: record.v, salt: record.salt, mat: record.mat, clear: record.clear, shapes };
}

/**
 * The field over a lattice of points (`x0 + i × step`, `y0 + j × step`, mat units): the largest
 * of the shapes' fields, held out of the Hall's clearing, {@link FAR} where no shape reaches; and
 * the style of the water whose field that is.
 *
 * @param {object} water  {@link readWater}'s result
 * @param {{x0: number, y0: number, step: number, nx: number, ny: number}} lattice
 * @returns {{f: Float64Array, style: Uint8Array, lattice: object}}
 */
export function rasterise(water, lattice) {
    const n = lattice.nx * lattice.ny;
    const out = { f: new Float64Array(n).fill(FAR), style: new Uint8Array(n), lattice };
    if (!water?.shapes.length) return out;
    const margin = 400;
    const box = {
        x0: lattice.x0 - margin, y0: lattice.y0 - margin,
        x1: lattice.x0 + lattice.step * lattice.nx + margin, y1: lattice.y0 + lattice.step * lattice.ny + margin
    };
    const L = layersOf(water, box);
    let scratch = null;
    for (const shape of water.shapes) {
        if (shape.k === SHAPE.LAKE) lakeInto(out, lattice, shape, L);
        else if (shape.k === SHAPE.POOL) poolInto(out, lattice, shape, L);
        else if (shape.k === SHAPE.SEA) seaInto(out, lattice, shape, L, water.mat);
        else if (shape.k === SHAPE.RIVER) {
            if (!scratch) scratch = { near: new Float64Array(n), seen: new Int32Array(n), touched: [], stamp: 0 };
            riverInto(out, lattice, shape, L, scratch);
        }
    }
    clearInto(out, lattice, water, L);
    return out;
}

/** Sample points per cell side: a cell is water when at least half its points are. */
export const SAMPLES = 4;

/**
 * The water's cells: the field sampled at 4 × 4 points in each cell, a cell water when at least
 * half of them are, unless `keepDry(index)` says to keep it dry. The samples stay, for
 * {@link fieldAt}.
 *
 * @returns {{water: Uint8Array, sea: Uint8Array, sample: {f: Float64Array, style: Uint8Array, lattice: object}}}
 *   `sea` the water cells most of whose wet points are the sea's
 */
export function sampleWater(water, grid, cell, keepDry = () => false) {
    const step = cell / SAMPLES;
    const lattice = { x0: step / 2, y0: step / 2, step, nx: grid.cols * SAMPLES, ny: grid.rows * SAMPLES };
    const sample = rasterise(water, lattice);
    const cells = new Uint8Array(grid.cols * grid.rows);
    const sea = new Uint8Array(grid.cols * grid.rows);
    const half = (SAMPLES * SAMPLES) / 2;
    for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
            let wet = 0;
            let salt = 0;
            for (let j = 0; j < SAMPLES; j++) {
                const row = (r * SAMPLES + j) * lattice.nx + c * SAMPLES;
                for (let i = 0; i < SAMPLES; i++) {
                    if (!(sample.f[row + i] > 0)) continue;
                    wet++;
                    if (sample.style[row + i] === STYLE.SEA) salt++;
                }
            }
            const index = r * grid.cols + c;
            if (wet >= half && !keepDry(index)) {
                cells[index] = 1;
                if (salt * 2 > wet) sea[index] = 1;
            }
        }
    }
    return { water: cells, sea, sample };
}

/** The field at a mat point, read between the samples (bilinear, clamped at the edges). */
export function fieldAt(sample, x, y) {
    const { x0, y0, step, nx, ny } = sample.lattice;
    const tx = Math.min(nx - 1, Math.max(0, (x - x0) / step));
    const ty = Math.min(ny - 1, Math.max(0, (y - y0) / step));
    const i = Math.min(nx - 2, Math.floor(tx));
    const j = Math.min(ny - 2, Math.floor(ty));
    const fx = tx - i;
    const fy = ty - j;
    const k = j * nx + i;
    const f = sample.f;
    const top = f[k] + (f[k + 1] - f[k]) * fx;
    const bottom = f[k + nx] + (f[k + nx + 1] - f[k + nx]) * fx;
    return top + (bottom - top) * fy;
}

// ---------------------------------------------------------------------------------------------
// Making the shapes

/** Rivers start and end this far past the mat's edge, so they run off it. */
const OUT = 40;

/** A lake's share of the mat, by the owner's rule (up to a fifth): drawn between these. */
const LAKE_SHARE = Object.freeze([0.07, 0.17]);

/** How far past the Hall's clearing a river's straight line should pass, so it needs no bend round it. */
const CROSSING_CLEAR = 140;

/** How much more than its first lobe a lake covers, about, with the others merged in. */
const LOBE_GAIN = 1.35;

/**
 * The shapes of a Region's water, from the layout's random stream.
 *
 * @param {{sea: number, kinds: string[]}} rules  the sea's share of the mat (`ground.water`,
 *   already capped) and the varieties of inland water to pick one from (`ground.inland`)
 * @param {() => number} random  the layout's generator
 * @param {{w: number, h: number}} mat
 * @param {{x: number, y: number, r: number}} clear  the Hall's clearing
 * @param {{kind?: string}} [force]  a variety to make instead of picking one (the dev panel)
 * @returns {{record: object|null, kind: string|null}} the stored form ({@link readWater} reads it),
 *   null when there is no water
 */
export function planWater(rules, random, mat, clear, { kind: forced = null } = {}) {
    const sea = Number(rules?.sea) || 0;
    const kinds = Array.isArray(rules?.kinds) ? rules.kinds.filter(k => Object.values(WATER_KIND).includes(k)) : [];
    if (!(sea > 0) && !kinds.length && !forced) return { record: null, kind: null };
    const salt = Math.floor(random() * 4294967296) >>> 0;
    const record = {
        v: WATER_VERSION, salt,
        mat: [mat.w, mat.h],
        clear: [Math.round(clear.x), Math.round(clear.y), Math.round(clear.r)],
        shapes: []
    };
    if (sea > 0) record.shapes.push(seaShape(random, mat, sea));
    const kind = forced || (kinds.length ? kinds[Math.floor(random() * kinds.length)] : null);
    if (kind) {
        const maker = new Maker(random, mat, clear, salt);
        record.shapes.push(...maker.make(kind));
    }
    return { record: record.shapes.length ? record : null, kind };
}

/** The edge sea: a side picked, a knot of depth every few cells, the mean as deep as the share asks. */
function seaShape(random, mat, share) {
    const side = Math.floor(random() * 4);
    const length = side % 2 === 0 ? mat.w : mat.h;
    const reach = side % 2 === 0 ? mat.h : mat.w;
    const mean = share * mat.w * mat.h / length;
    const knots = Math.ceil(length / SEA.step) + 2;
    const d = [];
    for (let k = 0; k < knots; k++) d.push(Math.max(0, Math.min(reach, Math.round(mean * (1 + SEA.wiggle * (random() * 2 - 1))))));
    return { k: SHAPE.SEA, side, step: SEA.step, d };
}

const round = (v) => Math.round(v);
const flat = (pts) => pts.flatMap(([x, y]) => [round(x), round(y)]);

/** The variety makers: each keeps its water out of the Hall's clearing. */
class Maker {
    constructor(random, mat, clear, salt) {
        this.random = random;
        this.mat = mat;
        this.clear = clear;
        this.rows = 0;
        const box = { x0: -400, y0: -400, x1: mat.w + 400, y1: mat.h + 400 };
        this.wig = noiseLayer(layerSalt(salt, CH.WIGGLE), WIGGLE.cell, box);
    }

    /** A number between `lo` and `hi`. */
    between(lo, hi) {
        return lo + (hi - lo) * this.random();
    }

    /** A direction, without trigonometry: a point in the square kept if it lies in the ring. */
    direction() {
        for (let k = 0; k < 32; k++) {
            const x = this.random() * 2 - 1;
            const y = this.random() * 2 - 1;
            const d = x * x + y * y;
            if (d > 0.04 && d <= 1) {
                const l = Math.sqrt(d);
                return [x / l, y / l];
            }
        }
        return [1, 0];
    }

    /** How far a point is from the Hall. */
    fromHall(x, y) {
        return dist(x, y, this.clear.x, this.clear.y);
    }

    /** A point on side `side` of the mat (0 top, 1 right, 2 bottom, 3 left), `t` of the way along it, just past it. */
    edgePoint(side, t) {
        const { w, h } = this.mat;
        if (side === 0) return [t * w, -OUT];
        if (side === 1) return [w + OUT, t * h];
        if (side === 2) return [t * w, h + OUT];
        return [-OUT, t * h];
    }

    /** The side of the mat nearest a point. */
    nearestSide(x, y) {
        const { w, h } = this.mat;
        const d = [y, w - x, h - y, x];
        let best = 0;
        for (let s = 1; s < 4; s++) if (d[s] < d[best]) best = s;
        return best;
    }

    /** How far along its side an edge point lies, 0 to 1. */
    alongOf(side, x, y) {
        return side % 2 === 0 ? x / this.mat.w : y / this.mat.h;
    }

    /**
     * A centre for a round thing of reach `reach` (from its centre), at least `gap` clear of the
     * Hall's clearing and at most `out` of its reach past the mat's edge; the best of a few
     * draws, else null.
     */
    spot(reach, gap, out) {
        const { w, h } = this.mat;
        const inset = reach * (1 - out);
        if (inset * 2 >= w || inset * 2 >= h) return null;
        for (let k = 0; k < 40; k++) {
            const x = this.between(inset, w - inset);
            const y = this.between(inset, h - inset);
            if (this.fromHall(x, y) >= this.clear.r + reach + gap) return [x, y];
        }
        return null;
    }

    /**
     * A path round the Hall's clearing: a corner added out past it wherever a stretch would pass
     * within `margin` of it, on the side the stretch passes.
     */
    route(points, margin) {
        const { x: hx, y: hy, r } = this.clear;
        const R = r + margin;
        let pts = points;
        for (let pass = 0; pass < 6; pass++) {
            const out = [pts[0]];
            let changed = false;
            for (let k = 0; k + 1 < pts.length; k++) {
                const [ax, ay] = pts[k];
                const [bx, by] = pts[k + 1];
                const near = toSegment(hx, hy, ax, ay, bx, by);
                if (near.d < R) {
                    let nx = near.cx - hx;
                    let ny = near.cy - hy;
                    let l = Math.sqrt(nx * nx + ny * ny);
                    if (l < 1) {
                        // Straight through the middle: round whichever side the path's normal says.
                        const L = dist(ax, ay, bx, by) || 1;
                        nx = -(by - ay) / L;
                        ny = (bx - ax) / L;
                        l = 1;
                    }
                    out.push([hx + (nx / l) * R * 1.12, hy + (ny / l) * R * 1.12]);
                    changed = true;
                }
                out.push(pts[k + 1]);
            }
            pts = out;
            if (!changed) break;
        }
        return pts;
    }

    /** Points nearer the Hall than `R` pushed straight out to it. */
    repel(pts, R) {
        const { x: hx, y: hy } = this.clear;
        return pts.map(([x, y]) => {
            const d = dist(x, y, hx, hy);
            if (d >= R || d < 1e-9) return [x, y];
            return [hx + (x - hx) * R / d, hy + (y - hy) * R / d];
        });
    }

    /**
     * A river's final path: `points` routed round the clearing, wiggled by `amp`, every point kept
     * `hw` and a margin clear of it.
     */
    path(points, amp, hw) {
        const margin = hw * 1.4 + 2 * amp + 24;
        const routed = this.route(points, margin);
        return this.repel(wiggle(routed, amp, this.wig, this.rows++), this.clear.r + hw * 1.3 + 24);
    }

    river(points, hw0, hw1) {
        return { k: SHAPE.RIVER, p: flat(simplify(points, 1)), w: [round(hw0), round(hw1)] };
    }

    /** A lake of about `share` of the mat: lobes merged round a first one, maybe an island and a bay. */
    lake(share) {
        const { w, h } = this.mat;
        let r0 = Math.sqrt(share * w * h / (LOBE_GAIN * Math.PI));
        let at = null;
        for (let k = 0; k < 6 && !at; k++) {
            at = this.spot(r0, 30, 0.35);
            if (!at) r0 *= 0.85;
        }
        if (!at) return null;
        const [cx, cy] = at;
        const lobes = [[cx, cy, r0]];
        const extra = 1 + Math.floor(this.random() * 2);
        for (let n = 0; n < extra; n++) {
            for (let k = 0; k < 10; k++) {
                const [dx, dy] = this.direction();
                const reach = r0 * this.between(0.7, 1.05);
                const r = r0 * this.between(0.4, 0.7);
                const x = cx + dx * reach;
                const y = cy + dy * reach;
                if (this.fromHall(x, y) < this.clear.r + r + 30) continue;
                if (x < -0.3 * r || y < -0.3 * r || x > w + 0.3 * r || y > h + 0.3 * r) continue;
                lobes.push([x, y, r]);
                break;
            }
        }
        const holes = [];
        if (this.random() < 0.45) {
            const [dx, dy] = this.direction();
            const reach = r0 * this.between(0.1, 0.4);
            holes.push([cx + dx * reach, cy + dy * reach, r0 * this.between(0.09, 0.17)]);
        }
        if (this.random() < 0.5) {
            const [dx, dy] = this.direction();
            const reach = r0 * this.between(0.85, 1.05);
            holes.push([cx + dx * reach, cy + dy * reach, r0 * this.between(0.22, 0.37)]);
        }
        const r3 = (list) => list.map(([x, y, r]) => [round(x), round(y), Math.max(1, round(r))]);
        return { shape: { k: SHAPE.LAKE, lobes: r3(lobes), holes: r3(holes) }, x: cx, y: cy, r: r0 };
    }

    /** A small round water: a pond (two lobes) or a tarn (one), clear of the Hall by its warp too. */
    small(r, pond) {
        const at = this.spot(r * (pond ? 1.6 : 1) + LAKE.warp / 2, 20, 0);
        if (!at) return null;
        const [x, y] = at;
        const lobes = [[round(x), round(y), round(r)]];
        if (pond) {
            const [dx, dy] = this.direction();
            lobes.push([round(x + dx * r * 0.58), round(y + dy * r * 0.58), round(r * 0.6)]);
        }
        return { shape: { k: SHAPE.LAKE, lobes, holes: [] }, x, y, r };
    }

    /**
     * Two points on different sides of the mat, for a river across it: mostly opposite sides; on
     * two sides that meet, each well away from their corner, so the river crosses a good part of
     * the mat rather than cutting the corner.
     */
    crossing() {
        // Where each side meets the other: 1 at its far end (right or bottom), else 0.
        const meets = (side, other) => ((side % 2 === 0 ? other === 1 : other === 2) ? 1 : 0);
        const away = (side, other) => {
            const t = this.between(0.45, 0.85);
            return meets(side, other) ? 1 - t : t;
        };
        // A few draws, the first whose straight line passes well clear of the Hall kept, so the
        // river need not bend round the clearing; else the clearest.
        let best = null;
        let bestClear = -1;
        for (let k = 0; k < 12; k++) {
            const from = Math.floor(this.random() * 4);
            let pair;
            if (this.random() < 0.65) {
                pair = [this.edgePoint(from, this.between(0.15, 0.85)), this.edgePoint((from + 2) % 4, this.between(0.15, 0.85))];
            } else {
                const to = (from + (this.random() < 0.5 ? 1 : 3)) % 4;
                pair = [this.edgePoint(from, away(from, to)), this.edgePoint(to, away(to, from))];
            }
            const clear = toSegment(this.clear.x, this.clear.y, pair[0][0], pair[0][1], pair[1][0], pair[1][1]).d - this.clear.r;
            if (clear >= CROSSING_CLEAR) return pair;
            if (clear > bestClear) {
                best = pair;
                bestClear = clear;
            }
        }
        return best;
    }

    /**
     * From a point to the nearest side at least `least` away from it, `spread` of the side either
     * way: so a river leaving a lake runs a while before it leaves the mat.
     */
    toEdge(x, y, spread, least = 0) {
        const { w, h } = this.mat;
        const far = [y, w - x, h - y, x];
        const sides = [0, 1, 2, 3].sort((a, b) => far[a] - far[b]);
        const side = sides.find(sd => far[sd] >= least) ?? sides[3];
        const t = Math.min(0.92, Math.max(0.08, this.alongOf(side, x, y) + this.between(-spread, spread)));
        return this.edgePoint(side, t);
    }

    /** The middle of a path's control points, at even shares of the way: so wiggles have room. */
    through(a, b, count) {
        const out = [];
        for (let k = 0; k <= count; k++) out.push([a[0] + (b[0] - a[0]) * k / count, a[1] + (b[1] - a[1]) * k / count]);
        return out;
    }

    make(kind) {
        switch (kind) {
            case WATER_KIND.LAKE: return this.lakeAlone();
            case WATER_KIND.LAKE_RIVER: return this.lakeWithRiver();
            case WATER_KIND.RIVER: return this.riverAcross();
            case WATER_KIND.SPLIT: return this.splitRiver();
            case WATER_KIND.SPRING: return this.springRiver();
            case WATER_KIND.BRAIDED: return this.braided();
            case WATER_KIND.POND: return [this.small(this.between(66, 80), true)?.shape].filter(Boolean);
            case WATER_KIND.TARN: return [this.small(this.between(50, 64), false)?.shape].filter(Boolean);
            case WATER_KIND.SULPHUR: return this.sulphur();
            default: return [];
        }
    }

    lakeAlone() {
        const lake = this.lake(this.between(...LAKE_SHARE));
        return lake ? [lake.shape] : [];
    }

    /** A lake with a river out of it to the edge (`world6` A), or a river through it (`world6` B). */
    lakeWithRiver() {
        const lake = this.lake(this.between(LAKE_SHARE[0], LAKE_SHARE[1] * 0.85));
        if (!lake) return this.riverAcross();
        const out = [lake.shape];
        const exit = this.toEdge(lake.x, lake.y, 0.15, lake.r * 1.5 + 220);
        const toward = dist(lake.x, lake.y, exit[0], exit[1]) || 1;
        const start = [lake.x + (exit[0] - lake.x) / toward * lake.r * 0.5, lake.y + (exit[1] - lake.y) / toward * lake.r * 0.5];
        out.push(this.river(this.path(this.through(start, exit, 3), 44, 18), 12, 18));
        if (this.random() < 0.5) {
            // And in from another side: the river runs into the lake and on out of it.
            const side = (this.nearestSide(exit[0], exit[1]) + 1 + Math.floor(this.random() * 3)) % 4;
            const from = this.edgePoint(side, this.between(0.15, 0.85));
            out.push(this.river(this.path(this.through(from, [lake.x, lake.y], 3), 40, 16), 12, 16));
        }
        return out;
    }

    /** A river from one side of the mat to another, widening; now and then through a pool on the way. */
    riverAcross() {
        const [a, b] = this.crossing();
        const points = this.path(this.through(a, b, 4), this.between(36, 50), 26);
        const out = [this.river(points, 16, 26)];
        if (this.random() < 0.4) {
            const k = vertexAt(points, this.between(0.35, 0.65));
            const [x, y] = points[k];
            const r = this.between(90, 120);
            if (this.fromHall(x, y) >= this.clear.r + r * 1.4 + 40) {
                const [dx, dy] = this.direction();
                out.push({ k: SHAPE.LAKE, lobes: [[round(x), round(y), round(r)], [round(x + dx * r * 0.6), round(y + dy * r * 0.6), round(r * 0.7)]], holes: [] });
            }
        }
        return out;
    }

    /**
     * An uneven split (`world7` A): a wide main arm and a thin side channel round a teardrop
     * island, rejoining; the river may end in a small delta of two mouths near the edge.
     */
    splitRiver() {
        const [a, b] = this.crossing();
        let main = this.path(this.through(a, b, 4), this.between(30, 40), 22);
        const out = [];
        const s = this.between(0.18, 0.28);
        const iS = vertexAt(main, s);
        const iJ = Math.max(iS + 4, vertexAt(main, s + this.between(0.22, 0.3)));
        const S = main[iS];
        const J = main[Math.min(main.length - 1, iJ)];
        // The side channel follows the main arm a teardrop's width off, widest in its first half.
        const swing = this.between(70, 110) * (this.random() < 0.5 ? -1 : 1);
        const off = (share, wide) => {
            const k = Math.min(main.length - 2, iS + Math.round((iJ - iS) * share));
            const [x, y] = main[k];
            const [x2, y2] = main[k + 1];
            const L = dist(x, y, x2, y2) || 1;
            return [x - (y2 - y) / L * wide, y + (x2 - x) / L * wide];
        };
        const channel = this.path([S, off(0.25, swing * 0.8), off(0.5, swing), off(0.78, swing * 0.6), J], 12, 8);
        if (this.random() < 0.7) {
            // The delta: the main stops short of the edge and forks into two mouths.
            const F = vertexAt(main, this.between(0.84, 0.9));
            const fork = main[F];
            main = main.slice(0, F + 1);
            const sideOut = this.nearestSide(b[0], b[1]);
            const t = this.alongOf(sideOut, fork[0], fork[1]);
            const spread = this.between(110, 150) / (sideOut % 2 === 0 ? this.mat.w : this.mat.h);
            const m1 = this.edgePoint(sideOut, Math.max(0.02, t - spread));
            const m2 = this.edgePoint(sideOut, Math.min(0.98, t + spread * 0.8));
            const wideFirst = this.random() < 0.5;
            out.push(this.river(this.path([fork, m1], 16, 14), wideFirst ? 14 : 10, wideFirst ? 14 : 10));
            out.push(this.river(this.path([fork, m2], 14, 14), wideFirst ? 10 : 14, wideFirst ? 10 : 14));
        }
        out.unshift(this.river(main, 16, 22), this.river(channel, 8, 8));
        return out;
    }

    /** A spring pool, and a river from it to an edge a good way off, widening as it goes. */
    springRiver() {
        const pool = this.small(40, false);
        if (!pool) return this.riverAcross();
        const exit = this.toEdge(pool.x, pool.y, 0.2, 500);
        return [pool.shape, this.river(this.path(this.through([pool.x, pool.y], exit, 3), 32, 16), 8, 16)];
    }

    /** The braided river (`world7` B): channels weaving round gravel bars, one at each end. */
    braided() {
        const [a, b] = this.crossing();
        const spine = this.route(this.through(a, b, 5), 90);
        // Six control points along the spine, the middle two pulled apart per channel.
        const base = [];
        for (let k = 0; k <= 5; k++) base.push(pointAlong(spine, k / 5));
        const out = [];
        // Each channel pulled to its side of the spine, most in the middle: `world7` B's offsets,
        // across the river's way rather than along x and y.
        const pull = [0, 0.5, 1, 1, 0.5, 0];
        const channels = [[-40, 14], [40, 12], [14, 10], [-18, 8]];
        for (const [off, hw] of channels) {
            const pts = base.map(([x, y], k) => {
                const a = base[Math.max(0, k - 1)];
                const b = base[Math.min(5, k + 1)];
                const L = dist(a[0], a[1], b[0], b[1]) || 1;
                return [x - (b[1] - a[1]) / L * off * pull[k], y + (b[0] - a[0]) / L * off * pull[k]];
            });
            out.push(this.river(this.path(pts, 28, hw), hw, hw));
        }
        return out;
    }

    /** Yellowstone's sulphur springs: as many as the prototype's per piece of the mat its size. */
    sulphur() {
        const { w, h } = this.mat;
        const count = Math.round(2 * (w * h) / (640 * 400));
        const out = [];
        for (let k = 0; k < count; k++) {
            for (let t = 0; t < 4; t++) {
                const x = this.between(0.1, 0.9) * w;
                const y = this.between(0.1, 0.9) * h;
                const r = this.between(80, 120);
                if (this.fromHall(x, y) < this.clear.r + r * POOL.reach) continue;
                out.push({ k: SHAPE.POOL, x: round(x), y: round(y), r: round(r) });
                break;
            }
        }
        return out;
    }
}

/** The point `share` of the way along a path, by length. */
function pointAlong(pts, share) {
    const want = lengthOf(pts) * share;
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
        const l = dist(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1]);
        if (s + l >= want) {
            const t = l > 0 ? (want - s) / l : 0;
            return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
        }
        s += l;
    }
    return pts[pts.length - 1];
}

/** Which shapes of a record are the inland water (everything but the edge sea). */
export function withoutInland(record) {
    const shapes = record.shapes.filter(s => s.k === SHAPE.SEA);
    return shapes.length ? { ...record, shapes } : null;
}

/** The style each shape is drawn in. */
export const styleOf = (shape) => STYLE_OF[shape.k] || STYLE.NONE;
