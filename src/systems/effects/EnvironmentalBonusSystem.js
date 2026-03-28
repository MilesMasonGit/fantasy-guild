import { GameState } from '../../state/GameState.js';
import { getContext } from '../../utils/GridLookup.js';
import { getCard } from '../../config/registries/index.js';
import { logger } from '../../utils/Logger.js';

/**
 * EnvironmentalBonusSystem - Manages tile-based bonuses and constraints.
 * 
 * Integration:
 * - Recalculates multipliers when cards move or areas switch.
 * - Caches values on card instances for O(1) tick lookup.
 */

/**
 * Calculate and cache the environmental speed multiplier for a specific card.
 * @param {string} cardId - The ID of the card to recalculate
 */
export function recalcEnvMultiplier(cardId) {
    const card = GameState.getCardById(cardId);
    if (!card) return;

    // Default if unpositioned
    if (!card.position || card.position.x === null || card.position.y === null) {
        card.envMultiplier = 1.0;
        return;
    }

    const template = getCard(card.templateId);
    if (!template) {
        card.envMultiplier = 1.0;
        return;
    }

    // Determine target category for bonus matching
    const category = template.skill || template.taskCategory;

    const { tile, neighbors } = getContext(
        GameState.grid.tileMap,
        card.position.x,
        card.position.y
    );

    let multiplier = 1.0;

    // 1. Direct tile bonuses (range: 'self')
    if (tile.bonuses) {
        for (const bonus of tile.bonuses) {
            if (bonus.range === 'self' && bonus.category === category) {
                multiplier += bonus.value;
            }
        }
    }

    // 2. Adjacent tile bonuses (range: 'adjacent')
    for (const neighbor of neighbors) {
        if (neighbor.bonuses) {
            for (const bonus of neighbor.bonuses) {
                if (bonus.range === 'adjacent' && bonus.category === category) {
                    multiplier += bonus.value;
                }
            }
        }
    }

    // Set the cached value
    card.envMultiplier = multiplier;
    
    logger.debug('EnvBonus', `${card.templateId}@(${card.position.x},${card.position.y}) multiplier: x${multiplier.toFixed(2)}`);
}

/**
 * Recalculate multipliers for ALL active cards.
 * Called during area switch or major board events.
 */
export function recalcAllMultipliers() {
    const activeCards = GameState.cards?.active || [];
    for (const card of activeCards) {
        recalcEnvMultiplier(card.id);
    }
    logger.info('EnvBonus', `Recalculated multipliers for ${activeCards.length} cards`);
}
