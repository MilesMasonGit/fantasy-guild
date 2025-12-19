// Fantasy Guild - Trade-Up System
// Phase 29: Trade-Up Cards

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as CardManager from './CardManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getCard, CARD_TYPES, CARD_RARITIES, RARITY_INFO } from '../../config/registries/cardRegistry.js';
import { getBiome } from '../../config/registries/biomeRegistry.js';
import { getModifier } from '../../config/registries/modifierRegistry.js';
import { formatLocation } from '../../utils/Formatters.js';
import { logger } from '../../utils/Logger.js';

/**
 * TradeUpSystem - Handles combining 5 same-rarity cards into 1 higher-rarity card
 * 
 * Mechanics:
 * - 5 Task Cards of same rarity → 1 Task Card of next rarity
 * - Task type: weighted random based on input cards
 * - Biome/Modifier: weighted random based on input cards (as pairs)
 * - Basic and Legendary cards cannot be traded up
 */

// Rarity upgrade map
const RARITY_UPGRADE = {
    [CARD_RARITIES.COMMON]: CARD_RARITIES.UNCOMMON,
    [CARD_RARITIES.UNCOMMON]: CARD_RARITIES.RARE,
    [CARD_RARITIES.RARE]: CARD_RARITIES.EPIC,
    [CARD_RARITIES.EPIC]: CARD_RARITIES.LEGENDARY
};

// Slot state (not persisted - modal only)
let tradeUpSlots = [null, null, null, null, null];

const TradeUpSystem = {
    /** Track if system is initialized */
    initialized: false,

    /**
     * Initialize the system
     */
    init() {
        if (this.initialized) return;
        this.clearSlots();
        this.initialized = true;
        logger.info('TradeUpSystem', 'Initialized');
    },

    /**
     * Clear all trade slots
     */
    clearSlots() {
        tradeUpSlots = [null, null, null, null, null];
    },

    /**
     * Get current slot contents
     * @returns {Array} Array of 5 card IDs (or null)
     */
    getSlots() {
        return [...tradeUpSlots];
    },

    /**
     * Get cards currently in slots
     * @returns {Array} Array of card objects
     */
    getSlotCards() {
        return tradeUpSlots
            .filter(id => id !== null)
            .map(id => CardManager.getCard(id))
            .filter(card => card !== null);
    },

    /**
     * Check if a card is eligible for trade-up
     * @param {string} cardId 
     * @returns {{ eligible: boolean, reason?: string }}
     */
    isCardEligible(cardId) {
        const card = CardManager.getCard(cardId);
        if (!card) {
            return { eligible: false, reason: 'Card not found' };
        }

        // Must be a Task card
        if (card.cardType !== CARD_TYPES.TASK) {
            return { eligible: false, reason: 'Only Task cards can be traded' };
        }

        // Cannot trade Basic rarity
        if (card.rarity === CARD_RARITIES.BASIC) {
            return { eligible: false, reason: 'Basic cards cannot be traded' };
        }

        // Cannot trade Legendary (no higher tier)
        if (card.rarity === CARD_RARITIES.LEGENDARY) {
            return { eligible: false, reason: 'Legendary cards cannot be traded' };
        }

        return { eligible: true };
    },

    /**
     * Check if a card is already in a slot
     * @param {string} cardId 
     * @returns {boolean}
     */
    isCardInSlot(cardId) {
        return tradeUpSlots.includes(cardId);
    },

    /**
     * Add a card to the next available slot
     * @param {string} cardId 
     * @returns {{ success: boolean, slotIndex?: number, error?: string }}
     */
    addCardToSlot(cardId) {
        // Check eligibility
        const eligibility = this.isCardEligible(cardId);
        if (!eligibility.eligible) {
            return { success: false, error: eligibility.reason };
        }

        // Check if already in slot
        if (this.isCardInSlot(cardId)) {
            return { success: false, error: 'Card already in slot' };
        }

        // Find first empty slot
        const emptyIndex = tradeUpSlots.findIndex(slot => slot === null);
        if (emptyIndex === -1) {
            return { success: false, error: 'All slots are full' };
        }

        tradeUpSlots[emptyIndex] = cardId;
        EventBus.publish('tradeup_slots_changed', { slots: this.getSlots() });

        return { success: true, slotIndex: emptyIndex };
    },

    /**
     * Remove a card from a slot
     * @param {number} slotIndex 
     * @returns {{ success: boolean, cardId?: string }}
     */
    removeCardFromSlot(slotIndex) {
        if (slotIndex < 0 || slotIndex >= 5) {
            return { success: false };
        }

        const cardId = tradeUpSlots[slotIndex];
        tradeUpSlots[slotIndex] = null;

        EventBus.publish('tradeup_slots_changed', { slots: this.getSlots() });

        return { success: true, cardId };
    },

    /**
     * Validate that all slots have same rarity
     * @returns {{ valid: boolean, rarity?: string, error?: string }}
     */
    validateSlots() {
        const cards = this.getSlotCards();

        // Need exactly 5 cards
        if (cards.length !== 5) {
            return { valid: false, error: 'Need 5 cards' };
        }

        // Check all same rarity
        const rarities = new Set(cards.map(c => c.rarity));
        if (rarities.size !== 1) {
            return { valid: false, error: 'All cards must be same Rarity' };
        }

        const rarity = cards[0].rarity;
        return { valid: true, rarity };
    },

    /**
     * Calculate weighted probabilities for the result
     * @returns {{ tasks: Array, biomes: Array }}
     */
    calculateProbabilities() {
        const cards = this.getSlotCards();
        if (cards.length === 0) {
            return { tasks: [], biomes: [] };
        }

        // Count task occurrences
        const taskCounts = {};
        cards.forEach(card => {
            const key = card.templateId;
            taskCounts[key] = (taskCounts[key] || 0) + 1;
        });

        // Convert to probabilities
        const total = cards.length;
        const tasks = Object.entries(taskCounts).map(([templateId, count]) => {
            const card = cards.find(c => c.templateId === templateId);
            return {
                templateId,
                name: card?.name || templateId,
                probability: Math.round((count / total) * 100)
            };
        }).sort((a, b) => b.probability - a.probability);

        // Count biome/modifier pairs
        const biomeCounts = {};
        cards.forEach(card => {
            const key = `${card.biomeId || 'none'}|${card.modifierId || 'none'}`;
            if (!biomeCounts[key]) {
                biomeCounts[key] = {
                    biomeId: card.biomeId,
                    modifierId: card.modifierId,
                    count: 0
                };
            }
            biomeCounts[key].count++;
        });

        // Convert to probabilities
        const biomes = Object.values(biomeCounts).map(entry => {
            const biome = getBiome(entry.biomeId);
            const modifier = getModifier(entry.modifierId);
            const biomeName = biome?.name || 'Unknown';
            const modName = modifier?.name || '';
            const displayName = modName ? `${modName} ${biomeName}` : biomeName;

            return {
                biomeId: entry.biomeId,
                modifierId: entry.modifierId,
                name: displayName,
                probability: Math.round((entry.count / total) * 100)
            };
        }).sort((a, b) => b.probability - a.probability);

        return { tasks, biomes };
    },

    /**
     * Get the next rarity tier
     * @param {string} rarity 
     * @returns {string|null}
     */
    getNextRarity(rarity) {
        return RARITY_UPGRADE[rarity] || null;
    },

    /**
     * Execute the trade-up: consume 5 cards, create 1 new card
     * @returns {{ success: boolean, newCard?: Object, error?: string }}
     */
    executeTradeUp() {
        // Validate
        const validation = this.validateSlots();
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const cards = this.getSlotCards();
        const currentRarity = validation.rarity;
        const newRarity = this.getNextRarity(currentRarity);

        if (!newRarity) {
            return { success: false, error: 'Cannot trade up this rarity' };
        }

        // Roll for task type (weighted)
        const taskCounts = {};
        cards.forEach(card => {
            taskCounts[card.templateId] = (taskCounts[card.templateId] || 0) + 1;
        });

        const taskRoll = Math.random() * cards.length;
        let taskAccum = 0;
        let selectedTemplateId = cards[0].templateId;
        for (const [templateId, count] of Object.entries(taskCounts)) {
            taskAccum += count;
            if (taskRoll < taskAccum) {
                selectedTemplateId = templateId;
                break;
            }
        }

        // Roll for biome/modifier pair (weighted)
        const biomePairs = {};
        cards.forEach(card => {
            const key = `${card.biomeId}|${card.modifierId}`;
            if (!biomePairs[key]) {
                biomePairs[key] = {
                    biomeId: card.biomeId,
                    modifierId: card.modifierId,
                    count: 0
                };
            }
            biomePairs[key].count++;
        });

        const biomeRoll = Math.random() * cards.length;
        let biomeAccum = 0;
        let selectedBiome = { biomeId: null, modifierId: null };
        for (const pair of Object.values(biomePairs)) {
            biomeAccum += pair.count;
            if (biomeRoll < biomeAccum) {
                selectedBiome = { biomeId: pair.biomeId, modifierId: pair.modifierId };
                break;
            }
        }

        // Unassign heroes from all cards being traded
        const cardIds = tradeUpSlots.filter(id => id !== null);
        cardIds.forEach(cardId => {
            const card = CardManager.getCard(cardId);
            if (card?.assignedHeroId) {
                CardManager.unassignHero(cardId);
            }
        });

        // Discard the 5 cards
        cardIds.forEach(cardId => {
            CardManager.discardCard(cardId);
        });

        // Create the new card with upgraded rarity
        const result = CardManager.createCard(selectedTemplateId, {
            overrides: {
                rarity: newRarity,
                biomeId: selectedBiome.biomeId,
                modifierId: selectedBiome.modifierId
            }
        });

        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Clear slots
        this.clearSlots();

        // Get rarity label and biome name for notification
        const rarityLabel = RARITY_INFO[newRarity]?.label || newRarity;
        const locationText = formatLocation(selectedBiome.biomeId, selectedBiome.modifierId);

        NotificationSystem.notify(`⬆️ Trade Up success! Created ${rarityLabel} ${result.card.name} (${locationText})`, 'success');
        EventBus.publish('tradeup_completed', {
            newCard: result.card,
            tradedCardIds: cardIds
        });
        EventBus.publish('tradeup_slots_changed', { slots: this.getSlots() });
        EventBus.publish('cards_updated');

        logger.info('TradeUpSystem', `Trade up complete: ${selectedTemplateId} (${newRarity})`);

        return { success: true, newCard: result.card };
    },

    /**
     * Get all eligible cards from the card stack
     * @returns {Array} Array of { card, eligible, reason }
     */
    getEligibleCards() {
        const activeCards = GameState.cards?.active || [];
        return activeCards.map(card => {
            const eligibility = this.isCardEligible(card.id);
            return {
                card,
                eligible: eligibility.eligible,
                reason: eligibility.reason,
                inSlot: this.isCardInSlot(card.id)
            };
        });
    }
};

export { TradeUpSystem };
