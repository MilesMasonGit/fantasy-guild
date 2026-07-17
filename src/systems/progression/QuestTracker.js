import { GameState } from '../../state/GameState.js';
import { getQuestDefinition } from '../../config/registries/questRegistry.js';
import { EventBus } from '../core/EventBus.js';
import * as TransactionProcessor from '../economy/TransactionProcessor.js';
import { logger } from '../../utils/Logger.js';
import { QuestBoardSystem } from './QuestBoardSystem.js';
import { ObjectiveRegistry } from './logic/ObjectiveRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getAllAreaSets } from '../../config/registries/areaSetRegistry.js';
import { ensureAreaState } from '../area/AreaStateManager.js';

/**
 * QuestTracker
 * Singleton manager that listens for game events and routes them to active
 * quests. Authored quests are the Main Story Quests of locked areas
 * (quest_system_concept.md); procedural quests advance on the same event
 * fan-out via QuestBoardSystem.
 */
class QuestTrackerClass {
    /**
     * Process an event and apply progress to matching active quests.
     */
    processEvent(eventType, payload) {
        this._processUnlockQuests(eventType, payload);
        QuestBoardSystem.processEvent(eventType, payload);
    }

    /**
     * §2G: advance the unlock quests of every still-locked area.
     *
     * A locked Area's unlock quests are authored in areas.json (`unlockQuestIds`,
     * derived in the CMS from each quest's Map Fragment Target). Progress lives in
     * areaStates[lockedAreaId].unlockQuestProgress — no quest card, no quest log.
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
     * advance the locked area's unlock condition.
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
}

export const QuestTracker = new QuestTrackerClass();
