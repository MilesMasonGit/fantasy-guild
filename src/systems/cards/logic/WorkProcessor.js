import { bumpCardRev } from './CardManagerUtils.js';
import { getCard as getCardTemplate } from '../../../config/registries/cardRegistry.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { InventoryManager } from '../../inventory/InventoryManager.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import { LootSystem } from '../../combat/LootSystem.js';
import * as TransactionProcessor from '../../economy/TransactionProcessor.js';
import { getAreaQuests } from '../../../config/registries/questRegistry.js';
import { GameState } from '../../../state/GameState.js';
import { incrementCollectionProgress } from './QuestProcessor.js';
import * as StatusEffectSystem from '../../effects/StatusEffectSystem.js';
import { resolveInputCost } from '../../effects/EffectAxes.js';
import { preflightWorkCycle } from './CardPreflight.js';

/**
 * Handle completion of a work cycle.
 *
 * (The incremental `processWorkCycle` tick half was removed in the Wave 4
 * sweep — CR-027: LoopRunner owns the countdown and calls straight into
 * completion. Nothing had called it since the rework.)
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

    // 3. PRE-FLIGHT (roadmap F5 + §15.9). Decide the whole exchange BEFORE any
    //    payoff happens. This used to grant loot first and only then try to pay
    //    for it, so a Card could produce output it could not afford. Every
    //    payoff below is now gated on it: either the Card earns all of it or
    //    none of it.
    const template = getCardTemplate(card.templateId);
    const lootTrait = card.traits.find(t => t.type === 'loot');
    const outputs = (lootTrait?.items?.length > 0 ? lootTrait.items : null) ||
                    (lootTrait?.drops?.length > 0 ? lootTrait.drops : null) ||
                    (card.outputs?.length > 0 ? card.outputs : null) ||
                    card.config?.outputs || [];

    const failure = preflightWorkCycle(card, template, outputs);
    card.lastFailure = failure;

    // 4. Status application (Salt Circle / hazards / buff cards):
    //    trait { type: 'applystatus', statusId, stacks?, purge? }
    //    — purge: true instead cleanses that status (Antidote-style cards).
    //
    //    Deliberately OUTSIDE the failure gate: a status here is environmental,
    //    not a payoff. A poison swamp still poisons the Hero who walked it even
    //    if they came away with nothing.
    if (card.assignedHeroId) {
        for (const statusTrait of card.traits.filter(t => t.type.toLowerCase() === 'applystatus')) {
            if (!statusTrait.statusId) continue;
            if (statusTrait.purge) {
                StatusEffectSystem.purge(card.assignedHeroId, statusTrait.statusId);
            } else {
                StatusEffectSystem.applyToHero(card.assignedHeroId, statusTrait.statusId, statusTrait.stacks ?? 1);
            }
        }
    }

    if (failure) {
        // §10 / §16: the Work Time is already spent and the Card still
        // resolves — it simply yields nothing and consumes nothing. Any Token
        // riding it is wasted, since Tokens are wiped at the Cycle boundary
        // regardless of outcome.
        logger.info('WorkProcessor', `Card ${card.id} FAILED (${failure.reason})`);
        EventBus.publish('card_work_failed', {
            cardId: card.id,
            templateId: card.templateId,
            areaId: card.areaId || card.config?.areaId || null,
            reason: failure.reason,
            detail: failure.detail
        });
    } else {
        // 5. Quest Progression (Collection/Project). Gated: this spends gradual
        //    inputs toward a quota, so a Card that produced nothing must not
        //    advance it.
        const questTrait = card.traits.find(t => t.type === 'quest' && (t.questType === 'collection' || t.questType === 'project'));
        if (questTrait) {
            incrementCollectionProgress(card);
        }

        // 6. Unified Rewards (XP and reward items). Gated [owner decision
        //    2026-07-21]: a failed Card awards NO XP. `applyUnifiedReward`
        //    grants XP and items together, so both are withheld — a Card that
        //    produced nothing should not hand over either.
        const rewardTrait = card.traits.find(t => t.type.toLowerCase() === 'unifiedreward');
        if (rewardTrait) {
            applyUnifiedReward(card, rewardTrait);
        }

        // 7. Output/Loot Generation
        if (!template?.isProject && outputs.length > 0) {
            // Surprise ambush encounters (a task card morphing into a fight) are
            // dropped under the deck loop [DECISION 2026-07-07]: combat happens
            // only at combat card slots, keeping loops deterministic/walk-away
            // safe. A rolled trigger simply yields no loot that cycle. Possible
            // future re-addition once the loop has a design for unplanned fights.
            LootSystem.handleTaskReward(card, outputs);
        }

        // 8. Input Consumption
        consumeInputs(card, template);
    }

    // End of Work (§16) — fires on success AND failure alike. A failed Card is
    // a full resolution that produces nothing, not a no-op.
    EventBus.publish('module_cycle_complete', { cardId: card.id, failed: !!failure });
}

/**
 * @private Helper for quest selection generation
 */
function handleQuestSelection(card) {
    card.status = 'completed';
    card.progress = card.baseTickTime || 10000;

    const targetAreaId = card.areaId || card.config?.areaId || card.selectedBiomeId || 'area_guild_hall';
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
    if (card.activeRecipe) {
        const consumedItems = [];
        const inputs = card.activeRecipe.inputs || [];
        const assigned = card.assignedItems || {};

        inputs.forEach((input, index) => {
            const assignedVal = assigned[index];
            const itemId = assignedVal?.id || assignedVal;
            // Token INPUT_COST axis (§15.8, Phase 5), floored at 1 unit (§10).
            const quantity = resolveInputCost(card.aggregator, input.quantity || 1);

            if (itemId) {
                InventoryManager.removeItem(itemId, quantity);
                consumedItems.push({ itemId, quantity });
                delete card.assignedItems[index];
            }
        });

        if (consumedItems.length > 0) {
            EventBus.publish('items_consumed', { 
                cardId: card.id, 
                items: consumedItems 
            });
            bumpCardRev(card);
        }
        return;
    }

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
            
            // Token INPUT_COST axis (§15.8, Phase 5), floored at 1 unit (§10).
            const totalRequired = resolveInputCost(card.aggregator, reqTrait.quantity || 1);
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
