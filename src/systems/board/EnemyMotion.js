// Fantasy Guild — enemies wander the mat (Enemy Wandering slice EW-A)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { matW, matH } from '../../config/matGeometry.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';

/**
 * ⭐ **Enemies stroll within a bounded travel area**
 * (`docs/enemy_wandering_roadmap_v1.md`). Combat still starts the old way in
 * this slice — a hero's flag reaches the enemy and claims it (`Flags.js`) —
 * this file only decides **where the enemy is** between fights.
 *
 * ## The travel area is just the enemy's own position (EWP-1)
 * There is no separate "anchor" field, authored or saved: the centre of an
 * enemy's travel area is wherever its Token actually sits right now
 * (`BoardState.tokens()`'s own `x`/`y`). Drag it elsewhere and the area
 * simply recentres there (EWP-5) — nothing has to notice the drag on
 * purpose.
 *
 * ## Wandering mirrors a hero's idle "potter" (EWP-2)
 * Pause a random few seconds, stroll to a random point within the travel
 * radius, repeat. Same rhythm as `HeroMotion`'s idle heroes.
 *
 * ## Frozen while fought (EWP-4)
 * The instant a hero's flag claims the enemy — not once they arrive, the
 * moment they set off — wandering stops and the body simply mirrors the
 * Token's real position, exactly like a worked Token holding still under its
 * hero. It un-freezes the instant the claim is released.
 *
 * ## ⚠️ A step is not `TILE_CHANGED` (EWP-6)
 * The wandered position is a **display** position only, kept in its own
 * runtime body (`BoardState.enemyBodyOf`/`setEnemyBody`) and never written
 * into the Token's own `x`/`y`. A step publishes only `ENEMIES_WALKED`, once
 * per tick, so it never triggers `TileModifiers`' neighbourhood rebuild —
 * the same trap `HeroMotion` already solved for heroes.
 *
 * ## Straight lines, no obstacle avoidance (EWP-3)
 * No pathfinding, same assumption as Hero Movement HM-3.
 */

/** Closer than this to a destination counts as there, in mat units. */
const ARRIVE_EPS = 0.5;

/** How far an enemy strolls from its own position (Mat Tuner "Enemy travel area", EW-4). */
export function travelRadius() {
    return matTuning('enemyTravelRadius');
}

/** Wandering speed in mat units a second (Mat Tuner "Enemy wander speed", EWP-2). */
export function wanderSpeed() {
    return matTuning('enemyWanderSpeed');
}

/** An enemy pauses between strolls for this long, in game ms (EWP-2). */
export const PAUSE_MS = Object.freeze({ min: 2000, max: 6000 });

/** Random source for wandering — replaceable so tests can be exact. */
let random = Math.random;

/** Tests only: make wandering predictable. Pass nothing to restore `Math.random`. */
export function setRandomForTests(fn = Math.random) {
    random = fn;
}

/** A random stroll offset from the enemy's own position, uniform over a disc of `travelRadius`. */
function strollOffset() {
    const r = travelRadius() * Math.sqrt(random());
    const angle = random() * Math.PI * 2;
    return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
}

/** A pause between strolls, in game ms. */
function pauseMs() {
    return PAUSE_MS.min + random() * (PAUSE_MS.max - PAUSE_MS.min);
}

/** Keep a point on the mat. */
function onMat(point) {
    return {
        x: Math.max(0, Math.min(matW(), point.x)),
        y: Math.max(0, Math.min(matH(), point.y))
    };
}

/** Whether a Token is an enemy at all (same test `Flags`/`BoardCombat` use). */
function isEnemy(instance) {
    return isEnemyDef(getTokenType(instance?.typeId));
}

/** A fresh body standing exactly at the Token's own position. */
function bodyAt(token) {
    return {
        x: token.x, y: token.y, anchorX: token.x, anchorY: token.y,
        target: null, pauseLeft: null, moving: false, facing: 1
    };
}

/**
 * Move one enemy `delta` game ms.
 * @returns {boolean} whether it moved
 */
function step(instanceId, token, body, delta) {
    // Fought, or about to be: hold still, tracking the Token's real position
    // exactly (a drag while fighting just carries the enemy along, FPP-4).
    if (BoardState.heroOfInstance(instanceId)) {
        const moved = body.x !== token.x || body.y !== token.y;
        body.x = token.x;
        body.y = token.y;
        body.anchorX = token.x;
        body.anchorY = token.y;
        body.target = null;
        body.pauseLeft = null;
        body.moving = false;
        return moved;
    }

    // The Token moved on its own (a drop, or it just spawned there): the
    // travel area simply recentres, no walk (EWP-1, EWP-5).
    if (body.anchorX !== token.x || body.anchorY !== token.y) {
        body.anchorX = token.x;
        body.anchorY = token.y;
        body.x = token.x;
        body.y = token.y;
        body.target = null;
        body.pauseLeft = null;
        body.moving = false;
        return true;
    }

    const dest = body.target
        ? onMat({ x: body.anchorX + body.target.dx, y: body.anchorY + body.target.dy })
        : { x: body.anchorX, y: body.anchorY };

    const dx = dest.x - body.x;
    const dy = dest.y - body.y;
    const dist = Math.hypot(dx, dy);
    const speed = wanderSpeed();
    const reach = BoardState.isInstantArrival() ? Infinity : speed * Math.max(0, delta) / 1000;

    let moved;
    if (dist <= Math.max(reach, ARRIVE_EPS)) {
        // Arrived: `target` stays set — it is where the enemy is now resting,
        // not a queue to clear. Clearing it here would make the destination
        // fall back to the bare anchor and walk straight back, every time
        // (found while writing this file's own tests).
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

    // Standing still: count the pause down, then pick a new stroll target,
    // replacing wherever it was resting before (EWP-2).
    if (!body.moving && travelRadius() > 0) {
        if (body.pauseLeft == null) body.pauseLeft = pauseMs();
        body.pauseLeft -= Math.max(0, delta);
        if (body.pauseLeft <= 0) {
            body.target = strollOffset();
            body.pauseLeft = null;
        }
    }

    return moved;
}

/** Where an enemy's body is doing, for the screen: `{ x, y, moving, facing }`, or null if not tracked. */
export function bodyView(instanceId) {
    const body = BoardState.enemyBodyOf(instanceId);
    if (!body) return null;
    return { x: body.x, y: body.y, moving: !!body.moving, facing: body.facing || 1 };
}

/**
 * Wander every enemy Token `delta` game ms. Run once per engine tick,
 * alongside `HeroMotion.tick` — order relative to it does not matter in this
 * slice, since nothing here changes who a hero is working.
 */
export function tick(delta = 0) {
    let anyMoved = false;
    const onMatIds = new Set();

    for (const token of BoardState.tokens()) {
        if (!isEnemy(token)) continue;
        onMatIds.add(token.id);
        let body = BoardState.enemyBodyOf(token.id);
        if (!body) {
            body = bodyAt(token);
            BoardState.setEnemyBody(token.id, body);
        }
        if (step(token.id, token, body, delta)) anyMoved = true;
    }

    // A body left over from an enemy that left the mat (defeated, returned to
    // the vault, or a Token that no longer counts as an enemy).
    for (const [instanceId] of BoardState.enemyBodies()) {
        if (!onMatIds.has(instanceId)) BoardState.setEnemyBody(instanceId, null);
    }

    if (anyMoved) EventBus.publish(BOARD_EVENTS.ENEMIES_WALKED);
}
