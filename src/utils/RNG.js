// Fantasy Guild - RNG Utilities

/**
 * Random Number Generator utilities
 * Provides consistent randomization functions for game mechanics
 */

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** How close to a whole number an amount must be to count as whole (float error, not a fraction). */
export const WHOLE_EPSILON = 1e-9;

/**
 * A fractional amount made whole by chance: 8.8 is 9 four times in five and 8 one time in five, so
 * many rolls average the exact amount. 0 or less is 0. A blow's damage (`CombatFormulas.rollFraction`)
 * and an input's cost under Efficiency (`InputCost`) both round this way.
 *
 * ⚠️ Draws one `random()` only when the amount has a fraction; a whole amount (within float error)
 * draws nothing, so numbers that stay whole leave the random stream as it was.
 */
export function roundByChance(exact, random = Math.random) {
    if (!(exact > 0)) return 0;
    const whole = Math.floor(exact + WHOLE_EPSILON);
    const fraction = exact - whole;
    if (fraction < WHOLE_EPSILON) return whole;
    return whole + (random() < fraction ? 1 : 0);
}

/** The most {@link roundByChance} can give for `exact`: rounded up, float error aside. Draws nothing. */
export function mostByChance(exact) {
    if (!(exact > 0)) return 0;
    const whole = Math.floor(exact + WHOLE_EPSILON);
    return exact - whole < WHOLE_EPSILON ? whole : whole + 1;
}
