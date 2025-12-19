// Fantasy Guild - Card Registry
// Phase 12: Card Registry



// Re-export constants
export * from './cardConstants.js';

// Import constants for local usage
import { CARD_TYPES, TASK_CATEGORIES, CARD_RARITIES, RARITY_SPAWN_WEIGHTS } from './cardConstants.js';

// Import separated card definitions
import { TASK_CARDS } from './cards/taskCards.js';
import { COMBAT_CARDS } from './cards/combatCards.js';
import { SPECIAL_CARDS } from './cards/specialCards.js';

// Combine all cards into main registry
export const CARDS = {
    ...TASK_CARDS,
    ...COMBAT_CARDS,
    ...SPECIAL_CARDS
};

// === Helper Functions ===

/**
 * Get a card template by ID
 * @param {string} cardId 
 * @returns {Object|null}
 */
export function getCard(cardId) {
    return CARDS[cardId] || null;
}

/**
 * Get all card templates
 * @returns {Object}
 */
export function getAllCards() {
    return { ...CARDS };
}

/**
 * Get cards by type
 * @param {string} cardType 
 * @returns {Array}
 */
export function getCardsByType(cardType) {
    return Object.values(CARDS).filter(c => c.cardType === cardType);
}

/**
 * Get all task cards
 * @returns {Array}
 */
export function getTaskCards() {
    return getCardsByType(CARD_TYPES.TASK);
}

/**
 * Get all unique cards (don't count against limit)
 * @returns {Array}
 */
export function getUniqueCards() {
    return Object.values(CARDS).filter(c => c.isUnique);
}

/**
 * Check if a card requires a specific skill level
 * @param {string} cardId 
 * @param {number} skillLevel 
 * @returns {boolean}
 */
export function meetsRequirement(cardId, skillLevel) {
    const card = getCard(cardId);
    if (!card) return false;
    return skillLevel >= (card.skillRequirement || 0);
}

/**
 * Get all card IDs
 * @returns {Array<string>}
 */
export function getAllCardIds() {
    return Object.keys(CARDS);
}

/**
 * Get card count
 * @returns {number}
 */
export function getCardCount() {
    return Object.keys(CARDS).length;
}



/**
 * Get all combat card templates
 * @returns {Array}
 */
export function getCombatCards() {
    return getCardsByType(CARD_TYPES.COMBAT);
}

/**
 * Get combat cards by biome
 * @param {string} biomeId 
 * @returns {Array}
 */
export function getCombatCardsByBiome(biomeId) {
    return Object.values(CARDS).filter(
        c => c.cardType === CARD_TYPES.COMBAT && c.biomeId === biomeId
    );
}

/**
 * Get a random combat card for a biome
 * @param {string} biomeId 
 * @returns {Object|null}
 */
export function getRandomCombatCardForBiome(biomeId) {
    const combatCards = getCombatCardsByBiome(biomeId);
    if (combatCards.length === 0) return null;
    return combatCards[Math.floor(Math.random() * combatCards.length)];
}
