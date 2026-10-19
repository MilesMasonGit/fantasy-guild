// the ground's screen pass: the ground plan resampled onto the screen's ground pixels

import { SHEET_PX, PROP_PX, PROP_SHEET_CELLS } from '../../../config/registries/terrainRegistry.js';
import { drawGrass, grassTable, shadeRatio, COLOUR, SLOT_SHIFT } from '../../../systems/board/TerrainGrass.js';

/**
 * The second of the ground's two stages (the first is `TerrainSurface.buildGroundPlan`, 2 mat units
 * a pixel and independent of the window). Pure: the plan, the mat, the size of a ground pixel and
 * the decoded sheets in; RGBA bytes out, one per ground pixel, for one `putImageData`.
 *
 * ⭐ **One ground pixel is one Token pixel on screen.** The mat is scaled to the window by a CSS
 * transform, and Token art steps to a whole number of screen pixels per art pixel through it
 * (`boardScaleAt`, `TokenSprite.jsx`). The caller passes `unit = boardScaleAt(fit)`: a ground pixel
 * is that many mat units, so the transform lands it on exactly `boardArtSteps(fit)` screen pixels,
 * the size of a Token's. The 2-unit plan is read at each ground pixel's centre.
 *
 * ⚠️ **The mat's edge is in the picture.** The picture covers the mat's surface, so the surface's
 * rounded corners, its faint light edge and its inset shadow (`MAT_EDGE`) are drawn here, per
 * ground pixel, and the surface stops drawing them while the ground is drawn. A soft CSS shadow
 * painted under an opaque picture costs a blur on every repaint of the tiles it covers and shows
 * nothing.
 */

/**
 * The mat surface's edge, in mat units: its corner radius, its 2-unit light edge and its inset
 * shadow (`MatBoard.jsx` draws them with CSS while the ground is not drawn).
 */
export const MAT_EDGE = Object.freeze({
    radius: 28,
    border: 2,
    borderLight: 0.08,
    shadowBlur: 90,
    shadowAlpha: 0.40
});

/** The surface's CSS for the same edge, so the two cannot drift apart. */
export const MAT_EDGE_CSS = Object.freeze({
    border: `${MAT_EDGE.border}px solid rgba(255, 255, 255, ${MAT_EDGE.borderLight})`,
    insetShadow: `inset 0 0 ${MAT_EDGE.shadowBlur}px rgba(0, 0, 0, ${MAT_EDGE.shadowAlpha.toFixed(2)})`
});

/**
 * The screen pass's grid: whole ground pixels of `unit` mat units over the mat, the last column and
 * row running up to one pixel past its edge.
 *
 * @param {{w: number, h: number}} mat
 * @param {number} unit  mat units per ground pixel: `boardScaleAt(fit)`
 * @returns {{unit: number, cols: number, rows: number}}
 */
export function screenGrid(mat, unit) {
    // ⚠️ `unit` is a fraction (`steps / fit`): 1760 / (2 / 0.75) is 660 give or take the last bit,
    // and a bare `ceil` would add a column of nothing.
    return {
        unit,
        cols: Math.max(1, Math.ceil(mat.w / unit - 1e-6)),
        rows: Math.max(1, Math.ceil(mat.h / unit - 1e-6))
    };
}

/** The standard normal's cumulative distribution (Abramowitz and Stegun 7.1.26, error under 2e-7). */
function normalCdf(z) {
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const erf = 1 - poly * Math.exp(-x * x);
    return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * How much of the inside of the shadow's box reaches a point along one axis, blurred: the box
 * `[border, size - border]` (the surface's padding box) convolved with the blur's Gaussian. 1 deep
 * inside, a half at the edge. The shadow at a point is `alpha × (1 - along x × along y)`, which is
 * exact for a square-cornered box and as near as matters for one rounded 28 units.
 */
function insideAlong(count, unit, size) {
    const sigma = MAT_EDGE.shadowBlur / 2;
    const from = MAT_EDGE.border;
    const to = size - MAT_EDGE.border;
    const out = new Float64Array(count);
    for (let i = 0; i < count; i++) {
        const at = (i + 0.5) * unit;
        out[i] = Math.min(1, Math.max(0, normalCdf((at - from) / sigma) + normalCdf((to - at) / sigma) - 1));
    }
    return out;
}

/**
 * Which ground pixels of each row lie inside the mat's rounded rectangle: those whose centre does.
 * `from[r]` the first, `to[r]` one past the last; an empty row has `from === to`.
 */
function spans(grid, mat) {
    const { cols, rows, unit } = grid;
    const R = MAT_EDGE.radius;
    const from = new Int32Array(rows);
    const to = new Int32Array(rows);
    for (let r = 0; r < rows; r++) {
        const y = (r + 0.5) * unit;
        if (y > mat.h) continue;
        const dy = y < R ? R - y : y > mat.h - R ? y - (mat.h - R) : 0;
        const half = dy > 0 ? Math.sqrt(Math.max(0, R * R - dy * dy)) : R;
        const left = R - half;
        const right = mat.w - R + half;
        const a = Math.max(0, Math.ceil(left / unit - 0.5));
        const b = Math.min(cols, Math.floor(right / unit - 0.5) + 1);
        if (b > a) { from[r] = a; to[r] = b; }
    }
    return { from, to };
}

/** `#rrggbb` as three bytes. */
function rgbOf(hex) {
    const n = parseInt(String(hex).slice(1, 7), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const PROP_SHEET_PX = PROP_PX * PROP_SHEET_CELLS;
const SHEET_WORDS = SHEET_PX * SHEET_PX;

/**
 * Which drawn look each plan pixel takes: its sheet, with its band's colour mixed in and its shade
 * applied. Only the combinations the plan uses become looks: look `v` is `combos[v]`
 * (`[shade, tint, sheet]`, tint -1 for none) and block `v` of the screen pass's table (`looksOf`).
 * Depends on the plan alone, so it is kept with the plan: a fit change reuses it.
 */
const looksByPlan = new WeakMap();
function lookAtOf(plan) {
    let found = looksByPlan.get(plan);
    if (found) return found;
    const n = plan.sheets.length;
    const bands = plan.tints.length + 1;
    const { sheetAt, tintAt } = plan;
    const shadeAt = plan.shadeAt || null;
    const shadeCount = plan.shades?.length || 1;
    const ids = new Int32Array(shadeCount * bands * n).fill(-1);
    const combos = [];
    const lookAt = new Uint16Array(sheetAt.length);
    for (let i = 0; i < lookAt.length; i++) {
        const s = shadeAt ? shadeAt[i] : 0;
        const t = tintAt[i];
        const key = (s * bands + t + 1) * n + sheetAt[i];
        let id = ids[key];
        if (id < 0) {
            id = combos.length;
            ids[key] = id;
            combos.push([s, t, sheetAt[i]]);
        }
        lookAt[i] = id;
    }
    found = { lookAt, combos };
    looksByPlan.set(plan, found);
    return found;
}

/**
 * Every look the plan draws, as one table of opaque pixels, `SHEET_PX` square each: a sheet, its
 * band's colour mixed in, then its shade. A sheet that is missing is a block of clear pixels. A
 * look's pixel is then one read, banded, shaded or not.
 */
function looksOf(texels, tints, shades, combos) {
    const bytes = new Uint8ClampedArray(combos.length * SHEET_WORDS * 4);
    for (let v = 0; v < combos.length; v++) {
        const [shade, band, sheet] = combos[v];
        const src = texels[sheet];
        if (!src) continue;
        const tint = band < 0 ? null : tints[band];
        const f = shades[shade] ?? 1;
        const base = v * SHEET_WORDS * 4;
        for (let i = 0; i < SHEET_WORDS * 4; i += 4) {
            let red = src[i];
            let green = src[i + 1];
            let blue = src[i + 2];
            if (tint) {
                red = red * tint.keep + tint.r;
                green = green * tint.keep + tint.g;
                blue = blue * tint.keep + tint.b;
            }
            bytes[base + i] = red * f;
            bytes[base + i + 1] = green * f;
            bytes[base + i + 2] = blue * f;
            bytes[base + i + 3] = 255;
        }
    }
    return bytes;
}

/** Buffers the generated ground's details reuse from one screen pass to the next. */
const grassScratch = {};

/**
 * The brightness factor of shade `s` for a look that takes `ratio` of the shade pattern: the
 * plan's own factor with the pattern's step scaled (the forest's twice the meadow's, the sea's
 * none); the lip round worn sheets as it is.
 */
function shadeFor(plan, s, ratio) {
    const part = plan.shadeParts?.[s];
    if (!part) return plan.shades?.[s] ?? 1;
    const [level, lip] = part;
    return (1 + (level - 1) * plan.patternStep * ratio) * plan.lips[lip];
}

/**
 * The looks drawn by rules (`TerrainGrass`): their details decided per ground pixel, and a table of
 * their colours with each of the plan's shades applied, in each look's own share of the pattern.
 * ⚠️ Not muted: the ramps are the final colours.
 *
 * @returns {{colour: Uint8Array, kinds: Uint8Array, words: Uint32Array, shadeCount: number}|null}
 */
function grassOf(plan, grid, planCol, planRow) {
    if (!plan.grass) return null;
    const { colour, kinds } = drawGrass(plan.grass, plan.seed, grid.cols, grid.rows, planCol, planRow, grassScratch);
    const S = (plan.shades || [1]).length;
    const NC = COLOUR.COUNT;
    const tables = plan.grass.looks.map(id => grassTable(id));
    const bytes = new Uint8ClampedArray(tables.length * S * NC * 4);
    tables.forEach(({ colours, unshaded }, slot) => {
        const ratio = shadeRatio(plan.grass.looks[slot]);
        for (let s = 0; s < S; s++) {
            const shaded = shadeFor(plan, s, ratio);
            for (let k = 0; k < NC; k++) {
                const o = ((slot * S + s) * NC + k) * 4;
                const f = unshaded[k] ? 1 : shaded;
                const [red, green, blue] = colours[k];
                bytes[o] = red * f;
                bytes[o + 1] = green * f;
                bytes[o + 2] = blue * f;
                bytes[o + 3] = 255;
            }
        }
    });
    return { colour, kinds, words: new Uint32Array(bytes.buffer), shadeCount: S };
}

/**
 * Row `r`'s pixels inside the mat: a generated look's colour where there is one, else its sheet's
 * texel. ⚠️ A function per row: as a loop nested in the pass, V8 compiled the pixel loop on its own
 * and threw it away at the end of every row.
 */
function fillRow(ctx, r) {
    const { out32, cols, from, to, planRow, planCol, lookAt, lookWords, texCol, grass, shadeAt } = ctx;
    const a = from[r];
    const b = to[r];
    if (a === b) return;
    const pr = planRow[r];
    const texRow = (r % SHEET_PX) * SHEET_PX;
    const rowBase = r * cols;
    if (!grass) {
        for (let c = a; c < b; c++) {
            out32[rowBase + c] = lookWords[lookAt[pr + planCol[c]] * SHEET_WORDS + texRow + texCol[c]];
        }
        return;
    }
    const { colour, kinds, words, shadeCount } = grass;
    const NC = COLOUR.COUNT;
    for (let c = a; c < b; c++) {
        const i = rowBase + c;
        const k = colour[i];
        const p = pr + planCol[c];
        out32[i] = k === 255
            ? lookWords[lookAt[p] * SHEET_WORDS + texRow + texCol[c]]
            : words[((kinds[i] >> SLOT_SHIFT) * shadeCount + (shadeAt ? shadeAt[p] : 0)) * NC + k];
    }
}

/**
 * A fade's middle steps (`TerrainBlend`): each pixel there takes some of the other ground's colour,
 * row by row along the plan's span of them only.
 */
function tintFade(blend, data, grid, planCol, planRow, plan, from, to) {
    const { tint, spans, amount, tones } = blend;
    const keep = 1 - amount;
    const mixed = tones.map(c => (c ? c.map(v => v * amount) : null));
    const { cols, rows, unit } = grid;
    for (let r = 0; r < rows; r++) {
        const pr = planRow[r];
        const py = pr / plan.width;
        const lo = spans[2 * py];
        if (lo < 0) continue;
        const hi = spans[2 * py + 1];
        for (let c = Math.max(from[r], Math.floor((lo * plan.unit) / unit) - 1); c < to[r]; c++) {
            const pc = planCol[c];
            if (pc > hi) break;
            const v = pc < lo ? 0 : tint[pr + pc];
            const m = v ? mixed[v - 1] : null;
            if (!m) continue;
            const d = (r * cols + c) * 4;
            data[d] = data[d] * keep + m[0];
            data[d + 1] = data[d + 1] * keep + m[1];
            data[d + 2] = data[d + 2] * keep + m[2];
        }
    }
}

/**
 * The screen pass.
 *
 * @param {object} plan  `buildGroundPlan`'s result
 * @param {object} options
 * @param {{w: number, h: number}} options.mat  the mat, in mat units
 * @param {number} options.unit  mat units per ground pixel (`boardScaleAt(fit)`)
 * @param {(id: string) => Uint8ClampedArray|null} options.sheet  a ground sheet's muted RGBA,
 *   `SHEET_PX` square; null leaves its pixels clear
 * @param {(id: string, asDrawn: boolean) => Uint8ClampedArray|null} [options.prop]  a prop sheet's
 *   RGBA: muted, or as drawn for a prop standing on a generated look
 * @param {Uint8ClampedArray} [options.out]  where to write (`cols × rows × 4` bytes); else a new one
 * @returns {{cols: number, rows: number, unit: number, data: Uint8ClampedArray}}
 */
export function buildScreenPass(plan, { mat, unit, sheet, prop = () => null, out = null }) {
    const grid = screenGrid(mat, unit);
    const { cols, rows } = grid;
    const data = out || new Uint8ClampedArray(cols * rows * 4);
    data.fill(0);

    const planW = plan.width;
    const planH = plan.height;
    const planU = plan.unit;

    // Where each ground pixel's centre falls on the plan, and on a sheet, per column and per row:
    // the loops below then do no division.
    const planCol = new Int32Array(cols);
    const texCol = new Int32Array(cols);
    for (let c = 0; c < cols; c++) {
        planCol[c] = Math.min(planW - 1, Math.floor(((c + 0.5) * unit) / planU));
        texCol[c] = c % SHEET_PX;
    }
    const planRow = new Int32Array(rows);
    for (let r = 0; r < rows; r++) planRow[r] = Math.min(planH - 1, Math.floor(((r + 0.5) * unit) / planU)) * planW;

    const texels = plan.sheets.map(id => {
        const t = sheet(id);
        return t && t.length === SHEET_WORDS * 4 ? t : null;
    });
    const tints = plan.tints.map(({ tint, amount }) => {
        const a = Math.min(1, Math.max(0, amount));
        const [r, g, b] = rgbOf(tint);
        return { keep: 1 - a, r: r * a, g: g * a, b: b * a };
    });
    const { lookAt, combos } = lookAtOf(plan);
    const lookBytes = looksOf(texels, tints, plan.shades || [1], combos);
    const lookWords = new Uint32Array(lookBytes.buffer);
    const out32 = new Uint32Array(data.buffer, data.byteOffset, cols * rows);

    const alongX = insideAlong(cols, unit, mat.w);
    const alongY = insideAlong(rows, unit, mat.h);
    const shadow = MAT_EDGE.shadowAlpha;
    const light = MAT_EDGE.borderLight;
    const keepLight = 1 - light;
    const lightAdd = 255 * light;
    const { from, to } = spans(grid, mat);

    /** The outer ring's columns of row `r` lie before `[lo, hi)`: a neighbour across an edge is not drawn. */
    const rimSpan = (r) => {
        if (r === 0 || r === rows - 1) return [0, 0];
        return [
            Math.max(from[r] + 1, from[r - 1], from[r + 1]),
            Math.min(to[r] - 1, to[r - 1], to[r + 1])
        ];
    };

    /** Shade one written pixel as the surface's edge did: the inset shadow, then the light edge. */
    const shade = (d, c, r, rim) => {
        const m = 1 - shadow * (1 - alongX[c] * alongY[r]);
        let red = data[d] * m;
        let green = data[d + 1] * m;
        let blue = data[d + 2] * m;
        if (rim) {
            red = red * keepLight + lightAdd;
            green = green * keepLight + lightAdd;
            blue = blue * keepLight + lightAdd;
        }
        data[d] = red;
        data[d + 1] = green;
        data[d + 2] = blue;
    };

    const fill = {
        out32, cols, from, to, planRow, planCol, lookAt, lookWords, texCol,
        grass: grassOf(plan, grid, planCol, planRow), shadeAt: plan.shadeAt || null
    };
    for (let r = 0; r < rows; r++) fillRow(fill, r);
    if (plan.blend) tintFade(plan.blend, data, grid, planCol, planRow, plan, from, to);

    // ⚠️ Most of the picture lies where the inset shadow has faded below half a byte: there a pixel
    // is one 32-bit copy from the table of looks, the same bytes shading would leave. Only a band
    // round the edge, about 120 units deep, is shaded byte by byte.
    const deep = 1 - 0.49 / (255 * shadow);
    for (let r = 0; r < rows; r++) {
        const a = from[r];
        const b = to[r];
        if (a === b) continue;
        // The run of this row deep enough to need no shading (`alongX` rises, then falls).
        const rowInside = alongY[r];
        let f0 = b;
        let f1 = b;
        if (rowInside >= deep) {
            f0 = a;
            while (f0 < b && alongX[f0] * rowInside < deep) f0++;
            f1 = b;
            while (f1 > f0 && alongX[f1 - 1] * rowInside < deep) f1--;
        }
        const [lo, hi] = rimSpan(r);
        const rowBase = r * cols;
        for (let c = a; c < b; c++) {
            if (c === f0 && f1 > f0) { c = f1 - 1; continue; }
            const d = (rowBase + c) * 4;
            if (data[d + 3] !== 0) shade(d, c, r, c < lo || c >= hi);
        }
    }

    // Props, back to front: one prop pixel per ground pixel, the foot on the ground pixel under the
    // plan's foot, opaque pixels only, never outside the drawn ground, in the light of the ground
    // under the foot (`shade`).
    const half = PROP_PX / 2;
    const perRow = PROP_SHEET_CELLS;
    // ⚠️ A prop on a generated look is drawn as drawn, like the ground under it: muted, the
    // scatter read grey against the ramps.
    const generated = new Set(plan.grass?.looks || []);
    const propTexels = new Map();
    for (const p of plan.props || []) {
        const asDrawn = generated.has(p.look);
        const key = `${p.sheet}|${asDrawn}`;
        if (!propTexels.has(key)) {
            const t = prop(p.sheet, asDrawn);
            propTexels.set(key, t && t.length === PROP_SHEET_PX * PROP_SHEET_PX * 4 ? t : null);
        }
        const src = propTexels.get(key);
        if (!src) continue;
        const footC = Math.floor(((p.footX + 0.5) * planU) / unit);
        const footR = Math.floor(((p.footY + 0.5) * planU) / unit);
        const left = footC - half;
        const top = footR - (PROP_PX - 1);
        const ox = (p.index % perRow) * PROP_PX;
        const oy = Math.floor(p.index / perRow) * PROP_PX;
        const f = p.shade ?? 1;
        for (let y = 0; y < PROP_PX; y++) {
            const r = top + y;
            if (r < 0 || r >= rows) continue;
            const [lo, hi] = rimSpan(r);
            const rowStart = ((oy + y) * PROP_SHEET_PX + ox) * 4;
            for (let x = 0; x < PROP_PX; x++) {
                const c = left + x;
                if (c < from[r] || c >= to[r]) continue;
                const s = rowStart + x * 4;
                if (src[s + 3] === 0) continue;
                const d = (r * cols + c) * 4;
                data[d] = src[s] * f;
                data[d + 1] = src[s + 1] * f;
                data[d + 2] = src[s + 2] * f;
                data[d + 3] = 255;
                shade(d, c, r, c < lo || c >= hi);
            }
        }
    }

    return { cols, rows, unit, data };
}
