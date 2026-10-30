// the XP floor a cycle's award passes through

/** Pure: the board (`BoardRunner`, `SkillSystem.addXP`) and the progression ledger's rate calculator share it. */

// Below this a bonus is float noise from summed percentages (+10% and -10%), not a real bonus.
const XP_BONUS_EPSILON = 1e-9;

/**
 * The XP floor: a positive XP bonus always adds at least 1 XP, so +10% on a 1 XP award is 2, not
 * a rounded-away 1. A negative or absent bonus is plain rounding.
 * @param {number} base XP before any bonus
 * @param {number} bonused XP after the bonus, unrounded
 * @returns {number} whole XP
 */
export function applyXpBonus(base, bonused) {
    if (bonused - base > XP_BONUS_EPSILON) return base + Math.max(1, Math.round(bonused - base));
    return Math.round(bonused);
}
