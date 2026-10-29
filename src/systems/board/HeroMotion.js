// heroes walk the mat

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { artRadiusOf, matW, clampToMat } from '../../config/matGeometry.js';
import { matTuning } from '../../config/matTuning.js';
import { GameState } from '../../state/GameState.js';
import * as BoardState from './BoardState.js';
import { isGuildHall } from './MatCap.js';
import { ARRIVE_EPS, stepToward, randomOffset, randomPauseMs } from './walking.js';

/**
 * Heroes live on the mat. `Flags.js` decides what a hero works; this file decides where the hero
 * is, and walks them there.
 *
 * Where a hero is heading: holding a claim, beside that Token on the side they approached from,
 * facing it (the Token itself never moves to make room); otherwise beside their flag (`idleSpot`),
 * where they potter: a pause of a few seconds, a short stroll to a random spot close by, another
 * pause. Strolls are measured from the flag's idle spot, so they stay within easy sight of it and
 * move with it. The destination is worked out afresh every tick, so a hero follows a Token that is
 * moved or pushed while they walk.
 *
 * Walking costs work time: a hero claims a Token when they set off (so no two heroes race for it),
 * but counts as working it only once they arrive. `BoardState`'s seam (`workerOf`, `workTokenOf`)
 * answers null until then, so the Token's cycle does not run. Arriving publishes one `HERO_MOVED`,
 * which switches on anything that cares who works a Token (buffs, statuses).
 *
 * Straight lines, over Tokens: no pathfinding. The screen draws a walking hero above the Tokens.
 *
 * ⚠️ Steps are not `HERO_MOVED`, which rebuilds neighbourhoods. A step publishes only
 * `HEROES_WALKED`, once per tick, for the screen.
 *
 * Home: a hero with no order waits at the Guild Hall, standing in a row in front of it (`homeSpot`)
 * and pottering there. Sent out, they set off from where they stand; sent home (or defeated), the
 * order is gone at once and they walk back to their place by the Hall (`sendHome`), a defeated
 * hero limping at half speed and standing still, greyed, until healed. Sent out again on the way,
 * they simply turn around. With no Guild Hall on the mat (a hand-built test board), or with
 * instant arrival (the tests' switch), a hero at home has no body: they appear beside their
 * order and vanish when sent home.
 *
 * ⚠️ Pottering at home draws from each body's own seeded stream (`homeRandom`), never the game's
 * `Math.random`, so heroes waiting at the Hall change no roll anywhere else.
 *
 * Offline catch-up: one very long tick covers the whole walk in one step: the hero simply arrives,
 * rather than walking in fast-forward.
 */

/**
 * Gap between a Token's art edge and the centre of the hero working it, in mat units. Wide enough
 * that a fighting hero's health bar, with a four-digit HP number on it, clears the enemy's bar
 * even where the art steps up to its largest (`FightBars.test.js`).
 */
export const STAND_GAP = 32;

/**
 * Where an idle hero stands relative to their flag's pole base, in mat units: just right of the
 * pole and up by half a hero, so they stand in front of the cloth rather than on the pole.
 */
export const IDLE_SPOT = Object.freeze({ dx: 72, dy: -72 });

/**
 * The point an idle hero stands at beside `flag`. A Token order stands on its Token's centre, so
 * its idle hero waits where they would work it (beside the Token, on the right, or on the side the
 * hero working it is not) rather than on top of it.
 */
export function idleSpot(flag) {
    const pinned = typeof flag?.pinnedTo === 'string' ? BoardState.getTokenById(flag.pinnedTo) : null;
    if (pinned) {
        const worker = BoardState.heroOfInstance(pinned.id);
        const workerSide = worker ? BoardState.heroBodyOf(worker)?.side : null;
        return standingSpot(pinned.typeId, pinned, workerSide === 1 ? -1 : 1);
    }
    return { x: flag.x + IDLE_SPOT.dx, y: flag.y + IDLE_SPOT.dy };
}

/** Walking speed in mat units a second (Mat Tuner Walk speed). */
export function walkSpeed() {
    return matTuning('walkSpeed');
}

/** A defeated hero limps home at this fraction of walking speed. */
export const LIMP_FACTOR = 0.5;

/** An idle hero strolls at this fraction of walking speed. */
export const STROLL_FACTOR = 0.5;

/** An idle hero pauses between strolls for this long, in game ms. */
export const POTTER_PAUSE_MS = Object.freeze({ min: 2000, max: 6000 });

/**
 * How far from the idle spot a hero may stroll, in mat units (Mat Tuner Idle wander; 0 = stand
 * still).
 */
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
    const hall = BoardState.tokens().find(isGuildHall);
    return hall ? { x: hall.x, y: hall.y } : null;
}

/** Heroes at home stand this far apart in their row, in mat units. */
export const HOME_GAP = 56;

/** How far below the Hall's centre the row stands, as a share of the Hall's art radius. */
export const HOME_DROP = 0.55;

/** How far a hero at home strolls from their place in the row, in mat units. */
export const HOME_POTTER = 24;

/** Whether heroes at home stand on the mat: not with instant arrival (the tests' switch). */
function homesShown() {
    return !BoardState.isInstantArrival();
}

/**
 * Where `heroId` stands at home: a row in front of the Guild Hall, one place per hero in roster
 * order, centred on the Hall. Null with no Hall on the mat.
 */
export function homeSpot(heroId) {
    const hall = BoardState.tokens().find(isGuildHall);
    if (!hall) return null;
    const roster = (GameState.state?.heroes || []).map(h => h?.id).filter(Boolean);
    const n = Math.max(1, roster.length);
    const i = Math.max(0, roster.indexOf(heroId));
    return clampToMat({ x: hall.x + (i - (n - 1) / 2) * HOME_GAP, y: hall.y + artRadiusOf(hall.typeId) * HOME_DROP });
}

/** Whether a hero is healing from a defeat (read straight from state, never rehydrated). */
function isWounded(heroId) {
    const hero = (GameState.state?.heroes || []).find(h => h?.id === heroId);
    return !!hero && hero.status === 'wounded';
}

/** Whether `heroId` is on the roster. */
function onRoster(heroId) {
    return (GameState.state?.heroes || []).some(h => h?.id === heroId);
}

/** A hero's own stream for pottering at home: seeded from their id, one number per draw. */
function seedOf(heroId) {
    let h = 2166136261;
    for (let i = 0; i < heroId.length; i++) h = Math.imul(h ^ heroId.charCodeAt(i), 16777619);
    return h >>> 0;
}

function homeRandom(body) {
    let t = (body.seed = (body.seed + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
        homeward: !!body.homeward, limp: !!body.limp, home: !!body.home
    };
}

/** Whether a hero with no flag is still on the mat, walking (or limping) home. */
export function isReturning(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.homeward;
}

/** Whether a hero with no order is standing at home by the Guild Hall. */
export function isHome(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.home;
}

/** Whether a hero walking home is limping (defeated). */
export function isLimping(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.limp;
}

/** Whether the hero is on their way somewhere (not yet at their destination). */
export function isWalking(heroId) {
    return !!BoardState.heroBodyOf(heroId)?.moving;
}

/** Whether an idle hero is out on a stroll near their flag: still idle. */
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
    return randomOffset(potterRadius(), random);
}

/** A pause between strolls, in game ms. */
function pauseMs() {
    return randomPauseMs(POTTER_PAUSE_MS, random);
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

/** The side a hero coming from `body` arrives on: the side they are already on. */
function sideFor(body, centre) {
    return body.x > centre.x ? 1 : -1;
}

/**
 * Where `heroId` is heading right now, updating the body's target bookkeeping
 * when the target changes. Null with no flag.
 */
function destinationOf(heroId, body) {
    // Walking home: to their place by the Hall, wherever it stands now.
    if (body.homeward) {
        stopPottering(body);
        return (homesShown() && homeSpot(heroId)) || guildHallPoint();
    }
    // At home: their place in the row, or out on a short stroll from it.
    if (body.home) {
        const spot = homeSpot(heroId);
        if (!spot) return null;
        return body.potter ? clampToMat({ x: spot.x + body.potter.dx, y: spot.y + body.potter.dy }) : spot;
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

    // Idle: beside the flag, or out on a stroll near it.
    if (body.targetId) stopPottering(body);      // just came off work
    body.targetId = null;
    body.atWork = null;
    const flag = BoardState.flagOf(heroId);
    if (!flag) return null;
    const home = idleSpot(flag);
    if (!body.potter) return home;
    return clampToMat({ x: home.x + body.potter.dx, y: home.y + body.potter.dy });
}

/**
 * Move one hero `delta` game ms toward their destination.
 * @returns {boolean} whether they moved
 */
function step(heroId, body, delta) {
    const dest = destinationOf(heroId, body);
    if (!dest) {
        // Walking home to a Hall that is no longer there, or at home with none: just gone.
        if (body.homeward || body.home) {
            BoardState.setHeroBody(heroId, null);
            return true;
        }
        return false;
    }

    const speed = walkSpeed() * (body.limp ? LIMP_FACTOR : body.potter ? STROLL_FACTOR : 1);
    const reach = BoardState.isInstantArrival() ? Infinity : speed * Math.max(0, delta) / 1000;
    // The step itself is shared with enemies (`walking.js`).
    const moved = stepToward(body, dest, reach);

    // Home: they take their place by the Hall (or, with no place to stand, go in and are gone).
    if (body.homeward) {
        if (!body.moving) {
            if (homesShown() && homeSpot(heroId)) {
                delete body.homeward;
                body.home = true;
            } else {
                BoardState.setHeroBody(heroId, null);
            }
        }
        return true;
    }

    // At home: a defeated hero stands still, greyed, until healed; then they potter by the Hall on
    // their own stream.
    if (body.home) {
        const wounded = isWounded(heroId);
        if (body.limp && !wounded) body.limp = false;
        if (!body.moving && !wounded) {
            if (body.pauseLeft == null) body.pauseLeft = randomPauseMs(POTTER_PAUSE_MS, () => homeRandom(body));
            body.pauseLeft -= Math.max(0, delta);
            if (body.pauseLeft <= 0) {
                body.potter = body.potter ? null : randomOffset(HOME_POTTER, () => homeRandom(body));
                body.pauseLeft = null;
            }
        }
        return moved;
    }

    // Standing beside their Token: face it. Usually the way
    // they walked in anyway; not when the mat's edge sent them round to the far
    // side, or when they were already standing there.
    const claim = BoardState.claimOfHero(heroId);
    if (!body.moving && body.targetId) {
        const target = claim ? BoardState.getTokenById(claim.instanceId) : null;
        if (target && Math.abs(target.x - body.x) > ARRIVE_EPS) body.facing = target.x < body.x ? -1 : 1;
    }

    // Idle and standing still: count the pause down, then set off on a stroll. Idle means no claim,
    // not walking home.
    if (!body.moving && !body.targetId && !claim && potterRadius() > 0) {
        if (body.pauseLeft == null) body.pauseLeft = pauseMs();
        body.pauseLeft -= Math.max(0, delta);
        if (body.pauseLeft <= 0) {
            body.potter = strollOffset();
            body.pauseLeft = null;
        }
    }

    // Arrived at a claimed Token: from now on they are working it, and the save remembers it.
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
 * A hero's body, made if they have a flag and none yet: at the Guild Hall, or beside the flag when
 * there is no Hall. A hero still walking home who is sent out again keeps their body and turns
 * around.
 */
function ensureBody(heroId) {
    const flag = BoardState.flagOf(heroId);
    let body = BoardState.heroBodyOf(heroId);
    if (body) {
        if (flag && (body.homeward || body.home)) {
            delete body.homeward;
            delete body.home;
            delete body.limp;
            stopPottering(body);
            body.targetId = null;
        }
        return body;
    }
    if (!flag) return ensureHomeBody(heroId);
    const at = guildHallPoint() || idleSpot(flag);
    body = { x: at.x, y: at.y, targetId: null, side: -1, atWork: null, moving: false, facing: 1 };
    BoardState.setHeroBody(heroId, body);
    return body;
}

/**
 * A body for a hero with no order, standing at their place by the Hall (greyed while healing), or
 * null when heroes at home are not on the mat (no Hall, instant arrival) or they are not on the
 * roster.
 */
function ensureHomeBody(heroId) {
    const existing = BoardState.heroBodyOf(heroId);
    if (existing) return existing;
    if (!homesShown() || !onRoster(heroId)) return null;
    const at = homeSpot(heroId);
    if (!at) return null;
    const body = {
        x: at.x, y: at.y, targetId: null, side: -1, atWork: null, moving: false, facing: 1,
        home: true, seed: seedOf(heroId), ...(isWounded(heroId) ? { limp: true } : {})
    };
    BoardState.setHeroBody(heroId, body);
    return body;
}

/**
 * After a load: stand `heroId` back beside `token`, on `side`, already working it: no walk from the
 * Guild Hall, no walk at all. `Flags` then restores the claim itself.
 */
export function restoreAtWork(heroId, token, side) {
    const at = standingSpot(token.typeId, token, side);
    BoardState.setHeroBody(heroId, {
        x: at.x, y: at.y, targetId: token.id, side, atWork: token.id,
        moving: false, facing: token.x < at.x ? -1 : 1
    });
}

/**
 * After a load: a hero with a flag and no restored work starts beside their flag, not at the Guild
 * Hall, which is for heroes newly sent out.
 */
export function placeAtFlag(heroId) {
    if (BoardState.heroBodyOf(heroId)) return;
    const flag = BoardState.flagOf(heroId);
    if (!flag) return;
    const at = idleSpot(flag);
    BoardState.setHeroBody(heroId, { x: at.x, y: at.y, targetId: null, side: -1, atWork: null, moving: false, facing: 1 });
}

/**
 * A hero is being sent out: their body appears (at the Hall), or, still on their way home, turns
 * around. `Flags.plant` calls this BEFORE choosing, so nearest is measured from where they really
 * are.
 */
export function enter(heroId) {
    return ensureBody(heroId);
}

/**
 * Their flag is down: recalled, or defeated (`limp`). Their figure walks back into the Guild Hall
 * and disappears there. With no Hall on the mat, or instant arrival (tests), they are simply gone.
 */
export function sendHome(heroId, { limp = false } = {}) {
    const body = BoardState.heroBodyOf(heroId);
    if (!body) return;
    if (BoardState.isInstantArrival() || !guildHallPoint()) {
        BoardState.setHeroBody(heroId, null);
        return;
    }
    stopPottering(body);
    delete body.home;
    if (body.seed == null) body.seed = seedOf(heroId);
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
        // No order: on their way home, or at home by the Hall (where the mat shows homes).
        if (isReturning(heroId) || isHome(heroId)) return;
        BoardState.setHeroBody(heroId, null);
        ensureHomeBody(heroId);
        return;
    }
    const body = ensureBody(heroId);
    if (body) step(heroId, body, 0);
}

/** Take a hero off the mat at once (recall, defeat; `sendHome` is the walk home). */
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
    // Heroes with no order: walking home, at home, or a leftover to clear.
    for (const [heroId, body] of BoardState.heroBodies()) {
        if (flags[heroId]) continue;
        if (body.homeward || (body.home && homesShown() && onRoster(heroId))) {
            if (step(heroId, body, delta)) anyMoved = true;
        } else {
            BoardState.setHeroBody(heroId, null);
            anyMoved = true;
        }
    }
    // Everyone else on the roster takes their place by the Hall.
    if (homesShown()) {
        for (const hero of GameState.state?.heroes || []) {
            if (!hero?.id || flags[hero.id] || BoardState.heroBodyOf(hero.id)) continue;
            if (ensureHomeBody(hero.id)) anyMoved = true;
        }
    }

    if (anyMoved) EventBus.publish(BOARD_EVENTS.HEROES_WALKED);
}
