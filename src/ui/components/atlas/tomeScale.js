// the Atlas book's scale, chosen by eye with QA → Atlas; remembered for the browser session

import { useSyncExternalStore } from 'react';
import { TOME_SCALES, DEFAULT_TOME_SCALE } from './tomeArt.js';

const KEY = 'fantasy_guild_dev_atlas_scale';
const listeners = new Set();

function stored() {
    try {
        const n = Number(sessionStorage.getItem(KEY));
        return TOME_SCALES.includes(n) ? n : DEFAULT_TOME_SCALE;
    } catch {
        return DEFAULT_TOME_SCALE;
    }
}

let scale = stored();

export function getTomeScale() {
    return scale;
}

/** Set the book's scale (2, 3 or 4); anything else is ignored. */
export function setTomeScale(next) {
    if (!TOME_SCALES.includes(next) || next === scale) return;
    scale = next;
    try { sessionStorage.setItem(KEY, String(next)); } catch { /* a convenience only */ }
    for (const fn of listeners) fn();
}

const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

export function useTomeScale() {
    return useSyncExternalStore(subscribe, getTomeScale, getTomeScale);
}
