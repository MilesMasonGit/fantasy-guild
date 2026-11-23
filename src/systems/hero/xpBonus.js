// how a cycle's or a kill's award takes an XP bonus

/** Pure: work cycles (`BoardRunner`), kills (`CombatResolutionProcessor`) and the progression ledger's rate calculator share it. */

import { roundByChance } from '../../utils/RNG.js';

// Below this a bonus is float noise from summed percentages (+10% and -10%), not a real bonus.
const XP_BONUS_EPSILON = 1e-9;

/** Whether an award is resolved by chance: under a positive bonus, or a fraction of 1 XP. */
function byChance(base, bonused) {
    return bonused - base > XP_BONUS_EPSILON || (bonused > 0 && bonused < 1);
}

/**
 * Whole XP for an award under a bonus: a positive bonus carries its fraction by chance, so +10% on a
 * 1 XP award is 2 one time in ten and +10% means +10% at every size. An award under 1 XP pays 1 by
 * chance (0.4 pays 1 four times in ten). Any other award is plain rounding.
 *
 * ⚠️ The one place an award draws, so a catch-up (which runs the same cycles and kills) pays what
 * live play does. It draws one `random()` only when the award is resolved by chance and has a
 * fraction: a hero with no bonus on a whole award leaves the random stream as it was.
 * @param {number} base XP before any bonus
 * @param {number} bonused XP after the bonus, unrounded
 * @param {() => number} [random]
 * @returns {number} whole XP
 */
export function applyXpBonus(base, bonused, random = Math.random) {
    if (byChance(base, bonused)) return roundByChance(bonused, random);
    return Math.round(bonused);
}

/**
 * What {@link applyXpBonus} gives on average: unrounded where it would draw. Draws nothing; the
 * Token card's XP row and the ledger read it.
 */
export function averageXpBonus(base, bonused) {
    if (byChance(base, bonused)) return bonused;
    return Math.round(bonused);
}
