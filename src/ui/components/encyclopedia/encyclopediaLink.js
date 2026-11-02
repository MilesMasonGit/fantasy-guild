// "look it up": a link from anywhere to one Encyclopedia entry

import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { itemKey, tokenKey, recipeKey } from '../../../systems/progression/ledger/engine.js';

let pending = null;
const listeners = new Set();

/**
 * Open the Encyclopedia at `key` (a ledger key: `item:<id>`, `token:<id>`, `recipe:<id>`). The
 * screen takes the entry when it opens ({@link takeLookUp}); one already open moves to it.
 */
export function lookUp(key) {
    if (typeof key !== 'string' || !key) return;
    pending = key;
    for (const fn of [...listeners]) fn(key);
    EventBus.publish(UI_EVENTS.OPEN_ENCYCLOPEDIA, { key });
}

/** {@link lookUp} from a ribbon's `onInspect(kind, id)`: `kind` is 'item' or 'token' (an enemy is a Token). */
export function lookUpRibbon(kind, id) {
    if (!id) return;
    lookUp(kind === 'token' ? tokenKey(id) : itemKey(id));
}

export const lookUpItem = (id) => lookUp(itemKey(id));
export const lookUpToken = (id) => lookUp(tokenKey(id));
export const lookUpRecipe = (id) => lookUp(recipeKey(id));

/** The entry asked for and not yet shown, once: null when there is none. */
export function takeLookUp() {
    const key = pending;
    pending = null;
    return key;
}

/** Whether the Encyclopedia is open: only the open screen listens for look-ups. */
export const isEncyclopediaOpen = () => listeners.size > 0;

/** Hear every look-up while the screen is open; returns the unsubscribe. */
export function onLookUp(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
