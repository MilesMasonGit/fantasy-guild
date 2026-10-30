import { InventoryStore } from './InventoryStore.js';
import { InventoryFormatter } from './InventoryFormatter.js';
import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { GameState } from '../../state/GameState.js';
import { DEFAULT_MAX_STACK } from '../../config/registries/itemRegistry.js';
import { RegistryManager } from '../progression/RegistryManager.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { BANK_TAB_SLOTS, homeTabOf, bankTabCounts, bankTabLayout } from './bankTabs.js';

/** Batching depth: while > 0, Bank changes are summed per item and announced when it ends. */
let batchDepth = 0;
/** @type {Map<string, {added: number, removed: number}>} what the open batch changed, per item */
let batched = new Map();

/** Say a Bank change now, or add it to the open batch. */
function announce(itemId, quantity, { added = 0, removed = 0 }) {
    if (batchDepth > 0) {
        const sum = batched.get(itemId) || { added: 0, removed: 0 };
        sum.added += added;
        sum.removed += removed;
        batched.set(itemId, sum);
        return;
    }
    EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, { itemId, amount: quantity, ...(added ? { added } : { removed }) });
}

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
     * Whether the Bank has no slot for `itemId`: it holds none of it and no tab
     * has a free slot. The one test {@link addItem} refuses a new type by, shared
     * so `SpriteLayer`'s sweeps can skip a pile it would refuse rather than
     * re-trying it every tick.
     */
    lacksSlotFor(itemId) {
        if (InventoryStore.getEntry(itemId)) return false;
        return this.freeSlots() <= 0;
    },

    /**
     * New item kinds the Bank can take: the free slots of every tab, within the
     * Bank's total (`maxSlots`, 64 per tab, written by GuildUpgradeManager).
     */
    freeSlots() {
        const inv = GameState.inventory;
        const used = Object.keys(InventoryStore.getItems()).length;
        const total = Math.max(0, (inv.maxSlots ?? 20) - used);
        // Below one tab's worth no tab can be full.
        if (used < BANK_TAB_SLOTS || total === 0) return total;
        let free = 0;
        for (const n of bankTabCounts(inv).values()) free += Math.max(0, BANK_TAB_SLOTS - n);
        return Math.min(total, free);
    },

    /** Whether a tab has a free slot for one more item kind. */
    tabHasRoom(groupId) {
        return (bankTabCounts(GameState.inventory).get(groupId) ?? BANK_TAB_SLOTS) < BANK_TAB_SLOTS;
    },

    /**
     * File a kind the Bank does not hold yet: in the tab it was last filed in
     * when that tab has room, else in the first tab with room.
     */
    _fileNewKind(itemId) {
        const inv = GameState.inventory;
        const counts = bankTabCounts(inv);
        const home = homeTabOf(inv, itemId);
        if ((counts.get(home) ?? BANK_TAB_SLOTS) < BANK_TAB_SLOTS) return;
        const roomy = (inv.groupOrder || []).find(gid => counts.get(gid) < BANK_TAB_SLOTS);
        if (roomy) {
            if (!inv.itemOverrides) inv.itemOverrides = {};
            inv.itemOverrides[itemId] = roomy;
        }
    },

    /**
     * Move what a tab holds past its 64 slots into tabs with room, the last
     * shown first. An older save could file more than 64 kinds in one tab; what
     * finds no room stays where it is until the player moves it, so nothing
     * leaves the Bank.
     * @returns {number} kinds moved
     */
    spillOverfullTabs() {
        const inv = GameState.inventory;
        const order = inv.groupOrder || [];
        if (order.length < 2 || Object.keys(InventoryStore.getItems()).length <= BANK_TAB_SLOTS) return 0;
        const counts = bankTabCounts(inv);
        const layout = bankTabLayout(inv);
        let moved = 0;
        for (const gid of order) {
            for (const itemId of layout[gid].slice(BANK_TAB_SLOTS)) {
                const roomy = order.find(o => counts.get(o) < BANK_TAB_SLOTS);
                if (!roomy) return moved;
                this._refile(itemId, roomy);
                counts.set(gid, counts.get(gid) - 1);
                counts.set(roomy, counts.get(roomy) + 1);
                moved++;
            }
        }
        return moved;
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

        // Bank slot capacity: each distinct item type occupies one slot in its
        // tab; adding to an existing stack never needs a new one.
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
        let entry = InventoryStore.getEntry(itemId);
        if (!entry) {
            this._fileNewKind(itemId);
            entry = { itemId, quantity: 0, dur: null };
        }

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
        announce(itemId, entry.quantity, { added: addedCount });

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
        announce(itemId, entry.quantity, { removed: amount });

        logger.debug('InventoryManager', `Removed ${amount}x ${itemId} (Remaining: ${entry.quantity})`);
        return true;
    },

    /**
     * Take one copy out of the Bank into a hero's hands. A move, not a spend: it is announced with
     * neither `added` nor `removed`, so it is no item flow, no rate and no catch-up spending.
     * `quiet`: not announced at all (a load, which announces everything once it is done).
     * @returns {boolean} false when the Bank holds none
     */
    takeOut(itemId, { quiet = false } = {}) {
        const entry = InventoryStore.getEntry(itemId);
        if (!entry || entry.quantity < 1) return false;
        entry.quantity -= 1;
        if (entry.quantity <= 0) InventoryStore.deleteEntry(itemId);
        else InventoryStore.setEntry(itemId, entry);
        InventoryFormatter.invalidate();
        if (!quiet) announce(itemId, entry.quantity, {});
        return true;
    },

    /**
     * Whether the Bank can take back one copy of each of `itemIds` without going over a limit (its
     * slots, a stack's ceiling, a single-copy item). `freed`: an item one copy of which leaves the
     * Bank first, freeing its slot when it is the last.
     */
    hasRoomFor(itemIds, { freed = null } = {}) {
        const counts = new Map(Object.entries(InventoryStore.getItems()).map(([id, e]) => [id, e?.quantity || 0]));
        let free = this.freeSlots();
        if (freed && counts.has(freed)) {
            counts.set(freed, counts.get(freed) - 1);
            if (counts.get(freed) <= 0) free++;
        }
        for (const itemId of itemIds) {
            const template = getItem(itemId);
            if (!template) return false;
            const n = (counts.get(itemId) || 0) + 1;
            if (n === 1) {
                if (free <= 0) return false;
                free--;
            }
            if (template.stackable === false && n > 1) return false;
            const maxStack = (template.maxStack || DEFAULT_MAX_STACK) + (GameState.inventory.maxStackBonus || 0);
            if (n > maxStack) return false;
            counts.set(itemId, n);
        }
        return true;
    },

    /**
     * Put a hero's copy back in the Bank: a move, announced like {@link takeOut}, and never a gain
     * (no discovery, no lifetime count).
     *
     * ⚠️ Refuses rather than overflow: a copy with no room stays in the hero's hands, so nothing is
     * lost and nothing goes over the Bank's limit.
     * @returns {boolean} whether it went back
     */
    putBack(itemId, { quiet = false } = {}) {
        if (!this.hasRoomFor([itemId])) return false;
        let entry = InventoryStore.getEntry(itemId);
        if (!entry) {
            this._fileNewKind(itemId);
            entry = { itemId, quantity: 0, dur: null };
        }
        entry.quantity += 1;
        InventoryStore.setEntry(itemId, entry);
        InventoryFormatter.invalidate();
        if (!quiet) announce(itemId, entry.quantity, {});
        return true;
    },

    /**
     * Run `fn` with the Bank's news held back: every item it changed is announced once when it ends
     * (`INVENTORY_UPDATED { itemId, amount, added?, removed? }`, the sums and the final count), in
     * the order the items were first changed. A loot sweep runs in one, so forty piles are not forty
     * announcements. Nests; a batch that throws still announces what it did. `INVENTORY_OVERFLOW`
     * is never held: the floor must take the overflow at once.
     */
    batch(fn) {
        batchDepth++;
        try {
            return fn();
        } finally {
            batchDepth--;
            if (batchDepth === 0 && batched.size) {
                const changes = batched;
                batched = new Map();
                for (const [itemId, { added, removed }] of changes) {
                    EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, {
                        itemId,
                        amount: InventoryStore.getEntry(itemId)?.quantity || 0,
                        ...(added ? { added } : {}),
                        ...(removed ? { removed } : {})
                    });
                }
            }
        }
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
     * Move an item to a specific group at a specific index. Refused (false) when
     * the Bank holds the item and that tab has no free slot.
     */
    moveItemToGroup(itemId, groupId, targetIndex = -1) {
        if (InventoryStore.getEntry(itemId) && homeTabOf(GameState.inventory, itemId) !== groupId
            && !this.tabHasRoom(groupId)) {
            return false;
        }
        this._refile(itemId, groupId, targetIndex);
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
        return true;
    },

    /** File an item in a tab at an index (the end when -1), unannounced and unchecked. */
    _refile(itemId, groupId, targetIndex = -1) {
        const inv = GameState.inventory;
        const defs = inv.groupDefs;
        if (!inv.itemOverrides) inv.itemOverrides = {};
        const overrides = inv.itemOverrides;

        // 1. Remove from any existing specific group order
        for (const gId in defs) {
            const list = defs[gId].orderedItems;
            const idx = list ? list.indexOf(itemId) : -1;
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
    }
};

