import { GameState } from '../../../state/GameState.js';

/**
 * Card Lookup - Efficient finding and filtering of active cards.
 */

/**
 * Get a card by ID (O(1) via cache)
 * @param {string} cardId 
 * @returns {Object|null}
 */
export function getCard(cardId) {
    return GameState.getCardById(cardId);
}

/**
 * Get all active cards
 * @returns {Array}
 */
export function getActiveCards() {
    return GameState.cards?.active || [];
}

/**
 * Get cards by type
 * @param {string} cardType 
 * @returns {Array}
 */
export function getCardsByType(cardType) {
    if (!GameState.cards?.active) return [];
    return GameState.cards.active.filter(c => c.cardType === cardType);
}

/**
 * Find the first card matching a template ID
 * @param {string} templateId 
 * @returns {Object|null}
 */
export function getCardByTemplate(templateId) {
    if (!GameState.cards?.active) return null;
    return GameState.cards.active.find(c => c.templateId === templateId) || null;
}

/**
 * Get card(s) assigned to a specific hero
 * @param {string} heroId 
 * @returns {Object|null}
 */
export function getCardByHero(heroId) {
    if (!GameState.cards?.active) return null;
    return GameState.cards.active.find(c => c.assignedHeroId === heroId) || null;
}


/**
 * Get count of non-unique cards
 * @returns {number}
 */
export function getCardCount() {
    return GameState.cards?.limits?.currentCount || 0;
}

/**
 * Get max card limit
 * @returns {number}
 */
export function getCardLimit() {
    return GameState.cards?.limits?.max || 12;
}
