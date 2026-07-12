import { GameState } from '../../state/GameState.js';
import { logger } from '../../utils/Logger.js';

/**
 * InventoryStore - Raw State Management for the Inventory System.
 * Forces normalization of item data into the { quantity, dur } format.
 */
export const InventoryStore = {
    /**
     * Initialize/Rehydrate the inventory state.
     * Enforces the standard object-based format and prunes legacy numbers.
     */
    init() {
        if (!GameState.state || !GameState.state.inventory) {
            if (GameState.state) {
                GameState.state.inventory = {
                    items: {},      
                    maxSlots: 20,
                    groupOrder: ['default-loot'],
                    groupDefs: {
                        'default-loot': { title: 'Loot', isCustom: false, id: 'default-loot', orderedItems: [] }
                    },
                    itemOverrides: {}
                };
            }
        }

        const inv = GameState.state.inventory;
        if (!inv.groupOrder) inv.groupOrder = ['default-loot'];
        if (!inv.groupDefs) {
            inv.groupDefs = {
                'default-loot': { title: 'Loot', isCustom: false, id: 'default-loot', orderedItems: [] }
            };
        }
        if (!inv.itemOverrides) inv.itemOverrides = {};
        // Bank tab limit (UI overhaul Phase 3): groups double as the Bank's
        // tabs. Starts at 1; raised by Guild Hall upgrades (owner decision
        // 2026-07-11 — tab count, total slots, and stack size are three
        // separate upgrade paths; maxSlots and maxStackBonus already exist).
        if (inv.maxTabs === undefined) inv.maxTabs = 1;
        if (inv.maxSlots === undefined) inv.maxSlots = 20;

        const items = inv.items;
        if (items) {
            for (const [key, val] of Object.entries(items)) {
                // FORCE NORMALIZATION: Strict object-only format
                if (typeof val === 'number') {
                    items[key] = { quantity: isNaN(val) ? 0 : val, dur: null };
                } else if (val && typeof val === 'object') {
                    // Normalize quantity/qty
                    if (val.qty !== undefined) {
                        val.quantity = val.qty;
                        delete val.qty;
                    }
                    if (val.quantity === undefined || isNaN(val.quantity)) {
                        val.quantity = 0;
                    }
                    if (val.dur === undefined) val.dur = null;
                } else {
                    // Invalid/Corrupt data
                    delete items[key];
                }
            }
        }
        
        logger.info('InventoryStore', 'Normalized inventory state rehydrated successfully.');
    },

    /**
     * Internal accessor for item dictionary.
     */
    getItems() {
        return GameState.inventory.items;
    },

    /**
     * Fetch a raw storage entry.
     * @param {string} itemId 
     * @returns {Object|null} { quantity: number, dur: number|null }
     */
    getEntry(itemId) {
        return GameState.inventory.items[itemId] || null;
    },

    /**
     * Update/Set a storage entry.
     * @param {string} itemId 
     * @param {Object} entry { quantity, dur }
     */
    setEntry(itemId, entry) {
        if (entry.quantity <= 0) {
            delete GameState.inventory.items[itemId];
        } else {
            GameState.inventory.items[itemId] = entry;
        }
    },

    /**
     * Delete an entry.
     * @param {string} itemId 
     */
    deleteEntry(itemId) {
        delete GameState.inventory.items[itemId];
    }
};
