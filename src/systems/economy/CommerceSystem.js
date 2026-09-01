// Fantasy Guild - Commerce System
// Centralized logic for buying, selling, and item valuation.

import { InventoryManager } from '../inventory/InventoryManager.js';
import { CurrencyManager } from './CurrencyManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';

/**
 * CommerceSystem - Handles trading and economic transactions
 */
export const CommerceSystem = {
    /**
     * The Bank's price for one of an item: its **derived value** (CMS-132).
     *
     * ⚠️ This read used to be `item.baseValue`, a field **no item in `data/`
     * has ever carried** — so every item in the game sold for the fallback of
     * 1g, whatever it was and however long it took to make. `value` is the
     * field the economic simulator derives and writes, and reading it is what
     * turns the whole priced chain into money the player can actually receive.
     *
     * The fallback stays at 1 rather than 0 for safety: an item the simulator
     * could not price (no source, so `value: null`) is a content gap the CMS
     * audit raises as Critical, and a sale that silently paid nothing would
     * look like a bug in the Bank instead.
     *
     * @param {string} itemId
     * @returns {number}
     */
    getItemPrice(itemId) {
        const item = getItem(itemId);
        if (!item) return 0;

        return Number.isFinite(item.value) && item.value > 0 ? item.value : 1;
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
            // A sale announces itself through `currency_changed` and
            // `inventory_updated`, both of which have live subscribers. An
            // extra `item_sold` publish here had none, in `src/`, `cms/src/`
            // or the tests, and was deleted on 2026-08-24 (CR2-092).
            return { success: true, totalGold };
        }

        return { success: false, error: 'REMOVAL_FAILED' };
    }
};
