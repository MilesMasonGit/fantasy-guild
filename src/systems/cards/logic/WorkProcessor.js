import * as CardManager from '../CardManager.js';
import { bumpCardRev } from '../CardManager.js';
import { getCard as getCardTemplate } from '../../../config/registries/cardRegistry.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { InventoryManager } from '../../inventory/InventoryManager.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import { LootSystem } from '../../combat/LootSystem.js';
import * as TransactionProcessor from '../../economy/TransactionProcessor.js';
import { getAreaQuests } from '../../../config/registries/questRegistry.js';
import { GameState } from '../../../state/GameState.js';
import { recalculateCardStats } from './StatProcessor.js';
import { checkRequirements } from './RequirementProcessor.js';
import { incrementCollectionProgress } from './QuestProcessor.js';

/**
 * Work Cycle Module Processor
 * @param {Object} card 
 * @param {Object} trait 
 * @param {number} deltaTime 
 */
export function processWorkCycle(card, trait, deltaTime) {
    const heroId = card.assignedHeroId;
    if (!heroId || card.awaitingDiscovery) {
        if (card.status !== 'idle' && !card.awaitingDiscovery) CardManager.setCardStatus(card.id, 'idle');
        return;
    }

    const hero = HeroManager.getHero(heroId);
    if (!hero) return;


    const { met, missing } = checkRequirements(card);
    card.missingRequirements = missing; 

    if (!met) {
        if (card.progress !== 0) {
            card.progress = 0;
            bumpCardRev(card);
        }
        if (card.status !== 'idle') CardManager.setCardStatus(card.id, 'idle');
        return;
    }

    if (card.status === 'idle' || card.status === 'paused') {
        CardManager.setCardStatus(card.id, 'active');
    }

    if (card.status !== 'active') return;

    // 1. Recalculate Stats (Updates card.currentTickTime)
    recalculateCardStats(card);
    
    // 2. Incremental Progress (Elapsed Time)
    const cycleDuration = card.currentTickTime || card.baseTickTime || 10000;
    
    // Safety: Reset NaN progress if it exists from previous bug
    if (isNaN(card.progress)) card.progress = 0;
    
    card.progress = (card.progress || 0) + deltaTime;

    if (card.progress >= cycleDuration) {
        completeWorkCycle(card, trait);
    }
}

/**
 * Handle completion of a work cycle
 */
export function completeWorkCycle(card, trait) {
    logger.info('WorkProcessor', `Work cycle complete: ${card.id}`);

    // 1. Consume Tool Durability
    if (card.assignedToolId) {
        InventoryManager.decrementDurability(card.assignedToolId, 1);
    }

    // 2. Special Trait: Quest Selection (Explore Cards)
    const questSelectionTrait = card.traits.find(t => t.type === 'quest_selection');
    if (questSelectionTrait) {
        handleQuestSelection(card);
    } else {
        card.progress = 0;
        card.status = 'idle';
    }

    // 3. Quest Progression (Collection/Project)
    const questTrait = card.traits.find(t => t.type === 'quest' && (t.questType === 'collection' || t.questType === 'project'));
    if (questTrait) {
        incrementCollectionProgress(card);
    }

    // 4. Unified Rewards
    const rewardTrait = card.traits.find(t => t.type.toLowerCase() === 'unifiedreward');
    if (rewardTrait) {
        applyUnifiedReward(card, rewardTrait);
    }

    // 5. Output/Loot Generation
    const template = getCardTemplate(card.templateId);
    const lootTrait = card.traits.find(t => t.type === 'loot');
    const outputs = (lootTrait?.items?.length > 0 ? lootTrait.items : null) || 
                    (lootTrait?.drops?.length > 0 ? lootTrait.drops : null) || 
                    (card.outputs?.length > 0 ? card.outputs : null) || 
                    card.config?.outputs || [];

    if (!template?.isProject && outputs.length > 0) {
        LootSystem.handleTaskReward(card, outputs);
    }

    // 6. Input Consumption
    consumeInputs(card, template);
}

/**
 * @private Helper for quest selection generation
 */
function handleQuestSelection(card) {
    card.status = 'completed';
    card.progress = card.baseTickTime || 10000;

    const targetAreaId = card.areaId || card.config?.areaId || card.selectedBiomeId || 'guild_hall_v1';
    const allQuests = getAreaQuests(targetAreaId);
    
    const completedQuests = GameState.state.areaStates?.[targetAreaId]?.completedQuestIds || [];
    const activeQuests = GameState.state.globalQuests || [];
    const activeQuestIds = activeQuests.map(q => q.templateId);

    const validQuests = allQuests.filter(q => 
        !completedQuests.includes(q.id) && !activeQuestIds.includes(q.id)
    );
    const shuffled = [...validQuests].sort(() => 0.5 - Math.random());
    card.questOptions = shuffled.slice(0, 3);
    bumpCardRev(card);
    
    logger.info('WorkProcessor', `Generated ${card.questOptions.length} stable quest options for ${card.id}`);
}

/**
 * @private Helper for input consumption
 */
function consumeInputs(card, template) {
    const consumedItems = [];
    const inputSlots = card.traits.filter(t => t.type === 'inputslot');
    const isProject = !!template?.isProject;

    for (let i = 0; i < inputSlots.length; i++) {
        const inputSlotTrait = inputSlots[i];
        const inputsToConsume = inputSlotTrait.inputs || [inputSlotTrait];

        for (let j = 0; j < inputsToConsume.length; j++) {
            const reqTrait = inputsToConsume[j];
            const slotIndex = inputSlotTrait.inputs ? j : (inputSlotTrait.slotIndex ?? i);
            const assigned = card.assignedItems?.[slotIndex];
            const itemId = assigned?.id || assigned;
            
            const totalRequired = reqTrait.quantity || 1;
            const projectProgress = isProject ? (card.project?.progress?.[itemId] || 0) : 0;
            const quantityToConsume = isProject ? Math.min(1, totalRequired - projectProgress) : totalRequired;

            if (itemId && !reqTrait.isTool && quantityToConsume > 0) {
                let consumedCount = 0;

                // Stack first
                if (card.stack) {
                    for (let k = card.stack.length - 1; k >= 0; k--) {
                        if (card.stack[k].type === 'item' && card.stack[k].id === itemId) {
                            card.stack.splice(k, 1);
                            consumedCount++;
                            if (consumedCount >= quantityToConsume) break;
                        }
                    }
                }

                // Inventory remainder
                const remainingToConsume = quantityToConsume - consumedCount;
                if (remainingToConsume > 0) {
                    const removed = InventoryManager.removeItem(itemId, remainingToConsume);
                    if (removed) {
                        consumedCount += remainingToConsume;
                    }
                }

                if (consumedCount > 0) {
                    consumedItems.push({ itemId, quantity: consumedCount });
                    if (consumedCount > remainingToConsume) bumpCardRev(card);
                }
            } else if (!itemId && !reqTrait.isTool && !isProject && card.stack) {
                // Fallback for generic slots
                const stackIdx = card.stack.findIndex(e => e.type === 'item');
                if (stackIdx > -1) {
                    card.stack.splice(stackIdx, 1);
                    bumpCardRev(card);
                }
            }
        }
    }

    if (consumedItems.length > 0) {
        if (isProject) {
            EventBus.publish('project_work_cycle_complete', { 
                templateId: card.templateId, 
                consumedInputs: consumedItems 
            });
        }

        EventBus.publish('items_consumed', { 
            cardId: card.id, 
            items: consumedItems 
        });
    }

    EventBus.publish('module_cycle_complete', { cardId: card.id });
}

/**
 * Unified Reward Processor
 */
export function applyUnifiedReward(card, trait) {
    const heroId = card.assignedHeroId;
    const entries = [];

    if (trait.xp > 0) {
        const xpSkill = card.traits.find(t => t.type === 'workcycle')?.skill;
        if (xpSkill) {
            entries.push({ type: 'XP', skill: xpSkill, amount: trait.xp });
        }
    }

    if (trait.items?.length > 0) {
        for (const item of trait.items) {
            entries.push({ type: 'ITEM', id: item.id, amount: item.amount || 1 });
        }
    }

    if (entries.length > 0) {
        TransactionProcessor.apply({ entries }, heroId);
    }
}
