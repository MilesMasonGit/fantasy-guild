// Which item the Bank's Item drawer shows. The Bank's list picks it; the drawer, a sibling of the
// Bank's panel on the screen's far side, draws it. A plain module store, so neither component has
// to hold the other.

import { useSyncExternalStore } from 'react';

/** The last item the player clicked in the Bank, kept for the session (the Bank closing keeps it). */
let lastPickedId = null;
/** What the drawer shows now: `{ id, count, template }`, or null for the calm empty state. */
let shown = null;
const listeners = new Set();

const emit = () => { for (const fn of [...listeners]) fn(); };

/** Remember a click on a Bank tile: the drawer shows this item while the Bank holds it. */
export function pickBankItem(id) {
    lastPickedId = id || null;
}

/** The last item clicked this session, or null. */
export function lastPickedBankItem() {
    return lastPickedId;
}

/**
 * The entry the drawer should show, from the Bank's stocked entries: the item picked while the
 * Bank still holds it, else the first item of the open tab, else null.
 */
export function chooseShownEntry(stocked, pickedId, firstOfTab) {
    const picked = pickedId ? stocked.find(e => e.id === pickedId) : null;
    return picked || firstOfTab || null;
}

/** Set by the Bank's list whenever what it would show changes. */
export function setShownBankEntry(entry) {
    const next = entry || null;
    if (next === shown) return;
    if (next && shown && next.id === shown.id && next.count === shown.count && next.template === shown.template) return;
    shown = next;
    emit();
}

const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
const snapshot = () => shown;

/** The entry the Item drawer shows, kept current. */
export function useShownBankEntry() {
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Tests only: forget the session's pick and what is shown. */
export function resetBankInspection() {
    lastPickedId = null;
    shown = null;
    emit();
}
