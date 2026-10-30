// how long work and growth take once rules have moved them: the floors every reader shares

import { MAX_SPEED_UP_CUT } from '../../config/loopConstants.js';

/**
 * Pure: no board, no registry. The board's readers (`TileModifiers.workTimeOf`, `growTimeOf`) and
 * the progression ledger's rate calculator both floor through these, so a rate worked out away from
 * the board is the rate the board runs at.
 */

/**
 * The standard floor for speed-ups: a time sped up by any stack of rules never falls below
 * `1 - MAX_SPEED_UP_CUT` of its authored length. A slow-down passes untouched. Every speed-up
 * reader floors through this one function (work time in `BoardRunner.tick`, grow time in
 * `TileModifiers.growTimeOf`), so the number is one number.
 *
 * Written `base - base × cut` rather than `base × (1 - cut)`: `1 - 0.8` is 0.19999999999999996 in
 * floating point, which would floor a 10 s vein at 1999.9999999999995 ms.
 *
 * @param {number} baseMs the authored time
 * @param {number} resolvedMs the time after every rule
 */
export function floorSpeedUp(baseMs, resolvedMs) {
    if (!Number.isFinite(baseMs)) return resolvedMs;
    const floor = baseMs - baseMs * MAX_SPEED_UP_CUT;
    return resolvedMs < floor ? floor : resolvedMs;
}

/** No work cycle is shorter than this, which the catch-up's 1 s steps rely on (`loopConstants.MAX_TICK_DELTA_MS`). */
export const MIN_WORK_CYCLE_MS = 1000;

/**
 * One round of work's length from its authored time and the time every rule resolved it to: floored
 * by {@link floorSpeedUp}, never under {@link MIN_WORK_CYCLE_MS}.
 */
export function flooredWorkTime(baseMs, resolvedMs) {
    return Math.max(MIN_WORK_CYCLE_MS, floorSpeedUp(baseMs, resolvedMs));
}
