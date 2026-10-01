import { useSyncExternalStore } from 'react';

/**
 * ⭐ **CR3-402** (round 3 review R7, owner ruling: "while the Bank is open,
 * the playmat cannot be interacted with at all — the Bank covers it").
 *
 * Mirrors `useDisallowMode.js`'s shape on purpose: a tiny external store so
 * `AlphaPointerSensor` (outside React, a plain class) can ask the same
 * question the mat's own drop target asks. `ReactRoot` is the only writer,
 * kept in step with `ui.drawer.panes.includes('bank')`.
 *
 * Two call sites enforce it:
 * - `AlphaPointerSensor`'s activator refuses a press inside
 *   `[data-board-origin]` while this is on, the same way disallow mode does —
 *   so no Token, flag or hero drag can START from the mat.
 * - `Board.jsx`'s `matAccepts` refuses every payload while this is on, so
 *   dnd-kit never calls the mat's `onDrop` — nothing can land there either,
 *   including a Token or flag dragged from elsewhere.
 *
 * UI state only: never saved, and it is the Bank drawer's open/closed state,
 * not a mode the player toggles directly.
 */
let locked = false;
const listeners = new Set();

export function isMatBankLocked() {
    return locked;
}

export function setMatBankLocked(next) {
    const value = !!next;
    if (value === locked) return;
    locked = value;
    listeners.forEach((l) => l());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook — re-renders the consumer when the Bank opens or closes. */
export function useMatBankLocked() {
    return useSyncExternalStore(subscribe, isMatBankLocked, isMatBankLocked);
}
