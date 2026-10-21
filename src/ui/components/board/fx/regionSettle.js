import { EventBus, UI_LISTENER } from '../../../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../../systems/core/engineEvents.js';
import * as BoardState from '../../../../systems/board/BoardState.js';
import { getTokenType } from '../../../../config/registries/tokenRegistry.js';
import { heldPoses, prefersReducedMotion } from './pixelSteps.js';

/**
 * Region settle (effect 18): arriving in a Region, the Guild Hall lands first, then the Region's
 * Tokens drop in one after another, rippling out from the Hall, each with the landing hop.
 * Planned once, on `BOARD_SWAPPED`: each Token's wait grows with its distance from the Hall, and
 * the whole ripple is capped ({@link SETTLE_SPREAD_MS}), so a full mat settles as fast as a small one.
 * A Token not yet drawn asks for its wait as it mounts ({@link takeSettle}); one already drawn (the
 * Hall and the quests travel with the guild) is told by `UI_EVENTS.UI_TOKEN_FX`. Either way once.
 */

/** The Hall drops after its own slide to its new spot is over. */
export const HALL_SETTLE_MS = 250;
/** The first Token after the Hall drops this long after it starts. */
const AFTER_HALL_MS = 150;
/** The farthest Token starts this long after the first: the ripple's cap. */
export const SETTLE_SPREAD_MS = 1000;
/** A plan nobody drew within this long is forgotten. */
const STALE_MS = 3000;

/** The landing hop, as `gi-token-land` plays it (tailwind.css): 14 whole-pixel stops over 380 ms. */
const LAND = Object.freeze([
    [38, -20], [30, -12], [27, -6], [19, -1], [30, 3], [30, 1], [31, -4], [30, -5],
    [31, -3], [30, 0], [30, 1], [27, 0], [27, -1]
]);
export const LAND_MS = LAND.reduce((sum, [ms]) => sum + ms, 0);

let plan = null;

/** instanceId → how long after the arrival it drops, for the Tokens on the mat now. */
export function settlePlan(tokens) {
    const hall = tokens.find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const centre = hall ? { x: hall.x, y: hall.y } : null;
    const others = tokens.filter(t => t !== hall && Number.isFinite(t.x) && Number.isFinite(t.y));
    const far = centre ? Math.max(1, ...others.map(t => Math.hypot(t.x - centre.x, t.y - centre.y))) : 1;
    const out = new Map();
    if (hall) out.set(hall.id, HALL_SETTLE_MS);
    const start = HALL_SETTLE_MS + (hall ? AFTER_HALL_MS : 0);
    for (const t of others) {
        const d = centre ? Math.hypot(t.x - centre.x, t.y - centre.y) / far : 0;
        out.set(t.id, Math.round(start + d * SETTLE_SPREAD_MS));
    }
    return out;
}

/** Plan the settle for the board just arrived on, and tell the Tokens already drawn. */
export function beginSettle(now = performance.now()) {
    if (prefersReducedMotion()) return;
    plan = { at: now, waits: settlePlan(BoardState.tokens()) };
    for (const [instanceId] of plan.waits) EventBus.publish(UI_EVENTS.UI_TOKEN_FX, { instanceId, fx: 'settle' });
}

/** How much longer Token `instanceId` waits before it drops, once; null if it is not settling. */
export function takeSettle(instanceId, now = performance.now()) {
    if (!plan) return null;
    if (now - plan.at > STALE_MS) {
        plan = null;
        return null;
    }
    const wait = plan.waits.get(instanceId);
    if (wait == null) return null;
    plan.waits.delete(instanceId);
    return Math.max(0, wait - (now - plan.at));
}

/** Listen for arrivals (the mat calls this once). Returns the unsubscribe. */
export function watchRegionSettle() {
    return EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, () => beginSettle(), UI_LISTENER);
}

/**
 * Play one Token's settle on its two boxes: out of sight for `wait` ms, then the landing hop.
 * ⚠️ On the main thread while it plays (`will-change: contents`), as the spawn pop is: it plays
 * among the resting Tokens (tailwind.css, at `.gi-token-land`).
 * @returns {Animation[]}
 */
export function playSettle(boxes, wait, { unit = 1 } = {}) {
    const poses = [{ ms: Math.max(1, wait), y: 0, visibility: 'hidden' }, ...LAND.map(([ms, y]) => ({ ms, y, visibility: 'visible' }))];
    // The hop's numbers are mat pixels, as the landing class has them: one unit each.
    const { keyframes, duration } = heldPoses(poses, { unit, rest: { y: 0, visibility: 'visible' } });
    const out = [];
    for (const el of boxes) {
        if (!el || typeof el.animate !== 'function') continue;
        const before = el.style.willChange;
        el.style.willChange = 'contents';
        const anim = el.animate(keyframes, { duration, composite: 'add' });
        const restore = () => { el.style.willChange = before; };
        anim.onfinish = restore;
        anim.oncancel = restore;
        out.push(anim);
    }
    return out;
}
