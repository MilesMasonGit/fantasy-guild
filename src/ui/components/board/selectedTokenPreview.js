import { useSyncExternalStore } from 'react';

/**
 * What a selected Token's preview at the pointer says (`SelectedTokenHints`), for the reach ring
 * (`MatRings`): null while it shows nothing (the pointer off the mat, or nothing selected), else
 * `{ landing }`, where the Token would land if right-clicked there (`{ x, y, typeId, id }`, or null
 * when it would be refused for want of room). Written only when it changes.
 */
let preview = null;
const listeners = new Set();

const same = (a, b) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.id === b.id && a.typeId === b.typeId);

/** Show the preview with `landing` (null: no spot), or put it out with `on` false. */
export function setTokenPreview(on, landing = null) {
    if (!on) {
        if (!preview) return;
        preview = null;
    } else {
        if (preview && same(preview.landing, landing)) return;
        preview = { landing };
    }
    for (const fn of listeners) fn();
}

export function getTokenPreview() {
    return preview;
}

function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** React: the preview, redrawn only when it changes. */
export function useTokenPreview() {
    return useSyncExternalStore(subscribe, getTokenPreview, getTokenPreview);
}
