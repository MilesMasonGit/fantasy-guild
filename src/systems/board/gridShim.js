// Fantasy Guild — STOPGAP tile view over free positions (Free Playmat slice 1.6a)

/**
 * # ⚠️ STOPGAP — deleted in slice 1.6d
 *
 * The owner's framing rule for the free playmat: *there are no Tiles.* Tokens
 * are stored by instance id at a point on the mat (`board.tokens[id] = { x, y,
 * placedAt, … }`, slice 1.6a). This file exists only so every reader written
 * against the old tile-index API keeps working, unchanged, while slices 1.6b
 * (readers) and 1.6c (renderer) move off it. Slice 1.6d deletes it, and
 * `GridShimGuard.test.js` counts its importers so that deletion is forced.
 *
 * ## How a Token is "on" a tile
 * A Token counts as sitting on tile `i` when its point is **exactly** the
 * centre of that tile (a 1×1 Token) or the centre of the 2×2 footprint
 * anchored at `i` (a 2×2 Token). Every route onto the mat in 1.6a lands a
 * Token on one of those points, so every Token has a tile. A Token whose point
 * matches no tile is invisible to this view — that cannot happen until free
 * dropping arrives in 1.6d, which is when this file goes.
 *
 * ## Cached per board
 * The view (anchor → Token, covered tile → Token) is rebuilt only when
 * `invalidate(board)` is called — every `BoardState` mutator does — or when the
 * `tokens` object itself is swapped (a load, a test hand-building a board).
 * ⚠️ So a Token's `x`/`y` must only ever change through `BoardState`.
 *
 * Everything here is pure over the board object it is handed; `BoardState`
 * owns the storage and wraps these as its old tile functions.
 */

import {
    TILE_COUNT, BOARD_SIZE, TILE_STEP_PX, isTileIndex, isPlaceable, tileFootprint, footprintCentre
} from '../../config/boardGeometry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';

const sizeOf = (typeId) => getTokenType(typeId)?.size || 1;

/** STOPGAP: the point a Token of `typeId` anchored at tile `index` sits at. */
export function anchorPoint(index, typeId) {
    return footprintCentre(index, sizeOf(typeId));
}

/**
 * STOPGAP: the anchor tile of a Token of `typeId` whose centre is `(x, y)`, or
 * null when that point is not exactly a tile (or 2×2 footprint) centre.
 */
export function anchorOfPoint(x, y, typeId) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const probe = footprintCentre(0, sizeOf(typeId));   // centre of the footprint at tile 0
    const col = (x - probe.x) / TILE_STEP_PX;
    const row = (y - probe.y) / TILE_STEP_PX;
    if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
    if (col < 0 || row < 0 || col >= BOARD_SIZE || row >= BOARD_SIZE) return null;
    const index = row * BOARD_SIZE + col;
    return isTileIndex(index) ? index : null;
}

const views = new WeakMap();

/** STOPGAP: forget the cached view — call after any change to a Token's point or presence. */
export function invalidate(board) {
    if (board) views.delete(board);
}

function viewOf(board) {
    const tokens = board?.tokens;
    if (!tokens) return EMPTY_VIEW;
    const cached = views.get(board);
    if (cached && cached.tokens === tokens) return cached;

    const anchors = new Map();   // anchor tile → instance
    const cover = new Map();     // any covered tile → { anchor, instance, footprint }
    const byId = new Map();      // instance id → anchor tile

    // placedAt order, so a later arrival on the same anchor wins — the old
    // tile map was last-write-wins.
    const ordered = Object.values(tokens)
        .filter(t => t?.typeId)
        .sort((a, b) => (a.placedAt ?? 0) - (b.placedAt ?? 0));
    for (const instance of ordered) {
        const anchor = anchorOfPoint(instance.x, instance.y, instance.typeId);
        if (anchor == null) continue;
        const prev = anchors.get(anchor);
        if (prev) byId.delete(prev.id);
        anchors.set(anchor, instance);
        byId.set(instance.id, anchor);
    }
    const sortedAnchors = [...anchors.keys()].sort((a, b) => a - b);
    // Ascending anchor order, as the old footprint scan walked the tile map.
    for (const anchor of sortedAnchors) {
        const instance = anchors.get(anchor);
        const footprint = tileFootprint(anchor, sizeOf(instance.typeId));
        for (const tile of footprint) {
            // An anchor always answers for itself (the old direct lookup came first).
            if (tile !== anchor && anchors.has(tile)) continue;
            if (tile !== anchor && cover.has(tile)) continue;
            cover.set(tile, { anchor, instance, footprint });
        }
    }
    const view ={ tokens, anchors, cover, byId, sortedAnchors };
    views.set(board, view);
    return view;
}

const EMPTY_VIEW = Object.freeze({
    tokens: null, anchors: new Map(), cover: new Map(), byId: new Map(), sortedAnchors: []
});

/** STOPGAP: the Token anchored at tile `index`, or null. */
export function getToken(board, index) {
    if (!isTileIndex(index)) return null;
    return viewOf(board).anchors.get(index) || null;
}

/** STOPGAP: the Token covering tile `index` (anchor or footprint body), in the old shape. */
export function getOccupyingToken(board, index) {
    if (!isTileIndex(index)) return null;
    const hit = viewOf(board).cover.get(index);
    if (!hit) return null;
    return {
        anchorIndex: hit.anchor,
        instance: hit.instance,
        isAnchor: hit.anchor === index,
        footprint: hit.footprint
    };
}

/** STOPGAP: every occupied anchor as `[index, instance]`, index ascending. */
export function occupiedTiles(board) {
    const view = viewOf(board);
    return view.sortedAnchors.map(index => [index, view.anchors.get(index)]);
}

/** STOPGAP: every tile nothing covers, ascending. */
export function emptyTiles(board) {
    const view = viewOf(board);
    const out = [];
    for (let i = 0; i < TILE_COUNT; i++) {
        if (isPlaceable(i) && !view.cover.has(i)) out.push(i);
    }
    return out;
}

/** STOPGAP: the anchor tile of Token instance `id`, or null. */
export function anchorOfId(board, id) {
    const anchor = viewOf(board).byId.get(id);
    return anchor == null ? null : anchor;
}

// ---------------------------------------------------------------------------
// Vacancies by tile — STOPGAP view over spot vacancies
// ---------------------------------------------------------------------------

/** STOPGAP: the anchor tile a spot vacancy stands for, or null. */
export function vacancyAnchor(vacancy) {
    return vacancy ? anchorOfPoint(vacancy.x, vacancy.y, vacancy.typeId) : null;
}

/** STOPGAP: the spot id and vacancy standing for tile `index`, as `[spotId, vacancy]`, or null. */
export function vacancyEntryAt(board, index) {
    if (!isTileIndex(index)) return null;
    const map = board?.vacancies || {};
    for (const spotId of Object.keys(map)) {
        if (vacancyAnchor(map[spotId]) === index) return [spotId, map[spotId]];
    }
    return null;
}

/** STOPGAP: every vacancy as `[anchorTile, vacancy]`, tile ascending. */
export function vacancyTiles(board) {
    const map = board?.vacancies || {};
    return Object.keys(map)
        .map(spotId => [vacancyAnchor(map[spotId]), map[spotId]])
        .filter(([anchor]) => anchor != null)
        .sort((a, b) => a[0] - b[0]);
}
