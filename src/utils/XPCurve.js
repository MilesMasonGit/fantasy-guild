// XP Curve

/** The top level of every skill: the sheet writes levels out of it ("25/99"). */
export const MAX_SKILL_LEVEL = 99;

/**
 * The pace curve (BALANCE_RULES section 1): level 1 takes 3 minutes and each level after it
 * `PACE_STEP_PCT` % longer, for a well-optimized player.
 *
 * ⚠️ The CMS ledger's default pace rule (`cms/src/engine/ledger/settings.js`) holds the same two
 * numbers; a test pins them equal, so move both together.
 */
export const PACE_START_MINUTES = 3;
export const PACE_STEP_PCT = 6.25;

/** The XP an hour work unlocked at level 1 pays; it doubles every 20 levels. */
export const XP_HOUR_AT_1 = 1660;

/** XP from `level` to the next: that level's XP an hour times the curve's minutes for it. */
function xpToNext(level) {
    const minutes = PACE_START_MINUTES * (1 + PACE_STEP_PCT / 100) ** (level - 1);
    return Math.round(XP_HOUR_AT_1 * 2 ** ((level - 1) / 20) * minutes / 60);
}

/**
 * Calculate the total XP required to reach a given level
 * @param {number} level - Target level (1-99)
 * @returns {number} Total XP required
 */
export function xpForLevel(level) {
    if (level <= 1) return 0;
    if (level > MAX_SKILL_LEVEL) level = MAX_SKILL_LEVEL;

    let total = 0;
    for (let i = 1; i < level; i++) total += xpToNext(i);
    return total;
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
    const currentLevelXp = XP_TABLE[level];
    const nextLevelXp = XP_TABLE[level + 1]; // Note: XP_TABLE[100] equals XP_TABLE[99]

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

// XP_TABLE[L] === xpForLevel(L) for L = 1..100; `levelFromXp` reads it.
const XP_TABLE = [];
for (let i = 1; i <= 100; i++) {
    XP_TABLE[i] = xpForLevel(i);
}
