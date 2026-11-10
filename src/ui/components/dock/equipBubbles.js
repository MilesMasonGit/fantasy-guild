import { useSyncExternalStore } from 'react';

/**
 * What an equip drop said, as a speech bubble over that hero on the hero bar: one per hero (a
 * newer one replaces it), fading out by itself after {@link EQUIP_BUBBLE_MS}. `tone` is a
 * `SPEECH_TONE`: plain for an item equipped, CANT for a refusal.
 * UI memory only: never saved.
 */

/** How long a bubble stands, its fade included. */
export const EQUIP_BUBBLE_MS = 3000;

/** The fade at the end of its time. */
export const EQUIP_BUBBLE_FADE_MS = 250;

let byHero = new Map();
let nextKey = 1;
const timers = new Map();
const listeners = new Set();

function emit() {
    for (const l of listeners) l();
}

function set(heroId, bubble) {
    byHero = new Map(byHero);
    if (bubble) byHero.set(heroId, bubble);
    else byHero.delete(heroId);
    emit();
}

function stopTimers(heroId) {
    for (const id of timers.get(heroId) || []) clearTimeout(id);
    timers.delete(heroId);
}

/** Say `text` over `heroId` on the bar, replacing what they said before. */
export function announceEquip(heroId, text, tone) {
    if (!heroId || !text) return;
    stopTimers(heroId);
    const key = nextKey++;
    set(heroId, { key, text, tone, fading: false });
    const fade = setTimeout(() => {
        const b = byHero.get(heroId);
        if (b?.key === key) set(heroId, { ...b, fading: true });
    }, EQUIP_BUBBLE_MS - EQUIP_BUBBLE_FADE_MS);
    const gone = setTimeout(() => {
        timers.delete(heroId);
        if (byHero.get(heroId)?.key === key) set(heroId, null);
    }, EQUIP_BUBBLE_MS);
    timers.set(heroId, [fade, gone]);
}

/** One hero's bubble, or null. */
export const equipBubbleOf = (heroId) => byHero.get(heroId) || null;

/** Clear every bubble. */
export function clearEquipBubbles() {
    for (const heroId of [...timers.keys()]) stopTimers(heroId);
    if (byHero.size === 0) return;
    byHero = new Map();
    emit();
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** One hero's bubble, re-rendering only when it changes. */
export function useEquipBubble(heroId) {
    return useSyncExternalStore(subscribe, () => equipBubbleOf(heroId), () => null);
}
