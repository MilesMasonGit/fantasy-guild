// the one step of a walk, shared by heroes and enemies

/**
 * How a body on the mat takes a step, shared by `HeroMotion` and `EnemyMotion`. What each walker
 * heads for stays in its own file.
 *
 * A body is any object with `x`, `y`, `moving` and `facing` (-1 left, 1 right). Straight lines, no
 * pathfinding.
 */

/** Closer than this to a destination counts as there, in mat units. */
export const ARRIVE_EPS = 0.5;

/**
 * Move `body` up to `reach` mat units toward `dest`. It never overshoots: a
 * reach longer than the distance simply arrives. Sets `moving` (still on the
 * way) and `facing` (the way it is walking).
 *
 * @returns {boolean} whether the body moved
 */
export function stepToward(body, dest, reach) {
    const dx = dest.x - body.x;
    const dy = dest.y - body.y;
    const dist = Math.hypot(dx, dy);

    let moved;
    if (dist <= Math.max(reach, ARRIVE_EPS)) {
        moved = dist > 0;
        body.x = dest.x;
        body.y = dest.y;
        body.moving = false;
    } else {
        body.x += (dx / dist) * reach;
        body.y += (dy / dist) * reach;
        body.moving = true;
        moved = reach > 0;
    }
    if (Math.abs(dx) > ARRIVE_EPS) body.facing = dx < 0 ? -1 : 1;
    return moved;
}

/**
 * A random offset uniform over the ring between `inner` and `outer` (a disc when `inner` is 0).
 * Draws `random()` twice, distance then angle: the order seeded tests depend on.
 */
export function randomOffset(outer, random, inner = 0) {
    const lo = Math.max(0, Math.min(inner, outer));
    const u = random();
    const r = lo > 0 ? Math.sqrt(lo * lo + (outer * outer - lo * lo) * u) : outer * Math.sqrt(u);
    const angle = random() * Math.PI * 2;
    return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
}

/** A pause between strolls, in game ms, uniform over `{ min, max }`. */
export function randomPauseMs(range, random) {
    return range.min + random() * (range.max - range.min);
}
