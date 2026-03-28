// Fantasy Guild - Inventory Manager
// Phase 17: Inventory System

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { QuestTracker } from '../progression/QuestTracker.js';
import { logger } from '../../utils/Logger.js';

/**
 * InventoryManager - Manages player inventory
 * 
 * Responsibilities:
 * - Add/Remove items
 * - Check item availability
 * - Handle stack limits
 * - Persist to GameState
 */
export const InventoryManager = {
    /** Cache for sorted display inventory (invalidated on changes) */
    _displayCache: null,
    /** PERFORMANCE: Stable reference map to reuse item objects across multiple UI ticks */
    _itemReferenceMap: {},

    /**
     * Initialize inventory if needed
     */
    init() {
        // Reset cache
        this._displayCache = null;

        // Access state.inventory directly (GameState.inventory is getter-only)
        if (!GameState.state || !GameState.state.inventory) {
            if (GameState.state) {
                GameState.state.inventory = {
                    items: {},      // { "wood": 10, "stone": 5 }
                    maxSlots: 20    // Default slot limit (soft limit for now)
                };
            }
        }

        // AUTO-MIGRATE: Ensure all items are objects
        if (GameState.state && GameState.state.inventory && GameState.state.inventory.items) {
            const inv = GameState.state.inventory.items;
            for (const [key, val] of Object.entries(inv)) {
                if (typeof val === 'number') {
                    inv[key] = { quantity: val, dur: null };
                } else if (val && typeof val === 'object' && val.qty !== undefined) {
                    // Migrate qty to quantity
                    val.quantity = val.qty;
                    delete val.qty;
                }
            }
        }
    },

    /**
     * Add item(s) to inventory
     * @param {string} itemId 
     * @param {number} amount 
     * @returns {number} Amount actually added
     */
    addItem(itemId, amount) {
        if (amount <= 0) return 0;

        const template = getItem(itemId);
        if (!template) {
            console.error(`[InventoryManager] Item not found: ${itemId}`);
            return 0;
        }

        const inventory = GameState.inventory.items;
        const hasDurability = template.maxDurability !== undefined;
        const currentAmount = this.getItemCount(itemId);

        let addedAmount = amount;

        // Check stack limit (template max + global bonus from projects)
        if (template.stackable) {
            const baseMaxStack = template.maxStack || GameState.inventory.maxStack || 50;
            const stackBonus = GameState.inventory.maxStackBonus || 0;
            const maxStack = baseMaxStack + stackBonus;
            const spaceRemaining = maxStack - currentAmount;

            if (spaceRemaining <= 0) {
                NotificationSystem.warning(`Inventory full for ${template.name}`);
                EventBus.publish('inventory_stack_full', { itemId });
                return 0;
            }

            if (amount > spaceRemaining) {
                addedAmount = spaceRemaining;
                NotificationSystem.warning(`Can only carry ${maxStack} ${template.name}`);
                EventBus.publish('inventory_stack_full', { itemId });
            }
        } else {
            // Non-stackable items - max 1
            if (currentAmount >= 1) {
                NotificationSystem.warning(`You already have a ${template.name}`);
                return 0;
            }
            addedAmount = 1;
        }

        // Update state based on item type - ALWAYS use object format
        if (inventory[itemId]) {
            // Update existing item
            if (typeof inventory[itemId] === 'number') {
                // Migration: Convert legacy number to object
                inventory[itemId] = { quantity: (isNaN(inventory[itemId]) ? 0 : inventory[itemId]) + addedAmount, dur: null };
            } else {
                let currentQty = inventory[itemId].quantity;
                if (isNaN(currentQty) || currentQty === undefined) currentQty = 0;
                inventory[itemId].quantity = currentQty + addedAmount;
            }
        } else {
            // Add new item - ALWAYS as object
            const maxDur = hasDurability ? template.maxDurability : null;
            inventory[itemId] = { quantity: addedAmount, dur: maxDur };
        }

        // Invalidate display cache since inventory changed
        this._displayCache = null;

        // Publish event
        EventBus.publish('inventory_updated', {
            itemId,
            amount: this.getItemCount(itemId),
            added: addedAmount
        });

        // Notify Phase 2 QuestTracker
        QuestTracker.processEvent('ON_ITEM_GAINED', { itemId, amount: addedAmount });

        logger.debug('InventoryManager', `Added ${addedAmount} ${itemId} (Total: ${this.getItemCount(itemId)})`);
        return addedAmount;
    },

    /**
     * Remove item(s) from inventory
     * @param {string} itemId 
     * @param {number} amount 
     * @returns {boolean} True if successful
     */
    removeItem(itemId, amount) {
        if (amount <= 0) return false;

        const inventory = GameState.inventory.items;
        const template = getItem(itemId);
        const currentAmount = this.getItemCount(itemId);

        if (currentAmount < amount) {
            return false;
        }

        const newAmount = currentAmount - amount;
        const hasDurability = template?.maxDurability !== undefined;

        if (newAmount === 0) {
            delete inventory[itemId];
        } else {
            // Update existing item
            if (typeof inventory[itemId] === 'object') {
                inventory[itemId].quantity = newAmount;
            } else {
                // Legacy migration
                inventory[itemId] = { quantity: newAmount, dur: null };
            }
        }

        // Invalidate display cache since inventory changed
        this._displayCache = null;

        EventBus.publish('inventory_updated', {
            itemId,
            amount: newAmount,
            removed: amount
        });

        logger.debug('InventoryManager', `Removed ${amount} ${itemId} (Remaining: ${newAmount})`);
        return true;
    },

    /**
     * Check if player has enough of an item
     * @param {string} itemId 
     * @param {number} amount 
     * @returns {boolean}
     */
    hasItem(itemId, amount = 1) {
        return this.getItemCount(itemId) >= amount;
    },

    /**
     * Get current quantity of an item (handles both formats)
     * @param {string} itemId 
     * @returns {number}
     */
    getItemCount(itemId) {
        const item = GameState.inventory.items[itemId];
        if (!item) return 0;
        if (typeof item === 'object') {
            const count = item.quantity;
            return isNaN(count) ? 0 : (count || 0);
        }
        return isNaN(item) ? 0 : item; // Legacy fallback
    },

    /**
     * Get current durability of an item
     * @param {string} itemId 
     * @returns {number|null} Durability or null if item doesn't have durability
     */
    getDurability(itemId) {
        const item = GameState.inventory.items[itemId];
        const template = getItem(itemId);

        if (!item) return null;

        // If it's a number but SHOULD have durability, treat as full
        if (typeof item === 'number') {
            return template?.maxDurability || null;
        }

        return item.dur;
    },

    /**
     * Decrement durability by amount. If it reaches 0, consume 1 from stack.
     * @param {string} itemId 
     * @param {number} amount
     * @returns {{ broke: boolean, depleted: boolean }} broke = item broke, depleted = stack empty
     */
    decrementDurability(itemId, amount = 1) {
        const inventory = GameState.inventory.items;
        let item = inventory[itemId]; // Changed to let
        const template = getItem(itemId);

        // Auto-convert legacy/number format to object if needed
        if (typeof item === 'number' && template?.maxDurability) {
            // Convert to object format with full durability
            item = { quantity: item, dur: template.maxDurability };
            inventory[itemId] = item; // Update state
            logger.info('InventoryManager', `Converted ${itemId} to durability format`);
        }

        if (!item || typeof item !== 'object' || !template?.maxDurability) {
            return { broke: false, depleted: false };
        }

        item.dur -= amount;
        // if (Math.random() < 0.05) console.log(`[InvManager] ${itemId} dur: ${item.dur}/${template.maxDurability}`);

        if (item.dur <= 0) {
            // Item broke - remove 1 from stack
            const newQty = (item.quantity || 0) - 1;

            if (newQty <= 0) {
                delete inventory[itemId];
                this._displayCache = null;
                // Notify shortage
                EventBus.publish('inventory_updated', { itemId, amount: 0 });
                return { broke: true, depleted: true };
            } else {
                // Reset durability for next item in stack
                inventory[itemId] = { quantity: newQty, dur: template.maxDurability };
                this._displayCache = null;
                EventBus.publish('inventory_updated', { itemId, amount: newQty });
                return { broke: true, depleted: false };
            }
        }

        // Just update (less frequent events for floats?)
        // We might not want to publish event on every float change to avoid UI spam?
        // But we want the bar to animate.
        // We can publish a specific 'durability_updated' event?
        // Or just 'inventory_updated' (might be heavy if 60fps).
        // Let's rely on GameLoop throttling or just publish.
        EventBus.publish('inventory_durability_updated', { itemId, durability: item.dur, max: template.maxDurability });

        return { broke: false, depleted: false };
    },

    /**
     * Get all inventory items
     * @returns {Object} { itemId: quantity }
     */
    getAllItems() {
        return { ...GameState.inventory.items };
    },

    /**
     * Get formatted inventory for UI (with template data)
     * Uses cached result to avoid re-sorting on every call
     * @returns {Array} [{ id, name, count, durability?, ... }]
     */
    getDisplayInventory() {
        // Return cached result if available
        if (this._displayCache !== null) {
            return this._displayCache;
        }

        const displayList = [];
        const items = GameState.inventory.items;

        for (const [id, value] of Object.entries(items)) {
            const template = getItem(id);
            if (template) {
                // Handle both formats
                const count = typeof value === 'object' ? value.quantity : value;
                const durability = typeof value === 'object' ? value.dur : null;

                // PERFORMANCE: Reference Stability Check
                // We check if we already have a stable object for this item + count + durability
                const existing = this._itemReferenceMap[id];
                if (existing && existing.count === count && existing.durability === durability) {
                    displayList.push(existing);
                } else {
                    // Create new stable reference and store it
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
        }

        // Sort and cache the list itself
        // Note: the items INSIDE the list are now stable across ticks
        this._displayCache = displayList.sort((a, b) => a.name.localeCompare(b.name));
        return this._displayCache;
    }
};
