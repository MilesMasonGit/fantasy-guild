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
    /** PERFORMANCE: Cache for grouped results to prevent O(N) grouping on every UI tick */
    _groupedCache: null,
    _cacheDirty: true,
    _groupReferenceMap: {},

    /** Helper to check if two arrays of items are identical in length and item identity */
    _areItemArraysEqual(arrA, arrB) {
        if (!arrA || !arrB) return false;
        if (arrA.length !== arrB.length) return false;
        for (let i = 0; i < arrA.length; i++) {
            if (arrA[i] !== arrB[i]) return false;
        }
        return true;
    },

    init() {
        // Listen for external inventory updates to invalidate cache
        EventBus.subscribe('inventory_updated', () => {
            this._cacheDirty = true;
        });
    },

    /**
     * Get inventory items grouped by type (or category)
     * @returns {Array} Array of group objects { title, items, isCustom, id }
     */
    getGroupedInventory() {
        // FAST PATH: Return cached result if valid
        if (!this._cacheDirty && this._groupedCache) {
            return this._groupedCache;
        }

        // Safe access to inventory state
        const inv = GameState.inventory;
        if (!inv) return [];

        // Initialize missing arrays/objects on older saves safely
        if (!inv.groupOrder) inv.groupOrder = [];
        if (!inv.groupDefs) inv.groupDefs = {};
        if (!inv.itemOverrides) inv.itemOverrides = {};

        // 1. Ensure Defaults Exist in Definitions
        const defaultGroupTitles = ['Loot'];

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

            // Fallback: New items or items without overrides go to "Loot"
            const fallbackId = 'default-loot';

            if (groups[fallbackId]) {
                groups[fallbackId]._itemMap[item.id] = item;
                if (!groups[fallbackId].orderedItems.includes(item.id)) {
                    groups[fallbackId].orderedItems.push(item.id);
                }
            } else {
                // Extreme failsafe if default-loot somehow missing
                const groupName = this.getGroupName(item.type);
                const emergencyId = `default-${groupName.toLowerCase()}`;
                const finalId = groups[emergencyId] ? emergencyId : 'default-others';

                if (!groups[finalId]) {
                    groups[finalId] = { title: 'Others', isCustom: false, id: finalId, items: [], _itemMap: {}, orderedItems: [] };
                }
                groups[finalId]._itemMap[item.id] = item;
                if (!groups[finalId].orderedItems.includes(item.id)) {
                    groups[finalId].orderedItems.push(item.id);
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
            const groupData = groups[id];
            if (groupData) {
                // PERFORMANCE: Reference Stability Check
                // groupData currently has 'items' (the new array) and '...def' (title, id, isCustom)
                const existingGroup = this._groupReferenceMap[id];
                
                // If the new items array is identical to the old one (by reference), 
                // and the metadata matches, reuse the old group object.
                if (existingGroup && 
                    existingGroup.title === groupData.title && 
                    this._areItemArraysEqual(existingGroup.items, groupData.items)) {
                    finalGroups.push(existingGroup);
                } else {
                    // Metadata or contents changed, create new stable object
                    const newGroup = {
                        title: groupData.title,
                        isCustom: groupData.isCustom,
                        id: groupData.id,
                        items: groupData.items
                    };
                    this._groupReferenceMap[id] = newGroup;
                    finalGroups.push(newGroup);
                }
            }
        });

        this._groupedCache = finalGroups;
        this._cacheDirty = false;
        return finalGroups;
    },

    /**
     * Create a new custom inventory group
     * @param {string} name 
     */
    createGroup(name) {
        if (!name || name.trim() === '') return false;

        const id = 'custom-' + Date.now();
        const cleanName = name.trim().slice(0, 15);

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

        // Insert at the VERY BOTTOM of the order
        GameState.inventory.groupOrder.push(id);

        this._cacheDirty = true;
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
            def.title = newName.trim().slice(0, 15);
            this._cacheDirty = true;
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

            // Reassign items from this group to 'Loot'
            if (GameState.inventory.itemOverrides) {
                for (const itemId in GameState.inventory.itemOverrides) {
                    if (GameState.inventory.itemOverrides[itemId] === groupId) {
                        // Move to Loot explicitly to maintain record/order if needed
                        GameState.inventory.itemOverrides[itemId] = 'default-loot';

                        // Also add to Loot's orderedItems if not already there
                        const lootDef = GameState.inventory.groupDefs['default-loot'];
                        if (lootDef && !lootDef.orderedItems.includes(itemId)) {
                            lootDef.orderedItems.push(itemId);
                        }
                    }
                }
            }

            // Remove from defs
            delete GameState.inventory.groupDefs[groupId];

            this._cacheDirty = true;
            EventBus.publish('inventory_updated');
            return true;
        }
        return false;
    },

    /**
     * Reorder groups in the inventory
     * @param {string} activeId 
     * @param {string} overId 
     */
    reorderGroups(activeId, overId) {
        if (!GameState.inventory.groupOrder) return;

        const oldIndex = GameState.inventory.groupOrder.indexOf(activeId);
        const newIndex = GameState.inventory.groupOrder.indexOf(overId);

        if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = [...GameState.inventory.groupOrder];
            const [movedItem] = newOrder.splice(oldIndex, 1);
            newOrder.splice(newIndex, 0, movedItem);

            GameState.inventory.groupOrder = newOrder;
            this._cacheDirty = true;
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

        this._cacheDirty = true;
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
