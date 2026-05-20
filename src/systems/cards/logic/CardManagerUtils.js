import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import { getCard as getCardTemplate } from '../../../config/registries/cardRegistry.js';
import { ensureModular } from '../CardAssembler.js';
import { AssignmentSystem } from '../../global/AssignmentSystem.js';
import { effectEngine } from '../../effects/EffectEngine.js';

/**
 * Common Card Utilities
 */

export function bumpCardRev(card) {
    if (card) card._rev = (card._rev || 0) + 1;
}

export function publishCardUpdate(cardId, extraData = {}) {
    const card = GameState.getCardById(cardId);
    if (!card) return;
    
    // Bump individual card revision
    bumpCardRev(card);
    
    // Bump global cards collection revision to trigger reactive UI updates
    if (GameState.state.cards) {
        GameState.state.cards._rev = (GameState.state.cards._rev || 0) + 1;
    }
    
    EventBus.publish('cards_updated', { cardId, ...extraData });
}

export function updateProgress(cardId, amount) {
    const card = GameState.getCardById(cardId);
    if (!card) return;
    if (card.progress === undefined || card.progress === null) card.progress = 0;
    card.progress += amount;
}

export function resetProgress(cardId) {
    const card = GameState.getCardById(cardId);
    if (!card) return;
    card.progress = 0;
}

export function rehydrateCards() {
    logger.info('CardManagerUtils', 'Rehydrating all cards...');
    const allCards = [...(GameState.cards?.active || []), ...(GameState.cards?.library || [])];
    allCards.forEach(card => {
        const template = getCardTemplate(card.templateId);
        if (template) ensureModular(card, template);
    });
}

export function reapplyAllPersistentModifiers() {
    logger.info('CardManagerUtils', 'Re-applying persistent modifiers...');
    
    const activeCards = GameState.cards?.active || [];
    const heroes = GameState.heroes || [];

    for (const card of activeCards) {
        if (card.assignedHeroId) {
            const hero = heroes.find(h => h.id === card.assignedHeroId);
            if (hero) AssignmentSystem.syncHeroModifiersToCard(hero, card);
        }
    }
    effectEngine.pulse();
}

/**
 * Atomic helper to set the assigned hero on a card.
 * Handles purging of any legacy multi-hero stubs.
 */
export function setAssignedHero(cardId, heroId) {
    const card = GameState.getCardById(cardId);
    if (!card) return;

    // Standardize: Remove legacy stubs
    if (card.heroSlots) delete card.heroSlots;
    if (card.stack) {
        card.stack = card.stack.filter(e => e.type !== 'hero');
    }

    card.assignedHeroId = heroId;
    bumpCardRev(card);
}

/**
 * Atomic helper to clear the assigned hero from a card.
 */
export function clearAssignedHero(cardId) {
    const card = GameState.getCardById(cardId);
    if (!card) return;

    card.assignedHeroId = null;
    
    // Cleanup stubs just in case
    if (card.heroSlots) delete card.heroSlots;
    if (card.stack) {
        card.stack = card.stack.filter(e => e.type !== 'hero');
    }

    bumpCardRev(card);
}

/**
 * Efficiently clones traits array for state snapshots.
 * Uses structuredClone for deep integrity.
 */
export function cloneTraits(traits) {
    if (!traits) return [];
    return structuredClone(traits);
}

