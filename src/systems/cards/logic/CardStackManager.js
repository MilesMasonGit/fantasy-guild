import { GameState } from '../../../state/GameState.js';
import { isDeckType } from '../DeckSystem.js';
import { logger } from '../../../utils/Logger.js';

/**
 * CardStackManager
 * 
 * Handles the physical (grid) and logical (stack order) positioning of cards.
 */
export const CardStackManager = {
    /**
     * Add a card to the active array with semantic layering
     */
    addToStack(card) {
        const cards = GameState.cards.active;
        const type = card.cardType;

        if (type === 'recruit') {
            cards.unshift(card);
        } else if (isDeckType(type)) {
            const lastRecruitIndex = cards.findLastIndex(c => c.cardType === 'recruit');
            cards.splice(lastRecruitIndex + 1, 0, card);
        } else {
            cards.push(card);
        }
    },

    /**
     * Find nearest empty cell to the Hub
     * @param {Object} options - { isGutter: boolean }
     */
    findFirstEmptyCell(options = { isGutter: false }) {
        const grid = GameState.state.grid;
        if (!grid || !grid.validCells) return null;

        const occupied = new Set(GameState.cards.active
            .filter(c => c.position?.x !== null)
            .map(c => `${c.position.x},${c.position.y}`));

        const hubPos = grid.hubPosition || { x: 0, y: 0 };
        occupied.add(`${hubPos.x},${hubPos.y}`);

        return grid.validCells
            .filter(cell => !!cell.isGutter === !!options.isGutter)
            .map(cell => ({ ...cell, dist: Math.hypot(cell.x - hubPos.x, cell.y - hubPos.y) }))
            .sort((a, b) => a.dist - b.dist)
            .find(cell => !occupied.has(`${cell.x},${cell.y}`)) || null;
    }
};

export default CardStackManager;
