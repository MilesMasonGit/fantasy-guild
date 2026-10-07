import { InventoryStore } from './InventoryStore.js';
import { InventoryFormatter } from './InventoryFormatter.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { GameState } from '../../state/GameState.js';
import { DEFAULT_MAX_STACK } from '../../config/registries/itemRegistry.js';
import { RegistryManager } from '../progression/RegistryManager.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * InventoryManager - Transaction Hub for player inventory.
 * Focuses on atomic additions and removals.
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
    /**
     * Whether the Bank has no slot for `itemId`: it holds none of it and every
     * slot is taken. The one test {@link addItem} refuses a new type by, shared
     * so `SpriteLayer`'s sweeps can skip a pile it would refuse rather than
     * re-trying it every tick.
     */
    lacksSlotFor(itemId) {
        if (InventoryStore.getEntry(itemId)) return false;
        const maxSlots = GameState.inventory.maxSlots ?? 20;
        return Object.keys(InventoryStore.getItems()).length >= maxSlots;
    },

    addItem(itemId, amount, sourceId = null) {
        if (amount <= 0) return 0;
        const template = getItem(itemId);
        if (!template) {
            logger.error('InventoryManager', `Item not found in registry: ${itemId}`);
            return 0;
        }

        // Bank slot capacity: each distinct item type occupies one slot; adding to
        // an existing stack never needs a new one. `maxSlots` is owned by
        // GuildUpgradeManager (the bank_slots upgrade raises it).
        //
        // ⚠️ Nothing is ever lost to a full Bank: the overflow goes to the board,
        // where it stays as a sprite until the player makes room. The handoff is an
        // EVENT so this module and `SpriteLayer` don't import each other, which
        // makes the guarantee one subscriber away from being silently untrue: if
        // items vanish, check `SpriteLayer.init()` is running.
        if (this.lacksSlotFor(itemId)) {
            EventBus.publish(ENGINE_EVENTS.INVENTORY_OVERFLOW, { itemId, amount });
            return 0;
        }

        let addedCount = amount;
        // `dur` is inert: a retired durability field, always null, kept so
        // existing saves keep their shape. Nothing reads it.
        let entry = InventoryStore.getEntry(itemId) || { itemId, quantity: 0, dur: null };

        if (template.stackable !== false) {
            // Falls back to the shared constant, not to state: an existing
            // save carries whatever ceiling was current when it was written,
            // and a stale one silently starts dropping output.
            const baseMaxStack = template.maxStack || DEFAULT_MAX_STACK;
            const stackBonus = GameState.inventory.maxStackBonus || 0;
            const maxStack = baseMaxStack + stackBonus;
            const spaceRemaining = maxStack - entry.quantity;

            // A maxed stack hands the remainder to the board, not to nothing.
            // DEFAULT_MAX_STACK is 1e12, so this almost never fires.
            if (spaceRemaining <= 0) {
                EventBus.publish(ENGINE_EVENTS.INVENTORY_OVERFLOW, { itemId, amount });
                return 0;
            }

            if (amount > spaceRemaining) {
                addedCount = spaceRemaining;
                EventBus.publish(ENGINE_EVENTS.INVENTORY_OVERFLOW, { itemId, amount: amount - spaceRemaining });
            }
        } else if (entry.quantity >= 1) {
            EventBus.publish(ENGINE_EVENTS.INVENTORY_OVERFLOW, { itemId, amount });
            return 0;
        }

        entry.quantity += addedCount;
        InventoryStore.setEntry(itemId, entry);
        InventoryFormatter.invalidate();

        RegistryManager.recordItemGain(itemId, addedCount, sourceId);
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId, amount: entry.quantity, added: addedCount });
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

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
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId, amount: entry.quantity, removed: amount });
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

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
     * Public getters (delegated)
     */
    getAllItems() {
        return InventoryStore.getItems();
    },

    getDisplayInventory() {
        return InventoryFormatter.getDisplayInventory();
    },

    // Bank tabs are NOT player-managed: the only way a tab appears is buying the
    // `bank_tabs` Guild Hall upgrade, which raises `inventory.maxTabs`;
    // `GuildUpgradeManager._ensureBankTabs` then creates the matching entry in
    // `groupOrder`/`groupDefs`.
    //
    // `groupDefs[id].isCustom` survives in saved games as an inert field (always
    // false, read by nothing) so old saves keep loading.

    /**
     * Replace a group's manual item order wholesale (the Bank pane's reorderable
     * list commits its visual order).
     */
    setGroupOrder(groupId, orderedIds) {
        const def = GameState.inventory.groupDefs[groupId];
        if (!def || !Array.isArray(orderedIds)) return false;
        def.orderedItems = [...orderedIds];
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
        return true;
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

        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
        return true;
    }
};

