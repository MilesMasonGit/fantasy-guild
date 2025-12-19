// Fantasy Guild - RNG Utilities
// Phase 3: Core Utilities

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

/**
 * Generate a random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Select a random element from an array
 * @param {Array} array - Array to select from
 * @returns {*} Random element, or undefined if array is empty
 */
export function randomChoice(array) {
    if (!array || array.length === 0) return undefined;
    return array[randomInt(0, array.length - 1)];
}

/**
 * Select a random element based on weights
 * @param {Array<{item: *, weight: number}>} weightedItems - Array of items with weights
 * @returns {*} Selected item, or undefined if array is empty
 * @example
 * weightedChoice([
 *   { item: 'common', weight: 70 },
 *   { item: 'rare', weight: 25 },
 *   { item: 'epic', weight: 5 }
 * ])
 */
export function weightedChoice(weightedItems) {
    if (!weightedItems || weightedItems.length === 0) return undefined;

    const totalWeight = weightedItems.reduce((sum, wi) => sum + wi.weight, 0);
    if (totalWeight <= 0) return undefined;

    let random = Math.random() * totalWeight;

    for (const { item, weight } of weightedItems) {
        random -= weight;
        if (random <= 0) {
            return item;
        }
    }

    // Fallback to last item (should not normally reach here)
    return weightedItems[weightedItems.length - 1].item;
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} The same array, shuffled
 */
export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = randomInt(0, i);
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Roll dice with the specified number of sides
 * @param {number} sides - Number of sides on the die (default: 6)
 * @param {number} count - Number of dice to roll (default: 1)
 * @returns {number} Sum of all dice rolls
 */
export function rollDice(sides = 6, count = 1) {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += randomInt(1, sides);
    }
    return total;
}

/**
 * Check if a random roll succeeds based on percentage chance
 * @param {number} chance - Percentage chance (0-100)
 * @returns {boolean}
 */
export function rollChance(chance) {
    return Math.random() * 100 < chance;
}
