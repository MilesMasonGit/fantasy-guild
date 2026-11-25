// An item's coin worth: what one copy sells for from the Bank
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the item
// editor's Coin worth field and the audit read it. Pure, with no imports.

/**
 * `coinWorth` on an item: the whole number of coins one copy sells for (`systems/inventory/Coins.js`).
 * Absent, it sells for 0: selling it only clears the Bank, as Discard did.
 */

/** A written `coinWorth` as a whole number of 0 or more, or null when it is not one. */
function worthValue(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

/** The coins one copy of this item sells for: its `coinWorth` when a whole number of 0 or more, else 0. */
export function coinWorthOf(item) {
    if (!item || item.coinWorth == null) return 0;
    return worthValue(item.coinWorth) ?? 0;
}

/** The coins `count` copies sell for. */
export function stackWorth(item, count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    return coinWorthOf(item) * n;
}

/**
 * Why an item's `coinWorth` is not read, or null when it is (or is absent): a value that is not a
 * whole number of 0 or more. For the boot audit and the CMS Economy Audit.
 */
export function coinWorthProblem(item) {
    if (!item || item.coinWorth == null) return null;
    if (worthValue(item.coinWorth) == null) {
        return `its Coin worth "${item.coinWorth}" is not a whole number of 0 or more, so it sells for nothing`;
    }
    return null;
}

/** Every item whose `coinWorth` is not read: `{ entityType: 'Item', entityId, entityName, message }`. */
export function coinWorthFindings({ items = {} } = {}) {
    const out = [];
    for (const [id, item] of Object.entries(items || {})) {
        const message = coinWorthProblem(item);
        if (message) out.push({ entityType: 'Item', entityId: item?.id || id, entityName: item?.name || id, message });
    }
    return out;
}
