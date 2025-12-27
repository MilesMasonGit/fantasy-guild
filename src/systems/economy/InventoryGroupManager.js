// Fantasy Guild - Inventory Group Manager
// Phase 18: Inventory UI

import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';

/**
 * InventoryGroupManager - Handles grouping logic for inventory items
 */
export const InventoryGroupManager = {

    /**
     * Get inventory items grouped by type (or category)
     * @returns {Array} Array of group objects { title, items }
     */
    getGroupedInventory() {
        const displayItems = InventoryManager.getDisplayInventory();
        const groups = {};

        // Predefine group order
        const groupOrder = ['Materials', 'Tools', 'Equipment', 'Consumables', 'Currency', 'Others'];

        // Initialize groups
        groupOrder.forEach(g => {
            groups[g] = [];
        });

        // Sort items into groups
        displayItems.forEach(item => {
            const groupName = this.getGroupName(item.type);

            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(item);
        });

        // Convert to array and filter empty groups
        return groupOrder.map(title => ({
            title,
            items: groups[title]
        })).filter(group => group.items.length > 0);
    },

    /**
     * Determine group name from item type
     * @param {string} type 
     * @returns {string}
     */
    getGroupName(type) {
        switch (type) {
            case 'material':
            case 'drop':
                return 'Materials';

            case 'tool':
                return 'Tools';

            case 'weapon':
            case 'armor':
                return 'Equipment';

            case 'food':
            case 'drink':
            case 'potion':
                return 'Consumables';

            case 'currency':
                return 'Currency'; // Or maybe display separately in header?

            default:
                return 'Others';
        }
    }
};
