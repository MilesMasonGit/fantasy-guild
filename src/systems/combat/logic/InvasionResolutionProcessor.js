import { GameState } from '../../../state/GameState.js';
import { getInvasion } from '../../../config/registries/invasionRegistry.js';
import { logger } from '../../../utils/Logger.js';
import { EventBus } from '../../core/EventBus.js';
import * as CardManager from '../../cards/CardManager.js';
import { InventoryManager } from '../../inventory/InventoryManager.js';
import * as SkillSystem from '../../hero/SkillSystem.js';
import { updateGlobalThreats } from './InvasionThreatProcessor.js';

/**
 * Invasion Resolution: Casualty tracking and multi-hero reward distribution.
 */

export function handleEnemyDefeated(cardId) {
    const state = GameState.invasions.active[cardId];
    if (!state) return;

    state.count--;

    // Sync to card for UI
    const card = CardManager.getCard(cardId);
    if (card) {
        card.hordeCount = state.count;
    }

    logger.debug('InvasionResolution', `Horde casualty recorded! ${state.count}/${state.total} remaining.`);

    if (state.count <= 0) {
        completeInvasion(cardId);
    }
}

export function completeInvasion(cardId) {
    const state = GameState.invasions.active[cardId];
    if (!state) return;

    const template = getInvasion(state.invasionId);
    logger.info('InvasionResolution', `Victory: ${template?.name || state.invasionId} horde scattered!`);

    const card = CardManager.getCard(cardId);
    const assignedHeroIds = resolveAssignedHeroes(card);

    // 1. Dispatch Tier Rewards (Items)
    if (template?.rewards) {
        template.rewards.forEach(r => {
            InventoryManager.addItem(r.itemId, r.count);
        });
    }

    // 2. Dispatch XP to all assigned defenders
    if (template?.xpRewards) {
        template.xpRewards.forEach(xp => {
            assignedHeroIds.forEach(heroId => {
                SkillSystem.addXP(heroId, xp.skill, xp.amount);
            });
        });
    }

    // Cleanup state
    delete GameState.invasions.active[cardId];
    updateGlobalThreats();

    // Discard card
    CardManager.discardCard(cardId);

    EventBus.publish('invasion_completed', {
        cardId,
        invasionId: state.invasionId,
        rewards: template?.rewards,
        xpRewards: template?.xpRewards
    });
}

function resolveAssignedHeroes(card) {
    if (!card || !card.assignedHeroId) return [];
    return [card.assignedHeroId];
}

