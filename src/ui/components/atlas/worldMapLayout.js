// the world map's geometry and what each cell looks like (pure)

import { STRICT_RINGS } from '../../../config/worldTablesShape.js';
import { CELL_STATE } from '../../../systems/world/frontier.js';

/**
 * The map draws flat-topped hexes as board tiles over a painted world, on an art grid: one art
 * pixel is {@link ART_SCALE} screen pixels. Cell `(q, r)` stands at `x = 1.5 q R`,
 * `y = √3 (r + q / 2) R` from the Hall's cell, for a cell radius `R` (centre to corner) of
 * {@link HEX_R} art px, rounded to whole art pixels so every tile lands crisp.
 *
 * The three strict rings always show (they hold all of the game's content); a wild ring shows once
 * the guild can reach into it, and the world beyond the rings shown fades into fog.
 */

/** Screen px per art px: the UI's sprites draw at 2x. */
export const ART_SCALE = 2;

/** A cell's radius, centre to corner, in art px: a tile 84 art px across. */
export const HEX_R = 42;

/** A tile's thickness: how far its top stands above the world, in art px. */
export const TILE_LIFT = 5;

/** The tile picture: the top face (a hex 84 x 73) with its side showing under it. */
export const TILE_W = 2 * HEX_R;
export const TILE_TOP_H = 73;
export const TILE_H = TILE_TOP_H + TILE_LIFT;
/** Where the top face's middle lies in the tile picture. */
export const TILE_MID = Object.freeze({ x: HEX_R, y: 36 });

/** Item art is 32 px, drawn at 1x. */
export const ICON_PX = 32;

/** The most output icons a cell's plate shows; the rest are a count. */
export const MAX_ICONS = 3;

const SQRT3 = Math.sqrt(3);

/** How a cell looks: lit, can be settled now, darkened, or black and white. */
export const CELL_LOOK = Object.freeze({ SETTLED: 'settled', READY: 'ready', DARK: 'dark', GREY: 'grey' });

/** The CSS filter of each look; the pointer over a cell shows it in full colour. */
export const LOOK_FILTER = Object.freeze({
    [CELL_LOOK.SETTLED]: 'none',
    [CELL_LOOK.READY]: 'none',
    [CELL_LOOK.DARK]: 'brightness(0.5)',
    [CELL_LOOK.GREY]: 'grayscale(1) brightness(0.8)'
});

/**
 * How a cell looks. Settled: lit. On the frontier: ready (it pulses) when the guild can pay and
 * its ring is open, else darkened. Further out: black and white.
 *
 * @param {{ state: string, price?: { met: boolean } }} cell
 * @param {{ ringOpen?: (cell: object) => boolean }} [options] whether the guild may settle the
 *   cell's ring at all (every ring is open until the Hall's ring stars)
 */
export function cellLook(cell, { ringOpen = () => true } = {}) {
    if (cell.state === CELL_STATE.SETTLED) return CELL_LOOK.SETTLED;
    if (cell.state === CELL_STATE.FRONTIER) return cell.price?.met && ringOpen(cell) ? CELL_LOOK.READY : CELL_LOOK.DARK;
    return CELL_LOOK.GREY;
}

/**
 * The rings the map shows: the strict rings always, and a wild ring once any of its cells is
 * settled or can be settled next.
 *
 * @param {{ rings: number, cells: object[] } | null} world
 * @param {Map<string, string>} states each cell's `CELL_STATE`, by id
 */
export function shownRings(world, states) {
    if (!world) return 0;
    let reach = STRICT_RINGS;
    for (const cell of world.cells) {
        const state = states.get(cell.id);
        if ((state === CELL_STATE.SETTLED || state === CELL_STATE.FRONTIER) && cell.ring > reach) reach = cell.ring;
    }
    return Math.min(world.rings, reach);
}

/** A cell's middle from the Hall's, in whole art px. */
export function cellCentreArt(cell) {
    return { x: Math.round(1.5 * cell.q * HEX_R), y: Math.round(SQRT3 * (cell.r + cell.q / 2) * HEX_R) };
}

/** A cell's middle from the Hall's, in screen px. */
export function cellCentre(cell) {
    const { x, y } = cellCentreArt(cell);
    return { x: x * ART_SCALE, y: y * ART_SCALE };
}

/**
 * The corners of a cell's top face from its middle, in screen px, as SVG points: the flat-topped
 * hex lifted by the tile's thickness, its foot reaching down over the side.
 */
export function tilePoints({ inset = 0, withSide = false } = {}) {
    const s = ART_SCALE;
    const r = HEX_R * s - inset;
    const h = (SQRT3 / 2) * HEX_R * s - inset;
    const lift = TILE_LIFT * s;
    const foot = withSide ? lift : 0;
    return [
        [r, -lift], [r / 2, h - lift + foot], [-r / 2, h - lift + foot], [-r, -lift], [-r / 2, -h - lift], [r / 2, -h - lift]
    ].map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
}

/** The box the shown cells cover, in screen px from the Hall's middle. */
export function mapBounds(cells) {
    const s = ART_SCALE;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const cell of cells) {
        const { x, y } = cellCentre(cell);
        minX = Math.min(minX, x - HEX_R * s);
        maxX = Math.max(maxX, x + HEX_R * s);
        minY = Math.min(minY, y - TILE_MID.y * s - TILE_LIFT * s);
        maxY = Math.max(maxY, y + (TILE_TOP_H - TILE_MID.y) * s);
    }
    return { minX, maxX, minY, maxY };
}

/** How far past the map's edge the view may be dragged, in screen px: some of it always shows. */
export const PAN_KEEP_PX = 160;

/**
 * Keep the view (where the Hall's middle stands in the window) such that some of the map stays in
 * sight, in whole px.
 *
 * @param {{x: number, y: number}} view
 * @param {{w: number, h: number}} sight the part of the window the map shows in
 * @param {{minX: number, maxX: number, minY: number, maxY: number}} bounds
 */
export function clampView(view, sight, bounds) {
    const keep = Math.min(PAN_KEEP_PX, sight.w / 2, sight.h / 2);
    const x = Math.min(sight.w - keep - bounds.minX, Math.max(keep - bounds.maxX, view.x));
    const y = Math.min(sight.h - keep - bounds.minY, Math.max(keep - bounds.maxY, view.y));
    return { x: Math.round(x), y: Math.round(y) };
}

/** The view with cell `cell`'s middle in the middle of the sight. */
export function viewOn(cell, sight) {
    const { x, y } = cell ? cellCentre(cell) : { x: 0, y: 0 };
    return { x: Math.round(sight.w / 2 - x), y: Math.round(sight.h / 2 - y) };
}
