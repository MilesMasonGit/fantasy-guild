import { GameState } from '../../state/GameState.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { getAreaSet, getPackCost } from '../../config/registries/areaSetRegistry.js';
import { getAreaQuests } from '../../config/registries/questRegistry.js';
import * as CardManager from '../cards/CardManager.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';

/**
 * CollectionManager
 * 
 * Handles card acquisition, pack generation, and the "Binder" (Library) logic.
 * All logic follows the "Pick 1 of 4" and "Unique Entity" rules.
 */
class CollectionManagerClass {

    /**
     * Generates 4 unique options according to the "1 Quest + 3 Cards" rule.
     * 
     * @param {string} areaId 
     * @returns {string[]} Array of templateIds
     */
    generatePackOptions(areaId) {
        const areaSet = getAreaSet(areaId);
        if (!areaSet) {
            logger.warn('CollectionManager', `Area set not found for ${areaId}`);
            return [];
        }

        const playsets = GameState.collection?.playsets || {};
        const areaState = GameState.areaStates?.[areaId] || { completedQuestIds: [] };
        const completedQuestIds = areaState.completedQuestIds || [];

        // 1. Identify all available cards (Tasks, Combat, etc.)
        const availableCards = Object.entries(areaSet.deckList || {})
            .filter(([id, maxCount]) => (playsets[id] || 0) < maxCount)
            .map(([id]) => id);

        // 2. Identify all available quests
        const areaQuests = getAreaQuests(areaId);
        const activeCards = CardManager.getActiveCards();
        const availableQuests = areaQuests
            .filter(q => {
                const isCompleted = completedQuestIds.includes(q.id);
                const isOnBoard = activeCards.some(c => c.templateId === q.id);
                return !isCompleted && !isOnBoard;
            })
            .map(q => q.id);

        // 3. Selection Strategy (1 Quest Slot + 3 Card Slots)
        const result = [];

        // Slot 1: Quest (or extra Card if no quests left)
        if (availableQuests.length > 0) {
            const idx = Math.floor(Math.random() * availableQuests.length);
            result.push(availableQuests[idx]);
        } else if (availableCards.length > 0) {
            const idx = Math.floor(Math.random() * availableCards.length);
            result.push(availableCards.splice(idx, 1)[0]);
        }

        // Slots 2-4: Cards (or extra Quests if cards exhausted)
        const secondaryPool = [...availableCards];
        const questPool = availableQuests.filter(q => !result.includes(q));

        // Attempt up to 3 more unique picks
        for (let i = 0; i < 3; i++) {
            if (secondaryPool.length > 0) {
                const idx = Math.floor(Math.random() * secondaryPool.length);
                result.push(secondaryPool.splice(idx, 1)[0]);
            } else if (questPool.length > 0) {
                const idx = Math.floor(Math.random() * questPool.length);
                result.push(questPool.splice(idx, 1)[0]);
            }
        }

        logger.info('CollectionManager', `Generated pack for ${areaId}: ${result.join(', ')}`);
        return result;
    }

    /**
     * Claims a card/quest, increments playsets, and creates the instance.
     * 
     * @param {string} templateId 
     * @param {string} areaId 
     * @param {Object} position - Optional {x, y} coordinates
     */
    claimCard(templateId, areaId, position = null) {
        const playsets = GameState.collection.playsets;
        
        // 1. Increment ownership count (if it's a card)
        // Note: Quests aren't strictly "playsets" but we track them for the "Picked 1 of 4" logic
        const areaSet = getAreaSet(areaId);
        if (areaSet && areaSet.deckList && areaSet.deckList[templateId]) {
            playsets[templateId] = (playsets[templateId] || 0) + 1;
        }

        // 2. Create the card instance
        // By default, newly claimed cards start in the Library (The Binder)
        // EXCEPT for Quests which must be placed on the board to be active.
        const cardTemplate = CardManager.getCard(templateId);
        const isQuest = cardTemplate?.cardType === CARD_TYPES.QUEST;

        const result = CardManager.createCard(templateId, {
            overrides: {
                areaId: areaId,
                location: isQuest ? 'board' : 'library', // Quests start on board, cards start in Binder
                position: position // Inherit position if provided
            }
        });

        if (result.success) {
            logger.info('CollectionManager', `Claimed ${templateId} in ${areaId}. Location: ${result.card.location}`);
            
            // Signal UI
            EventBus.publish('collection_updated', { templateId });
            EventBus.publish('state_changed');
            
            return { success: true, card: result.card };
        }

        return { success: false, error: result.error };
    }

    /**
     * Checks if an area is completely collected (all cards and quests picked/done).
     * 
     * @param {string} areaId 
     * @returns {boolean}
     */
    checkAreaExhaustion(areaId) {
        const areaSet = getAreaSet(areaId);
        if (!areaSet) return true;

        const playsets = GameState.collection?.playsets || {};
        const areaState = GameState.areaStates?.[areaId] || { completedQuestIds: [] };
        const completedQuestIds = areaState.completedQuestIds || [];

        // Check cards
        const allCardsCollected = Object.entries(areaSet.deckList || {})
            .every(([id, maxCount]) => (playsets[id] || 0) >= maxCount);

        // Check quests
        const areaQuests = getAreaQuests(areaId);
        const activeCards = CardManager.getActiveCards();
        const allQuestsDoneOrOwned = areaQuests.every(q => {
            const isCompleted = completedQuestIds.includes(q.id);
            const isOnBoard = activeCards.some(c => c.templateId === q.id);
            return isCompleted || isOnBoard;
        });

        return allCardsCollected && allQuestsDoneOrOwned;
    }

    /**
     * Returns the cost for a pack in an area.
     */
    getPackCost(areaId) {
        const packsBought = GameState.collection?.packsBought?.[areaId] || 0;
        return getPackCost(areaId, packsBought);
    }

    /**
     * Strategic purchase logic for getting a physical pack on the board.
     */
    buyPack(areaId) {
        // 1. Check if the area is already completely collected
        if (this.checkAreaExhaustion(areaId)) {
            return { success: false, error: 'AREA_EXHAUSTED' };
        }

        // 2. Check Gold
        const cost = this.getPackCost(areaId);
        if (GameState.currency.gold < cost) {
            return { success: false, error: 'INSUFFICIENT_GOLD' };
        }

        // 3. Check Board space (Max 12 active cards)
        if (GameState.cards.active.length >= (GameState.cards.limits?.max || 12)) {
            return { success: false, error: 'BOARD_FULL' };
        }

        // 4. Process Transaction
        const transactionSuccess = CurrencyManager.spendGold(cost, `Booster Pack: ${areaId}`);
        
        if (!transactionSuccess) {
            return { success: false, error: 'TRANSACTION_FAILED' };
        }
        
        // Ensure packsBought object exists
        if (!GameState.collection.packsBought) GameState.collection.packsBought = {};
        GameState.collection.packsBought[areaId] = (GameState.collection.packsBought[areaId] || 0) + 1;

        // 5. Spawn the Physical Pack
        const spawnResult = CardManager.createCard('booster_pack', {
            overrides: {
                areaId: areaId
            }
        });

        if (spawnResult.success) {
            logger.info('CollectionManager', `Purchased pack for ${areaId} at cost ${cost}.`);
            
            // 6. Signal UI
            EventBus.publish('collection_updated');
            EventBus.publish('cards_updated', { areaId });
            
            return { success: true, card: spawnResult.card };
        }
        
        // Rollback on spawn failure (unlikely but safe)
        CurrencyManager.addGold(cost, 'Spawn Failure Refund');
        GameState.collection.packsBought[areaId]--;
        
        return { success: false, error: 'SPAWN_FAILED' };
    }
}

export const CollectionManager = new CollectionManagerClass();
