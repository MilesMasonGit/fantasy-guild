import { InventoryStore } from './InventoryStore.js';
import { InventoryFormatter } from './InventoryFormatter.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { GameState } from '../../state/GameState.js';
import { DEFAULT_MAX_STACK } from '../../config/registries/itemRegistry.js';
import { RegistryManager } from '../progression/RegistryManager.js';

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
    addItem(itemId, amount, sourceId = null) {
        if (amount <= 0) return 0;
        const template = getItem(itemId);
        if (!template) {
            logger.error('InventoryManager', `Item not found in registry: ${itemId}`);
            return 0;
        }

        // 0. Bank slot capacity (CR-039). Each distinct item type occupies one
        //    slot; adding to an existing stack never needs a new slot. maxSlots
        //    is owned by GuildUpgradeManager (bank_slots upgrade raises it).
        //
        //    ⚠️ **D-138: nothing is ever lost to a full Bank.** This used to
        //    warn and destroy the incoming items. It now hands them to the
        //    board, where they stay as a sprite until the player makes room —
        //    so a full Bank announces itself *visibly*, as litter accumulating
        //    across the grid, rather than through an error message. It is also
        //    the only thing protecting a one-copy-ever Mythic drop.
        //
        //    The handoff is an EVENT rather than a call so this module and
        //    `SpriteLayer` don't import each other. That makes the guarantee one
        //    subscriber away from being silently untrue — if items ever start
        //    vanishing, check `SpriteLayer.init()` is running first.
        if (!InventoryStore.getEntry(itemId)) {
            const maxSlots = GameState.inventory.maxSlots ?? 20;
            const usedSlots = Object.keys(InventoryStore.getItems()).length;
            if (usedSlots >= maxSlots) {
                EventBus.publish('inventory_overflow', { itemId, amount });
                return 0;
            }
        }

        let addedCount = amount;
        // `dur` is inert. It held item durability, which was retired (D-118)
        // and cut entirely (owner decision 2026-08-19, CR2-096) — equipment is
        // permanent and defeat-loss is the only way to lose gear. Nothing reads
        // it; it stays on the entry, always null, so existing saves keep their
        // shape and keep loading.
        let entry = InventoryStore.getEntry(itemId) || { itemId, quantity: 0, dur: null };

        // 1. Stack and Space Constraints
        if (template.stackable !== false) {
            // Falls back to the shared constant, not to state: an existing
            // save carries whatever ceiling was current when it was written,
            // and a stale one silently starts dropping output.
            const baseMaxStack = template.maxStack || DEFAULT_MAX_STACK;
            const stackBonus = GameState.inventory.maxStackBonus || 0;
            const maxStack = baseMaxStack + stackBonus;
            const spaceRemaining = maxStack - entry.quantity;

            // Same D-138 rule for a maxed stack: the remainder goes to the
            // board, not to nothing. In practice this almost never fires —
            // DEFAULT_MAX_STACK is 1e12 and D-137 says stacks are never capped
            // — but "almost never" is not "never", and this is the path a
            // Mythic-equivalent quantity would take.
            if (spaceRemaining <= 0) {
                EventBus.publish('inventory_overflow', { itemId, amount });
                return 0;
            }

            if (amount > spaceRemaining) {
                addedCount = spaceRemaining;
                EventBus.publish('inventory_overflow', { itemId, amount: amount - spaceRemaining });
            }
        } else if (entry.quantity >= 1) {
            EventBus.publish('inventory_overflow', { itemId, amount });
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

    // ⚠️ `canAccept(itemId, amount)` was deleted on 2026-08-26 (CR2-097). It had
    // no callers: the "card work pre-flight" its doc comment named was Phase 6 of
    // the retired card system and never shipped. It was also wrong — its last
    // line read `>= Math.min(amount, 1)`, so it compared free space against 1 no
    // matter what `amount` was, and would have answered "yes, room for 500" with
    // one slot free. Anything that needs this question later should be written
    // against `addItem`'s guards, not restored from here.

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

    // Bank tabs are NOT player-managed (owner ruling 2026-08-25). The only way
    // a tab appears is buying the `bank_tabs` Guild Hall upgrade, which raises
    // `inventory.maxTabs`; `GuildUpgradeManager._ensureBankTabs` then creates
    // the matching `bank-tab-N` entry in `groupOrder`/`groupDefs`. Players
    // cannot create, name, delete or rearrange tabs. `createGroup`,
    // `renameGroup`, `deleteGroup` and `reorderGroups` used to live here; they
    // had no callers anywhere and `createGroup` could never succeed anyway,
    // because `_ensureBankTabs` always keeps `groupOrder.length === maxTabs`.
    // Removed 2026-08-25 (CR2-089).
    //
    // `groupDefs[id].isCustom` survives in saved games as an inert field: it is
    // written `false` by every tab-creating path that remains and read by
    // nothing. It stays so old saves keep loading unchanged.

    /**
     * Replace a group's manual item order wholesale (UI overhaul Phase 3 —
     * the Bank pane's compact reorderable list commits its visual order).
     */
    setGroupOrder(groupId, orderedIds) {
        const def = GameState.inventory.groupDefs[groupId];
        if (!def || !Array.isArray(orderedIds)) return false;
        def.orderedItems = [...orderedIds];
        EventBus.publish('inventory_updated');
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

        EventBus.publish('inventory_updated');
        return true;
    }
};

