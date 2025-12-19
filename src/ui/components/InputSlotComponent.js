// Fantasy Guild - Input Slot Component
// Shared component for rendering item input slots across all card types

import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { DurabilitySystem } from '../../systems/equipment/DurabilitySystem.js';

/**
 * Main entry point - renders all input slots for a card
 * @param {Array} inputs - Inputs array from template [{itemId, quantity} or {acceptTag, quantity, slotLabel}]
 * @param {Object} cardInstance - The card instance (for tracking filled slots)
 * @returns {string} HTML string
 */
export function renderInputSlots(inputs, cardInstance) {
    if (!inputs || inputs.length === 0) return '';

    const inputSlots = inputs.map((input, index) => {
        if (input.itemId) {
            // Fixed slot - specific item required
            return renderFixedSlot(input, index);
        } else if (input.acceptTag) {
            // Open slot - any item with matching tag
            return renderOpenSlot(input, index, cardInstance);
        }
        return '';
    });

    // Return slots without wrapper - they'll be siblings in card__slots-row
    return inputSlots.join('');
}

/**
 * Renders a fixed input slot (requires specific item)
 * @param {Object} input - Input definition {itemId, quantity}
 * @param {number} slotIndex - Index in the inputs array
 * @returns {string} HTML string
 */
export function renderFixedSlot(input, slotIndex) {
    const itemDef = getItem(input.itemId);
    const itemName = itemDef?.name || input.itemId;
    const itemIcon = itemDef?.icon || '📦';

    // Get actual inventory count
    const inventoryCount = InventoryManager.getItemCount(input.itemId);
    const hasItem = inventoryCount >= input.quantity;
    const statusClass = hasItem ? 'card__input-slot--available' : 'card__input-slot--missing';

    const quantityBadge = input.quantity > 1 ? `<span class="card__input-quantity">×${input.quantity}</span>` : '';

    return `
        <div class="card__input-slot-container">
            <div class="card__input-slot ${statusClass}" data-item-id="${input.itemId}" data-slot-index="${slotIndex}" data-slot-type="fixed" title="${itemName} (Have ${inventoryCount}, Need ${input.quantity})">
                <span class="card__input-icon">${itemIcon}</span>
                <span class="card__input-count">${inventoryCount}</span>
            </div>
            ${quantityBadge}
        </div>
    `;
}

/**
 * Renders an open input slot (accepts any item with matching tag)
 * @param {Object} input - Input definition {acceptTag, quantity, slotLabel}
 * @param {number} slotIndex - Index in the inputs array
 * @param {Object} cardInstance - Card instance with assignedItems
 * @returns {string} HTML string
 */
export function renderOpenSlot(input, slotIndex, cardInstance) {
    const assignedItemId = cardInstance.assignedItems?.[slotIndex];

    if (assignedItemId) {
        const itemDef = getItem(assignedItemId);
        const itemName = itemDef?.name || assignedItemId;
        const itemIcon = itemDef?.icon || '📦';

        // Get actual inventory count
        const inventoryCount = InventoryManager.getItemCount(assignedItemId);
        const hasItem = inventoryCount >= input.quantity;
        const statusClass = hasItem ? 'card__input-slot--filled' : 'card__input-slot--filled-missing';

        const quantityBadge = input.quantity > 1 ? `<span class="card__input-quantity">×${input.quantity}</span>` : '';

        // Durability Badge Logic (no bar, just percentage badge)
        let durabilityHtml = '';
        if (itemDef?.maxDurability) {
            const percent = DurabilitySystem.getDurabilityPercent(cardInstance, slotIndex);
            // Use same style as inventory count badge (bottom-left instead of bottom-right)
            durabilityHtml = `<span class="card__durability-badge">${Math.floor(percent)}%</span>`;
        }

        return `
            <div class="card__input-slot-container">
                <div class="card__input-slot card__input-slot--open ${statusClass}" data-slot-index="${slotIndex}" data-slot-type="open" data-assigned-item="${assignedItemId}" title="${itemName} (Durability: ${Math.floor(DurabilitySystem.getDurabilityPercent(cardInstance, slotIndex))}%) - Right-click to remove">
                    <span class="card__input-icon">${itemIcon}</span>
                    <span class="card__input-count">${inventoryCount}</span>
                    ${durabilityHtml}
                </div>
                ${quantityBadge}
            </div>
        `;
    } else {
        // Empty open slot - show drop zone with tag-specific icon
        const tagIcon = getTagIcon(input.acceptTag);
        const label = input.slotLabel || `Any ${input.acceptTag}`;
        const quantityBadge = input.quantity > 1 ? `<span class="card__input-quantity">×${input.quantity}</span>` : '';
        return `
            <div class="card__input-slot-container">
                <div class="card__input-slot card__input-slot--open card__input-slot--empty" data-drop-zone="input-slot" data-slot-index="${slotIndex}" data-slot-type="open" data-accept-tag="${input.acceptTag}" title="${label}">
                    <span class="card__input-icon card__input-icon--empty">${tagIcon}</span>
                </div>
                ${quantityBadge}
            </div>
        `;
    }
}

/**
 * Get representative icon for an item tag
 * @param {string} tag - Item tag (e.g., 'ore', 'fuel', 'wood')
 * @returns {string} Icon emoji
 */
export function getTagIcon(tag) {
    const tagIcons = {
        'ore': '⛏️',
        'fuel': '🔥',
        'wood': '🪵',
        'stone': '🪨',
        'metal': '⚙️',
        'tool': '🔨',
        'weapon': '⚔️',
        'armor': '🛡️',
        'consumable': '🧪',
        'material': '📦',
        'gem': '💎',
        'key': '🗝️',
    };
    return tagIcons[tag] || '📦';
}
