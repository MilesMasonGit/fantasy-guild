// Fantasy Guild - Pack System
// Manages the Booster Pack buy → open → distribute flow.

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as CardManager from './CardManager.js';
import * as DeckSystem from './DeckSystem.js';
import { getAreaSet, getPackCost } from '../../config/registries/areaSetRegistry.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { logger } from '../../utils/Logger.js';

export const PackSystem = {

    /**
     * Initialize the PackSystem: subscribe to relevant events.
     */
    init() {
        EventBus.subscribe('quest_completed', (data) => this.handleQuestCompleted(data));
        EventBus.subscribe('quest_discarded', (data) => this.handleQuestDiscarded(data));
        logger.info('PackSystem', 'Initialized');
    },

    // ========================================
    // Pack Purchase
    // ========================================

    /**
     * Buy a Booster Pack from an Area Set's market.
     * @param {string} areaSetId
     * @returns {{ success: boolean, cost?: number, error?: string }}
     */
    buyPack(areaSetId) {
        const areaSet = getAreaSet(areaSetId);
        if (!areaSet) {
            return { success: false, error: 'INVALID_AREA_SET' };
        }

        // Check area is unlocked
        if (!GameState.collection.unlockedAreaSets.includes(areaSetId)) {
            return { success: false, error: 'AREA_NOT_UNLOCKED' };
        }

        // Calculate cost
        const packsBought = GameState.collection.packsBought[areaSetId] || 0;
        const cost = getPackCost(areaSetId, packsBought);

        // Deduct gold
        if (!CurrencyManager.spendCurrency('gold', cost, `buy_pack_${areaSetId}`)) {
            return { success: false, error: 'INSUFFICIENT_GOLD', cost };
        }

        // Track total packs bought for cost scaling
        if (!GameState.collection.packsBought[areaSetId]) {
            GameState.collection.packsBought[areaSetId] = 0;
        }
        GameState.collection.packsBought[areaSetId]++;

        // Add to Pack Deck on playmat
        DeckSystem.addToDeck(areaSetId, CARD_TYPES.PACK_DECK, 1);

        EventBus.publish('pack_purchased', { areaSetId, cost });
        EventBus.publish('state_changed');
        logger.info('PackSystem', `Bought pack from ${areaSet.name} for ${cost}g`);

        return { success: true, cost };
    },

    // ========================================
    // Pack Opening
    // ========================================

    /**
     * Open a Booster Pack from a Pack Deck.
     * Rolls 3 cards from the Area Set's card pool.
     * Cards go to the playmat by default.
     * @param {string} areaSetId
     * @returns {{ success: boolean, cards?: Array, error?: string }}
     */
    openPack(areaSetId) {
        const areaSet = getAreaSet(areaSetId);
        if (!areaSet) {
            return { success: false, error: 'INVALID_AREA_SET' };
        }

        // Find Pack Deck
        const packDeck = DeckSystem.findDeck(areaSetId, CARD_TYPES.PACK_DECK);
        if (!packDeck || packDeck.quantity <= 0) {
            return { success: false, error: 'NO_PACKS_AVAILABLE' };
        }

        // Decrement pack quantity
        DeckSystem.removeFromDeck(packDeck.id, 1);

        // Roll 3 cards
        const results = [];
        for (let i = 0; i < 3; i++) {
            const rolled = this._rollCardFromPool(areaSet);
            results.push(rolled);
        }

        EventBus.publish('pack_opened', { areaSetId, results });
        EventBus.publish('state_changed');
        logger.info('PackSystem', `Opened pack from ${areaSet.name}: [${results.map(r => r.cardId || r.replacement).join(', ')}]`);

        return { success: true, cards: results };
    },

    /**
     * Roll a single card from an Area Set's card pool,
     * applying duplicate checks and playset tracking.
     * @param {Object} areaSet - The Area Set definition
     * @returns {Object} Result with card info
     * @private
     */
    _rollCardFromPool(areaSet) {
        const pool = areaSet.cardPool;
        if (!pool || pool.length === 0) {
            logger.warn('PackSystem', `Empty card pool for ${areaSet.id}`);
            return { cardId: null, replacement: 'empty_pool', isNew: false };
        }

        // Weighted random selection
        const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
        let roll = Math.random() * totalWeight;
        let selected = pool[0];

        for (const entry of pool) {
            roll -= entry.weight;
            if (roll <= 0) {
                selected = entry;
                break;
            }
        }

        const cardId = selected.cardId;
        const isUnique = selected.isUnique || false;
        const maxCopies = isUnique ? 1 : 4;

        // Check playset
        const currentCount = GameState.collection.playsets[cardId] || 0;

        if (currentCount >= maxCopies) {
            // Duplicate — replace with Quest or Chest (50/50)
            const replacement = this._rollDuplicateReplacement(areaSet.id);
            return {
                cardId: cardId,
                isDuplicate: true,
                replacement: replacement.type,
                replacementAreaSetId: areaSet.id,
                isNew: false,
                playsetCount: currentCount,
                maxCopies: maxCopies,
            };
        }

        // New or additional copy — add to playset
        if (!GameState.collection.playsets[cardId]) {
            GameState.collection.playsets[cardId] = 0;
        }
        GameState.collection.playsets[cardId]++;
        EventBus.publish('collection_updated', { cardId, count: GameState.collection.playsets[cardId] });

        const newCount = GameState.collection.playsets[cardId];
        const isNew = newCount === 1;

        // Check for mastery (4/4)
        if (newCount >= 4 && !isUnique) {
            GameState.collection.mastery[cardId] = true;
            logger.info('PackSystem', `Mastery achieved for ${cardId}!`);
        }

        // Create the card on the playmat
        const createResult = CardManager.createCard(cardId);

        return {
            cardId: cardId,
            isDuplicate: false,
            isNew: isNew,
            playsetCount: newCount,
            maxCopies: maxCopies,
            isMastery: newCount >= maxCopies,
            card: createResult.success ? createResult.card : null,
        };
    },

    /**
     * Roll a duplicate replacement (Quest or Chest, 50/50).
     * Adds the result to the appropriate Deck.
     * @param {string} areaSetId
     * @returns {{ type: string }}
     * @private
     */
    _rollDuplicateReplacement(areaSetId) {
        const isQuest = Math.random() < 0.5;
        const deckType = isQuest ? CARD_TYPES.QUEST_DECK : CARD_TYPES.CHEST_DECK;
        const label = isQuest ? 'Quest' : 'Chest';

        DeckSystem.addToDeck(areaSetId, deckType, 1);
        logger.debug('PackSystem', `Duplicate replaced with ${label} for ${areaSetId}`);

        return { type: label.toLowerCase() };
    },

    // ========================================
    // Quest Completion / Discard
    // ========================================

    /**
     * Handle a quest being completed: award Map Fragment, check area unlock.
     * @param {{ questCardId: string, areaSetId: string, targetAreaSetId: string }} data
     */
    handleQuestCompleted(data) {
        const { areaSetId, targetAreaSetId } = data;
        const targetArea = targetAreaSetId || areaSetId;

        // Award Map Fragment
        if (!GameState.mapFragments[targetArea]) {
            GameState.mapFragments[targetArea] = 0;
        }
        GameState.mapFragments[targetArea]++;

        const areaSet = getAreaSet(targetArea);
        const fragmentsNeeded = areaSet ? areaSet.totalFragments : Infinity;
        const fragmentsNow = GameState.mapFragments[targetArea];

        logger.info('PackSystem', `Map Fragment earned for ${targetArea}: ${fragmentsNow}/${fragmentsNeeded}`);

        // Check area unlock
        if (fragmentsNow >= fragmentsNeeded && !GameState.collection.unlockedAreaSets.includes(targetArea)) {
            GameState.collection.unlockedAreaSets.push(targetArea);
            EventBus.publish('area_unlocked', { areaSetId: targetArea });
            logger.info('PackSystem', `Area unlocked: ${targetArea}!`);
        }

        EventBus.publish('map_fragment_found', {
            areaSetId: targetArea,
            fragments: fragmentsNow,
            totalRequired: fragmentsNeeded,
        });

        // Unblock Quest Deck draw
        DeckSystem.clearActiveQuest(areaSetId);

        EventBus.publish('state_changed');
    },

    /**
     * Handle a quest being discarded: just unblock the Quest Deck.
     * @param {{ questCardId: string, areaSetId: string }} data
     */
    handleQuestDiscarded(data) {
        const { areaSetId } = data;
        DeckSystem.clearActiveQuest(areaSetId);
        logger.debug('PackSystem', `Quest discarded for ${areaSetId}, deck unblocked`);
    },
};
