// Fantasy Guild — Distance on the playmat (Free Playmat slice 1.2)

import {
    TILE_COUNT, TILE_STEP_PX, isTileIndex, tileCentre, footprintCentre
} from '../../config/boardGeometry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { REACH } from '../../config/registries/reachRegistry.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';

/**
 * `nearby()` — reach as a **distance**, measured centre to centre (FP-41, A-5).
 *
 * ## Why, while the grid still exists (FP-56)
 * The free playmat has no tiles, so "the 8 surrounding tiles" cannot survive it.
 * Every passive reader is rewritten as a distance query *now*, while Tokens
 * still sit on tile centres, with Near sized so a 1×1 Token sees exactly today's
 * ring: the diagonal neighbour is 226 u away and the next ring 320 u, so the
 * default 272 u (FP-65) gives corners 3, edges 5, centre 8.
 *
 * ## ⚠️ Large Tokens reach less, deliberately (FP-41)
 * Measured from a 2×2 Token's footprint centre, Near reaches the 8 tiles that
 * touch its sides but not the 4 that touch only its corners (12 → 8). Tokens
 * near a 2×2 measure to its centre too, so the relation stays symmetric. Two
 * 2×2 Tokens side by side are 320 u apart and do NOT reach each other at 272 u.
 *
 * ## Reach ids are unchanged
 * `adjacent` stays the stored id and now means **Near**; `self_and_adjacent`
 * likewise; `self` and `board` are unchanged. No Close/Far rows (FP-53).
 *
 * ## Every reach reader uses it (slice 1.3)
 * The passive readers (slice 1.2) and the active ones (slice 1.3) —
 * `RecipeResolver`, `Charges`, `Managers`, `TriggerSystem.handleAdjacent`,
 * `Restrictions` and `Placement`'s rebuild coverage — all measure here, so
 * crafting context, tool wear, Manager reach, neighbour triggers and `Cannot`
 * counts agree with buff reach for every Token shape (FP-41). `adjacency.js`
 * has no production callers left.
 *
 * ## Tokens that are not (or no longer) on the board
 * `nearby()` reads the live board. Three readers need a position the board
 * cannot give: a Manager restocking a vacancy, a neighbour trigger whose source
 * has just left, and a `Cannot` check on a layout that has not happened yet.
 * They use {@link centreOf} (a position from an anchor and a type) with
 * {@link tokensWithin} or {@link isWithin}, which is the same measurement.
 */

/** The live Near radius, in mat units (Mat Tuner, FP-66). */
export function nearRadius() {
    return matTuning('nearRadius');
}

/**
 * How far a tile's centre can sit from the centre of a Token covering it — the
 * half-diagonal of a 2×2 footprint's middle offset (≈113 u). Rebuild coverage
 * adds it when it cannot know what shape of Token just left a tile.
 */
export const LARGEST_CENTRE_OFFSET = Math.hypot(TILE_STEP_PX / 2, TILE_STEP_PX / 2);

/**
 * A Token's position in mat units, derived from its tile: the centre of the
 * footprint of whatever covers `tile`, or the tile's own centre when empty.
 */
export function positionOf(tile) {
    if (!isTileIndex(tile)) return null;
    const occ = BoardState.getOccupyingToken(tile);
    if (occ?.instance) {
        return footprintCentre(occ.anchorIndex, getTokenType(occ.instance.typeId)?.size || 1);
    }
    return tileCentre(tile);
}

/** Straight-line distance between two mat points. */
export function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Squared distance between two mat points. Centres on the grid are whole
 * numbers, so this is exact — two equal distances compare equal, which a
 * nearest-first tie-break depends on.
 */
export function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

/** Whether two mat points are within `radius` of each other (inclusive). */
function within(a, b, radius) {
    return distanceSq(a, b) <= radius * radius;
}

/** Whether two mat points are within `radius` of each other (inclusive). */
export function isWithin(a, b, radius = nearRadius()) {
    return !!a && !!b && within(a, b, radius);
}

/**
 * Where a Token of `typeId` anchored at `anchor` has its centre — whether or not
 * it is on the board right now. Used for hypothetical layouts (`Restrictions`)
 * and for Tokens that have just left (a vacancy, a depletion trigger).
 */
export function centreOf(anchor, typeId) {
    return footprintCentre(anchor, getTokenType(typeId)?.size || 1);
}

/**
 * Every Token on the board whose centre lies within `radius` of `point`, as
 * anchors in ascending order, skipping `excludeAnchor`.
 *
 * The point-based form of {@link nearby}, for readers whose origin is not a
 * Token currently on the board.
 */
export function tokensWithin(point, radius = nearRadius(), excludeAnchor = null) {
    if (!point) return [];
    const out = [];
    for (const [anchor, instance] of BoardState.occupiedTiles()) {
        if (!instance?.typeId || anchor === excludeAnchor) continue;
        if (within(point, centreOf(anchor, instance.typeId), radius)) out.push(anchor);
    }
    return out;
}

/**
 * The Tokens a rule at `reach` carries to, seen from the Token on `tile`.
 *
 * Returns **anchor indices** of occupied Tokens, so a multi-tile Token is named
 * once:
 * * `self`              — the Token on `tile` (if any)
 * * `adjacent`          — every other Token whose centre is within Near
 * * `self_and_adjacent` — both, the Token itself first
 * * `board`             — every Token, in ascending tile order
 *
 * An empty `tile` measures from the tile's own centre and has no self.
 * An unknown reach id is treated as `adjacent`, as `reachCovers` does.
 *
 * @param {number} tile
 * @param {string} [reach]
 * @param {number} [radius] override, mainly for tests; defaults to the live Near
 * @returns {number[]}
 */
export function nearby(tile, reach = REACH.ADJACENT, radius = nearRadius()) {
    if (!isTileIndex(tile)) return [];

    const occ = BoardState.getOccupyingToken(tile);
    const selfAnchor = occ?.instance ? occ.anchorIndex : null;
    const origin = positionOf(tile);

    if (reach === REACH.SELF) return selfAnchor == null ? [] : [selfAnchor];

    const board = reach === REACH.BOARD;
    const out = [];
    if (!board && reach === REACH.SELF_AND_ADJACENT && selfAnchor != null) out.push(selfAnchor);

    // `board.tiles` is keyed by anchors only, so this names each Token once.
    for (const [anchor, instance] of BoardState.occupiedTiles()) {
        if (!instance?.typeId) continue;
        if (anchor === selfAnchor) {
            if (board) out.push(anchor);
            continue;
        }
        if (board) {
            out.push(anchor);
            continue;
        }
        const centre = footprintCentre(anchor, getTokenType(instance.typeId)?.size || 1);
        if (within(origin, centre, radius)) out.push(anchor);
    }
    return out;
}

/**
 * Every tile whose centre lies within `radius` of a mat point, ascending.
 * Pure geometry — ignores what is on the board.
 */
export function tilesWithin(point, radius = nearRadius()) {
    const out = [];
    for (let i = 0; i < TILE_COUNT; i++) {
        if (within(point, tileCentre(i), radius)) out.push(i);
    }
    return out;
}

/**
 * The tiles whose modifiers can change when `indexOrFootprint` changes.
 *
 * ## Why this follows the radius, not a fixed ring
 * A tile's buffs depend on every Token within Near of it. If rebuilds only ever
 * touched the 8-tile ring, raising Near in the Mat Tuner would leave tiles
 * outside the ring holding stale buffs (or missing new ones).
 *
 * ## The bound
 * * The changed Token's own footprint is always included.
 * * Any tile whose Token centre (or own centre, if empty) is within Near of the
 *   changed Token's centre.
 * * When `tile` is **empty** we cannot know what just left it — a 2×2 Token's
 *   centre may be up to `LARGEST_CENTRE_OFFSET` from this tile — so the radius
 *   grows by that much. Rebuilding a few extra tiles is harmless; missing one is
 *   a silently stale buff.
 *
 * At the default radius, an occupied 1×1 tile covers exactly itself + today's
 * 8-ring. 36 tiles at most; run on events, never per frame.
 *
 * @param {number|number[]} indexOrFootprint a tile, or a Token's footprint
 * @returns {number[]}
 */
export function tilesToRebuild(indexOrFootprint, radius = nearRadius()) {
    let origin;
    let own;
    let reachU = radius;

    if (Array.isArray(indexOrFootprint)) {
        own = indexOrFootprint.filter(isTileIndex);
        if (!own.length) return [];
        // The footprint's own centre — correct even after the Token has left.
        const pts = own.map(tileCentre);
        origin = {
            x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
            y: pts.reduce((s, p) => s + p.y, 0) / pts.length
        };
    } else {
        if (!isTileIndex(indexOrFootprint)) return [];
        const occ = BoardState.getOccupyingToken(indexOrFootprint);
        if (occ?.instance) {
            own = occ.footprint;
            origin = positionOf(indexOrFootprint);
        } else {
            own = [indexOrFootprint];
            origin = tileCentre(indexOrFootprint);
            reachU = radius + LARGEST_CENTRE_OFFSET;
        }
    }

    const ownSet = new Set(own);
    const out = [];
    for (let i = 0; i < TILE_COUNT; i++) {
        if (ownSet.has(i) || within(origin, positionOf(i), reachU)) out.push(i);
    }
    return out;
}

/**
 * The tiles to rebuild after a change touching `tiles`, when what used to stand
 * there is not known (slice 1.3 — `Placement`'s single dirty event).
 *
 * ## Why not {@link tilesToRebuild} per tile
 * `tilesToRebuild` measures an **occupied** tile from its current Token. After a
 * swap, a push or a 2×2 cascade, the Token now on a tile is often not the one
 * that left it — a 2×2 lands where three 1×1 Tokens stood — and the departed
 * Token's buffs reached from a different centre. Any Token that covered a tile
 * had its centre within `LARGEST_CENTRE_OFFSET` of that tile's centre, so
 * `radius + LARGEST_CENTRE_OFFSET` from every changed tile covers both the
 * arrival and the departure, whatever their shapes.
 *
 * Deliberately generous (about 20 tiles for one 1×1 change at 272 u): rebuilding
 * an extra tile is harmless, missing one is a silently stale buff. 36 at most.
 *
 * @param {number[]} tiles
 * @returns {number[]} ascending
 */
export function tilesAroundChange(tiles, radius = nearRadius()) {
    const changed = (tiles || []).filter(isTileIndex);
    if (!changed.length) return [];
    const reachU = radius + LARGEST_CENTRE_OFFSET;
    const centres = changed.map(tileCentre);
    const changedSet = new Set(changed);
    const out = [];
    for (let i = 0; i < TILE_COUNT; i++) {
        const p = positionOf(i);
        if (changedSet.has(i) || centres.some(c => within(c, p, reachU))) out.push(i);
    }
    return out;
}
