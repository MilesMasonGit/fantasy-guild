import { useSyncExternalStore } from 'react';

/**
 * The Tokens lit while a support is in the hand (`SupportLinkLayer`): the ones it would help or be
 * helped by where it would land. Changed only when that set changes, so a Token redraws only as
 * it lights or goes out, never once a frame of the drag.
 */

let lit = new Set();
const listeners = new Set();

/** Light exactly these Token ids (an empty list puts every one out). */
export function setLit(ids) {
    const next = new Set(ids || []);
    if (next.size === lit.size && [...next].every(id => lit.has(id))) return;
    lit = next;
    for (const fn of listeners) fn();
}

export function isLit(id) {
    return lit.has(id);
}

export function subscribeLit(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Whether Token `id` is lit now; redraws its caller only when that answer changes. */
export function useSupportLit(id) {
    return useSyncExternalStore(subscribeLit, () => lit.has(id), () => false);
}
