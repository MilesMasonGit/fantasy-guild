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

        // Card discovery is implicit from collection.playsets (§5H) — only
        // enemy encounters (Bestiary) are tracked here.
        EventBus.subscribe('card_spawned', (data) => {
            // Enemy encounter discovery (combat start)
            if ((data.cardType === 'combat' || data.cardType === 'invasion') && data.enemyId) {
                this.discoverEnemy(data.enemyId);
            }
        });

        // Discover enemies when active combat starts/ticks
        EventBus.subscribe('combat_hero_attack', (data) => {
            if (data.enemyId) {
                this.discoverEnemy(data.enemyId);
            }
        });

        EventBus.subscribe('combat_enemy_attack', (data) => {
            if (data.enemyId) {
                this.discoverEnemy(data.enemyId);
            }
        });

        this.initialized = true;
        logger.info('DiscoveryManager', 'Discovery Manager initialized (Card Encounter and Combat mode)');
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
