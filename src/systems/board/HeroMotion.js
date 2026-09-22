// Fantasy Guild — heroes walk the mat (Hero Movement slice M1)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { artRadiusOf, matW } from '../../config/matGeometry.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';

/**
 * ⭐ **Heroes live on the mat** (`docs/hero_movement_roadmap_v1.md`). `Flags.js`
 * decides what a hero works; this file decides **where the hero is**, and walks
 * them there.
 *
 * ## Where a hero is heading
 * * holding a claim → **beside that Token**, on the side they approached from
 *   (HM-2), facing it; the Token itself never moves to make room;
 * * waiting on a spot for a restock (FP-70) → beside that spot, the same way;
 * * otherwise → **beside their flag** (`idleSpot`, FP-29, FP-84; pottering is
 *   slice M4).
 *
 * The destination is worked out afresh every tick, so a hero follows a Token
 * that is moved or pushed while they walk (HMP-3).
 *
 * ## ⭐ Walking costs work time (FP-26)
 * A hero claims a Token when they set off (HMP-2, so no two heroes race for
 * it), but counts as **working** it only once they arrive: `BoardState`'s seam
 * (`workerOf`, `workTokenOf`) answers null until then, so the Token's cycle does
 * not run. Arriving publishes one `HERO_MOVED`, which switches on anything that
 * cares who works a Token (buffs, statuses).
 *
 * ## Straight lines, over Tokens (HM-3)
 * No pathfinding. The screen draws a walking hero above the Tokens.
 *
 * ## ⚠️ Steps are not `HERO_MOVED`
 * `HERO_MOVED` rebuilds neighbourhoods. A step publishes only
 * `HEROES_WALKED`, once per tick, for the screen.
 *
 * ## Offline catch-up
 * One very long tick (the game was asleep) covers the whole walk in one step:
 * the hero simply arrives, rather than walking in fast-forward.
 */

/** Gap between a Token's art edge and the centre of the hero working it, in mat units. */
export const STAND_GAP = 16;

/** Closer than this to a destination counts as there, in mat units. */
const ARRIVE_EPS = 0.5;

/**
 * Where an idle hero stands relative to their flag's pole base, in mat units:
 * just right of the pole and up by half a hero, so they stand in front of the
 * cloth rather than on the pole (FP-29, FP-84). The same place `FlagLayer` drew
 * idle heroes before M2 — the retired `IDLE_HERO_OFFSET` (48, −20) from the
 * 128 px flag box whose pole base is (40, 116), to the centre of a 128 px hero:
 * 48 − 40 + 64 = 72 across, −20 − 116 + 64 = −72 up — so the look is unchanged,
 * but it is now a real destination the hero walks to instead of jumping there.
 */
export const IDLE_SPOT = Object.freeze({ dx: 72, dy: -72 });

/** The point an idle hero stands at beside `flag`. */
export function idleSpot(flag) {
    return { x: flag.x + IDLE_SPOT.dx, y: flag.y + IDLE_SPOT.dy };
}

/** Walking speed in mat units a second (Mat Tuner "Walk speed", HMP-4). */
export function walkSpeed() {
    return matTuning('walkSpeed');
}

/** Where `heroId` is on the mat, or null (in the Dock). */
export function heroPointOf(heroId) {
    const body = BoardState.heroBodyOf(heroId);
    return body ? { x: body.x, y: body.y } : null;
}

/**
 * What a hero's body is doing, for the screen: `{ x, y, moving, facing }`
 * (`facing` −1 left, 1 right), or null in the Dock.
 */
export function bodyView(heroId) {
    const body = BoardState.heroBodyOf(heroId);
    if (!body) return null;
    return { x: body.x, y: body.y, moving: !!body.moving, facing: body.facing || 1 };
}

/** Whether the hero is on their way somewhere (not yet at their destination). */
export function isWalking(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.moving;
}

/**
 * The point beside a Token (or spot) at `centre` where a hero stands to work it,
 * on `side` (−1 left, 1 right). If that side would put the hero off the mat,
 * the other side is used.
 */
export function standingSpot(typeId, centre, side) {
    const offset = artRadiusOf(typeId) + STAND_GAP;
    let x = centre.x + side * offset;
    if (x < 0 || x > matW()) x = centre.x - side * offset;
    return { x, y: centre.y };
}

/** The side a hero coming from `body` arrives on: the side they are already on (HM-2). */
function sideFor(body, centre) {
    return body.x > centre.x ? 1 : -1;
}

/**
 * Where `heroId` is heading right now, updating the body's target bookkeeping
 * when the target changes. Null with no flag.
 */
function destinationOf(heroId, body) {
    const claim = BoardState.claimOfHero(heroId);
    if (claim) {
        const token = BoardState.getTokenById(claim.instanceId);
        const centre = token ? { x: token.x, y: token.y } : { x: claim.x, y: claim.y };
        if (body.targetId !== claim.instanceId) {
            body.targetId = claim.instanceId;
            body.side = sideFor(body, centre);
            body.atWork = null;
        }
        return standingSpot(claim.typeId, centre, body.side);
    }

    const wait = BoardState.waitOfHero(heroId);
    if (wait && Number.isFinite(wait.x) && Number.isFinite(wait.y)) {
        const key = `wait:${wait.spotId}`;
        const centre = { x: wait.x, y: wait.y };
        if (body.targetId !== key) {
            body.targetId = key;
            body.side = sideFor(body, centre);
            body.atWork = null;
        }
        return standingSpot(wait.typeId, centre, body.side);
    }

    body.targetId = null;
    body.atWork = null;
    const flag = BoardState.flagOf(heroId);
    return flag ? idleSpot(flag) : null;
}

/**
 * Move one hero `delta` game ms toward their destination.
 * @returns {boolean} whether they moved
 */
function step(heroId, body, delta) {
    const dest = destinationOf(heroId, body);
    if (!dest) return false;

    const dx = dest.x - body.x;
    const dy = dest.y - body.y;
    const dist = Math.hypot(dx, dy);
    const reach = BoardState.isInstantArrival() ? Infinity : walkSpeed() * Math.max(0, delta) / 1000;

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

    // Standing beside their Token (or restock spot): face it. Usually the way
    // they walked in anyway; not when the mat's edge sent them round to the far
    // side, or when they were already standing there.
    const claim = BoardState.claimOfHero(heroId);
    if (!body.moving && body.targetId) {
        const token = claim ? BoardState.getTokenById(claim.instanceId) : null;
        const wait = claim ? null : BoardState.waitOfHero(heroId);
        const target = token || wait;
        if (target && Math.abs(target.x - body.x) > ARRIVE_EPS) body.facing = target.x < body.x ? -1 : 1;
    }

    // Arrived at a claimed Token: from now on they are working it (FP-26).
    if (!body.moving && claim && body.atWork !== claim.instanceId
        && body.targetId === claim.instanceId && BoardState.getTokenById(claim.instanceId)) {
        body.atWork = claim.instanceId;
        announceArrival(heroId);
    }
    return moved;
}

function announceArrival(heroId) {
    // With instant arrival (tests) the claim's own `HERO_MOVED` already said
    // everything; a second one would double every count.
    if (BoardState.isInstantArrival()) return;
    const point = BoardState.displayPointOf(heroId);
    EventBus.publish(BOARD_EVENTS.HERO_MOVED, {
        heroId,
        instanceId: BoardState.workTokenOf(heroId),
        ...(point ? { x: point.x, y: point.y } : {}),
        reason: 'arrived'
    });
}

/**
 * A hero's body, made if they have a flag and none yet. A newly planted hero
 * appears at their flag (slice M3 makes them walk out of the Guild Hall).
 */
function ensureBody(heroId) {
    let body = BoardState.heroBodyOf(heroId);
    if (body) return body;
    const flag = BoardState.flagOf(heroId);
    if (!flag) return null;
    const at = idleSpot(flag);
    body = { x: at.x, y: at.y, targetId: null, side: -1, atWork: null, moving: false, facing: 1 };
    BoardState.setHeroBody(heroId, body);
    return body;
}

/**
 * Bring one hero's body up to date right now, without walking: made if
 * missing, heading set, and — if they are already standing there (or arrival
 * is instant, in tests) — arrived. `Flags.js` calls this after every claim
 * change, so a job starts the same tick when no walk is needed.
 */
export function settle(heroId) {
    if (!BoardState.flagOf(heroId)) {
        BoardState.setHeroBody(heroId, null);
        return;
    }
    const body = ensureBody(heroId);
    if (body) step(heroId, body, 0);
}

/** Take a hero off the mat at once (recall, defeat — slice M3 walks them home). */
export function remove(heroId) {
    BoardState.setHeroBody(heroId, null);
}

/**
 * Walk every hero on the mat `delta` game ms. Run once per engine tick, right
 * after `Flags.assign` (which may have given them somewhere new to go) and
 * before any Token ticks (which ask whether they have arrived).
 */
export function tick(delta = 0) {
    const flags = BoardState.getFlags();
    let anyMoved = false;

    for (const heroId of Object.keys(flags)) {
        const body = ensureBody(heroId);
        if (body && step(heroId, body, delta)) anyMoved = true;
    }
    // A body whose flag is gone (a recall the Flags code already handled).
    for (const [heroId] of BoardState.heroBodies()) {
        if (!flags[heroId]) BoardState.setHeroBody(heroId, null);
    }

    if (anyMoved) EventBus.publish(BOARD_EVENTS.HEROES_WALKED);
}
