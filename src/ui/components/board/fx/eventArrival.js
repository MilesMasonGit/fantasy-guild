import { EventBus, UI_LISTENER } from '../../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../../systems/board/boardEvents.js';
import * as BoardState from '../../../../systems/board/BoardState.js';
import { EVENT_KIND } from '../../../../config/eventTable.js';
import { artRadiusOf } from '../../../../config/matGeometry.js';
import { FX_FRAME_MS, heldPoses, prefersReducedMotion } from './pixelSteps.js';
import { animateFx } from './oneShot.js';
import { streak, starBurst, puff } from './matFx.js';

/**
 * An event's arrival on the mat (brief 640), by kind, from the mat's existing pieces:
 * - a **rich node** streaks down from up and to the right, leaving a short tail of sparks
 *   (`matFx.streak`), and lands with the Giant Harvest's star burst and a puff of dust;
 * - a **buff Token** drifts in from the left and fades up in four steps.
 *
 * Like a spawn's pop-out (`spawnMotion.js`): the engine lands the Token before React draws it, so
 * `BOARD_EVENTS.EVENT_LANDED` is remembered here and the mat's Token asks as it mounts
 * ({@link takeArrival}). A catch-up's quiet bus never tells this listener, so nothing plays for
 * events that landed while away.
 *
 * ⚠️ No random numbers: every arrival of a kind plays the same, so drawing never touches the
 * random stream the engine shares in live play.
 */

/** An arrival nobody drew within this long is forgotten. */
const STALE_MS = 2000;

/** How far up and across a node starts its fall, in art pixels from where it lands. */
export const NODE_FALL = Object.freeze({ x: 40, y: -120, steps: 10, ms: 36 });

/** How far left a buff starts its drift, art pixels, and its fade's opacity steps. */
export const BUFF_DRIFT = Object.freeze({ x: -16, ms: 2 * FX_FRAME_MS, fade: Object.freeze([0, 0.25, 0.5, 0.75]) });

/** instanceId → the kind of event that just landed there. */
const pending = new Map();

/** Remember an event that just landed (the payload of `EVENT_LANDED`). */
export function recordArrival(payload, now = Date.now()) {
    if (!payload?.instanceId || !payload.kind) return;
    for (const [id, p] of pending) if (now - p.at > STALE_MS) pending.delete(id);
    pending.set(payload.instanceId, { kind: payload.kind, at: now });
}

/** The kind of event Token `instanceId` landed as, once, if it just landed; else null. */
export function takeArrival(instanceId, now = Date.now()) {
    const p = pending.get(instanceId);
    if (!p) return null;
    pending.delete(instanceId);
    return now - p.at <= STALE_MS ? p.kind : null;
}

/** Listen for landings (the mat calls this once). Returns the unsubscribe. */
export function watchEventArrivals() {
    return EventBus.subscribe(BOARD_EVENTS.EVENT_LANDED, (p) => recordArrival(p), UI_LISTENER);
}

export function resetEventArrivals() {
    pending.clear();
}

/**
 * A node's fall, as held poses in art pixels from its landing spot: a straight line down from
 * {@link NODE_FALL}, the impact, a two-pixel rebound and home.
 */
export function nodeFallPoses() {
    const { x, y, steps, ms } = NODE_FALL;
    const poses = [];
    for (let i = 0; i < steps; i++) {
        const k = 1 - i / steps;
        poses.push({ ms, x: Math.round(x * k), y: Math.round(y * k) });
    }
    poses.push({ ms: FX_FRAME_MS, x: 0, y: 0 });
    poses.push({ ms: FX_FRAME_MS, x: 0, y: -2 });
    poses.push({ ms: FX_FRAME_MS, x: 0, y: 0 });
    return poses;
}

/**
 * A buff's drift: whole art pixels from {@link BUFF_DRIFT}'s start towards home, one step per fade
 * step, from unseen to three quarters; the rest after it is home, fully seen.
 */
export function buffDriftPoses() {
    const { x, ms, fade } = BUFF_DRIFT;
    return fade.map((opacity, i) => ({ ms, x: Math.round(x * (1 - i / fade.length)), y: 0, opacity }));
}

/** How long a node takes from the top of its fall to the impact. */
export const NODE_FALL_MS = NODE_FALL.steps * NODE_FALL.ms;

/** Play `poses`' moves on a box, added to its own transform, on the main thread while it plays. */
function playMoves(el, poses, unit) {
    const { keyframes, duration } = heldPoses(poses.map(({ ms, x, y }) => ({ ms, x, y })), { unit });
    const anim = animateFx(el, keyframes, { duration, composite: 'add' });
    if (!anim) return null;
    // ⚠️ On the main thread, as the spawn pop is (tailwind.css, at `.gi-token-land`).
    const before = el.style.willChange;
    el.style.willChange = 'contents';
    const restore = () => { el.style.willChange = before; };
    anim.onfinish = restore;
    anim.oncancel = restore;
    return anim;
}

/**
 * Play the arrival of the event Token `instanceId` on its two boxes (`boxes`: its art and its
 * badges): a node's fall with its streak and burst, a buff's drift and fade. Nothing under reduced
 * motion, or for a kind it does not know.
 * @param {HTMLElement[]} boxes
 * @param {'node'|'buff'} kind
 * @param {{unit?: number, instanceId: string}} options `unit`: mat units per art pixel
 * @returns {boolean} whether it played
 */
export function playEventArrival(boxes, kind, { unit = 1, instanceId } = {}) {
    if (prefersReducedMotion()) return false;
    const t = BoardState.getTokenById(instanceId);
    if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y)) return false;
    if (kind === EVENT_KIND.NODE) {
        const poses = nodeFallPoses();
        let played = false;
        for (const el of boxes) played = !!playMoves(el, poses, unit) || played;
        if (!played) return false;
        streak(t.x, t.y, poses.slice(0, NODE_FALL.steps + 1));
        const radius = artRadiusOf(t.typeId);
        starBurst(t.x, t.y, radius, { delay: NODE_FALL_MS });
        puff(t.x, t.y + radius / 2, { delay: NODE_FALL_MS });
        return true;
    }
    if (kind === EVENT_KIND.BUFF) {
        const poses = buffDriftPoses();
        const fade = poses.map(({ ms, opacity }) => ({ ms, opacity }));
        const { keyframes, duration } = heldPoses(fade, { rest: { opacity: 1 } });
        // The fade has no move: only its opacity is kept.
        const opacityOnly = keyframes.map(({ offset, easing, opacity }) => ({ offset, ...(easing ? { easing } : {}), opacity }));
        let played = false;
        for (const el of boxes) {
            if (!playMoves(el, poses, unit)) continue;
            animateFx(el, opacityOnly, { duration });
            played = true;
        }
        return played;
    }
    return false;
}
