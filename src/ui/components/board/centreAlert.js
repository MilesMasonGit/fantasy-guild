
import { ALERT } from '../../../systems/board/boardEvents.js';

/**
 * Two kinds of alert.
 * - A **problem** (red or yellow) sits at the centre of its Token and stays until the problem
 * is fixed. A live problem (a spawner that needs an item or has no room) comes down when the
 * engine says the cause is gone. News of a problem that cannot be fixed (a Token that ran dry,
 * a refused drop) fades after ten seconds like a notice, still in red ({@link alertFades}).
 * - A **notice** (green) is not a problem: a Token a spawner has just made, a restock. It sits
 * in the same place and goes on its own after `TokenNotices.NOTICE_MS`.
 * A hero standing at a blocked Token says the problem in a speech bubble instead; those are
 * `spoken` and never drawn on the Token.
 */
export const ALERT_KIND = Object.freeze({
    PROBLEM: 'problem',
    NOTICE: 'notice',
    SPOKEN: 'spoken'
});

/** Alert types a hero's speech bubble says instead. */
export const HERO_SPOKEN_ALERTS = new Set(['out_of_item', 'out_of_token', 'out_of_charges', 'hero_level_up']);

/**
 * Engine alerts (`instance.alert`) that are not problems: a station or a Foundation with
 * nothing chosen is waiting for the player, not broken, and its pulsing gear says so on its
 * own. Nothing red is drawn for them. Heroes still skip such a Token; only the look changed.
 */
export const GEAR_ONLY_ALERTS = new Set([ALERT.CHOOSE_BUILD, ALERT.CHOOSE_RECIPE]);

/** Whether an engine alert is one the gear says instead of a red or yellow mark. */
export const isGearOnlyAlert = (alert) => GEAR_ONLY_ALERTS.has(alert);

/**
 * A worked Token's live problem: the alert its centre mark shows, or null.
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

/** What kind of alert a `TILE_EVENT_ALERT` payload is. */
export function alertKindOf(payload) {
    if (!payload) return null;
    if (HERO_SPOKEN_ALERTS.has(payload.type) || payload.severity === 'upgrade') return ALERT_KIND.SPOKEN;
    if (payload.severity === 'green' || payload.severity === 'notice') return ALERT_KIND.NOTICE;
    return ALERT_KIND.PROBLEM;
}

/**
 * Problem news that cannot be fixed, so it fades after `TokenNotices.NOTICE_MS` instead of
 * waiting to be read.
 * - `token_exhausted`: the Token is gone; the spawner's own live alert covers any real problem
 * left behind.
 * - `drop_rejected`: the drop simply did not happen; there is nothing on the mat left to fix.
 */
export const FADING_NEWS = new Set(['token_exhausted', 'drop_rejected']);

/** Whether a `TILE_EVENT_ALERT` problem fades on its own (it is news that cannot be fixed). */
export function alertFades(payload) {
    return !!payload && alertKindOf(payload) === ALERT_KIND.PROBLEM && FADING_NEWS.has(payload.type);
}

/**
 * The one mark drawn at a Token's centre. A live problem first, then news of a
 * problem, then a notice — so a notice never covers a problem. A live problem
 * is a spawner's or a worked Token's; the caller passes the spawner's
 * when both apply.
 *
 * @param {{live?: object|null, event?: object|null, notice?: object|null}} marks
 * @returns {'live'|'event'|'notice'|null}
 */
export function pickCentreAlert({ live = null, event = null, notice = null } = {}) {
    if (live) return 'live';
    if (event) return 'event';
    if (notice) return 'notice';
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
