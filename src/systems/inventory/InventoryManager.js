import { InventoryStore } from './InventoryStore.js';
import { InventoryFormatter } from './InventoryFormatter.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { QuestTracker } from '../progression/QuestTracker.js';
import { logger } from '../../utils/Logger.js';
import { GameState } from '../../state/GameState.js';
import { RegistryManager } from '../progression/RegistryManager.js';

/**
 * InventoryManager - Transaction Hub for player inventory.
 * Focuses on atomic additions, removals, and durability logic.
 */
export const InventoryManager = {
    /** Initialize via Store rehydration */
    init() {
        InventoryStore.init();
        InventoryFormatter.invalidate();
    },

    /**
     * Add item(s) to inventory.
     * @param {string} itemId 
     * @param {number} amount 
     * @param {string|null} sourceId - The source (card or enemy)
     * @returns {number} Amount actually added
     */
    addItem(itemId, amount, sourceId = null) {
        if (amount <= 0) return 0;
        const template = getItem(itemId);
        if (!template) {
            logger.error('InventoryManager', `Item not found in registry: ${itemId}`);
            return 0;
        }

        let addedCount = amount;
        let entry = InventoryStore.getEntry(itemId) || { itemId, quantity: 0, dur: template.maxDurability || null };

        // 1. Stack and Space Constraints
        if (template.stackable !== false) {
            const baseMaxStack = template.maxStack || GameState.inventory.maxStack || 50;
            const stackBonus = GameState.inventory.maxStackBonus || 0;
            const maxStack = baseMaxStack + stackBonus;
            const spaceRemaining = maxStack - entry.quantity;

            if (spaceRemaining <= 0) {
                NotificationSystem.warning(`Inventory full for ${template.name}`);
                EventBus.publish('inventory_stack_full', { itemId });
                return 0;
            }

            if (amount > spaceRemaining) {
                addedCount = spaceRemaining;
                NotificationSystem.warning(`Carrying limit reached for ${template.name}`);
                EventBus.publish('inventory_stack_full', { itemId });
            }
        } else if (entry.quantity >= 1) {
            NotificationSystem.warning(`You already have a ${template.name}`);
            return 0;
        }

        // 2. Atomic Update
        entry.quantity += addedCount;
        InventoryStore.setEntry(itemId, entry);
        InventoryFormatter.invalidate();

        // 3. Side Effects
        RegistryManager.recordItemGain(itemId, addedCount, sourceId);
        EventBus.publish('inventory_updated', { itemId, amount: entry.quantity, added: addedCount });
        EventBus.publish('state_changed');
        QuestTracker.processEvent('ON_ITEM_GAINED', { itemId, amount: addedCount });
        
        logger.debug('InventoryManager', `Added ${addedCount}x ${itemId} (Total: ${entry.quantity})`);
        return addedCount;
    },

    /**
     * Remove item(s).
     * @returns {boolean} Success
     */
    removeItem(itemId, amount) {
        if (amount <= 0) return false;
        const entry = InventoryStore.getEntry(itemId);
        if (!entry || entry.quantity < amount) return false;

        entry.quantity -= amount;
        if (entry.quantity <= 0) {
            InventoryStore.deleteEntry(itemId);
        } else {
            InventoryStore.setEntry(itemId, entry);
        }

        InventoryFormatter.invalidate();
        EventBus.publish('inventory_updated', { itemId, amount: entry.quantity, removed: amount });
        EventBus.publish('state_changed');

        logger.debug('InventoryManager', `Removed ${amount}x ${itemId} (Remaining: ${entry.quantity})`);
        return true;
    },

    /**
     * Requirement Utility
     */
    hasItem(itemId, amount = 1) {
        return (InventoryStore.getEntry(itemId)?.quantity || 0) >= amount;
    },

    /**
     * Quantity Utility
     */
    getItemCount(itemId) {
        return InventoryStore.getEntry(itemId)?.quantity || 0;
    },

    /**
     * Durability Utility
     */
    getDurability(itemId) {
        return InventoryStore.getEntry(itemId)?.dur ?? null;
    },

    /**
     * Decrement durability. Handles item breakage and stack consumption.
     */
    decrementDurability(itemId, amount = 1) {
        const entry = InventoryStore.getEntry(itemId);
        const template = getItem(itemId);

        if (!entry || entry.dur === null || !template?.maxDurability) {
            return { broke: false, depleted: false };
        }

        entry.dur -= amount;

        if (entry.dur <= 0) {
            // Item broke
            entry.quantity -= 1;
            if (entry.quantity <= 0) {
                InventoryStore.deleteEntry(itemId);
                InventoryFormatter.invalidate();
                EventBus.publish('inventory_updated', { itemId, amount: 0 });
                return { broke: true, depleted: true };
            } else {
                // Reset durability for next item in stack
                entry.dur = template.maxDurability;
                InventoryStore.setEntry(itemId, entry);
                InventoryFormatter.invalidate();
                EventBus.publish('inventory_updated', { itemId, amount: entry.quantity });
                return { broke: true, depleted: false };
            }
        }

        EventBus.publish('inventory_durability_updated', { itemId, durability: entry.dur, max: template.maxDurability });
        return { broke: false, depleted: false };
    },

    /**
     * Public getters (delegated)
     */
    getAllItems() {
        return InventoryStore.getItems();
    },

    getDisplayInventory() {
        return InventoryFormatter.getDisplayInventory();
    },

    // ========================================
    // Group & Sorting Mutations
    // ========================================

    /**
     * Create a new custom inventory group.
     */
    createGroup(name) {
        if (!name?.trim()) return null;

        const id = `custom-${Date.now()}`;
        const cleanName = name.trim().slice(0, 15);

        GameState.inventory.groupDefs[id] = {
            title: cleanName,
            isCustom: true,
            id,
            orderedItems: []
        };
        GameState.inventory.groupOrder.push(id);

        EventBus.publish('inventory_updated');
        return id;
    },

    /**
     * Rename any inventory group.
     */
    renameGroup(groupId, newName) {
        if (!newName?.trim()) return false;
        
        // Ensure definition exists (promotes default groups to definitions)
        if (!GameState.inventory.groupDefs[groupId]) {
            GameState.inventory.groupDefs[groupId] = {
                id: groupId,
                title: '',
                isCustom: false, // Keep original flag if we know it, or default to false
                orderedItems: []
            };
        }

        const def = GameState.inventory.groupDefs[groupId];
        def.title = newName.trim().slice(0, 15);
        
        EventBus.publish('inventory_updated');
        return true;
    },

    /**
     * Delete any inventory group.
     */
    deleteGroup(groupId) {
        const order = GameState.inventory.groupOrder;
        const index = order?.indexOf(groupId);
        if (index === undefined || index === -1) return false;

        // 1. Remove from order and definitions
        order.splice(index, 1);
        if (GameState.inventory.groupDefs[groupId]) {
            delete GameState.inventory.groupDefs[groupId];
        }

        // 2. Clear overrides for this group
        const overrides = GameState.inventory.itemOverrides;
        for (const itemId in overrides) {
            if (overrides[itemId] === groupId) {
                delete overrides[itemId];
            }
        }

        EventBus.publish('inventory_updated');
        return true;
    },

    /**
     * Reorder groups in the inventory.
     */
    reorderGroups(activeId, overId) {
        const order = GameState.inventory.groupOrder;
        if (!order) return false;

        const oldIndex = order.indexOf(activeId);
        const newIndex = order.indexOf(overId);

        if (oldIndex !== -1 && newIndex !== -1) {
            const [moved] = order.splice(oldIndex, 1);
            order.splice(newIndex, 0, moved);
            EventBus.publish('inventory_updated');
            return true;
        }
        return false;
    },

    /**
     * Move an item to a specific group at a specific index.
     */
    moveItemToGroup(itemId, groupId, targetIndex = -1) {
        const defs = GameState.inventory.groupDefs;
        const overrides = GameState.inventory.itemOverrides;

        // 1. Remove from any existing specific group order
        for (const gId in defs) {
            const list = defs[gId].orderedItems;
            const idx = list.indexOf(itemId);
            if (idx !== -1) list.splice(idx, 1);
        }

        // 2. Set new mapping
        overrides[itemId] = groupId;

        // 3. Insert into new group order
        const targetList = defs[groupId]?.orderedItems;
        if (targetList) {
            if (targetIndex >= 0 && targetIndex <= targetList.length) {
                targetList.splice(targetIndex, 0, itemId);
            } else {
                targetList.push(itemId);
            }
        }

        EventBus.publish('inventory_updated');
        return true;
    }
};

