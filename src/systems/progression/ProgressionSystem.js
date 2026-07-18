import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { ensureAreaState, grantStarterDeckFor } from '../area/AreaStateManager.js';
import { logger } from '../../utils/Logger.js';

/**
 * ProgressionSystem
 * The definitive authority for World Progression and Discovery.
 * Evolves legacy fragmented logic into a centralized, scalable service.
 */
export const ProgressionSystem = {

    /**
     * Permanently unlock a new Area Set.
     *
     * (Map fragments and the exploration cost/counter were retired with
     * Quest System v2 — the quest boards own area unlocking now. Their
     * functions were deleted in the code-review Wave 5 sweep, CR-037.)
     */
    unlockArea(areaId) {
        if (!GameState.collection.unlockedAreaSets.includes(areaId)) {
            GameState.collection.unlockedAreaSets.push(areaId);

            // The starter deck is granted on UNLOCK, not when quest tracking
            // first materialized the area's state (CR-041).
            ensureAreaState(areaId);
            grantStarterDeckFor(areaId);

            logger.info('Progression', `Area unlocked: ${areaId}!`);
            EventBus.publish('area_unlocked', { areaSetId: areaId });
            EventBus.publish('state_changed');
            return true;
        }
        return false;
    }
};
