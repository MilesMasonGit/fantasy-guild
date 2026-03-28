// Fantasy Guild - Deck System
// Manages Deck cards (Pack Decks, Quest Decks, Chest Decks) on the playmat.
// A "Deck" is a meta-container with a quantity badge — distinct from the "Stack"
// system which manages hero/item assignment on task cards.

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as CardManager from './CardManager.js';
import { bumpCardRev } from './CardManager.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { logger } from '../../utils/Logger.js';

/**
 * Deck type labels for display
 */
const DECK_LABELS = {
    [CARD_TYPES.PACK_DECK]: 'Packs',
    [CARD_TYPES.QUEST_DECK]: 'Quests',
    [CARD_TYPES.CHEST_DECK]: 'Chests',
};

/**
 * Check if a card type is a deck type
 * @param {string} cardType
 * @returns {boolean}
 */
export function isDeckType(cardType) {
    return cardType === CARD_TYPES.PACK_DECK ||
        cardType === CARD_TYPES.QUEST_DECK ||
        cardType === CARD_TYPES.CHEST_DECK;
}

/**
 * Find an existing Deck card on the playmat
 * @param {string} areaSetId - Area Set ID
 * @param {string} deckType - CARD_TYPES.PACK_DECK | QUEST_DECK | CHEST_DECK
 * @returns {Object|null} The deck card object, or null
 */
export function findDeck(areaSetId, deckType) {
    if (!GameState.cards?.active) return null;
    return GameState.cards.active.find(
        c => c.cardType === deckType && c.areaSetId === areaSetId
    ) || null;
}

/**
 * Find an existing Deck or create a new one
 * @param {string} areaSetId
 * @param {string} deckType
 * @returns {Object} The deck card object
 */
export function findOrCreateDeck(areaSetId, deckType) {
    let deck = findDeck(areaSetId, deckType);
    if (deck) return deck;

    const areaSet = getAreaSet(areaSetId);
    if (!areaSet) {
        logger.error('DeckSystem', `Cannot create deck: unknown area set "${areaSetId}"`);
        return null;
    }

    const label = DECK_LABELS[deckType] || 'Cards';

    // Create deck via CardManager with a dynamic template
    const result = CardManager.createCard({
        id: `${deckType}_${areaSetId}`,
        name: `${areaSet.name} ${label}`,
        cardType: deckType,
        isUnique: true,  // Decks don't count toward the card cap
        icon: areaSet.icon || '📦',
        description: `A deck of ${label.toLowerCase()} from ${areaSet.name}.`,
    }, {
        overrides: {
            areaSetId: areaSetId,
            quantity: 0,
            activeQuestCardId: null,  // Only relevant for quest_deck
        }
    });

    if (!result.success) {
        logger.error('DeckSystem', `Failed to create ${deckType} for ${areaSetId}: ${result.error}`);
        return null;
    }

    logger.info('DeckSystem', `Created ${deckType} for ${areaSet.name}`);
    return result.card;
}

/**
 * Add items to a deck (incrementing quantity)
 * @param {string} areaSetId
 * @param {string} deckType
 * @param {number} count - Number of items to add
 * @returns {Object|null} The updated deck card, or null on failure
 */
export function addToDeck(areaSetId, deckType, count = 1) {
    const deck = findOrCreateDeck(areaSetId, deckType);
    if (!deck) return null;

    deck.quantity = (deck.quantity || 0) + count;

    EventBus.publish('deck_updated', {
        deckCardId: deck.id,
        deckType: deckType,
        areaSetId: areaSetId,
        quantity: deck.quantity,
    });
    EventBus.publish('state_changed');
    bumpCardRev(deck);
    EventBus.publish('cards_updated', { cardId: deck.id });

    logger.debug('DeckSystem', `Added ${count} to ${deckType} for ${areaSetId} (total: ${deck.quantity})`);
    return deck;
}

/**
 * Remove items from a deck (decrementing quantity)
 * @param {string} deckCardId - The ID of the deck card
 * @param {number} count - Number of items to remove
 * @returns {boolean} True if successful
 */
export function removeFromDeck(deckCardId, count = 1) {
    const deck = CardManager.getCard(deckCardId);
    if (!deck) {
        logger.warn('DeckSystem', `Deck not found: ${deckCardId}`);
        return false;
    }

    deck.quantity = Math.max(0, (deck.quantity || 0) - count);

    EventBus.publish('deck_updated', {
        deckCardId: deck.id,
        deckType: deck.cardType,
        areaSetId: deck.areaSetId,
        quantity: deck.quantity,
    });
    EventBus.publish('state_changed');
    bumpCardRev(deck);
    EventBus.publish('cards_updated', { cardId: deck.id });

    logger.debug('DeckSystem', `Removed ${count} from deck ${deckCardId} (remaining: ${deck.quantity})`);
    return true;
}

/**
 * Draw a quest from a Quest Deck
 * Creates a separate Quest card on the playmat and blocks further draws.
 * @param {string} deckCardId - The ID of the quest_deck card
 * @returns {{ success: boolean, questCard?: Object, error?: string }}
 */
export function drawQuestFromDeck(deckCardId) {
    const deck = CardManager.getCard(deckCardId);
    if (!deck || deck.cardType !== CARD_TYPES.QUEST_DECK) {
        return { success: false, error: 'INVALID_QUEST_DECK' };
    }

    if (deck.quantity <= 0) {
        return { success: false, error: 'DECK_EMPTY' };
    }

    if (deck.activeQuestCardId) {
        return { success: false, error: 'QUEST_ALREADY_ACTIVE' };
    }

    // Decrement quantity
    removeFromDeck(deckCardId, 1);

    // TODO: Create a Quest card from a quest template for this area.
    // For now, we create a placeholder quest card.
    const areaSet = getAreaSet(deck.areaSetId);
    const questResult = CardManager.createCard({
        id: `quest_${deck.areaSetId}_${Date.now()}`,
        name: `${areaSet?.name || 'Unknown'} Quest`,
        cardType: CARD_TYPES.QUEST,
        isUnique: false,
        icon: '📜',
        description: `Complete this quest to earn a Map Fragment for ${areaSet?.name || 'an unknown area'}.`,
    }, {
        overrides: {
            areaSetId: deck.areaSetId,
            questReward: 'map_fragment',  // or 'chest' — determined at creation
            targetAreaSetId: deck.areaSetId,
        }
    });

    if (!questResult.success) {
        logger.error('DeckSystem', `Failed to create quest from deck ${deckCardId}: ${questResult.error}`);
        return { success: false, error: questResult.error };
    }

    // Block further draws
    deck.activeQuestCardId = questResult.card.id;

    EventBus.publish('quest_drawn', {
        deckCardId: deckCardId,
        questCardId: questResult.card.id,
        areaSetId: deck.areaSetId,
    });
    EventBus.publish('state_changed');
    bumpCardRev(deck);
    EventBus.publish('cards_updated', { cardId: deck.id });

    logger.info('DeckSystem', `Drew quest from ${deck.name}: ${questResult.card.name}`);
    return { success: true, questCard: questResult.card };
}

/**
 * Clear the active quest from a Quest Deck, unblocking further draws.
 * Called when a quest is completed or discarded.
 * @param {string} areaSetId
 */
export function clearActiveQuest(areaSetId) {
    const deck = findDeck(areaSetId, CARD_TYPES.QUEST_DECK);
    if (!deck) return;

    deck.activeQuestCardId = null;

    EventBus.publish('deck_updated', {
        deckCardId: deck.id,
        deckType: deck.cardType,
        areaSetId: areaSetId,
        quantity: deck.quantity,
    });
    EventBus.publish('state_changed');
    bumpCardRev(deck);
    EventBus.publish('cards_updated', { cardId: deck.id });

    logger.debug('DeckSystem', `Cleared active quest for ${areaSetId}`);
}
