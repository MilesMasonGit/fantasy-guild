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

        const invalidateAll = () => {
            const activeCards = GameState.cards?.active || [];
            for (const card of activeCards) {
                card._dirtyStats = true;
                card._dirtyRequirements = true;
            }
        };

        // Event-driven stat and requirement invalidation triggers
        EventBus.subscribe('inventory_updated', invalidateAll);
        EventBus.subscribe('hero_assigned', invalidateAll);
        EventBus.subscribe('hero_unassigned', invalidateAll);
        EventBus.subscribe('tool_assigned', invalidateAll);
        EventBus.subscribe('tool_unassigned', invalidateAll);
        EventBus.subscribe('blueprint_assigned', invalidateAll);
        EventBus.subscribe('blueprint_unassigned', invalidateAll);
        EventBus.subscribe('heroes_updated', invalidateAll);
        EventBus.subscribe('active_area_changed', invalidateAll);
        EventBus.subscribe('threat_level_changed', invalidateAll);

        logger.info('CardSystem', 'Initialized (Modular Only with Event-Driven Cache)');
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
            EventBus.publish('cards_progress_updated', {
                source: 'CardSystem'
            });
        }
    }
};

export default CardSystem;

