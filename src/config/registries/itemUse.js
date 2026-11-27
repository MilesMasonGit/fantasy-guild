// An item's Use: what using it from the Bank gives, at once, with no hero (a leaf module)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (the item editor, the ledger, the audits).
// Pure, with no imports.

/**
 * `use: { drops: [{ itemId, chance, minQty, maxQty }] }` on an item. Each copy used rolls every line
 * as a work cycle rolls its outputs: its `chance` (percent, 100 when absent), then a whole number
 * from `minQty` to `maxQty` (both 1 when absent). The engine is `systems/inventory/ItemUse.js`.
 *
 * A line naming no item, with a chance of 0 or less, or with nothing in its range is no drop. An
 * item whose Use keeps no drop has no Use: the Bank offers none and the ledger reads none.
 *
 * Read per item and kept (a `WeakMap` on the definition object), as `rareTables.js` does.
 */

const cache = new WeakMap();

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const whole = (v, fallback) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
};

function normalise(raw) {
    const lines = raw && typeof raw === 'object' && Array.isArray(raw.drops) ? raw.drops : [];
    return Object.freeze(lines
        .map((line) => {
            const n = Number(line?.chance);
            const chance = line?.chance == null || line.chance === '' ? 100 : (Number.isFinite(n) ? Math.min(100, n) : 0);
            const min = whole(line?.minQty ?? line?.quantity, 1);
            const max = whole(line?.maxQty ?? line?.quantity, min);
            return { itemId: text(line?.itemId), chance, minQty: Math.min(min, max), maxQty: Math.max(min, max) };
        })
        .filter((line) => line.itemId && line.chance > 0 && line.maxQty > 0)
        .map((line) => Object.freeze(line)));
}

/** The drops of an item's Use, in authored order (`[]` for an item with none). */
export function itemUseDropsOf(item) {
    if (!item || typeof item !== 'object' || !item.use) return [];
    let drops = cache.get(item);
    if (drops === undefined) {
        drops = normalise(item.use);
        cache.set(item, drops);
    }
    return drops;
}

/** Whether an item can be used from the Bank: its Use keeps at least one drop. */
export function hasUse(item) {
    return itemUseDropsOf(item).length > 0;
}

const USE_SOURCE = 'use:';

/**
 * The id the CMS's Recalculate gives an item's Use as a source, so an item whose price comes from
 * using another carries it as its `valueSource` (`use:item_bird_nest`). Prefixed, because an item
 * id is not kept apart from Token and recipe ids.
 */
export function itemUseSourceId(itemId) {
    return `${USE_SOURCE}${itemId}`;
}

/** The item an `itemUseSourceId` names, or null when `sourceId` names no Use. */
export function usedItemOfSource(sourceId) {
    return typeof sourceId === 'string' && sourceId.startsWith(USE_SOURCE) && sourceId.length > USE_SOURCE.length
        ? sourceId.slice(USE_SOURCE.length)
        : null;
}

/**
 * Why an item's authored Use gives nothing, or null when it gives something (or none is written):
 * a `use` whose every line names no item, has no chance, or no amount. For the boot audit and the
 * CMS Economy Audit.
 */
export function itemUseProblem(item) {
    if (!item || typeof item !== 'object' || item.use == null) return null;
    if (hasUse(item)) return null;
    return 'its Use gives nothing: no drop names an item with a chance and an amount above 0, so the Bank offers no Use';
}
