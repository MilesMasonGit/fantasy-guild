// Fantasy Guild — The terrain subtile lattice (dynamic terrain roadmap P2).

import { BOARD_SIZE, TILE_PX, TILE_GAP_PX } from '../../config/boardGeometry.js';
import { substrateArtPx, fringeOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Which terrain each of the board's 841 subtiles shows.
 *
 * Pure arithmetic — no React, no game state beyond what is passed in — so the
 * renderer can ask for a whole board and get the same answer every time.
 *
 * ## The lattice (D-T1)
 *
 * A terrain sprite is 16px drawn at 32px, and a tile is 128px, so four subtiles
 * fit across a tile. The gap between tiles is 32px, which is *exactly one more
 * subtile*. That makes the board one continuous grid rather than 36 separate
 * little ones:
 *
 * ```
 *   subtile column:  0  1  2  3 | 4 | 5  6  7  8 | 9 | 10 …
 *                   └─ tile 0 ─┘ gap └─ tile 1 ─┘ gap
 * ```
 *
 * Six tiles of four plus five gaps of one is 29 across, and 29 × 32px = 928px,
 * which is the board's exact width. Nothing is left over at the edges.
 *
 * ## Who owns a subtile (D-T2, D-T3)
 *
 * Each tile keeps a solid **2×2 core** that nothing can take from it — the
 * middle four of its sixteen subtiles. Everything else is contestable: a tile's
 * outer ring, and the gap subtiles between tiles, can go to any tile within
 * reach. That is what makes a boundary ragged instead of a straight line, and
 * it is what lets one tile's terrain spill across the gap into its neighbour.
 *
 * A contest is settled by score, highest wins:
 *
 *   * **Distance** — how far the subtile sits from the tile claiming it, in
 *     subtiles. Its own tile is 0 away, a tile across the gap is 2. This is why
 *     bleeding into a neighbour is rarer than winning a gap: it has twice the
 *     deficit to overcome.
 *   * **Recency** — later-painted tiles score higher, which is D-T3's "most
 *     recently painted wins". Ranked among the candidates rather than used as a
 *     raw number, so the arithmetic stays bounded however long a game runs.
 *   * **Jitter** — a fixed pseudo-random value per subtile-and-claimant. This
 *     is the whole source of the ragged edge, and because it is derived from
 *     coordinates and the save's seed it is identical on every redraw (D-T11).
 *
 * ## Two scales of raggedness
 *
 * Ownership above is the *coarse* one: which of 841 subtiles belongs to whom.
 * `edgeProfile` below is the *fine* one: where exactly, within a boundary
 * between two subtiles, one terrain stops and the other starts. The first makes
 * a coastline that wanders across tiles; the second stops it looking like it was
 * cut with scissors.
 */

/** Subtiles across one tile. 128px tile ÷ 32px subtile. */
export const SUBTILES_PER_TILE = 4;

/** Subtiles in the gap between two tiles. 32px gap ÷ 32px subtile. */
export const SUBTILES_PER_GAP = TILE_GAP_PX / (TILE_PX / SUBTILES_PER_TILE);

/** One tile plus the gap that follows it. */
const STRIDE = SUBTILES_PER_TILE + SUBTILES_PER_GAP;

/** The lattice is this many subtiles on a side. Six tiles and five gaps: 29. */
export const LATTICE_SIZE = BOARD_SIZE * SUBTILES_PER_TILE + (BOARD_SIZE - 1) * SUBTILES_PER_GAP;

/** How big one subtile draws, in board pixels. */
export const SUBTILE_PX = TILE_PX / SUBTILES_PER_TILE;

/**
 * How much each term is worth when tiles compete for a subtile.
 *
 * Tuned by eye. Below about 1.5 of jitter the gaps resolve into straight lines,
 * which is worse than no raggedness at all — a perfectly regular sawtooth. Much
 * above 2.5 and a tile starts winning subtiles it is nowhere near, so the board
 * turns to soup.
 */
const DISTANCE_WEIGHT = 0.75;
const RECENCY_STEP = 0.7;

/**
 * ⚠️ Read through `tuning()` at the point of use, never captured into a const.
 * Capturing would freeze the value at import and the tuning panel's sliders
 * would appear to do nothing — which is exactly how the art set went wrong.
 */
const jitter = () => tuning('ownerJitter');
const coarseShare = () => tuning('ownerCoarseShare');

/**
 * How much of the jitter comes from a *coarse* sample rather than a per-subtile
 * one — the difference between an edge that meanders and an edge that fizzes.
 *
 * Independent noise per subtile gives every subtile its own coin flip, so a
 * boundary comes out as salt-and-pepper: statistically ragged, but reading as
 * dithering rather than as a coastline. Mixing in a value sampled from a
 * coarser grid makes neighbouring subtiles lean the same way, so the boundary
 * wanders in runs and looks like a shape somebody drew.
 */
const COARSE_CELLS = 3;

/**
 * A stable pseudo-random number in [0, 1) from a handful of integers.
 *
 * Deliberately not `Math.random`: the same subtile must resolve the same way on
 * every redraw and every reload, or the board would shimmer as you played and
 * come back different after a save. This is a plain integer hash — cheap, and
 * good enough for scattering an edge.
 *
 * Exported so `TerrainProps` scatters trees from the same source of noise.
 * Everything derived about the board's appearance comes from here and the
 * save's seed, which is what makes D-T11's two-numbers-per-tile enough.
 */
export function hash01(...values) {
    let h = 0x811c9dc5;
    for (const value of values) {
        h ^= (value | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2);
        h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
        h ^= h >>> 12;
    }
    return ((h >>> 0) % 100000) / 100000;
}

/**
 * The random term in a contest: mostly a coarse sample so edges meander, with
 * enough per-subtile noise mixed in to keep them from looking like steps.
 */
function jitterAt(sx, sy, tile, seed) {
    const coarse = hash01(
        Math.floor(sx / COARSE_CELLS), Math.floor(sy / COARSE_CELLS), tile, seed
    );
    const fine = hash01(sx, sy, tile, seed);
    const share = coarseShare();
    return share * coarse + (1 - share) * fine;
}

/**
 * The tile column a subtile column belongs to, and how far into it.
 *
 * `offset` of 0–3 is inside that tile; 4 means the gap after it, which belongs
 * to no tile until someone claims it.
 */
function split(subtileIndex) {
    const tile = Math.floor(subtileIndex / STRIDE);
    return { tile, offset: subtileIndex - tile * STRIDE };
}

/** Whether an offset within a tile is one of its untouchable middle subtiles. */
const isCore = (offset) => offset === 1 || offset === 2;

/**
 * Distance in subtiles from a subtile to the nearest edge of a tile's body.
 * Zero when the subtile is inside that tile.
 */
function distanceToTile(subtileIndex, tileIndex) {
    const start = tileIndex * STRIDE;
    const end = start + SUBTILES_PER_TILE - 1;
    if (subtileIndex < start) return start - subtileIndex;
    if (subtileIndex > end) return subtileIndex - end;
    return 0;
}

/** The tile columns (or rows) that may claim a subtile column (or row). */
function claimants(subtileIndex) {
    const { tile, offset } = split(subtileIndex);
    const out = [];
    if (offset < SUBTILES_PER_TILE) out.push(tile);          // its own tile
    if (offset >= SUBTILES_PER_TILE) {
        out.push(tile);                                       // gap: the tile before
        if (tile + 1 < BOARD_SIZE) out.push(tile + 1);        // and the tile after
    } else {
        // An outer subtile of a tile can also be taken by the tile across the
        // gap — this is the "spills into a neighbour's own subtiles" half of
        // D-T2. The core two are never offered.
        if (offset === 0 && tile - 1 >= 0) out.push(tile - 1);
        if (offset === SUBTILES_PER_TILE - 1 && tile + 1 < BOARD_SIZE) out.push(tile + 1);
    }
    return out;
}

/**
 * Which tile owns the subtile at `(sx, sy)`, or null if no candidate is painted.
 *
 * @param {number} sx Subtile column, 0 … LATTICE_SIZE-1.
 * @param {number} sy Subtile row.
 * @param {object} terrain The board's terrain map, `tileIndex -> {terrainId, paintedAt}`.
 * @param {number} seed The save's terrain seed.
 * @returns {number|null} A tile index.
 */
export function ownerOf(sx, sy, terrain, seed = 0) {
    const x = split(sx);
    const y = split(sy);

    // The untouchable core: both axes inside a tile and away from its edges.
    // Resolving these without a contest is not only faster, it is what stops a
    // tile's middle flickering between neighbours as the board fills up.
    if (isCore(x.offset) && isCore(y.offset)) {
        const own = y.tile * BOARD_SIZE + x.tile;
        return terrain[own] ? own : null;
    }

    const cols = claimants(sx);
    const rows = claimants(sy);

    const candidates = [];
    for (const row of rows) {
        for (const col of cols) {
            const tile = row * BOARD_SIZE + col;
            if (terrain[tile]) candidates.push(tile);
        }
    }
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Rank by paint order so recency is a bounded bonus rather than a raw
    // counter that grows without limit over a long game.
    const byAge = [...candidates].sort(
        (a, b) => (terrain[a].paintedAt || 0) - (terrain[b].paintedAt || 0)
    );
    const rank = new Map(byAge.map((tile, index) => [tile, index]));

    let best = null;
    let bestScore = -Infinity;
    for (const tile of candidates) {
        const col = tile % BOARD_SIZE;
        const row = Math.floor(tile / BOARD_SIZE);
        const distance = Math.max(distanceToTile(sx, col), distanceToTile(sy, row));
        const score =
            -DISTANCE_WEIGHT * distance
            + RECENCY_STEP * rank.get(tile)
            + jitter() * jitterAt(sx, sy, tile, seed);
        if (score > bestScore) {
            bestScore = score;
            best = tile;
        }
    }
    return best;
}

/**
 * Which of a substrate's interchangeable variants a subtile draws.
 *
 * Derived from the subtile's own position rather than from its tile, so the
 * noise carries across a tile boundary instead of restarting at it — two
 * adjacent grass tiles read as one field, not as two squares of grass.
 */
export function variantAt(sx, sy, variants, seed = 0) {
    if (!variants || variants <= 1) return 0;
    return Math.floor(hash01(sx, sy, 0x5eed, seed) * variants) % variants;
}

/**
 * The whole board resolved, as a flat array of `LATTICE_SIZE * LATTICE_SIZE`
 * terrain ids (or null where nothing has been painted within reach).
 *
 * Row-major, so index `sy * LATTICE_SIZE + sx`.
 */
export function resolveLattice(terrain = {}, seed = 0) {
    const out = new Array(LATTICE_SIZE * LATTICE_SIZE);
    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            const owner = ownerOf(sx, sy, terrain, seed);
            out[sy * LATTICE_SIZE + sx] = owner == null ? null : terrain[owner].terrainId;
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Edge blending (roadmap P3)
// ---------------------------------------------------------------------------

/**
 * How many art pixels a subtile is across — the resolution a coastline is cut at.
 *
 * ⚠️ **Follows the selected art set, and must.** A 32px subtile is 16 art pixels
 * of the `a` set or 8 of the `b` set, and the frontier steps in art pixels. Pin
 * this to a number and a coastline cut at 16 steps through ground drawn at 8
 * reads as a mistake rather than as a style — the edge would be finer than
 * anything around it.
 *
 * ⚠️ A **function**, not a constant. The QA panel switches art sets at runtime;
 * a constant would be captured at import and keep the old resolution forever,
 * which is subtle to spot because the ground changes and the coastline does not.
 */
export function subtileArtPx() {
    return substrateArtPx();
}

/**
 * How far, in art pixels, a terrain may push across a subtile boundary.
 *
 * Expressed as a fraction of the subtile rather than a fixed number, so that
 * switching art sets keeps the coastline the same *shape* and only changes how
 * coarsely it is cut. At 16 art pixels this is 5; at 8 it is 3.
 *
 * Kept well under half a subtile. The frontier is drawn relative to one boundary
 * and knows nothing about the next one along, so two neighbouring boundaries
 * each displaced by more than half could overlap and produce terrain on the far
 * side of a subtile that does not own it — an island with no cause.
 */
export function edgeAmplitude() {
    return Math.max(1, Math.round(subtileArtPx() * EDGE_SWING()));
}

/**
 * The two dials that decide how a coastline reads. They do different jobs and
 * are worth turning separately.
 *
 * `EDGE_SWING` is **how far** the frontier travels from the grid line — the
 * scale of the bays and headlands. Turning it down makes the coast hug the
 * subtile boundary; turning it up past about a third starts letting terrain
 * reach ground it has no business on.
 *
 * `EDGE_ROUGHNESS` is **how spiky** the frontier is between its pinned ends.
 * This is the one that reads as "jagged": at high values the boundary grows
 * single-pixel teeth that look like noise on the edge rather than a shape. Note
 * it is a fraction of the subtile, so it shrinks with the art set — at 8px art
 * a value much above 0.1 puts a tooth on nearly every pixel.
 *
 * ⚠️ **Tuning history, so nobody re-derives it.** Once the blending was actually
 * drawing, 0.3125 / 0.1125 read as too jagged; 0.25 / 0.055 read as too calm.
 * These are the owner's middle ground, and they are not a simple average:
 *
 * | swing  | rough  | art px | single-pixel teeth |
 * | :----- | :----- | :----- | :----------------- |
 * | 0.3125 | 0.1125 | 3      | 16.1%  (too jagged)|
 * | 0.3125 | 0.070  | 3      | 8.3%   ← here      |
 * | 0.25   | 0.070  | 2      | 9.5%               |
 * | 0.25   | 0.055  | 2      | 6.0%   (too calm)  |
 *
 * ⚠️ **Swing is quantised** — it becomes a whole number of art pixels, so at 8px
 * art it is 2 or 3 and nothing between. There is no middle to be had on that
 * axis, which is why the swing went back to its original 3 and the middle
 * ground was found entirely in the roughness.
 */
const EDGE_SWING = () => tuning('edgeSwing');
const EDGE_ROUGHNESS = () => tuning('edgeRoughness');

/** How far the frontier wanders between its two pinned ends, in art pixels. */
const wobble = () => subtileArtPx() * EDGE_ROUGHNESS();

/**
 * Where two neighbouring subtiles actually divide, rather than where the grid
 * says they do (D-T13, D-T14).
 *
 * Returns one signed displacement per art pixel along the boundary. Positive
 * pushes the first subtile's terrain into the second; negative pulls the second
 * into the first. Straight zeros would give the hard edge P2 shipped.
 *
 * ## ⚠️ Why the ends are pinned, and to what
 *
 * The concept doc's §6 calls this the seam problem: a coastline crossing from
 * one boundary segment into the next steps, because each segment wandered off
 * on its own. The fix is that **a segment's endpoints are properties of the
 * junction, not of the segment** — both boundaries meeting at a junction read
 * the same hash of that junction's coordinates, so they agree without needing
 * to know about each other.
 *
 * Pinning every junction to the *same* depth would also be continuous, and was
 * prototyped: it makes the frontier cross the midline every 16 pixels and reads
 * as a decorative scalloped fringe rather than a coast. The depth has to vary
 * per junction, which is why this is computed rather than drawn — a stencil set
 * would need one shape per pair of endpoint depths.
 *
 * @param {number} sx Column of the first subtile.
 * @param {number} sy Row of the first subtile.
 * @param {'v'|'h'} axis 'v' for the boundary with the subtile to the right,
 *   'h' for the boundary with the subtile below.
 * @param {number} seed The save's terrain seed.
 * @returns {number[]} One signed displacement per art pixel, in art pixels.
 */
export function edgeProfile(sx, sy, axis, seed) {
    // The two junctions this segment runs between. A vertical boundary runs
    // downward, so its junctions are above and below; a horizontal one runs
    // rightward. Naming them by absolute position is what makes neighbouring
    // segments agree.
    const startJunction = axis === 'v' ? [sx, sy] : [sx, sy];
    const endJunction = axis === 'v' ? [sx, sy + 1] : [sx + 1, sy];

    const artPx = subtileArtPx();
    const amplitude = edgeAmplitude();

    const depthAt = ([jx, jy]) =>
        Math.round((hash01(jx, jy, axis === 'v' ? 0x11 : 0x22, seed) * 2 - 1) * amplitude);

    const from = depthAt(startJunction);
    const to = depthAt(endJunction);

    const out = new Array(artPx);
    for (let i = 0; i < artPx; i++) {
        // ⚠️ `i / (N - 1)`, not `(i + 0.5) / N`. This lands the first and last
        // samples **exactly on** the two junction depths rather than merely near
        // them, which is what makes the seam guarantee structural instead of
        // lucky. With the half-pixel version the end samples sat a fraction
        // short of the junction; at 16 art pixels they still rounded to it, but
        // at 8 the samples are further from the ends and a value sitting midway
        // between two integers could round one way in one segment and the other
        // way in its neighbour — a 1px step, found the moment the art set was
        // switched.
        const t = i / (artPx - 1);
        const base = from + (to - from) * t;

        // A little wander on top of the interpolation, or the run between two
        // junctions is a straight ramp and the coast comes out faceted.
        //
        // ⚠️ Tapered to nothing at both ends. Without the taper the last sample
        // of one segment and the first of the next each get their own wobble,
        // and although both sit near the junction's depth they can differ by up
        // to 4 pixels — a visible step, which is the whole thing the junction
        // contract exists to prevent. Measured at 3–4px before, ≤1px after.
        const taper = Math.sin(Math.PI * t);
        const wander = (hash01(sx, sy, i, seed) * 2 - 1) * wobble() * taper;

        const value = Math.round(base + wander);
        const clamped = Math.max(-amplitude, Math.min(amplitude, value));
        // `Math.round(-0.4)` is `-0`, which is numerically zero but not the same
        // value as `0`. Normalising keeps "no displacement" a single thing, so
        // callers comparing two junctions' depths for equality can just compare.
        out[i] = clamped === 0 ? 0 : clamped;
    }
    return out;
}

/**
 * The strips of one terrain that spill across a boundary into its neighbour.
 *
 * Returned as data rather than drawn, so the geometry can be tested without a
 * canvas — which is not incidental. The first version of this lived inside the
 * renderer and drew each strip's texture at the **winner's** subtile origin
 * while clipping to a rectangle in the **loser's** subtile. Those two regions
 * are adjacent and never overlap, so every draw was clipped away entirely and
 * the blending silently did nothing for three commits. Nothing about the data
 * was wrong; only the drawing, which is the part nothing could assert on.
 *
 * Each strip says where it is (`x`, `y`, `w`, `h`, in art pixels), which
 * terrain's art to use, which subtile picks the *variant* of that art, and —
 * the bit that was wrong — **which subtile it is being painted into**, since
 * that is where a 32px texture has to be positioned to cover it.
 *
 * @returns {Array<{x:number,y:number,w:number,h:number,terrainId:string,
 *                  variantSx:number,variantSy:number,
 *                  intoSx:number,intoSy:number}>}
 */
export function edgeStrips(sx, sy, axis, here, there, seed = 0) {
    if (!here || !there || here === there) return [];

    const artPx = subtileArtPx();
    const profile = edgeProfile(sx, sy, axis, seed);
    const vertical = axis === 'v';
    const nextSx = vertical ? sx + 1 : sx;
    const nextSy = vertical ? sy : sy + 1;
    const boundary = (vertical ? sx + 1 : sy + 1) * artPx;

    const out = [];
    for (let i = 0; i < artPx; i++) {
        const push = profile[i];
        if (push === 0) continue;

        // Positive: `here` spills forward into `there`, so the strip lies in
        // `there`'s subtile. Negative: `there` reaches back, and the strip lies
        // in `here`'s. Either way the strip is painted INTO the loser.
        const forward = push > 0;
        const terrainId = forward ? here : there;
        const [variantSx, variantSy] = forward ? [sx, sy] : [nextSx, nextSy];
        const [intoSx, intoSy] = forward ? [nextSx, nextSy] : [sx, sy];

        const depth = Math.abs(push);
        const from = forward ? boundary : boundary - depth;

        out.push({
            x: vertical ? from : sx * artPx + i,
            y: vertical ? sy * artPx + i : from,
            w: vertical ? depth : 1,
            h: vertical ? 1 : depth,
            terrainId, variantSx, variantSy, intoSx, intoSy
        });
    }
    return out;
}

/**
 * Which terrain is at every art pixel, **after** the boundaries have been
 * ragged (P3).
 *
 * The subtile lattice says what a 32px cell holds; this says what each 4px
 * world pixel holds, which is a different question once edges wander across
 * cell lines. Anything that has to follow the *drawn* coastline rather than the
 * grid needs this — the shore bands do, and the patches are better for it.
 *
 * ⚠️ Built from `edgeStrips`, the same function the renderer paints from, so
 * the two cannot disagree about where a boundary ended up. Recomputing the
 * displacement independently here would be a second implementation of the one
 * thing P3 already got wrong once.
 *
 * @param {boolean} [withFringes] Whether to push fringes onto neighbours — the
 *   beach around the sea. Off only for the test that checks this map against the
 *   strips the renderer paints, which knows nothing about fringes.
 * @returns {{size, palette, at, fringes}} `at` holds an index into `palette` per
 *   art pixel, or -1 for unpainted ground. `fringes` lists what the fringing
 *   changed, so the renderer knows which pixels it owes a new coat.
 */
export function resolveArtPixels(grid, seed = 0, withFringes = true) {
    const artPx = subtileArtPx();
    const size = LATTICE_SIZE * artPx;

    const palette = [];
    const indexOf = new Map();
    const idFor = (terrainId) => {
        if (terrainId == null) return -1;
        let i = indexOf.get(terrainId);
        if (i === undefined) {
            i = palette.length;
            palette.push(terrainId);
            indexOf.set(terrainId, i);
        }
        return i;
    };

    const at = new Int16Array(size * size).fill(-1);

    // Flat fill first, matching the renderer's first pass.
    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            const id = idFor(grid[sy * LATTICE_SIZE + sx]);
            if (id < 0) continue;
            for (let y = 0; y < artPx; y++) {
                const row = (sy * artPx + y) * size + sx * artPx;
                at.fill(id, row, row + artPx);
            }
        }
    }

    // Then the strips, matching the renderer's second.
    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            const here = grid[sy * LATTICE_SIZE + sx];
            for (const axis of ['v', 'h']) {
                const nx = axis === 'v' ? sx + 1 : sx;
                const ny = axis === 'v' ? sy : sy + 1;
                if (nx >= LATTICE_SIZE || ny >= LATTICE_SIZE) continue;
                const there = grid[ny * LATTICE_SIZE + nx];

                for (const strip of edgeStrips(sx, sy, axis, here, there, seed)) {
                    const id = idFor(strip.terrainId);
                    for (let y = strip.y; y < strip.y + strip.h; y++) {
                        if (y < 0 || y >= size) continue;
                        for (let x = strip.x; x < strip.x + strip.w; x++) {
                            if (x < 0 || x >= size) continue;
                            at[y * size + x] = id;
                        }
                    }
                }
            }
        }
    }

    const fringes = withFringes
        ? applyFringes(at, size, palette, indexOf, idFor)
        : [];

    return { size, palette, at, fringes };
}

/**
 * How far each pixel is from the nearest seed.
 *
 * Distances come back **multiplied by 3** — the weights are 3 sideways and 4
 * diagonally, the standard cheap approximation to Euclidean distance, and
 * dividing through would only lose precision.
 *
 * Shared rather than duplicated: the shore bands measure how far a pixel is
 * from the water, and the beach fringe measures the same thing for a different
 * purpose. Two implementations of one distance would be two chances to disagree
 * about where the coast is.
 *
 * ## ⚠️ Pass `maxDist` if you have one — every caller does
 *
 * Without a bound this sweeps the whole board twice to compute a distance for
 * every pixel, and both callers then throw away everything past three or four
 * pixels. Bounded, it walks outward from the seeds and stops, touching only the
 * band it was asked about — measured at roughly a fifth of the work on a real
 * board, because a coastline is a small part of it.
 *
 * @param {number} [maxDist] In the same ×3 units. Pixels beyond it come back as
 *   a large number rather than a true distance, which is all either caller
 *   needs to reject them.
 */
export function distanceFromSeeds(seeds, size, maxDist = Infinity) {
    const INF = 0x3fff;
    const dist = new Int16Array(size * size).fill(INF);

    if (Number.isFinite(maxDist)) {
        const limit = Math.min(INF - 1, Math.ceil(maxDist));
        // A bucket per distance: costs are only ever 3 or 4, so the frontier
        // can be walked in order without a real priority queue.
        const buckets = Array.from({ length: limit + 1 }, () => []);
        for (let i = 0; i < seeds.length; i++) {
            if (seeds[i]) { dist[i] = 0; buckets[0].push(i); }
        }
        for (let d = 0; d <= limit; d++) {
            const bucket = buckets[d];
            for (let b = 0; b < bucket.length; b++) {
                const i = bucket[b];
                if (dist[i] !== d) continue;          // superseded since queued
                const x = i % size;
                const y = (i - x) / size;
                for (let dy = -1; dy <= 1; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= size) continue;
                    for (let dx = -1; dx <= 1; dx++) {
                        if (!dx && !dy) continue;
                        const nx = x + dx;
                        if (nx < 0 || nx >= size) continue;
                        const nd = d + (dx && dy ? 4 : 3);
                        if (nd > limit) continue;
                        const j = ny * size + nx;
                        if (nd < dist[j]) { dist[j] = nd; buckets[nd].push(j); }
                    }
                }
            }
        }
        return dist;
    }

    for (let i = 0; i < seeds.length; i++) if (seeds[i]) dist[i] = 0;

    const relax = (i, j, cost) => {
        const d = dist[j] + cost;
        if (d < dist[i]) dist[i] = d;
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = y * size + x;
            if (x > 0) relax(i, i - 1, 3);
            if (y > 0) relax(i, i - size, 3);
            if (x > 0 && y > 0) relax(i, i - size - 1, 4);
            if (x < size - 1 && y > 0) relax(i, i - size + 1, 4);
        }
    }
    for (let y = size - 1; y >= 0; y--) {
        for (let x = size - 1; x >= 0; x--) {
            const i = y * size + x;
            if (x < size - 1) relax(i, i + 1, 3);
            if (y < size - 1) relax(i, i + size, 3);
            if (x < size - 1 && y < size - 1) relax(i, i + size + 1, 4);
            if (x > 0 && y < size - 1) relax(i, i + size - 1, 4);
        }
    }
    return dist;
}

/**
 * Push a terrain's *fringe* out onto its neighbours — the beach around the sea.
 *
 * ⚠️ The opposite direction to a shore band. A band shades a terrain's own edge;
 * a fringe writes a **different terrain** onto the ground next to it. Sand
 * cannot be a band on the water, because the sand is not in the water — it is on
 * the land side of the line.
 *
 * Done by rewriting the terrain map rather than by drawing sand over the top,
 * which is what makes everything downstream behave: the wet-sand band sees real
 * shore and darkens it, the forest's dirt patches stop at it instead of
 * speckling the beach, and a tree will not grow on it. Painting it as an
 * overlay would have looked identical and been wrong in all three ways.
 *
 * Mutates `at` in place and returns the masks of what changed, so the renderer
 * knows which pixels it owes a coat of sand.
 */
function applyFringes(at, size, palette, indexOf, idFor) {
    const changed = [];

    for (let source = 0; source < palette.length; source++) {
        const fringe = fringeOf(palette[source]);
        if (!fringe) continue;

        const width = Math.max(0, fringe.width * tuning('fringeWidth'));
        if (width <= 0) continue;

        const seeds = new Uint8ClampedArray(size * size);
        let anySeed = false;
        for (let i = 0; i < at.length; i++) {
            if (at[i] === source) { seeds[i] = 1; anySeed = true; }
        }
        if (!anySeed) continue;

        const limit = width * 3;
        const dist = distanceFromSeeds(seeds, size, limit);
        const spared = new Set((fringe.except || []).map(id => indexOf.get(id)).filter(i => i != null));
        const existing = indexOf.get(fringe.terrain);

        const mask = new Uint8ClampedArray(size * size);
        // ⚠️ The target index is claimed on the first actual write, not up
        // front. Registering it eagerly put the fringe terrain into the palette
        // of boards that had none of it — an island alone on the table listed
        // `shore` among its terrains and nothing had drawn any.
        let target = -1;
        for (let i = 0; i < at.length; i++) {
            const here = at[i];
            // Never onto itself, onto what it is already becoming, onto bare
            // table, or onto anything that has asked to be left alone — a cliff
            // dropping into the sea should not sprout a beach.
            if (here === source || here === existing || here < 0 || spared.has(here)) continue;
            if (dist[i] >= limit) continue;
            if (target < 0) target = idFor(fringe.terrain);
            at[i] = target;
            mask[i] = 255;
        }
        if (target >= 0) changed.push({ terrainId: fringe.terrain, mask });
    }

    return changed;
}
