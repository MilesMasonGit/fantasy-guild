import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
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

            // Areas are deleted by the 7×7 playmat rework — there is no area
            // state to create and no starter deck to grant, so the two calls
            // that used to live here are gone with `AreaStateManager`.
            //
            // This method survives only because the dormant quest system still
            // calls it (roadmap G-9). `unlockedAreaSets` is now an inert list
            // that nothing on the board reads. It goes when quests are resolved.

            logger.info('Progression', `Area unlocked: ${areaId}!`);
            EventBus.publish('area_unlocked', { areaSetId: areaId });
            EventBus.publish('state_changed');
            return true;
        }
        return false;
    }
};
