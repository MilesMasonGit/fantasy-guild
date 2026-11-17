// how a cycle's or a kill's award takes an XP bonus

/** Pure: work cycles (`BoardRunner`), kills (`CombatResolutionProcessor`) and the progression ledger's rate calculator share it. */

import { roundByChance } from '../../utils/RNG.js';

// Below this a bonus is float noise from summed percentages (+10% and -10%), not a real bonus.
const XP_BONUS_EPSILON = 1e-9;

/**
 * Whole XP for an award under a bonus: a positive bonus carries its fraction by chance, so +10% on a
 * 1 XP award is 2 one time in ten and +10% means +10% at every size. A negative or absent bonus is
 * plain rounding.
 *
 * ⚠️ Draws one `random()` only for a positive bonus whose result has a fraction: a hero with no
 * bonus, or one that lands on a whole number, leaves the random stream as it was.
 * @param {number} base XP before any bonus
 * @param {number} bonused XP after the bonus, unrounded
 * @param {() => number} [random]
 * @returns {number} whole XP
 */
export function applyXpBonus(base, bonused, random = Math.random) {
    if (bonused - base > XP_BONUS_EPSILON) return roundByChance(bonused, random);
    return Math.round(bonused);
}

/**
 * What {@link applyXpBonus} gives on average: unrounded where it would draw. Draws nothing; the
 * Token card's XP row and the ledger read it.
 */
export function averageXpBonus(base, bonused) {
    if (bonused - base > XP_BONUS_EPSILON) return bonused;
    return Math.round(bonused);
}
