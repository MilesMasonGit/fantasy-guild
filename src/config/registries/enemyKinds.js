// Enemy kinds: the traits an enemy carries into every fight
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the Token
// editor's kind boxes and the audit read the kinds from here. Pure: no imports; the effect library is
// handed in.

/**
 * A kind is a trait an enemy always carries, discovered by the player in a fight, never shown as an
 * icon: an ordinary library effect (Armoured, Nimble, Swift, Brute) the author picks in the Token
 * editor's kind boxes. An enemy has none, one or two (`enemy.kinds: ['effect_armoured']`). Its
 * numbers go on the enemy's own aggregator for every fight (`systems/effects/enemyKindEffects.js`)
 * and add to the enemy's written lines like any effect's: Armoured's Crush 50 and the Crab's own
 * Crush −100 make Crush −50. A kind's fight-moment rules run as the enemy's passives.
 *
 * A kind naming no effect the library holds changes nothing; the audit names it (`unknownRefRule`).
 */

/** How many kinds one enemy may carry. */
export const MAX_ENEMY_KINDS = 2;

const has = (library, id) => !!library && typeof id === 'string' && Object.prototype.hasOwnProperty.call(library, id) && !!library[id];

/**
 * The kinds an enemy block carries that the library holds, as effect ids, each once, in the order
 * authored, at most {@link MAX_ENEMY_KINDS}. Anything else is skipped (the audit names it).
 * @param {object} enemy a Token's `enemy` block
 * @param {object|null} library the effect library by id
 * @returns {string[]}
 */
export function enemyKindsOf(enemy, library) {
    const raw = Array.isArray(enemy?.kinds) ? enemy.kinds : [];
    const out = [];
    for (const id of raw) {
        if (!has(library, id) || out.includes(id)) continue;
        out.push(id);
        if (out.length >= MAX_ENEMY_KINDS) break;
    }
    return out;
}
