import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { arcPoses, heldPoses } from './fx/pixelSteps.js';

/** Poses in the air, and how long each holds: the hop out of the spawner. */
const SPAWN_STEPS = 12;
const SPAWN_POSE_MS = 30;
/** How long a spawned Token takes to pop out and land: the poses in the air and the bounce. */
export const SPAWN_MS = (SPAWN_STEPS + 2) * SPAWN_POSE_MS;
/** The highest the hop may rise, art pixels. */
const SPAWN_PEAK_MAX = 80;
/** A spawn nobody drew within this long is forgotten. */
const STALE_MS = 2000;

/** instanceId to where its spawner stood when it spawned. */
const pending = new Map();

/**
 * Remember where a new Token came from. The event fires when the engine lands the Token, before
 * React has drawn it, so the mat's Token reads this when it mounts (`takeSpawn`).
 */
export function recordSpawn(payload, now = Date.now()) {
    if (!payload?.instanceId || !payload.spawnerId) return;
    const from = BoardState.getTokenById(payload.spawnerId);
    if (!from || !Number.isFinite(from.x) || !Number.isFinite(from.y)) return;
    for (const [id, p] of pending) if (now - p.at > STALE_MS) pending.delete(id);
    pending.set(payload.instanceId, { x: from.x, y: from.y, typeId: from.typeId, at: now });
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
 * How high a spawn's hop rises, art pixels: over the top of its spawner's art (`over` mat units
 * above its point), so a Token born inside a big Forest's picture is seen leaving it, and higher for
 * a longer throw.
 */
export function spawnPeak(dx, dy, over = 0, unit = 1) {
    const clear = over / unit + 8;
    return Math.min(SPAWN_PEAK_MAX, Math.round(Math.max(clear, Math.hypot(dx, dy) / unit / 3)));
}

/**
 * The pop-out on one element: it hops up out of its spawner (`dx`, `dy` mat units away), over its
 * top, and lands on its own spot with the landing bounce, at its own size all the way, in whole art
 * pixels and stepped time (`fx/pixelSteps.js`). The Guild Hall's quests and a Forest's saplings
 * alike. Transform only, added on top of whatever transform the box already has (an enemy's box
 * is placed by one), so no layout moves.
 * ⚠️ No scale: a fraction of the art's size resamples it (UI_STYLE, "Sprites and icons").
 * ⚠️ On the main thread (`will-change: contents` while it plays): a new Token pops out among the
 * resting ones, and on the compositor every Token in front of it was redrawn soft (tailwind.css,
 * at `.gi-token-land`).
 * @param {{unit?: number, over?: number}} [options] mat units per art pixel; how far the spawner's
 *        art reaches above its point (half its drawn size)
 * @returns {Animation|null} null where the browser cannot animate
 */
export function playSpawn(el, dx, dy, { unit = 1, over = 0 } = {}) {
    if (!el || typeof el.animate !== 'function') return null;
    const before = el.style.willChange;
    el.style.willChange = 'contents';
    const poses = arcPoses(dx, dy, { unit, peak: spawnPeak(dx, dy, over, unit), steps: SPAWN_STEPS, ms: SPAWN_POSE_MS });
    const { keyframes, duration } = heldPoses(poses.map(({ ms, x, y }) => ({ ms, x, y })), { unit });
    const anim = el.animate(keyframes, { duration, composite: 'add' });
    if (anim) {
        const restore = () => { el.style.willChange = before; };
        anim.onfinish = restore;
        anim.oncancel = restore;
    }
    return anim;
}
