import { useSyncExternalStore } from 'react';

/**
 * The Controls strip's Find: what the mat is lighting, the one place it lives. A category button
 * lights while it is hovered; the search box lights while it holds text. A hovered category wins
 * over the box's text, and the text comes back when the pointer leaves.
 * UI state only: never saved, and cleared whenever the strip goes away (off the playmat).
 */
export const FIND_CATEGORY = Object.freeze({
    HEROES: 'heroes',
    TOKENS: 'tokens',
    ENEMIES: 'enemies',
    ITEMS: 'items'
});

const CATEGORIES = new Set(Object.values(FIND_CATEGORY));

let category = null;
let text = '';
/** The live find. A new object only when what is lit changes, so readers can compare by identity. */
let current = null;
const listeners = new Set();

function changed() {
    const query = text.trim();
    const next = category ? { category } : (query ? { text: query } : null);
    if (next?.category !== current?.category || next?.text !== current?.text) current = next;
    listeners.forEach((l) => l());
}

/** What is lit: `{ category }`, `{ text }` (trimmed, never empty) or null. */
export function getMatFind() {
    return current;
}

/** A category button hovered, or null as the pointer leaves. */
export function setFindCategory(next) {
    category = CATEGORIES.has(next) ? next : null;
    changed();
}

/** The search box's text, as typed. */
export function setFindText(next) {
    text = typeof next === 'string' ? next : '';
    changed();
}

/** The box's text as typed. */
export function getFindText() {
    return text;
}

/** Nothing lit: no category, an empty box. */
export function clearMatFind() {
    category = null;
    text = '';
    changed();
}

/** Hear the find or the box's text change. Returns the undo. */
export function subscribeMatFind(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook: what is lit, re-rendering the consumer only when that changes. */
export function useMatFind() {
    return useSyncExternalStore(subscribeMatFind, getMatFind, getMatFind);
}

/** React hook: the box's text as typed. */
export function useFindText() {
    return useSyncExternalStore(subscribeMatFind, getFindText, getFindText);
}
