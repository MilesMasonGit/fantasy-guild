// Fantasy Guild - Module Processors (Dispatcher)
// Refactored to delegate trait logic to specialized logic/ processors.

import * as CardManager from './CardManager.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';

// Specialized Processors
import { processWorkCycle } from './logic/WorkProcessor.js';
import { processCombat } from './logic/CombatProcessor.js';
import { processQuest } from './logic/QuestProcessor.js';
import { recalculateAllCardStats } from './logic/StatProcessor.js';

// Re-exporting core APIs for backward compatibility
export { recalculateCardStats, recalculateAllCardStats } from './logic/StatProcessor.js';
export { incrementCollectionProgress } from './logic/QuestProcessor.js';

/**
 * Main dispatcher for modular card ticks
 * @param {Object} card 
 * @param {number} deltaTime 
 */
export function processModularTick(card, deltaTime) {
    if (!card.traits) return;

    for (const trait of card.traits) {
        switch (trait.type.toLowerCase()) {
            case 'workcycle':
                processWorkCycle(card, trait, deltaTime);
                break;
            case 'combat':
                processCombat(card, trait, deltaTime);
                break;
            case 'quest':
                processQuest(card, trait, deltaTime);
                break;
            case 'expiration':
                processExpiration(card, trait, deltaTime);
                break;
        }
    }
}

/**
 * Handle card expiration (self-destruction timer)
 * Kept in dispatcher as it is a fundamental system trait.
 */
function processExpiration(card, trait, deltaTime) {
    if (card.timeRemainingMs === undefined) {
        card.timeRemainingMs = trait.durationMs || 300000; // Default 5 mins
    }

    card.timeRemainingMs -= deltaTime;

    if (card.timeRemainingMs <= 0) {
        logger.info('ModuleProcessors', `Card ${card.id} (${card.name}) has expired.`);
        CardManager.discardCard(card.id);
        NotificationSystem.info(`${card.name} has finished.`);
    }
}

// Global Effect Subscription
EventBus.subscribe('effects_pulsed', () => {
    recalculateAllCardStats();
});

logger.info('ModuleProcessors', 'Dispatcher initialized with specialized sub-processors.');
