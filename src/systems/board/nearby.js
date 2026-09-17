// Fantasy Guild — Distance on the playmat (Free Playmat slices 1.2, 1.6b)

import { LARGEST_ART_RADIUS } from '../../config/matGeometry.js';
import { REACH } from '../../config/registries/reachRegistry.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';

/**
 * `nearby()` — reach as a **distance**, measured centre to centre (FP-41, A-5).
 *
 * ## By Token instance id and mat point (slice 1.6b)
 * The owner's framing rule: *there are no Tiles.* Every Token on the mat has a
 * centre (`instance.x`, `instance.y`), and every question here is asked of an
 * **instance id** or a **mat point** and answers with **instance ids**.
 *
 * ## Near (FP-65, FP-75)
 * The Mat Tuner's Near radius — 164 u shipped — reaches a Token 160 u away but
 * not one 226 u away, the two distances the old grid's sides and diagonals had.
 *
 * ## Ties go to the earlier arrival
 * Where an ordering is needed, ids come back in **arrival order** (`placedAt`
 * ascending), which replaced "lower anchor tile" as every tie-break (plan §A).
 *
 * ## Reach ids are unchanged
 * `nearby` stays the stored id and means **Near**; `self_and_nearby`
 * likewise; `self` and `board` are unchanged. No Close/Far rows (FP-53).
 *
 * ## Tokens that are not (or no longer) on the mat
 * A Manager restocking a spot, a neighbour trigger whose source has just left,
 * and a `Cannot` check on a layout that has not happened yet all measure from a
 * point with {@link tokensWithin} or {@link isWithin} — the same measurement.
 */

/** The live Near radius, in mat units (Mat Tuner, FP-66). */
export function nearRadius() {
    return matTuning('nearRadius');
}

/** Straight-line distance between two mat points. */
export function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Squared distance between two mat points. Centres are whole numbers today,
 * so this is exact — two equal distances compare equal, which a nearest-first
 * tie-break depends on.
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

/** A Token's centre — its own `x`, `y` — or null when it has none. */
export function centreOf(instance) {
    if (!instance || !Number.isFinite(instance.x) || !Number.isFinite(instance.y)) return null;
    return { x: instance.x, y: instance.y };
}

/**
 * Every Token on the mat whose centre lies within `radius` of `point`, as
 * instance ids in arrival order, skipping `excludeId`.
 */
export function tokensWithin(point, radius = nearRadius(), excludeId = null) {
    if (!point) return [];
    const out = [];
    for (const instance of BoardState.tokens()) {
        if (instance.id === excludeId) continue;
        const centre = centreOf(instance);
        if (centre && within(point, centre, radius)) out.push(instance.id);
    }
    return out;
}

/**
 * The Tokens a rule at `reach` carries to, measured from a point (with an
 * optional id standing there as "self"). The shared core of {@link nearby}.
 */
export function reachFrom(point, selfId, reach = REACH.NEARBY, radius = nearRadius()) {
    if (reach === REACH.SELF) return selfId ? [selfId] : [];
    if (reach === REACH.BOARD) return BoardState.tokens().map(t => t.id);
    if (!point) return [];
    const others = tokensWithin(point, radius, selfId);
    return reach === REACH.SELF_AND_NEARBY && selfId ? [selfId, ...others] : others;
}

/**
 * The Tokens a rule at `reach` carries to, seen from Token `instanceId`.
 *
 * Returns **instance ids**:
 * * `self`              — the Token itself
 * * `nearby`          — every other Token whose centre is within Near
 * * `self_and_nearby` — both, the Token itself first
 * * `board`             — every Token on the mat, in arrival order
 *
 * A Token that is not on the mat reaches nothing. An unknown reach id is
 * treated as `nearby`, as `reachCovers` does.
 *
 * @param {string} instanceId
 * @param {string} [reach]
 * @param {number} [radius] override, mainly for tests; defaults to the live Near
 * @returns {string[]}
 */
export function nearby(instanceId, reach = REACH.NEARBY, radius = nearRadius()) {
    const self = BoardState.getTokenById(instanceId);
    if (!self) return [];
    return reachFrom(centreOf(self), self.id, reach, radius);
}

/**
 * The Tokens whose modifiers can change when something changes at `points` —
 * every Token whose centre is within **Near + the largest art radius** of any
 * of them, in arrival order.
 *
 * ## Why the margin
 * A Token's buffs depend on every Token within Near of it. When a Token leaves
 * point A for point B, the Tokens that gained or lost it are within Near of A
 * or of B, so rebuilding around **both** points is what keeps buffs from going
 * stale (the slice's top risk). The extra `LARGEST_ART_RADIUS` (144 u) covers a
 * caller that can only name a point near the change rather than the centre that
 * moved. Rebuilding an extra Token is harmless; missing one is a silently stale
 * buff.
 *
 * @param {Array<{x:number,y:number}|null>} points
 * @returns {string[]}
 */
export function tokensAround(points, radius = nearRadius()) {
    const origins = (points || []).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!origins.length) return [];
    const reachU = radius + LARGEST_ART_RADIUS;
    const out = [];
    for (const instance of BoardState.tokens()) {
        const centre = centreOf(instance);
        if (centre && origins.some(p => within(p, centre, reachU))) out.push(instance.id);
    }
    return out;
}

// ---------------------------------------------------------------------------
// The neighbour-id cache (slice 1.6b)
// ---------------------------------------------------------------------------

/**
 * `nearby(id)` at the live Near radius, **cached per instance**.
 *
 * `RecipeResolver` and `Charges` ask for a station's neighbours several times
 * per station per tick (context, tools, wear, providers) — the plan's only
 * per-tick O(n²) risk. The answer is cached per instance id and the whole cache
 * is dropped the moment the layout changes: any Token put on the mat, moved or
 * taken off (`BoardState.layoutVersion`), the board swapped (a load), or the
 * Near radius changed.
 *
 * ⚠️ The returned array is shared — iterate it, never mutate it.
 */
let neighbourCache = { tokens: null, version: -1, radius: NaN, byId: new Map() };

export function neighbourIds(instanceId) {
    const { tokens, version } = BoardState.layoutVersion();
    const radius = nearRadius();
    if (neighbourCache.tokens !== tokens || neighbourCache.version !== version || neighbourCache.radius !== radius) {
        neighbourCache = { tokens, version, radius, byId: new Map() };
    }
    let ids = neighbourCache.byId.get(instanceId);
    if (!ids) {
        ids = nearby(instanceId, REACH.NEARBY, radius);
        neighbourCache.byId.set(instanceId, ids);
    }
    return ids;
}
