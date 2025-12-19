// Fantasy Guild - Durability System
// Phase 38: Durability & Tool System

import { InventoryManager } from '../inventory/InventoryManager.js';
import * as CardManager from '../cards/CardManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { EventBus } from '../core/EventBus.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * DurabilitySystem - Handles tool degradation and replacement
 * 
 * Logic:
 * - Tools assigned to tasks track "local durability" on the card.
 * - When local durability depletes, one item is consumed from the player's inventory stack.
 * - If the stack is empty, the tool slot is cleared and the task stops.
 */
export const DurabilitySystem = {

    /**
     * Process durability loss for a tool in a card slot
     * @param {Object} cardInstance - The active card
     * @param {number} slotIndex - The input slot index containing the tool
     * @param {number} amount - Amount of durability to lose (default 1)
     * Process tool durability decay
     * @param {Object} cardInstance 
     * @param {number} slotIndex 
     * @param {number} amount - Amount to degrade (float supported)
     * @returns {boolean} true if tool is still usable/replaced, false if broken and empty
     */
    tickDurability(cardInstance, slotIndex, amount = 1) {
        const itemId = cardInstance.assignedItems[slotIndex];
        if (!itemId) return true; // No item to decay

        const result = InventoryManager.decrementDurability(itemId, amount);

        if (result.depleted) {
            // Stack Empty - Tool Broke fully
            // Card logic handles this removal
            this.breakTool(cardInstance, slotIndex, getItem(itemId));
            return false;
        }

        if (result.broke) {
            // Tool cycled, but we have more. Logic continues.
            logger.info('DurabilitySystem', `Tool cycled: ${itemId}`);
        }

        return true;
    },

    /**
     * Break tool (removes from slot)
     * @param {Object} cardInstance 
     * @param {number} slotIndex 
     * @param {Object} itemTemplate 
     */
    breakTool(cardInstance, slotIndex, itemTemplate) {
        cardInstance.assignedItems[slotIndex] = null;
        NotificationSystem.warning(`Tool broken: ${itemTemplate.name} (Out of stock!)`);
        EventBus.publish('card_updated', { cardId: cardInstance.id });
        CardManager.setCardStatus(cardInstance.id, 'paused');
    },

    /**
     * Get durability percentage for display
     * Uses the SHARED INVENTORY durability system.
     * @param {Object} cardInstance 
     * @param {number} slotIndex 
     * @returns {number} 0-100
     */
    getDurabilityPercent(cardInstance, slotIndex) {
        const itemId = cardInstance?.assignedItems?.[slotIndex];
        if (!itemId) return 0;

        const template = getItem(itemId);
        if (!template?.maxDurability) return 100;

        // Read durability from INVENTORY (shared durability system)
        const currentDur = InventoryManager.getDurability(itemId);
        if (currentDur === null) return 100; // No durability data = assume full

        return Math.max(0, Math.min(100, (currentDur / template.maxDurability) * 100));
    }
};
