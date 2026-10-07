import { EFFECT_TYPES } from './constants.js';

/**
 * Token effect axes (YIELD, WORK_TIME, INPUT_COST) resolved against an aggregator,
 * with the hard floors enforced HERE and nowhere else.
 *
 * ⚠️ No live caller: all three axes are called only from tests.
 * The board resolves these axes through `TileModifiers.resolveAxis`, which applies its own floors.
 *
 * An aggregator with no modifiers for an axis returns the base untouched, so these are
 * safe to call unconditionally.
 */

/** A task can never take less than one second, however mitigated. */
export const MIN_WORK_TIME_MS = 1000;

/** An input cost can never drop below one unit. */
export const MIN_INPUT_COST = 1;

/** Resolve an axis, tolerating a missing aggregator (returns base). */
function resolve(aggregator, effectType, base) {
    if (!aggregator?.resolveAxis) return base;
    return aggregator.resolveAxis(effectType, base);
}

/**
 * Token-adjusted output yield for one drop quantity. Fractional on purpose —
 * the caller applies probabilistic rounding (LootSystem.scaleYield), so a
 * ×1.5 yield is "1, plus a 50% chance of a 2nd". Clamped at 0; a fully-cursed
 * yield produces nothing rather than negative loot.
 */
export function resolveYield(aggregator, baseQuantity) {
    return Math.max(0, resolve(aggregator, EFFECT_TYPES.YIELD, baseQuantity));
}

/**
 * Token-adjusted Work Time in ms, floored at {@link MIN_WORK_TIME_MS}.
 *
 * The floor only bites once Tokens have touched the time: a base tick already under
 * a second is left alone, but no stack of Haste can push a modified time below it.
 */
export function resolveWorkTime(aggregator, baseMs) {
    const adjusted = resolve(aggregator, EFFECT_TYPES.WORK_TIME, baseMs);
    if (adjusted === baseMs) return baseMs;      // no WORK_TIME tokens
    return Math.max(MIN_WORK_TIME_MS, adjusted);
}

/**
 * Token-adjusted input cost, floored at {@link MIN_INPUT_COST} and rounded to a
 * whole unit. Like the time floor, an untouched cost passes through unchanged.
 */
export function resolveInputCost(aggregator, baseQuantity) {
    const adjusted = resolve(aggregator, EFFECT_TYPES.INPUT_COST, baseQuantity);
    if (adjusted === baseQuantity) return baseQuantity;   // no INPUT_COST tokens
    return Math.max(MIN_INPUT_COST, Math.round(adjusted));
}
