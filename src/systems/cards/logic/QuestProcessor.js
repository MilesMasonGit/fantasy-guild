import * as HeroManager from '../../hero/HeroManager.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import * as GradualInputSystem from '../../exploration/GradualInputSystem.js';
import { bumpCardRev } from '../CardManager.js';
import { checkRequirements } from './RequirementProcessor.js';

/**
 * Quest Module Processor
 * Handles higher-level progress (Quotas)
 */
export function processQuest(card, trait, deltaTime) {
    if (trait.questType === 'collection') {
        if (!card.questProgress) {
            const requirements = trait.requirements || {};
            card.questProgress = {
                inputProgress: GradualInputSystem.initInputProgress(requirements),
                requirements: requirements
            };
        }

        const { met } = checkRequirements(card);
        if (!met && card.status !== 'paused') {
            // Optional: Pause logic if needed
        }
    }
}

/**
 * Handle collection progress increment
 */
export function incrementCollectionProgress(card, amount = 1) {
    const questTrait = card.traits.find(t => t.type === 'quest' && t.questType === 'collection');
    if (!questTrait || !card.questProgress) return;

    const itemResolver = (key) => {
        const index = Object.keys(card.questProgress.requirements).indexOf(key);
        const assigned = card.assignedItems?.[index];
        return assigned?.id || assigned;
    };

    const result = GradualInputSystem.processGradualInputCycle(
        card.questProgress.inputProgress,
        card.questProgress.requirements,
        itemResolver,
        card.stack
    );

    if (Object.keys(result.consumed).length > 0) {
        bumpCardRev(card);
        EventBus.publish('cards_updated', { cardId: card.id, source: 'stack_consumed' });
    }

    logger.debug('QuestProcessor', 'incrementCollectionProgress result:', result);

    EventBus.publish('quest_progress_updated', { cardId: card.id, progress: card.questProgress });

    if (result.complete) {
        logger.info('QuestProcessor', 'Quest COMPLETE for card:', card.id);
        EventBus.publish('quest_completed', { cardId: card.id, questId: questTrait.id });
    }
}
