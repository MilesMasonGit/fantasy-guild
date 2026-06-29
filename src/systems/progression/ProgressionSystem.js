import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { logger } from '../../utils/Logger.js';

/**
 * ProgressionSystem
 * The definitive authority for World Progression and Discovery.
 * Evolves legacy fragmented logic into a centralized, scalable service.
 */
export const ProgressionSystem = {

    /**
     * Award Map Fragments towards a specific target area.
     * Automatically triggers area unlocking if threshold is met.
     */
    awardMapFragment(targetAreaId, amount = 1) {
        if (!GameState.mapFragments[targetAreaId]) {
            GameState.mapFragments[targetAreaId] = 0;
        }
        
        GameState.mapFragments[targetAreaId] += amount;
        const currentFragments = GameState.mapFragments[targetAreaId];
        
        const areaSet = getAreaSet(targetAreaId);
        const fragmentsNeeded = areaSet ? (areaSet.totalFragments || 2) : 2;

        logger.info('Progression', `Map Fragment earned for ${targetAreaId}: ${currentFragments}/${fragmentsNeeded}`);

        // Notify UI of progression gain
        EventBus.publish('map_fragment_found', {
            targetAreaId,
            fragments: currentFragments,
            totalRequired: fragmentsNeeded,
        });

        // Trigger Area Unlock Check
        if (currentFragments >= fragmentsNeeded) {
            const newlyUnlocked = this.unlockArea(targetAreaId);
            if (newlyUnlocked) {
                // Trigger the high-fidelity Discovery Overlay
                EventBus.publish('ui:open_area_unlock_overlay', { areaId: targetAreaId });
            }
        }

        EventBus.publish('state_changed');
    },

    /**
     * Permanently unlock a new Area Set.
     */
    unlockArea(areaId) {
        if (!GameState.collection.unlockedAreaSets.includes(areaId)) {
            GameState.collection.unlockedAreaSets.push(areaId);
            
            logger.info('Progression', `Area unlocked: ${areaId}!`);
            EventBus.publish('area_unlocked', { areaSetId: areaId });
            EventBus.publish('state_changed');
            return true;
        }
        return false;
    },

    /**
     * Calculate the dynamic item cost for exploration scaling.
     * Evolves logic from legacy ExplorationManager.
     */
    getExplorationCost(areaId) {
        const areaState = GameState.state.areaStates[areaId];
        const setDef = getAreaSet(areaId);

        if (!areaState || !setDef) {
            logger.warn('Progression', `Invalid area state or definition for "${areaId}"`);
            return { itemTemplateId: 'wood_oak', requiredQuantity: 1 };
        }

        // Special handling for starting area
        if (areaId === 'area_guild_hall') {
            return { itemTemplateId: 'wood_oak', requiredQuantity: 1 };
        }

        const explorationConf = setDef.exploration;
        const pool = explorationConf?.itemPool || ['wood_oak'];
        
        // Randomly select an item type (DRAFT: Should this be deterministic for a specific count?)
        const itemTemplateId = pool[Math.floor(Math.random() * pool.length)];

        // Scaled cost: base(5) + (count * 5)
        const baseCost = 5;
        const scaleFactor = 5;
        const count = areaState.explorationCount || 0;
        const requiredQuantity = baseCost + (count * scaleFactor);

        return { itemTemplateId, requiredQuantity };
    },

    /**
     * Increment the exploration counter for an area.
     */
    incrementExploration(areaId) {
        const areaState = GameState.state.areaStates[areaId];
        if (!areaState) return;

        areaState.explorationCount = (areaState.explorationCount || 0) + 1;
        logger.debug('Progression', `Exploration incremented for ${areaId} to ${areaState.explorationCount}`);
        
        EventBus.publish('state_changed');
    }
};
