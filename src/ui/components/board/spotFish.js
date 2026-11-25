import { poolBites } from '../../../config/registries/catchPools.js';
import { takesLure } from '../../../config/registries/toolKinds.js';
import { lureOf } from '../../../config/registries/fishRules.js';

/**
 * What a fishing spot can give, for its card's fish list and its hover bubble. Pure: the caller
 * hands in the pools that hold where the spot stands (`Fishing.poolsHere`), so a spot on a river
 * lists only its river fish.
 */

/** Every fish the pools can land, each once, in pool order. A pool that never bites lands none. */
export function spotFishIds(pools) {
    const ids = [];
    for (const pool of Array.isArray(pools) ? pools : []) {
        if (!poolBites(pool)) continue;
        for (const c of pool.catches) if (!ids.includes(c.itemId)) ids.push(c.itemId);
    }
    return ids;
}

/** The lures among `items` (an id-keyed table), each with the fish it names: `[{ itemId, fish }]`. */
export function luresIn(items) {
    const out = [];
    for (const [key, item] of Object.entries(items || {})) {
        const lure = lureOf(item);
        if (lure) out.push({ itemId: item?.id || key, fish: lure.fish });
    }
    return out;
}

/**
 * One row per fish the spot can give, in pool order: `{ itemId, tools, level, reachable, lures }`.
 * - `tools`: the tool kinds that catch it here, in pool order.
 * - `level`: the Fishing level a catch of it asks (`levelOf(itemId)`); `reachable` while the best
 *   hero's level (`best`) is at least that.
 * - `lures`: the lures that pick it, only where a lure-taking tool (a rod) catches it here: a lure
 *   picks nothing for a net or a Trap.
 */
export function spotFishRows(pools, { levelOf, best = 0, lures = [] }) {
    const rows = new Map();
    for (const pool of Array.isArray(pools) ? pools : []) {
        if (!poolBites(pool)) continue;
        for (const c of pool.catches) {
            let row = rows.get(c.itemId);
            if (!row) {
                const level = Number(levelOf(c.itemId)) || 1;
                row = { itemId: c.itemId, tools: [], level, reachable: (Number(best) || 0) >= level, lured: false };
                rows.set(c.itemId, row);
            }
            if (!row.tools.includes(pool.tool)) row.tools.push(pool.tool);
            if (takesLure(pool.tool)) row.lured = true;
        }
    }
    return [...rows.values()].map(({ lured, ...row }) => ({
        ...row,
        lures: lured ? lures.filter(l => l.fish.includes(row.itemId)).map(l => l.itemId) : []
    }));
}
