import { EventBus } from '../core/EventBus.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as CardManager from '../cards/CardManager.js';
import { logger } from '../../utils/Logger.js';

export function assignHero(heroId, cardId) {
    const hero = HeroManager.getHero(heroId);
    const card = CardManager.getCard(cardId);

    if (!hero || !card) return { success: false, error: 'ENTITY_NOT_FOUND' };
    if (hero.status === 'wounded') return { success: false, error: 'HERO_WOUNDED' };
    if (hero.assignedCardId) return { success: false, error: 'HERO_BUSY' };

    // 1. Update Card State (Atomic)
    CardManager.setAssignedHero(cardId, heroId);

    // 2. Update Hero State (Atomic)
    HeroManager.setAssignment(heroId, cardId);

    // 3. Sync Modifiers
    syncHeroModifiersToCard(hero, card);

    // 4. Status Handling
    if (['task', 'combat', 'invasion'].includes(card.cardType)) {
        card.status = 'active';
    }

    EventBus.publish('hero_assigned', { heroId, cardId });
    CardManager.publishCardUpdate(cardId);
    logger.info('AssignmentSystem', `Hero ${heroId} assigned to ${cardId}`);
    return { success: true };
}

export function unassignHero(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero || !hero.assignedCardId) return { success: true };

    const cardId = hero.assignedCardId;
    const card = CardManager.getCard(cardId);

    // 1. Clear Card State
    if (card) {
        CardManager.clearAssignedHero(cardId);
        clearHeroModifiersFromCard(heroId, card);
        card.status = 'idle';
        card.progress = 0;
    }

    // 2. Clear Hero State
    HeroManager.setAssignment(heroId, null);

    EventBus.publish('hero_unassigned', { heroId, cardId });
    if (cardId) CardManager.publishCardUpdate(cardId);
    logger.info('AssignmentSystem', `Hero ${heroId} unassigned from ${cardId}`);
    return { success: true };
}

export function silentUnlinkHero(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return;
    hero.assignedCardId = null;
    hero.status = 'idle';
}

export function silentUnlinkCard(cardId) {
    const card = CardManager.getCard(cardId);
    if (card && card.assignedHeroId) {
        const heroId = card.assignedHeroId;
        CardManager.clearAssignedHero(cardId);
        clearHeroModifiersFromCard(heroId, card);
    }
}

export function syncHeroModifiersToCard(hero, card) {
    if (!card.aggregator) card.aggregator = new ModifierAggregator(card.id);

    const prefix = `hero:${hero.id}`;
    card.aggregator.removeModifiersBySource(prefix);

    if (hero.aggregator) {
        for (const [sourceId, mods] of hero.aggregator.modifiers) {
            for (const mod of mods) {
                card.aggregator.addModifier({
                    ...mod,
                    source: `${prefix}:${sourceId}`
                });
            }
        }
    }
}

export function clearHeroModifiersFromCard(heroId, card) {
    if (!card.aggregator) return;
    const prefix = `hero:${heroId}`;
    const sourcesToRemove = [];
    
    for (const sourceId of card.aggregator.modifiers.keys()) {
        if (sourceId.startsWith(prefix)) sourcesToRemove.push(sourceId);
    }
    
    sourcesToRemove.forEach(s => card.aggregator.removeModifiersBySource(s));
}
