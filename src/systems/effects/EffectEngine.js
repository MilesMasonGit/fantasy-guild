import { AuraManager } from './AuraManager.js';
import { logger } from '../../utils/Logger.js';
import { EventBus } from '../core/EventBus.js';

/**
 * EffectEngine - Singleton manager for the unified effect system.
 */
class EffectEngine {
    constructor() {
        this.auraManager = new AuraManager();
        this.initialized = false;
    }

    /**
     * Initialize the engine and hooks
     */
    init() {
        if (this.initialized) return;
        
        logger.info('EffectEngine', 'Initializing Unified Effect Engine');
        
        // In the future, we will register event listeners here
        // e.g. GameEvents.on(EVENTS.GRID_CHANGED, () => this.pulse());

        this.initialized = true;
    }

    /**
     * Trigger a spatial logic pulse
     */
    pulse() {
        if (!this.initialized) this.init();
        this.auraManager.pulseGrid();
        EventBus.publish('effects_pulsed');
    }
}

// Singleton instance
export const effectEngine = new EffectEngine();
export default effectEngine;
