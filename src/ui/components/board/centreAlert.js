
import { ALERT } from '../../../systems/board/boardEvents.js';

/**
 * Engine alerts (`instance.alert`) that are a choice waiting, not a fault: a station or a
 * Foundation with nothing chosen. The Token summary does not count them as blocked; on the mat
 * they are a yellow problem mark, "Choose a recipe" (`problemMark.js`).
 */
export const GEAR_ONLY_ALERTS = new Set([ALERT.CHOOSE_BUILD, ALERT.CHOOSE_RECIPE, ALERT.CHOOSE_NODE]);

/** Whether an engine alert is a choice waiting rather than a fault. */
export const isGearOnlyAlert = (alert) => GEAR_ONLY_ALERTS.has(alert);

/**
 * Whether a Token gets the recipe gear: it has something to choose — a
 * Foundation, or a station whose pool is not empty. A station with an empty
 * pool has nothing to offer, so it shows nothing.
 *
 * @returns {{show: boolean, pulsing: boolean}} `pulsing` while nothing is chosen
 */
export function gearStateOf({ stationSkill = null, isFoundation = false, hasPool = false, recipe = null, isLaboratory = false, nodeChosen = false } = {}) {
    // A Laboratory picks the node it studies with the same gear.
    const show = !!stationSkill && (isFoundation || hasPool || isLaboratory);
    return { show, pulsing: show && (isLaboratory ? !nodeChosen : !recipe) };
}
