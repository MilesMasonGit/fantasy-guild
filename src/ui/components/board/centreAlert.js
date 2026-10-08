
import { ALERT } from '../../../systems/board/boardEvents.js';

/**
 * Engine alerts (`instance.alert`) that are not problems: a station or a Foundation with
 * nothing chosen is waiting for the player, not broken, and its pulsing gear says so on its
 * own. Nothing red is drawn for them. Heroes still skip such a Token; only the look changed.
 */
export const GEAR_ONLY_ALERTS = new Set([ALERT.CHOOSE_BUILD, ALERT.CHOOSE_RECIPE]);

/** Whether an engine alert is one the gear says instead of a red or yellow mark. */
export const isGearOnlyAlert = (alert) => GEAR_ONLY_ALERTS.has(alert);

/**
 * A worked Token's live problem: the alert that greys its cycle ring, or null.
 * - Only while a hero is on the Token.
 * - The engine's `instance.alert` first, unless the gear says it ({@link isGearOnlyAlert}), in
 * which case nothing at all: a station with nothing chosen is waiting for the player, whatever
 * else it lacks.
 * - Otherwise what `getMissingRequirements` finds: missing Tokens read as `no_recipe`, missing
 * items as `inputs`.
 * @param {{hasHero?: boolean, alert?: string|null, missingType?: string|null}} worked
 * @returns {string|null} an `ALERT` value
 */
export function workedAlertOf({ hasHero = false, alert = null, missingType = null } = {}) {
    if (!hasHero) return null;
    if (alert) return isGearOnlyAlert(alert) ? null : alert;
    if (missingType === 'tokens') return ALERT.NO_RECIPE;
    if (missingType === 'items') return ALERT.INPUTS;
    return null;
}

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
