// Fantasy Guild - XP Curve

/**
 * XP Curve utilities for skill leveling
 * Uses an exponential curve similar to RuneScape's.
 */

/**
 * Calculate the total XP required to reach a given level
 * @param {number} level - Target level (1-99)
 * @returns {number} Total XP required
 */
export function xpForLevel(level) {
    if (level <= 1) return 0;
    if (level > 99) level = 99;

    let total = 0;
    for (let i = 1; i < level; i++) {
        total += Math.floor(i + 300 * Math.pow(2, i / 7));
    }
    return Math.floor(total / 4);
}

/**
 * Calculate the current level from total XP
 * @param {number} xp - Total XP
 * @returns {number} Current level (1-99)
 */
export function levelFromXp(xp) {
    if (xp <= 0) return 1;

    // Reads the pre-built table rather than calling `xpForLevel` (itself a loop)
    // per candidate level: this runs on every XP award and hero-sheet skill row.
    for (let level = 1; level < 99; level++) {
        if (XP_TABLE[level + 1] > xp) {
            return level;
        }
    }
    return 99;
}

/**
 * Calculate XP progress towards next level
 * @param {number} xp - Current total XP
 * @returns {{level: number, currentXp: number, nextLevelXp: number, progress: number}}
 */
export function getXpProgress(xp) {
    const level = levelFromXp(xp);
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1); // Note: xpForLevel(100) returns xpForLevel(99)

    const xpIntoLevel = xp - currentLevelXp;
    const xpForThisLevel = nextLevelXp - currentLevelXp; // This is the denominator

    let progress;
    if (level >= 99 || xpForThisLevel <= 0) {
        progress = 1; // Max level reached or no XP range for this level
    } else {
        progress = xpIntoLevel / xpForThisLevel;
    }

    return {
        level,
        currentXp: xpIntoLevel,
        nextLevelXp: xpForThisLevel,
        progress: Math.max(0, Math.min(1, progress))
    };
}

/**
 * Get the XP required for the next level
 * @param {number} currentLevel - Current level
 * @returns {number} XP required for next level, 0 if at max
 */
export function xpToNextLevel(currentLevel) {
    if (currentLevel >= 99) return 0;
    return xpForLevel(currentLevel + 1) - xpForLevel(currentLevel);
}

// XP_TABLE[L] === xpForLevel(L) for L = 1..100; `levelFromXp` reads it.
const XP_TABLE = [];
for (let i = 1; i <= 100; i++) {
    XP_TABLE[i] = xpForLevel(i);
}

/**
 * Get the pre-calculated XP for a level (faster than xpForLevel)
 * @param {number} level - Target level
 * @returns {number} XP required
 */
export function getXpTable(level) {
    if (level <= 1) return 0;
    if (level > 99) level = 99;
    return XP_TABLE[level] || xpForLevel(level);
}

export const XP_CURVE_TABLE = Object.freeze([...XP_TABLE]);
