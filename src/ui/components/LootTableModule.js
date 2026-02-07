// Fantasy Guild - LootTable Module Component
// Reusable module for displaying drops/outputs across card types

import { getItem } from '../../config/registries/itemRegistry.js';
import { renderIcon } from '../../utils/AssetManager.js';

/**
 * Renders a LootTable module showing potential drops or outputs
 * Works for both combat cards (enemy drops) and task cards (item outputs)
 * 
 * @param {Object} options
 * @param {Array} options.items - Array of items to display
 * @param {string} options.title - Module title (e.g., "Possible Loot", "Outputs")
 * @param {string} options.mode - Display mode: 'loot' (ranges), 'output' (fixed quantities)
 * @returns {string} HTML string
 */
export function renderLootTableModule(options) {
    const { items = [], title = 'Drops', mode = 'loot' } = options;

    if (!items || items.length === 0) {
        return '';
    }

    const itemsHtml = items.map(item => renderLootItem(item, mode)).join('');

    return `
        <div class="card-module card-module--loot">
            <div class="card-module__header">
                <span class="card-module__title">${title}</span>
            </div>
            <div class="loot-table">
                ${itemsHtml}
            </div>
        </div>
    `;
}

/**
 * Renders a single loot item
 * @param {Object} item - Item data (itemId, quantity, min, max, chance)
 * @param {string} mode - Display mode
 * @returns {string} HTML string
 */
function renderLootItem(item, mode) {
    // Get item definition
    const itemDef = item.itemId ? getItem(item.itemId) : null;
    const name = item.name || itemDef?.name || item.itemId || 'Unknown';
    const icon = item.icon || itemDef?.icon || '📦';

    // Build quantity text
    let qtyText = '';
    if (mode === 'loot' && item.min !== undefined && item.max !== undefined) {
        // Loot ranges: "1-3" or "1"
        qtyText = item.min === item.max ? `${item.min}` : `${item.min}-${item.max}`;
    } else if (item.minQty !== undefined && item.maxQty !== undefined) {
        // Alternative format from enemy drops
        qtyText = item.minQty === item.maxQty ? `${item.minQty}` : `${item.minQty}-${item.maxQty}`;
    } else if (item.quantity !== undefined) {
        // Fixed quantity for task outputs
        qtyText = `${item.quantity}`;
    } else {
        qtyText = '1';
    }

    // Chance display - always show percentage
    const chance = item.chance !== undefined ? item.chance : 100;
    const chanceClass = chance < 10 ? 'loot-item__chance--rare' : '';

    // Icon rendering (32px size)
    const iconHtml = renderIcon(item.itemId ? itemDef : item, 'loot-item__icon', { size: 32 });

    return `
        <div class="loot-item" title="${name}">
            ${iconHtml}
            <span class="loot-item__name">${name}</span>
            <span class="loot-item__qty">×${qtyText}</span>
            <span class="loot-item__chance ${chanceClass}">${chance}%</span>
        </div>
    `;
}

/**
 * Helper to convert enemy drops array to loot table items
 * @param {Array} drops - Enemy drops array [{itemId, minQty, maxQty, chance}]
 * @returns {Array} Formatted items array
 */
export function formatEnemyDrops(drops) {
    if (!drops || !Array.isArray(drops)) return [];

    return drops.map(drop => ({
        itemId: drop.itemId,
        min: drop.minQty || drop.min || 1,
        max: drop.maxQty || drop.max || 1,
        chance: drop.chance || 100
    }));
}

/**
 * Helper to convert task outputs array to loot table items
 * @param {Array} outputs - Task outputs array [{itemId, quantity, chance}]
 * @returns {Array} Formatted items array
 */
export function formatTaskOutputs(outputs) {
    if (!outputs || !Array.isArray(outputs)) return [];

    return outputs.map(output => ({
        itemId: output.itemId,
        quantity: output.quantity || 1,
        chance: output.chance || 100
    }));
}
