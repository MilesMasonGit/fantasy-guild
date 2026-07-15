import { GameState } from '../../state/GameState.js';
import { getQuestDefinition, getAreaQuests } from '../../config/registries/questRegistry.js';
import { MasterySystem } from './MasterySystem.js';
import { EventBus } from '../core/EventBus.js';
import * as TransactionProcessor from '../economy/TransactionProcessor.js';
import { logger } from '../../utils/Logger.js';
import { ProgressionSystem } from './ProgressionSystem.js';
import { QuestBoardSystem } from './QuestBoardSystem.js';
import { ObjectiveRegistry } from './logic/ObjectiveRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as CardManager from '../cards/CardManager.js';
import { getAllAreaSets } from '../../config/registries/areaSetRegistry.js';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';
import { ensureAreaState } from '../area/AreaStateManager.js';

/**
 * QuestTracker
 * Singleton manager that listens for game events and routes them to active quests.
 * Handles the lifecycle of quests: Acceptance, Progression, and Claiming.
 */
class QuestTrackerClass {
    /** 
     * Maximum number of concurrent quests 
     */
    MAX_ACTIVE_QUESTS = 5;

    /**
     * Start tracking a new quest
     */
    acceptQuest(areaId, questId) {
        if (USE_DECK_LOOP) {
            // §2G: unlock quests are auto-tracked per locked area — there is no
            // quest log to accept into. Retired with the legacy global path.
            logger.warn('QuestTracker', 'acceptQuest is retired under USE_DECK_LOOP.');
            return false;
        }
        const state = GameState.state;
        const currentQuests = state.globalQuests || [];

        if (currentQuests.length >= this.MAX_ACTIVE_QUESTS) {
            logger.warn('QuestTracker', `Accept quest failed: Quest log full.`);
            return false;
        }

        if (currentQuests.some(q => q.templateId === questId)) {
            logger.warn('QuestTracker', `Quest ${questId} is already active.`);
            return false;
        }

        const template = getQuestDefinition(questId);
        if (!template) {
            logger.error('QuestTracker', `Quest template ${questId} not found.`);
            return false;
        }

        const instanceId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newQuest = {
            id: instanceId,
            templateId: questId,
            areaId: areaId,
            progress: 0,
            max: template.maxProgress,
            status: 'active'
        };

        state.globalQuests = [...currentQuests, newQuest];
        logger.info('QuestTracker', `Accepted: ${template.name} in ${areaId}`);

        EventBus.publish('quest_state_changed');
        return true;
    }

    /**
     * Process an event and apply progress to matching active quests.
     * Pulse-Targeted Evolution: Replaces procedural switch with Registry evaluation.
     * Now unifies Legacy Global Quests and Physical Quest Cards.
     */
    processEvent(eventType, payload) {
        const state = GameState.state;
        let globalChanged = false;
        let cardsChanged = false;

        // Deck loop mode: authored quests here are the Main Story Quests of
        // locked areas (quest_system_concept.md); procedural quests advance
        // on the same event fan-out via QuestBoardSystem.
        if (USE_DECK_LOOP) {
            this._processUnlockQuests(eventType, payload);
            QuestBoardSystem.processEvent(eventType, payload);
            return;
        }

        // 1. Process Legacy Global Quests
        if (state.globalQuests?.length) {
            state.globalQuests = state.globalQuests.map(quest => {
                if (quest.status !== 'active') return quest;

                const template = getQuestDefinition(quest.templateId);
                if (!template || template.targetEvent !== eventType) return quest;

                const { isMatch, amount } = ObjectiveRegistry.evaluate(template, eventType, payload);
                if (isMatch && amount > 0) {
                    globalChanged = true;
                    const newProgress = Math.min(quest.max, quest.progress + amount);
                    const isNewlyCompleted = newProgress >= quest.max;
                    
                    if (isNewlyCompleted) logger.info('QuestTracker', `Global Quest complete: ${template.name}`);

                    return {
                        ...quest,
                        progress: newProgress,
                        status: isNewlyCompleted ? 'completed' : 'active'
                    };
                }
                return quest;
            });
        }

        // 2. Process Physical Quest Cards on Playmat
        if (state.cards?.active?.length) {
            state.cards.active.forEach(card => {
                // Determine if this is a quest card (starts with quest_ or has trait)
                if (!card.templateId?.startsWith('quest_') && !card.traits?.some(t => t.type === 'quest')) return;

                const template = getQuestDefinition(card.templateId);
                if (!template || template.targetEvent !== eventType) return;

                const { isMatch, amount } = ObjectiveRegistry.evaluate(template, eventType, payload);
                if (isMatch) {
                    cardsChanged = true;
                    const maxProgress = Math.max(1, template.maxProgress || 1);
                    
                    // NEW: If it's an item quest, sync with absolute inventory count
                    if (template.targetEvent === 'ON_ITEM_GAINED') {
                        card.progress = Math.min(maxProgress, InventoryManager.getItemCount(template.targetId));
                    } else if (amount > 0) {
                        // For non-item quests (kills, etc.), continue using incremental progress
                        card.progress = Math.min(maxProgress, (card.progress || 0) + amount);
                    }
                    
                    if (card.progress >= maxProgress) {
                        logger.info('QuestTracker', `Board Quest complete: ${template.name}`);
                    }

                    // Pulse for UI refresh
                    EventBus.publish('cards_progress_updated', { cardId: card.id, progress: card.progress });
                }
            });
        }

        if (globalChanged) {
            EventBus.publish('quest_state_changed');
        }
    }

    /**
     * §2G (USE_DECK_LOOP): advance the unlock quests of every still-locked area.
     *
     * A locked Area's unlock quests are authored in areas.json (`unlockQuestIds`,
     * derived in the CMS from each quest's Map Fragment Target). Progress lives in
     * areaStates[lockedAreaId].unlockQuestProgress — no quest card, no quest log.
     *
     * Completion is automatic the moment the objective is met. For "Gain Item"
     * quests this consumes the items (same turn-in economics as the old board
     * quest path). NOTE: auto-turn-in is provisional — Phase 6 decides how the
     * locked-area banner surfaces this, and may reintroduce a confirm step.
     */
    _processUnlockQuests(eventType, payload) {
        const unlockedSets = GameState.collection.unlockedAreaSets || [];

        for (const [areaId, areaSet] of Object.entries(getAllAreaSets())) {
            if (unlockedSets.includes(areaId)) continue;
            const questIds = areaSet.unlockQuestIds || [];
            if (!questIds.length) continue;

            const areaState = ensureAreaState(areaId);

            for (const questId of questIds) {
                if (areaState.completedQuestIds?.includes(questId)) continue;

                const template = getQuestDefinition(questId);
                if (!template || template.targetEvent !== eventType) continue;

                const { isMatch, amount } = ObjectiveRegistry.evaluate(template, eventType, payload);
                if (!isMatch) continue;

                const maxProgress = Math.max(1, template.maxProgress || 1);
                const progressMap = areaState.unlockQuestProgress || (areaState.unlockQuestProgress = {});

                if (template.targetEvent === 'ON_ITEM_GAINED') {
                    // Item quests track the absolute bank count (same as the old board path)
                    progressMap[questId] = Math.min(maxProgress, InventoryManager.getItemCount(template.targetId));
                } else if (amount > 0) {
                    progressMap[questId] = Math.min(maxProgress, (progressMap[questId] || 0) + amount);
                }

                EventBus.publish('quest_state_changed');

                // Under manual turn-in, we do not auto-complete the quest.
                // The player turns it in manually from the UI.
                // if ((progressMap[questId] || 0) >= maxProgress) {
                //     this._completeUnlockQuest(areaId, questId, template);
                // }
            }
        }
    }

    /**
     * Manually turn in a completed unlock quest.
     */
    completeUnlockQuestManual(areaId, questId) {
        const areaState = ensureAreaState(areaId);
        if (areaState.completedQuestIds?.includes(questId)) {
            logger.warn('QuestTracker', `Quest ${questId} already completed.`);
            return false;
        }

        const template = getQuestDefinition(questId);
        if (!template) {
            logger.warn('QuestTracker', `No definition for quest ${questId}.`);
            return false;
        }

        const maxProgress = Math.max(1, template.maxProgress || 1);
        let current = 0;

        if (template.targetEvent === 'ON_ITEM_GAINED') {
            current = InventoryManager.getItemCount(template.targetId);
        } else {
            current = areaState.unlockQuestProgress?.[questId] || 0;
        }

        if (current < maxProgress) {
            logger.warn('QuestTracker', `Cannot turn in quest ${questId}: progress is ${current}/${maxProgress}`);
            return false;
        }

        this._completeUnlockQuest(areaId, questId, template);
        return true;
    }

    /**
     * Complete one unlock quest: consume turn-in items, grant rewards, and
     * award a Map Fragment toward the locked area.
     */
    _completeUnlockQuest(areaId, questId, template) {
        const maxProgress = Math.max(1, template.maxProgress || 1);

        if (template.targetEvent === 'ON_ITEM_GAINED') {
            const invCount = InventoryManager.getItemCount(template.targetId);
            if (invCount < maxProgress) return; // Race guard — count changed since evaluation
            InventoryManager.removeItem(template.targetId, maxProgress);
        }

        if (template.rewards) {
            TransactionProcessor.apply({ entries: template.rewards, source: `Quest (${template.name})` });
        }

        const areaState = ensureAreaState(areaId);
        if (!areaState.completedQuestIds.includes(questId)) {
            areaState.completedQuestIds = [...areaState.completedQuestIds, questId];
        }
        if (areaState.unlockQuestProgress) {
            delete areaState.unlockQuestProgress[questId];
        }

        // Quest System v2 (2026-07-14): fragments are retired. This authored
        // quest is a Main Story Quest — completing it frees a board slot and
        // may satisfy the MSQ half of the area's unlock condition.
        logger.info('QuestTracker', `Story quest complete for "${areaId}": ${template.name}`);
        EventBus.publish('quest_completed', { templateId: questId, areaId });
        EventBus.publish('quest_state_changed');
        EventBus.publish('quest_board_updated');
        QuestBoardSystem.checkUnlock(areaId);
    }

    /**
     * Claim completed quest rewards.
     */
    claimQuest(instanceId) {
        if (USE_DECK_LOOP) {
            logger.warn('QuestTracker', 'claimQuest is retired under USE_DECK_LOOP (unlock quests auto-complete).');
            return false;
        }
        const state = GameState.state;
        const quest = state.globalQuests?.find(q => q.id === instanceId);
        if (!quest || quest.status !== 'completed') return false;

        const { areaId, templateId } = quest;
        const template = getQuestDefinition(templateId);

        // 1. Transaction: Remove and Award
        state.globalQuests = state.globalQuests.filter(q => q.id !== instanceId);
        
        // Award map fragments dynamically based on parent-child Area links
        const childAreas = Object.values(getAllAreaSets()).filter(set => set.parentAreaId === areaId);
        if (childAreas.length > 0) {
            childAreas.forEach(child => {
                ProgressionSystem.awardMapFragment(child.id, 1);
            });
        } else {
            // Fallback to the legacy target or quest's own areaId
            ProgressionSystem.awardMapFragment(template?.mapFragmentTarget || areaId, 1);
        }

        if (template?.rewards) {
            TransactionProcessor.apply({ entries: template.rewards, source: `Quest (${template.name})` });
        }

        // 2. State & Mastery Update
        if (state.areaStates?.[areaId]) {
            const areaState = state.areaStates[areaId];
            if (!areaState.completedQuestIds.includes(templateId)) {
                areaState.completedQuestIds = [...areaState.completedQuestIds, templateId];
            }
            MasterySystem.evaluateQuestMastery(areaId);
        }

        logger.debug('QuestTracker', `Claimed quest: ${templateId}`);
        EventBus.publish('quest_state_changed');
        return true;
    }

    /**
     * Complete a physical quest card on the board.
     * Handles resource consumption for "Collection" quests.
     */
    completeBoardQuest(cardId) {
        if (USE_DECK_LOOP) {
            // §2G: physical board quest cards no longer exist in deck loop mode.
            logger.warn('QuestTracker', 'completeBoardQuest is retired under USE_DECK_LOOP.');
            return false;
        }
        const state = GameState.state;
        const card = state.cards?.active?.find(c => c.id === cardId);
        if (!card) return false;

        const template = getQuestDefinition(card.templateId);
        if (!template) return false;

        const maxProgress = template.maxProgress || 1;
        const currentProgress = card.progress || 0;

        // 1. Validate Completion
        // Re-check inventory for item quests to prevent race conditions
        if (template.targetEvent === 'ON_ITEM_GAINED') {
            const invCount = InventoryManager.getItemCount(template.targetId);
            if (invCount < maxProgress) {
                logger.warn('QuestTracker', `Complete failed: Not enough ${template.targetId} (Have ${invCount}/${maxProgress})`);
                return false;
            }
            // Consume the resources
            InventoryManager.removeItem(template.targetId, maxProgress);
        } else {
            if (currentProgress < maxProgress) {
                logger.warn('QuestTracker', `Complete failed: Requirement not met (${currentProgress}/${maxProgress})`);
                return false;
            }
        }

        // 2. Grant Rewards
        const areaId = card.areaId || GameState.activeAreaId;
        const childAreas = Object.values(getAllAreaSets()).filter(set => set.parentAreaId === areaId);
        if (childAreas.length > 0) {
            childAreas.forEach(child => {
                ProgressionSystem.awardMapFragment(child.id, 1);
            });
        } else {
            ProgressionSystem.awardMapFragment(template.mapFragmentTarget || areaId, 1);
        }

        if (template.rewards) {
            TransactionProcessor.apply({ 
                entries: template.rewards, 
                source: `Quest: ${template.name}` 
            });
        }

        // 3. Update Mastery/Registry
        if (state.areaStates?.[areaId]) {
            const areaState = state.areaStates[areaId];
            if (!areaState.completedQuestIds.includes(template.id)) {
                areaState.completedQuestIds = [...areaState.completedQuestIds, template.id];
            }
            MasterySystem.evaluateQuestMastery(areaId);
        }

        // 4. Physical Cleanup
        CardManager.discardCard(cardId);
        
        logger.info('QuestTracker', `Completed Board Quest: ${template.name}`);
        EventBus.publish('quest_completed', { cardId, templateId: template.id });
        return true;
    }

    /**
     * Cancel an active quest
     */
    cancelQuest(instanceId) {
        const state = GameState.state;
        const initialLength = state.globalQuests?.length || 0;
        state.globalQuests = state.globalQuests?.filter(q => q.id !== instanceId);
        
        if (state.globalQuests?.length !== initialLength) {
            EventBus.publish('quest_state_changed');
            return true;
        }
        return false;
    }

    /**
     * Unified Draft logic: Returns a random subset of unavailable quests.
     */
    getDraftableQuests(areaId) {
        if (USE_DECK_LOOP) {
            // §2G: quests are not drafted/drawn in deck loop mode — each locked
            // area's unlock quests are always implicitly active.
            return [];
        }
        const state = GameState.state;
        const areaState = state.areaStates?.[areaId];
        const allAreaQuests = getAreaQuests(areaId);

        if (!allAreaQuests.length) return [];

        // 1. Quests currently active in the legacy global log
        const globalActiveIds = (state.globalQuests || []).map(q => q.templateId);
        
        // 2. Quests currently active as Physical Cards on the board
        const boardActiveIds = (state.cards?.active || [])
            .filter(c => c.templateId?.startsWith('quest_'))
            .map(c => c.templateId);
            
        // 3. Quests already completed/retired for this area
        const completedIds = areaState ? (areaState.completedQuestIds || []) : [];

        // Filter: Must not be global-active, board-active, or completed
        const pool = allAreaQuests.filter(q =>
            !globalActiveIds.includes(q.id) && 
            !boardActiveIds.includes(q.id) && 
            !completedIds.includes(q.id)
        );

        // Standardized Selection: Randomly pick up to 3 from the remaining valid pool
        return pool.sort(() => 0.5 - Math.random()).slice(0, 3);
    }
}

export const QuestTracker = new QuestTrackerClass();
