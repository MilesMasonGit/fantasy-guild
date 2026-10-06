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
     * `_itemReferenceMap` is deliberately NOT cleared: it keeps each row's object
     * identity stable so React does not re-render the whole HUD on every pickup.
     * Its entries are refreshed when a stack's count changes.
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
                warnMissingContent('InventoryFormatter', 'item', id,
                    'the stack is held in the save but cannot be shown in the Bank');
                continue;
            }

            const count = value.quantity;

            // Reuse the object if the count hasn't changed, for reference stability.
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

        // Sorted by name, falling back to the id: a half-finished item without a
        // name is a normal mid-authoring state, so this warns rather than throwing
        // and taking the Bank panel down.
        this._displayCache = displayList.sort(
            (a, b) => sortKey(a).localeCompare(sortKey(b))
        );
        return this._displayCache;
    }
};
