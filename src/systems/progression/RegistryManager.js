import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';

/**
 * RegistryManager - Manages discoveries, collection log, and navigation history for the Library.
 * Handles the "Global Knowledge" propagation and "New!" badge lifecycle.
 */
export const RegistryManager = {
    /**
     * Records that an item has been gained and updates discovery/lifetime stats.
     * @param {string} itemId 
     * @param {number} amount 
     * @param {string|null} sourceId - The cardTemplateId or enemyId that produced this item
     */
    recordItemGain(itemId, amount = 1, sourceId = null) {
        if (!itemId || !GameState.state) return;
        
        const collection = GameState.state.collection;
        if (!collection) return;

        // 1. Discovery (Global Knowledge)
        let isNew = false;
        if (!collection.discoveredItems[itemId]) {
            collection.discoveredItems[itemId] = true;
            isNew = true;
            logger.info('Registry', `New item discovered: ${itemId}`);
        }

        // 2. Provenance (Source Discovery)
        if (sourceId) {
            if (!collection.provenance) collection.provenance = {};
            if (!collection.provenance[sourceId]) collection.provenance[sourceId] = {};
            
            if (!collection.provenance[sourceId][itemId]) {
                collection.provenance[sourceId][itemId] = true;
                logger.info('Registry', `New provenance discovered: ${itemId} from ${sourceId}`);
            }
        }

        // 3. Lifetime Count
        const counts = collection.itemLifetimeCounts || {};
        const currentCount = counts[itemId] || 0;
        counts[itemId] = currentCount + amount;
        collection.itemLifetimeCounts = counts;

        // 4. Side Effects
        if (isNew) {
            // Track "New!" badge state (dismissed on hover in UI)
            if (!GameState.state.ui.newDiscoveries) GameState.state.ui.newDiscoveries = {};
            GameState.state.ui.newDiscoveries[itemId] = true;
            
            const template = getItem(itemId);
            const itemName = template?.name || itemId;
            NotificationSystem.notify(`Unlock: ${itemName}`, 'info', { category: 'discovery' });

            EventBus.publish('item_discovered', { itemId, itemName });
        }
        
        EventBus.publish('registry_updated', { type: 'item', id: itemId });
        EventBus.publish('state_changed');
    },

    /**
     * Checks if an item has been discovered from a specific source.
     * @param {string} sourceId 
     * @param {string} itemId 
     * @returns {boolean}
     */
    isLootDiscovered(sourceId, itemId) {
        if (!sourceId || !itemId) return false;
        return GameState.state?.collection?.provenance?.[sourceId]?.[itemId] === true;
    },

    /**
     * Records that an enemy has been defeated.
     * @param {string} enemyId 
     */
    recordEnemyDefeat(enemyId) {
        if (!enemyId || !GameState.state) return;

        const collection = GameState.state.collection;
        if (!collection) return;

        // 1. Discovery (Global Knowledge)
        let isNew = false;
        if (!collection.discoveredEnemies[enemyId]) {
            collection.discoveredEnemies[enemyId] = true;
            isNew = true;
            logger.info('Registry', `New enemy discovered: ${enemyId}`);
        }

        // 2. Kill Count
        const counts = collection.enemyKillCounts || {};
        const currentCount = counts[enemyId] || 0;
        counts[enemyId] = currentCount + 1;
        collection.enemyKillCounts = counts;

        // 3. Side Effects
        if (isNew) {
            if (!GameState.state.ui.newDiscoveries) GameState.state.ui.newDiscoveries = {};
            GameState.state.ui.newDiscoveries[enemyId] = true;

            const template = getEnemy(enemyId);
            const enemyName = template?.name || enemyId;
            NotificationSystem.notify(`Unlock: ${enemyName}`, 'info', { category: 'discovery' });

            EventBus.publish('enemy_discovered', { enemyId, enemyName });
        }

        EventBus.publish('registry_updated', { type: 'enemy', id: enemyId });
        EventBus.publish('state_changed');
    },

    /**
     * Marks a discovery as "seen" (clears the New! badge).
     * @param {string} entityId 
     */
    markAsSeen(entityId) {
        if (GameState.state?.ui?.newDiscoveries?.[entityId]) {
            delete GameState.state.ui.newDiscoveries[entityId];
            EventBus.publish('discovery_seen', { entityId });
        }
    },

    /**
     * Navigation History (Session-based, not persisted in GameState)
     * Supports the "Browser-style" back/forward buttons requested by the user.
     */
    _history: [],
    _historyIndex: -1,

    pushHistory(mode, id, metadata = {}) {
        // If we are moving forward after a "Back", truncate the future
        if (this._historyIndex < this._history.length - 1) {
            this._history = this._history.slice(0, this._historyIndex + 1);
        }

        this._history.push({ mode, id, metadata });
        this._historyIndex = this._history.length - 1;
        
        // Limit history size to 50 steps
        if (this._history.length > 50) {
            this._history.shift();
            this._historyIndex--;
        }
    },

    popHistory() {
        if (this._historyIndex > 0) {
            this._historyIndex--;
            return this._history[this._historyIndex];
        }
        return null;
    },

    peekHistory() {
        return this._history[this._historyIndex] || null;
    },

    canGoBack() {
        return this._historyIndex > 0;
    },

    canGoForward() {
        return this._historyIndex < this._history.length - 1;
    },

    goForward() {
        if (this.canGoForward()) {
            this._historyIndex++;
            return this._history[this._historyIndex];
        }
        return null;
    },

    clearHistory() {
        this._history = [];
        this._historyIndex = -1;
    }
};
