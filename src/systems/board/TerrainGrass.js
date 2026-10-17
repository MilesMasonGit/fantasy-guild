// generated ground: every look's ground drawn by rules instead of from a sheet

import { PLAN_PIXEL_U, distanceFields } from './TerrainLattice.js';
import { spreadSamples, CALIBRATION_SAMPLES } from './TerrainPatches.js';
import { generatedOf } from '../../config/registries/terrainRegistry.js';
import { tuning, tuningDefault } from '../../config/playmatTuning.js';

/**
 * The owner's settled ground rules (`docs/active/research/ground_gen/gen.py`: `ground`, `mixed`,
 * `banded`, `coast2` and `pools`, with each look's spec named in its `generated` entry in
 * `terrainRegistry`) as the game draws them: hue-shifted 5-colour ramps; a body of two soft tones
 * in clumps; mounds with a lit top and a shadowed bottom edge; blade strokes and tufts lit from the
 * top-left, each with a shadow pixel; strokes gathered in patches; kinds of ground in ragged zones,
 * each with its own body and strokes (the meadow's tall, lawn and dry grass; a mountain's rock,
 * alpine grass and scree); earth with clods, a lighter middle and a sunken edge, which the grass
 * reaches into in fingers and tufts. Then what only some looks have: a kind laid over the zones in
 * patches (the cherry grove's green grass), sulphur lakes (Yellowstone), wet sand at the water, and
 * the sea itself: depth steps, a broken foam line and waves by distance from the shore.
 *
 * ⭐ Two stages, split by size:
 * - **Shapes** (earth, clumps, zones, mounds, patches, the shore's distance, the lakes) are smooth
 *   noise and distances read per plan pixel in {@link buildGrassPlan}, once per Region: fixed to
 *   the mat, so a resize never moves them.
 * - **Details** (every edge, stroke, wave, shadow pixel, clod, pebble and tuft) are decided per
 *   ground pixel of the screen in {@link drawGrass}, which the screen pass runs on a Region or a
 *   resize. ⚠️ Never on the plan's pixels: a ground pixel is a Token pixel on screen, the plan's 2
 *   units only at a fit of 1, and resampling one-pixel strokes and edges to another size drops or
 *   doubles a column or row of them in every few.
 *
 * The prototype's pixel is a Token pixel: a noise cell of 16 there is 16 plan pixels here (32 mat
 * units), and a shore distance of 0.06 of its 320-pixel width is 19.2 plan pixels. Its random
 * choices (from one global generator) become hashes of the pixel and the Region's seed, so the same
 * Region and window draw the same ground every time.
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
    earthTufts: 0.012, earthTuftBlades: Object.freeze([2, 3, 4, 5]), earthTuftHeights: Object.freeze([1, 2, 2, 3]), earthTuftTip: 0.6,
    // The shore: `coast2`'s wobble on the distance (its 0.04 of 320 pixels on a noise of 12), let in
    // over the first pixels so the drawn shore stays on the computed one; its foam and shallows
    // texture cuts.
    shoreCell: 12, shoreWobble: 12.8, shoreTaper: 6, foamCell: 4, foamLight: 0.35, shallowLight: 0.6,
    // `pools`: each lake's noisy, squashed rings, kept off the mat's edge.
    poolCell: 14, poolNoise: 0.35, poolFineCell: 5, poolFineNoise: 0.08, poolSquash: 0.75, poolMargin: 0.1,
    /** The prototype's picture, in its pixels: counts given per picture scale with the plan's area. */
    frame: Object.freeze({ w: 320, h: 200 })
});

/**
 * Where each colour sits in a look's table. A land look: its earth ramp (`EARTH + 0` darkest to
 * `+ 4`), the earth's lighter middle, the wet sand and the waterline, the lakes' five rings, then a
 * block of `STRIDE` per kind: its body ramp (`GRASS + 0..4`), the body's soft tone and its strokes'
 * ramp. A water look: the sea's ramp, the foam's two whites and the far trough. `DIM` added to an
 * index is the same colour in shadow (a patch's soft shadow). `COUNT` is the table's length.
 */
export const COLOUR = Object.freeze({
    EARTH: 0, MIDDLE: 5, WET: 6, LINE: 7, RING: 8, KIND: 13, STRIDE: 11,
    GRASS: 0, SOFT: 5, STROKES: 6,
    SEA: 0, FOAM: 5, FOAM2: 6, TROUGH: 7,
    DIM: 128, COUNT: 256, NONE: 255
});

/** The most kinds a look may have: their blocks must end before `DIM`. */
export const KIND_LIMIT = Math.floor((COLOUR.DIM - COLOUR.KIND) / COLOUR.STRIDE);

/** The colour index of step `offset` of kind `k`'s block. */
export const kindColour = (k, offset) => COLOUR.KIND + k * COLOUR.STRIDE + offset;

/** A kind byte is `(slot << SLOT_SHIFT) | (kind + 1)`: the look's slot, and its kind. */
export const SLOT_SHIFT = 4;
export const KIND_MASK = (1 << SLOT_SHIFT) - 1;

/** What a plan pixel's shape byte holds; `MOUND` is a mound of the pixel's own kind of grass. */
export const BIT = Object.freeze({ EARTH: 1, HIGH: 2, MIDDLE: 4, CLOD: 8, PATCH: 16, MOUND: 32 });

/** A water pixel's shape byte: its foam and shallows are the lighter tone; waves may start there. */
export const WATER_BIT = Object.freeze({ FOAM_LIGHT: 1, SHALLOW_LIGHT: 2, WAVES: 16 });

/** A land pixel's shore byte, where a look with a `shore` meets water. */
export const SHORE = Object.freeze({ LINE: 253, WET: 254 });

/** The share of the prototype's tint the shade pattern's slider stands for: the meadow's. */
const SLIDER_TINT = 0.06;

/** The colours that keep out of the shade pattern: drawn flat in the prototype. */
const UNSHADED = Object.freeze([COLOUR.WET, COLOUR.LINE, COLOUR.RING, COLOUR.RING + 1, COLOUR.RING + 2, COLOUR.RING + 3, COLOUR.RING + 4]);

/** Hash channels for the noise layers. */
const CH = Object.freeze({
    CLUMP: 0x6a01, FINE: 0x6a02, EARTH: 0x6a03, EARTH_FINE: 0x6a04, ENCROACH: 0x6a05,
    ZONE: 0x6a06, JAG: 0x6a07, PATCH: 0x6a08, CLOD: 0x6a09, MOUND: 0x6a10, MOUND_FINE: 0x6a20,
    GAP: 0x6a30, OVERLAY: 0x6a31, OVERLAY_FINE: 0x6a32, OVERLAY_JAG: 0x6a33,
    SHORE: 0x6a40, FOAM: 0x6a41, WAVE_PATCH: 0x6a42,
    POOL: 0x6a50, POOL_FINE: 0x6a51
});

/** The patches' channel for a noise cell: the meadow's own for its cell, so its patches stay put. */
const patchChannel = (cell) => (cell === GRASS_RULES.patchCell ? CH.PATCH : 0x6b00 + cell);

/** Salts for the per-ground-pixel choices. */
const SALT = Object.freeze({
    LIGHT: 0x51, SHADOW: 0x52, DIAGONAL: 0x53, CENTRE: 0x54, PATCH: 0x55, GAP: 0x5c,
    STROKE: 0x100, STROKE_MORE: 0x200,
    SMALL: 0x56, TUFT_SIZE: 0x5b, TUFT_BLADE: 0x300, EDGE: 0x58, SIDE: 0x59,
    FLECK: 0x60, WAVE_GAP: 0x61, WAVE: 0x62, OVER_EDGE: 0x63, OVER_HEIGHT: 0x64, OVER_DIM: 0x65,
    POOL_PLACE: 0x66
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

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** How far a slider has been moved from where it ships: a look's own value moves by as much. */
const offset = (key) => tuning(key) - tuningDefault(key);

/**
 * Smooth value noise at a pixel, in [0, 1), on cells `cellX` wide and `cellY` tall: the corners of
 * the cell it falls in, interpolated. The slow reference every fast path here must match exactly.
 */
export function grassNoise2(px, py, seed, cellX, cellY, channel) {
    const salt = saltOf(seed, channel);
    const gx = Math.floor(px / cellX);
    const gy = Math.floor(py / cellY);
    const fx = smooth((px - gx * cellX) / cellX);
    const fy = smooth((py - gy * cellY) / cellY);
    const c00 = cornerOf(gx, gy, salt);
    const c10 = cornerOf(gx + 1, gy, salt);
    const c01 = cornerOf(gx, gy + 1, salt);
    const c11 = cornerOf(gx + 1, gy + 1, salt);
    const top = c00 + (c10 - c00) * fx;
    const bottom = c01 + (c11 - c01) * fx;
    return top + (bottom - top) * fy;
}

/** {@link grassNoise2} on square cells. */
export function grassNoise(px, py, seed, cell, channel) {
    return grassNoise2(px, py, seed, cell, cell, channel);
}

/**
 * {@link grassNoise2} over a plan, every corner hashed once, walked down it: `walk(py)` blends the
 * two corner rows round pixel row `py` along x into `top` and `bottom` and sets `fy`, so the noise
 * at `px` of that row is `top[px] + (bottom[px] - top[px]) * fy`, the reference's arithmetic in
 * its order. `at(px, py)` reads any pixel, for the calibration.
 */
function noiseWalker(width, height, seed, cellX, cellY, channel) {
    const salt = saltOf(seed, channel);
    const gw = Math.floor((width - 1) / cellX) + 2;
    const gh = Math.floor((height - 1) / cellY) + 2;
    const corners = new Float64Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) corners[gy * gw + gx] = cornerOf(gx, gy, salt);
    }
    const gxOf = new Int32Array(width);
    const fxOf = new Float64Array(width);
    for (let px = 0; px < width; px++) {
        const gx = Math.floor(px / cellX);
        gxOf[px] = gx;
        fxOf[px] = smooth((px - gx * cellX) / cellX);
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
        const gy = Math.floor(py / cellY);
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
        w.fy = smooth((py - gy * cellY) / cellY);
    };
    w.at = (px, py) => {
        const gy = Math.floor(py / cellY);
        const k = gy * gw + gxOf[px];
        const fx = fxOf[px];
        const c00 = corners[k];
        const c01 = corners[k + gw];
        const top = c00 + (corners[k + 1] - c00) * fx;
        const bottom = c01 + (corners[k + gw + 1] - c01) * fx;
        return top + (bottom - top) * smooth((py - gy * cellY) / cellY);
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

/** A channel as a byte, as the prototype's `int(v * 255)` and PIL's clamp make it. */
const byte = (v) => Math.min(255, Math.max(0, Math.floor(v * 255)));

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
 * A colour pulled toward the grey of a middle tone's brightness: its saturation and its contrast
 * against that tone both scaled by `k` (1 leaves it as it is).
 */
export function toward([r, g, b], middle, k) {
    const m = 0.299 * middle[0] + 0.587 * middle[1] + 0.114 * middle[2];
    return [r, g, b].map(v => Math.min(255, Math.max(0, Math.round(m + (v - m) * k))));
}

// ---------------------------------------------------------------------------------------------
// A look's rules

/** A kind's numbers its rule set leaves out: the prototype's `ground` defaults. */
const KIND_DEFAULTS = Object.freeze({
    body: Object.freeze([1, 2]), moundLight: GRASS_RULES.moundLight, tips: 0.15, shadow: 0.5,
    heights: Object.freeze([2, 2, 3]), cluster: 1, tone: 3, strokes: null, mounds: 0
});

/** Where a kind's strokes gather when its rules do not say: the meadow's patches. */
const PATCH_DEFAULT = Object.freeze({ cell: GRASS_RULES.patchCell, cut: 0.55, floor: 0.6 });

const rulesBySpec = new WeakMap();

/**
 * A generated look's rules with every default filled in (see `LOOKS` in `terrainRegistry`).
 *
 * @param {object} spec  `generatedOf(look)`
 */
export function rulesOf(spec) {
    if (!spec) return null;
    let rules = rulesBySpec.get(spec);
    if (rules) return rules;
    if (spec.water) {
        rules = Object.freeze({ water: spec.water, kinds: [], tint: 0, grass: null });
    } else {
        const kinds = spec.kinds.map(k => Object.freeze({ ...KIND_DEFAULTS, ...k, grass: k.grass || spec.grass, patch: k.patch || PATCH_DEFAULT }));
        if (kinds.length > KIND_LIMIT) throw new RangeError(`a look has at most ${KIND_LIMIT} kinds`);
        const z = spec.zones;
        // An overlay's kind lies only where its own noise puts it, never in a zone.
        const order = z.sliders ? [0, 1, 2] : (z.order || kinds.map((_, i) => i).filter(i => i !== spec.overlay?.kind));
        const cuts = z.sliders ? null : (z.cuts || order.slice(1).map((_, i) => (i + 1) / order.length));
        rules = Object.freeze({
            water: null,
            grass: spec.grass,
            earth: spec.earth || spec.grass,
            earthShare: spec.earthShare || 0,
            encroach: spec.encroach ?? tuningDefault('grassEncroach'),
            soft: spec.soft ?? tuningDefault('grassBodySoft'),
            tint: spec.tint ?? SLIDER_TINT,
            zones: Object.freeze({ cell: z.cell, stretch: z.stretch || [1, 1], sliders: Boolean(z.sliders), cuts, order, gap: z.gap || null }),
            kinds,
            overlay: spec.overlay || null,
            pools: spec.pools || null,
            shore: spec.shore || null
        });
    }
    rulesBySpec.set(spec, rules);
    return rules;
}

/** A look's rules by its id, or null for a look drawn from its sheet. */
export const lookRules = (lookId) => rulesOf(generatedOf(lookId));

/**
 * How strongly the shade pattern lights and darkens a look, against the slider: the meadow 1, the
 * forest 2 (the prototype's 0.12 against 0.06), the sea none.
 */
export function shadeRatio(lookId) {
    const rules = lookRules(lookId);
    return rules ? rules.tint / SLIDER_TINT : 1;
}

/**
 * A look's colour table, indexed by {@link COLOUR}: `[r, g, b]` bytes, with the Ground strength
 * slider applied (every colour pulled toward the grey of the look's middle tone).
 *
 * @param {object} spec  `generatedOf(look)`
 * @param {{soft?: number, strength?: number}} [options]  the body's softness (how far its darker
 *   tone moves toward its lighter one) and the strength, each else from its slider
 */
export function grassColours(spec, { soft, strength } = {}) {
    const rules = rulesOf(spec);
    const k = strength ?? tuning('groundStrength');
    let table;
    let middle;
    if (rules.water) {
        const w = rules.water;
        const sea = ramp(...w.sea, 5, 0.02, 0.06);
        table = [...sea, lighten(sea[4], w.foamLight), lighten(sea[4], w.foam2Light), lighten(sea[0], 0.85)];
        middle = sea[2];
    } else {
        const s = soft ?? clamp01(rules.soft + offset('grassBodySoft'));
        const earth = ramp(...rules.earth, 5, 0.02, 0.06);
        const sand = rules.shore ? ramp(...rules.shore.sand, 5, 0.02, 0.06) : earth;
        const rings = rules.pools ? rules.pools.rings.map(([, rgb]) => [...rgb]) : [];
        while (rings.length < 5) rings.push(earth[2]);
        table = [...earth, lighten(earth[2], 1.08), sand[1], sand[0], ...rings];
        for (const kind of rules.kinds) {
            const body = ramp(...kind.grass);
            const [a, b] = [body[kind.body[0]], body[kind.body[1]]];
            const softTone = [0, 1, 2].map(i => Math.floor(a[i] * (1 - s) + b[i] * s));
            table.push(...body, softTone, ...(kind.strokes ? ramp(...kind.strokes) : body));
        }
        middle = ramp(...rules.grass)[2];
    }
    return k === 1 ? table : table.map(c => toward(c, middle, k));
}

/**
 * A look's whole table for the screen pass: {@link grassColours} with each colour's shadow at
 * `DIM` above it, and which colours the shade pattern leaves alone.
 *
 * @returns {{colours: number[][], unshaded: Uint8Array}} `COLOUR.COUNT` entries each
 */
export function grassTable(lookId) {
    const rules = lookRules(lookId);
    const base = grassColours(generatedOf(lookId));
    const dim = rules.overlay?.dim ?? 1;
    const colours = new Array(COLOUR.COUNT).fill(null).map(() => [0, 0, 0]);
    base.forEach((c, i) => {
        colours[i] = c;
        colours[COLOUR.DIM + i] = dim === 1 ? c : lighten(c, dim);
    });
    const unshaded = new Uint8Array(COLOUR.COUNT);
    if (!rules.water) for (const i of UNSHADED) { unshaded[i] = 1; unshaded[COLOUR.DIM + i] = 1; }
    return { colours, unshaded };
}

// ---------------------------------------------------------------------------------------------
// Shapes, per plan pixel

/** Whether a look draws generated ground now: it has rules and the switch is on. */
export function drawsGenerated(lookId) {
    return tuning('grassOn') > 0 && Boolean(generatedOf(lookId));
}

/**
 * A look's noise cells in plan pixels (the prototype's pixels): the clumps from their slider's mat
 * units, the zones from the look's own cell times their slider (`zoneX` and `zoneY` stretched),
 * the mounds per kind.
 */
export function grassCells(lookId) {
    const rules = lookRules(lookId);
    const clump = Math.max(2, Math.round(tuning('grassClump') / PLAN_PIXEL_U));
    const cells = { clump, fine: Math.max(2, Math.floor(clump / 2)), zone: 0, zoneX: 0, zoneY: 0, mounds: [], moundFine: [] };
    if (!rules || rules.water) return cells;
    const zone = Math.max(4, Math.round(rules.zones.cell * tuning('grassZoneScale')));
    cells.zone = zone;
    cells.zoneX = Math.max(4, Math.round(zone * rules.zones.stretch[0]));
    cells.zoneY = Math.max(4, Math.round(zone * rules.zones.stretch[1]));
    cells.mounds = rules.kinds.map(k => k.mounds);
    cells.moundFine = rules.kinds.map(k => Math.max(2, Math.floor(k.mounds / 3)));
    return cells;
}

/** The zone noise's jagged edge, as a weight on the jag layer. */
const JAG = GRASS_RULES.zoneRagged * 0.25;

/** The earth's noise at a pixel, the slow way: earth wears where it is above the look's level. */
export function earthNoise(px, py, seed) {
    const R = GRASS_RULES;
    return (1 - R.earthFine) * grassNoise(px, py, seed, R.earthCell, CH.EARTH)
        + R.earthFine * grassNoise(px, py, seed, R.earthFineCell, CH.EARTH_FINE);
}

/** An overlay's noise at a pixel, the slow way: its kind lies where this is above its cut. */
function overlayNoise(px, py, seed, ov) {
    return (1 - ov.fine) * grassNoise(px, py, seed, ov.cell, CH.OVERLAY)
        + ov.fine * grassNoise(px, py, seed, ov.fineCell, CH.OVERLAY_FINE)
        + (grassNoise(px, py, seed, ov.jagCell, CH.OVERLAY_JAG) - 0.5) * ov.jag;
}

/** The band of `cuts` a zone value lies in: how many cuts it has reached. */
function bandOf(cuts, v) {
    let b = 0;
    while (b < cuts.length && v >= cuts[b]) b++;
    return b;
}

/** A kind's patch cut and the share of its strokes kept outside the patches, with the sliders. */
const patchCut = (kind) => clamp01(kind.patch.cut + offset('grassPatch'));
const patchFloor = (kind) => clamp01(kind.patch.floor + offset('grassPatchFloor'));

/**
 * The reference for one land pixel of {@link buildGrassPlan}, worked out the slow way from
 * {@link grassNoise}; the fast path must match it exactly.
 *
 * @param {string} lookId  The pixel's look.
 * @param {{earth: number, tall?: number, dry?: number, cuts?: number[]}} levels  The look's levels
 *   in the plan (`thresholds[slot]`): where the earth starts, and where the zones change.
 * @returns {{bits: number, kind: number}} the {@link BIT} flags and the kind (its index in the
 *   look's `kinds`)
 */
export function grassShapeAt(px, py, seed, lookId, levels) {
    const R = GRASS_RULES;
    const rules = lookRules(lookId);
    const cells = grassCells(lookId);
    const earthAt = levels.earth;
    const n = (cell, ch) => grassNoise(px, py, seed, cell, ch);
    const encroach = rules.encroach + offset('grassEncroach');
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
    const zone = grassNoise2(px, py, seed, cells.zoneX, cells.zoneY, CH.ZONE) + (n(R.zoneJagCell, CH.JAG) - 0.5) * JAG;
    let kind;
    if (rules.zones.sliders) kind = zone < levels.tall ? 0 : zone > levels.dry ? 2 : 1;
    else {
        let band = bandOf(levels.cuts, zone);
        const gap = rules.zones.gap;
        if (gap && band === gap.band && n(gap.cell, CH.GAP) < gap.cut) band = gap.to;
        kind = rules.zones.order[band];
    }
    const ov = rules.overlay;
    if (ov && overlayNoise(px, py, seed, ov) > ov.cut) kind = ov.kind;
    const k = rules.kinds[kind];
    if (n(k.patch.cell, patchChannel(k.patch.cell)) >= patchCut(k)) bits |= BIT.PATCH;
    if (k.mounds > 0) {
        const mound = (1 - R.moundFine) * n(cells.mounds[kind], CH.MOUND + kind) + R.moundFine * n(cells.moundFine[kind], CH.MOUND_FINE + kind);
        if (mound > R.mound) bits |= BIT.MOUND;
    }
    return { bits, kind };
}

/**
 * Where the earth starts and, for a look whose zones follow the sliders, where they change,
 * calibrated on this Region's own noise: a share means that share of the ground (blended noise
 * piles up round the middle, so a fixed level would not). Other looks cut their zones where their
 * rules say, as the prototype did.
 */
function calibrate(width, height, shared, zoneN, rules, earthShare) {
    const R = GRASS_RULES;
    const { wearN, wearFineN, jagN } = shared;
    const last = CALIBRATION_SAMPLES - 1;
    const quantile = (sample, q) => sample[Math.min(last, Math.max(0, Math.floor(q * last)))];
    let earth = Infinity;
    if (earthShare > 0) {
        const wear = spreadSamples(width, height, CALIBRATION_SAMPLES, (x, y) => (1 - R.earthFine) * wearN.at(x, y) + R.earthFine * wearFineN.at(x, y));
        earth = quantile(wear, 1 - Math.min(0.95, earthShare));
    }
    if (!rules.zones.sliders) return { earth, cuts: rules.zones.cuts };
    const tall = Math.max(0, tuning('grassTall'));
    const dry = Math.max(0, tuning('grassDry'));
    const zone = spreadSamples(width, height, CALIBRATION_SAMPLES, (x, y) => zoneN.at(x, y) + (jagN.at(x, y) - 0.5) * JAG);
    return {
        earth,
        tall: tall > 0 ? quantile(zone, tall) : -Infinity,
        dry: dry > 0 ? quantile(zone, 1 - dry) : Infinity
    };
}

/**
 * One plan row of a land look in {@link buildGrassPlan}, its layers already walked to it: first
 * the earth, the body and the kind of every pixel, then each kind's patches and mounds over its own
 * pixels.
 *
 * ⚠️ A layer's rows and weight are read into locals: through the walkers' properties this loop took
 * a third longer. And a finer layer is read only where it can change the answer (a weighted sum
 * whose coarse part already decides it, or a zone far from a border, skips it): exact, as
 * rounding never turns a smaller addend into a larger sum.
 */
function shapeRow(ctx, look, py) {
    const { width, at, slotOf, bits, kinds, rowKind } = ctx;
    const { slot, zoneN, encroach, rules } = look;
    const { earth: earthAt } = look.levels;
    const R = GRASS_RULES;
    const wearKeep = 1 - R.earthFine;
    const earthFine = R.earthFine;
    const bodyKeep = 1 - R.bodyFine;
    const bodyFine = R.bodyFine;
    const body = R.body;
    const middle = R.middle;
    const clodCut = R.clod;
    const encroachDepth = R.encroachDepth;
    const jag = JAG;
    const halfJag = 0.5 * JAG;
    const { clumpN, fineN, wearN, wearFineN, encN, jagN, clodN } = ctx;
    const cT = clumpN.top, cB = clumpN.bottom, cY = clumpN.fy;
    const fT = fineN.top, fB = fineN.bottom, fY = fineN.fy;
    const wT = wearN.top, wB = wearN.bottom, wY = wearN.fy;
    const vT = wearFineN.top, vB = wearFineN.bottom, vY = wearFineN.fy;
    const eT = encN.top, eB = encN.bottom, eY = encN.fy;
    const zT = zoneN.top, zB = zoneN.bottom, zY = zoneN.fy;
    const jT = jagN.top, jB = jagN.bottom, jY = jagN.fy;
    const dT = clodN.top, dB = clodN.bottom, dY = clodN.fy;
    const sliders = rules.zones.sliders;
    const tall = look.levels.tall;
    const dry = look.levels.dry;
    const cuts = look.levels.cuts;
    const order = rules.zones.order;
    const gap = rules.zones.gap;
    const gapN = look.gapN;
    const ov = rules.overlay;
    const [oN, oF, oJ] = look.overlayN || [];
    let any = false;
    for (let px = 0, i = py * width; px < width; px++, i++) {
        if (slotOf[at[i]] !== slot) {
            rowKind[px] = -1;
            continue;
        }
        any = true;
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

        // The kind: the jag layer only near a zone's border.
        x = zT[px];
        const z = x + (zB[px] - x) * zY;
        let kind;
        if (sliders) {
            if (z + halfJag < tall) kind = 0;
            else if (z - halfJag > dry) kind = 2;
            else if (z - halfJag >= tall && z + halfJag <= dry) kind = 1;
            else {
                const y = jT[px];
                const v = z + ((y + (jB[px] - y) * jY) - 0.5) * jag;
                kind = v < tall ? 0 : v > dry ? 2 : 1;
            }
        } else {
            let band = bandOf(cuts, z - halfJag);
            if (band !== bandOf(cuts, z + halfJag)) {
                const y = jT[px];
                band = bandOf(cuts, z + ((y + (jB[px] - y) * jY) - 0.5) * jag);
            }
            if (gap && band === gap.band) {
                x = gapN.top[px];
                if (x + (gapN.bottom[px] - x) * gapN.fy < gap.cut) band = gap.to;
            }
            kind = order[band];
        }
        if (ov) {
            x = oN.top[px];
            const y = oF.top[px];
            const j = oJ.top[px];
            const m = (1 - ov.fine) * (x + (oN.bottom[px] - x) * oN.fy) + ov.fine * (y + (oF.bottom[px] - y) * oF.fy)
                + ((j + (oJ.bottom[px] - j) * oJ.fy) - 0.5) * ov.jag;
            if (m > ov.cut) kind = ov.kind;
        }
        bits[i] = b;
        rowKind[px] = kind;
    }
    if (!any) return;
    for (let k = 0; k < look.kindShape.length; k++) kindRow(ctx, look, k, py);
}

/** A kind's patches and mounds over its pixels of row `py` ({@link shapeRow}'s second half). */
function kindRow(ctx, look, k, py) {
    const { width, bits, kinds, rowKind } = ctx;
    const { patchN, patchCut: cut, moundN, moundFineN } = look.kindShape[k];
    const R = GRASS_RULES;
    const moundKeep = 1 - R.moundFine;
    const moundFine = R.moundFine;
    const mound = R.mound;
    const pT = patchN.top, pB = patchN.bottom, pY = patchN.fy;
    const has = moundN !== null;
    const aT = has ? moundN.top : null, aB = has ? moundN.bottom : null, aY = has ? moundN.fy : 0;
    const AT = has ? moundFineN.top : null, AB = has ? moundFineN.bottom : null, AY = has ? moundFineN.fy : 0;
    const code = (look.slot << SLOT_SHIFT) | (k + 1);
    for (let px = 0, i = py * width; px < width; px++, i++) {
        if (rowKind[px] !== k) continue;
        let b = bits[i];
        let x = pT[px];
        if (x + (pB[px] - x) * pY >= cut) b |= 16;
        if (has) {
            x = aT[px];
            let m = moundKeep * (x + (aB[px] - x) * aY);
            if (m <= mound && m + moundFine > mound) {
                const y = AT[px];
                m += moundFine * (y + (AB[px] - y) * AY);
            }
            if (m > mound) b |= 32;
        }
        bits[i] = b;
        kinds[i] = code;
    }
}

/** The sorted distances at which a water look's drawing changes: its classes lie between them. */
export function waterBands(water) {
    const at = new Set([water.foam / 2, water.foam, 3 * water.foam, water.shallow, water.deep, water.farThick, ...water.waveLengths.map(([d]) => d)]);
    return [...at].sort((a, b) => a - b);
}

/**
 * How far the shore's distance is measured for each side, in pixels: past the last change and the
 * wobble, everything is the same.
 */
const waterReach = (water) => Math.ceil(Math.max(...waterBands(water)) + GRASS_RULES.shoreWobble / 2 + 1);
const shoreReach = (shore) => Math.ceil(shore.wet + GRASS_RULES.shoreWobble / 2 + 1);

/**
 * One plan row of a water look: its texture bits, and its class by distance from the shore (1 at
 * the shore, one more past each of its bands; far water, which the walk never reached, the last).
 */
function waterRow(ctx, look, py) {
    const { width, at, slotOf, bits, kinds, shore, waterDist } = ctx;
    const { slot, bands, mask } = look;
    const R = GRASS_RULES;
    const { shoreN, foamN } = ctx;
    const { patchN } = look;
    const code = (slot << SLOT_SHIFT) | 1;
    const sT = shoreN.top, sB = shoreN.bottom, sY = shoreN.fy;
    const fT = foamN.top, fB = foamN.bottom, fY = foamN.fy;
    const pT = patchN.top, pB = patchN.bottom, pY = patchN.fy;
    const far = 1 + bands.length;
    for (let px = 0, i = py * width; px < width; px++, i++) {
        if (slotOf[at[i]] !== slot) continue;
        kinds[i] = code;
        let x = sT[px];
        const wobble = x + (sB[px] - x) * sY;
        let b = 0;
        x = fT[px];
        if (x + (fB[px] - x) * fY > R.foamLight) b |= 1;
        if (wobble > R.shallowLight) b |= 2;
        x = pT[px];
        if (x + (pB[px] - x) * pY >= mask) b |= 16;
        bits[i] = b;
        const d = waterDist ? waterDist[i] : 0;
        if (!d) {
            shore[i] = far;
            continue;
        }
        const e = (d - 1) / 3 - 0.5;
        const f = Math.max(0, e + (wobble - 0.5) * R.shoreWobble * Math.min(1, e / R.shoreTaper));
        shore[i] = 1 + bandOf(bands, f);
    }
}

/** One plan row of a land look with a `shore`: its wet sand and waterline where it meets water. */
function shoreRow(ctx, look, py) {
    const { width, at, slotOf, shore, shoreDist, shoreN } = ctx;
    const { slot } = look;
    const { wet, line } = look.rules.shore;
    const R = GRASS_RULES;
    const sT = shoreN.top, sB = shoreN.bottom, sY = shoreN.fy;
    for (let px = 0, i = py * width; px < width; px++, i++) {
        const d = shoreDist[i];
        if (!d || slotOf[at[i]] !== slot) continue;
        const e = (d - 1) / 3 - 0.5;
        const x = sT[px];
        const f = -e + ((x + (sB[px] - x) * sY) - 0.5) * R.shoreWobble * Math.min(1, e / R.shoreTaper);
        shore[i] = f < -wet ? 0 : f < -line ? SHORE.WET : SHORE.LINE;
    }
}

/**
 * A look's lakes: `perFrame` of them in every prototype-sized piece of the plan (times the Sulphur
 * lakes slider), each somewhere on the mat away from its edge, a radius between the two given.
 *
 * @returns {Array<{x: number, y: number, r: number}>} in plan pixels
 */
export function poolCentres(width, height, seed, pools) {
    const R = GRASS_RULES;
    const count = Math.round(pools.perFrame * (width * height) / (R.frame.w * R.frame.h) * Math.max(0, tuning('groundLakes')));
    const salt = saltOf(seed, SALT.POOL_PLACE);
    const u = (k, axis) => hash(k, axis, salt) / 4294967296;
    const span = 1 - 2 * R.poolMargin;
    const [r0, r1] = pools.radius;
    return Array.from({ length: count }, (_, k) => ({
        x: (R.poolMargin + span * u(k, 0)) * width,
        y: (R.poolMargin + span * u(k, 1)) * height,
        r: r0 + (r1 - r0) * u(k, 2)
    }));
}

/**
 * The ring of a lake a pixel lies in, the slow way: 0 for none, else 1 (the deep middle) to the
 * number of rings (the crust at the rim). Every lake's squashed distance plus a little noise, the
 * nearest one's.
 */
export function poolRingAt(px, py, seed, pools, centres) {
    const R = GRASS_RULES;
    let best = Infinity;
    for (const { x, y, r } of centres) best = Math.min(best, Math.hypot((px - x) / r, (py - y) / (r * R.poolSquash)));
    if (best === Infinity) return 0;
    const d = best + (grassNoise(px, py, seed, R.poolCell, CH.POOL) - 0.5) * R.poolNoise
        + (grassNoise(px, py, seed, R.poolFineCell, CH.POOL_FINE) - 0.5) * R.poolFineNoise;
    for (let k = 0; k < pools.rings.length; k++) if (d < pools.rings[k][0]) return k + 1;
    return 0;
}

/**
 * One plan row of a look's lakes: only near a lake's centre (no noise reaches a ring from further
 * than `reach` times its radius), and only on the look's own ground.
 */
function poolRow(ctx, look, py) {
    const { width, at, slotOf, ring, rowBest, poolN, poolFineN } = ctx;
    const { slot, centres, rings } = look;
    const R = GRASS_RULES;
    const outer = rings[rings.length - 1][0];
    const reach = outer + 0.5 * R.poolNoise + 0.5 * R.poolFineNoise;
    const near = [];
    let lo = width;
    let hi = -1;
    for (const { x, y, r } of centres) {
        const dy = (py - y) / (r * R.poolSquash);
        if (Math.abs(dy) >= reach) continue;
        const half = Math.sqrt(reach * reach - dy * dy) * r;
        const a = Math.max(0, Math.ceil(x - half));
        const b = Math.min(width - 1, Math.floor(x + half));
        if (a > b) continue;
        near.push([x, r, dy, a, b]);
        lo = Math.min(lo, a);
        hi = Math.max(hi, b);
    }
    if (lo > hi) return;
    rowBest.fill(Infinity, lo, hi + 1);
    for (const [x, r, dy, a, b] of near) {
        for (let px = a; px <= b; px++) {
            const g = Math.hypot((px - x) / r, dy);
            if (g < rowBest[px]) rowBest[px] = g;
        }
    }
    const nT = poolN.top, nB = poolN.bottom, nY = poolN.fy;
    const mT = poolFineN.top, mB = poolFineN.bottom, mY = poolFineN.fy;
    for (let px = lo, i = py * width + lo; px <= hi; px++, i++) {
        const g = rowBest[px];
        if (!(g < reach) || slotOf[at[i]] !== slot) continue;
        let x = nT[px];
        const y = mT[px];
        const d = g + ((x + (nB[px] - x) * nY) - 0.5) * R.poolNoise + ((y + (mB[px] - y) * mY) - 0.5) * R.poolFineNoise;
        for (let k = 0; k < rings.length; k++) {
            if (d < rings[k][0]) { ring[i] = k + 1; break; }
        }
    }
}

/**
 * The generated looks' shapes over a Region's plan.
 *
 * Each pixel keeps the mound of its own kind only (the kinds' mounds differ in size): a neighbour
 * of another kind is never read as mound or open grass ({@link drawGrass}), so no mound edge follows
 * a zone's border.
 *
 * @param {object} pixels A resolved map from `resolveArtPixels`.
 * @param {number} seed The Region's seed.
 * @param {string[]} looks The look of each palette entry.
 * @returns {null|{looks: string[], slotOf: Int8Array, bits: Uint8Array, kinds: Uint8Array,
 *   thresholds: Array<object|null>, shore: Uint8Array|null, ring: Uint8Array|null,
 *   bands: Array<number[]|null>}} Null when no look here is generated. Per plan pixel, row by row:
 *   `kinds` 0 where the ground is not generated, else `(slot << SLOT_SHIFT) | (kind + 1)`, `slot`
 *   indexing `looks` (and `thresholds`, each land look's levels; `bands`, each water look's
 *   distances), `kind` its `kinds` in the registry (0 for water); `bits` the {@link BIT} flags of
 *   land and the {@link WATER_BIT} flags of water; `shore` a water pixel's class by distance and a
 *   land pixel's {@link SHORE} byte; `ring` a lake's ring, 1 the middle. `slotOf[p]` is palette
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
    if (slots.length > KIND_MASK) throw new RangeError(`at most ${KIND_MASK} generated looks in one Region`);

    const n = width * height;
    const rowHas = new Uint8Array(height);
    for (let py = 0; py < height; py++) {
        const base = py * width;
        for (let px = 0; px < width; px++) {
            if (slotOf[at[base + px]] >= 0) { rowHas[py] = 1; break; }
        }
    }

    const R = GRASS_RULES;
    const walker = (cell, ch, cellY = cell) => noiseWalker(width, height, seed, cell, cellY, ch);
    const clump = grassCells(slots[0]);
    const shared = {
        clumpN: walker(clump.clump, CH.CLUMP),
        fineN: walker(clump.fine, CH.FINE),
        wearN: walker(R.earthCell, CH.EARTH),
        wearFineN: walker(R.earthFineCell, CH.EARTH_FINE),
        encN: walker(R.encroachCell, CH.ENCROACH),
        jagN: walker(R.zoneJagCell, CH.JAG),
        clodN: walker(R.clodCell, CH.CLOD)
    };
    const patches = new Map();
    const patchOf = (cell) => {
        if (!patches.has(cell)) patches.set(cell, walker(cell, patchChannel(cell)));
        return patches.get(cell);
    };

    const rules = slots.map(lookRules);
    const land = [];
    const water = [];
    let pooled = false;
    slots.forEach((id, slot) => {
        const r = rules[slot];
        if (r.water) {
            water.push({ slot, rules: r, bands: waterBands(r.water), mask: r.water.waveMask, patchN: walker(r.water.wavePatchCell, CH.WAVE_PATCH) });
            return;
        }
        const cells = grassCells(id);
        const zoneN = walker(cells.zoneX, CH.ZONE, cells.zoneY);
        const ov = r.overlay;
        const look = {
            slot, rules: r, cells, zoneN,
            levels: calibrate(width, height, shared, zoneN, r, r.earthShare * tuning('grassEarth')),
            encroach: r.encroach + offset('grassEncroach'),
            gapN: r.zones.gap ? walker(r.zones.gap.cell, CH.GAP) : null,
            overlayN: ov ? [walker(ov.cell, CH.OVERLAY), walker(ov.fineCell, CH.OVERLAY_FINE), walker(ov.jagCell, CH.OVERLAY_JAG)] : null,
            kindShape: r.kinds.map((kind, k) => ({
                patchN: patchOf(kind.patch.cell),
                patchCut: patchCut(kind),
                moundN: kind.mounds > 0 ? walker(cells.mounds[k], CH.MOUND + k) : null,
                moundFineN: kind.mounds > 0 ? walker(cells.moundFine[k], CH.MOUND_FINE + k) : null
            })),
            centres: r.pools ? poolCentres(width, height, seed, r.pools) : null,
            rings: r.pools ? r.pools.rings : null
        };
        if (look.centres?.length) pooled = true;
        land.push(look);
    });

    const ctx = {
        ...shared,
        width, at, slotOf,
        bits: new Uint8Array(n), kinds: new Uint8Array(n), rowKind: new Int8Array(width),
        shore: null, ring: null, waterDist: null, shoreDist: null, shoreN: null, foamN: null
    };

    // The shore: each side's distance from the water, measured on the drawn coastline.
    const shoreLooks = land.filter(l => l.rules.shore);
    if (water.length) {
        const fields = pixels.fields || distanceFields(at, width, height);
        const wet = [];
        palette.forEach((t, p) => { if (slotOf[p] >= 0 && rules[slotOf[p]].water) wet.push(p); });
        ctx.waterDist = fields.from(wet, true, 3 * Math.max(...water.map(w => waterReach(w.rules.water)))).dist;
        if (shoreLooks.length) ctx.shoreDist = fields.from(wet, false, 3 * Math.max(...shoreLooks.map(l => shoreReach(l.rules.shore)))).dist;
        ctx.shore = new Uint8Array(n);
        ctx.shoreN = walker(R.shoreCell, CH.SHORE);
        ctx.foamN = walker(R.foamCell, CH.FOAM);
    }
    if (pooled) {
        ctx.ring = new Uint8Array(n);
        ctx.rowBest = new Float64Array(width);
        ctx.poolN = walker(R.poolCell, CH.POOL);
        ctx.poolFineN = walker(R.poolFineCell, CH.POOL_FINE);
    }

    const sharedWalkers = [...Object.values(shared), ...patches.values(),
        ...[ctx.shoreN, ctx.foamN, ctx.poolN, ctx.poolFineN].filter(Boolean)];
    const shoreHere = ctx.shoreDist !== null;
    for (let py = 0; py < height; py++) {
        if (!rowHas[py]) continue;
        for (const w of sharedWalkers) w.walk(py);
        for (const look of land) {
            look.zoneN.walk(py);
            if (look.gapN) look.gapN.walk(py);
            if (look.overlayN) for (const w of look.overlayN) w.walk(py);
            for (const k of look.kindShape) {
                if (k.moundN) { k.moundN.walk(py); k.moundFineN.walk(py); }
            }
            shapeRow(ctx, look, py);
            if (shoreHere && look.rules.shore) shoreRow(ctx, look, py);
            if (look.centres?.length) poolRow(ctx, look, py);
        }
        for (const look of water) {
            look.patchN.walk(py);
            waterRow(ctx, look, py);
        }
    }
    const thresholds = slots.map((id, slot) => land.find(l => l.slot === slot)?.levels || null);
    const bands = slots.map((id, slot) => water.find(w => w.slot === slot)?.bands || null);
    return { looks: slots, slotOf, bits: ctx.bits, kinds: ctx.kinds, thresholds, shore: ctx.shore, ring: ctx.ring, bands };
}

// ---------------------------------------------------------------------------------------------
// Details, per ground pixel

/**
 * A ground pixel's shape byte: the plan's {@link BIT} flags with `ON` set where land is generated,
 * so one read says grass, earth or neither (water reads as neither: it has its own pass).
 */
const ON = 64;
const ON_EARTH = ON | BIT.EARTH;

const E0 = COLOUR.EARTH;
const E1 = E0 + 1;
const E2 = E0 + 2;
const E3 = E0 + 3;
const E4 = E0 + 4;

/** The plan's shapes read at each ground pixel of row `r`; the earth's and the water's pixels are listed. */
function resampleRow(ctx, r) {
    const { shape, kinds, colour, earth, water, isWater, cols, planCol, planKinds, planBits } = ctx;
    const pr = ctx.planRow[r];
    let count = ctx.count;
    let wet = ctx.wet;
    for (let c = 0, i = r * cols; c < cols; c++, i++) {
        const p = pr + planCol[c];
        const k = planKinds[p];
        kinds[i] = k;
        if (!k || isWater[k]) {
            shape[i] = 0;
            colour[i] = 255;
            if (k) water[wet++] = i;
            continue;
        }
        const s = planBits[p] | ON;
        shape[i] = s;
        if (s & 1) earth[count++] = i;
    }
    ctx.count = count;
    ctx.wet = wet;
}

/**
 * The body, the mounds' lit tops and shadowed bottoms, and the earth's clods, lighter middle and
 * sunken edge, along row `r`: each pixel worked out from its neighbours.
 *
 * ⚠️ A mound reads only neighbours of its own kind; any other (another kind, or ground that is not
 * generated) counts as the pixel itself, so a mound never draws an edge along a zone or a beach.
 */
function bodyRow(ctx, r) {
    const { shape, kinds, colour, cols, rows, mounds, shadowCut, diagonalCut, lightCuts, base, high, sLight, sShadow, sDiagonal } = ctx;
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
        const k = kinds[i];
        let col = s & HIGH ? high[k] : base[k] + SOFT;
        if (mounds && up) {
            const ju = i + up;
            const u = shape[ju];
            if (s & MOUND) {
                // A lit top: open grass of its kind above, more mound below.
                const jd = i + down;
                if (kinds[ju] === k && !(u & MOUND) && (kinds[jd] !== k || (shape[jd] & MOUND))
                    && hash(c, r, sLight) < lightCuts[k]) col = base[k] + 3;
            } else if ((u & ON_EARTH) === ON && kinds[ju] === k && (u & MOUND)) {
                // Under a mound's bottom edge.
                if (hash(c, r - 1, sShadow) < shadowCut) col = base[k] + 1;
            } else if (left) {
                // Under and right of a bottom edge, now and then.
                const jl = ju - 1;
                const l = shape[jl];
                if ((l & ON_EARTH) === ON && kinds[jl] === k && (l & MOUND)
                    && (kinds[i - 1] !== k || !(shape[i - 1] & MOUND))
                    && hash(c - 1, r - 1, sDiagonal) < diagonalCut) col = base[k] + 1;
            }
        }
        colour[i] = col;
    }
}

/**
 * The blade strokes whose clusters are centred on row `r`: each stroke lit at its tip and with a
 * shadow pixel under its right; rows are drawn top to bottom, so a lower stroke stands in front. A
 * stroke stays on ground of its own kind.
 *
 * The centres come at the busiest kind's chance, in gaps drawn from it (a geometric gap per centre
 * rather than a hash per pixel), and each is kept at its own kind's share of that chance.
 */
function strokesRow(ctx, r) {
    const { shape, kinds, colour, cols, rows, strokeKinds, sCentre, sPatch, sGap, gapLog, leanCut, strokeSalts, moreSalts } = ctx;
    const PATCH = BIT.PATCH;
    let c = -1;
    for (;;) {
        if (gapLog === 0) c++;
        else c += 1 + Math.floor(Math.log((hash(c, r, sGap) + 0.5) / 4294967296) / gapLog);
        if (c >= cols) return;
        const i = r * cols + c;
        const k = kinds[i];
        const spec = strokeKinds[k];
        if (!spec) continue;
        if (hash(c, r, sCentre) >= spec.keepCut) continue;
        if (!(shape[i] & PATCH) && hash(c, r, sPatch) >= spec.floorCut) continue;
        const { tipCut, shadowAt, tone, tip, dark } = spec;
        const spread = spec.cluster > 1;
        for (let s = 0; s < spec.cluster; s++) {
            const h = hash(c, r, strokeSalts[s]);
            const x = c + (spread ? (((h & 255) * 3) >>> 8) - 1 : 0);
            const y = r + (spread ? ((((h >>> 8) & 255) * 3) >>> 8) - 1 : 0);
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
            if ((shape[y * cols + x] & ON_EARTH) !== ON) continue;
            const height = spec.heights[(((h >>> 16) & 255) * spec.heights.length) >>> 8];
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
                if ((shape[j] & ON_EARTH) === ON && kinds[j] === k) colour[j] = dark;
            }
        }
    }
}

/**
 * The earth's small things, each covering the last: pebbles; the grass's own tufts out in the
 * earth; and its edge, grass hanging over the top as a tuft of one or two pixels (else a dark
 * rim) and now and then a grass pixel on its sides. Each pixel in the colours of its own kind of
 * ground, as each of the prototype's layers drew its own.
 */
function drawEarthDetails(ctx, seed) {
    const { shape, kinds, colour, earth, cols, rows, count, base } = ctx;
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
                if (shape[jt]) colour[jt] = base[kinds[jt]] + (t === height - 1 && lit ? 3 : 2);
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
        const g = base[kinds[i]];
        if (r > 0 && isGrass(i - cols)) {
            const h = hash(c, r, sEdge);
            if ((h & 0xffff) < edgeCut) {
                colour[i] = g + 3;
                if (((h >>> 16) & 1) && r + 1 < rows && shape[i + cols]) colour[i + cols] = base[kinds[i + cols]] + 2;
            } else colour[i] = E0;
        } else if (((c > 0 && isGrass(i - 1)) || (c < cols - 1 && isGrass(i + 1))) && hash(c, r, sSide) < sideCut) {
            colour[i] = g + 2;
        }
    }
}

/**
 * An overlay's edge (the cherry grove's green patches): blades of the patch's grass reaching up
 * over its top edge into the ground round it, and a soft shadow under its bottom edge.
 */
function drawOverlayEdges(ctx, seed, slot, ov) {
    const { shape, kinds, colour, cols, rows, base } = ctx;
    const patch = (slot << SLOT_SHIFT) | (ov.kind + 1);
    const g = base[patch];
    const bladeCut = cut32(ov.blades);
    const dimCut = cut32(ov.shadow);
    const sEdge = saltOf(seed, SALT.OVER_EDGE);
    const sHeight = saltOf(seed, SALT.OVER_HEIGHT);
    const sDim = saltOf(seed, SALT.OVER_DIM);
    const ours = (j) => shape[j] && (kinds[j] >> SLOT_SHIFT) === slot;
    for (let r = 2; r < rows - 1; r++) {
        for (let c = 1, i = r * cols + 1; c < cols - 1; c++, i++) {
            if (!ours(i)) continue;
            const k = kinds[i];
            const u = kinds[i - cols];
            if (k === patch) {
                if (u === patch || !ours(i - cols) || hash(c, r, sEdge) >= bladeCut) continue;
                const height = ov.heights[hash(c, r, sHeight) % ov.heights.length];
                for (let t = 0; t < height && r - t >= 0; t++) {
                    const j = i - t * cols;
                    if (ours(j)) colour[j] = t === 0 ? g + 3 : g + 2;
                }
            } else if (u === patch && colour[i] < COLOUR.DIM && hash(c, r, sDim) < dimCut) {
                colour[i] += COLOUR.DIM;
            }
        }
    }
}

/** Wet sand, and a waterline dithered against it, on land whose plan pixel says so. */
function drawShore(ctx) {
    const { shape, colour, cols, rows, planCol, planRow, planShore } = ctx;
    for (let r = 0; r < rows; r++) {
        const pr = planRow[r];
        for (let c = 0, i = r * cols; c < cols; c++, i++) {
            if (!shape[i]) continue;
            const v = planShore[pr + planCol[c]];
            if (v === SHORE.WET) colour[i] = COLOUR.WET;
            else if (v === SHORE.LINE) colour[i] = (c + 2 * r) % 4 ? COLOUR.LINE : COLOUR.WET;
        }
    }
}

/**
 * What each of a water look's distance classes draws, worked out at the middle of its range (every
 * rule is a step at one of the bands' distances, so any distance in a class answers the same).
 */
function waterClasses(water, bands) {
    const out = [null];
    for (let c = 0; c <= bands.length; c++) {
        const f = c === 0 ? bands[0] / 2 : c === bands.length ? bands[c - 1] + 1 : (bands[c - 1] + bands[c]) / 2;
        let lengths = null;
        for (const [from, lens] of water.waveLengths) if (f >= from) lengths = lens;
        const deep = f >= water.deep;
        out.push({
            // 0 a colour of its own; 1 the foam's two whites; 2 the shallows' two blues
            mix: f < water.foam / 2 ? 0 : f < water.foam ? 1 : f < water.shallow ? 2 : 0,
            colour: f < water.foam ? COLOUR.FOAM : deep ? COLOUR.SEA : COLOUR.SEA + 1,
            fleck: f > water.foam && f < 3 * water.foam,
            waves: f > water.shallow && lengths !== null,
            lengths,
            crest: deep ? COLOUR.SEA + 2 : COLOUR.SEA + 3,
            trough: deep ? COLOUR.TROUGH : COLOUR.SEA,
            thick: f >= water.farThick
        });
    }
    return out;
}

/**
 * The sea: each pixel's colour by its distance class, foam flecks off the foam line, then the
 * waves, row by row, a crest of a light tone over a darker trough one row below, longer the further
 * out, none within `waveGap` pixels of another's crest, far out with a second, shorter crest above.
 */
function drawWater(ctx, grass, seed) {
    const { colour, kinds, cols, rows, water, wet, planCol, planRow, planBits, planShore, occ, isWater } = ctx;
    const classesBySlot = grass.looks.map((id, slot) => (grass.bands[slot] ? waterClasses(lookRules(id).water, grass.bands[slot]) : null));
    const specBySlot = grass.looks.map(id => lookRules(id).water);
    const classAt = (i) => {
        const r = (i / cols) | 0;
        return classesBySlot[kinds[i] >> SLOT_SHIFT][planShore[planRow[r] + planCol[i - r * cols]]];
    };
    const sFleck = saltOf(seed, SALT.FLECK);
    for (let e = 0; e < wet; e++) {
        const i = water[e];
        const r = (i / cols) | 0;
        const c = i - r * cols;
        const p = planRow[r] + planCol[c];
        const w = specBySlot[kinds[i] >> SLOT_SHIFT];
        const cls = classesBySlot[kinds[i] >> SLOT_SHIFT][planShore[p]];
        let col = cls.colour;
        if (cls.mix === 1) col = planBits[p] & WATER_BIT.FOAM_LIGHT ? COLOUR.FOAM : COLOUR.FOAM2;
        else if (cls.mix === 2) col = planBits[p] & WATER_BIT.SHALLOW_LIGHT ? COLOUR.SEA + 3 : COLOUR.SEA + 2;
        if (cls.fleck && hash(c, r, sFleck) < cut32(w.flecks)) col = COLOUR.FOAM2;
        colour[i] = col;
    }

    const waves = [];
    const busiest = Math.max(...specBySlot.map(w => (w ? w.waves : 0)));
    if (!(busiest > 0)) return waves;
    occ.fill(0, 0, cols * rows);
    const gapLog = busiest >= 1 ? 0 : Math.log(1 - busiest);
    const sGap = saltOf(seed, SALT.WAVE_GAP);
    const sWave = saltOf(seed, SALT.WAVE);
    const sameSea = (j, k) => kinds[j] === k && classAt(j).waves;
    for (let r = 1; r < rows - 2; r++) {
        let c = -1;
        for (;;) {
            if (gapLog === 0) c++;
            else c += 1 + Math.floor(Math.log((hash(c, r, sGap) + 0.5) / 4294967296) / gapLog);
            if (c >= cols - 6) break;
            const i = r * cols + c;
            const k = kinds[i];
            if (!isWater[k]) continue;
            const w = specBySlot[k >> SLOT_SHIFT];
            const h = hash(c, r, sWave);
            if (h >= cut32(w.waves / busiest) && busiest !== w.waves) continue;
            const cls = classAt(i);
            if (!cls.waves || !(planBits[planRow[r] + planCol[c]] & WATER_BIT.WAVES)) continue;
            const L = cls.lengths[(h >>> 8) % cls.lengths.length];
            if (c + L + 2 >= cols) continue;
            const g = w.waveGap;
            let taken = false;
            for (let yy = Math.max(0, r - g); yy < Math.min(rows, r + g + 2) && !taken; yy++) {
                for (let xx = Math.max(0, c - g), j = yy * cols + xx; xx < Math.min(cols, c + L + g); xx++, j++) {
                    if (occ[j]) { taken = true; break; }
                }
            }
            if (taken) continue;
            waves.push({ x: c, y: r, length: L, far: cls.thick });
            for (let t = 0; t < L; t++) occ[i + t] = 1;
            for (let t = 0; t < L; t++) {
                if (sameSea(i + t, k)) colour[i + t] = cls.crest;
                if (t >= 1 && sameSea(i + cols + t, k)) colour[i + cols + t] = cls.trough;
            }
            if (cls.thick) {
                for (let t = 1; t < L - 1; t++) {
                    const j = i - cols + t + 1;
                    if (sameSea(j, k)) colour[j] = cls.crest;
                }
            }
        }
    }
    return waves;
}

/** The lakes' rings over everything else on their look's ground. */
function drawRings(ctx) {
    const { shape, colour, cols, rows, planCol, planRow, planRing } = ctx;
    for (let r = 0; r < rows; r++) {
        const pr = planRow[r];
        for (let c = 0, i = r * cols; c < cols; c++, i++) {
            if (!shape[i]) continue;
            const v = planRing[pr + planCol[c]];
            if (v) colour[i] = COLOUR.RING + v - 1;
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
 *   resize then reuses them instead of allocating several screens' worth. The arrays returned
 *   belong to it and the next call overwrites them.
 * @returns {{colour: Uint8Array, kinds: Uint8Array, waves: Array<{x: number, y: number, length: number,
 *   far: boolean}>}} per ground pixel, row by row: `colour` a {@link COLOUR} index of the pixel's
 *   look ({@link COLOUR}.NONE where the ground is not generated), `kinds` the plan's kind byte
 *   under it (its slot is `kinds >> SLOT_SHIFT`); and the waves drawn, each by its crest's left end
 *   in ground pixels, `far` with a second crest.
 */
export function drawGrass(grass, seed, cols, rows, planCol, planRow, scratch = null) {
    const total = cols * rows;
    let buffers = scratch;
    if (!buffers || buffers.total !== total) {
        buffers = {
            total,
            shape: new Uint8Array(total), kinds: new Uint8Array(total),
            colour: new Uint8Array(total), earth: new Int32Array(total), water: null, occ: null
        };
        if (scratch) Object.assign(scratch, buffers);
    }
    const hasWater = grass.bands.some(Boolean);
    if (hasWater && !buffers.water) {
        buffers.water = new Int32Array(total);
        buffers.occ = new Uint8Array(total);
    }
    const R = GRASS_RULES;

    // Per kind byte: where its colours start, its body's lighter tone, its mounds' light, its strokes.
    const base = new Int16Array(256);
    const high = new Int16Array(256);
    const lightCuts = new Array(256).fill(0);
    const isWater = new Uint8Array(256);
    const strength = Math.max(0, tuning('grassMounds'));
    const byKind = [];
    grass.looks.forEach((id, slot) => {
        const rules = lookRules(id);
        if (rules.water) { isWater[(slot << SLOT_SHIFT) | 1] = 1; return; }
        rules.kinds.forEach((kind, k) => {
            const b = (slot << SLOT_SHIFT) | (k + 1);
            base[b] = kindColour(k, COLOUR.GRASS);
            high[b] = base[b] + kind.body[1];
            lightCuts[b] = cut32(kind.moundLight * strength);
            byKind.push([b, kind]);
        });
    });

    const ctx = {
        shape: buffers.shape, kinds: buffers.kinds, colour: buffers.colour, earth: buffers.earth,
        water: buffers.water, occ: buffers.occ, isWater, base, high, lightCuts,
        cols, rows, planCol, planRow, planKinds: grass.kinds, planBits: grass.bits,
        planShore: grass.shore, planRing: grass.ring, count: 0, wet: 0
    };
    for (let r = 0; r < rows; r++) resampleRow(ctx, r);

    ctx.mounds = strength > 0;
    ctx.shadowCut = cut32(strength);
    ctx.diagonalCut = cut32(R.moundDiagonal * strength);
    ctx.sLight = saltOf(seed, SALT.LIGHT);
    ctx.sShadow = saltOf(seed, SALT.SHADOW);
    ctx.sDiagonal = saltOf(seed, SALT.DIAGONAL);
    for (let r = 0; r < rows; r++) bodyRow(ctx, r);

    // Every look's kinds: the centres come at the busiest kind's chance.
    const density = Math.max(0, tuning('grassStrokes'));
    const chances = byKind.map(([, kind]) => Math.min(1, kind.blades * density));
    const busiest = Math.max(0, ...chances);
    if (busiest > 0) {
        const mostStrokes = Math.max(...byKind.map(([, kind]) => kind.cluster));
        ctx.strokeKinds = new Array(256).fill(null);
        byKind.forEach(([b, kind], j) => {
            const strokes = base[b] + (kind.strokes ? COLOUR.STROKES : COLOUR.GRASS);
            ctx.strokeKinds[b] = {
                keepCut: cut32(chances[j] / busiest),
                floorCut: cut32(patchFloor(kind)),
                cluster: kind.cluster, heights: kind.heights,
                tipCut: Math.round(kind.tips * 65536), shadowAt: Math.round(kind.shadow * 65536),
                tone: strokes + kind.tone, tip: strokes + 4, dark: base[b]
            };
        });
        ctx.gapLog = busiest >= 1 ? 0 : Math.log(1 - busiest);
        ctx.sCentre = saltOf(seed, SALT.CENTRE);
        ctx.sPatch = saltOf(seed, SALT.PATCH);
        ctx.sGap = saltOf(seed, SALT.GAP);
        ctx.leanCut = Math.round(R.lean * 256);
        ctx.strokeSalts = Array.from({ length: mostStrokes }, (_, s) => saltOf(seed, SALT.STROKE + s));
        ctx.moreSalts = Array.from({ length: mostStrokes }, (_, s) => saltOf(seed, SALT.STROKE_MORE + s));
        for (let r = 0; r < rows; r++) strokesRow(ctx, r);
    }

    drawEarthDetails(ctx, seed);
    grass.looks.forEach((id, slot) => {
        const ov = lookRules(id).overlay;
        if (ov) drawOverlayEdges(ctx, seed, slot, ov);
    });
    if (grass.shore && grass.looks.some(id => lookRules(id).shore)) drawShore(ctx);
    const waves = hasWater ? drawWater(ctx, grass, seed) : [];
    if (grass.ring) drawRings(ctx);
    return { colour: buffers.colour, kinds: buffers.kinds, waves };
}
