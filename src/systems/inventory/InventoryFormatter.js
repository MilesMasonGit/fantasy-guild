import { InventoryStore } from './InventoryStore.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { warnMissingContent } from '../../utils/missingContent.js';

/** An item's sort key: its name, or its id when the template has no name. */
function sortKey(entry) {
    if (typeof entry.name === 'string' && entry.name.length > 0) return entry.name;
    warnMissingContent('InventoryFormatter', 'item name', entry.id,
        'the Bank sorts it by its id instead');
    return entry.id || '';
}

/**
 * InventoryFormatter - UI Display Logic and Caching for Inventory HUD.
 */
export const InventoryFormatter = {
    /** Cache for the final sorted display list */
    _displayCache: null,
    /** Cache for individual stable reference objects to prevent React re-renders */
    _itemReferenceMap: {},

    /**
     * Invalidate the sorted display list. Called whenever inventory changes.
     *
     * `_itemReferenceMap` is deliberately NOT cleared. It exists so that a
     * change to one stack does not change the object identity of every other
     * row, which is what stops React re-rendering the whole HUD; clearing it
     * here would throw that away on every pickup. Its entries are refreshed the
     * moment a stack's count changes, so the only thing it can hold stale is a
     * template field of an item whose count never moves — and nothing reloads
     * the item registry at runtime, so that cannot currently happen.
     */
    invalidate() {
        this._displayCache = null;
    },

    /**
     * Get formatted inventory for UI (with template data).
     * @returns {Array} [{ id, name, count, ... }]
     */
    getDisplayInventory() {
        if (this._displayCache !== null) {
            return this._displayCache;
        }

        const displayList = [];
        const items = InventoryStore.getItems();

        for (const [id, value] of Object.entries(items)) {
            const template = getItem(id);
            if (!template) {
                // Was a silent `continue` — a stack the player owns simply
                // vanished from the HUD with nothing said (CR2-107).
                warnMissingContent('InventoryFormatter', 'item', id,
                    'the stack is held in the save but cannot be shown in the Bank');
                continue;
            }

            const count = value.quantity;

            // PERFORMANCE: Reference Stability
            // Reuse the object if the count hasn't changed.
            const existing = this._itemReferenceMap[id];
            if (existing && existing.count === count) {
                displayList.push(existing);
            } else {
                const newItem = {
                    ...template,
                    id,
                    count
                };
                this._itemReferenceMap[id] = newItem;
                displayList.push(newItem);
            }
        }

        // Sorted by name, falling back to the id (CR2-107). `a.name` used to be
        // read straight, so a single template authored without a name threw
        // and took the whole Bank panel down with it. Content is authored
        // continuously and a half-finished item is a normal mid-authoring
        // state, so this warns and carries on rather than blocking.
        this._displayCache = displayList.sort(
            (a, b) => sortKey(a).localeCompare(sortKey(b))
        );
        return this._displayCache;
    }
};
