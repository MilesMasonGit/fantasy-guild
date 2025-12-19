// Fantasy Guild - Card Expansion Manager
// Manages expansion state for cards (similar to Hero Cards)

// Track which cards have expanded sections
export const expandedCards = new Set();

/**
 * Toggle card expansion state
 * @param {string} cardId - Card instance ID
 * @param {boolean} isExpanded - Whether the card should be expanded
 */
export function toggleCardExpansion(cardId, isExpanded) {
    if (isExpanded) {
        expandedCards.add(cardId);
    } else {
        expandedCards.delete(cardId);
    }
}

/**
 * Check if a card is currently expanded
 * @param {string} cardId - Card instance ID
 * @returns {boolean}
 */
export function isCardExpanded(cardId) {
    return expandedCards.has(cardId);
}

/**
 * Collapse all cards
 */
export function collapseAllCards() {
    expandedCards.clear();
}
