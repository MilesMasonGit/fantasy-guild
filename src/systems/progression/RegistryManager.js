import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * RegistryManager - discoveries and lifetime item counts.
 */
export const RegistryManager = {
    /**
     * Records that an item has been gained and updates discovery/lifetime stats.
     * @param {string} itemId 
     * @param {number} amount 
     */
    recordItemGain(itemId, amount = 1) {
        if (!itemId || !GameState.state) return;
        
        const collection = GameState.state.collection;
        if (!collection) return;

        let isNew = false;
        if (!collection.discoveredItems[itemId]) {
            collection.discoveredItems[itemId] = true;
            isNew = true;
            logger.info('Registry', `New item discovered: ${itemId}`);
        }

        const counts = collection.itemLifetimeCounts || {};
        const currentCount = counts[itemId] || 0;
        counts[itemId] = currentCount + amount;
        collection.itemLifetimeCounts = counts;

        if (isNew) {
            const template = getItem(itemId);
            const itemName = template?.name || itemId;
            EventBus.publish(ENGINE_EVENTS.ITEM_DISCOVERED, { itemId, itemName });
        }
    }
};
