// Fantasy Guild — Board adjacency (7×7 Playmat rework, Phase 2)

import { BOARD_SIZE, TILE_COUNT, isTileIndex } from '../../ui/components/board/boardConstants.js';

/**
 * Adjacency — **one rule everywhere: the 8 surrounding tiles** (D-81).
 *
 * This is the single most re-used primitive in the whole design. Context
 * recipes, buff Tokens, the Guild Hall aura and Manager reach all use this
 * function unmodified. There are no ranges, no radii and no orthogonal
 * exceptions, deliberately — the player learns one neighbourhood and it is
 * true everywhere.
 *
 * **Edges get no special treatment** (D-61). A corner Token has 3 neighbours
 * and a central one has 8, and that is the only positional difference on the
 * board. It is not a mechanic to design around; it is a consequence of the
 * grid being finite.
 *
 * Indices are row-major over a fixed 7×7:
 *
 * ```
 *    0  1  2  3  4  5  6
 *    7  8  9 10 11 12 13
 *   14 15 16 17 18 19 20
 *   21 22 23 24 25 26 27      ← 24 is the Guild Hall
 *   28 29 30 31 32 33 34
 *   35 36 37 38 39 40 41
 *   42 43 44 45 46 47 48
 * ```
 *
 * ⚠️ **Tile 0 is a valid index.** Every check against a tile must be `== null`
 * or `isTileIndex()`, never truthiness — the top-left corner is falsy and a
 * truthiness test silently treats it as "no tile".
 */

/** Row/column offsets of the 8 neighbours, in reading order. */
const OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], /* self */[0, 1],
    [1, -1], [1, 0], [1, 1]
];

/**
 * Precomputed neighbour lists, one per tile.
 *
 * The board is a fixed size forever (D-1), so every neighbourhood is known at
 * module load and never changes. Adjacency is read constantly — on every cycle
 * completion, every recipe resolution and every buff lookup, across up to 48
 * live tiles — so recomputing it per call would be the kind of quiet waste that
 * only shows up once the board is full.
 *
 * @type {ReadonlyArray<ReadonlyArray<number>>}
 */
const NEIGHBOURS = Object.freeze(
    Array.from({ length: TILE_COUNT }, (_, index) => {
        const row = Math.floor(index / BOARD_SIZE);
        const col = index % BOARD_SIZE;
        const out = [];
        for (const [dr, dc] of OFFSETS) {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
            out.push(r * BOARD_SIZE + c);
        }
        return Object.freeze(out);
    })
);

/**
 * The tiles surrounding `index` — 3 at a corner, 5 along an edge, 8 inside.
 *
 * Returns a frozen array: callers must not mutate it, and freezing makes an
 * accidental `.push()` fail loudly rather than corrupting every future lookup
 * of that tile.
 *
 * An out-of-range index returns an empty list rather than throwing, so callers
 * iterating loosely-typed state don't need to guard.
 *
 * @param {number} index
 * @returns {ReadonlyArray<number>}
 */
export function neighboursOf(index) {
    return isTileIndex(index) ? NEIGHBOURS[index] : EMPTY;
}

const EMPTY = Object.freeze([]);

/**
 * Whether two tiles are adjacent. Symmetric, and a tile is never adjacent to
 * itself — a Context Token does not modify the station it *is*.
 */
export function areAdjacent(a, b) {
    return isTileIndex(a) && isTileIndex(b) && NEIGHBOURS[a].includes(b);
}

/**
 * Every tile whose neighbourhood contains `index`.
 *
 * Adjacency is symmetric, so this is just `neighboursOf` — but the two read
 * very differently at a call site, and the distinction matters:
 *
 *   `neighboursOf(forge)`  — "what context is feeding this Forge?"
 *   `dependentsOf(rack)`   — "which stations wear this Tool Rack down?"
 *
 * The second is what D-126 needs: a Context Token loses one use per cycle each
 * adjacent station completes, so one Rack serving three Forges wears three
 * times as fast (D-157). Naming it separately keeps that intent legible.
 */
export const dependentsOf = neighboursOf;
