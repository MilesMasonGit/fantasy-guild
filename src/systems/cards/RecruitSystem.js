// Fantasy Guild - Recruit System
// Handles recruit card creation and hero recruitment

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as CardManager from './CardManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import { generateHero } from '../hero/HeroGenerator.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { calculateRecruitCost } from '../../utils/RecruitCostCalculator.js';
import { CARD_TYPES } from '../../config/registries/cardRegistry.js';
import { logger } from '../../utils/Logger.js';

/**
 * RecruitSystem - Manages recruit cards and hero recruitment
 * 
 * Flow:
 * 1. createRecruitCard() - Generates card with 3 random hero options
 * 2. selectOption() - Player selects one of the 3 options
 * 3. confirmRecruit() - Spends Influence, creates hero, removes card
 */
export const RecruitSystem = {
    initialized: false,

    /**
     * Initialize the recruit system
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        logger.info('RecruitSystem', 'Initialized');
    },

    /**
     * Creates a new recruit card with 3 random hero options
     * @param {boolean} isFree - If true, card costs 0 Influence to use
     * @returns {Object} The created card instance
     */
    createRecruitCard(isFree = false) {
        // Generate 3 random hero candidates
        const heroOptions = [
            generateHero(),
            generateHero(),
            generateHero()
        ];

        // Create card instance
        const cardInstance = {
            id: CardManager.generateId('recruit'),
            templateId: 'recruit',
            cardType: CARD_TYPES.RECRUIT,
            status: 'pending',
            createdAt: Date.now(),
            // Recruit-specific data
            heroOptions: heroOptions,
            selectedIndex: null,
            isFree: isFree  // Flag for free recruitment
        };

        // Add to stack using centralized positioning (recruit goes to top)
        CardManager.addToStack(cardInstance);

        EventBus.publish('cards_updated', { source: 'RecruitSystem' });
        logger.debug('RecruitSystem', 'Created recruit card:', cardInstance.id);

        return cardInstance;
    },

    /**
     * Get a recruit card by ID
     * @param {string} cardId 
     * @returns {Object|null}
     */
    getRecruitCard(cardId) {
        return GameState.cards.active.find(
            c => c.id === cardId && c.cardType === CARD_TYPES.RECRUIT
        ) || null;
    },

    /**
     * Marks a hero option as selected (UI state)
     * @param {string} cardId 
     * @param {number} optionIndex - 0, 1, or 2
     */
    selectOption(cardId, optionIndex) {
        const card = this.getRecruitCard(cardId);
        if (!card) {
            console.error('[RecruitSystem] Card not found:', cardId);
            return false;
        }

        if (optionIndex < 0 || optionIndex > 2) {
            console.error('[RecruitSystem] Invalid option index:', optionIndex);
            return false;
        }

        card.selectedIndex = optionIndex;
        EventBus.publish('cards_updated', { source: 'RecruitSystem' });
        return true;
    },

    /**
     * Confirms recruitment - spends Influence, creates hero, removes card
     * @param {string} cardId 
     * @returns {Object} { success, hero, error }
     */
    confirmRecruit(cardId) {
        const card = this.getRecruitCard(cardId);
        if (!card) {
            return { success: false, error: 'Card not found' };
        }

        if (card.selectedIndex === null) {
            return { success: false, error: 'No hero selected' };
        }

        // Check cost (skip for free cards)
        const cost = this.getRecruitCost();
        if (!card.isFree) {
            if (!CurrencyManager.canAfford(cost)) {
                return { success: false, error: `Not enough Influence (need ${cost})` };
            }
        }

        // Get selected hero data
        const heroData = card.heroOptions[card.selectedIndex];
        if (!heroData) {
            return { success: false, error: 'Invalid hero selection' };
        }

        // Spend Influence and increment counter (only for paid cards)
        if (!card.isFree) {
            CurrencyManager.spendInfluence(cost, 'recruit');
            GameState.currency.totalRecruits = (GameState.currency.totalRecruits || 0) + 1;
        }

        // Add hero to roster
        const hero = HeroManager.addHero(heroData);

        // Remove the recruit card
        const cardIndex = GameState.cards.active.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            GameState.cards.active.splice(cardIndex, 1);
        }

        EventBus.publish('cards_updated', { source: 'RecruitSystem' });
        EventBus.publish('hero_recruited', { hero, cost });

        logger.info('RecruitSystem', `Recruited ${hero.name} for ${cost} Influence`);
        return { success: true, hero };
    },

    /**
     * Returns current recruit cost based on completed Projects
     * @returns {number}
     */
    getRecruitCost() {
        return calculateRecruitCost();
    },

    /**
     * Get all active recruit cards
     * @returns {Array}
     */
    getActiveRecruitCards() {
        return GameState.cards.active.filter(c => c.cardType === CARD_TYPES.RECRUIT);
    }
};
