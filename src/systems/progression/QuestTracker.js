// Fantasy Guild - Quest Tracker
// Phase 2: Exploration & Mastery

import { GameState } from '../../state/GameState.js';
import { getQuestDefinition, getAreaQuests } from '../../config/registries/questRegistry.js';
import { MasterySystem } from './MasterySystem.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';

/**
 * QuestTracker
 * Singleton manager that listens for game events and routes them to active quests.
 * Handles the lifecycle of quests: Acceptance, Progression, and Claiming.
 */
class QuestTrackerClass {
    /** 
     * Maximum number of concurrent quests the player can have active globally 
     */
    MAX_ACTIVE_QUESTS = 5;

    /**
     * Start tracking a new quest
     * @param {string} areaId - The area this quest belongs to
     * @param {string} questId - The ID from QUEST_REGISTRY
     * @returns {boolean} True if successfully added
     */
    acceptQuest(areaId, questId) {
        const state = GameState.state;

        if (state.globalQuests.length >= this.MAX_ACTIVE_QUESTS) {
            logger.warn('QuestTracker', `Cannot accept quest ${questId}: Quest log full.`);
            return false;
        }

        // Prevent duplicate active quests
        if (state.globalQuests.some(q => q.templateId === questId)) {
            logger.warn('QuestTracker', `Quest ${questId} is already active.`);
            return false;
        }

        const template = getQuestDefinition(questId);
        if (!template) {
            logger.error('QuestTracker', `Quest template ${questId} not found.`);
            return false;
        }

        // Generate unique instance ID
        const instanceId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const newQuest = {
            id: instanceId,
            templateId: questId,
            areaId: areaId,
            progress: 0,
            max: template.maxProgress,
            status: 'active' // 'active', 'completed', 'claimed'
        };

        state.globalQuests.push(newQuest);
        logger.info('QuestTracker', `Accepted quest: ${template.name} (${areaId})`);

        EventBus.publish('quest_state_changed');
        return true;
    }

    /**
     * Process an event and apply progress to matching active quests
     * @param {string} eventType - e.g., 'ON_ENEMY_KILLED', 'ON_ITEM_GAINED'
     * @param {Object} payload - Event details (e.g., { enemyId: 'wolf' }, { itemId: 'wood', amount: 5 })
     */
    processEvent(eventType, payload) {
        const state = GameState.state;
        if (!state.globalQuests || state.globalQuests.length === 0) return;

        let needsStateUpdate = false;

        for (const quest of state.globalQuests) {
            // Skip finished quests
            if (quest.status !== 'active') continue;

            const template = getQuestDefinition(quest.templateId);
            if (!template) continue;

            // Does the event type match?
            if (template.targetEvent !== eventType) continue;

            let isMatch = false;
            let amountToAdd = 1;

            // 1. Evaluate specific event types
            switch (eventType) {
                case 'ON_ENEMY_KILLED':
                    if (template.targetId === 'any' || template.targetId === payload.enemyId) {
                        isMatch = true;
                    }
                    break;
                case 'ON_ITEM_GAINED':
                    if (template.targetId === 'any' || template.targetId === payload.itemId) {
                        isMatch = true;
                        amountToAdd = payload.amount || 1;
                    }
                    break;
                case 'ON_CRAFT_COMPLETED':
                    if (template.targetId === 'any' || template.targetId === payload.recipeId) {
                        isMatch = true;
                    }
                    break;
            }

            // 2. Apply progress if matched
            if (isMatch) {
                quest.progress = Math.min(quest.max, quest.progress + amountToAdd);
                needsStateUpdate = true;

                logger.debug('QuestTracker', `Quest ${template.name} progressed to ${quest.progress}/${quest.max}`);

                // Check for completion
                if (quest.progress >= quest.max) {
                    quest.status = 'completed';
                    logger.info('QuestTracker', `Quest ${template.name} ready to claim!`);
                    // Note: We don't auto-claim. The user manually clicks "Claim" in the UI.
                }
            }
        }

        if (needsStateUpdate) {
            EventBus.publish('quest_state_changed');
        }
    }

    /**
     * Cancel an active quest to free up a slot
     * @param {string} instanceId 
     */
    cancelQuest(instanceId) {
        const state = GameState.state;
        const index = state.globalQuests.findIndex(q => q.id === instanceId);

        if (index !== -1) {
            const quest = state.globalQuests[index];
            state.globalQuests.splice(index, 1);
            logger.info('QuestTracker', `Cancelled quest instance: ${instanceId}`);

            // Re-render UI
            EventBus.publish('quest_state_changed');
            return true;
        }
        return false;
    }

    /**
     * Claim completed quest rewards (Map Fragments) and move to area completed cache
     * @param {string} instanceId 
     */
    claimQuest(instanceId) {
        const state = GameState.state;
        const index = state.globalQuests.findIndex(q => q.id === instanceId);

        if (index === -1) return false;

        const quest = state.globalQuests[index];
        if (quest.status !== 'completed') {
            logger.warn('QuestTracker', `Cannot claim incomplete quest ${instanceId}`);
            return false;
        }

        const areaId = quest.areaId;
        const templateId = quest.templateId;

        // 1. Remove from active roster
        state.globalQuests.splice(index, 1);

        // 2. Grant 1 Map Fragment to inventory
        if (!state.inventory.items['map_fragment']) {
            state.inventory.items['map_fragment'] = { quantity: 0 };
        }
        state.inventory.items['map_fragment'].quantity += 1;

        // 3. Move to Area's completed tracking array (for Mastery)
        if (state.areaStates && state.areaStates[areaId]) {
            const areaState = state.areaStates[areaId];
            if (!areaState.completedQuestIds.includes(templateId)) {
                areaState.completedQuestIds.push(templateId);
            }

            // Trigger Mastery check for quests
            // TODO: import { MasterySystem } from './MasterySystem.js';
            // MasterySystem.evaluateQuestMastery(areaId);
        }

        logger.info('QuestTracker', `Claimed quest ${templateId}. Awarded 1 Map Fragment.`);

        // Notify UI
        EventBus.publish('quest_state_changed');
        return true;
    }

    /**
     * Helper for ExplorationManager to get 3 random available quests
     * @param {string} areaId 
     * @returns {Array} Array of 3 quest definition objects
     */
    getDraftableQuests(areaId) {
        const state = GameState.state;
        const areaState = state.areaStates[areaId];
        const allAreaQuests = getAreaQuests(areaId);

        if (!allAreaQuests.length) return [];

        // Filter out quests already active
        const activeIds = (state.globalQuests || []).map(q => q.templateId);
        // Filter out quests already completed in this area
        const completedIds = areaState ? (areaState.completedQuestIds || []) : [];

        const availableQuests = allAreaQuests.filter(q =>
            !activeIds.includes(q.id) && !completedIds.includes(q.id)
        );

        // Shuffle
        const shuffled = [...availableQuests].sort(() => 0.5 - Math.random());

        // Return up to 3
        return shuffled.slice(0, 3);
    }
}

export const QuestTracker = new QuestTrackerClass();
