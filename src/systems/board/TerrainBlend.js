// the borders between two biomes' ground drawn as one of the owner's blends

import { hash01, PLAN_PIXEL_U } from './TerrainLattice.js';
import { noiseWalker, drawsGenerated, grassColours, kindColour, COLOUR } from './TerrainGrass.js';
import { generatedOf, getLook, DEFAULT_LOOK, LAWN_TERRAIN } from '../../config/registries/terrainRegistry.js';
import { TERRAIN } from '../atlas/TerrainMap.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Where two biomes' grounds meet (a forest's grass and a mountain's rock), the drawing blends them
 * across a band either side of the border the cells give, in one of the styles the owner chose in
 * the world rounds (`docs/active/research/ground_gen/world2.py` to `world4.py`). Each pair of
 * grounds in a Region takes one style, picked by the Region's seed among those that suit the pair.
 *
 * ⚠️ Drawing only. The cells, and so placement and "Stands on", stay as stored: this rewrites the
 * plan's pixel map (`resolveArtPixels`) before the beach is cut and the distances measured, so all
 * that is drawn after it (the generated ground, the props, the beach) follows the blend. Water is
 * never touched, nor ever written: only land of two looks drawn by rules takes part.
 */

/** The styles. */
export const BLEND = Object.freeze({
    BAND: 'band', ISLANDS: 'islands', FINGERS: 'fingers', LAWN: 'lawn', FADE: 'fade'
});

/** The order the Blend style slider counts them in; 0 on the slider leaves the pick to the seed. */
export const BLEND_ORDER = Object.freeze([BLEND.BAND, BLEND.ISLANDS, BLEND.FINGERS, BLEND.LAWN, BLEND.FADE]);

/**
 * The prototype's rules in plan pixels (a prototype pixel is a plan pixel), each style's reach a
 * share of the band's half-width `H` (half the Blend width slider). Every style first lets the
 * border wander by up to `wander` of `H` on a noise of `wanderCell`, as the prototype's border did:
 * measured from the cells' border alone, the pieces' edges ran in the straight lines of its steps.
 * - **band** (`world2.py` B, mixed band): clumps of `bandCell`; a pixel `s` across the border takes
 *   the far ground where the clump noise is under `(s + H) / 2H`.
 * - **islands** (`world2.py` C): blobs of `islandCell` of the reach, pushing the border up to the
 *   whole reach either way, so pieces of each ground lie loose in the other.
 * - **fingers** (`world3.py` A): the border pushed by a noise read where the pixel's nearest point
 *   of the border lies, so the push changes along the border and not across it: tongues of each
 *   ground into the other, `fingerCell` of the reach apart.
 * - **lawn** (`world3.py` B, transition ground): a strip of lawn from `lawnFrom` of the band on the
 *   soft side to `lawnTo` on the hard side, edges ragged by `jag` pixels, with flecks of the hard
 *   ground (rock, sand) more often toward it.
 * - **fade** (`world4.py` C, gradient): the band's rule on two fine noises, and in its middle two of
 *   `steps` steps every pixel takes `fadeTint` of the other ground's colour at the step's middle.
 */
export const BLEND_RULES = Object.freeze({
    wanderCell: 28, wander: 0.3,
    bandCell: 7,
    islandReach: 1.5, islandCell: 0.3,
    fingerReach: 1.5, fingerCell: 0.35,
    lawnFrom: 0.6, lawnTo: 0.9, fleckCell: 9, fleckCut: 0.66, fleckRise: 0.18, jagCell: 6, jag: 6,
    fadeCells: Object.freeze([3, 5]), fadeWeight: 0.7, steps: 4, fadeTint: 0.35
});

/** How much of the other ground's colour a fade's middle steps take. */
export const FADE_TINT = BLEND_RULES.fadeTint * (1 - Math.abs(1 / (BLEND_RULES.steps - 1) - 0.5) * 2);

/** Hash channels of the blends' noises and of the style pick. */
const CH = Object.freeze({
    PICK: 0x7b00, BAND: 0x7b01, ISLAND: 0x7b02, FINGER: 0x7b03, FLECK: 0x7b04, JAG: 0x7b05, FADE: 0x7b06, FADE_FINE: 0x7b07,
    WANDER: 0x7b08
});

/** Looks with no lawn between them and the rock or sand: a meadow's own grass is a lawn already; lava grows none. */
const NO_LAWN = new Set(['meadow', 'flower_meadow', 'lawn', 'volcano']);

/** Which way a pair faces: the softer ground first (grass, then sand, then rock). */
const SOFTNESS = Object.freeze({ [TERRAIN.GRASS]: 0, [TERRAIN.SAND]: 1, [TERRAIN.ROCK]: 2 });

const softness = (lookId) => SOFTNESS[getLook(lookId)?.terrain] ?? 3;

/** A pair of looks in its order: the softer first, then by id. */
export function pairOf(a, b) {
    const sa = softness(a);
    const sb = softness(b);
    return sa < sb || (sa === sb && a < b) ? [a, b] : [b, a];
}

/** Whether a lawn suits a pair: a wood's grass on one side, rock or sand on the other. */
function lawnSuits(soft, hard) {
    const s = getLook(soft)?.terrain;
    const h = getLook(hard)?.terrain;
    return s === TERRAIN.GRASS && (h === TERRAIN.ROCK || h === TERRAIN.SAND) && !NO_LAWN.has(soft) && !NO_LAWN.has(hard);
}

/** The styles a pair of looks may take: every pair the band, islands, fingers and the fade; a lawn where it suits. */
export function blendStylesFor(a, b) {
    const [soft, hard] = pairOf(a, b);
    return lawnSuits(soft, hard)
        ? [BLEND.BAND, BLEND.ISLANDS, BLEND.FINGERS, BLEND.LAWN, BLEND.FADE]
        : [BLEND.BAND, BLEND.ISLANDS, BLEND.FINGERS, BLEND.FADE];
}

/** A pair's own number, the same whichever way round it is named. */
function pairHash(a, b) {
    const [x, y] = pairOf(a, b);
    let h = 0x811c9dc5;
    const text = `${x}|${y}`;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return h >>> 0;
}

/**
 * The style a pair of looks takes in a Region: one of {@link blendStylesFor}, picked by the
 * Region's seed and the pair, so a Region keeps it and another Region may differ. The Blend style
 * slider can name one for the eye-check; a pair it does not suit keeps its own pick.
 */
export function blendStyleOf(seed, a, b) {
    const styles = blendStylesFor(a, b);
    const named = BLEND_ORDER[Math.round(tuning('blendStyle')) - 1];
    if (named && styles.includes(named)) return named;
    return styles[Math.floor(hash01(CH.PICK, seed, pairHash(a, b)) * styles.length) % styles.length];
}

/** How far each style reaches from the border, in plan pixels, for a band of half-width `half`. */
function reachOf(style, half) {
    const R = BLEND_RULES;
    if (style === BLEND.ISLANDS) return R.islandReach * half;
    if (style === BLEND.FINGERS) return R.fingerReach * half;
    if (style === BLEND.LAWN) return Math.max(R.lawnFrom, R.lawnTo) * half + R.jag / 2;
    return half;
}

/** The look a palette entry draws in: the Region's, else its terrain's own, else the meadow. */
function lookFor(looks, terrainId) {
    const id = looks?.[terrainId];
    if (getLook(id)) return id;
    return DEFAULT_LOOK[terrainId] || 'meadow';
}

/** Whether a look takes part: land drawn by rules. */
const takesPart = (lookId) => drawsGenerated(lookId) && !generatedOf(lookId).water;

/**
 * The coarsest grid the border's distance is measured on, in plan pixels: the wander moves the
 * border further than its steps, so they never show, and the walk is a sixteenth of the pixels'.
 */
const MAX_STEP = 4;

/**
 * Outward from the border samples along each side in order of distance (chamfer, ×3: 3 a side
 * step, 4 a diagonal), never crossing onto another look: each sample reached takes the distance,
 * the ground across the border and, for the fingers, the border sample it was reached from.
 *
 * @returns {Int16Array} each sample's distance plus one, 0 where not reached
 */
function walkSides(entry, side, width, height, seeds, other, limit, from) {
    const dist = new Int16Array(width * height);
    const buckets = Array.from({ length: limit + 1 }, () => []);
    for (const s of seeds) {
        dist[s] = 1;
        if (from) from[s] = s;
        buckets[0].push(s);
    }
    for (let d = 0; d <= limit; d++) {
        const bucket = buckets[d];
        for (let b = 0; b < bucket.length; b++) {
            const i = bucket[b];
            if (dist[i] !== d + 1) continue;
            const x = i % width;
            const y = (i - x) / width;
            const look = side[entry[i]];
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
                    if (side[entry[j]] !== look) continue;
                    const was = dist[j];
                    if (was !== 0 && nd + 1 >= was) continue;
                    dist[j] = nd + 1;
                    other[j] = other[i];
                    if (from) from[j] = from[i];
                    buckets[nd].push(j);
                }
            }
        }
    }
    return dist;
}

/**
 * One block's stretch of a pixel row in each style: `s` runs from `left` at `x0` by `slope` a
 * pixel; a pixel of the pair's soft or hard look takes the side its style puts it on, any other
 * stays. ⚠️ A function per style, so each inner loop is compiled for its own reads.
 */
const STYLE_ROW = Object.freeze({
    /** Islands and fingers: their pushes are in `s` already. */
    [BLEND.ISLANDS]: pushedRow,
    [BLEND.FINGERS]: pushedRow,
    [BLEND.BAND]: bandRow,
    [BLEND.FADE]: fadeRow,
    [BLEND.LAWN]: lawnRow
});

function pushedRow(run, pair, x0, end, base, left, slope) {
    let changed = 0;
    const { at, side } = run;
    const { softSide, hardSide, soft, hard } = pair;
    for (let x = x0, i = base + x0; x < end; x++, i++) {
        const o = side[at[i]];
        const toHard = left + slope * (x - x0) > 0;
        if (o === softSide) {
            if (toHard) { at[i] = hard; changed++; }
        } else if (o === hardSide && !toHard) { at[i] = soft; changed++; }
    }
    run.changed += changed;
}

function bandRow(run, pair, x0, end, base, left, slope) {
    let changed = 0;
    const { at, side, half, span } = run;
    const { softSide, hardSide, soft, hard } = pair;
    const T = run.band.top;
    const B = run.band.bottom;
    const fy = run.band.fy;
    for (let x = x0, i = base + x0; x < end; x++, i++) {
        const o = side[at[i]];
        if (o !== softSide && o !== hardSide) continue;
        const t = T[x];
        const toHard = t + (B[x] - t) * fy < (left + slope * (x - x0) + half) / span;
        if (o === softSide) {
            if (toHard) { at[i] = hard; changed++; }
        } else if (!toHard) { at[i] = soft; changed++; }
    }
    run.changed += changed;
}

function fadeRow(run, pair, x0, end, base, left, slope) {
    let changed = 0;
    const { at, side, half, span, tint, spans, y } = run;
    const { softSide, hardSide, soft, hard } = pair;
    const R = BLEND_RULES;
    const keep = R.fadeWeight;
    const steps = R.steps;
    const A = run.fade.top;
    const AB = run.fade.bottom;
    const ay = run.fade.fy;
    const F = run.fadeFine.top;
    const FB = run.fadeFine.bottom;
    const fy = run.fadeFine.fy;
    for (let x = x0, i = base + x0; x < end; x++, i++) {
        const o = side[at[i]];
        if (o !== softSide && o !== hardSide) continue;
        const t = (left + slope * (x - x0) + half) / span;
        const a = A[x];
        const f = F[x];
        const toHard = keep * (a + (AB[x] - a) * ay) + (1 - keep) * (f + (FB[x] - f) * fy) < t;
        if (o === softSide) {
            if (toHard) { at[i] = hard; changed++; }
        } else if (!toHard) { at[i] = soft; changed++; }
        const step = Math.floor(t * steps);
        if (step > 0 && step < steps - 1) {
            tint[i] = (toHard ? soft : hard) + 1;
            if (spans[2 * y] < 0 || x < spans[2 * y]) spans[2 * y] = x;
            if (x > spans[2 * y + 1]) spans[2 * y + 1] = x;
        }
    }
    run.changed += changed;
}

function lawnRow(run, pair, x0, end, base, left, slope) {
    let changed = 0;
    const { at, side, lawnLo, lawnHi } = run;
    const { softSide, hardSide, soft, hard } = pair;
    const R = BLEND_RULES;
    const rise = R.fleckRise / (lawnHi - lawnLo);
    const J = run.jag.top;
    const JB = run.jag.bottom;
    const jy = run.jag.fy;
    const K = run.fleck.top;
    const KB = run.fleck.bottom;
    const ky = run.fleck.fy;
    for (let x = x0, i = base + x0; x < end; x++, i++) {
        const o = side[at[i]];
        if (o !== softSide && o !== hardSide) continue;
        const j = J[x];
        const u = left + slope * (x - x0) + (j + (JB[x] - j) * jy - 0.5) * R.jag;
        let to;
        if (u <= lawnLo) to = soft;
        else if (u >= lawnHi) to = hard;
        else {
            const k = K[x];
            if (k + (KB[x] - k) * ky > R.fleckCut - rise * (u - lawnLo)) to = hard;
            else {
                if (run.lawn < 0) run.lawn = run.claimLawn();
                to = run.lawn;
            }
        }
        if (to === hard ? o !== hardSide : to === soft ? o !== softSide : true) {
            at[i] = to;
            changed++;
        }
    }
    run.changed += changed;
}

/**
 * Blend every border between two land looks of a Region's pixel map, in place.
 *
 * How far each pixel lies across its border (`s`, below 0 on the pair's soft side) is measured on
 * a coarse grid of samples and read between them, with the wander and the islands' and fingers'
 * pushes (all smooth) taken at the samples; only the fine noises of the band, the fade and the
 * lawn are read per pixel. A pixel changes only to the other ground of its own pair (or the lawn),
 * never when it is water or a look outside the pair.
 *
 * @param {object} map  the pixel map so far (`resolveArtPixels`, before the beach): `at`, `width`,
 *   `height`, `palette`, `present`, `idFor` (a palette entry for a terrain id, added if new), the
 *   Region's `looks` (terrain id → look id) and `seed`
 * @returns {null|{changed: number, pairs: Array<{soft: string, hard: string, style: string}>,
 *   tint: Uint8Array|null, spans: Int32Array|null}} null when nothing here blends (the switch off,
 *   or fewer than two land looks drawn by rules). `changed` counts the pixels given another look;
 *   `tint`, for a fade, holds per pixel one more than the palette entry whose colour it takes
 *   {@link FADE_TINT} of (0 none), and `spans` each plan row's first and last such pixel.
 */
export function blendBorders({ at, width, height, palette, present, idFor, looks, seed }) {
    const half = tuning('blendWidth') / 2 / PLAN_PIXEL_U;
    if (!(tuning('blendOn') > 0) || !(half >= 1)) return null;
    const R = BLEND_RULES;

    // Each palette entry's side: a number per look taking part, -1 for none.
    const side = new Int16Array(256).fill(-1);
    const sides = [];
    const entryOf = [];
    for (let p = 0; p < palette.length; p++) {
        if (!present[p]) continue;
        const look = lookFor(looks, palette[p]);
        if (!takesPart(look)) continue;
        let k = sides.indexOf(look);
        if (k < 0) {
            k = sides.length;
            sides.push(look);
            entryOf.push(p);
        }
        side[p] = k;
    }
    const K = sides.length;
    if (K < 2) return null;

    // The samples: every `g` pixels, the last column and row on the plan's edge.
    const g = Math.max(1, Math.min(MAX_STEP, Math.round(half / 6)));
    const cw = Math.ceil((width - 1) / g) + 1;
    const ch = Math.ceil((height - 1) / g) + 1;
    const colAt = Int32Array.from({ length: cw }, (_, c) => Math.min(width - 1, c * g));
    const rowAt = Int32Array.from({ length: ch }, (_, r) => Math.min(height - 1, r * g));
    const m = cw * ch;
    const entry = new Uint8Array(m);
    for (let r = 0, k = 0; r < ch; r++) {
        const base = rowAt[r] * width;
        for (let c = 0; c < cw; c++, k++) entry[k] = at[base + colAt[c]];
    }

    // The border samples: a side neighbour of another look; each notes the ground across.
    const other = new Uint8Array(m);
    const seeds = [];
    const met = new Uint8Array(K * K);
    const note = (i, j) => {
        if (!other[i]) {
            other[i] = entry[j] + 1;
            seeds.push(i);
        }
    };
    for (let r = 0, k = 0; r < ch; r++) {
        for (let c = 0; c < cw; c++, k++) {
            const a = side[entry[k]];
            if (a < 0) continue;
            if (c + 1 < cw) {
                const b = side[entry[k + 1]];
                if (b >= 0 && b !== a) {
                    note(k, k + 1);
                    note(k + 1, k);
                    met[a * K + b] = 1;
                }
            }
            if (r + 1 < ch) {
                const b = side[entry[k + cw]];
                if (b >= 0 && b !== a) {
                    note(k, k + cw);
                    note(k + cw, k);
                    met[a * K + b] = 1;
                }
            }
        }
    }
    if (!seeds.length) return null;

    // Each pair that meets: its style, how far it reaches and which side is the soft one.
    const pairs = new Array(K * K).fill(null);
    const list = [];
    const used = new Set();
    let reach = 0;
    for (let a = 0; a < K; a++) {
        for (let b = a + 1; b < K; b++) {
            if (!met[a * K + b] && !met[b * K + a]) continue;
            const [soft, hard] = pairOf(sides[a], sides[b]);
            const style = blendStyleOf(seed, soft, hard);
            const own = reachOf(style, half);
            const softSide = sides.indexOf(soft);
            const hardSide = sides.indexOf(hard);
            const rec = {
                id: list.length, style, own, reach: own + R.wander * half, softSide, hardSide,
                soft: entryOf[softSide], hard: entryOf[hardSide], names: { soft, hard, style }
            };
            pairs[a * K + b] = rec;
            pairs[b * K + a] = rec;
            list.push(rec);
            used.add(style);
            reach = Math.max(reach, rec.reach);
        }
    }

    const from = used.has(BLEND.FINGERS) ? new Int32Array(m) : null;
    const dist = walkSides(entry, side, cw, ch, seeds, other, Math.ceil((3 * (reach + 2 * g)) / g), from);

    // Each sample's `s`, the wander and the smooth pushes in it.
    const walker = (style, cell, channel) => (used.has(style) ? noiseWalker(width, height, seed, cell, cell, channel) : null);
    const cellOf = (share, style) => Math.max(4, Math.round(share * reachOf(style, half)));
    const wander = noiseWalker(width, height, seed, R.wanderCell, R.wanderCell, CH.WANDER);
    const island = walker(BLEND.ISLANDS, cellOf(R.islandCell, BLEND.ISLANDS), CH.ISLAND);
    const finger = walker(BLEND.FINGERS, cellOf(R.fingerCell, BLEND.FINGERS), CH.FINGER);
    const wanderAmp = 2 * R.wander * half;
    const value = new Float32Array(m);
    const pairAt = new Int16Array(m).fill(-1);
    for (let k = 0; k < m; k++) {
        const dd = dist[k];
        if (!dd) continue;
        const a = side[entry[k]];
        const pair = pairs[a * K + side[other[k] - 1]];
        const c = k % cw;
        const x = colAt[c];
        const y = rowAt[(k - c) / cw];
        const d = ((dd - 1) / 3 + 0.5) * g;
        let v = (a === pair.softSide ? -d : d) + (wander.at(x, y) - 0.5) * wanderAmp;
        if (pair.style === BLEND.ISLANDS) v += (island.at(x, y) - 0.5) * 2 * pair.own;
        else if (pair.style === BLEND.FINGERS) {
            const q = from[k];
            const qc = q % cw;
            v += (finger.at(colAt[qc], rowAt[(q - qc) / cw]) - 0.5) * 2 * pair.own;
        }
        value[k] = v;
        pairAt[k] = pair.id;
    }

    // Each block between four samples: the pair of its corner nearest a border, and the corners'
    // `s` for that pair (a corner of another pair's ground counted as far on its side of this one,
    // one of neither as the nearest corner); blocks wholly beyond the reach are left alone.
    const bw = cw - 1;
    const bh = ch - 1;
    const blockPair = new Int16Array(bw * bh).fill(-1);
    const corner = new Float32Array(4 * bw * bh);
    const rowHas = new Uint8Array(bh);
    const ks = new Int32Array(4);
    for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
            ks[0] = by * cw + bx;
            ks[1] = ks[0] + 1;
            ks[2] = ks[0] + cw;
            ks[3] = ks[2] + 1;
            // No corner reached (each -1, every bit set).
            if ((pairAt[ks[0]] & pairAt[ks[1]] & pairAt[ks[2]] & pairAt[ks[3]]) < 0) continue;
            let best = -1;
            for (let j = 0; j < 4; j++) {
                const k = ks[j];
                if (pairAt[k] >= 0 && (best < 0 || Math.abs(value[k]) < Math.abs(value[best]))) best = k;
            }
            if (best < 0) continue;
            const pair = list[pairAt[best]];
            const b = by * bw + bx;
            let lo = Infinity;
            let hi = -Infinity;
            for (let j = 0; j < 4; j++) {
                const k = ks[j];
                const sd = side[entry[k]];
                const sign = sd === pair.softSide ? -1 : sd === pair.hardSide ? 1 : 0;
                let v;
                if (pairAt[k] === pair.id) v = value[k];
                else if (sign === 0) v = value[best];
                else v = sign * (pairAt[k] >= 0 ? Math.abs(value[k]) : pair.reach + g);
                corner[4 * b + j] = v;
                if (v < lo) lo = v;
                if (v > hi) hi = v;
            }
            if (lo >= pair.reach || hi <= -pair.reach) continue;
            blockPair[b] = pair.id;
            rowHas[by] = 1;
        }
    }

    // Then every pixel of those blocks, row by row, its fine noises walked down with it.
    const band = walker(BLEND.BAND, R.bandCell, CH.BAND);
    const fade = walker(BLEND.FADE, R.fadeCells[0], CH.FADE);
    const fadeFine = walker(BLEND.FADE, R.fadeCells[1], CH.FADE_FINE);
    const fleck = walker(BLEND.LAWN, R.fleckCell, CH.FLECK);
    const jag = walker(BLEND.LAWN, R.jagCell, CH.JAG);
    const rowWalkers = [band, fade, fadeFine, fleck, jag].filter(Boolean);
    const tint = used.has(BLEND.FADE) ? new Uint8Array(width * height) : null;
    const spans = tint ? new Int32Array(2 * height).fill(-1) : null;
    const run = {
        at, side, half, span: 2 * half, tint, spans, y: 0, changed: 0, band, fade, fadeFine, fleck, jag,
        lawnLo: -R.lawnFrom * half, lawnHi: R.lawnTo * half, lawn: -1,
        claimLawn: () => {
            // ⚠️ Claimed on its first pixel, so a lawn that lands nowhere adds nothing to the palette.
            const id = idFor(LAWN_TERRAIN);
            present[id] = 1;
            return id;
        }
    };
    for (let y = 0; y < height; y++) {
        const by = Math.min(bh - 1, Math.floor(y / g));
        if (!rowHas[by]) continue;
        for (const w of rowWalkers) w.walk(y);
        run.y = y;
        const y0 = rowAt[by];
        const y1 = rowAt[by + 1];
        const fy = y1 > y0 ? (y - y0) / (y1 - y0) : 0;
        for (let bx = 0; bx < bw; bx++) {
            const b = by * bw + bx;
            const id = blockPair[b];
            if (id < 0) continue;
            const pair = list[id];
            const left = corner[4 * b] + (corner[4 * b + 2] - corner[4 * b]) * fy;
            const right = corner[4 * b + 1] + (corner[4 * b + 3] - corner[4 * b + 1]) * fy;
            const x0 = colAt[bx];
            const x1 = colAt[bx + 1];
            const end = bx === bw - 1 ? x1 + 1 : x1;
            const slope = x1 > x0 ? (right - left) / (x1 - x0) : 0;
            STYLE_ROW[pair.style](run, pair, x0, end, y * width, left, slope);
        }
    }
    const { changed } = run;
    return { changed, pairs: list.map(p => p.names), tint, spans };
}

/**
 * The colour a fade mixes in of a look: the mean of its kinds' bodies (each kind's soft tone), as
 * the Ground strength slider draws them. Null for a look not drawn by rules or a water.
 *
 * @returns {number[]|null} `[r, g, b]` bytes
 */
export function groundTone(lookId) {
    const spec = generatedOf(lookId);
    if (!spec || spec.water || !drawsGenerated(lookId)) return null;
    const table = grassColours(spec);
    const sum = [0, 0, 0];
    spec.kinds.forEach((_, k) => {
        const c = table[kindColour(k, COLOUR.SOFT)];
        for (let ch = 0; ch < 3; ch++) sum[ch] += c[ch];
    });
    return sum.map(v => Math.round(v / spec.kinds.length));
}
