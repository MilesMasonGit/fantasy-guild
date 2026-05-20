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

        // 1. Card Discovery (New Tasks)

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


        this.initialized = true;
        logger.info('DiscoveryManager', 'Discovery Manager initialized (Card Encounter mode)');
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

            NotificationSystem.notify(`Unlock: ${enemyName}`, 'info', { category: 'discovery' });
            EventBus.publish('enemy_discovered', { enemyId, enemyName });
            EventBus.publish('state_changed', { source: 'enemy_discovery' });
            logger.info('DiscoveryManager', `Encountered new enemy: ${enemyId}`);
        }
    },

};
