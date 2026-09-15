// Fantasy Guild — STOPGAP: snap a drop point to today's old spots (Free Playmat slice 1.6c)

/**
 * # ⚠️ STOPGAP — deleted in slice 1.6d
 *
 * The owner's framing rule: *there are no Tiles* — Tokens sit freely on the
 * mat. Until free placement (slice 1.6d), a dropped Token still has to land on
 * one of today's 36 old spots so the tile-shaped placement rules (restock on a
 * matching copy FP-50, pushing an occupant, the 2×2 cascade, planting on an
 * Academy FP-61) keep working unchanged. This file is the only thing that turns
 * a mat point into one of those spots.
 *
 * `OldSpotStopgapGuard.test.js` allows exactly two importers:
 * `dropOnMat.js` and `TrayMiniBoard.jsx`.
 *
 * Director-accepted (1.6c): the snap is to the **nearest spot, occupied or
 * not** — a drop on a Token means that Token.
 */

import {
    BOARD_SIZE, TILE_STEP_PX, OLD_AREA_ORIGIN, BOARD_PX,
    footprintCentre, tileCentre, isTileIndex
} from '../../../config/boardGeometry.js';

/** How far outside the old landing area a drop may land and still snap in (half a step, FP-93). */
export const OUTSIDE_AREA_GRACE_U = TILE_STEP_PX / 2;

/**
 * STOPGAP: the old spot nearest `point` for a Token of `size` — for a 2×2 the
 * anchor whose footprint centre is nearest. Clamped so the footprint fits on
 * the 6×6.
 */
export function oldSpotAt(point, size = 1) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const span = size === 2 ? 2 : 1;
    const probe = footprintCentre(0, span);
    const max = BOARD_SIZE - span;
    const col = Math.max(0, Math.min(max, Math.round((point.x - probe.x) / TILE_STEP_PX)));
    const row = Math.max(0, Math.min(max, Math.round((point.y - probe.y) / TILE_STEP_PX)));
    return row * BOARD_SIZE + col;
}

/** STOPGAP: the mat point at the centre of old spot `index`, or null. */
export function oldSpotPoint(index) {
    return isTileIndex(index) ? tileCentre(index) : null;
}

/**
 * STOPGAP (FP-93): whether `point` is **well outside** the old landing area —
 * farther than half a step from it. Such a Token drop flies back until slice
 * 1.6d lets Tokens stand anywhere.
 */
export function isFarOutsideArea(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return true;
    const left = OLD_AREA_ORIGIN.x;
    const top = OLD_AREA_ORIGIN.y;
    const dx = Math.max(left - point.x, 0, point.x - (left + BOARD_PX));
    const dy = Math.max(top - point.y, 0, point.y - (top + BOARD_PX));
    return dx * dx + dy * dy > OUTSIDE_AREA_GRACE_U * OUTSIDE_AREA_GRACE_U;
}
