import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as CardManager from '../cards/CardManager.js';
import { ensureModular } from '../cards/CardAssembler.js';
import { bumpCardRev } from '../cards/CardManager.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import * as HeroManager from '../hero/HeroManager.js';
// import { getProject } from '../../config/registries/projectRegistry.js';
import { logger } from '../../utils/Logger.js';

/**
 * ProjectManager: Handles the execution of project rewards.
 * Listens for quest completion and processes defined effects.
 */
export const ProjectManager = {
    init() {
        logger.info('ProjectManager', 'Initializing Project System');
        
        /* LEGACY: Projects are now treated as tiered cards, not quests
        EventBus.subscribe('quest_completed', (data) => {
            this.handleProjectCompletion(data.cardId);
        });
        */

        // Listen for project feeding cycles
        EventBus.subscribe('project_work_cycle_complete', (data) => {
            this.processWorkCycle(data.templateId, data.consumedInputs);
        });

        // Initialize project state if missing
        if (!GameState.state.progress.projects) {
            GameState.state.progress.projects = {};
        }
    },

    /**
     * Process a work cycle completion for a project card.
     * @param {string} templateId 
     * @param {Array} consumedInputs 
     */
    processWorkCycle(templateId, consumedInputs) {
        if (!templateId) return;

        // Ensure state entry exists
        if (!GameState.state.progress.projects[templateId]) {
            GameState.state.progress.projects[templateId] = {
                level: 0,
                inputProgress: {}
            };
        }

        const projectState = GameState.state.progress.projects[templateId];
        const template = getCardTemplate(templateId);
        
        if (!template || !template.isProject || !template.tiers) {
            logger.warn('ProjectManager', `Attempted to process work cycle for non-project: ${templateId}`);
            return;
        }

        const currentTier = template.tiers[projectState.level];
        if (!currentTier) return; // Max level reached or invalid state

        // Add consumed inputs to progress
        consumedInputs.forEach(input => {
            const { itemId, quantity } = input;
            projectState.inputProgress[itemId] = (projectState.inputProgress[itemId] || 0) + (quantity || 1);
        });

        logger.debug('ProjectManager', `Progress updated for ${templateId}:`, projectState.inputProgress);

        // Check if all requirements for current tier are met
        let tierComplete = true;
        for (const [reqId, reqQty] of Object.entries(currentTier.requirements)) {
            if ((projectState.inputProgress[reqId] || 0) < reqQty) {
                tierComplete = false;
                break;
            }
        }

        if (tierComplete) {
            projectState.isReadyForUpgrade = true;
            logger.info('ProjectManager', `Project ${templateId} is ready for upgrade!`);
        }

        // Trigger UI update and local progress mirror for all active project cards matching this template
        const activeCards = (GameState.cards?.active || []).filter(c => c.templateId === templateId);
        activeCards.forEach(card => {
            card.inputProgress = { ...projectState.inputProgress };
            card.isReadyForUpgrade = projectState.isReadyForUpgrade;
            bumpCardRev(card);
            EventBus.publish('cards_updated', { cardId: card.id, source: 'project_progress' });
        });

        EventBus.publish('state_changed', { source: 'project_progress' });
    },

    /**
     * Advance a project to the next level and trigger rewards.
     * @param {string} templateId 
     */
    levelUpProject(templateId) {
        const projectState = GameState.state.progress.projects[templateId];
        const template = getCardTemplate(templateId);
        const currentTier = template.tiers[projectState.level];

        logger.info('ProjectManager', `Project Level Up! ${templateId}: ${projectState.level} -> ${projectState.level + 1}`);

        // Apply Reward
        if (currentTier.reward) {
            this.applyTierReward(currentTier.reward);
        }

        // Increment Level and Reset Progress
        projectState.level += 1;
        projectState.inputProgress = {};
        projectState.isReadyForUpgrade = false;

        // Notify User
        EventBus.publish('notification', { 
            message: `Project Upgraded: ${template.name} is now Tier ${projectState.level}!`,
            type: 'success'
        });

        // Trigger trait refresh for active project cards
        const activeCards = (GameState.cards?.active || []).filter(c => c.templateId === templateId);
        activeCards.forEach(card => {
            card.isReadyForUpgrade = false; // Reset local flag explicitly
            ensureModular(card, template);
            bumpCardRev(card); // Ensure UI re-renders
        });

        EventBus.publish('audio:play', { clip: 'project_complete', type: 'ui' });
        EventBus.publish('cards_updated', { source: 'project_levelup', templateId });
        EventBus.publish('state_changed', { source: 'project_levelup' });
    },

    /**
     * Apply rewards from a project tier completion
     * @param {Object} reward 
     */
    applyTierReward(reward) {
        const { type, count, amount, slots, stackBonus } = reward;
        
        switch (type) {
            case 'recruit_card':
                this.spawnRecruitCard(count || 1);
                break;
            case 'increase_roster_limit':
                this.increaseRosterLimit(amount || 1);
                break;
            case 'inventory_slots':
                this.increaseInventorySlots(slots || 5);
                break;
            case 'max_stack':
                this.increaseMaxStack(stackBonus || 10);
                break;
            default:
                logger.warn('ProjectManager', `Unhandled reward type: ${type}`);
        }
    },

    /* LEGACY: handleProjectCompletion and applyProjectEffect are deprecated. 
       Rewards are now handled by levelUpProject and applyTierReward. */

    /**
     * Reward: Increase the active hero roster limit
     */
    increaseRosterLimit(amount) {
        if (!GameState.state.progress) {
            GameState.state.progress = { rosterLimit: 5 };
        }
        
        GameState.state.progress.rosterLimit += amount;
        
        EventBus.publish('notification', { 
            message: `Guild capacity increased by ${amount}!`,
            type: 'info'
        });
        
        EventBus.publish('roster_limit_updated', { limit: GameState.state.progress.rosterLimit });
        EventBus.publish('state_changed', { source: 'roster_limit' });
    },

    /**
     * Reward: Spawn free recruit cards on the board
     */
    spawnRecruitCard(count) {
        for (let i = 0; i < count; i++) {
            const result = CardManager.createCard('basic_recruit'); // templateId for a basic recruit card
            if (result.success) {
                logger.info('ProjectManager', `Spawned free recruitment card: ${result.card.id}`);
            }
        }
    },

    /**
     * Reward: Increase total inventory slot capacity
     */
    increaseInventorySlots(slots) {
        if (GameState.state.inventory) {
            GameState.state.inventory.maxSlots = (GameState.state.inventory.maxSlots || 20) + slots;
            EventBus.publish('notification', { message: `Inventory expanded by ${slots} slots!`, type: 'info' });
            EventBus.publish('state_changed', { source: 'inventory_slots' });
        }
    },

    /**
     * Reward: Increase item stack limit
     */
    increaseMaxStack(bonus) {
        if (GameState.state.inventory) {
            GameState.state.inventory.maxStackSize = (GameState.state.inventory.maxStackSize || 100) + bonus;
            EventBus.publish('notification', { message: `Stack limits increased by ${bonus}!`, type: 'info' });
            EventBus.publish('state_changed', { source: 'max_stack' });
        }
    }
};

export default ProjectManager;
