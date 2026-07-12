import { useSyncExternalStore } from 'react';

/**
 * Dev-tunable banner card window width (task A7).
 *
 * The banner cards are the `md` tier (256px art). Their *height* is fixed by the
 * tier (256) but the *window width* — how much of the 256 scene the frame crops
 * to on the sides — is tuned live from the QA panel while we settle on the look.
 * Persisted to localStorage so it survives reloads during dev.
 *
 * Default 200px (owner decision 2026-07-09). Range clamped to a sane window.
 */
const KEY = 'dev.bannerCardWidth';
export const BANNER_WIDTH_DEFAULT = 200;
export const BANNER_WIDTH_MIN = 120;
export const BANNER_WIDTH_MAX = 256;

const clamp = (w) => Math.max(BANNER_WIDTH_MIN, Math.min(BANNER_WIDTH_MAX, Math.round(w)));

let width = (() => {
    try {
        const v = Number(localStorage.getItem(KEY));
        return Number.isFinite(v) && v > 0 ? clamp(v) : BANNER_WIDTH_DEFAULT;
    } catch {
        return BANNER_WIDTH_DEFAULT;
    }
})();

const listeners = new Set();

export function getBannerCardWidth() {
    return width;
}

export function setBannerCardWidth(w) {
    const next = clamp(w);
    if (next === width) return;
    width = next;
    try { localStorage.setItem(KEY, String(next)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook — re-renders the consumer whenever the QA slider changes the width. */
export function useBannerCardWidth() {
    return useSyncExternalStore(subscribe, getBannerCardWidth, getBannerCardWidth);
}
