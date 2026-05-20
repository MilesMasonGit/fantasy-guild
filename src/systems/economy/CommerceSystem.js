// Fantasy Guild - Commerce System
// Centralized logic for buying, selling, and item valuation.

import { InventoryManager } from '../inventory/InventoryManager.js';
import { CurrencyManager } from './CurrencyManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { EventBus } from '../core/EventBus.js';

/**
 * CommerceSystem - Handles trading and economic transactions
 */
export const CommerceSystem = {
    /**
     * Get the current market price for an item
     * @param {string} itemId 
     * @returns {number}
     */
    getItemPrice(itemId) {
        const item = getItem(itemId);
        if (!item) return 0;

        // Base value from registry, fallback to 1 for generic items
        return item.baseValue || 1;
    },

    /**
     * Sell an item from inventory for gold
     * @param {string} itemId 
     * @param {number} quantity 
     * @returns {{ success: boolean, totalGold?: number, error?: string }}
     */
    sellItem(itemId, quantity) {
        if (quantity <= 0) return { success: false, error: 'INVALID_QUANTITY' };

        const currentCount = InventoryManager.getItemCount(itemId);
        if (currentCount < quantity) {
            return { success: false, error: 'INSUFFICIENT_STOCK' };
        }

        const unitPrice = this.getItemPrice(itemId);
        const totalGold = unitPrice * quantity;

        // Process Transaction
        const removed = InventoryManager.removeItem(itemId, quantity);
        if (removed) {
            CurrencyManager.addGold(totalGold, 'merchant_sale');
            
            logger.info('CommerceSystem', `Sold ${quantity}x ${itemId} for ${totalGold}g`);
            
            EventBus.publish('item_sold', {
                itemId,
                quantity,
                unitPrice,
                totalGold
            });

            return { success: true, totalGold };
        }

        return { success: false, error: 'REMOVAL_FAILED' };
    }
};
