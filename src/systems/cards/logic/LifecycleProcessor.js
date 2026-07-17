import { GameState } from '../../../state/GameState.js';
import { publishCardUpdate } from './CardManagerUtils.js';

/**
 * Card Lifecycle - Status management for live card instances.
 *
 * The old board lifecycle (createCard/vaultCard/deployCard/discardCard)
 * was removed in the Phase 9 legacy sweep — deck-loop cards are ephemeral
 * instances built by CardFactory.createInstance() inside LoopRunner, and
 * ownership lives in collection.playsets (DeckSlotManager).
 */

export function setCardStatus(cardId, status) {
    const card = GameState.getCardById(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    card.status = status;
    publishCardUpdate(cardId, { status });
    return { success: true };
}
