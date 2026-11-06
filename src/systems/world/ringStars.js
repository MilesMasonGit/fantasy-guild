// which Guild Hall star opens each ring of the world map, and whether a ring is open (pure)

import { FIRST_STAR_RING, opensRingOf } from '../../config/hallStars.js';

/**
 * Ring 1 is open from the start (the tutorial settles there). From ring 2 outward a ring is settled
 * only once the guild holds a **ring star**: an authored Guild Hall star whose `opensRing` names
 * the ring, bought to its first rank (`hallStars.js`). One star per ring, the strict rings and each
 * wild ring alike.
 *
 * ⚠️ A ring no star opens is left open, as before ring stars existed: a sky that lost or never had
 * its star must not shut the guild in. The ledger's checks F say when a ring has none.
 *
 * Pure: the stars and the ranks are handed in. The CMS's ledger reads it too.
 */

/** The ring a star opens, or null for any other star. */
export function ringOfStar(star) {
    return opensRingOf(star?.opensRing);
}

/**
 * The ring stars of a sky by the ring each opens, in the sky's order: `Map<ring, star[]>`.
 *
 * @param {object[]} stars normalised stars (`hallStars.normaliseStar`)
 */
export function ringStarsOf(stars) {
    const out = new Map();
    for (const star of stars || []) {
        const ring = ringOfStar(star);
        if (ring === null) continue;
        if (!out.has(ring)) out.set(ring, []);
        out.get(ring).push(star);
    }
    return out;
}

/**
 * Why the guild may not settle ring `ring` yet, or null when it may: `{ ring, stars: [{ id, name }] }`,
 * the stars any one of which opens it. Ring 1 and below are always open; so is a ring no star opens.
 *
 * @param {number} ring
 * @param {object[]} stars normalised stars
 * @param {(starId: string) => number} rankOf the guild's rank in a star now
 */
export function ringLock(ring, stars, rankOf) {
    if (!(ring >= FIRST_STAR_RING)) return null;
    const opening = ringStarsOf(stars).get(ring) || [];
    if (!opening.length || opening.some(s => (Number(rankOf(s.id)) || 0) >= 1)) return null;
    return { ring, stars: opening.map(s => ({ id: s.id, name: s.name })) };
}
