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

/** How many item kinds each tab holds. @returns {Map<string, number>} */
export function bankTabCounts(inv, itemIds = Object.keys(inv?.items || {})) {
    const counts = new Map((inv?.groupOrder || []).map(id => [id, 0]));
    for (const itemId of itemIds) {
        const home = homeTabOf(inv, itemId);
        if (counts.has(home)) counts.set(home, counts.get(home) + 1);
    }
    return counts;
}
