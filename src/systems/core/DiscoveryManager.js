// Fantasy Guild - Discovery Manager
// Part of the Collection System (Codex)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';

/**
 * DiscoveryManager - Centralized discovery tracking for the Codex
 * 
 * Responsibilities — **enemies only**:
 * - Listen for combat attacks and record the enemy as encountered
 * - Update `GameState.collection.discoveredEnemies`
 * - Notify the player of a new Bestiary entry
 *
 * ⚠️ This header used to claim it also listened for item gains and kept
 * lifetime counts for Items. **It does neither** — `RegistryManager` owns both
 * (corrected 2026-08-26, CR2-046).
 */
export const DiscoveryManager = {
    initialized: false,

    /**
     * Initialize listeners
     */
    init() {
        if (this.initialized) return;

        // A third subscription — to `card_spawned` — sat here until 2026-08-26
        // (CR2-046). Cards are retired and nothing published it, so that branch
        // was unreachable. The Bestiary works from the two combat events below.

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
