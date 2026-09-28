// Fantasy Guild — What is on the mat, by type (Token Lifecycle feedback B2.1, FB-31, SP-67)

import { ORIGIN, originOf } from './BoardState.js';

/**
 * ⭐ **The Token cap's hover summary** (FB-31): every Token on the mat, grouped
 * by type with counts, split the way the cap counts them (SP-67).
 *
 * * **Placed** Tokens are what `MatCap` counts. Each type carries how many of
 *   its copies are **blocked** (a live problem) and how many are **off**
 *   (disallowed, FP-35), so the popover can add a short red note.
 * * **Spawned** Tokens are listed apart, "not counted": their family's cap
 *   bounds them instead (SP-5).
 * * **The Guild Hall is in neither**: it is always there and never counts.
 * * **Binned** placed Tokens (B3.2, TL-13) are off the mat but still counted
 *   by `MatCap` until *Discard all*, so they get their own line, "counted",
 *   and the popover's total matches the badge. Spawned or Hall Tokens in the
 *   bin are not counted, as on the mat.
 *
 * Pure — the caller hands in the Tokens and every reader, so this can be
 * tested without a mat, and the UI decides what "blocked" means (the gear-only
 * rule lives beside the centre mark, `centreAlert.js`).
 *
 * ## Order
 * Most copies first; ties by name A→Z, then by type id, so the list never
 * shuffles between two refreshes of the same mat.
 *
 * @param {object[]} tokens  Token instances on the mat
 * @param {{
 *   nameOf: (typeId: string) => string,
 *   isGuildHall: (instance: object) => boolean,
 *   isBlocked?: (instance: object) => boolean,
 *   isOff?: (instance: object) => boolean,
 *   binned?: object[]
 * }} readers  `binned`: the Token instances in the discard bin (B3.2)
 * @returns {{
 *   placed: { count: number, groups: {typeId: string, name: string, count: number, blocked: number, off: number}[] },
 *   spawned: { count: number, groups: {typeId: string, name: string, count: number}[] },
 *   binned: { count: number }
 * }}
 */
export function summariseMat(tokens = [], { nameOf, isGuildHall, isBlocked = () => false, isOff = () => false, binned = [] } = {}) {
    const placed = new Map();
    const spawned = new Map();
    for (const t of tokens) {
        if (!t?.typeId || isGuildHall?.(t)) continue;
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
    const binnedCount = (binned || []).filter(t =>
        t?.typeId && !isGuildHall?.(t) && originOf(t) !== ORIGIN.SPAWNED
    ).length;
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
