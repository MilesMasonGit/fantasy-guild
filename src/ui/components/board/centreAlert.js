
import { ALERT } from '../../../systems/board/boardEvents.js';

/**
 * Engine alerts (`instance.alert`) that are a choice waiting, not a fault: a station or a
 * Foundation with nothing chosen. The Token summary does not count them as blocked; on the mat
 * they are a yellow problem mark, "Choose a recipe" (`problemMark.js`).
 */
export const GEAR_ONLY_ALERTS = new Set([ALERT.CHOOSE_BUILD, ALERT.CHOOSE_RECIPE]);

/** Whether an engine alert is a choice waiting rather than a fault. */
export const isGearOnlyAlert = (alert) => GEAR_ONLY_ALERTS.has(alert);

/** A spawner's live count against its cap, as drawn in its ring. */
export function spawnerCountText(counts) {
    if (!counts || !Number.isFinite(counts.count) || !Number.isFinite(counts.cap)) return null;
    return `${counts.count}/${counts.cap}`;
}

/**
 * Time to a turning Token's next roll as drawn in its ring:
 * `m:ss`, rounded UP to the second so it never reads `0:00` while time is left.
 * Null when there is nothing to count.
 */
export function turnCountdownText(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return null;
    const total = Math.max(0, Math.ceil(n / 1000));
    const min = Math.floor(total / 60);
    const s = total % 60;
    return `${min}:${String(s).padStart(2, '0')}`;
}

/**
 * Whether a Token gets the recipe gear: it has something to choose — a
 * Foundation, or a station whose pool is not empty. A station with an empty
 * pool has nothing to offer, so it shows nothing.
 *
 * @returns {{show: boolean, pulsing: boolean}} `pulsing` while nothing is chosen
 */
export function gearStateOf({ stationSkill = null, isFoundation = false, hasPool = false, recipe = null } = {}) {
    const show = !!stationSkill && (isFoundation || hasPool);
    return { show, pulsing: show && !recipe };
}
