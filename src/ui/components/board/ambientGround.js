// ambient life on the ground: the water's shimmer, a gust through the grass, the lava's pulse

import { grassNoise, lookRules, SLOT_SHIFT, COLOUR } from '../../../systems/board/TerrainGrass.js';

/**
 * Slow, lazy and subtle (owner, brief 190 P3): long quiet stretches and occasional events, each
 * effect drawn on a thin canvas of its own over the ground (`AmbientLife.jsx`), never a redraw of
 * the ground. Pure: one screen pass in (`groundScreen.buildScreenPass`), RGBA words out, written
 * into a canvas-sized buffer with the box that changed, so a step puts back only that box. The look
 * and pace are the prototype's round V9 (`docs/active/research/ground_gen/style7.py`: `shimmer9`,
 * `gust9`, `lava_glow`), its art pixel (2 mat units at a fit of 1) read as mat units, so a pattern
 * stays the same on the mat at every window size.
 *
 * ⚠️ Ambience only: nothing here reads or writes the game, and its randomness is its own
 * ({@link ambientRandom}), never `Math.random`, which the engine rolls with.
 */

/** The game's sprite rate: every effect steps on the shared sprite clock, 8 times a second. */
export const FRAME_MS = 125;

const TAU = Math.PI * 2;

/** A small fast generator of the ambience's own, in [0, 1). */
export function ambientRandom(seed = 1) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** An RGBA word as the canvas's bytes lie in memory (little-endian: red first). */
export const rgbaWord = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

/** A word's colour scaled by `f`, clamped; opaque. */
export function brighterWord(w, f) {
    const r = Math.min(255, Math.round((w & 255) * f));
    const g = Math.min(255, Math.round(((w >>> 8) & 255) * f));
    const b = Math.min(255, Math.round(((w >>> 16) & 255) * f));
    return rgbaWord(r, g, b);
}

/** Two words mixed, `t` of the way from `a` to `b`; opaque. */
export function mixWord(a, b, t) {
    const ch = (s) => Math.round(((a >>> s) & 255) + ((((b >>> s) & 255) - ((a >>> s) & 255)) * t));
    return rgbaWord(ch(0), ch(8), ch(16));
}

/** Noise channels of the ambience, apart from the ground's own. */
const CH = Object.freeze({ SWELL: 0x7a01, GUST: 0x7a02 });

/**
 * The shimmer (`shimmer9`): a swell, the water a little brighter where a slow wave pattern is
 * high, and a few sparkles that live half a second. The swell is lit where
 * `sin(φ + θ) > cut`, `φ` fixed per pixel (a slope across the mat bent by a noise), `θ` turning once
 * a `cycle`; quantised to the clock's steps, each pixel lights at one step and darkens at another,
 * so a step touches only the pixels whose light changes.
 */
export const SHIMMER = Object.freeze({
    slope: Object.freeze([0.015, 0.025]),
    bend: 5, bendCell: 60,
    cut: 0.82,
    swell: 1.05,
    cycleFrames: 80,
    sparkle: rgbaWord(225, 245, 250),
    sparkleFrames: 4
});

/**
 * The gust (`gust9`): a band `width` mat units wide crossing the mat west to east at `speed` a
 * frame, its front ragged by `rag` either way on a noise of `cell`; every swaying grass piece in it
 * stands one ground pixel downwind, the colour under it showing where it stood, and springs back
 * as the band passes. Once in a while: the Ground tuner's Seconds between gusts.
 */
export const GUST = Object.freeze({ width: 104, rag: 60, cell: 60, speed: 20 });

/** The lava's pulse (`lava_glow`): up to `bright` as bright, in `levels` hard steps, once a `cycleFrames`. */
export const LAVA = Object.freeze({ bright: 1.18, levels: 6, cycleFrames: 48 });

/** The box of changed pixels, grown one at a time; `null` when nothing changed. */
function dirtyBox() {
    let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
    return {
        add(c, r) {
            if (c < x0) x0 = c;
            if (c > x1) x1 = c;
            if (r < y0) y0 = r;
            if (r > y1) y1 = r;
        },
        take() {
            if (x1 < 0) return null;
            const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
            x0 = y0 = Infinity; x1 = y1 = -1;
            return box;
        }
    };
}

/** Which of the plan's looks are water, and which kinds glow, by the kind byte. */
function kindsOf(plan) {
    const water = new Uint8Array(256);
    const glow = new Uint8Array(256);
    (plan.grass?.looks || []).forEach((id, slot) => {
        const rules = lookRules(id);
        if (!rules) return;
        if (rules.water) { water[(slot << SLOT_SHIFT) | 1] = 1; return; }
        rules.kinds.forEach((kind, k) => { if (kind.glow) glow[(slot << SLOT_SHIFT) | (k + 1)] = 1; });
    });
    return { water, glow };
}

/**
 * Everything the ground's ambience needs from one screen pass, read at once (the pass's grass
 * buffers are reused by the next one): the water's and the lava's pixels with their colours, and
 * the swaying grass pieces in the order a gust from the west reaches them.
 *
 * @param {object} pass  `buildScreenPass`'s result (with `pieces` for the gust)
 * @param {object} plan  the plan it was drawn from
 */
export function groundLife(pass, plan) {
    const { cols, rows, unit, data, grass, covered } = pass;
    const words = new Uint32Array(data.buffer, data.byteOffset, cols * rows);
    const seed = plan.seed | 0;
    const life = { cols, rows, unit, seed, water: null, lava: null, gust: null, waterShare: 0 };
    if (!grass) return life;
    const { water, glow } = kindsOf(plan);
    const { colour, kinds } = grass;
    const wet = [];
    const hot = [];
    let inside = 0;
    for (let i = 0; i < cols * rows; i++) {
        if (words[i] >>> 24 !== 255) continue;
        inside++;
        if (colour[i] === COLOUR.NONE && !water[kinds[i]]) continue;
        if (covered[i]) continue;
        if (water[kinds[i]]) wet.push(i);
        else if (glow[kinds[i]]) hot.push(i);
    }
    if (wet.length) life.water = shimmerOf(Int32Array.from(wet), words, cols, unit, seed);
    life.waterShare = inside ? wet.length / inside : 0;
    if (hot.length) {
        const at = Int32Array.from(hot);
        life.lava = { at, base: at.map(i => words[i]), bright: Uint32Array.from(at, i => brighterWord(words[i], LAVA.bright)) };
    }
    if (pass.pieces?.at.length) life.gust = gustOf(pass, seed);
    return life;
}

/** Each water pixel's swell colour, and the steps at which its swell lights and darkens. */
function shimmerOf(at, words, cols, unit, seed) {
    const n = at.length;
    const Q = SHIMMER.cycleFrames;
    const step = TAU / Q;
    const a = Math.asin(SHIMMER.cut);
    const on = new Uint16Array(n);
    const off = new Uint16Array(n);
    const swell = new Uint32Array(n);
    for (let k = 0; k < n; k++) {
        const i = at[k];
        const r = (i / cols) | 0;
        const x = (i - r * cols + 0.5) * unit;
        const y = (r + 0.5) * unit;
        const phi = SHIMMER.slope[0] * x + SHIMMER.slope[1] * y + SHIMMER.bend * grassNoise(x, y, seed, SHIMMER.bendCell, CH.SWELL);
        const s = ((phi % TAU) + TAU) % TAU;
        // Lit while (φ + θ) mod 2π lies in (a, π - a), θ = q × step.
        const tOn = (((a - s) % TAU) + TAU) % TAU;
        const tOff = (((Math.PI - a - s) % TAU) + TAU) % TAU;
        on[k] = (Math.floor(tOn / step) + 1) % Q;
        off[k] = Math.ceil(tOff / step) % Q;
        swell[k] = brighterWord(words[i], SHIMMER.swell);
    }
    return { at, on, off, swell, buckets: bucketsOf(on, off, Q) };
}

/** Which pixels light and darken at each step, in two lists a step (compressed rows). */
function bucketsOf(on, off, Q) {
    const startOn = new Int32Array(Q + 1);
    const startOff = new Int32Array(Q + 1);
    for (let k = 0; k < on.length; k++) { startOn[on[k] + 1]++; startOff[off[k] + 1]++; }
    for (let q = 0; q < Q; q++) { startOn[q + 1] += startOn[q]; startOff[q + 1] += startOff[q]; }
    const listOn = new Int32Array(on.length);
    const listOff = new Int32Array(on.length);
    const fillOn = startOn.slice(0, Q);
    const fillOff = startOff.slice(0, Q);
    for (let k = 0; k < on.length; k++) { listOn[fillOn[on[k]]++] = k; listOff[fillOff[off[k]]++] = k; }
    return { startOn, startOff, listOn, listOff };
}

/** Whether a pixel's swell is lit at step `q`: from its lighting step up to its darkening one. */
export function swellLit(on, off, q) {
    return on <= off ? q >= on && q < off : q >= on || q < off;
}

/**
 * The water's shimmer, stepping: writes the swell and the sparkles into `out` (a canvas's words).
 *
 * @param {object} water  {@link groundLife}'s `water`
 * @param {{cols: number, out: Uint32Array, random: () => number}} options
 */
export function createShimmer(water, { cols, out, random }) {
    const { at, on, off, swell, buckets } = water;
    const Q = SHIMMER.cycleFrames;
    const box = dirtyBox();
    const lit = new Uint8Array(at.length);
    /** Sparkle → the frame it goes out, by its place in `at`. */
    const sparkles = new Map();
    let q = 0;
    let owed = 0;

    const show = (k) => {
        const i = at[k];
        const w = sparkles.has(k) ? SHIMMER.sparkle : lit[k] ? swell[k] : 0;
        if (out[i] === w) return;
        out[i] = w;
        box.add(i % cols, (i / cols) | 0);
    };

    return {
        /** Everything as it stands at step `start`: called once, on a fresh canvas. */
        paintAll(start = 0) {
            q = ((start % Q) + Q) % Q;
            for (let k = 0; k < at.length; k++) {
                lit[k] = swellLit(on[k], off[k], q) ? 1 : 0;
                show(k);
            }
            return box.take();
        },
        /**
         * One frame: the swell moves a step, spent sparkles go out and new ones come, about
         * `sparkles` alive at once (the prototype's 40 tries over the whole mat, times the water's
         * share of it).
         * @returns {{x: number, y: number, w: number, h: number}|null} the box that changed
         */
        step(frame, { sparkles: wanted = 0 } = {}) {
            q = (q + 1) % Q;
            for (let j = buckets.startOn[q]; j < buckets.startOn[q + 1]; j++) {
                const k = buckets.listOn[j];
                lit[k] = 1;
                show(k);
            }
            for (let j = buckets.startOff[q]; j < buckets.startOff[q + 1]; j++) {
                const k = buckets.listOff[j];
                lit[k] = 0;
                show(k);
            }
            for (const [k, until] of sparkles) {
                if (frame < until) continue;
                sparkles.delete(k);
                show(k);
            }
            owed += Math.max(0, wanted) / SHIMMER.sparkleFrames;
            while (owed >= 1) {
                owed -= 1;
                const k = Math.floor(random() * at.length);
                if (sparkles.has(k)) continue;
                sparkles.set(k, frame + SHIMMER.sparkleFrames);
                show(k);
            }
            return box.take();
        },
        /** Lit swell pixels and sparkles, for tests. */
        get state() { return { q, lit, sparkles }; }
    };
}

/**
 * The pieces in the order a gust from the west reaches them: by `x` plus a ragged offset, each
 * with the pixel it leans onto (its right neighbour, where that is inside the mat and no prop
 * covers it; else none).
 */
function gustOf(pass, seed) {
    const { cols, unit, pieces, covered, to } = pass;
    const n = pieces.at.length;
    const key = new Float64Array(n);
    for (let k = 0; k < n; k++) {
        const i = pieces.at[k];
        const r = (i / cols) | 0;
        const x = (i - r * cols + 0.5) * unit;
        const y = (r + 0.5) * unit;
        key[k] = x + (grassNoise(x, y, seed, GUST.cell, CH.GUST) - 0.5) * 2 * GUST.rag;
    }
    const order = Int32Array.from({ length: n }, (_, k) => k).sort((p, q) => key[p] - key[q]);
    const at = new Int32Array(n);
    const lean = new Int32Array(n);
    const colour = new Uint32Array(n);
    const body = new Uint32Array(n);
    const keys = new Float64Array(n);
    order.forEach((k, j) => {
        const i = pieces.at[k];
        const r = (i / cols) | 0;
        const c = i - r * cols;
        at[j] = i;
        keys[j] = key[k];
        colour[j] = pieces.colour[k];
        body[j] = pieces.body[k];
        lean[j] = c + 1 < to[r] && !covered[i + 1] ? i + 1 : -1;
    });
    return { at, lean, colour, body, keys };
}

/**
 * The gust, stepping: still until one is due, then a band crossing the mat; writes into `out`
 * (a canvas's words) only the pixels it moves and the ones it moved last frame.
 *
 * @param {object} gust  {@link groundLife}'s `gust`
 * @param {{cols: number, matW: number, out: Uint32Array, random: () => number}} options
 */
export function createGust(gust, { cols, matW, out, random }) {
    const { at, lean, colour, body, keys } = gust;
    const n = at.length;
    const box = dirtyBox();
    let painted = [];
    let front = null;
    let lo = 0;
    let hi = 0;
    let due = null;

    const clear = () => {
        for (const i of painted) {
            out[i] = 0;
            box.add(i % cols, (i / cols) | 0);
        }
        painted = [];
    };
    const put = (i, w) => {
        out[i] = w;
        painted.push(i);
        box.add(i % cols, (i / cols) | 0);
    };

    return {
        /**
         * One frame.
         * @param {number} frame
         * @param {{gapFrames: number}} options  how long on average between gusts
         * @returns {{x: number, y: number, w: number, h: number}|null}
         */
        step(frame, { gapFrames }) {
            if (front === null) {
                if (due === null) due = frame + Math.round(gapFrames * (0.25 + random() * 0.5));
                if (frame < due) return null;
                front = keys[0];
                lo = hi = 0;
            }
            front += GUST.speed;
            // Leaning: the pieces whose key the band covers, `front - width < key < front`.
            while (hi < n && keys[hi] < front) hi++;
            while (lo < hi && keys[lo] <= front - GUST.width) lo++;
            clear();
            for (let j = lo; j < hi; j++) put(at[j], body[j]);
            for (let j = lo; j < hi; j++) if (lean[j] >= 0) put(lean[j], colour[j]);
            if (lo >= n) {
                front = null;
                due = frame + Math.round(gapFrames * (0.5 + random()));
            }
            return box.take();
        },
        /** Start a gust now (the dev panel's button). */
        now(frame) { if (front === null) due = frame; },
        get crossing() { return front !== null; },
        get leaning() { return front === null ? 0 : hi - lo; },
        get dueAt() { return due; },
        matW
    };
}

/** The lava's level at a frame: 0 as drawn up to `LAVA.levels`, as bright as it goes. */
export function lavaLevel(frame) {
    const t = (frame % LAVA.cycleFrames) / LAVA.cycleFrames;
    return Math.round(LAVA.levels * (0.5 - 0.5 * Math.cos(TAU * t)));
}

/**
 * The lava's pulse, stepping: when its level changes, every lava pixel is written at it.
 * @param {object} lava  {@link groundLife}'s `lava`
 */
export function createLava(lava, { cols, out }) {
    const { at, base, bright } = lava;
    const box = dirtyBox();
    let shown = -1;
    const paint = (level) => {
        shown = level;
        const t = level / LAVA.levels;
        for (let k = 0; k < at.length; k++) {
            const i = at[k];
            out[i] = level === 0 ? 0 : mixWord(base[k], bright[k], t);
            box.add(i % cols, (i / cols) | 0);
        }
        return box.take();
    };
    return {
        step(frame) {
            const level = lavaLevel(frame);
            return level === shown ? null : paint(level);
        },
        get level() { return shown; }
    };
}
