// asking a Token's card to open on its recipe list

/**
 * Something outside the card (the mat's recipe gear) can ask for a Token's card to show its
 * recipe list. The card may not be open yet, so the ask waits here until that Token's card mounts
 * and takes it; a card already open hears it at once.
 */

let pending = null;
const listeners = new Set();

/** Ask the card for this Token to show its recipe list. */
export function requestRecipeList(instanceId) {
    if (instanceId == null) return;
    pending = instanceId;
    for (const fn of [...listeners]) fn(instanceId);
}

/** Whether a waiting ask is for this Token; taking it clears it. */
export function takeRecipeListRequest(instanceId) {
    if (instanceId == null || pending !== instanceId) return false;
    pending = null;
    return true;
}

/** Hear asks as they come. Returns the unsubscribe. */
export function onRecipeListRequest(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
