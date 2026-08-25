// Fantasy Guild - Token Effect Axes (Card Mutators & Tokens, Phase 5)

import { EFFECT_TYPES } from './constants.js';

/**
 * The three v1 Token effect axes (§15.8) resolved against a card's aggregator,
 * with the §10 hard floors enforced HERE and nowhere else.
 *
 * Every stamped Token registered its effect against one of these EFFECT_TYPES
 * in Phase 3 (`SlotTokens.buildTokenModifiers`); Phase 4 stamped them onto
 * slots; this module is where they finally change a number:
 *   - YIELD      → output quantities (`LootSystem.handleTaskReward`) — live
 *   - WORK_TIME  → **no caller**
 *   - INPUT_COST → **no caller**
 *
 * ⚠️ Corrected 2026-08-24 (CR2-081). The two dead lines used to name
 * `StatProcessor` and `WorkProcessor.consumeInputs` as the consumers.
 * **Both files were deleted with the card system**, and `resolveWorkTime` and
 * `resolveInputCost` now have no caller in `src/` outside the tests. The board
 * resolves those two axes through `TileModifiers.resolveAxis` instead
 * (`BoardRunner`), which applies the same floors independently — see the
 * comments there. Only `resolveYield` is still on a live path.
 *
 * The math is always the full Three-Bucket formula via
 * `aggregator.resolveAxis()`; an aggregator with no modifiers for an axis
 * returns the base untouched, so these are safe to call unconditionally.
 */

/** §10 / §14: a task can never take less than one second, however mitigated. */
export const MIN_WORK_TIME_MS = 1000;

/** §10: an input cost can never drop below one unit. */
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
 * The floor only bites once Tokens have actually touched the time: a card
 * whose *base* tick is already under a second (a content choice) is left
 * alone, but no stack of Haste can drive a modified time below the floor
 * (§10 "no absolute mitigation").
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
