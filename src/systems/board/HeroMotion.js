// Fantasy Guild — heroes walk the mat (Hero Movement slice M1)

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { artRadiusOf, matW, matH } from '../../config/matGeometry.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';

/**
 * ⭐ **Heroes live on the mat** (`docs/hero_movement_roadmap_v1.md`). `Flags.js`
 * decides what a hero works; this file decides **where the hero is**, and walks
 * them there.
 *
 * ## Where a hero is heading
 * * holding a claim → **beside that Token**, on the side they approached from
 *   (HM-2), facing it; the Token itself never moves to make room;
 * * otherwise → **beside their flag** (`idleSpot`, FP-29, FP-84), where they
 *   **potter** (slice M4, HM-1): a pause of a few seconds, a short stroll to a
 *   random spot close by, another pause. Strolls are measured from the flag's
 *   idle spot, so they stay within easy sight of it and move with it.
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
 * ## Coming and going through the Guild Hall (slice M3)
 * * A hero sent out **appears at the Guild Hall** and walks to their first job,
 *   or beside their flag if there is none (HMP-1).
 * * **Recall** (HM-5): the flag is gone at once and the hero is in the Dock at
 *   once, but their figure walks back into the Hall and disappears there
 *   (`sendHome`). Sent out again on the way, they simply turn around.
 * * **Defeat** (HM-6): the same walk home, but a **limp** at half speed.
 * * With no Guild Hall on the mat (a hand-built test board) they appear beside
 *   the flag and vanish on recall, as before.
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

/**
 * The point an idle hero stands at beside `flag`. A **pinned** flag (B5,
 * FB-45) stands on its Token's centre, so its idle hero waits where they would
 * work it — beside the Token, on the right — rather than on top of it.
 */
export function idleSpot(flag) {
    const pinned = typeof flag?.pinnedTo === 'string' ? BoardState.getTokenById(flag.pinnedTo) : null;
    if (pinned) return standingSpot(pinned.typeId, pinned, 1);
    return { x: flag.x + IDLE_SPOT.dx, y: flag.y + IDLE_SPOT.dy };
}

/** Walking speed in mat units a second (Mat Tuner "Walk speed", HMP-4). */
export function walkSpeed() {
    return matTuning('walkSpeed');
}

/** A defeated hero limps home at this fraction of walking speed (HM-6, HMP-4). */
export const LIMP_FACTOR = 0.5;

/** An idle hero strolls at this fraction of walking speed (HM-1). */
export const STROLL_FACTOR = 0.5;

/** An idle hero pauses between strolls for this long, in game ms (HM-1). */
export const POTTER_PAUSE_MS = Object.freeze({ min: 2000, max: 6000 });

/** How far from the idle spot a hero may stroll, in mat units (Mat Tuner "Idle wander"; 0 = stand still). */
export function potterRadius() {
    return matTuning('potterRadius');
}

/** Random source for pottering — replaceable so tests can be exact. */
let random = Math.random;

/** Tests only: make pottering predictable. Pass nothing to restore `Math.random`. */
export function setRandomForTests(fn = Math.random) {
    random = fn;
}

/** The Guild Hall's point, where heroes come from and go home to, or null. */
export function guildHallPoint() {
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || !!getTokenType(t.typeId)?.isGuildHall);
    return hall ? { x: hall.x, y: hall.y } : null;
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
    return {
        x: body.x, y: body.y, moving: !!body.moving, facing: body.facing || 1,
        homeward: !!body.homeward, limp: !!body.limp
    };
}

/** Whether a hero with no flag is still on the mat, walking (or limping) home. */
export function isReturning(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.homeward;
}

/** Whether a hero walking home is limping (defeated, HM-6). */
export function isLimping(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.limp;
}

/** Whether the hero is on their way somewhere (not yet at their destination). */
export function isWalking(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.moving;
}

/** Whether an idle hero is out on a stroll near their flag (HM-1) — still idle. */
export function isPottering(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.potter;
}

/** Forget any stroll in progress — work or the walk home comes first. */
function stopPottering(body) {
    body.potter = null;
    body.pauseLeft = null;
}

/** A random stroll offset from the idle spot, uniform over a disc of `potterRadius`. */
function strollOffset() {
    const r = potterRadius() * Math.sqrt(random());
    const angle = random() * Math.PI * 2;
    return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
}

/** A pause between strolls, in game ms. */
function pauseMs() {
    return POTTER_PAUSE_MS.min + random() * (POTTER_PAUSE_MS.max - POTTER_PAUSE_MS.min);
}

/** Keep a point on the mat. */
function onMat(point) {
    return {
        x: Math.max(0, Math.min(matW(), point.x)),
        y: Math.max(0, Math.min(matH(), point.y))
    };
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
    // Walking home: to the Hall, wherever it stands now.
    if (body.homeward) {
        stopPottering(body);
        return guildHallPoint();
    }

    const claim = BoardState.claimOfHero(heroId);
    if (claim) {
        stopPottering(body);
        const token = BoardState.getTokenById(claim.instanceId);
        const centre = token ? { x: token.x, y: token.y } : { x: claim.x, y: claim.y };
        if (body.targetId !== claim.instanceId) {
            body.targetId = claim.instanceId;
            body.side = sideFor(body, centre);
            body.atWork = null;
        }
        return standingSpot(claim.typeId, centre, body.side);
    }

    // Idle: beside the flag, or out on a stroll near it (HM-1).
    if (body.targetId) stopPottering(body);      // just came off work
    body.targetId = null;
    body.atWork = null;
    const flag = BoardState.flagOf(heroId);
    if (!flag) return null;
    const home = idleSpot(flag);
    if (!body.potter) return home;
    return onMat({ x: home.x + body.potter.dx, y: home.y + body.potter.dy });
}

/**
 * Move one hero `delta` game ms toward their destination.
 * @returns {boolean} whether they moved
 */
function step(heroId, body, delta) {
    const dest = destinationOf(heroId, body);
    if (!dest) {
        // Walking home to a Hall that is no longer there: just gone.
        if (body.homeward) {
            BoardState.setHeroBody(heroId, null);
            return true;
        }
        return false;
    }

    const dx = dest.x - body.x;
    const dy = dest.y - body.y;
    const dist = Math.hypot(dx, dy);
    const speed = walkSpeed() * (body.limp ? LIMP_FACTOR : body.potter ? STROLL_FACTOR : 1);
    const reach = BoardState.isInstantArrival() ? Infinity : speed * Math.max(0, delta) / 1000;

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

    // Home: in through the Hall, and gone (HM-5, HM-6).
    if (body.homeward) {
        if (!body.moving) BoardState.setHeroBody(heroId, null);
        return true;
    }

    // Standing beside their Token: face it. Usually the way
    // they walked in anyway; not when the mat's edge sent them round to the far
    // side, or when they were already standing there.
    const claim = BoardState.claimOfHero(heroId);
    if (!body.moving && body.targetId) {
        const target = claim ? BoardState.getTokenById(claim.instanceId) : null;
        if (target && Math.abs(target.x - body.x) > ARRIVE_EPS) body.facing = target.x < body.x ? -1 : 1;
    }

    // Idle and standing still: count the pause down, then set off on a stroll
    // (HM-1). Idle means no claim, not walking home.
    if (!body.moving && !body.targetId && !claim && potterRadius() > 0) {
        if (body.pauseLeft == null) body.pauseLeft = pauseMs();
        body.pauseLeft -= Math.max(0, delta);
        if (body.pauseLeft <= 0) {
            body.potter = strollOffset();
            body.pauseLeft = null;
        }
    }

    // Arrived at a claimed Token: from now on they are working it (FP-26),
    // and the save remembers it (HM-7).
    if (!body.moving && claim && body.atWork !== claim.instanceId
        && body.targetId === claim.instanceId && BoardState.getTokenById(claim.instanceId)) {
        body.atWork = claim.instanceId;
        BoardState.recordWorkClaim(heroId, claim.instanceId, body.side);
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
 * A hero's body, made if they have a flag and none yet: **at the Guild Hall**
 * (HMP-1), or beside the flag when there is no Hall. A hero still walking home
 * who is sent out again keeps their body and turns around (HM-5).
 */
function ensureBody(heroId) {
    const flag = BoardState.flagOf(heroId);
    let body = BoardState.heroBodyOf(heroId);
    if (body) {
        if (flag && body.homeward) {
            delete body.homeward;
            delete body.limp;
            body.targetId = null;
        }
        return body;
    }
    if (!flag) return null;
    const at = guildHallPoint() || idleSpot(flag);
    body = { x: at.x, y: at.y, targetId: null, side: -1, atWork: null, moving: false, facing: 1 };
    BoardState.setHeroBody(heroId, body);
    return body;
}

/**
 * After a load (HM-7): stand `heroId` back beside `token`, on `side`, already
 * working it — no walk from the Guild Hall, no walk at all. `Flags` then
 * restores the claim itself.
 */
export function restoreAtWork(heroId, token, side) {
    const at = standingSpot(token.typeId, token, side);
    BoardState.setHeroBody(heroId, {
        x: at.x, y: at.y, targetId: token.id, side, atWork: token.id,
        moving: false, facing: token.x < at.x ? -1 : 1
    });
}

/**
 * After a load (HM-7): a hero with a flag and no restored work starts beside
 * their flag — not at the Guild Hall, which is for heroes newly sent out.
 */
export function placeAtFlag(heroId) {
    if (BoardState.heroBodyOf(heroId)) return;
    const flag = BoardState.flagOf(heroId);
    if (!flag) return;
    const at = idleSpot(flag);
    BoardState.setHeroBody(heroId, { x: at.x, y: at.y, targetId: null, side: -1, atWork: null, moving: false, facing: 1 });
}

/**
 * A hero is being sent out: their body appears (at the Hall), or, still on
 * their way home, turns around. `Flags.plant` calls this BEFORE choosing, so
 * "nearest" is measured from where they really are (HM-4, HMP-1).
 */
export function enter(heroId) {
    return ensureBody(heroId);
}

/**
 * Their flag is down: recalled, or defeated (`limp`). Their figure walks back
 * into the Guild Hall and disappears there (HM-5, HM-6). With no Hall on the
 * mat, or instant arrival (tests), they are simply gone.
 */
export function sendHome(heroId, { limp = false } = {}) {
    const body = BoardState.heroBodyOf(heroId);
    if (!body) return;
    if (BoardState.isInstantArrival() || !guildHallPoint()) {
        BoardState.setHeroBody(heroId, null);
        return;
    }
    body.homeward = true;
    body.limp = !!limp;
    body.targetId = null;
    body.atWork = null;
    body.moving = true;
}

/**
 * Bring one hero's body up to date right now, without walking: made if
 * missing, heading set, and — if they are already standing there (or arrival
 * is instant, in tests) — arrived. `Flags.js` calls this after every claim
 * change, so a job starts the same tick when no walk is needed.
 */
export function settle(heroId) {
    if (!BoardState.flagOf(heroId)) {
        // No flag: only a hero on their way home keeps a body.
        if (!isReturning(heroId)) BoardState.setHeroBody(heroId, null);
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
    // Heroes with no flag: walking home, or a leftover to clear.
    for (const [heroId, body] of BoardState.heroBodies()) {
        if (flags[heroId]) continue;
        if (body.homeward) {
            if (step(heroId, body, delta)) anyMoved = true;
        } else {
            BoardState.setHeroBody(heroId, null);
            anyMoved = true;
        }
    }

    if (anyMoved) EventBus.publish(BOARD_EVENTS.HEROES_WALKED);
}
