import { getCard } from '../../config/registries/cardRegistry.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { getDropTable } from '../../config/registries/dropTableRegistry.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { getRecipesBySubskill } from '../../config/registries/recipeRegistry.js';

/**
 * Helper to determine if an ID refers to a registered drop table.
 */
function isLootTable(id) {
    if (!id) return false;
    return getDropTable(id) !== null;
}

/**
 * Helper to determine if an ID refers to a registered enemy.
 */
function isEnemy(id) {
    if (!id) return false;
    return getEnemy(id) !== null;
}

/**
 * Resolves all potential outputs (enemies, items, loot tables) for a card or template.
 * Dedupes results and tags each output with its type: 'enemy', 'item', or 'loot_table'.
 * 
 * @param {Object} card - The runtime card instance.
 * @param {Object} template - The static card template.
 * @returns {Array<{type: string, id: string}>} Array of potential outputs.
 */
export function resolvePotentialOutputs(card, template) {
    const outputs = [];

    // Resolve template if not provided but card has templateId
    let resolvedTemplate = template;
    if (!resolvedTemplate && card && card.templateId) {
        resolvedTemplate = getCard(card.templateId);
    }

    const resolvedCard = card || {};
    const finalTemplate = resolvedTemplate || {};
    const cardType = resolvedCard.cardType || finalTemplate.cardType;

    // Helper to add unique output with registry-based type resolution
    const addOutput = (type, id) => {
        if (!id) return;
        
        let finalType = type;
        if (isLootTable(id)) {
            finalType = 'loot_table';
        } else if (isEnemy(id)) {
            finalType = 'enemy';
        } else {
            // Default or force item if it's not enemy or loot table
            if (type !== 'enemy' && type !== 'loot_table') {
                finalType = 'item';
            }
        }
        
        // Prevent duplicates
        const exists = outputs.some(o => o.type === finalType && o.id === id);
        if (!exists) {
            outputs.push({ type: finalType, id });
        }
    };

    // Helper to process a drops array
    const processDropsArray = (drops) => {
        if (!drops || !Array.isArray(drops)) return;
        for (const drop of drops) {
            const id = drop.enemyId || drop.itemId || drop.id || drop.dropTableId || drop.lootTableId;
            if (!id) continue;

            if (drop.type === 'combat_trigger' || isEnemy(id)) {
                addOutput('enemy', id);
            } else if (drop.type === 'loot_table' || drop.dropTableId || isLootTable(id)) {
                addOutput('loot_table', id);
            } else {
                addOutput('item', id);
            }
        }
    };

    // 1. COMBAT / INVASION CARDS
    if (cardType === 'combat' || cardType === 'invasion') {
        const enemyIds = new Set();

        // If it's an invasion, check the spawn pool in the area set
        const areaSetId = resolvedCard.areaSet || finalTemplate.areaSet;
        if (cardType === 'invasion' && areaSetId) {
            const areaSet = getAreaSet(areaSetId);
            if (areaSet && areaSet.invasionSpawnPool && Array.isArray(areaSet.invasionSpawnPool)) {
                areaSet.invasionSpawnPool.forEach(id => enemyIds.add(id));
            }
        }

        // Add the primary enemy ID if present
        const primaryEnemyId = resolvedCard.enemyId || finalTemplate.enemyId || 
                               resolvedCard.config?.enemyId || finalTemplate.config?.enemyId;
        if (primaryEnemyId) {
            enemyIds.add(primaryEnemyId);
        }

        // Process all enemies and their drops
        for (const enemyId of enemyIds) {
            addOutput('enemy', enemyId);
            const enemy = getEnemy(enemyId);
            if (enemy) {
                // If the enemy has a dropTableId, add it as a loot table
                if (enemy.dropTableId) {
                    addOutput('loot_table', enemy.dropTableId);
                }
                // Process any inline drops
                if (enemy.drops) {
                    processDropsArray(enemy.drops);
                }
            }
        }
    }
    // 2. STATION CARDS (Recipe Selector)
    else if (cardType === 'station') {
        const recipeGroup = resolvedCard.config?.recipeGroup || finalTemplate.config?.recipeGroup;
        if (recipeGroup) {
            const recipes = getRecipesBySubskill(recipeGroup);
            for (const recipe of recipes) {
                if (recipe.outputs && Array.isArray(recipe.outputs)) {
                    for (const output of recipe.outputs) {
                        const outputId = output.itemId || output.id;
                        if (isLootTable(outputId)) {
                            addOutput('loot_table', outputId);
                        } else if (isEnemy(outputId)) {
                            addOutput('enemy', outputId);
                        } else {
                            addOutput('item', outputId);
                        }
                    }
                }
            }
        }
    }
    // 3. TASK / GATHERING CARDS
    else {
        // Look in direct drops
        if (resolvedCard.drops) processDropsArray(resolvedCard.drops);
        if (finalTemplate.drops) processDropsArray(finalTemplate.drops);

        // Look in config outputs
        const outputsConfig = resolvedCard.config?.outputs || finalTemplate.config?.outputs;
        if (outputsConfig) processDropsArray(outputsConfig);

        // Look in traits (like loot trait)
        const traits = resolvedCard.traits || finalTemplate.traits || [];
        for (const trait of traits) {
            if (trait.type === 'loot' && trait.items) {
                processDropsArray(trait.items);
            }
        }
    }

    return outputs;
}
