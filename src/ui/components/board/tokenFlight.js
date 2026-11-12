import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { lootHopPoses, HOP_POSES, HOP_POSE_MS } from '../../utils/lootArc.js';
import { prefersReducedMotion } from './fx/pixelSteps.js';
import { playTokenHop } from './spawnMotion.js';

/**
 * A Token moved by right-click (`rightClickOrders.js`) flies to its new spot in the hop flying loot
 * makes (`lootArc.js`: the same poses, peak and timing), then lands with its one-pixel bounce.
 * ⚠️ Drawing only: the engine has already put the Token on its new spot, exactly as a drop does, and
 * the flight is played back from the old spot on top of it, so nothing waits on it.
 */

/** The `fx` a flight is announced with on `UI_TOKEN_FX`. */
export const TOKEN_FLIGHT_FX = 'flight';

/** How long the flight takes: the poses in the air, the impact and the bounce (loot's own hop). */
export const TOKEN_FLIGHT_MS = (HOP_POSES + 2) * HOP_POSE_MS;

/** Tell the mat's Token `instanceId` it has just been moved from mat point `from`, to fly from there. */
export function announceFlight(instanceId, from) {
    EventBus.publish(UI_EVENTS.UI_TOKEN_FX, { instanceId, fx: TOKEN_FLIGHT_FX, fromX: from.x, fromY: from.y });
}

/**
 * The flight on one of a mat Token's boxes: from (`dx`, `dy`) mat units away to where it stands.
 * @param {{unit?: number}} [options] mat units per art pixel
 * @returns {Animation|null} null under reduced motion, for no move, or where nothing can animate
 */
export function playTokenFlight(el, dx, dy, { unit = 1 } = {}) {
    if (!el || (dx === 0 && dy === 0) || prefersReducedMotion()) return null;
    return playTokenHop(el, lootHopPoses(dx, dy, unit), unit);
}
