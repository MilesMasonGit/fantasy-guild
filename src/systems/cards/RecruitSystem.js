// Fantasy Guild - Recruit System
// Handles hero recruitment via the Bottom Drawer's Heroes tab (Phase 7).

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import { generateHero } from '../hero/HeroGenerator.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { calculateRecruitCost } from '../../utils/RecruitCostCalculator.js';
import { logger } from '../../utils/Logger.js';

/**
 * RecruitSystem - Drawer recruitment. Candidates persist in
 * state.recruitment so reopening the drawer can't reroll them for free
 * (the lock the old physical recruit card provided).
 */
export const RecruitSystem = {
    initialized: false,

    /**
     * Initialize the recruit system
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('RecruitSystem', 'Initialized');
    },

    /** @returns {Array} pending candidates (empty when none rolled) */
    getCandidates() {
        return GameState.state?.recruitment?.candidates || [];
    },

    /**
     * Generate 3 candidates if none are pending. Free — the Influence cost
     * is paid on hire.
     */
    rollCandidates() {
        if (!GameState.state.recruitment) GameState.state.recruitment = { candidates: [] };
        const rec = GameState.state.recruitment;
        if (rec.candidates.length > 0) return rec.candidates;
        rec.candidates = [generateHero(), generateHero(), generateHero()];
        EventBus.publish('recruitment_updated', {});
        logger.debug('RecruitSystem', 'Rolled 3 drawer recruitment candidates');
        return rec.candidates;
    },

    /**
     * Hire one pending candidate: spend Influence, add to the roster, dismiss
     * the other candidates. Refused outright when the roster is at its cap —
     * there is no bench to overflow onto (Hero Dock Phase 3).
     * @returns {Object} { success, hero?, error? }
     */
    hireCandidate(candidateId) {
        const rec = GameState.state?.recruitment;
        const index = (rec?.candidates || []).findIndex(h => h.id === candidateId);
        if (index === -1) return { success: false, error: 'Candidate not found' };

        // Checked BEFORE spending, so a full roster never costs the player
        // Influence and never silently loses the candidate.
        if (HeroManager.isRosterFull()) {
            return {
                success: false,
                error: 'Roster full — retire a hero or upgrade the Guild Hall to make room'
            };
        }

        const cost = this.getRecruitCost();
        if (!CurrencyManager.canAfford(cost)) {
            return { success: false, error: `Not enough Influence (need ${cost})` };
        }

        CurrencyManager.spendInfluence(cost, 'recruit');
        GameState.currency.totalRecruits = (GameState.currency.totalRecruits || 0) + 1;

        // addHero publishes hero_recruited + heroes_updated itself.
        const hero = HeroManager.addHero(rec.candidates[index]);
        rec.candidates = [];
        EventBus.publish('recruitment_updated', {});

        logger.info('RecruitSystem', `Hired ${hero.name} from the drawer for ${cost} Influence`);
        return { success: true, hero };
    },

    /**
     * Returns current recruit cost based on completed Projects
     * @returns {number}
     */
    getRecruitCost() {
        return calculateRecruitCost();
    }
};
