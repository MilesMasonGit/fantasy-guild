import { InventoryManager } from '../inventory/InventoryManager.js';
import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';

/**
 * InventoryGroupManager - Pure Logic for grouping inventory items.
 * Refactored to be stateless and lightweight.
 */
export const InventoryGroupManager = {
    
    init() {
        // No-op for compatibility
    },

    /**
     * Resolve which group an item belongs to
     */
    getItemGroupId(itemId) {
        const inv = GameState.inventory;
        if (!inv || !inv.groupOrder || inv.groupOrder.length === 0) return null;
        
        // 1. Check explicit override
        if (inv.itemOverrides && inv.itemOverrides[itemId]) {
            // Ensure the override target still exists
            const targetId = inv.itemOverrides[itemId];
            if (inv.groupOrder.includes(targetId)) return targetId;
        }

        // 2. Default: Always go to the TOPMOST group
        return inv.groupOrder[0];
    },

    /**
     * Get inventory items grouped by type or custom assignment.
     * respects 'groupOrder' and 'orderedItems' for custom sorting.
     */
    getGroupedInventory() {
        const inv = GameState.inventory;
        if (!inv) return [];

        const displayItems = InventoryManager.getDisplayInventory();
        const { groupOrder = [], groupDefs = {}, itemOverrides = {} } = inv;

        // 1. Initialize result buckets for all ordered groups
        const groupsById = {};
        groupOrder.forEach(id => {
            const def = groupDefs[id];
            if (def) {
                groupsById[id] = {
                    id: def.id,
                    title: def.title,
                    isCustom: def.isCustom,
                    items: [],
                    _itemMap: {}
                };
            }
        });

        // 2. Sort items into buckets
        displayItems.forEach(item => {
            const targetId = this.getItemGroupId(item.id);
            if (targetId && groupsById[targetId]) {
                groupsById[targetId]._itemMap[item.id] = item;
            }
        });

        // 3. Assemble final arrays respecting 'orderedItems'
        return groupOrder.map(id => {
            const group = groupsById[id];
            if (!group) return null; // Skip invalid IDs

            const def = groupDefs[id] || {};
            const itemOrder = def.orderedItems || [];

            // Add ordered items first
            itemOrder.forEach(itemId => {
                if (group._itemMap && group._itemMap[itemId]) {
                    group.items.push(group._itemMap[itemId]);
                    delete group._itemMap[itemId];
                }
            });

            // Append any remaining items
            if (group._itemMap) {
                Object.values(group._itemMap).forEach(item => {
                    group.items.push(item);
                });
                delete group._itemMap;
            }

            return group;
        }).filter(g => g && (g.items.length > 0 || g.isCustom));
    },

    // ========================================
    // Logic Facades (Delegated to InventoryManager)
    // ========================================
    createGroup: (name) => InventoryManager.createGroup(name),
    renameGroup: (id, name) => InventoryManager.renameGroup(id, name),
    deleteGroup: (id) => InventoryManager.deleteGroup(id),
    reorderGroups: (act, over) => InventoryManager.reorderGroups(act, over),
    moveItemToGroup: (item, group, idx) => InventoryManager.moveItemToGroup(item, group, idx)
};
