// Fantasy Guild - Inventory Group Manager
// Phase 18: Inventory UI

import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';

/**
 * InventoryGroupManager - Handles grouping logic for inventory items
 */
export const InventoryGroupManager = {

    /**
     * Get inventory items grouped by type (or category)
     * @returns {Array} Array of group objects { title, items, isCustom, id }
     */
    getGroupedInventory() {
        // Initialize missing arrays/objects on older saves safely
        // Initialize missing arrays/objects on older saves safely
        if (!GameState.inventory.groupOrder) GameState.inventory.groupOrder = [];
        if (!GameState.inventory.groupDefs) GameState.inventory.groupDefs = {};
        if (!GameState.inventory.itemOverrides) GameState.inventory.itemOverrides = {};

        // 1. Ensure Defaults Exist in Definitions
        const defaultGroupTitles = ['Materials', 'Tools', 'Equipment', 'Consumables', 'Currency', 'Others'];

        // Populate missing defaults
        defaultGroupTitles.forEach(title => {
            const id = `default-${title.toLowerCase()}`;
            if (!GameState.inventory.groupDefs[id]) {
                GameState.inventory.groupDefs[id] = { title, isCustom: false, id, orderedItems: [] };
                if (!GameState.inventory.groupOrder.includes(id)) {
                    GameState.inventory.groupOrder.push(id);
                }
            }
        });

        const displayItems = InventoryManager.getDisplayInventory();
        const groups = {};

        // 2. Initialize group buckets based on exactly what is in groupOrder
        GameState.inventory.groupOrder.forEach(id => {
            const def = GameState.inventory.groupDefs[id];
            if (def) {
                // Ensure orderedItems exists for older saves
                if (!def.orderedItems) def.orderedItems = [];
                groups[id] = { ...def, items: [], _itemMap: {} };
            }
        });

        // 3. Sort items into buckets
        const overrides = GameState.inventory.itemOverrides;

        displayItems.forEach(item => {
            // Check override first
            const overrideGroupId = overrides[item.id];

            if (overrideGroupId && groups[overrideGroupId]) {
                groups[overrideGroupId]._itemMap[item.id] = item;
                // If it isn't in orderedItems yet, push it
                if (!groups[overrideGroupId].orderedItems.includes(item.id)) {
                    groups[overrideGroupId].orderedItems.push(item.id);
                }
                return;
            }

            // Fallback to default calculated group
            const groupName = this.getGroupName(item.type);
            const fallbackId = `default-${groupName.toLowerCase()}`;

            if (groups[fallbackId]) {
                groups[fallbackId]._itemMap[item.id] = item;
                if (!groups[fallbackId].orderedItems.includes(item.id)) {
                    groups[fallbackId].orderedItems.push(item.id);
                }
            } else {
                // Extreme failsafe if default group somehow missing from order/defs
                if (!groups['default-others']) {
                    groups['default-others'] = { title: 'Others', isCustom: false, id: 'default-others', items: [], _itemMap: {}, orderedItems: [] };
                }
                groups['default-others']._itemMap[item.id] = item;
                if (!groups['default-others'].orderedItems.includes(item.id)) {
                    groups['default-others'].orderedItems.push(item.id);
                }
            }
        });

        // Sort items into the final 'items' array based on 'orderedItems' keys
        Object.values(groups).forEach(group => {
            group.orderedItems.forEach(itemId => {
                if (group._itemMap[itemId]) {
                    group.items.push(group._itemMap[itemId]);
                }
            });
            // Cleanup temporary map
            delete group._itemMap;
        });

        // 4. Convert back to ordered array and filter empties (unless custom)
        const finalGroups = [];

        GameState.inventory.groupOrder.forEach(id => {
            const group = groups[id];
            if (group) {
                // Keep if it has items OR if it's a custom group
                if (group.items.length > 0 || group.isCustom) {
                    finalGroups.push(group);
                }
            }
        });

        return finalGroups;
    },

    /**
     * Create a new custom inventory group
     * @param {string} name 
     */
    createGroup(name) {
        if (!name || name.trim() === '') return false;

        const id = 'custom-' + Date.now();
        const cleanName = name.trim();

        // Ensure state exists
        if (!GameState.inventory.groupOrder) GameState.inventory.groupOrder = [];
        if (!GameState.inventory.groupDefs) GameState.inventory.groupDefs = {};

        // Add to definitions
        GameState.inventory.groupDefs[id] = {
            title: cleanName,
            isCustom: true,
            id: id,
            orderedItems: []
        };

        // Insert at the VERY TOP of the order, before any defaults
        GameState.inventory.groupOrder.unshift(id);

        EventBus.publish('inventory_updated');
        return id;
    },

    /**
     * Rename a custom group
     * @param {string} groupId 
     * @param {string} newName 
     */
    renameGroup(groupId, newName) {
        if (!newName || newName.trim() === '') return false;

        const def = GameState.inventory.groupDefs?.[groupId];
        if (def && def.isCustom) {
            def.title = newName.trim();
            EventBus.publish('inventory_updated');
            return true;
        }
        return false;
    },

    /**
     * Delete a custom group and return items to default groups
     * @param {string} groupId 
     */
    deleteGroup(groupId) {
        const orderIndex = GameState.inventory.groupOrder?.indexOf(groupId);
        if (orderIndex !== undefined && orderIndex !== -1) {
            // Remove from order
            GameState.inventory.groupOrder.splice(orderIndex, 1);

            // Remove from defs
            delete GameState.inventory.groupDefs[groupId];

            // Remove overrides for items in this group
            if (GameState.inventory.itemOverrides) {
                for (const itemId in GameState.inventory.itemOverrides) {
                    if (GameState.inventory.itemOverrides[itemId] === groupId) {
                        delete GameState.inventory.itemOverrides[itemId];
                    }
                }
            }

            EventBus.publish('inventory_updated');
            return true;
        }
        return false;
    },

    /**
     * Move an item to a specific group, and optionally insert it at a specific index
     * @param {string} itemId 
     * @param {string} groupId 
     * @param {number} [targetIndex] Optional specific index to insert at
     */
    moveItemToGroup(itemId, groupId, targetIndex = -1) {
        if (!GameState.inventory.itemOverrides) {
            GameState.inventory.itemOverrides = {};
        }

        const oldGroupId = GameState.inventory.itemOverrides[itemId];

        // 1. Remove from old group's ordered array if it was explicitly placed
        if (oldGroupId && GameState.inventory.groupDefs[oldGroupId]) {
            const oldOrder = GameState.inventory.groupDefs[oldGroupId].orderedItems;
            if (oldOrder) {
                const index = oldOrder.indexOf(itemId);
                if (index !== -1) oldOrder.splice(index, 1);
            }
        } else {
            // If it had no override, we should remove it from its fallback default group
            const itemDef = getItem(itemId);
            if (itemDef) {
                const groupName = this.getGroupName(itemDef.type);
                const fallbackId = `default-${groupName.toLowerCase()}`;
                if (GameState.inventory.groupDefs[fallbackId]) {
                    const oldOrder = GameState.inventory.groupDefs[fallbackId].orderedItems;
                    if (oldOrder) {
                        const index = oldOrder.indexOf(itemId);
                        if (index !== -1) oldOrder.splice(index, 1);
                    }
                }
            }
        }

        // 2. Set the override mapping
        GameState.inventory.itemOverrides[itemId] = groupId;

        // 3. Insert into the new group's ordered array
        const targetGroup = GameState.inventory.groupDefs[groupId];
        if (targetGroup) {
            if (!targetGroup.orderedItems) targetGroup.orderedItems = [];

            // Remove if already in array to prevent duplicates during re-order
            const existingIndex = targetGroup.orderedItems.indexOf(itemId);
            if (existingIndex !== -1) {
                targetGroup.orderedItems.splice(existingIndex, 1);
            }

            if (targetIndex >= 0 && targetIndex <= targetGroup.orderedItems.length) {
                targetGroup.orderedItems.splice(targetIndex, 0, itemId);
            } else {
                targetGroup.orderedItems.push(itemId);
            }
        }

        EventBus.publish('inventory_updated');
        return true;
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
