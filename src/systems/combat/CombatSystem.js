// Fantasy Guild - Combat System (Dispatcher)
// auditor Pass 1: Modularization & Stability

import * as TickProcessor from './logic/CombatTickProcessor.js';
import * as AttackProcessor from './logic/CombatAttackProcessor.js';
import * as ResolutionProcessor from './logic/CombatResolutionProcessor.js';
import { logger } from '../../utils/Logger.js';
import { CARD_TYPES } from '../../config/registries/cardRegistry.js';
import { GameState } from '../../state/GameState.js';

/**
 * CombatSystem - The core logic engine for combat card interactions.
 */
export const CombatSystem = {
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('CombatSystem', 'Combat system initialized');
    },

    processTick(card, deltaTime) {
        TickProcessor.processCombatTick(card, deltaTime);
    },

    // --- Tick Logic Exports ---
    processCombatTick: TickProcessor.processCombatTick,

    // --- Attack Logic Exports ---
    processHeroAttack: AttackProcessor.processHeroAttack,
    processEnemyAttack: AttackProcessor.processEnemyAttack,

    // --- Resolution Logic Exports ---
    handleVictory: ResolutionProcessor.handleVictory,
    handleDefeat: ResolutionProcessor.handleDefeat,
    _handleAreaVictory: ResolutionProcessor._handleAreaVictory,
    _handleInvasionVictory: ResolutionProcessor._handleInvasionVictory,
    _completeAreaGroup: ResolutionProcessor._completeAreaGroup,

    /**
     * Helper to find all cards currently in a combat state.
     */
    getActiveCombatCards() {
        if (!GameState.cards?.active) return [];
        return GameState.cards.active.filter(c => {
            if (!c.assignedHeroId) return false;
            return c.cardType === CARD_TYPES.COMBAT || (c.cardType === 'area' && c.phase === 'questing');
        });
    }
};

export default CombatSystem;
