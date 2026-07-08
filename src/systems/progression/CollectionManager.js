import { GameState } from '../../state/GameState.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { getAreaSet, getPackCost } from '../../config/registries/areaSetRegistry.js';
import { getAreaQuests } from '../../config/registries/questRegistry.js';
import * as CardManager from '../cards/CardManager.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';
import { UNIFIED_PACK } from '../../config/loopConstants.js';

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
        // Legacy path: spawns a physical card instance onto the old board.
        // Under the deck loop, claiming only touches the collection (§5F).
        if (USE_DECK_LOOP) {
            logger.warn('CollectionManager', 'claimCard is a legacy-board path — use claimToCollection under USE_DECK_LOOP');
            return this.claimToCollection(templateId);
        }
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
        // Legacy path: spawns a physical pack card onto the old board.
        if (USE_DECK_LOOP) {
            logger.warn('CollectionManager', 'buyPack(areaId) is a legacy-board path — use buyUnifiedPack under USE_DECK_LOOP');
            return { success: false, error: 'LEGACY_PATH_DISABLED' };
        }
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

    // ==================================================================
    // Unified Booster Pack (Phase 5 §5F/§5G — USE_DECK_LOOP only)
    //
    // One pack type whose pool spans every UNLOCKED area's card list
    // (concept §8A). Quests are never in the pool — area deckLists only
    // contain task/combat/station cards, and unlock quests are not cards
    // (§2G). No physical pack card is ever spawned.
    // ==================================================================

    /**
     * Cost of the next unified pack. One global curve over
     * `globalPacksBought` (placeholder numbers in loopConstants.js —
     * the old per-area curve has no meaning for an area-less pack).
     */
    getUnifiedPackCost() {
        const bought = GameState.collection?.globalPacksBought || 0;
        return UNIFIED_PACK.BASE_COST + bought * UNIFIED_PACK.COST_SCALING;
    }

    /**
     * Every templateId still obtainable from the unified pool: cards from
     * unlocked areas' deckLists whose playset is below its cap (§8B —
     * capped cards leave the pool permanently).
     */
    getUnifiedPool() {
        const playsets = GameState.collection?.playsets || {};
        const unlocked = GameState.collection?.unlockedAreaSets || [];
        const pool = [];
        for (const areaId of unlocked) {
            const areaSet = getAreaSet(areaId);
            for (const [templateId, maxCount] of Object.entries(areaSet?.deckList || {})) {
                if ((playsets[templateId] || 0) < maxCount && !pool.includes(templateId)) {
                    pool.push(templateId);
                }
            }
        }
        return pool;
    }

    /** "Sold Out": nothing left to pull anywhere. */
    checkUnifiedExhaustion() {
        return this.getUnifiedPool().length === 0;
    }

    /**
     * Draw 4 unique options from the unified pool (fewer if the pool is
     * nearly exhausted).
     */
    generateUnifiedPackOptions() {
        const pool = this.getUnifiedPool();
        const options = [];
        for (let i = 0; i < 4 && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            options.push(pool.splice(idx, 1)[0]);
        }
        logger.info('CollectionManager', `Generated unified pack: ${options.join(', ')}`);
        return options;
    }

    /**
     * Buy a unified pack: pay gold, bump the global counter, hand the 4
     * options to the UI. The player claims ONE via claimToCollection().
     * @returns {{ success: boolean, options?: string[], error?: string }}
     */
    buyUnifiedPack() {
        if (this.checkUnifiedExhaustion()) {
            return { success: false, error: 'SOLD_OUT' };
        }

        const cost = this.getUnifiedPackCost();
        if (GameState.currency.gold < cost) {
            return { success: false, error: 'INSUFFICIENT_GOLD' };
        }
        if (!CurrencyManager.spendGold(cost, 'Unified Booster Pack')) {
            return { success: false, error: 'TRANSACTION_FAILED' };
        }

        GameState.collection.globalPacksBought = (GameState.collection.globalPacksBought || 0) + 1;

        const options = this.generateUnifiedPackOptions();
        EventBus.publish('collection_updated');
        logger.info('CollectionManager', `Unified pack purchased for ${cost}g (total bought: ${GameState.collection.globalPacksBought})`);
        return { success: true, options, cost };
    }

    /**
     * Claim one pack option into the Binder (§5F). The ownership count is
     * the ONLY state change — no card instance is spawned anywhere.
     */
    claimToCollection(templateId) {
        const playsets = GameState.collection.playsets;
        if ((playsets[templateId] || 0) >= 4) {
            return { success: false, error: 'Playset already complete (4/4)' };
        }
        playsets[templateId] = (playsets[templateId] || 0) + 1;

        EventBus.publish('collection_updated', { templateId });
        logger.info('CollectionManager', `Claimed "${templateId}" to collection (${playsets[templateId]}/4)`);
        return { success: true, count: playsets[templateId] };
    }

    /**
     * Discovery is implicit from ownership under the deck loop (§5H) — no
     * separate tracker.
     */
    isCardDiscovered(templateId) {
        return (GameState.collection?.playsets?.[templateId] || 0) >= 1;
    }
}

export const CollectionManager = new CollectionManagerClass();
