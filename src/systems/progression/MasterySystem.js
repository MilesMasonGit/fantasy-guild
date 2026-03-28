// Fantasy Guild - Mastery System
// Phase 2: Exploration & Mastery

import { GameState } from '../../state/GameState.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { getAreaQuests } from '../../config/registries/questRegistry.js';
import { EventBus } from '../core/EventBus.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * MasterySystem
 * Evaluates Area mastery tiers and provides active mastery bonuses.
 */
class MasterySystemClass {
    /**
     * Re-evaluate set mastery progress 
     * Called whenever a new card is permanently acquired/reconciled into the Library.
     * @param {string} areaId 
     * @returns {boolean} True if state changed (new mastery tier hit)
     */
    evaluateSetMastery(areaId) {
        const state = GameState.state;
        const areaState = state.areaStates[areaId];
        if (!areaState) return false;

        const setDef = getAreaSet(areaId);
        if (!setDef || !setDef.deckList) return false;

        // Count how many unique card copies we technically 'need' vs 'have'
        // For standard sets, Set Mastery happens when library playsets equal the area's expected copies.
        let totalNeeded = 0;
        let totalFound = 0;

        for (const [cardId, targetCount] of Object.entries(setDef.deckList)) {
            totalNeeded += targetCount;
            // Phase 2 Collection Progress lookup (updated by Library logic when opening packs)
            const countHave = areaState.collectionProgress[cardId] || 0;
            // We cap what counts towards mastery at the target count
            totalFound += Math.min(countHave, targetCount);
        }

        if (totalNeeded > 0 && totalFound >= totalNeeded) {
            if (!areaState.mastery.setMasteryUnlocked) {
                areaState.mastery.setMasteryUnlocked = true;
                logger.info('MasterySystem', `Set Mastery Unlocked for Area: ${areaId}`);
                NotificationSystem.success(`Set Mastery Unlocked for ${setDef.name}!`);
                EventBus.publish('area_mastery_unlocked', { areaId, type: 'set' });
                return true;
            }
        }
        return false;
    }

    /**
     * Re-evaluate quest mastery progress
     * Called by QuestTracker when a quest claim is processed.
     * @param {string} areaId 
     * @returns {boolean} True if state changed (new mastery tier hit)
     */
    evaluateQuestMastery(areaId) {
        const state = GameState.state;
        const areaState = state.areaStates[areaId];
        if (!areaState) return false;

        const areaQuests = getAreaQuests(areaId);
        const totalQuests = areaQuests.length;

        if (totalQuests > 0 && areaState.completedQuestIds.length >= totalQuests) {
            if (!areaState.mastery.questMasteryUnlocked) {
                areaState.mastery.questMasteryUnlocked = true;
                const setDef = getAreaSet(areaId);
                logger.info('MasterySystem', `Quest Mastery Unlocked for Area: ${areaId}`);
                NotificationSystem.success(`Quest Mastery Unlocked for ${setDef ? setDef.name : areaId}!`);
                EventBus.publish('area_mastery_unlocked', { areaId, type: 'quest' });
                return true;
            }
        }
        return false;
    }

    /**
     * Get active modifiers/buffs provided by an area's mastery
     * @param {string} areaId 
     * @returns {Object} 
     */
    getActiveMasteryBuffs(areaId) {
        const state = GameState.state;
        const areaState = state.areaStates[areaId];

        const buffs = {
            workSpeedMultiplier: 1.0,
            yieldChanceMultiplier: 1.0, // Used for double drops, etc.
            combatDamageMultiplier: 1.0
        };

        if (!areaState) return buffs;

        // Passive Mastery (Always on - tier 1)
        if (areaState.mastery.passiveUnlocked) {
            // Apply area-specific passive logic here
            // e.g., if (areaId === 'forest_v1') buffs.workSpeedMultiplier += 0.05;
        }

        // Set Mastery (tier 2)
        if (areaState.mastery.setMasteryUnlocked) {
            buffs.yieldChanceMultiplier += 0.25; // Example: 25% more loot from tasks
        }

        // Quest Mastery (tier 3)
        if (areaState.mastery.questMasteryUnlocked) {
            buffs.workSpeedMultiplier *= 1.25; // Example: 25% faster tasks
        }

        return buffs;
    }
}

export const MasterySystem = new MasterySystemClass();
