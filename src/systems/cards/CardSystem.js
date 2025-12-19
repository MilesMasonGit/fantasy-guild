/**
 * Fantasy Guild - Card System
 * Phase 10: Optimization & Infrastructure
 * 
 * Centralized system for processing all card ticks in a single O(N) loop.
 * Delegates to specific sub-systems based on card type.
 */

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { CARD_TYPES } from '../../config/registries/cardRegistry.js';
import { PROGRESS_UI_UPDATE_INTERVAL } from '../../config/constants.js';

// Sub-systems
import { TaskSystem } from '../task/TaskSystem.js';
import ExploreSystem from './ExploreSystem.js';
import AreaSystem from './AreaSystem.js';
import { CombatSystem } from '../combat/CombatSystem.js';


// Processor Map
const PROCESSORS = {
    [CARD_TYPES.TASK]: TaskSystem,
    [CARD_TYPES.EXPLORE]: ExploreSystem,
    [CARD_TYPES.AREA]: AreaSystem,
    [CARD_TYPES.COMBAT]: CombatSystem
};

const CardSystem = {
    initialized: false,
    tickCounter: 0,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.tickCounter = 0;
        logger.info('CardSystem', 'Initialized (Centralized Tick)');
    },

    /**
     * Main tick function - iterates all cards ONCE.
     * Centralized loop that delegates processing to specific sub-systems (Task, Explore, Area, Combat).
     * 
     * @param {number} deltaTime - Time in milliseconds since last frame
     */
    tick(deltaTime) {
        if (!deltaTime || isNaN(deltaTime)) return;

        this.tickCounter++;
        const activeCards = GameState.cards?.active || [];

        let taskProgressUpdated = false;

        for (const card of activeCards) {
            // Optimization: Skip cards without assigned heroes (except specific types if needed)
            // Most systems require a hero.
            if (!card.assignedHeroId) continue;

            const processor = PROCESSORS[card.cardType];
            if (processor && processor.processTick) {
                const updated = processor.processTick(card, deltaTime);
                if (updated && card.cardType === CARD_TYPES.TASK) {
                    taskProgressUpdated = true;
                }
            }
        }

        // Handle specific system update events

        // Task System Throttling
        if (taskProgressUpdated && this.tickCounter % PROGRESS_UI_UPDATE_INTERVAL === 0) {
            EventBus.publish('cards_progress_updated', { source: 'CardSystem' });
        }
    }
};

export default CardSystem;
