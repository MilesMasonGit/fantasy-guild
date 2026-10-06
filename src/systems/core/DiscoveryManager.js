// Discovery Manager: records enemies as encountered, for the Codex (Bestiary).

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { ENGINE_EVENTS } from './engineEvents.js';

/**
 * DiscoveryManager - Centralized discovery tracking for the Codex
 * 
 * Responsibilities — **enemies only**:
 * - Listen for combat attacks and record the enemy as encountered
 * - Update `GameState.collection.discoveredEnemies`
 * - Notify the player of a new Bestiary entry
 */
export const DiscoveryManager = {
    initialized: false,

    /**
     * Initialize listeners
     */
    init() {
        if (this.initialized) return;

        // Discover enemies when active combat starts/ticks
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (data) => {
            if (data.enemyId) {
                this.discoverEnemy(data.enemyId);
            }
        });

        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (data) => {
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

            // An enemy id IS a Token id, so the name comes from the Token registry.
            const template = getTokenType(enemyId);
            const enemyName = template?.name || enemyId;

            NotificationSystem.notify(`Unlock: ${enemyName}`, 'info', { category: 'discovery' });
            EventBus.publish(ENGINE_EVENTS.ENEMY_DISCOVERED, { enemyId, enemyName });
            EventBus.publish(ENGINE_EVENTS.STATE_CHANGED, { source: 'enemy_discovery' });
            logger.info('DiscoveryManager', `Encountered new enemy: ${enemyId}`);
        }
    },

};
