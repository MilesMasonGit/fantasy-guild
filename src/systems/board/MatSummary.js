// what is on the mat, by type

import { ORIGIN, originOf } from './BoardState.js';

/**
 * The Token cap's hover summary: every Token on the mat grouped by type with counts.
 *
 * Placed Tokens carry how many copies are blocked and how many are off. Spawned Tokens are listed
 * apart. Both count toward `MatCap`; what `isExcluded` names (the Guild Hall, quests) is in
 * neither. Binned Tokens still count in `MatCap` until Discard all, so they get their own line.
 *
 * Pure: the caller hands in the Tokens and every reader. Order: most copies first, ties by name
 * then type id, so the list never shuffles between refreshes.
 *
 * @param {object[]} tokens  Token instances on the mat
 * @param {{
 *   nameOf: (typeId: string) => string,
 *   isExcluded: (instance: object) => boolean,
 *   isBlocked?: (instance: object) => boolean,
 *   isOff?: (instance: object) => boolean,
 *   binned?: object[]
 * }} readers  `binned`: the Token instances in the discard bin
 * @returns {{
 *   placed: { count: number, groups: {typeId: string, name: string, count: number, blocked: number, off: number}[] },
 *   spawned: { count: number, groups: {typeId: string, name: string, count: number}[] },
 *   binned: { count: number }
 * }}
 */
export function summariseMat(tokens = [], { nameOf, isExcluded, isBlocked = () => false, isOff = () => false, binned = [] } = {}) {
    const placed = new Map();
    const spawned = new Map();
    for (const t of tokens) {
        if (!t?.typeId || isExcluded?.(t)) continue;
        const bucket = originOf(t) === ORIGIN.SPAWNED ? spawned : placed;
        let g = bucket.get(t.typeId);
        if (!g) {
            g = { typeId: t.typeId, name: nameOf ? nameOf(t.typeId) : t.typeId, count: 0, blocked: 0, off: 0 };
            bucket.set(t.typeId, g);
        }
        g.count++;
        if (bucket === placed) {
            if (isOff(t)) g.off++;
            // A disallowed Token is "off", not also "blocked": nobody works it.
            else if (isBlocked(t)) g.blocked++;
        }
    }
    const order = (a, b) => (b.count - a.count) || a.name.localeCompare(b.name) || a.typeId.localeCompare(b.typeId);
    const total = (groups) => groups.reduce((n, g) => n + g.count, 0);
    const placedGroups = [...placed.values()].sort(order);
    const spawnedGroups = [...spawned.values()].sort(order).map(({ typeId, name, count }) => ({ typeId, name, count }));
    const binnedCount = (binned || []).filter(t => t?.typeId && !isExcluded?.(t)).length;
    return {
        placed: { count: total(placedGroups), groups: placedGroups },
        spawned: { count: total(spawnedGroups), groups: spawnedGroups },
        binned: { count: binnedCount }
    };
}

/** The short red note for one placed type — `1 blocked`, `2 off`, both, or null. */
export function groupNote(group) {
    const parts = [];
    if (group?.blocked > 0) parts.push(`${group.blocked} blocked`);
    if (group?.off > 0) parts.push(`${group.off} off`);
    return parts.length ? parts.join(', ') : null;
}

/** One type with its count, as the popover writes it: `Oak Forest ×2`. */
export function groupLabel(group) {
    return `${group.name} ×${group.count}`;
}
