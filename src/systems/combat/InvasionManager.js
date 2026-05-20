// Fantasy Guild - Invasion Manager (Dispatcher)
// auditor Pass 1: Modularization & Stability

import * as Spawner from './logic/InvasionSpawner.js';
import * as ThreatProcessor from './logic/InvasionThreatProcessor.js';
import * as ResolutionProcessor from './logic/InvasionResolutionProcessor.js';
import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';

/**
 * InvasionManager - Handles the lifecycle and escalation of invasion events.
 */
export const InvasionManager = {
    initialized: false,

    init() {
        if (this.initialized) return;

        // Initialize state if missing
        if (!GameState.invasions) {
            GameState.invasions = {
                active: {}, // { cardId: { threat: 0, count: 50, invasionId: '...' } }
                globalThreats: {} // { debuffId: totalStacks }
            };
        }

        // Subscribe to logic-layer victory events for casualty tracking
        EventBus.subscribe('combat_victory', (data) => {
            this.handleEnemyDefeated(data.cardId);
        });

        this.initialized = true;
        logger.info('InvasionManager', 'Initialized');
    },

    // --- Spawning Logic Exports ---
    startInvasion: Spawner.startInvasion,

    // --- Threat Logic Exports ---
    processTick: ThreatProcessor.processTick,
    checkMilestones: ThreatProcessor.checkMilestones,
    updateGlobalThreats: ThreatProcessor.updateGlobalThreats,

    // --- Resolution Logic Exports ---
    handleEnemyDefeated: (cardId) => ResolutionProcessor.handleEnemyDefeated(cardId),
    completeInvasion: ResolutionProcessor.completeInvasion
};

export default InvasionManager;
