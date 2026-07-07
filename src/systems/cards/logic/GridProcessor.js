import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { effectEngine } from '../../effects/EffectEngine.js';
import { CardStackManager } from './CardStackManager.js';
import { publishCardUpdate } from './CardManagerUtils.js';

/**
 * Card Grid Logic - Handles 2D positioning and card reordering.
 */

export function reorderCard(cardId, newIndex) {
    const cards = GameState.cards.active;
    const oldIndex = cards.findIndex(c => c.id === cardId);
    if (oldIndex === -1) return { success: false, error: 'CARD_NOT_FOUND' };

    const clampedIndex = Math.max(0, Math.min(newIndex, cards.length - 1));
    if (oldIndex === clampedIndex) return { success: true };

    const [card] = cards.splice(oldIndex, 1);
    cards.splice(clampedIndex, 0, card);

    EventBus.publish('cards_updated', { source: 'reorder', cardId });
    effectEngine.pulse();
    return { success: true };
}

export function updateCardPosition(cardId, x, y) {
    const card = GameState.getCardById(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    card.position = { x, y };
    card.location = 'board';
    
    publishCardUpdate(cardId, { source: 'updateCardPosition' });
    effectEngine.pulse();

    return { success: true };
}

export function findFirstEmptyCell() {
    return CardStackManager.findFirstEmptyCell();
}
