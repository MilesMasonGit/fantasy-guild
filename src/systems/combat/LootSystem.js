// Fantasy Guild - Loot System
// Phase 31: Combat System - Loot Generation

import { EventBus } from '../core/EventBus.js';
import { getDropTable } from '../../config/registries/dropTableRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { logger } from '../../utils/Logger.js';

/**
 * LootSystem - Handles loot generation from combat victories
 * 
 * When an enemy is defeated:
 * - Looks up the enemy's drop table
 * - Rolls each item based on chance
 * - Rolls quantity within min/max range
 * - Adds items to inventory
 * - Publishes loot events
 */

const LootSystem = {
    /** Track if system is initialized */
    initialized: false,

    /**
     * Initialize the loot system
     */
    init() {
        if (this.initialized) return;

        // Subscribe to combat victory events
        EventBus.subscribe('combat_victory', (data) => {
            this.handleCombatVictory(data);
        });

        this.initialized = true;
        logger.info('LootSystem', 'Loot system initialized');
    },

    /**
     * Handle combat victory event - generate and award loot
     * @param {Object} data - Victory event data
     */
    handleCombatVictory(data) {
        const { cardId, heroId, enemyId, enemyName, drops, dropTableId } = data;

        // Use inline drops if available, otherwise fall back to dropTableId
        let generatedDrops;
        if (drops && Array.isArray(drops) && drops.length > 0) {
            // Inline drops - process directly
            generatedDrops = this.generateDropsFromArray(drops);
        } else if (dropTableId) {
            // Legacy: use drop table reference
            generatedDrops = this.generateDrops(dropTableId);
        } else {
            logger.warn('LootSystem', `No drops or dropTableId for enemy ${enemyId}`);
            generatedDrops = [];
        }

        if (generatedDrops.length === 0) {
            logger.debug('LootSystem', `No drops generated for ${enemyName}`);
            EventBus.publish('loot_generated', {
                cardId,
                heroId,
                enemyId,
                enemyName,
                drops: []
            });
            return;
        }

        // Add items to inventory
        for (const drop of generatedDrops) {
            InventoryManager.addItem(drop.itemId, drop.quantity);
        }

        logger.info('LootSystem', `${enemyName} dropped ${generatedDrops.length} item(s)`);

        EventBus.publish('loot_generated', {
            cardId,
            heroId,
            enemyId,
            enemyName,
            drops: generatedDrops
        });
    },

    /**
     * Generate drops from a drop table
     * @param {string} dropTableId - ID of the drop table
     * @returns {Array<{itemId: string, quantity: number, itemName: string}>}
     */
    generateDrops(dropTableId) {
        const dropTable = getDropTable(dropTableId);
        if (!dropTable) {
            logger.warn('LootSystem', `Drop table not found: ${dropTableId}`);
            return [];
        }

        const generatedDrops = [];

        for (const dropEntry of dropTable.drops) {
            // Roll for drop chance
            const roll = Math.random() * 100;

            if (roll < dropEntry.chance) {
                // Drop succeeded - roll quantity
                const quantity = this.rollQuantity(dropEntry.minQty, dropEntry.maxQty);
                const item = getItem(dropEntry.itemId);

                generatedDrops.push({
                    itemId: dropEntry.itemId,
                    quantity,
                    itemName: item?.name || dropEntry.itemId,
                    itemIcon: item?.icon || '?'
                });

                logger.debug('LootSystem', `Dropped ${quantity}x ${dropEntry.itemId} (${dropEntry.chance}% chance)`);
            }
        }

        return generatedDrops;
    },

    /**
     * Generate drops from an inline drops array (enemy.drops)
     * @param {Array} dropsArray - Array of drop entries [{itemId, minQty, maxQty, chance}]
     * @returns {Array<{itemId: string, quantity: number, itemName: string}>}
     */
    generateDropsFromArray(dropsArray) {
        const generatedDrops = [];

        for (const dropEntry of dropsArray) {
            // Roll for drop chance
            const roll = Math.random() * 100;

            if (roll < dropEntry.chance) {
                // Drop succeeded - roll quantity
                const quantity = this.rollQuantity(dropEntry.minQty, dropEntry.maxQty);
                const item = getItem(dropEntry.itemId);

                generatedDrops.push({
                    itemId: dropEntry.itemId,
                    quantity,
                    itemName: item?.name || dropEntry.itemId,
                    itemIcon: item?.icon || '?'
                });

                logger.debug('LootSystem', `Dropped ${quantity}x ${dropEntry.itemId} (${dropEntry.chance}% chance)`);
            }
        }

        return generatedDrops;
    },

    /**
     * Roll a quantity between min and max (inclusive)
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    rollQuantity(min, max) {
        if (min >= max) return min;
        return min + Math.floor(Math.random() * (max - min + 1));
    },

    /**
     * Preview possible drops from a drop table (for UI)
     * @param {string} dropTableId 
     * @returns {Array<{itemId: string, itemName: string, chance: number, minQty: number, maxQty: number}>}
     */
    previewDrops(dropTableId) {
        const dropTable = getDropTable(dropTableId);
        if (!dropTable) return [];

        return dropTable.drops.map(drop => {
            const item = getItem(drop.itemId);
            return {
                itemId: drop.itemId,
                itemName: item?.name || drop.itemId,
                itemIcon: item?.icon || '?',
                chance: drop.chance,
                minQty: drop.minQty,
                maxQty: drop.maxQty
            };
        });
    },

    /**
     * Preview possible drops from an inline drops array (for UI)
     * @param {Array} dropsArray - Array of drop entries
     * @returns {Array<{itemId: string, itemName: string, chance: number, minQty: number, maxQty: number}>}
     */
    previewDropsFromArray(dropsArray) {
        if (!dropsArray || !Array.isArray(dropsArray)) return [];

        return dropsArray.map(drop => {
            const item = getItem(drop.itemId);
            return {
                itemId: drop.itemId,
                itemName: item?.name || drop.itemId,
                itemIcon: item?.icon || '?',
                chance: drop.chance,
                minQty: drop.minQty,
                maxQty: drop.maxQty
            };
        });
    },

    /**
     * Manually trigger loot generation (for testing)
     * @param {string} dropTableId 
     * @returns {Array}
     */
    testDrops(dropTableId) {
        const drops = this.generateDrops(dropTableId);
        console.log('Generated drops:', drops);
        return drops;
    }
};

export { LootSystem };
