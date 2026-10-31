// Stone as shapes on the mat: outcrops of bare rock, and a ridge across it

import { noiseAt } from './WaterShapes.js';

/**
 * Stone terrain is a feature of a Region's ground, as water is (owner, 2026-10-29: mines and
 * quarries stand on it). A Region's Stone is a handful of shapes in mat units, made with its layout
 * from its seed ({@link planStone}) and stored with its terrain map (`TerrainMap.encodeTerrain`),
 * and the cells it covers are `stone` ({@link sampleStone}): a cell is Stone when at least half of
 * its 16 sample points lie inside a shape.
 *
 * - An **outcrop** is a squashed blob turned a seeded way, its edge broken by noise.
 * - A **ridge** is a band across the whole mat (a wild cell's chasm), clear of the Hall.
 *
 * Water wins over Stone and the Hall's clearing has none: the layout keeps both off it.
 *
 * ⚠️ Determinism, as `WaterShapes`: + − × ÷ and sqrt only, noise from integer hashes, every random
 * number from the layout's seeded generator, coordinates stored whole.
 */

export const STONE_VERSION = 1;

/** The shapes a stored record may hold. */
export const STONE_SHAPE = Object.freeze({ OUTCROP: 'outcrop', RIDGE: 'ridge' });

/**
 * An outcrop: its long radius between the two `r`, its short one `squash` of that, the edge moved
 * by up to `noise` of the radius on a noise of `noiseCell` units, centres at least `apart` of
 * their two radii from each other. ⚠️ First values, for the owner's look.
 */
export const OUTCROP = Object.freeze({ r: [64, 120], squash: [0.55, 0.95], noiseCell: 40, noise: 0.35, apart: 0.9 });

/** A ridge: its half-width between the two `hw`, a knot every `step` units moved up to `wiggle` across. */
export const RIDGE = Object.freeze({ hw: [44, 64], step: 160, wiggle: 70, noiseCell: 56, noise: 0.3 });

/** How far past the Hall's clearing Stone keeps, in mat units. */
const MARGIN = 32;

/** Sample points across one cell, each way. */
const SAMPLES = 4;

const between = (random, lo, hi) => lo + (hi - lo) * random();

/** A unit direction by rejection, no trigonometry, as integers in thousandths. */
function directionOf(random) {
    for (let k = 0; k < 32; k++) {
        const x = random() * 2 - 1;
        const y = random() * 2 - 1;
        const d = x * x + y * y;
        if (d > 0.04 && d <= 1) {
            const l = Math.sqrt(d);
            return { ax: Math.round(1000 * x / l), ay: Math.round(1000 * y / l) };
        }
    }
    return { ax: 1000, ay: 0 };
}

function fromPoint(x, y, p) {
    const dx = x - p.x;
    const dy = y - p.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/** An outcrop clear of the Hall's clearing and apart from the others, or null when none fits. */
function outcropShape(random, mat, clear, others) {
    for (let k = 0; k < 40; k++) {
        const rx = Math.round(between(random, OUTCROP.r[0], OUTCROP.r[1]));
        const ry = Math.round(rx * between(random, OUTCROP.squash[0], OUTCROP.squash[1]));
        const x = Math.round(between(random, rx * 0.4, mat.w - rx * 0.4));
        const y = Math.round(between(random, ry * 0.4, mat.h - ry * 0.4));
        if (fromPoint(x, y, clear) < clear.r + rx + MARGIN) continue;
        const crowded = others.some(o => o.k === STONE_SHAPE.OUTCROP
            && fromPoint(x, y, o) < OUTCROP.apart * (rx + o.rx));
        if (crowded) continue;
        return { k: STONE_SHAPE.OUTCROP, x, y, rx, ry, ...directionOf(random) };
    }
    return null;
}

/** A ridge across the mat, the long way or the short, passing to one side of the Hall's clearing. */
function ridgeShape(random, mat, clear) {
    const hw = Math.round(between(random, RIDGE.hw[0], RIDGE.hw[1]));
    const across = random() < 0.5;
    const length = across ? mat.h : mat.w;
    const side = random() < 0.5 ? -1 : 1;
    const centre = across ? clear.x : clear.y;
    const reach = (across ? mat.w : mat.h) / 2;
    const near = clear.r + hw + RIDGE.wiggle + MARGIN;
    const offset = side * between(random, Math.min(near, reach * 0.8), Math.max(near, reach * 0.8));
    const pts = [];
    for (let at = -RIDGE.step / 2; at <= length + RIDGE.step; at += RIDGE.step) {
        const off = Math.round(centre + offset + (random() * 2 - 1) * RIDGE.wiggle);
        pts.push(across ? off : Math.round(at), across ? Math.round(at) : off);
    }
    return { k: STONE_SHAPE.RIDGE, hw, pts };
}

/**
 * The shapes of a Region's Stone, from the layout's random stream.
 *
 * @param {{outcrops?: number, ridge?: boolean}} rules
 * @param {() => number} random the layout's generator
 * @param {{w: number, h: number}} mat
 * @param {{x: number, y: number, r: number}} clear the Hall's clearing
 * @returns {object|null} the stored form, null when nothing was made
 */
export function planStone(rules, random, mat, clear) {
    const outcrops = Number.isInteger(rules?.outcrops) && rules.outcrops > 0 ? rules.outcrops : 0;
    const ridge = rules?.ridge === true;
    if (!outcrops && !ridge) return null;
    const salt = Math.floor(random() * 0x7fffffff);
    const shapes = [];
    if (ridge) shapes.push(ridgeShape(random, mat, clear));
    for (let i = 0; i < outcrops; i++) {
        const shape = outcropShape(random, mat, clear, shapes);
        if (shape) shapes.push(shape);
    }
    return shapes.length ? { v: STONE_VERSION, salt, shapes } : null;
}

/** A stored record read back: its shapes, or null for anything that is not one. */
export function readStone(record) {
    if (!record || record.v !== STONE_VERSION || !Array.isArray(record.shapes)) return null;
    const shapes = record.shapes.filter(s => (s?.k === STONE_SHAPE.OUTCROP && s.rx > 0 && s.ry > 0)
        || (s?.k === STONE_SHAPE.RIDGE && s.hw > 0 && Array.isArray(s.pts) && s.pts.length >= 4));
    return { salt: Number(record.salt) | 0, shapes };
}

/** Distance from a point to a segment. */
function toSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    const ex = px - (ax + t * dx);
    const ey = py - (ay + t * dy);
    return Math.sqrt(ex * ex + ey * ey);
}

/** How far a shape's field may reach from its middle, for skipping far points. */
function boxOf(shape) {
    if (shape.k === STONE_SHAPE.OUTCROP) {
        const r = Math.max(shape.rx, shape.ry) * (1 + OUTCROP.noise) + 2;
        return { x0: shape.x - r, y0: shape.y - r, x1: shape.x + r, y1: shape.y + r };
    }
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (let i = 0; i < shape.pts.length; i += 2) {
        x0 = Math.min(x0, shape.pts[i]); x1 = Math.max(x1, shape.pts[i]);
        y0 = Math.min(y0, shape.pts[i + 1]); y1 = Math.max(y1, shape.pts[i + 1]);
    }
    const pad = shape.hw * (1 + RIDGE.noise) + 2;
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** One shape's field at a point: above 0 inside. */
function shapeField(shape, index, salt, x, y) {
    const wobble = noiseAt(x, y, shape.k === STONE_SHAPE.OUTCROP ? OUTCROP.noiseCell : RIDGE.noiseCell, (salt + 7919 * (index + 1)) | 0) - 0.5;
    if (shape.k === STONE_SHAPE.OUTCROP) {
        const dx = x - shape.x;
        const dy = y - shape.y;
        const u = (dx * shape.ax + dy * shape.ay) / 1000;
        const v = (dy * shape.ax - dx * shape.ay) / 1000;
        const d = Math.sqrt((u / shape.rx) * (u / shape.rx) + (v / shape.ry) * (v / shape.ry));
        return 1 - d + 2 * OUTCROP.noise * wobble;
    }
    let d = Infinity;
    for (let i = 0; i + 3 < shape.pts.length; i += 2) {
        d = Math.min(d, toSegment(x, y, shape.pts[i], shape.pts[i + 1], shape.pts[i + 2], shape.pts[i + 3]));
    }
    return 1 - d / shape.hw + 2 * RIDGE.noise * wobble;
}

/** The Stone's field at a mat point: above 0 on Stone. `stone` is {@link readStone}'s. */
export function stoneFieldAt(stone, x, y) {
    let best = -Infinity;
    if (!stone) return best;
    stone.shapes.forEach((shape, i) => {
        const box = boxOf(shape);
        if (x < box.x0 || y < box.y0 || x > box.x1 || y > box.y1) return;
        best = Math.max(best, shapeField(shape, i, stone.salt, x, y));
    });
    return best;
}

/**
 * The cells the Stone covers: 1 where at least half of a cell's sample points lie inside a shape,
 * never where `keepOff(i)` says (the water, the Hall's clearing).
 *
 * @param {object|null} stone {@link readStone}'s
 * @param {{cols: number, rows: number}} grid
 * @param {number} cell a cell's side in mat units
 * @param {(index: number) => boolean} [keepOff]
 * @returns {Uint8Array}
 */
export function sampleStone(stone, grid, cell, keepOff = () => false) {
    const out = new Uint8Array(grid.cols * grid.rows);
    if (!stone?.shapes.length) return out;
    const boxes = stone.shapes.map(boxOf);
    for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
            const i = r * grid.cols + c;
            const x0 = c * cell;
            const y0 = r * cell;
            const near = [];
            stone.shapes.forEach((shape, k) => {
                const b = boxes[k];
                if (x0 + cell >= b.x0 && y0 + cell >= b.y0 && x0 <= b.x1 && y0 <= b.y1) near.push(k);
            });
            if (!near.length || keepOff(i)) continue;
            let inside = 0;
            for (let j = 0; j < SAMPLES; j++) {
                for (let k = 0; k < SAMPLES; k++) {
                    const x = x0 + cell * (k + 0.5) / SAMPLES;
                    const y = y0 + cell * (j + 0.5) / SAMPLES;
                    if (near.some(n => shapeField(stone.shapes[n], n, stone.salt, x, y) > 0)) inside++;
                }
            }
            if (inside * 2 >= SAMPLES * SAMPLES) out[i] = 1;
        }
    }
    return out;
}
