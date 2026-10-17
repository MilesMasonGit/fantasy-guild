// scatter: small flat bits on the ground in groups, cut from the prop sheets

import { hash01 } from './TerrainLattice.js';
import { PROP_PX, PROP_SHEET_CELLS, propsOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Where every prop stands, worked out from the Region's ground. Pure data, not drawing, so it can
 * be asserted on: the screen pass paints the list in the order given.
 *
 * Props stand in **groups**: a few of one kind round a point, with open ground between, the way
 * flowers, mushrooms and stones gather. Evenly sprinkled singles read as carpet.
 *
 * The mat is cut into blocks of {@link BLOCK_CELLS} × {@link BLOCK_CELLS} cells (a Token wide);
 * each block may grow one group, its centre a scattered point inside the block (never the block's
 * middle, which would line groups up on a lattice). The group belongs to the ground of the cell
 * under its centre, and a member is dropped when its foot or the ends of its base are not on that
 * ground (a beach cut into a forest's edge leaves the cell forest but those pixels sand).
 *
 * A prop is one cell of a 4 × 4 prop sheet, drawn one prop pixel per ground pixel, so it never has
 * finer pixels than the ground it stands on.
 */

/**
 * Separate hash channels, so the questions asked of each block are independent: turning the
 * density up must not also move every surviving group and change what it is.
 */
const CHANNEL_PRESENCE = 0x9101;
const CHANNEL_SHEET = 0x9102;
const CHANNEL_X = 0x9103;
const CHANNEL_Y = 0x9104;
const CHANNEL_CELL = 0x9105;
const CHANNEL_COUNT = 0x9106;
const CHANNEL_TURN = 0x9107;
const CHANNEL_MEMBER = 0x9108;

/** A group's block, in cells across: 4 cells of 32 units is one Token. */
export const BLOCK_CELLS = 4;

/** How far either side of the foot the base is checked, in pixels: the props' art spans about 12. */
const BASE_HALF = 5;

/** The golden angle: members placed round a point by it never line up in spokes. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** A group's members are drawn a little flatter than round, as the ground is seen at a slant. */
const GROUP_FLATTEN = 0.75;

/** How often a member is the group's own prop rather than another from the same row of its sheet. */
const SAME_KIND = 0.6;

/** The smallest and largest group the "Group size" slider allows: half its value up to its value. */
export function groupSizes() {
    const most = Math.max(1, Math.round(tuning('propGroupSize')));
    return { least: Math.ceil(most / 2), most };
}

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
 *   footX: number, footY: number, cx: number, cy: number, group: number, gx: number, gy: number}>}
 *   `index` is the prop's cell in its sheet (row by row, 0–15); `x`, `y` the prop's top-left and
 *   `footX`, `footY` its foot, in plan pixels; `cx`, `cy` the cell its foot is in; `group` its
 *   group's block (row by row) and `gx`, `gy` the group's centre. Back to front.
 */
export function propsForGround(ground, pixels) {
    const { cols, rows, cells, terrains, seed, looks } = ground;
    const { width, height, cellPx, at } = pixels;
    const span = tuning('propScatter');
    const margin = (1 - span) / 2;
    const densityScale = tuning('propDensity');
    const spread = tuning('propGroupSpread') / 2;
    const { least, most } = groupSizes();
    const meanSize = (least + most) / 2;
    const blockPx = BLOCK_CELLS * cellPx;
    const blocksX = Math.ceil(cols / BLOCK_CELLS);
    const blocksY = Math.ceil(rows / BLOCK_CELLS);
    const out = [];
    // Two props on one foot would draw one over the other for nothing, and leave the order a tie.
    const taken = new Set();

    for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
            const gx = bx * blockPx + Math.floor((margin + hash01(bx, by, CHANNEL_X, seed) * span) * blockPx);
            const gy = by * blockPx + Math.floor((margin + hash01(bx, by, CHANNEL_Y, seed) * span) * blockPx);
            if (gx >= width || gy >= height) continue;
            const cx = Math.floor(gx / cellPx);
            const cy = Math.floor(gy / cellPx);
            if (cx >= cols || cy >= rows) continue;
            const terrainIndex = cells[cy * cols + cx];
            // A group grows only from its own ground: never from a beach cut into a forest's cell.
            if (at[gy * width + gx] !== terrainIndex) continue;
            const look = looks[terrains[terrainIndex]];
            const scatter = propsOf(look);
            if (!scatter) continue;
            // The same number of props as one per cell at the look's density, gathered.
            const chance = (scatter.density * densityScale * BLOCK_CELLS * BLOCK_CELLS) / meanSize;
            if (hash01(bx, by, CHANNEL_PRESENCE, seed) >= chance) continue;

            const group = by * blocksX + bx;
            const sheet = pickSheet(scatter.props, hash01(bx, by, CHANNEL_SHEET, seed));
            const row = Math.floor(hash01(bx, by, CHANNEL_CELL, seed) * PROP_SHEET_CELLS) % PROP_SHEET_CELLS;
            const own = Math.floor(hash01(bx, by, CHANNEL_CELL, seed, 1) * PROP_SHEET_CELLS) % PROP_SHEET_CELLS;
            const count = least + Math.floor(hash01(bx, by, CHANNEL_COUNT, seed) * (most - least + 1)) % (most - least + 1);
            const turn = hash01(bx, by, CHANNEL_TURN, seed) * Math.PI * 2;

            for (let k = 0; k < count; k++) {
                // A sunflower spiral: evenly spaced round the centre whatever the count, nudged.
                const angle = turn + k * GOLDEN_ANGLE;
                const reach = count === 1 ? 0 : spread * Math.sqrt(k + 0.5);
                const nudgeX = (hash01(group, k, CHANNEL_MEMBER, seed, 0) - 0.5) * spread;
                const nudgeY = (hash01(group, k, CHANNEL_MEMBER, seed, 1) - 0.5) * spread;
                const footX = Math.round(gx + Math.cos(angle) * reach + nudgeX);
                const footY = Math.round(gy + (Math.sin(angle) * reach + nudgeY) * GROUP_FLATTEN);
                const x = footX - PROP_PX / 2;
                const y = footY - (PROP_PX - 1);
                if (x < 0 || y < 0 || x + PROP_PX > width || footY >= height) continue;

                // ⚠️ Its own ground under the foot and both ends of the base, read on the drawn
                // pixels: the cell says forest, the beach rim may say sand.
                const base = footY * width;
                if (at[base + footX] !== terrainIndex
                    || at[base + Math.max(0, footX - BASE_HALF)] !== terrainIndex
                    || at[base + Math.min(width - 1, footX + BASE_HALF)] !== terrainIndex) continue;
                if (taken.has(base + footX)) continue;
                taken.add(base + footX);

                const kind = hash01(group, k, CHANNEL_MEMBER, seed, 2) < SAME_KIND
                    ? own
                    : Math.floor(hash01(group, k, CHANNEL_MEMBER, seed, 3) * PROP_SHEET_CELLS) % PROP_SHEET_CELLS;
                out.push({
                    sheet, index: row * PROP_SHEET_CELLS + kind,
                    look, x, y, footX, footY,
                    cx: Math.floor(footX / cellPx), cy: Math.floor(footY / cellPx),
                    group, gx, gy
                });
            }
        }
    }

    // Painter's order: whatever stands lower is nearer the viewer and goes on top; ties by x so
    // the order is total and stable.
    out.sort((a, b) => (a.footY - b.footY) || (a.footX - b.footX));
    return out;
}
