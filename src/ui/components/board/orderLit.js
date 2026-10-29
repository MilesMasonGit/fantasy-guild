import { useSyncExternalStore } from 'react';

/**
 * The Tokens a hero's order lights on the mat:
 * - **workable**, while a hero is carried: every Token they could be ordered onto, in the green
 * "ready" outline (`OrderLighting`), so the player sees where a drop works before letting go;
 * - **job**, while a hero or their roster tab is hovered (or their sheet is open): the Token their
 * order names, in the white hover outline.
 * Changed only when a set changes, so a Token redraws only as it lights or goes out.
 */

let workable = new Set();
let job = null;
const listeners = new Set();

function emit() {
    for (const fn of listeners) fn();
}

function sameSet(a, b) {
    return a.size === b.size && [...a].every(id => b.has(id));
}

/** Light exactly these Token ids as workable (an empty list puts every one out). */
export function setWorkable(ids) {
    const next = new Set(ids || []);
    if (sameSet(next, workable)) return;
    workable = next;
    emit();
}

/** Light one Token as the hovered hero's job, or none with null. */
export function setJob(id) {
    const next = id || null;
    if (next === job) return;
    job = next;
    emit();
}

/** What Token `id` is lit as: `'job'`, `'workable'` or null. */
export function orderLitOf(id) {
    if (id && id === job) return 'job';
    return workable.has(id) ? 'workable' : null;
}

export function subscribeOrderLit(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Token `id`'s order light; redraws its caller only when that answer changes. */
export function useOrderLit(id) {
    return useSyncExternalStore(subscribeOrderLit, () => orderLitOf(id), () => null);
}

/**
 * The hero whose roster tab the pointer is on, or null: the mat outlines that hero and lights
 * their job as it does for a hero hovered on the mat.
 */
let rosterHover = null;
const rosterListeners = new Set();

export function setRosterHover(heroId) {
    const next = heroId || null;
    if (next === rosterHover) return;
    rosterHover = next;
    for (const fn of rosterListeners) fn();
}

function subscribeRosterHover(fn) {
    rosterListeners.add(fn);
    return () => rosterListeners.delete(fn);
}

export function useRosterHover() {
    return useSyncExternalStore(subscribeRosterHover, () => rosterHover, () => null);
}
