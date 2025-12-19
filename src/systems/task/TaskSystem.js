// Fantasy Guild - Task System
// Phase 15: Task System

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as CardManager from '../cards/CardManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getCard, CARD_TYPES } from '../../config/registries/index.js';
import { applyTaskEffects } from '../effects/EffectProcessor.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import * as ConsumableSystem from '../equipment/ConsumableSystem.js';
import { DurabilitySystem } from '../equipment/DurabilitySystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * TaskSystem - Handles task card progression and completion
 * 
 * Responsibilities:
 * - Process active task cards each tick
 * - Update progress based on assigned hero stats
 * - Handle task completion and rewards
 * - Publish events for UI updates
 */

// Throttle progress UI updates: update every N ticks instead of every tick
// At 10 ticks/sec, 5 means 2 UI updates/sec (smoother than 10, still responsive)
const PROGRESS_UPDATE_INTERVAL = 5;

const TaskSystem = {
    /** Track if system is initialized */
    initialized: false,

    /** Tick counter for throttling progress updates */
    tickCounter: 0,

    /**
     * Initialize the task system
     */
    init() {
        if (this.initialized) return;

        this.initialized = true;
        this.tickCounter = 0;
        logger.info('TaskSystem', 'Initialized');
    },

    // tick() method removed - handled by CardSystem

    /**
     * Standard tick processor for CardSystem
     * @param {Object} card 
     * @param {number} deltaTime 
     * @returns {boolean} True if progress updated
     */
    processTick(card, deltaTime) {
        if (!card.assignedHeroId) return false;
        const hero = HeroManager.getHero(card.assignedHeroId);
        if (!hero) return false;

        const template = getCard(card.templateId);
        if (!template) return false;

        return this.processTaskCard(card, hero, template, deltaTime);
    },

    /**
     * Process a single Task Card
     * @param {Object} cardInstance 
     * @param {Object} hero 
     * @param {Object} template 
     * @param {number} deltaTime 
     * @returns {boolean} True if progress was updated
     */
    processTaskCard(cardInstance, hero, template, deltaTime) {
        // Check if hero needs to auto-consume food/drink
        const consumeResult = ConsumableSystem.checkAndConsume(hero.id);
        if (consumeResult.consumed && consumeResult.skipTick) {
            // Hero is eating/drinking, skip this tick for them
            return false;
        }

        // If task is waiting for resources, check if they're now available
        if (cardInstance.status === 'paused') {
            if (this.hasRequiredResources(template, hero, cardInstance)) {
                CardManager.setCardStatus(cardInstance.id, 'active');
            } else {
                return false;
            }
        }

        // Check if task can start (has required resources)
        if (cardInstance.status === 'idle') {
            if (this.hasRequiredResources(template, hero, cardInstance)) {
                CardManager.setCardStatus(cardInstance.id, 'active');
            } else {
                CardManager.setCardStatus(cardInstance.id, 'paused');
                return false;
            }
        }

        // Skip cards that aren't in 'active' status
        if (cardInstance.status !== 'active') return false;

        // Calculate progress increment
        const progressIncrement = this.calculateProgress(template, hero, deltaTime);

        // Update card progress
        CardManager.updateProgress(cardInstance.id, progressIncrement);

        // Check for completion - use cardInstance.baseTickTime (includes biome effects)
        // Comparison is now MS vs MS
        const duration = cardInstance.baseTickTime || template.baseTickTime || 10000;
        if (cardInstance.progress >= duration) {
            this.completeTask(cardInstance, template, hero);
        }

        return true;
    },

    /**
     * Calculate energy cost per second for a task
     * @param {Object} template - Card template
     * @param {Object} hero - Hero object
     * @returns {number} Energy cost per second
     */
    calculateEnergyCost(template, hero, cardInstance = null) {
        // Base energy cost spread over duration
        const baseCost = template.baseEnergyCost || 1;
        // Use cardInstance tick time if available (has biome effects), otherwise template
        const tickTime = cardInstance?.baseTickTime || template.baseTickTime || 10000;
        // Cost is per second, so we still need duration in seconds for this calculation
        const durationSec = tickTime / 1000;

        // Energy per second = total cost / duration
        return baseCost / durationSec;
    },

    /**
     * Calculate progress per tick based on hero stats
     * @param {Object} template - Card template
     * @param {Object} hero - Hero object
     * @param {number} deltaTime - Time since last tick
     * @returns {number} Progress to add
     */
    calculateProgress(template, hero, deltaTime) { // Added opening brace here
        // Base progress: 1 ms of progress per real ms
        let progressRate = 1.0;

        // Apply skill bonus if hero has matching skill
        // 0.5% faster per skill level (Level 10 = +5%, Level 100 = +50%)
        const taskSkill = template.skill;
        if (taskSkill && hero.skills && hero.skills[taskSkill] !== undefined) {
            // Ensure skillLevel is a number (skills might be objects with 'level' property)
            const skillData = hero.skills[taskSkill];
            const skillLevel = typeof skillData === 'number'
                ? skillData
                : (skillData?.level ?? 0);

            // Each skill level adds 0.5% speed
            if (typeof skillLevel === 'number' && !isNaN(skillLevel)) {
                progressRate *= (1 + skillLevel * 0.005);
            }
        }

        const result = progressRate * deltaTime;
        return result;
    },

    /**
     * Check if hero has required resources to perform/complete task
     * @param {Object} template - Card template
     * @param {Object} hero - Hero object
     * @param {Object} cardInstance - Card instance (for assignedItems)
     * @returns {boolean} True if hero has enough resources
     */
    hasRequiredResources(template, hero, cardInstance = null) {
        // Check energy requirement
        const energyCost = template.baseEnergyCost || 0;
        if (hero.energy.current < energyCost) {
            return false;
        }

        // Check input items from inventory
        if (template.inputs && template.inputs.length > 0) {
            for (let i = 0; i < template.inputs.length; i++) {
                const input = template.inputs[i];
                if (input.itemId) {
                    // Fixed slot - check specific item
                    if (!InventoryManager.hasItem(input.itemId, input.quantity)) {
                        return false;
                    }
                } else if (input.acceptTag) {
                    // Open slot - check if item assigned and available
                    const assignedItemId = cardInstance?.assignedItems?.[i];
                    if (!assignedItemId || !InventoryManager.hasItem(assignedItemId, input.quantity)) {
                        return false;
                    }
                }
            }
        }

        return true;
    },

    /**
     * Handle case where hero runs out of energy
     * @param {Object} cardInstance - The card instance
     * @param {Object} hero - The exhausted hero
     */
    handleExhaustedHero(cardInstance, hero) {
        // Unassign hero from task
        CardManager.unassignHero(cardInstance.id);

        NotificationSystem.warning(
            `${hero.name} is exhausted and left the task!`
        );

        // Update hero status back to idle for regen
        HeroManager.setHeroStatus(hero.id, 'idle');
    },

    /**
     * Complete a task and distribute rewards
     * @param {Object} cardInstance - The completed card instance
     * @param {Object} template - Card template
     * @param {Object} hero - The hero who completed the task
     */
    completeTask(cardInstance, template, hero) {
        logger.info('TaskSystem', `Task completed: ${template.name} by ${hero.name}`);

        // Check if hero still has required resources to complete
        if (!this.hasRequiredResources(template, hero, cardInstance)) {
            // Not enough resources - task fails, nothing consumed, pause until resources available
            CardManager.setCardStatus(cardInstance.id, 'paused');
            CardManager.resetProgress(cardInstance.id);
            NotificationSystem.warning(
                `${hero.name} cannot complete ${template.name} - insufficient resources!`
            );
            return;
        }

        // Consume energy on completion
        const energyCost = template.baseEnergyCost || 0;
        HeroManager.modifyHeroEnergy(hero.id, -energyCost);

        // Consume Tool Durability (1 per completion)
        // Check inputs for valid tools and degrade them
        if (template.inputs) {
            for (let i = 0; i < template.inputs.length; i++) {
                const input = template.inputs[i];
                if (input.isTool) {
                    const active = DurabilitySystem.tickDurability(cardInstance, i, 1);
                    if (!active) {
                        // Tool broke during completion - that's fine, it counts for this run.
                        // Breakage logic handled in tickDurability (pause card, etc)
                        // Next run will find it missing.
                        logger.info('TaskSystem', `Tool broke upon completion: ${cardInstance.id}`);
                    }
                }
            }
        }

        // Consume input items like materials from inventory
        if (template.inputs && template.inputs.length > 0) {
            for (let i = 0; i < template.inputs.length; i++) {
                const input = template.inputs[i];
                // Skip if input is a Tool (durability handles consumption)
                if (input.isTool) continue;

                const itemId = input.itemId || cardInstance.assignedItems?.[i];
                if (itemId) {
                    InventoryManager.removeItem(itemId, input.quantity);
                }
            }
        }

        // Apply stored effects from biome/modifier
        const effectContext = {};
        if (cardInstance.sourceEffects && cardInstance.sourceEffects.length > 0) {
            applyTaskEffects(cardInstance.sourceEffects, cardInstance, hero, template, effectContext);
        }

        // Grant rewards (outputs) - check for double output from effects
        let doubleOutput = effectContext.doubleOutput || false;

        // Check project modifiers for double items chance
        if (!doubleOutput && cardInstance.taskCategory) {
            const categoryChance = GameState.modifiers?.doubleItemsChance?.[cardInstance.taskCategory] || 0;
            const globalChance = GameState.modifiers?.doubleItemsChance?.['all'] || 0;
            const totalChance = categoryChance + globalChance;
            if (totalChance > 0 && Math.random() < totalChance) {
                doubleOutput = true;
                NotificationSystem.notify(`🍀 Double items!`, 'success');
            }
        }

        // Check for output failure (Guild Hall debuff)
        if (effectContext.outputFailed) {
            // Task completes but produces no outputs - still consume inputs and grant XP
            NotificationSystem.warning(`${template.name} produced no outputs!`, 'warning');
            logger.debug('TaskSystem', `Output failed for ${template.name} (Guild Hall debuff)`);
        } else {
            // Check for dynamic outputMap first (for open slots)
            if (template.outputMap && Object.keys(template.outputMap).length > 0) {
                // Find the primary input item (usually slot 0) to determine output
                const primaryInputId = cardInstance.assignedItems?.[0];
                const dynamicOutputs = template.outputMap[primaryInputId];
                if (dynamicOutputs) {
                    this.grantOutputs(dynamicOutputs, hero, doubleOutput);
                } else {
                    logger.warn('TaskSystem', `No output mapping for input: ${primaryInputId}`);
                }
            } else if (template.outputs && template.outputs.length > 0) {
                this.grantOutputs(template.outputs, hero, doubleOutput);
            }
        }

        // Grant skill experience
        if (template.skill) {
            const baseXp = template.xpAwarded || 10;
            const classTraitMultiplier = SkillSystem.getXpMultiplier(hero.id, template.skill);

            // Get biome/modifier XP bonus from EffectProcessor (stored in effectContext)
            const biomeXpBonus = effectContext.xpBonus || 0;

            // Get project XP bonus based on task category
            const categoryXpBonus = cardInstance.taskCategory
                ? (GameState.modifiers?.xpBonus?.[cardInstance.taskCategory] || 0)
                : 0;
            const globalXpBonus = GameState.modifiers?.xpBonus?.['all'] || 0;
            const projectXpBonus = categoryXpBonus + globalXpBonus;

            const totalMultiplier = classTraitMultiplier + biomeXpBonus + projectXpBonus;
            const finalXp = Math.floor(baseXp * totalMultiplier);

            const result = SkillSystem.addXP(hero.id, template.skill, finalXp);
            logger.debug('TaskSystem', `Awarded ${finalXp} ${template.skill} XP to ${hero.name} (base ${baseXp} × ${totalMultiplier.toFixed(2)})`);

            if (result.levelsGained > 0) {
                NotificationSystem.success(
                    `${hero.name} leveled up ${template.skill}! Now level ${result.newLevel}`
                );
            }
        }

        // Reset progress for next loop (hero stays assigned)
        CardManager.resetProgress(cardInstance.id);

        // Set status back to idle so tick() checks resources for next loop
        CardManager.setCardStatus(cardInstance.id, 'idle');

        // Publish completion event (UI updates via event subscribers)
        EventBus.publish('task_completed', {
            cardId: cardInstance.id,
            templateId: template.id,
            heroId: hero.id,
            outputs: template.outputs
        });
    },

    /**
     * Grant output items from task completion
     * @param {Array} outputs - Outputs array [{itemId, quantity, chance}]
     * @param {Object} hero - Hero receiving outputs
     * @param {boolean} doubleOutput - Whether outputs should be doubled (from effects)
     */
    grantOutputs(outputs, hero, doubleOutput = false) {
        if (!outputs || outputs.length === 0) return;

        // Ensure inventory initialized (failsafe)
        if (!GameState.inventory) {
            InventoryManager.init();
        }

        const multiplier = doubleOutput ? 2 : 1;
        if (doubleOutput) {
            logger.info('TaskSystem', '🎉 DOUBLE OUTPUT! All quantities doubled.');
        }

        for (const output of outputs) {
            // Check chance (if < 100, roll for drop)
            if (output.chance && output.chance < 100) {
                const roll = Math.random() * 100;
                if (roll > output.chance) {
                    continue; // Didn't get the drop
                }
            }

            // Apply quantity multiplier from effects
            const quantity = output.quantity * multiplier;

            // Handle currency outputs (e.g., Influence)
            if (output.currencyId) {
                if (output.currencyId === 'influence') {
                    CurrencyManager.addInfluence(quantity, 'task_reward');
                    logger.debug('TaskSystem', `Granted ${quantity} Influence${doubleOutput ? ' (doubled!)' : ''}`);
                } else {
                    logger.warn('TaskSystem', `Unknown currency type: ${output.currencyId}`);
                }
                continue;
            }

            // Use InventoryManager to add items
            InventoryManager.addItem(output.itemId, quantity);

            logger.debug('TaskSystem', `Granted ${quantity} ${output.itemId}${doubleOutput ? ' (doubled!)' : ''}`);
        }

        // Note: InventoryManager publishes 'inventory_updated', so we don't need to do it here specifically
        // unless we want a specific "Task Reward" event for other systems.
    },

    /**
     * Get all active task cards
     * @returns {Array} Array of active task card instances
     */
    getActiveTasks() {
        const activeCards = GameState.cards?.active || [];
        return activeCards.filter(card => {
            const template = getCard(card.templateId);
            return template && template.cardType === CARD_TYPES.TASK;
        });
    },

    /**
     * Get count of tasks in progress (with assigned heroes)
     * @returns {number}
     */
    getTasksInProgress() {
        const tasks = this.getActiveTasks();
        return tasks.filter(t => t.assignedHeroId && t.status === 'active').length;
    }
};

export { TaskSystem };
