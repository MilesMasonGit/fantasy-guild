// Fantasy Guild - Inventory Group Component
// Phase 18: Inventory UI

import { renderInventoryItem } from './InventoryItemComponent.js';

/**
 * Render a group of inventory items (collapsible)
 * @param {Object} group - { title, items, isCustom, id }
 * @returns {string} HTML string
 */
export function renderInventoryGroup(group) {
    if ((!group.items || group.items.length === 0) && !group.isCustom) return '';

    const groupId = group.id;

    // We can assume groups are expanded by default for now
    // In a future polished version, we might track collapsed state in ViewManager or Component state

    let customActions = '';
    if (group.isCustom) {
        customActions = `
            <div class="inventory-group__custom-actions" style="margin-left: auto; margin-right: 12px; display: flex; gap: 8px;">
                <button class="btn btn--subtle btn--icon" data-action="rename-group" data-group-id="${groupId}" title="Rename Group">✎</button>
                <button class="btn btn--danger btn--icon" data-action="delete-group" data-group-id="${groupId}" title="Delete Group">❌</button>
            </div>
        `;
    }

    return `
        <div class="inventory-group mb-4 rounded-lg border border-white/5 bg-black/20 overflow-hidden" id="${groupId}" data-drop-zone="inventory-group" data-group-id="${groupId}">
            <div class="inventory-group__header flex items-center p-2 px-3 bg-white/5 border-b border-white/5 cursor-pointer hover:bg-white/10 transition-colors" onclick="if(!event.target.closest('button')) this.parentElement.classList.toggle('inventory-group--collapsed')">
                <span class="inventory-group__title text-xs font-bold text-gray-300 uppercase tracking-widest">${group.title}</span>
                <span class="inventory-group__count text-[10px] text-gray-500 font-mono ml-2">(${group.items.length})</span>
                ${customActions}
                <span class="inventory-group__toggle text-[10px] text-gray-500 transition-transform group-[.inventory-group--collapsed]:-rotate-90" style="${group.isCustom ? '' : 'margin-left: auto;'}">▼</span>
            </div>
            <div class="inventory-group__content p-2 flex flex-col gap-1 transition-all">
                ${group.items.map(item => renderInventoryItem(item)).join('')}
            </div>
        </div>
    `;
}
