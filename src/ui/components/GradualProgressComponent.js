// Fantasy Guild - Gradual Progress Component
// Shared component for rendering resource contribution lists
// Used in Explore Cards (Biome discovery) and Area Cards (Project construction)

import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';

/**
 * Render a list of gradual progress bars for resource requirements
 * @param {Object} options
 * @param {Object} options.progressData - Object containing { inputProgress, requirements, percentComplete }
 * @param {Object} options.cardInstance - The card instance (for context if needed)
 * @param {boolean} options.showTitle - Whether to show the main "Progress: X%" title (default true)
 * @returns {string} HTML string
 */
export function renderGradualProgress(options) {
    const {
        progressData,
        cardInstance, // Kept for API compatibility, though mainly logic uses progressData
        showTitle = true
    } = options;

    if (!progressData) return '';

    const { inputProgress, requirements, percentComplete } = progressData;

    // Use inputProgress if available, otherwise fall back to requirements (initial state)
    // If we only have requirements, we construct a "zero progress" view
    const itemsToRender = inputProgress || {};
    // If inputProgress is empty but we have requirements, map requirements to 0-progress state
    const entrySource = (Object.keys(itemsToRender).length > 0) ? itemsToRender : mapRequirementsToZero(requirements);

    if (Object.keys(entrySource).length === 0) {
        return '';
    }

    const progressBars = Object.entries(entrySource).map(([key, data]) => {
        // Handle data structure differences:
        // inputProgress has { current, required } objects
        // requirements is just { itemId: requiredAmount }
        const required = data.required !== undefined ? data.required : data;
        const current = data.current || 0;

        return renderSingleProgressBar(key, current, required);
    }).join('');

    const titleHtml = showTitle
        ? `<div class="card__gradual-progress-title">Progress: ${percentComplete || 0}%</div>`
        : '';

    return `
        <div class="card__gradual-progress-section">
            ${titleHtml}
            ${progressBars}
        </div>
    `;
}

/**
 * Helper to map simple requirement object to progress object structure
 */
function mapRequirementsToZero(requirements) {
    if (!requirements) return {};
    const result = {};
    for (const [key, req] of Object.entries(requirements)) {
        result[key] = { current: 0, required: req };
    }
    return result;
}

/**
 * Render a single resource progress bar row
 */
function renderSingleProgressBar(key, current, required) {
    let itemName, itemIcon;

    // Resolve Name and Icon
    if (key.startsWith('tag:')) {
        const tag = key.substring(4);
        itemName = `Any ${tag.charAt(0).toUpperCase() + tag.slice(1)}`;
        // Simple tag icon mapping (could reuse InputSlotComponent.getTagIcon logic if exported)
        // For now, simple defaults to avoid circular dependency or deep imports 
        // (though we could import getTagIcon from InputSlotComponent if we want)
        const tagIcons = {
            'ore': '⛏️', 'fuel': '🔥', 'wood': '🪵', 'stone': '🪨',
            'metal': '⚙️', 'key': '🗝️'
        };
        itemIcon = tagIcons[tag] || '📦';
    } else {
        const item = getItem(key);
        itemName = item?.name || key;
        itemIcon = item?.icon || '📦';
    }

    // Calculate Percent
    const percent = required > 0
        ? Math.floor((current / required) * 100)
        : 100;

    const isComplete = current >= required;

    // Calculate Inventory Count
    let inventoryCount = 0;
    if (key.startsWith('tag:')) {
        const tag = key.substring(4);
        const allItems = InventoryManager.getAllItems();
        for (const [invId, val] of Object.entries(allItems)) {
            const t = getItem(invId);
            const qty = typeof val === 'object' ? val.qty : val;
            if (t?.tags?.includes(tag)) inventoryCount += qty;
        }
    } else {
        inventoryCount = InventoryManager.getItemCount(key);
    }

    return `
        <div class="card__gradual-progress-item ${isComplete ? 'card__gradual-progress-item--complete' : ''}">
            <div class="card__gradual-progress-header">
                <span class="card__gradual-progress-name">${itemIcon} ${itemName}</span>
                <span class="card__gradual-progress-count">${current}/${required}</span>
            </div>
            <div class="card__gradual-progress-bar-container">
                <div class="card__gradual-progress-bar" style="width: ${percent}%"></div>
            </div>
            <div class="card__gradual-progress-inventory">
                In inventory: ${inventoryCount}
            </div>
        </div>
    `;
}
