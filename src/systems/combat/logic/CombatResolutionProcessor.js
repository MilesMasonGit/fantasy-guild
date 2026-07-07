import { logger } from '../../../utils/Logger.js';
import { EventBus } from '../../core/EventBus.js';
import * as CardManager from '../../cards/CardManager.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { QuestTracker } from '../../progression/QuestTracker.js';
import { bumpCardRev } from '../../cards/CardManager.js';
import { InvasionManager } from '../../combat/InvasionManager.js';
import { RegistryManager } from '../../progression/RegistryManager.js';

/**
 * Combat Resolution: Handling Victory, Defeat, and Reward Dispatch.
 */

export function handleVictory(card, hero, enemy) {
    logger.info('CombatResolution', `Victory: ${hero.name} defeated ${enemy.name}`);
    
    EventBus.publish('combat_victory', {
        cardId: card.id,
        heroId: hero.id,
        areaId: card.areaId || 'area_guild_hall',
        enemyId: enemy.id,
        enemyName: enemy.name,
        drops: enemy.drops,
        dropTableId: enemy.dropTableId
    });

    RegistryManager.recordEnemyDefeat(enemy.id);
    QuestTracker.processEvent('ON_ENEMY_KILLED', { enemyId: enemy.id });

    // Archetype Routing
    if (card.cardType === 'area') {
        _handleAreaVictory(card, enemy);
    } else if (card.cardType === 'invasion') {
        _handleInvasionVictory(card);
    } else {
        card.combatState.intermissionTimer = 3000;
        card.status = 'victory';
    }

    HeroManager.setHeroStatus(hero.id, 'idle');
}

export function handleDefeat(card, hero, enemy) {
    logger.info('CombatResolution', `Defeat: ${hero.name} bested by ${enemy.name}`);
    
    CardManager.unassignHero(card.id);
    HeroManager.setHeroStatus(hero.id, 'wounded');
    CardManager.resetCombatCard(card.id);
    
    EventBus.publish('combat_defeat', { cardId: card.id, heroId: hero.id });
}

export function _handleAreaVictory(card, enemy) {
    const currentGroup = card.enemyGroups?.[card.currentGroupIndex ?? 0];
    if (!currentGroup) return;

    currentGroup.remaining = (currentGroup.remaining ?? currentGroup.total) - 1;
    
    if (currentGroup.remaining <= 0) {
        _completeAreaGroup(card, currentGroup);
    } else {
        card.enemyHp = { current: enemy.hp, max: enemy.hp };
        card.heroTickProgress = 0;
        card.enemyTickProgress = 0;
    }
    
    bumpCardRev(card);
    EventBus.publish('cards_updated', { cardId: card.id });
}

export async function _handleInvasionVictory(card) {
    // Logic: Delegate casualty tracking and cleanup to InvasionManager
    InvasionManager.handleEnemyDefeated(card.id);
    
    // UI: If not discarded yet, show victory state
    const currentCard = CardManager.getCard(card.id);
    if (currentCard && currentCard.hordeCount > 0) {
        currentCard.combatState.intermissionTimer = 2000;
        currentCard.status = 'victory';
        bumpCardRev(currentCard);
        EventBus.publish('cards_updated', { cardId: currentCard.id });
    }
}

export function _completeAreaGroup(card, group) {
    card.awaitingTaskClaim = true;
    card.pendingTaskClaim = { taskId: group.unlocksTask, groupIndex: card.currentGroupIndex ?? 0 };
    
    const heroId = card.assignedHeroId;
    if (heroId) HeroManager.setHeroStatus(heroId, 'idle');
    
    bumpCardRev(card);
    EventBus.publish('cards_updated', { cardId: card.id });
}
