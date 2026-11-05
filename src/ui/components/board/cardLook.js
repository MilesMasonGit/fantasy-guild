import { useSyncExternalStore } from 'react';

/**
 * The Token card's layouts on trial, picked from the QA panel so the owner can compare them in the
 * running game. Sizes are in screen pixels. Once one is chosen this file can shrink to that one
 * entry.
 * - banner: the art in a strip across the top, the name on its lower edge, a solid panel below.
 * - cover: the art behind the whole card, a window of it between the name and a see-through panel.
 * - side: the art in a column down the left, name and panel to its right.
 */
export const CARD_LOOKS = Object.freeze({
    banner: Object.freeze({ id: 'banner', label: 'A: art strip on top', art: 'banner', width: 320, plainWidth: 320, artHeight: 160 }),
    cover: Object.freeze({ id: 'cover', label: 'B: art behind everything', art: 'cover', width: 320, plainWidth: 320, artGap: 96 }),
    side: Object.freeze({ id: 'side', label: 'C: art column at the side', art: 'side', width: 480, plainWidth: 320, artWidth: 176 })
});

let current = CARD_LOOKS.banner;
const listeners = new Set();

export const getCardLook = () => current;

export function setCardLook(id) {
    const next = CARD_LOOKS[id];
    if (!next || next === current) return;
    current = next;
    for (const listener of listeners) listener();
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export const useCardLook = () => useSyncExternalStore(subscribe, getCardLook);
