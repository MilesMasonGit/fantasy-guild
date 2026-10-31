// hex cells around the Hall's cell: axial coordinates, rings and the six sides (a leaf module)

/**
 * The world map is a hex grid around the Guild Hall's cell at `(0, 0)`, in axial coordinates
 * `(q, r)`. Ring `n` is every cell `n` steps from the centre: 1 cell at ring 0, then `6 n`.
 *
 * Each ring is walked from its six corners: corner `k` is `DIRECTIONS[k] × n`, and side `k` is that
 * corner and the `n − 1` cells after it towards corner `k + 1`. A side across rings 1 to 3 is the
 * wedge the owner asked for: equal widths, 1 + 2 + 3 cells, rising outward.
 *
 * Pure and import-free: the CMS and the ledger read it too.
 */

/** The six neighbour steps, in turning order: each is the sum of the two beside it. */
export const DIRECTIONS = Object.freeze([
    Object.freeze({ q: 1, r: 0 }),
    Object.freeze({ q: 1, r: -1 }),
    Object.freeze({ q: 0, r: -1 }),
    Object.freeze({ q: -1, r: 0 }),
    Object.freeze({ q: -1, r: 1 }),
    Object.freeze({ q: 0, r: 1 })
]);

export const SIDES = DIRECTIONS.length;

/** A cell's id: `"q,r"`. */
export function cellId(q, r) {
    return `${q},${r}`;
}

/** Steps between two cells. */
export function distance(a, b) {
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** The ring a cell lies on: its steps from the Hall's cell. */
export function ringOf(cell) {
    return distance(cell, { q: 0, r: 0 });
}

/** The six cells around one, in direction order. */
export function neighbours(cell) {
    return DIRECTIONS.map(d => ({ q: cell.q + d.q, r: cell.r + d.r }));
}

/**
 * The cells of ring `n` in walking order: `{ q, r, ring, side, step, index }`, where `side` is the
 * wedge it belongs to (0–5), `step` its place along that side and `index` its place in the walk.
 * Ring 0 is the Hall's cell alone, with no side.
 */
export function ringCells(n) {
    if (!Number.isInteger(n) || n < 0) return [];
    if (n === 0) return [{ q: 0, r: 0, ring: 0, side: null, step: 0, index: 0 }];
    const out = [];
    for (let side = 0; side < SIDES; side++) {
        const corner = DIRECTIONS[side];
        const along = DIRECTIONS[(side + 2) % SIDES];
        for (let step = 0; step < n; step++) {
            out.push({
                q: corner.q * n + along.q * step,
                r: corner.r * n + along.r * step,
                ring: n,
                side,
                step,
                index: out.length
            });
        }
    }
    return out;
}

/** The side (wedge) a cell lies in, 0–5, or null for the Hall's cell. */
export function sideOf(cell) {
    const n = ringOf(cell);
    if (n === 0) return null;
    for (let side = 0; side < SIDES; side++) {
        const corner = DIRECTIONS[side];
        const along = DIRECTIONS[(side + 2) % SIDES];
        const dq = cell.q - corner.q * n;
        const dr = cell.r - corner.r * n;
        const step = along.q !== 0 ? dq / along.q : dr / along.r;
        if (Number.isInteger(step) && step >= 0 && step < n && dq === along.q * step && dr === along.r * step) return side;
    }
    return null;
}

/** Every cell of rings 0 to `rings`, ring by ring in walking order. */
export function cellsWithin(rings) {
    const out = [];
    for (let n = 0; n <= rings; n++) out.push(...ringCells(n));
    return out;
}
