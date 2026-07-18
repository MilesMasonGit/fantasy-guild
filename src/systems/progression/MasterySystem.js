// Fantasy Guild - Mastery System
// Phase 2: Exploration & Mastery

import { GameState } from '../../state/GameState.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { getAreaQuests } from '../../config/registries/questRegistry.js';
import { SUB_SKILL_TO_PARENT } from '../../config/registries/skillRegistry.js';
import { EventBus } from '../core/EventBus.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * MasterySystem
 * Evaluates Area mastery tiers and provides active mastery bonuses.
 *
 * SHELVED (owner decision 2026-07-17, CR-036): the unlock evaluators lost
 * their callers when the Library was deleted, so set/quest mastery cannot
 * currently unlock and every bonus query resolves to zeros. Kept dormant —
 * see deck_loop_task_list.md §J — until mastery is deliberately re-wired
 * to the deck loop (playsets for set mastery, quest completion for quest
 * mastery). The Projects bonus source was retired outright (CR-038).
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
     * @param {Object} context - { areaId, skill, subskill, itemId, itemTags }
     * @returns {Object} { yieldDoubleChance, speedReduction, combatDamageMultiplier }
     */
    getEffectiveBonuses(context = {}) {
        const state = GameState.state;
        const results = {
            yieldDoubleChance: 0,
            speedReduction: 0,
            combatDamageMultiplier: 1.0
        };

        if (!state || !state.areaStates || !state.progress) return results;

        // 1. AREA MASTERY BONUSES
        for (const [areaId, areaState] of Object.entries(state.areaStates)) {
            const setDef = getAreaSet(areaId);
            if (!setDef || !setDef.masteryBonuses) continue;

            const activeBonusArrays = [];
            if (areaState.mastery.setMasteryUnlocked) activeBonusArrays.push(setDef.masteryBonuses.setMastery || []);
            if (areaState.mastery.questMasteryUnlocked) activeBonusArrays.push(setDef.masteryBonuses.questMastery || []);

            for (const bonusArray of activeBonusArrays) {
                for (const bonus of bonusArray) {
                    if (this._isBonusActive(bonus, areaId, context)) {
                        this._applyBonus(bonus, results);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Get all active bonuses for UI display
     * @returns {Object} { global: Array, local: Array }
     */
    getAllActiveBonuses() {
        const state = GameState.state;
        if (!state || !state.areaStates) return { global: [], local: [] };
        // The single "active area" concept is retired (CR-005); local-bonus
        // display keys off the starting area until the bonus UI is reworked.
        const activeAreaId = 'area_guild_hall';
        const global = [];
        const local = [];

        const processBonus = (bonus, sourceId) => {
            const bonusObj = { 
                id: bonus.id, 
                description: bonus.description || `${bonus.type}: ${bonus.value}`,
                source: sourceId 
            };
            if (bonus.scope === 'global') global.push(bonusObj);
            else local.push(bonusObj);
        };

        // 1. Mastery
        for (const [areaId, areaState] of Object.entries(state.areaStates)) {
            const setDef = getAreaSet(areaId);
            if (!setDef || !setDef.masteryBonuses) continue;

            const processMasteryBonus = (b) => {
                if (b.scope === 'local' && areaId !== activeAreaId) return;
                processBonus(b, setDef.name);
            };

            if (areaState.mastery.setMasteryUnlocked) (setDef.masteryBonuses.setMastery || []).forEach(processMasteryBonus);
            if (areaState.mastery.questMasteryUnlocked) (setDef.masteryBonuses.questMastery || []).forEach(processMasteryBonus);
        }

        return { global, local };
    }

    /**
     * Internal helper to check if a bonus should be active given a context
     */
    _isBonusActive(bonus, sourceAreaId, context) {
        // 1. Scope Check
        if (bonus.scope === 'local') {
            const evaluationArea = context.areaId;
            if (!evaluationArea) return false;

            if (sourceAreaId && evaluationArea !== sourceAreaId) return false;
        }

        // 2. Filter Check
        if (bonus.filter) {
            const { itemId, tag, skill, subskill } = bonus.filter;
            
            if (itemId && context.itemId !== itemId) return false;
            if (tag && !context.itemTags?.includes(tag)) return false;
            if (skill) {
                const parentSkill = context.subskill ? SUB_SKILL_TO_PARENT[context.subskill] : null;
                if (context.skill !== skill && parentSkill !== skill) return false;
            }
            if (subskill && context.subskill !== subskill) return false;
        }

        return true;
    }

    /**
     * Internal helper to apply a bonus to the results object
     */
    _applyBonus(bonus, results) {
        switch (bonus.type) {
            case 'yield_double':
                results.yieldDoubleChance += bonus.value;
                break;
            case 'work_speed':
                results.speedReduction += bonus.value;
                break;
            case 'combat_damage':
                results.combatDamageMultiplier *= bonus.value;
                break;
        }
    }

    /**
     * Legacy support for simple area-wide buffs (DEPRECATED)
     */
    getActiveMasteryBuffs(areaId) {
        return this.getEffectiveBonuses({ areaId });
    }
}

export const MasterySystem = new MasterySystemClass();
