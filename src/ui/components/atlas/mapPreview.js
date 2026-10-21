// the Cartography preview: the Region a plan would settle, drawn small with the mat's own ground

import { regionGround } from '../../../systems/atlas/regionGround.js';
import { HALL_TYPE_ID, hallSpot } from '../../../systems/atlas/Layout.js';
import { buildGroundPlan } from '../../../systems/board/TerrainSurface.js';
import { tokenSpritePath } from '../../../config/registries/tokenRegistry.js';
import { sheetPath, propSheetPath } from '../../../config/registries/terrainRegistry.js';
import { buildScreenPass, screenGrid } from '../board/groundScreen.js';
import { mutedSheet, drawnSheet, groundSheetsReady, loadGroundSheets } from '../board/groundSheets.js';
import { tokenSizeFor, TOKEN_SURFACE, TOKEN_SCALE } from '../base/TokenSprite.jsx';

/**
 * A tiny real map: the ground exactly as the mat will draw it once the plan is settled (the
 * Region's stored cell map and seed through `regionGround`, `buildGroundPlan` and the screen pass,
 * the same three steps `TerrainCanvas` takes), each Token its own sprite shrunk by a whole number,
 * and the Guild Hall in its clearing. One picture, built once per plan, never per frame.
 *
 * It is drawn on the mat as it is now, as the travel lands it: a Region is laid out on the shipped
 * mat (`layoutInputs.shippedMat`), and a Mat Tuner that grew the mat shows the same Tokens on more
 * ground with the Hall at the new middle, here as there.
 *
 * A preview pixel is `step` Token pixels across (`unit` = 2 × `step` mat units), drawn at
 * {@link PREVIEW_ZOOM} screen pixels: the UI's own art pixel. The ground's details and props are
 * drawn for that pixel, as the mat draws them for its own.
 */

/** Screen pixels across one preview pixel: the UI draws its art at 2×. */
export const PREVIEW_ZOOM = 2;

/** Token pixels across one preview pixel, finest first: the first that fits is used. */
export const PREVIEW_STEPS = Object.freeze([3, 4, 5, 6, 7, 8]);

/** Mat units across one Token art pixel at the mat's own scale. */
const MAT_U_PER_ART_PX = TOKEN_SCALE[TOKEN_SURFACE.BOARD];

/**
 * The finest preview of a `mat` that fits in `maxW` × `maxH` screen pixels, else the coarsest.
 *
 * @returns {{step: number, unit: number, cols: number, rows: number, zoom: number, width: number,
 *   height: number}} `cols` × `rows` preview pixels, `width` × `height` on screen
 */
export function previewFit(mat, maxW, maxH) {
    let fit = null;
    for (const step of PREVIEW_STEPS) {
        const { cols, rows, unit } = screenGrid(mat, step * MAT_U_PER_ART_PX);
        fit = { step, unit, cols, rows, zoom: PREVIEW_ZOOM, width: cols * PREVIEW_ZOOM, height: rows * PREVIEW_ZOOM };
        if (fit.width <= maxW && fit.height <= maxH) return fit;
    }
    return fit;
}

/**
 * Every Token the plan stands on the mat, and the Hall that lands in the middle of `mat`, back to
 * front as the mat stacks them (by height, the Hall arriving last): each one's centre in preview
 * pixels and its drawn size on the mat in preview pixels.
 */
export function previewTokens(layout, mat, unit) {
    const out = [];
    const add = (typeId, x, y) => out.push({
        typeId,
        x: x / unit,
        y: y / unit,
        px: tokenSizeFor(TOKEN_SURFACE.BOARD, typeId, MAT_U_PER_ART_PX) / unit
    });
    for (const n of layout?.nodes || []) add(n.typeId, n.x, n.y);
    const hall = hallSpot(mat);
    add(HALL_TYPE_ID, hall.x, hall.y);
    return out
        .map((t, i) => ({ t, i }))
        .sort((a, b) => a.t.y - b.t.y || a.i - b.i)
        .map(({ t }) => t);
}

/**
 * Pixel art shrunk by a whole `factor`: each `factor` × `factor` block becomes one pixel, opaque
 * when at least half of it is, its colour the block's average weighted by alpha (a block's most
 * common colour lost the outlines and turned a berry bush black). Partial blocks at the right and
 * bottom count their own area.
 *
 * @param {{width: number, height: number, data: Uint8ClampedArray}} art  RGBA
 * @returns {{width: number, height: number, data: Uint8ClampedArray}}
 */
export function shrinkArt(art, factor) {
    const f = Math.max(1, Math.round(factor) || 1);
    const { width, height, data } = art;
    const w = Math.ceil(width / f);
    const h = Math.ceil(height / f);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let by = 0; by < h; by++) {
        for (let bx = 0; bx < w; bx++) {
            let area = 0;
            let opaque = 0;
            let weight = 0;
            let red = 0;
            let green = 0;
            let blue = 0;
            for (let y = by * f; y < Math.min(height, (by + 1) * f); y++) {
                for (let x = bx * f; x < Math.min(width, (bx + 1) * f); x++) {
                    area++;
                    const s = (y * width + x) * 4;
                    const a = data[s + 3];
                    if (a === 0) continue;
                    opaque++;
                    weight += a;
                    red += data[s] * a;
                    green += data[s + 1] * a;
                    blue += data[s + 2] * a;
                }
            }
            if (opaque * 2 < area) continue;
            const d = (by * w + bx) * 4;
            out[d] = Math.round(red / weight);
            out[d + 1] = Math.round(green / weight);
            out[d + 2] = Math.round(blue / weight);
            out[d + 3] = 255;
        }
    }
    return { width: w, height: h, data: out };
}

/**
 * Lay each art's opaque pixels over `data` (`cols` × `rows` RGBA), centred on its point, in the
 * order given; whatever falls outside is dropped.
 */
export function paintTokens(data, cols, rows, draws) {
    for (const { x, y, art } of draws) {
        const left = Math.round(x - art.width / 2);
        const top = Math.round(y - art.height / 2);
        for (let ay = 0; ay < art.height; ay++) {
            const py = top + ay;
            if (py < 0 || py >= rows) continue;
            for (let ax = 0; ax < art.width; ax++) {
                const px = left + ax;
                if (px < 0 || px >= cols) continue;
                const s = (ay * art.width + ax) * 4;
                if (art.data[s + 3] === 0) continue;
                const d = (py * cols + px) * 4;
                data[d] = art.data[s];
                data[d + 1] = art.data[s + 1];
                data[d + 2] = art.data[s + 2];
                data[d + 3] = 255;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Token art, decoded once
// ---------------------------------------------------------------------------

/** Decoded Token art by path (`null` for one that would not load), and their shrunk copies. */
const arts = new Map();
const pending = new Map();
const shrunk = new Map();

function decode(path) {
    return new Promise((resolve) => {
        if (typeof Image === 'undefined' || typeof document === 'undefined') { resolve(null); return; }
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                resolve({ width: canvas.width, height: canvas.height, data });
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = path;
    });
}

/** Decode a Token's art, once; resolves when it has settled. */
export function loadArt(path) {
    if (!path || arts.has(path)) return Promise.resolve();
    if (!pending.has(path)) {
        pending.set(path, decode(path).then((art) => {
            arts.set(path, art);
            pending.delete(path);
        }));
    }
    return pending.get(path);
}

/** A Token's art shrunk to `px` preview pixels across, or null while it is not decoded. */
function shrunkArt(path, px) {
    const art = arts.get(path);
    if (!art || !(px > 0)) return null;
    const factor = Math.max(1, Math.round(art.width / px));
    const key = `${path}|${factor}`;
    if (!shrunk.has(key)) shrunk.set(key, shrinkArt(art, factor));
    return shrunk.get(key);
}

/** **Test seam.** A Token's art as if it had loaded. */
export function primePreviewArt(path, art) {
    arts.set(path, art);
    for (const key of [...shrunk.keys()]) if (key.startsWith(`${path}|`)) shrunk.delete(key);
}

/** **Test seam.** Nothing decoded. */
export function resetPreviewArt() {
    arts.clear();
    pending.clear();
    shrunk.clear();
}

/** The Token art paths a plan's preview draws. */
export function previewArtPaths(plan) {
    const ids = new Set((plan?.layout?.nodes || []).map(n => n.typeId));
    ids.add(HALL_TYPE_ID);
    return [...ids].map(tokenSpritePath).filter(Boolean);
}

/** Resolves once the ground's sheets and every Token art the plan draws have settled. */
export function previewReady(plan) {
    const ground = groundSheetsReady() ? Promise.resolve() : loadGroundSheets();
    return Promise.all([ground, ...previewArtPaths(plan).map(loadArt)]);
}

// ---------------------------------------------------------------------------
// The picture
// ---------------------------------------------------------------------------

const groundSheet = (id) => mutedSheet(sheetPath(id));
const propSheet = (id, asDrawn) => (asDrawn ? drawnSheet(propSheetPath(id)) : mutedSheet(propSheetPath(id)));

/** How long the last picture took, in ms, and how many have been built. */
const builds = { last: null, count: 0 };

/** **For the dev check.** The last picture's build time and the count so far. */
export function previewBuilds() {
    return { ...builds };
}

/**
 * The picture of a plan (`Atlas.preview` or a reroll) on `mat` (the mat now, in mat units) at
 * `fit`: RGBA bytes, `cols` × `rows`. The Region record it reads is the one `Atlas.settle` would
 * store: the plan's seed, its maps' ground and its cell map.
 */
export function previewPicture(plan, fit, mat = plan.layout.mat) {
    const t0 = performance.now();
    const { layout, summary, seed } = plan;
    const ground = regionGround({ seed, terrain: layout.terrain, ground: summary.ground }, mat);
    const pass = buildScreenPass(buildGroundPlan(ground), {
        mat, unit: fit.unit, pixel: fit.step, sheet: groundSheet, prop: propSheet
    });
    const draws = [];
    for (const t of previewTokens(layout, mat, fit.unit)) {
        const art = shrunkArt(tokenSpritePath(t.typeId), t.px);
        if (art) draws.push({ x: t.x, y: t.y, art });
    }
    paintTokens(pass.data, pass.cols, pass.rows, draws);
    const t1 = performance.now();
    builds.last = t1 - t0;
    builds.count++;
    if (import.meta.env?.DEV || import.meta.env?.MODE === 'perf') {
        try { performance.measure('fg-perf:atlas-preview', { start: t0, end: t1 }); } catch { /* an old browser */ }
    }
    return { cols: pass.cols, rows: pass.rows, data: pass.data, tokens: draws.length };
}
