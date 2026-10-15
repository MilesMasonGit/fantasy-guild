/**
 * Where the hero working each Token has a stack of speech bubbles up, so the Token's callouts
 * can sit on top of it instead of drawing over it. `HeroBubbleLayer` writes, `CalloutLayer`
 * reads. The hero's stack never moves for a callout: it is the long-lived one and already laid
 * out against the other heroes and the mat's edges, while a callout is up for two seconds and
 * drifts upward as it fades, away from the stack beneath it.
 */

/** The space between two stacked bubbles: Tailwind `gap-1`, as both layers use. */
export const STACK_GAP_PX = 4;

/** Token id → `{x, top}`: the centre and top edge of its hero's stack, mat units. */
let columns = new Map();
let columnsKey = '';
let version = 0;
const listeners = new Set();

/**
 * The hero stacks standing at a Token, as just laid out. Listeners hear only a real change.
 * @param {{tokenId: string, x: number, top: number}[]} list
 */
export function publishHeroColumns(list) {
    const key = list.map(c => `${c.tokenId}@${c.x},${c.top}`).join('|');
    if (key === columnsKey) return;
    columnsKey = key;
    columns = new Map(list.map(c => [c.tokenId, { x: c.x, top: c.top }]));
    version += 1;
    for (const fn of listeners) fn();
}

/** The hero stack over Token `tokenId`, or null. */
export function heroColumnAt(tokenId) {
    return columns.get(tokenId) ?? null;
}

/** Counts the changes: a snapshot for `useSyncExternalStore`. */
export function heroColumnsVersion() {
    return version;
}

/** Hear every change; returns the unsubscribe. */
export function subscribeHeroColumns(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * Where a group of callouts goes: on top of the hero's column when there is one (centred on
 * it, its bottom edge the standard gap above the column's top), otherwise its own place.
 * @param {{x: number, top: number}} own  centre and bottom edge, over the Token
 * @param {{x: number, top: number}|null} column
 * @returns {{x: number, top: number}} centre and bottom edge
 */
export function columnPlace(own, column) {
    if (!column) return own;
    return { x: column.x, top: column.top - STACK_GAP_PX };
}
