// Fantasy Guild - the first kill of an enemy type: its first-kill drop lines land for certain

import { GameState } from '../../state/GameState.js';

/**
 * A drop line marked `firstKill: true` (the CMS's "First kill always drops") lands for certain the
 * first time the save kills that enemy type, and at its own chance after. The save remembers each
 * type paid in `collection.firstKillDrops` (`{ [enemyId]: true }`), written only once one is paid,
 * so a save from before the record, or from before the line was marked, has been paid nothing yet.
 * ⚠️ Not the Bestiary's kill counts: an old save's kills must not use up the guarantee.
 */

/** Whether the save has been paid `enemyId`'s first-kill drops. */
export function hasPaid(enemyId) {
    return GameState.state?.collection?.firstKillDrops?.[enemyId] === true;
}

/** Record that `enemyId`'s first-kill drops were paid. */
export function markPaid(enemyId) {
    const collection = GameState.state?.collection;
    if (!collection || !enemyId) return;
    (collection.firstKillDrops ||= {})[enemyId] = true;
}

/** Whether a kill of `enemyId` with this drop list is owed its first-kill lines. */
export function isOwed(enemyId, drops) {
    return !!enemyId && Array.isArray(drops) && drops.some(d => d?.firstKill === true) && !hasPaid(enemyId);
}
