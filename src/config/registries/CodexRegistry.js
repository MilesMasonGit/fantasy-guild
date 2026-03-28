// Fantasy Guild - Codex Registry Helper
// Part of the Collection System (Codex)

import { getAllCards, CARD_TYPES } from './cardRegistry.js';
import { getAllEnemies } from './enemyRegistry.js';
import { GameState } from '../../state/GameState.js';

/**
 * CodexRegistry - Logic for bi-directional linking in the Codex
 * 
 * Functions:
 * - Find all sources (Tasks/Combat/Enemies) that produce an item
 * - Find all tasks that use an item as input
 * - Get masked loot tables for enemies
 */
export const CodexRegistry = {
    /**
     * Find all entities that produce a specific item
     * @param {string} itemId 
     * @returns {Array} [{ type: 'task'|'enemy', id, name }]
     */
    getSourcesForItem(itemId) {
        const sources = [];
        const allCards = getAllCards();
        const allEnemies = getAllEnemies();

        // 1. Scan Cards (Tasks, Combat, etc.)
        for (const [cardId, card] of Object.entries(allCards)) {
            let producesItem = false;

            // Check flat outputs array
            if (card.outputs && Array.isArray(card.outputs)) {
                if (card.outputs.some(o => (typeof o === 'string' ? o === itemId : o.itemId === itemId))) {
                    producesItem = true;
                }
            }

            // Check outputMap (if used)
            if (card.outputMap) {
                // Heuristic: check all values in the map recursively or flatly
                const mapStr = JSON.stringify(card.outputMap);
                if (mapStr.includes(`"${itemId}"`)) {
                    producesItem = true;
                }
            }

            if (producesItem) {
                sources.push({
                    type: 'card',
                    id: cardId,
                    name: card.name,
                    cardType: card.cardType
                });
            }
        }

        // 2. Scan Enemies
        for (const [enemyId, enemy] of Object.entries(allEnemies)) {
            if (enemy.drops && enemy.drops.some(d => d.itemId === itemId)) {
                sources.push({
                    type: 'enemy',
                    id: enemyId,
                    name: enemy.name
                });
            }
        }

        return sources;
    },

    /**
     * Find all tasks that require a specific item as input
     * @param {string} itemId 
     * @returns {Array} [{ id, name, cardType }]
     */
    getUsagesForItem(itemId) {
        const usages = [];
        const allCards = getAllCards();

        for (const [cardId, card] of Object.entries(allCards)) {
            if (card.inputs && Array.isArray(card.inputs)) {
                if (card.inputs.some(i => (typeof i === 'string' ? i === itemId : i.itemId === itemId))) {
                    usages.push({
                        type: 'card',
                        id: cardId,
                        name: card.name,
                        cardType: card.cardType
                    });
                }
            }
        }

        return usages;
    },

    /**
     * Get loot table for an enemy, masking undiscovered items
     * @param {string} enemyId 
     * @returns {Array} [{ itemId, name, chance, discovered }]
     */
    getMaskedLootForEnemy(enemyId) {
        const allEnemies = getAllEnemies();
        const enemy = allEnemies[enemyId];
        if (!enemy || !enemy.drops) return [];

        const discoveredItems = GameState.state?.collection?.discoveredItems || {};

        return enemy.drops.map(drop => {
            const isDiscovered = discoveredItems[drop.itemId];
            return {
                ...drop,
                discovered: !!isDiscovered
            };
        });
    }
};
