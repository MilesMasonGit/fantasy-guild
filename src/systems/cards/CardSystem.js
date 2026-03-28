/**
 * Fantasy Guild - Card System
 * Unified Modular Tick Processing
 * 
 * Centralized system for processing all card ticks in a single O(N) loop.
 * All cards now use the modular trait system exclusively.
 */

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { getCard as getCardTemplate, CARD_TYPES } from '../../config/registries/cardRegistry.js';
import { PROGRESS_UI_UPDATE_INTERVAL } from '../../config/constants.js';
import { processModularTick } from './ModuleProcessors.js';
import { ensureModular } from './CardAssembler.js';

const CardSystem = {
    initialized: false,
    tickCounter: 0,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.tickCounter = 0;
        logger.info('CardSystem', 'Initialized (Modular Only)');
    },

    /**
     * Main tick function - iterates all cards ONCE.
     * All cards use the modular trait system for processing.
     * 
     * @param {number} deltaTime - Time in milliseconds since last frame
     */
    tick(deltaTime) {
        if (!deltaTime || isNaN(deltaTime)) return;

        this.tickCounter++;
        const activeCards = GameState.cards?.active || [];

        for (const card of activeCards) {
            // All cards now use modular processing
            if (card.traits) {
                processModularTick(card, deltaTime);
            }
        }

        // UI Update Throttling
        if (this.tickCounter % PROGRESS_UI_UPDATE_INTERVAL === 0) {
            // Bump revision for all cards to trigger UI re-renders (throttled)
            for (const card of activeCards) {
                if (card.status === 'active' || card.status === 'working') {
                    card._rev = (card._rev || 0) + 1;
                }
            }

            EventBus.publish('cards_progress_updated', {
                source: 'CardSystem',
                activeCards: activeCards
            });
        }
    }
};

export default CardSystem;

