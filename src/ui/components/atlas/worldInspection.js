// What the world map's drawer shows. The map's screen picks the place and holds what is done with it;
// the drawer, in the screen-wide overlay beside the Bank's drawers, draws it. A plain module store,
// as the Bank's Item drawer's (`drawer/bankInspection.js`), so neither component has to hold the other.

import { useSyncExternalStore } from 'react';

/**
 * What the drawer draws, or null while the map shows no world: `{ cell, note, version, message,
 * onMessage, onSettle, onTravel }`, the screen's chosen `worldView()` cell and its handlers.
 */
let shown = null;
const listeners = new Set();

const emit = () => { for (const fn of [...listeners]) fn(); };

/** Set by the world map's screen whenever what its drawer shows changes. */
export function setWorldInspection(next) {
    if (next === shown) return;
    shown = next || null;
    emit();
}

const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
const snapshot = () => shown;

/** What the World Map drawer shows, kept current. */
export function useWorldInspection() {
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}
