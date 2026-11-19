/**
 * The Bank's tabs as a pure layout over the saved inventory (`groupOrder`, `groupDefs`,
 * `itemOverrides`): which tab each item is filed in and the order a tab shows. The engine counts
 * a tab's slots by it and the Bank pane draws by it, so the two cannot disagree.
 */

export { BANK_TAB_SLOTS, BANK_TAB_CAP } from '../../config/guildUpgrades.js';

/** The tab an item is filed in: its override when that tab exists, else the first tab. */
export function homeTabOf(inv, itemId) {
    const order = inv?.groupOrder || [];
    const target = inv?.itemOverrides?.[itemId];
    return target && order.includes(target) ? target : order[0];
}

/**
 * Each tab's items in the order it shows them: the tab's manual order first, then the rest in
 * the order `itemIds` lists them. `itemIds`: the items to lay out (the Bank's, by default).
 * @returns {Record<string, string[]>}
 */
export function bankTabLayout(inv, itemIds = Object.keys(inv?.items || {})) {
    const order = inv?.groupOrder || [];
    const layout = Object.fromEntries(order.map(id => [id, []]));
    const present = new Set(itemIds);
    const placed = new Set();
    for (const gid of order) {
        for (const itemId of inv.groupDefs?.[gid]?.orderedItems || []) {
            if (present.has(itemId) && !placed.has(itemId) && homeTabOf(inv, itemId) === gid) {
                layout[gid].push(itemId);
                placed.add(itemId);
            }
        }
    }
    for (const itemId of itemIds) {
        if (!placed.has(itemId)) layout[homeTabOf(inv, itemId)]?.push(itemId);
    }
    return layout;
}

/**
 * A tab's new manual order: `given`, with each id of `previous` it leaves out (out of stock or
 * hidden, so not shown) put back after the id it followed, so an item that runs out keeps its place.
 * @returns {string[]}
 */
export function mergeTabOrder(previous, given) {
    const listed = new Set(given);
    const seen = new Set();
    const head = [];
    const after = new Map();
    let anchor = null;
    for (const id of previous || []) {
        if (listed.has(id)) { anchor = id; continue; }
        if (seen.has(id)) continue;
        seen.add(id);
        if (anchor == null) head.push(id);
        else if (after.has(anchor)) after.get(anchor).push(id);
        else after.set(anchor, [id]);
    }
    const out = [...head];
    for (const id of given) {
        out.push(id);
        const followers = after.get(id);
        if (followers) { out.push(...followers); after.delete(id); }
    }
    return out;
}

/**
 * `ids` with `sourceId` moved to `targetId`'s place, as the hero bar reorders heroes: a forward
 * move lands where the target was, not one short of it.
 * @returns {string[]}
 */
export function reorderTabIds(ids, sourceId, targetId) {
    const to = ids.indexOf(targetId);
    if (to === -1 || sourceId === targetId || !ids.includes(sourceId)) return [...ids];
    const next = ids.filter(id => id !== sourceId);
    next.splice(to, 0, sourceId);
    return next;
}

/** How many item kinds each tab holds. @returns {Map<string, number>} */
export function bankTabCounts(inv, itemIds = Object.keys(inv?.items || {})) {
    const counts = new Map((inv?.groupOrder || []).map(id => [id, 0]));
    for (const itemId of itemIds) {
        const home = homeTabOf(inv, itemId);
        if (counts.has(home)) counts.set(home, counts.get(home) + 1);
    }
    return counts;
}
