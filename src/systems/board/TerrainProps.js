// scatter: small flat bits on the ground, cut from the prop sheets

import { hash01 } from './TerrainLattice.js';
import { PROP_PX, PROP_SHEET_CELLS, propsOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Where every prop stands, worked out from the Region's ground. Pure data, not drawing, so it can
 * be asserted on: the screen pass paints the list in the order given.
 *
 * A prop is one cell of a 4 × 4 prop sheet, drawn one prop pixel per ground pixel, so it never
 * has finer pixels than the ground it stands on. It stands on a point, not a cell: its foot is a
 * scattered pixel inside the cell that grew it, never the cell's centre (which would line props
 * up on a lattice), and the prop is dropped when its foot or the ends of its base are not on that
 * cell's own ground (a beach cut into a forest's edge leaves the cell forest but those pixels
 * sand).
 */

/**
 * Separate hash channels, so the questions asked of each cell are independent: turning the
 * density up must not also move every surviving prop and change which one it is.
 */
const CHANNEL_PRESENCE = 0x9101;
const CHANNEL_SHEET = 0x9102;
const CHANNEL_X = 0x9103;
const CHANNEL_Y = 0x9104;
const CHANNEL_CELL = 0x9105;

/** How far either side of the foot the base is checked, in pixels: the props' art spans about 12. */
const BASE_HALF = 5;

/** A weighted pick from a look's prop sheets. */
function pickSheet(props, roll) {
    const total = props.reduce((n, p) => n + p.weight, 0);
    let left = roll * total;
    for (const p of props) {
        left -= p.weight;
        if (left < 0) return p.sheet;
    }
    return props[props.length - 1].sheet;
}

/**
 * Every prop on the ground, in the order it should be painted.
 *
 * @param {object} ground The Region's ground (`regionGround`).
 * @param {object} pixels Its resolved map (`resolveArtPixels`): a prop's foot is checked on it.
 * @returns {Array<{sheet: string, index: number, look: string, x: number, y: number,
 *   footX: number, footY: number, cx: number, cy: number}>} `index` is the prop's cell in its
 *   sheet (row by row, 0–15); `x`, `y` the prop's top-left and `footX`, `footY` its foot, in plan
 *   pixels; `cx`, `cy` the cell that grew it. Back to front.
 */
export function propsForGround(ground, pixels) {
    const { cols, rows, cells, terrains, seed, looks } = ground;
    const { width, height, cellPx, at } = pixels;
    const span = tuning('propScatter');
    const margin = (1 - span) / 2;
    const densityScale = tuning('propDensity');
    const perSheet = PROP_SHEET_CELLS * PROP_SHEET_CELLS;
    const out = [];

    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const terrainIndex = cells[cy * cols + cx];
            const look = looks[terrains[terrainIndex]];
            const scatter = propsOf(look);
            if (!scatter) continue;
            if (hash01(cx, cy, CHANNEL_PRESENCE, seed) >= scatter.density * densityScale) continue;

            const footX = cx * cellPx + Math.floor((margin + hash01(cx, cy, CHANNEL_X, seed) * span) * cellPx);
            const footY = cy * cellPx + Math.floor((margin + hash01(cx, cy, CHANNEL_Y, seed) * span) * cellPx);
            const x = footX - PROP_PX / 2;
            const y = footY - (PROP_PX - 1);
            if (x < 0 || y < 0 || x + PROP_PX > width || footY >= height) continue;

            // ⚠️ Its own ground under the foot and both ends of the base, read on the drawn
            // pixels: the cell says forest, the beach rim may say sand.
            const row = footY * width;
            if (at[row + footX] !== terrainIndex
                || at[row + Math.max(0, footX - BASE_HALF)] !== terrainIndex
                || at[row + Math.min(width - 1, footX + BASE_HALF)] !== terrainIndex) continue;

            out.push({
                sheet: pickSheet(scatter.props, hash01(cx, cy, CHANNEL_SHEET, seed)),
                index: Math.floor(hash01(cx, cy, CHANNEL_CELL, seed) * perSheet) % perSheet,
                look, x, y, footX, footY, cx, cy
            });
        }
    }

    // Painter's order: whatever stands lower is nearer the viewer and goes on top; ties by x so
    // the order is total and stable.
    out.sort((a, b) => (a.footY - b.footY) || (a.footX - b.footX));
    return out;
}
