// the ground's screen pass: the ground plan resampled onto the screen's ground pixels

import { SHEET_PX, PROP_PX, PROP_SHEET_CELLS } from '../../../config/registries/terrainRegistry.js';

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

/**
 * The screen pass.
 *
 * @param {object} plan  `buildGroundPlan`'s result
 * @param {object} options
 * @param {{w: number, h: number}} options.mat  the mat, in mat units
 * @param {number} options.unit  mat units per ground pixel (`boardScaleAt(fit)`)
 * @param {(id: string) => Uint8ClampedArray|null} options.sheet  a ground sheet's muted RGBA,
 *   `SHEET_PX` square; null leaves its pixels clear
 * @param {(id: string) => Uint8ClampedArray|null} [options.prop]  a prop sheet's muted RGBA
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
    // the loop below then does no division.
    const planCol = new Int32Array(cols);
    const texCol = new Int32Array(cols);
    for (let c = 0; c < cols; c++) {
        planCol[c] = Math.min(planW - 1, Math.floor(((c + 0.5) * unit) / planU));
        texCol[c] = (c % SHEET_PX) * 4;
    }
    const planRow = new Int32Array(rows);
    const texRow = new Int32Array(rows);
    for (let r = 0; r < rows; r++) {
        planRow[r] = Math.min(planH - 1, Math.floor(((r + 0.5) * unit) / planU)) * planW;
        texRow[r] = (r % SHEET_PX) * SHEET_PX * 4;
    }

    const texels = plan.sheets.map(id => {
        const t = sheet(id);
        return t && t.length === SHEET_PX * SHEET_PX * 4 ? t : null;
    });
    const tints = plan.tints.map(({ tint, amount }) => {
        const a = Math.min(1, Math.max(0, amount));
        const [r, g, b] = rgbOf(tint);
        return { keep: 1 - a, r: r * a, g: g * a, b: b * a };
    });

    const alongX = insideAlong(cols, unit, mat.w);
    const alongY = insideAlong(rows, unit, mat.h);
    const shadow = MAT_EDGE.shadowAlpha;
    const light = MAT_EDGE.borderLight;
    const keepLight = 1 - light;
    const lightAdd = 255 * light;
    const { from, to } = spans(grid, mat);

    /** Whether a drawn pixel is on the picture's outer ring (a neighbour across an edge is not drawn). */
    const onRim = (c, r) => c === from[r] || c === to[r] - 1
        || r === 0 || c < from[r - 1] || c >= to[r - 1]
        || r === rows - 1 || c < from[r + 1] || c >= to[r + 1];

    /** Shade one written pixel as the surface's edge did: the inset shadow, then the light edge. */
    const shade = (d, c, r) => {
        const m = 1 - shadow * (1 - alongX[c] * alongY[r]);
        let red = data[d] * m;
        let green = data[d + 1] * m;
        let blue = data[d + 2] * m;
        if (onRim(c, r)) {
            red = red * keepLight + lightAdd;
            green = green * keepLight + lightAdd;
            blue = blue * keepLight + lightAdd;
        }
        data[d] = red;
        data[d + 1] = green;
        data[d + 2] = blue;
    };

    const sheetAt = plan.sheetAt;
    const tintAt = plan.tintAt;
    for (let r = 0; r < rows; r++) {
        const a = from[r];
        const b = to[r];
        if (a === b) continue;
        const pr = planRow[r];
        const tr = texRow[r];
        const rowInside = alongY[r];
        const rimRow = r === 0 || r === rows - 1;
        for (let c = a; c < b; c++) {
            const i = pr + planCol[c];
            const src = texels[sheetAt[i]];
            if (!src) continue;
            const s = tr + texCol[c];
            let red = src[s];
            let green = src[s + 1];
            let blue = src[s + 2];
            const t = tintAt[i];
            if (t >= 0) {
                const tint = tints[t];
                red = red * tint.keep + tint.r;
                green = green * tint.keep + tint.g;
                blue = blue * tint.keep + tint.b;
            }
            const m = 1 - shadow * (1 - alongX[c] * rowInside);
            red *= m;
            green *= m;
            blue *= m;
            if (rimRow || c === a || c === b - 1 || c < from[r - 1] || c >= to[r - 1] || c < from[r + 1] || c >= to[r + 1]) {
                red = red * keepLight + lightAdd;
                green = green * keepLight + lightAdd;
                blue = blue * keepLight + lightAdd;
            }
            const d = (r * cols + c) * 4;
            data[d] = red;
            data[d + 1] = green;
            data[d + 2] = blue;
            data[d + 3] = 255;
        }
    }

    // Props, back to front: one prop pixel per ground pixel, the foot on the ground pixel under the
    // plan's foot, opaque pixels only, never outside the drawn ground.
    const half = PROP_PX / 2;
    const perRow = PROP_SHEET_CELLS;
    const propTexels = new Map();
    for (const p of plan.props || []) {
        if (!propTexels.has(p.sheet)) {
            const t = prop(p.sheet);
            propTexels.set(p.sheet, t && t.length === PROP_SHEET_PX * PROP_SHEET_PX * 4 ? t : null);
        }
        const src = propTexels.get(p.sheet);
        if (!src) continue;
        const footC = Math.floor(((p.footX + 0.5) * planU) / unit);
        const footR = Math.floor(((p.footY + 0.5) * planU) / unit);
        const left = footC - half;
        const top = footR - (PROP_PX - 1);
        const ox = (p.index % perRow) * PROP_PX;
        const oy = Math.floor(p.index / perRow) * PROP_PX;
        for (let y = 0; y < PROP_PX; y++) {
            const r = top + y;
            if (r < 0 || r >= rows) continue;
            const rowStart = ((oy + y) * PROP_SHEET_PX + ox) * 4;
            for (let x = 0; x < PROP_PX; x++) {
                const c = left + x;
                if (c < from[r] || c >= to[r]) continue;
                const s = rowStart + x * 4;
                if (src[s + 3] === 0) continue;
                const d = (r * cols + c) * 4;
                data[d] = src[s];
                data[d + 1] = src[s + 1];
                data[d + 2] = src[s + 2];
                data[d + 3] = 255;
                shade(d, c, r);
            }
        }
    }

    return { cols, rows, unit, data };
}
