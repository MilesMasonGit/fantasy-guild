// Fantasy Guild - Discovery Manager
// Part of the Collection System (Codex)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';

/**
 * DiscoveryManager - Centralized discovery tracking for the Codex
 * 
 * Responsibilities:
 * - Listen for item gains, card sparks, and enemy kills
 * - Update GameState.collection.discovered[Items/Enemies]
 * - Update lifetime counts for Items and Enemies
 * - Notify player of new discoveries
 */
export const DiscoveryManager = {
    initialized: false,

    /**
     * Initialize listeners
     */
    init() {
        if (this.initialized) return;

        // 1. Listen for Item Gains (via InventoryManager)
        EventBus.subscribe('inventory_updated', (data) => {
            if (data.added && data.added > 0) {
                this.discoverItem(data.itemId, data.added);
            }
        });

        // 3. Listen for Enemy Encounters (Initial reveal in Bestiary)
        // Check for newly spawned cards (Tasks/Combat)
        EventBus.subscribe('card_spawned', (data) => {
            // Card template discovery (standard tasks)
            if (data.templateId) {
                this.discoverCard(data.templateId);
            }
            
            // Enemy encounter discovery (combat start)
            if (data.cardType === 'combat' && data.enemyId) {
                this.discoverEnemy(data.enemyId);
            }
        });
        
        // Listen for transformed task cards (ambushes)
        EventBus.subscribe('card_transformed', (data) => {
            if (data.enemyId) {
                this.discoverEnemy(data.enemyId);
            }
        });

        // 4. Listen for Enemy Kills (via CombatSystem)
        EventBus.subscribe('combat_victory', (data) => {
            if (data.enemyId) {
                this.recordEnemyKill(data.enemyId);
            }
        });

        this.initialized = true;
        logger.info('DiscoveryManager', 'Discovery Manager initialized and listening');
    },

    /**
     * Flag an item as discovered and update lifetime count
     * @param {string} itemId 
     * @param {number} amount 
     */
    discoverItem(itemId, amount = 1) {
        if (!GameState.state) return;

        const collection = GameState.state.collection;
        if (!collection) return;

        // Lifetime count update
        const currentCount = collection.itemLifetimeCounts[itemId] || 0;
        collection.itemLifetimeCounts[itemId] = currentCount + amount;

        // Discovery check
        if (!collection.discoveredItems[itemId]) {
            collection.discoveredItems[itemId] = true;
            
            const template = getItem(itemId);
            const itemName = template?.name || itemId;
            
            NotificationSystem.notify(`📜 New item discovered: ${itemName}!`, 'info');
            EventBus.publish('item_discovered', { itemId, itemName });
            EventBus.publish('state_changed', { source: 'item_discovery' });
            logger.info('DiscoveryManager', `Discovered new item: ${itemId}`);
        }
    },

    /**
     * Flag a card as discovered
     * @param {string} templateId 
     */
    discoverCard(templateId) {
        // Use CardCraftingSystem if available to maintain shared library state
        // (Library.tasks is the current source of truth for discovered templates)
        import('../cards/CardCraftingSystem.js').then(m => {
            const CCS = m.CardCraftingSystem;
            if (CCS && !CCS.isDiscovered(templateId)) {
                CCS.discoverCard(templateId);
            }
        }).catch(err => {
            logger.warn('DiscoveryManager', `Could not find CardCraftingSystem for ${templateId}`);
        });
    },

    /**
     * Flag an enemy as discovered in the Bestiary
     * @param {string} enemyId 
     */
    discoverEnemy(enemyId) {
        if (!GameState.state) return;

        const collection = GameState.state.collection;
        if (!collection) return;

        if (!collection.discoveredEnemies[enemyId]) {
            collection.discoveredEnemies[enemyId] = true;

            const template = getEnemy(enemyId);
            const enemyName = template?.name || enemyId;

            NotificationSystem.notify(`🛡️ Bestiary entry unlocked: ${enemyName}!`, 'info');
            EventBus.publish('enemy_discovered', { enemyId, enemyName });
            EventBus.publish('state_changed', { source: 'enemy_discovery' });
            logger.info('DiscoveryManager', `Encountered new enemy: ${enemyId}`);
        }
    },

    /**
     * Record an enemy kill
     * @param {string} enemyId 
     */
    recordEnemyKill(enemyId) {
        if (!GameState.state) return;

        const collection = GameState.state.collection;
        if (!collection) return;

        // Kill count update
        const currentKills = collection.enemyKillCounts[enemyId] || 0;
        collection.enemyKillCounts[enemyId] = currentKills + 1;

        // Ensure discovered (safety fallback if encounter event missed)
        if (!collection.discoveredEnemies[enemyId]) {
            this.discoverEnemy(enemyId);
        }
    }
};
