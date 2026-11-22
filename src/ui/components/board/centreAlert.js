
import { ALERT } from '../../../systems/board/boardEvents.js';
import { countdownText } from '../../../utils/Formatters.js';

/**
 * Engine alerts (`instance.alert`) that are a choice waiting, not a fault: a station or a
 * Foundation with nothing chosen. The Token summary does not count them as blocked; on the mat
 * they are a yellow problem mark, "Choose a recipe" (`problemMark.js`).
 */
export const GEAR_ONLY_ALERTS = new Set([ALERT.CHOOSE_BUILD, ALERT.CHOOSE_RECIPE]);

/** Whether an engine alert is a choice waiting rather than a fault. */
export const isGearOnlyAlert = (alert) => GEAR_ONLY_ALERTS.has(alert);

/** Time to a turning Token's next roll as drawn in its ring (`countdownText`); null when there is nothing to count. */
export function turnCountdownText(ms) {
    const n = Number(ms);
    return Number.isFinite(n) ? countdownText(n) : null;
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
