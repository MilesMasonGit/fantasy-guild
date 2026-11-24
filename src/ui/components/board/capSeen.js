import { ALERT } from '../../../systems/board/boardEvents.js';

/**
 * A full Token cap's '!' on a spawner, once seen (docs/active/concept_playmat_declutter.md §3.4):
 * the cap is waiting for room, not broken, so its '!' is yellow, and once the player has rested
 * the pointer on that spawner it goes. It comes back only when the cap has freed and filled
 * again, that is when the spawner's alert has been something else in between.
 * UI memory only, by spawner instance id: never saved, never the engine's business.
 */

const seen = new Set();

/** Whether spawner `id`'s full-cap '!' has been seen and so is not drawn. */
export const isCapSeen = (id) => seen.has(id);

/** The player has rested the pointer on spawner `id` while its cap '!' shows. */
export function seeCap(id) {
    if (id) seen.add(id);
}

/**
 * Spawner `id`'s alert is now `alert` (`SpawnerSystem.spawnerAlertOf`'s): anything but a full cap
 * forgets it was seen, so the next full cap shows again.
 * @returns {boolean} whether its cap '!' is still seen
 */
export function capAlertNow(id, alert) {
    if (alert !== ALERT.SPAWN_MAT_FULL) seen.delete(id);
    return seen.has(id);
}

/** Forget every seen cap (a new game, a load, tests). */
export function resetCapSeen() {
    seen.clear();
}
