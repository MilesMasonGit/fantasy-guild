// Fantasy Guild - Inventory Group Component
// Phase 18: Inventory UI

import { renderInventoryItem } from './InventoryItemComponent.js';

/**
 * Render a group of inventory items (collapsible)
 * @param {Object} group - { title, items }
 * @returns {string} HTML string
 */
export function renderInventoryGroup(group) {
    if (!group.items || group.items.length === 0) return '';

    const groupId = `group-${group.title.toLowerCase()}`;

    // We can assume groups are expanded by default for now
    // In a future polished version, we might track collapsed state in ViewManager or Component state

    return `
        <div class="inventory-group" id="${groupId}">
            <div class="inventory-group__header" onclick="this.parentElement.classList.toggle('inventory-group--collapsed')">
                <span class="inventory-group__title">${group.title}</span>
                <span class="inventory-group__count">(${group.items.length})</span>
                <span class="inventory-group__toggle">▼</span>
            </div>
            <div class="inventory-group__content">
                ${group.items.map(item => renderInventoryItem(item)).join('')}
            </div>
        </div>
    `;
}
