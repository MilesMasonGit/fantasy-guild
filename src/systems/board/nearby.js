// distance on the playmat

import { LARGEST_ART_RADIUS } from '../../config/matGeometry.js';
import { REACH } from '../../config/registries/reachRegistry.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';

/**
 * `nearby()`: reach as a distance, measured centre to centre.
 *
 * There are no Tiles. Every Token on the mat has a centre (`instance.x`, `instance.y`), and every
 * question here is asked of an instance id or a mat point and answers with instance ids. Near is
 * the Mat Tuner's Near radius.
 *
 * Where an ordering is needed, ids come back in arrival order (`placedAt` ascending). `nearby` is
 * the stored reach id and means Near; `self_and_nearby` likewise; `self` and `board` are unchanged.
 *
 * Tokens not (or no longer) on the mat (a Manager restocking a spot, a neighbour trigger whose
 * source has just left, a `Cannot` check on a layout that has not happened yet) measure from a
 * point with {@link tokensWithin} or {@link isWithin}.
 */

/** The live Near radius, in mat units. */
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
 * The Tokens whose modifiers can change when something changes at `points`: every Token whose
 * centre is within Near + the largest art radius of any of them, in arrival order.
 *
 * Why the margin: a Token's buffs depend on every Token within Near of it. When a Token leaves A
 * for B, the Tokens that gained or lost it are within Near of A or of B, so rebuilding around both
 * points keeps buffs from going stale. `LARGEST_ART_RADIUS` covers a caller that can only name a
 * point near the change rather than the centre that moved. Rebuilding an extra Token is harmless;
 * missing one is a silently stale buff.
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

/**
 * `nearby(id)` at the live Near radius, cached per instance. `RecipeResolver` and `Charges` ask for
 * a station's neighbours several times per station per tick, which would otherwise be the one
 * per-tick O(n²) cost.
 *
 * What drops it: the whole cache when a Token is put on or taken off the mat
 * (`BoardState.membershipVersion`), the board is swapped (a load), or the Near radius changes. On a
 * move (`setTokenPoint`), only the entries it can change, read back from `BoardState`'s move
 * journal: the moved Token's own entry and that of every Token within `nearRadius() + 1` of where
 * it left or arrived (the same both-ends rule as {@link tokensAround}). The `+ 1` is slack:
 * dropping an extra entry is harmless, keeping a stale one is a silently wrong recipe or tool
 * answer.
 *
 * Order inside a list is arrival order, which a move cannot change.
 *
 * ⚠️ The returned array is shared: iterate it, never mutate it.
 */
let neighbourCache = { tokens: null, version: -1, radius: NaN, moves: 0, byId: new Map() };

/**
 * Drop the cached entries a move from `(fx, fy)` to `(tx, ty)` can have
 * changed. Reads the cache and slack set by {@link neighbourIds} just before
 * the replay, so the replay allocates nothing per move.
 */
let replaySlackSq = 0;

function forgetAroundMove(movedId, fx, fy, tx, ty) {
    const byId = neighbourCache.byId;
    byId.delete(movedId);
    if (!byId.size) return;
    const hasFrom = Number.isFinite(fx) && Number.isFinite(fy);
    for (const id of byId.keys()) {
        const instance = BoardState.getTokenById(id);
        if (!instance || !Number.isFinite(instance.x) || !Number.isFinite(instance.y)) {
            byId.delete(id);
            continue;
        }
        let dx = instance.x - tx;
        let dy = instance.y - ty;
        if (dx * dx + dy * dy <= replaySlackSq) {
            byId.delete(id);
            continue;
        }
        if (!hasFrom) continue;
        dx = instance.x - fx;
        dy = instance.y - fy;
        if (dx * dx + dy * dy <= replaySlackSq) byId.delete(id);
    }
}

export function neighbourIds(instanceId) {
    const { tokens, version } = BoardState.membershipVersion();
    const radius = nearRadius();
    const moves = BoardState.moveCount();
    if (neighbourCache.tokens !== tokens || neighbourCache.version !== version || neighbourCache.radius !== radius) {
        neighbourCache = { tokens, version, radius, moves, byId: new Map() };
    } else if (neighbourCache.moves !== moves) {
        const slack = radius + 1;
        replaySlackSq = slack * slack;
        if (!BoardState.eachMoveSince(neighbourCache.moves, forgetAroundMove)) neighbourCache.byId = new Map();
        neighbourCache.moves = moves;
    }
    let ids = neighbourCache.byId.get(instanceId);
    if (!ids) {
        ids = nearby(instanceId, REACH.NEARBY, radius);
        neighbourCache.byId.set(instanceId, ids);
    }
    return ids;
}
