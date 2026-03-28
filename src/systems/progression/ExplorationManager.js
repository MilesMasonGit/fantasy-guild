// Fantasy Guild - Exploration Manager
// Phase 2: Exploration & Mastery

import { GameState } from '../../state/GameState.js';
import * as CardManager from '../cards/CardManager.js';
import { QuestTracker } from './QuestTracker.js';
import { logger } from '../../utils/Logger.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';

/**
 * ExplorationManager
 * Handles the creation, scaling, and resolution of Explore Cards,
 * and presenting quests to the player upon completion.
 */
class ExplorationManagerClass {

    /**
     * Define the randomized item pools required by Area for explore cards.
     * Each exploration requires ONE of these item types.
     */
    exploreItemPools = {
        guild_hall_v1: ['wood_oak', 'stone', 'copper_ore', 'coal'], // Default fallback items for testing
        forest_v1: ['wood_oak', 'red_berry', 'copper_ore', 'coal'], // Appropriate early resources
        mountain_v1: ['stone', 'copper_ore', 'coal'], // Mining resources
    };

    /**
     * Define the specific explore card ID for each area
     */
    exploreCardMap = {
        guild_hall_v1: 'explore_abandoned_guild_hall',
        forest_v1: 'explore_forest',
        mountain_v1: 'explore_mountain',
    };

    /**
     * Calculate the cost for the next Explore Card in a specific area
     * @param {string} areaId
     * @returns {{ itemTemplateId: string, requiredQuantity: number } | null}
     */
    calculateExploreCost(areaId) {
        const state = GameState.state;
        const areaState = state.areaStates[areaId];

        if (!areaState) {
            logger.warn('ExplorationManager', `No state found for area "${areaId}"`);
            return null;
        }

        if (areaId === 'guild_hall_v1') {
            return { itemTemplateId: 'wood_oak', requiredQuantity: 1 };
        }

        // 1. Determine base items for this area
        const pool = this.exploreItemPools[areaId] || ['wood_oak']; // Fallback

        // 2. Randomly select an item type
        const itemTemplateId = pool[Math.floor(Math.random() * pool.length)];

        // 3. Calculate scaled cost: base (5) + (explorationCount * 5)
        // Adjust these numbers based on balance testing.
        const baseCost = 5;
        const scaleFactor = 5;
        const requiredQuantity = baseCost + ((areaState.explorationCount || 0) * scaleFactor);

        return { itemTemplateId, requiredQuantity };
    }

    /**
     * Spawns an Explore Card for the specified area.
     * Calculates the dynamic item cost and adds it to the card's config.
     * @param {string} areaId 
     */
    spawnExploreCard(areaId) {
        const costConfig = this.calculateExploreCost(areaId);

        let itemName = 'Supplies';
        if (costConfig && costConfig.itemTemplateId) {
            const itemDef = getItem(costConfig.itemTemplateId);
            if (itemDef) itemName = itemDef.name;
        }

        const exploreCardId = this.exploreCardMap[areaId] || `explore_${areaId.split('_')[0]}`;

        CardManager.createCard(
            exploreCardId,
            {
                overrides: {
                    config: {
                        requiredItem: costConfig?.itemTemplateId || 'wood',
                        requiredQuantity: costConfig?.requiredQuantity || 5,
                    },
                    areaId: areaId
                }
            },
            true // force spawn even if unique limit reached (we handle cleanup)
        );

        // NotificationSystem removed as CardManager usually handles creation sounds, 
        // but we can add one if desired.
    }

    /**
     * Logic to execute when a player selects a quest from a completed Explore card.
     * @param {string} areaId 
     * @param {Object} cardInstance - The completed Explore Card instance
     * @param {string|null} questId - The ID of the quest selected (null if cancelled/concluded)
     */
    onQuestSelected(areaId, cardInstance, questId) {
        const state = GameState.state;
        const areaState = state.areaStates[areaId];

        if (areaState) {
            // Increment exploration count for next time
            if (typeof areaState.explorationCount === 'number') {
                areaState.explorationCount += 1;
            } else {
                areaState.explorationCount = 1;
            }
            logger.info('ExplorationManager', `Exploration completed in ${areaId}. Count is now ${areaState.explorationCount}.`);
        }

        // Accept the quest if one was selected
        if (questId) {
            QuestTracker.acceptQuest(areaId, questId);
        }

        // Destroy the Explore card
        // 1. Unassign hero
        const heroSlot = cardInstance.heroSlots?.[0] || cardInstance.assignedHeroId;
        if (heroSlot) {
            CardManager.unassignHero(cardInstance.id, 0);
        }

        // 2. Discard card (removes from board)
        CardManager.discardCard(cardInstance.id);
    }
}

export const ExplorationManager = new ExplorationManagerClass();
