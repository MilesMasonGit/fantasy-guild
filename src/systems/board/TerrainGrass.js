// generated grass: the meadow's and the forest's ground drawn by rules instead of from a sheet

import { PLAN_PIXEL_U } from './TerrainLattice.js';
import { spreadSamples, CALIBRATION_SAMPLES } from './TerrainPatches.js';
import { generatedOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * The owner's settled ground rules (`docs/active/research/ground_gen/gen.py`, `ground` and
 * `mixed`, with each look's spec: `final_spec.json` the meadow, `forest_spec.json` the forest) as
 * the game draws them, each look's numbers in its `generated` entry (`terrainRegistry`): hue-shifted 5-colour ramps; a body of two
 * soft tones in clumps; mounds with a lit top and a shadowed bottom edge; blade strokes and tufts
 * lit from the top-left, each with a shadow pixel; strokes gathered in patches; three kinds of
 * grass (the meadow's tall, lawn and dry; the forest's ferns, lawn and leaf litter) in ragged zones
 * that share one body and differ by their strokes; earth
 * with clods, a lighter middle and a sunken edge, which the grass reaches into in fingers and
 * tufts.
 *
 * ⭐ Two stages, split by size:
 * - **Shapes** (earth, clumps, zones, mounds, patches) are smooth noise read per plan pixel in
 *   {@link buildGrassPlan}, once per Region: fixed to the mat, so a resize never moves them.
 * - **Details** (every edge, stroke, shadow pixel, clod, pebble and tuft) are decided per ground
 *   pixel of the screen in {@link drawGrass}, which the screen pass runs on a Region or a resize.
 *   ⚠️ Never on the plan's pixels: a ground pixel is a Token pixel on screen, the plan's 2 units
 *   only at a fit of 1, and resampling one-pixel strokes and edges to another size drops or
 *   doubles a column or row of them in every few.
 *
 * The prototype's pixel is a Token pixel: a noise cell of 16 there is 16 plan pixels here (32 mat
 * units). Its random choices (strokes from one global generator) become hashes of the pixel and the
 * Region's seed, so the same Region and window draw the same ground every time.
 *
 * ⚠️ Every pixel loop here is a function per row (`shapeRow`, `bodyRow`, ...): as a loop nested in
 * its pass, V8 compiled the pixel loop on its own and threw it away at the end of every row, and
 * each pass took a half to twice as long again.
 */

/** The rules every look shares and no slider moves, in the prototype's pixels. */
export const GRASS_RULES = Object.freeze({
    earthCell: 40, earthFineCell: 10, earthFine: 0.2,
    encroachCell: 9, encroachDepth: 2.2,
    middle: 0.3, clodCell: 5, clod: 0.6,
    bodyFine: 0.3, body: 0.5,
    mound: 0.52, moundFine: 0.25, moundLight: 0.5, moundDiagonal: 0.5,
    patchCell: 40,
    zoneJagCell: 6, zoneRagged: 0.35,
    lean: 0.4,
    edgeTufts: 0.8, raggedSides: 0.25,
    pebbles: 0.01,
    earthTufts: 0.012, earthTuftBlades: Object.freeze([2, 3, 4, 5]), earthTuftHeights: Object.freeze([1, 2, 2, 3]), earthTuftTip: 0.6
});

/**
 * Where each colour sits in a look's table: the grass ramp (`GRASS + 0` darkest to `+ 4`), the soft
 * body tone, the strokes' ramps of the kinds at the low and the high end of the zones (the meadow's
 * tall and dry grass, the forest's ferns and litter), the earth ramp and the earth's lighter middle.
 */
export const COLOUR = Object.freeze({ GRASS: 0, SOFT: 5, LOW: 6, HIGH: 11, EARTH: 16, MIDDLE: 21, COUNT: 22, NONE: 255 });

/** What a plan pixel's shape byte holds; `MOUND` is a mound of the pixel's own kind of grass. */
export const BIT = Object.freeze({ EARTH: 1, HIGH: 2, MIDDLE: 4, CLOD: 8, PATCH: 16, MOUND: 32 });

/** Hash channels for the noise layers. */
const CH = Object.freeze({
    CLUMP: 0x6a01, FINE: 0x6a02, EARTH: 0x6a03, EARTH_FINE: 0x6a04, ENCROACH: 0x6a05,
    ZONE: 0x6a06, JAG: 0x6a07, PATCH: 0x6a08, CLOD: 0x6a09, MOUND: 0x6a10, MOUND_FINE: 0x6a20
});

/** Salts for the per-ground-pixel choices. */
const SALT = Object.freeze({
    LIGHT: 0x51, SHADOW: 0x52, DIAGONAL: 0x53, CENTRE: 0x54, PATCH: 0x55, GAP: 0x5c,
    STROKE: 0x100, STROKE_MORE: 0x200,
    SMALL: 0x56, TUFT_SIZE: 0x5b, TUFT_BLADE: 0x300, EDGE: 0x58, SIDE: 0x59
});

// ---------------------------------------------------------------------------------------------
// Hashing and noise

/** A 32-bit hash of two integers and a salt (lowbias32's finaliser). */
function hash(x, y, salt) {
    let h = Math.imul(x + 0x632be5ab, 0x9e3779b1) ^ Math.imul(y + 0x85157af5, 0x85ebca77) ^ salt;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
}

/** A Region's salt for one kind of choice. */
const saltOf = (seed, which) => hash(seed | 0, which, 0x2545f491);

/** A chance as a cut on a 32-bit hash: `hash < cut` happens that often. */
const cut32 = (p) => (p >= 1 ? 4294967296 : p > 0 ? Math.floor(p * 4294967296) : 0);

/** Smoothstep, so noise cells blend into each other instead of meeting in creases. */
const smooth = (t) => t * t * (3 - 2 * t);

/** A noise corner's value, uniform in [0, 1). */
const cornerOf = (gx, gy, salt) => (hash(gx, gy, salt) >>> 8) / 16777216;

/**
 * Smooth value noise at a pixel, in [0, 1): the corners of the `cell`-pixel square it falls in,
 * interpolated. The slow reference every fast path here must match exactly.
 */
export function grassNoise(px, py, seed, cell, channel) {
    const salt = saltOf(seed, channel);
    const gx = Math.floor(px / cell);
    const gy = Math.floor(py / cell);
    const fx = smooth((px - gx * cell) / cell);
    const fy = smooth((py - gy * cell) / cell);
    const c00 = cornerOf(gx, gy, salt);
    const c10 = cornerOf(gx + 1, gy, salt);
    const c01 = cornerOf(gx, gy + 1, salt);
    const c11 = cornerOf(gx + 1, gy + 1, salt);
    const top = c00 + (c10 - c00) * fx;
    const bottom = c01 + (c11 - c01) * fx;
    return top + (bottom - top) * fy;
}

/**
 * {@link grassNoise} over a plan, every corner hashed once, walked down it: `walk(py)` blends the
 * two corner rows round pixel row `py` along x into `top` and `bottom` and sets `fy`, so the noise
 * at `px` of that row is `top[px] + (bottom[px] - top[px]) * fy`, the reference's arithmetic in
 * its order. `at(px, py)` reads any pixel, for the calibration.
 */
function noiseWalker(width, height, seed, cell, channel) {
    const salt = saltOf(seed, channel);
    const gw = Math.floor((width - 1) / cell) + 2;
    const gh = Math.floor((height - 1) / cell) + 2;
    const corners = new Float64Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) corners[gy * gw + gx] = cornerOf(gx, gy, salt);
    }
    const gxOf = new Int32Array(width);
    const fxOf = new Float64Array(width);
    for (let px = 0; px < width; px++) {
        const gx = Math.floor(px / cell);
        gxOf[px] = gx;
        fxOf[px] = smooth((px - gx * cell) / cell);
    }
    const blendRow = (gy, out) => {
        const base = gy * gw;
        for (let px = 0; px < width; px++) {
            const k = base + gxOf[px];
            const c0 = corners[k];
            out[px] = c0 + (corners[k + 1] - c0) * fxOf[px];
        }
    };
    const w = { top: new Float64Array(width), bottom: new Float64Array(width), fy: 0, gy: -2, walk: null, at: null };
    w.walk = (py) => {
        const gy = Math.floor(py / cell);
        if (gy !== w.gy) {
            if (gy === w.gy + 1) {
                const swap = w.top;
                w.top = w.bottom;
                w.bottom = swap;
                blendRow(gy + 1, w.bottom);
            } else {
                blendRow(gy, w.top);
                blendRow(gy + 1, w.bottom);
            }
            w.gy = gy;
        }
        w.fy = smooth((py - gy * cell) / cell);
    };
    w.at = (px, py) => {
        const gy = Math.floor(py / cell);
        const k = gy * gw + gxOf[px];
        const fx = fxOf[px];
        const c00 = corners[k];
        const c01 = corners[k + gw];
        const top = c00 + (corners[k + 1] - c00) * fx;
        const bottom = c01 + (corners[k + gw + 1] - c01) * fx;
        return top + (bottom - top) * smooth((py - gy * cell) / cell);
    };
    return w;
}

// ---------------------------------------------------------------------------------------------
// Colour

/** `colorsys.hls_to_rgb`, so a ramp comes out as the prototype's does. */
function hlsToRgb(h, l, s) {
    if (s === 0) return [l, l, l];
    const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
    const m1 = 2 * l - m2;
    const v = (hue) => {
        const t = ((hue % 1) + 1) % 1;
        if (t < 1 / 6) return m1 + (m2 - m1) * t * 6;
        if (t < 0.5) return m2;
        if (t < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - t) * 6;
        return m1;
    };
    return [v(h + 1 / 3), v(h), v(h - 1 / 3)];
}

/** `colorsys.rgb_to_hls`. */
function rgbToHls(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, l, 0];
    const range = max - min;
    const s = l <= 0.5 ? range / (max + min) : range / (2 - max - min);
    const rc = (max - r) / range;
    const gc = (max - g) / range;
    const bc = (max - b) / range;
    const h = r === max ? bc - gc : g === max ? 2 + rc - bc : 4 + gc - rc;
    return [(((h / 6) % 1) + 1) % 1, l, s];
}

const byte = (v) => Math.floor(v * 255);

/**
 * A pixel-art ramp: `n` colours round a middle one, each step lighter by `step` and its hue turned
 * by `hueShift` (darker toward blue, lighter toward yellow), the ends a little less saturated.
 *
 * @returns {number[][]} `[r, g, b]` bytes, darkest first
 */
export function ramp(h, l, s, n = 5, hueShift = 0.035, step = 0.075) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const k = i - (n - 1) / 2;
        const rgb = hlsToRgb(h - k * hueShift, l + k * step, Math.min(1, s * (1 - Math.abs(k) * 0.08)));
        out.push(rgb.map(byte));
    }
    return out;
}

/** A colour with its lightness multiplied by `f`. */
export function lighten([r, g, b], f) {
    const [h, l, s] = rgbToHls(r / 255, g / 255, b / 255);
    return hlsToRgb(h, Math.min(1, l * f), s).map(byte);
}

/**
 * A look's colour table, indexed by {@link COLOUR}: `[r, g, b]` bytes.
 *
 * @param {object} spec  `generatedOf(look)`
 * @param {number} soft  how far the body's darker tone moves toward its lighter one
 */
export function grassColours(spec, soft = tuning('grassBodySoft')) {
    const grass = ramp(...spec.grass);
    const earth = ramp(...spec.earth, 5, 0.02, 0.06);
    const [a, b] = [grass[1], grass[2]];
    const softTone = [0, 1, 2].map(i => Math.floor(a[i] * (1 - soft) + b[i] * soft));
    const strokes = (kind) => (kind.strokes ? ramp(...kind.strokes) : grass);
    return [...grass, softTone, ...strokes(spec.kinds[0]), ...strokes(spec.kinds[2]), ...earth, lighten(earth[2], 1.08)];
}

/** Where a kind's strokes take their colour from: its own ramp, or the grass ramp (the middle kind always). */
const strokeBase = (kind, k) => (k !== 1 && kind.strokes ? (k === 0 ? COLOUR.LOW : COLOUR.HIGH) : COLOUR.GRASS);

// ---------------------------------------------------------------------------------------------
// Shapes, per plan pixel

/** Whether a look draws generated ground now: it has colours and the switch is on. */
export function drawsGenerated(lookId) {
    return tuning('grassOn') > 0 && Boolean(generatedOf(lookId));
}

/**
 * A look's noise cells in plan pixels (the prototype's pixels): the clumps from their slider's mat
 * units, the zones from the look's own cell times their slider, the mounds per kind.
 */
export function grassCells(lookId) {
    const spec = generatedOf(lookId);
    const clump = Math.max(2, Math.round(tuning('grassClump') / PLAN_PIXEL_U));
    return {
        clump,
        fine: Math.max(2, Math.floor(clump / 2)),
        zone: Math.max(4, Math.round(spec.zoneCell * tuning('grassZoneScale'))),
        mounds: spec.kinds.map(k => k.mounds),
        moundFine: spec.kinds.map(k => Math.max(2, Math.floor(k.mounds / 3)))
    };
}

/** The zone noise's jagged edge, as a weight on the jag layer. */
const JAG = GRASS_RULES.zoneRagged * 0.25;

/** The earth's noise at a pixel, the slow way: earth wears where it is above the look's level. */
export function earthNoise(px, py, seed) {
    const R = GRASS_RULES;
    return (1 - R.earthFine) * grassNoise(px, py, seed, R.earthCell, CH.EARTH)
        + R.earthFine * grassNoise(px, py, seed, R.earthFineCell, CH.EARTH_FINE);
}

/**
 * The reference for one pixel of {@link buildGrassPlan}, worked out the slow way from
 * {@link grassNoise}; the fast path must match it exactly.
 *
 * @param {string} lookId  The pixel's look.
 * @param {{earth: number, tall: number, dry: number}} levels  The look's levels in the plan
 *   (`thresholds[slot]`): where the earth starts, and where the zones change.
 * @returns {{bits: number, kind: number}} the {@link BIT} flags and the kind (0 the low end of the
 *   zones, 1 the middle, 2 the high end)
 */
export function grassShapeAt(px, py, seed, lookId, levels) {
    const R = GRASS_RULES;
    const cells = grassCells(lookId);
    const earthAt = levels.earth;
    const n = (cell, ch) => grassNoise(px, py, seed, cell, ch);
    const encroach = tuning('grassEncroach');
    let bits = 0;
    let earth = false;
    const clump = n(cells.clump, CH.CLUMP);
    const wear = earthNoise(px, py, seed);
    if (wear > earthAt) {
        const depth = (wear - earthAt) / (1 - earthAt);
        if (n(R.encroachCell, CH.ENCROACH) > encroach * (1 - Math.min(1, depth * R.encroachDepth))) {
            earth = true;
            bits = BIT.EARTH;
            if (clump > R.body) bits |= BIT.HIGH;
            if (depth > R.middle) bits |= BIT.MIDDLE;
            if (n(R.clodCell, CH.CLOD) > R.clod) bits |= BIT.CLOD;
        }
    }
    if (!earth && clump * (1 - R.bodyFine) + n(cells.fine, CH.FINE) * R.bodyFine > R.body) bits |= BIT.HIGH;
    if (n(R.patchCell, CH.PATCH) >= tuning('grassPatch')) bits |= BIT.PATCH;
    const zone = n(cells.zone, CH.ZONE) + (n(R.zoneJagCell, CH.JAG) - 0.5) * JAG;
    const kind = zone < levels.tall ? 0 : zone > levels.dry ? 2 : 1;
    const mound = (1 - R.moundFine) * n(cells.mounds[kind], CH.MOUND + kind) + R.moundFine * n(cells.moundFine[kind], CH.MOUND_FINE + kind);
    if (mound > R.mound) bits |= BIT.MOUND;
    return { bits, kind };
}

/**
 * Where the earth starts and where the zones change, calibrated on this Region's own noise: a
 * share means that share of the ground (blended noise piles up round the middle, so a fixed level
 * would not).
 */
function calibrate(width, height, shared, zoneN, earthShare) {
    const R = GRASS_RULES;
    const { wearN, wearFineN, jagN } = shared;
    const last = CALIBRATION_SAMPLES - 1;
    const quantile = (sample, q) => sample[Math.min(last, Math.max(0, Math.floor(q * last)))];
    const tall = Math.max(0, tuning('grassTall'));
    const dry = Math.max(0, tuning('grassDry'));
    let earth = Infinity;
    if (earthShare > 0) {
        const wear = spreadSamples(width, height, CALIBRATION_SAMPLES, (x, y) => (1 - R.earthFine) * wearN.at(x, y) + R.earthFine * wearFineN.at(x, y));
        earth = quantile(wear, 1 - Math.min(0.95, earthShare));
    }
    const zone = spreadSamples(width, height, CALIBRATION_SAMPLES, (x, y) => zoneN.at(x, y) + (jagN.at(x, y) - 0.5) * JAG);
    return {
        earth,
        tall: tall > 0 ? quantile(zone, tall) : -Infinity,
        dry: dry > 0 ? quantile(zone, 1 - dry) : Infinity
    };
}

/**
 * One plan row of {@link buildGrassPlan}, its layers already walked to it.
 *
 * ⚠️ A layer's rows and weight are read into locals: through the walkers' properties this loop took
 * a third longer. And a finer layer is read only where it can change the answer (a weighted sum
 * whose coarse part already decides it, or a zone far from a border, skips it): exact, as
 * rounding never turns a smaller addend into a larger sum.
 */
function shapeRow(ctx, look, py) {
    const { width, at, slotOf, bits, kinds, patchCut, encroach } = ctx;
    const { slot, zoneN, moundN, moundFineN } = look;
    const { earth: earthAt, tall, dry } = look.levels;
    const R = GRASS_RULES;
    const wearKeep = 1 - R.earthFine;
    const earthFine = R.earthFine;
    const moundKeep = 1 - R.moundFine;
    const moundFine = R.moundFine;
    const bodyKeep = 1 - R.bodyFine;
    const bodyFine = R.bodyFine;
    const body = R.body;
    const middle = R.middle;
    const clodCut = R.clod;
    const mound = R.mound;
    const encroachDepth = R.encroachDepth;
    const jag = JAG;
    const halfJag = 0.5 * JAG;
    const { clumpN, fineN, wearN, wearFineN, encN, jagN, patchN, clodN } = ctx;
    const cT = clumpN.top, cB = clumpN.bottom, cY = clumpN.fy;
    const fT = fineN.top, fB = fineN.bottom, fY = fineN.fy;
    const wT = wearN.top, wB = wearN.bottom, wY = wearN.fy;
    const vT = wearFineN.top, vB = wearFineN.bottom, vY = wearFineN.fy;
    const eT = encN.top, eB = encN.bottom, eY = encN.fy;
    const zT = zoneN.top, zB = zoneN.bottom, zY = zoneN.fy;
    const jT = jagN.top, jB = jagN.bottom, jY = jagN.fy;
    const pT = patchN.top, pB = patchN.bottom, pY = patchN.fy;
    const dT = clodN.top, dB = clodN.bottom, dY = clodN.fy;
    const aT = moundN[0].top, aB = moundN[0].bottom, aY = moundN[0].fy;
    const AT = moundFineN[0].top, AB = moundFineN[0].bottom, AY = moundFineN[0].fy;
    const bT = moundN[1].top, bB = moundN[1].bottom, bY = moundN[1].fy;
    const BT = moundFineN[1].top, BB = moundFineN[1].bottom, BY = moundFineN[1].fy;
    const gT = moundN[2].top, gB = moundN[2].bottom, gY = moundN[2].fy;
    const GT = moundFineN[2].top, GB = moundFineN[2].bottom, GY = moundFineN[2].fy;
    for (let px = 0, i = py * width; px < width; px++, i++) {
        if (slotOf[at[i]] !== slot) continue;
        let b = 0;
        let x = cT[px];
        const clump = x + (cB[px] - x) * cY;

        // Earth: the fine layer only where the coarse one leaves it a chance.
        const t = earthAt;
        x = wT[px];
        const coarse = wearKeep * (x + (wB[px] - x) * wY);
        let earth = false;
        if (coarse + earthFine > t) {
            const y = vT[px];
            const wear = coarse + earthFine * (y + (vB[px] - y) * vY);
            if (wear > t) {
                const depth = (wear - t) / (1 - t);
                x = eT[px];
                if (x + (eB[px] - x) * eY > encroach * (1 - Math.min(1, depth * encroachDepth))) {
                    earth = true;
                    b = 1;
                    if (clump > body) b |= 2;
                    if (depth > middle) b |= 4;
                    x = dT[px];
                    if (x + (dB[px] - x) * dY > clodCut) b |= 8;
                }
            }
        }
        if (!earth) {
            const lit = clump * bodyKeep;
            if (lit > body) b |= 2;
            else if (lit + bodyFine > body) {
                x = fT[px];
                if (lit + (x + (fB[px] - x) * fY) * bodyFine > body) b |= 2;
            }
        }
        x = pT[px];
        if (x + (pB[px] - x) * pY >= patchCut) b |= 16;

        // The kind: the jag layer only near a zone's border.
        x = zT[px];
        const z = x + (zB[px] - x) * zY;
        let kind;
        if (z + halfJag < tall) kind = 0;
        else if (z - halfJag > dry) kind = 2;
        else if (z - halfJag >= tall && z + halfJag <= dry) kind = 1;
        else {
            const y = jT[px];
            const v = z + ((y + (jB[px] - y) * jY) - 0.5) * jag;
            kind = v < tall ? 0 : v > dry ? 2 : 1;
        }

        // Its mound, the fine layer only where the coarse one leaves it open.
        let m;
        let y;
        if (kind === 0) {
            x = aT[px];
            m = moundKeep * (x + (aB[px] - x) * aY);
            if (m <= mound && m + moundFine > mound) {
                y = AT[px];
                m += moundFine * (y + (AB[px] - y) * AY);
            }
        } else if (kind === 2) {
            x = gT[px];
            m = moundKeep * (x + (gB[px] - x) * gY);
            if (m <= mound && m + moundFine > mound) {
                y = GT[px];
                m += moundFine * (y + (GB[px] - y) * GY);
            }
        } else {
            x = bT[px];
            m = moundKeep * (x + (bB[px] - x) * bY);
            if (m <= mound && m + moundFine > mound) {
                y = BT[px];
                m += moundFine * (y + (BB[px] - y) * BY);
            }
        }
        if (m > mound) b |= 32;
        bits[i] = b;
        kinds[i] = (slot << 2) | (kind + 1);
    }
}

/**
 * The generated looks' shapes over a Region's plan.
 *
 * Each pixel keeps the mound of its own kind of grass only (the kinds' mounds differ in size): a
 * neighbour of another kind is never read as mound or open grass ({@link drawGrass}), so no mound
 * edge follows a zone's border.
 *
 * @param {object} pixels A resolved map from `resolveArtPixels`.
 * @param {number} seed The Region's seed.
 * @param {string[]} looks The look of each palette entry.
 * @returns {null|{looks: string[], slotOf: Int8Array, bits: Uint8Array, kinds: Uint8Array,
 *   thresholds: Array<{earth: number, tall: number, dry: number}>}} Null when no look here is
 *   generated. Per plan pixel, row by row: `kinds` 0 where the ground is not generated, else
 *   `(slot << 2) | (kind + 1)`, `slot` indexing `looks` (and `thresholds`, each look's levels),
 *   `kind` its `kinds` in the registry; `bits` the {@link BIT} flags. `slotOf[p]` is palette
 *   entry `p`'s slot, -1 for none.
 */
export function buildGrassPlan(pixels, seed, looks) {
    const { width, height, palette, at, present } = pixels;
    const slotOf = new Int8Array(256).fill(-1);
    const slots = [];
    palette.forEach((t, p) => {
        if (!present[p] || !drawsGenerated(looks[p])) return;
        let s = slots.indexOf(looks[p]);
        if (s < 0) { s = slots.length; slots.push(looks[p]); }
        slotOf[p] = s;
    });
    if (!slots.length) return null;

    const n = width * height;
    const rowHas = new Uint8Array(height);
    for (let py = 0; py < height; py++) {
        const base = py * width;
        for (let px = 0; px < width; px++) {
            if (slotOf[at[base + px]] >= 0) { rowHas[py] = 1; break; }
        }
    }

    const R = GRASS_RULES;
    const walker = (cell, ch) => noiseWalker(width, height, seed, cell, ch);
    const clump = grassCells(slots[0]);
    const shared = {
        clumpN: walker(clump.clump, CH.CLUMP),
        fineN: walker(clump.fine, CH.FINE),
        wearN: walker(R.earthCell, CH.EARTH),
        wearFineN: walker(R.earthFineCell, CH.EARTH_FINE),
        encN: walker(R.encroachCell, CH.ENCROACH),
        jagN: walker(R.zoneJagCell, CH.JAG),
        patchN: walker(R.patchCell, CH.PATCH),
        clodN: walker(R.clodCell, CH.CLOD)
    };
    // Each look its own zones (its cell and levels) and its kinds' mounds.
    const looksHere = slots.map((id, slot) => {
        const cells = grassCells(id);
        const zoneN = walker(cells.zone, CH.ZONE);
        const levels = calibrate(width, height, shared, zoneN, (generatedOf(id).earthShare || 0) * tuning('grassEarth'));
        return {
            slot, cells, zoneN, levels,
            moundN: cells.mounds.map((cell, k) => walker(cell, CH.MOUND + k)),
            moundFineN: cells.moundFine.map((cell, k) => walker(cell, CH.MOUND_FINE + k))
        };
    });
    const sharedWalkers = Object.values(shared);

    const ctx = {
        ...shared,
        width, at, slotOf,
        bits: new Uint8Array(n), kinds: new Uint8Array(n),
        patchCut: tuning('grassPatch'), encroach: tuning('grassEncroach')
    };
    for (let py = 0; py < height; py++) {
        if (!rowHas[py]) continue;
        for (const w of sharedWalkers) w.walk(py);
        for (const look of looksHere) {
            look.zoneN.walk(py);
            for (const w of look.moundN) w.walk(py);
            for (const w of look.moundFineN) w.walk(py);
            shapeRow(ctx, look, py);
        }
    }
    const thresholds = looksHere.map(l => l.levels);
    return { looks: slots, slotOf, bits: ctx.bits, kinds: ctx.kinds, thresholds };
}

// ---------------------------------------------------------------------------------------------
// Details, per ground pixel

/**
 * A ground pixel's shape byte: the plan's {@link BIT} flags with `ON` set where the ground is
 * generated, so one read says grass, earth or neither.
 */
const ON = 64;
const ON_EARTH = ON | BIT.EARTH;

const G0 = COLOUR.GRASS;
const G1 = G0 + 1;
const G2 = G0 + 2;
const G3 = G0 + 3;
const E0 = COLOUR.EARTH;
const E1 = E0 + 1;
const E2 = E0 + 2;
const E3 = E0 + 3;
const E4 = E0 + 4;

/** The plan's shapes read at each ground pixel of row `r`; the earth's pixels are listed. */
function resampleRow(ctx, r) {
    const { shape, kinds, colour, earth, cols, planCol, planKinds, planBits } = ctx;
    const pr = ctx.planRow[r];
    let count = ctx.count;
    for (let c = 0, i = r * cols; c < cols; c++, i++) {
        const p = pr + planCol[c];
        const k = planKinds[p];
        kinds[i] = k;
        if (!k) {
            shape[i] = 0;
            colour[i] = 255;
            continue;
        }
        const s = planBits[p] | ON;
        shape[i] = s;
        if (s & 1) earth[count++] = i;
    }
    ctx.count = count;
}

/**
 * The body, the mounds' lit tops and shadowed bottoms, and the earth's clods, lighter middle and
 * sunken edge, along row `r`: each pixel worked out from its neighbours.
 *
 * ⚠️ A mound reads only neighbours of its own kind; any other (another kind, or ground that is not
 * generated) counts as the pixel itself, so a mound never draws an edge along a zone or a beach.
 */
function bodyRow(ctx, r) {
    const { shape, kinds, colour, cols, rows, mounds, shadowCut, diagonalCut, lightCut, sLight, sShadow, sDiagonal } = ctx;
    const up = r > 0 ? -cols : 0;
    const up2 = r > 1 ? -2 * cols : up;
    const down = r < rows - 1 ? cols : 0;
    const MOUND = BIT.MOUND;
    const HIGH = BIT.HIGH;
    const CLOD = BIT.CLOD;
    const MIDDLE = BIT.MIDDLE;
    const SOFT = COLOUR.SOFT;
    const LIGHT_MIDDLE = COLOUR.MIDDLE;
    for (let c = 0, i = r * cols; c < cols; c++, i++) {
        const s = shape[i];
        if (!s) continue;
        const left = c > 0 ? -1 : 0;
        if (s & 1) {
            const right = c < cols - 1 ? 1 : 0;
            let col = s & HIGH ? E2 : E1;
            const u = shape[i + up];
            if (up && (u & ON_EARTH) === ON_EARTH && (u & CLOD) && !(s & CLOD)) col = E0;
            if (s & MIDDLE) col = LIGHT_MIDDLE;
            if (s & CLOD) col = E3;
            if ((u & ON_EARTH) === ON || (shape[i + up2] & ON_EARTH) === ON || (shape[i + left] & ON_EARTH) === ON) col = E0;
            else if ((shape[i + down] & ON_EARTH) === ON || (shape[i + right] & ON_EARTH) === ON) col = E4;
            colour[i] = col;
            continue;
        }
        let col = s & HIGH ? G2 : SOFT;
        if (mounds && up) {
            const k = kinds[i];
            const ju = i + up;
            const u = shape[ju];
            if (s & MOUND) {
                // A lit top: open grass of its kind above, more mound below.
                const jd = i + down;
                if (kinds[ju] === k && !(u & MOUND) && (kinds[jd] !== k || (shape[jd] & MOUND))
                    && hash(c, r, sLight) < lightCut) col = G3;
            } else if ((u & ON_EARTH) === ON && kinds[ju] === k && (u & MOUND)) {
                // Under a mound's bottom edge.
                if (hash(c, r - 1, sShadow) < shadowCut) col = G1;
            } else if (left) {
                // Under and right of a bottom edge, now and then.
                const jl = ju - 1;
                const l = shape[jl];
                if ((l & ON_EARTH) === ON && kinds[jl] === k && (l & MOUND)
                    && (kinds[i - 1] !== k || !(shape[i - 1] & MOUND))
                    && hash(c - 1, r - 1, sDiagonal) < diagonalCut) col = G1;
            }
        }
        colour[i] = col;
    }
}

/**
 * The blade strokes whose clusters are centred on row `r`: each stroke lit at its tip and with a
 * shadow pixel under its right; rows are drawn top to bottom, so a lower stroke stands in front. A
 * stroke stays on grass of its own kind.
 *
 * The centres come at the busiest kind's chance, in gaps drawn from it (a geometric gap per centre
 * rather than a hash per pixel), and each is kept at its own kind's share of that chance.
 */
function strokesRow(ctx, r) {
    const { shape, kinds, colour, cols, rows, strokeKinds, floorCut, sCentre, sPatch, sGap, gapLog, leanCut, strokeSalts, moreSalts } = ctx;
    const PATCH = BIT.PATCH;
    let c = -1;
    for (;;) {
        if (gapLog === 0) c++;
        else c += 1 + Math.floor(Math.log((hash(c, r, sGap) + 0.5) / 4294967296) / gapLog);
        if (c >= cols) return;
        const i = r * cols + c;
        const k = kinds[i];
        if (!k) continue;
        const spec = strokeKinds[(k >> 2) * 3 + (k & 3) - 1];
        if (hash(c, r, sCentre) >= spec.keepCut) continue;
        if (!(shape[i] & PATCH) && hash(c, r, sPatch) >= floorCut) continue;
        const { tipCut, shadowAt, tone, tip } = spec;
        const spread = spec.cluster > 1;
        for (let s = 0; s < spec.cluster; s++) {
            const h = hash(c, r, strokeSalts[s]);
            const x = c + (spread ? (((h & 255) * 3) >>> 8) - 1 : 0);
            const y = r + (spread ? ((((h >>> 8) & 255) * 3) >>> 8) - 1 : 0);
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
            if ((shape[y * cols + x] & ON_EARTH) !== ON) continue;
            const height = spec.heights[(((h >>> 16) & 255) * 3) >>> 8];
            const lean = ((h >>> 24) & 255) < leanCut;
            const more = hash(c, r, moreSalts[s]);
            const lit = (more & 0xffff) < tipCut;
            for (let t = 0; t < height; t++) {
                const xx = x + (lean && t === 0 ? 1 : 0);
                const yy = y - t;
                if (xx >= cols || yy < 0) continue;
                const j = yy * cols + xx;
                if ((shape[j] & ON_EARTH) === ON && kinds[j] === k) colour[j] = t === height - 1 && lit ? tip : tone;
            }
            if (x + 1 < cols && y + 1 < rows && (more >>> 16) < shadowAt) {
                const j = (y + 1) * cols + x + 1;
                if ((shape[j] & ON_EARTH) === ON && kinds[j] === k) colour[j] = G0;
            }
        }
    }
}

/**
 * The earth's small things, each covering the last: pebbles; the grass's own tufts out in the
 * earth; and its edge, grass hanging over the top as a tuft of one or two pixels (else a dark
 * rim) and now and then a grass pixel on its sides.
 */
function drawEarthDetails(ctx, seed) {
    const { shape, kinds, colour, earth, cols, rows, count } = ctx;
    const R = GRASS_RULES;
    const isEarth = (j) => (shape[j] & ON_EARTH) === ON_EARTH;
    const isGrass = (j) => (shape[j] & ON_EARTH) === ON;

    // One hash a pixel says whether a pebble and whether a tuft starts there.
    const pebbleCut = Math.round(R.pebbles * 65536);
    const tuftCut = Math.round(R.earthTufts * 65536);
    const sSmall = saltOf(seed, SALT.SMALL);
    const tufts = [];
    for (let e = 0; e < count; e++) {
        const i = earth[e];
        const r = (i / cols) | 0;
        const c = i - r * cols;
        const h = hash(c, r, sSmall);
        if ((h >>> 16) < tuftCut) tufts.push(i);
        if ((h & 0x7fff) * 2 >= pebbleCut || c + 1 >= cols || r + 1 >= rows || !isEarth(i + cols + 1)) continue;
        colour[i] = E3;
        if ((h & 0x8000) && isEarth(i + 1)) colour[i + 1] = E3;
        colour[i + cols + 1] = E0;
    }

    const sTuftSize = saltOf(seed, SALT.TUFT_SIZE);
    const tipCut = Math.round(R.earthTuftTip * 256);
    const bladeSalts = Array.from({ length: Math.max(...R.earthTuftBlades) }, (_, k) => saltOf(seed, SALT.TUFT_BLADE + k));
    for (const i of tufts) {
        const r = (i / cols) | 0;
        const c = i - r * cols;
        const blades = R.earthTuftBlades[hash(c, r, sTuftSize) & 3];
        for (let k = 0; k < blades; k++) {
            const xx = c + k - 1;
            if (xx < 0 || xx >= cols) continue;
            const j = r * cols + xx;
            if (!isEarth(j)) continue;
            const hb = hash(c, r, bladeSalts[k]);
            const height = R.earthTuftHeights[hb & 3];
            const lit = ((hb >>> 8) & 255) < tipCut;
            for (let t = 0; t < height && r - t >= 0; t++) {
                const jt = j - t * cols;
                if (kinds[jt]) colour[jt] = t === height - 1 && lit ? G3 : G2;
            }
            if (r + 1 < rows && isEarth(j + cols)) colour[j + cols] = E0;
        }
    }

    const edgeCut = Math.round(R.edgeTufts * 65536);
    const sideCut = cut32(R.raggedSides);
    const sEdge = saltOf(seed, SALT.EDGE);
    const sSide = saltOf(seed, SALT.SIDE);
    for (let e = 0; e < count; e++) {
        const i = earth[e];
        const r = (i / cols) | 0;
        const c = i - r * cols;
        if (r > 0 && isGrass(i - cols)) {
            const h = hash(c, r, sEdge);
            if ((h & 0xffff) < edgeCut) {
                colour[i] = G3;
                if (((h >>> 16) & 1) && r + 1 < rows && kinds[i + cols]) colour[i + cols] = G2;
            } else colour[i] = E0;
        } else if (((c > 0 && isGrass(i - 1)) || (c < cols - 1 && isGrass(i + 1))) && hash(c, r, sSide) < sideCut) {
            colour[i] = G2;
        }
    }
}

/**
 * The generated ground's colours on the screen's ground pixels.
 *
 * @param {object} grass  The plan's `grass` ({@link buildGrassPlan}).
 * @param {number} seed  The Region's seed.
 * @param {number} cols  Ground pixels across.
 * @param {number} rows  Ground pixels down.
 * @param {Int32Array} planCol  Each column's plan column.
 * @param {Int32Array} planRow  Each row's first plan pixel (plan row × plan width).
 * @param {object} [scratch]  Any object the caller keeps, to hold the buffers between calls: a
 *   resize then reuses them instead of allocating three screens' worth. The arrays returned belong
 *   to it and the next call overwrites them.
 * @returns {{colour: Uint8Array, kinds: Uint8Array}} per ground pixel, row by row: `colour` a
 *   {@link COLOUR} index of the pixel's look ({@link COLOUR}.NONE where the ground is not
 *   generated), `kinds` the plan's kind byte under it (its slot is `kinds >> 2`).
 */
export function drawGrass(grass, seed, cols, rows, planCol, planRow, scratch = null) {
    const total = cols * rows;
    let buffers = scratch;
    if (!buffers || buffers.total !== total) {
        buffers = {
            total,
            shape: new Uint8Array(total), kinds: new Uint8Array(total),
            colour: new Uint8Array(total), earth: new Int32Array(total)
        };
        if (scratch) Object.assign(scratch, buffers);
    }
    const R = GRASS_RULES;
    const ctx = {
        shape: buffers.shape, kinds: buffers.kinds, colour: buffers.colour, earth: buffers.earth,
        cols, rows, planCol, planRow, planKinds: grass.kinds, planBits: grass.bits, count: 0
    };
    for (let r = 0; r < rows; r++) resampleRow(ctx, r);

    const strength = Math.max(0, tuning('grassMounds'));
    ctx.mounds = strength > 0;
    ctx.shadowCut = cut32(strength);
    ctx.diagonalCut = cut32(R.moundDiagonal * strength);
    ctx.lightCut = cut32(R.moundLight * strength);
    ctx.sLight = saltOf(seed, SALT.LIGHT);
    ctx.sShadow = saltOf(seed, SALT.SHADOW);
    ctx.sDiagonal = saltOf(seed, SALT.DIAGONAL);
    for (let r = 0; r < rows; r++) bodyRow(ctx, r);

    // Every look's kinds, slot by slot: the centres come at the busiest kind's chance.
    const density = Math.max(0, tuning('grassStrokes'));
    const kindsBySlot = grass.looks.flatMap(id => generatedOf(id).kinds);
    const chances = kindsBySlot.map(kind => Math.min(1, kind.blades * density));
    const busiest = Math.max(0, ...chances);
    if (busiest > 0) {
        const mostStrokes = Math.max(...kindsBySlot.map(kind => kind.cluster));
        ctx.strokeKinds = kindsBySlot.map((kind, j) => {
            const base = strokeBase(kind, j % 3);
            return {
                keepCut: cut32(chances[j] / busiest),
                cluster: kind.cluster, heights: kind.heights,
                tipCut: Math.round(kind.tips * 65536), shadowAt: Math.round(kind.shadow * 65536),
                tone: base + kind.tone, tip: base + 4
            };
        });
        ctx.gapLog = busiest >= 1 ? 0 : Math.log(1 - busiest);
        ctx.floorCut = cut32(tuning('grassPatchFloor'));
        ctx.sCentre = saltOf(seed, SALT.CENTRE);
        ctx.sPatch = saltOf(seed, SALT.PATCH);
        ctx.sGap = saltOf(seed, SALT.GAP);
        ctx.leanCut = Math.round(R.lean * 256);
        ctx.strokeSalts = Array.from({ length: mostStrokes }, (_, s) => saltOf(seed, SALT.STROKE + s));
        ctx.moreSalts = Array.from({ length: mostStrokes }, (_, s) => saltOf(seed, SALT.STROKE_MORE + s));
        for (let r = 0; r < rows; r++) strokesRow(ctx, r);
    }

    drawEarthDetails(ctx, seed);
    return { colour: buffers.colour, kinds: buffers.kinds };
}
