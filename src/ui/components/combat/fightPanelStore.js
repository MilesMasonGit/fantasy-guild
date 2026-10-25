import { useSyncExternalStore } from 'react';

/**
 * Which hero's fight panel is open (one at a time), and where it was opened from: the fight chip's
 * rectangle on screen, which the panel stands beside. UI state only.
 */

let state = null;
const listeners = new Set();

function set(next) {
    state = next;
    for (const fn of [...listeners]) fn();
}

/**
 * Open the panel on `heroId`'s fight, beside `anchor` (a DOMRect-like `{left, top, right, bottom}`),
 * on its `away` side (-1 left, 1 right): the side away from the fight, so the fighters stay in view.
 */
export function openFightPanel(heroId, anchor = null, away = 1) {
    if (!heroId) return;
    const box = anchor ? { left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom } : null;
    set({ heroId, anchor: box, away: away === -1 ? -1 : 1 });
}

/** Close it. */
export function closeFightPanel() {
    if (state) set(null);
}

/** Open on this hero's fight, or closed when it already was. */
export function toggleFightPanel(heroId, anchor = null, away = 1) {
    if (state?.heroId === heroId) closeFightPanel();
    else openFightPanel(heroId, anchor, away);
}

export function fightPanelState() {
    return state;
}

function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** The open panel's `{ heroId, anchor }`, or null. */
export function useFightPanelState() {
    return useSyncExternalStore(subscribe, fightPanelState, fightPanelState);
}
