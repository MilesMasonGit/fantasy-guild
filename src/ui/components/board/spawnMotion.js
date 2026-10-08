import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { TimeBankManager } from '../../../systems/core/TimeBankManager.js';

/** How long a spawned Token takes to pop out and settle. */
export const SPAWN_MS = 300;
export const SPAWN_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** It starts this much smaller than its resting size. */
const SPAWN_FROM_SCALE = 0.5;
/** A spawn nobody drew within this long is forgotten. */
const STALE_MS = 2000;

/** instanceId to where its spawner stood when it spawned. */
const pending = new Map();

/**
 * Remember where a new Token came from. The event fires when the engine lands the Token, before
 * React has drawn it, so the mat's Token reads this when it mounts (`takeSpawn`). Skipped while
 * the time bank replays time away, like the spawn callout.
 */
export function recordSpawn(payload, now = Date.now()) {
    if (!payload?.instanceId || !payload.spawnerId || TimeBankManager.isSpending) return;
    const from = BoardState.getTokenById(payload.spawnerId);
    if (!from || !Number.isFinite(from.x) || !Number.isFinite(from.y)) return;
    for (const [id, p] of pending) if (now - p.at > STALE_MS) pending.delete(id);
    pending.set(payload.instanceId, { x: from.x, y: from.y, at: now });
}

/** The spawner's point for a Token just drawn, once; null if it did not just spawn. */
export function takeSpawn(instanceId, now = Date.now()) {
    const p = pending.get(instanceId);
    if (!p) return null;
    pending.delete(instanceId);
    return now - p.at <= STALE_MS ? p : null;
}

/** Listen for spawns (the mat calls this once). Returns the unsubscribe. */
export function watchSpawns() {
    return EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, (p) => recordSpawn(p), UI_LISTENER);
}

export function resetSpawnMotion() {
    pending.clear();
}

/**
 * The pop-out on one element: from the spawner's point (`dx`, `dy` mat units away) and half size
 * to its own spot. Transform only, added on top of whatever transform the box already has
 * (an enemy's box is placed by one), so no layout moves.
 * @returns {Animation|null} null where the browser cannot animate
 */
export function playSpawn(el, dx, dy) {
    if (!el || typeof el.animate !== 'function') return null;
    return el.animate(
        [
            { transform: `translate(${dx}px, ${dy}px) scale(${SPAWN_FROM_SCALE})` },
            { transform: 'translate(0px, 0px) scale(1)' }
        ],
        { duration: SPAWN_MS, easing: SPAWN_EASE, composite: 'add' }
    );
}
