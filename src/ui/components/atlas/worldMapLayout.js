// the world map's geometry: which rings show, how big a cell is, where each one stands (pure)

import { STRICT_RINGS } from '../../../config/worldTablesShape.js';

/**
 * The map draws flat-topped hexes: cell `(q, r)` stands at `x = 1.5 q s`, `y = √3 (r + q / 2) s`
 * from the Hall's cell, for a cell of radius `s` (centre to corner), in whole screen pixels.
 *
 * Every strict ring shows from the start (they hold all of the game's content); the wild rings come
 * into view {@link RINGS_AHEAD} rings beyond the guild's furthest place, so the cells stay big
 * enough to show their outputs while the map is young.
 */

/** How many rings past the furthest settled cell the map shows. */
export const RINGS_AHEAD = 2;

/** Item art is 32 px, drawn at 1× (never in between). */
export const ICON_PX = 32;
const ICON_GAP_PX = 2;

/** The most output icons a cell shows; the rest are a count. */
export const MAX_ICONS = 3;

/** The smallest and largest cell radius the map draws, in screen px. */
export const MIN_RADIUS = 20;
export const MAX_RADIUS = 72;

const SQRT3 = Math.sqrt(3);

/** The rings the map shows: every strict ring, and {@link RINGS_AHEAD} past the furthest settled cell. */
export function shownRings(world, settled) {
    if (!world) return 0;
    let furthest = 0;
    for (const cell of world.cells) if (settled.has(cell.id) && cell.ring > furthest) furthest = cell.ring;
    return Math.min(world.rings, Math.max(STRICT_RINGS, furthest + RINGS_AHEAD));
}

/** The radius that fits `rings` rings in a `width` × `height` room, in whole px. */
export function cellRadius(rings, width, height) {
    const across = 3 * rings + 2;
    const down = SQRT3 * (2 * rings + 1);
    const fit = Math.floor(Math.min(width / across, height / down));
    return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, fit));
}

/** A cell's centre from the Hall's, in whole px. */
export function cellCentre(cell, radius) {
    return { x: Math.round(1.5 * cell.q * radius), y: Math.round(SQRT3 * (cell.r + cell.q / 2) * radius) };
}

/** The map's own size for `rings` rings at `radius`: what the cells cover. */
export function mapSize(rings, radius) {
    return { width: Math.ceil((3 * rings + 2) * radius), height: Math.ceil(SQRT3 * (2 * rings + 1) * radius) };
}

/** A flat-topped hex of `radius` round `(0, 0)`, as SVG points. */
export function hexPoints(radius) {
    const h = (SQRT3 / 2) * radius;
    return [
        [radius, 0], [radius / 2, h], [-radius / 2, h], [-radius, 0], [-radius / 2, -h], [radius / 2, -h]
    ].map(([x, y]) => `${Math.round(x * 2) / 2},${Math.round(y * 2) / 2}`).join(' ');
}

/** How many 32 px icons fit in a row across a cell of `radius`, at least 1. */
export function iconsPerCell(radius) {
    // A row of icons stands half an icon above and below the centre line, where a flat-topped hex
    // is narrower than across its middle by half an icon's height over √3 on each side.
    const room = 2 * radius - ICON_PX / SQRT3 - 4;
    return Math.max(1, Math.min(MAX_ICONS, Math.floor((room + ICON_GAP_PX) / (ICON_PX + ICON_GAP_PX))));
}
