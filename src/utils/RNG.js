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
