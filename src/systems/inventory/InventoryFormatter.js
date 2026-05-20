import { InventoryStore } from './InventoryStore.js';
import { getItem } from '../../config/registries/itemRegistry.js';

/**
 * InventoryFormatter - UI Display Logic and Caching for Inventory HUD.
 */
export const InventoryFormatter = {
    /** Cache for the final sorted display list */
    _displayCache: null,
    /** Cache for individual stable reference objects to prevent React re-renders */
    _itemReferenceMap: {},

    /**
     * Invalidate all display caches.
     * Should be called when inventory state changes.
     */
    invalidate() {
        this._displayCache = null;
    },

    /**
     * Get formatted inventory for UI (with template data).
     * @returns {Array} [{ id, name, count, durability?, maxDurability?, ... }]
     */
    getDisplayInventory() {
        if (this._displayCache !== null) {
            return this._displayCache;
        }

        const displayList = [];
        const items = InventoryStore.getItems();

        for (const [id, value] of Object.entries(items)) {
            const template = getItem(id);
            if (!template) continue;

            const count = value.quantity;
            const durability = value.dur;

            // PERFORMANCE: Reference Stability
            // Reuse object if the core values (count, durability) haven't changed.
            const existing = this._itemReferenceMap[id];
            if (existing && existing.count === count && existing.durability === durability) {
                displayList.push(existing);
            } else {
                const newItem = {
                    ...template,
                    id,
                    count,
                    durability,
                    maxDurability: template.maxDurability || null
                };
                this._itemReferenceMap[id] = newItem;
                displayList.push(newItem);
            }
        }

        this._displayCache = displayList.sort((a, b) => a.name.localeCompare(b.name));
        return this._displayCache;
    }
};
