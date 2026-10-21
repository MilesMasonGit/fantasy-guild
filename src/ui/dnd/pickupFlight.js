import { getEventCoordinates } from '@dnd-kit/utilities';
import { heldPoses, prefersReducedMotion } from '../components/board/fx/pixelSteps.js';

/**
 * Picking something up flies it to the cursor (T-154): the carried ghost is centred on the
 * cursor, as before, but its picture starts where its source stood and steps there over
 * {@link PICKUP_MS} instead of jumping.
 * dnd-kit's own snap (`snapCenterToCursor`) waits for the ghost to be measured, a frame or two in,
 * and then jumped; this snap uses the box the drag started from, which the ghost is placed on and
 * sized to, so the ghost is on the cursor from its first frame, and it remembers how far it put it
 * there, per drag. A pickup reads no layout of its own.
 */

/** How long the picture takes to reach the cursor. */
export const PICKUP_MS = 80;

/** How much of the way back it still is, pose by pose: quick at first, then settling. */
const STILL_BACK = Object.freeze([1, 0.5, 0.2, 0.05]);

/**
 * One drag source's snap and flight. `modifier` goes in `DragOverlay`'s `modifiers`; `holder`
 * is the ref callback for the element round the ghost's picture.
 */
export function createPickupFlight() {
    const state = { event: null, rect: null, offset: null, el: null };
    const modifier = ({ activatorEvent, activeNodeRect, draggingNodeRect, transform }) => {
        if (!activatorEvent) return transform;
        if (state.event !== activatorEvent) {
            state.event = activatorEvent;
            state.rect = null;
            state.offset = null;
        }
        state.rect = state.rect || activeNodeRect || draggingNodeRect || null;
        const at = state.rect ? getEventCoordinates(activatorEvent) : null;
        if (!at) return transform;
        const x = at.x - state.rect.left - state.rect.width / 2;
        const y = at.y - state.rect.top - state.rect.height / 2;
        if (!state.offset) {
            state.offset = { x, y };
            // After this render is committed and before it is painted: the picture never shows on
            // the cursor first.
            queueMicrotask(() => playPickupFlight(state.el, state.offset));
        }
        return { ...transform, x: transform.x + x, y: transform.y + y };
    };
    const holder = (el) => { state.el = el; };
    return { modifier, holder, state };
}

/**
 * The flight on the element round the ghost's picture: from where its source stood (`offset` back
 * from the cursor) to the cursor, in whole pixels and stepped time.
 * @returns {Animation|null}
 */
export function playPickupFlight(el, offset) {
    if (!el || !offset || typeof el.animate !== 'function' || prefersReducedMotion()) return null;
    if (Math.hypot(offset.x, offset.y) < 2) return null;
    const poses = STILL_BACK.map(k => ({ ms: PICKUP_MS / STILL_BACK.length, x: -offset.x * k, y: -offset.y * k }));
    const { keyframes, duration } = heldPoses(poses, { unit: 1 });
    return el.animate(keyframes, { duration });
}
