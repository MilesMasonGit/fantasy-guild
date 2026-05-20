import { GameState } from '../../state/GameState.js';
import * as CardManager from '../cards/CardManager.js';
import { QuestTracker } from './QuestTracker.js';
import { logger } from '../../utils/Logger.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { ProgressionSystem } from '../progression/ProgressionSystem.js';

/**
 * ExplorationManager
 * Handles the creation, scaling, and resolution of Explore Cards.
 * Delegates meta-state and cost scaling to the ProgressionSystem.
 */
class ExplorationManagerClass {

    /**
     * Spawns an Explore Card for the specified area.
     * Delegates cost calculation to the ProgressionSystem.
     */
    spawnExploreCard(areaId) {
        const setDef = getAreaSet(areaId);
        if (!setDef) {
            NotificationSystem.error('Cannot find area definition.');
            return;
        }

        const exploreCardId = setDef.exploration?.cardId 
            ? setDef.exploration.cardId 
            : `explore_${areaId.split('_')[0]}`;

        // 1. Prevent duplicate active exploration
        const activeCards = CardManager.getActiveCards();
        const existingCard = activeCards.find(c => 
            c.templateId === exploreCardId || 
            (c.cardType === 'explore' && c.areaId === areaId)
        );

        if (existingCard) {
            NotificationSystem.error(`Already exploring this area!`);
            return;
        }

        // 2. Delegate dynamic item cost calculation
        const costConfig = ProgressionSystem.getExplorationCost(areaId);

        // 3. Create the card
        CardManager.createCard(
            exploreCardId,
            {
                overrides: {
                    config: {
                        requiredItem: costConfig.itemTemplateId,
                        requiredQuantity: costConfig.requiredQuantity,
                    },
                    areaId: areaId
                }
            },
            true // force spawn
        );
    }

    /**
     * Finalize exploration upon quest selection.
     */
    onQuestSelected(areaId, cardInstance, questId) {
        // 1. Delegate meta-state increment to ProgressionSystem
        ProgressionSystem.incrementExploration(areaId);

        // 2. Accept the quest if selected
        if (questId) {
            QuestTracker.acceptQuest(areaId, questId);
        }

        // 3. Cleanup the Explore card
        const heroId = cardInstance.assignedHeroId;
        if (heroId) {
            CardManager.unassignHero(cardInstance.id);
        }

        CardManager.discardCard(cardInstance.id);
    }
}

export const ExplorationManager = new ExplorationManagerClass();
