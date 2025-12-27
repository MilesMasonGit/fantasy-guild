import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { DurabilitySystem } from '../../systems/equipment/DurabilitySystem.js';
import { resolveSpritePath } from '../../utils/AssetManager.js';

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
 */
export function renderFixedSlot(input, slotIndex) {
    const itemDef = getItem(input.itemId);
    const itemName = itemDef?.name || input.itemId;

    // Get actual inventory count
    const inventoryCount = InventoryManager.getItemCount(input.itemId);
    const hasItem = inventoryCount >= input.quantity;
    const statusClass = hasItem ? 'card__input-slot--available' : 'card__input-slot--missing';

    const quantityBadge = input.quantity > 1 ? `<span class="card__input-quantity">×${input.quantity}</span>` : '';

    const iconHtml = renderSlotIcon(itemDef || input.itemId);

    return `
        <div class="card__input-slot-container">
            <div class="card__input-slot ${statusClass}" data-item-id="${input.itemId}" data-slot-index="${slotIndex}" data-slot-type="fixed" title="${itemName} (Have ${inventoryCount}, Need ${input.quantity})">
                ${iconHtml}
                <span class="card__input-count">${inventoryCount}</span>
            </div>
            ${quantityBadge}
        </div>
    `;
}

/**
 * Renders an open input slot (accepts any item with matching tag)
 */
export function renderOpenSlot(input, slotIndex, cardInstance) {
    const assignedItemId = cardInstance.assignedItems?.[slotIndex];

    if (assignedItemId) {
        const itemDef = getItem(assignedItemId);
        const itemName = itemDef?.name || assignedItemId;

        // Get actual inventory count
        const inventoryCount = InventoryManager.getItemCount(assignedItemId);
        const hasItem = inventoryCount >= input.quantity;
        const statusClass = hasItem ? 'card__input-slot--filled' : 'card__input-slot--filled-missing';

        const quantityBadge = input.quantity > 1 ? `<span class="card__input-quantity">×${input.quantity}</span>` : '';

        // Durability Badge Logic
        let durabilityHtml = '';
        if (itemDef?.maxDurability) {
            const percent = DurabilitySystem.getDurabilityPercent(cardInstance, slotIndex);
            durabilityHtml = `<span class="card__durability-badge">${Math.floor(percent)}%</span>`;
        }

        const iconHtml = renderSlotIcon(itemDef || assignedItemId);

        return `
            <div class="card__input-slot-container">
                <div class="card__input-slot card__input-slot--open ${statusClass}" data-slot-index="${slotIndex}" data-slot-type="open" data-assigned-item="${assignedItemId}" title="${itemName} (Durability: ${Math.floor(DurabilitySystem.getDurabilityPercent(cardInstance, slotIndex))}%) - Right-click to remove">
                    ${iconHtml}
                    <span class="card__input-count">${inventoryCount}</span>
                    ${durabilityHtml}
                </div>
                ${quantityBadge}
            </div>
        `;
    } else {
        // Empty open slot
        const tagData = getTagIconData(input.acceptTag);
        const label = input.slotLabel || `Any ${input.acceptTag}`;
        const quantityBadge = input.quantity > 1 ? `<span class="card__input-quantity">×${input.quantity}</span>` : '';

        const iconHtml = renderSlotIcon(tagData.id || tagData.icon, true);

        return `
            <div class="card__input-slot-container">
                <div class="card__input-slot card__input-slot--open card__input-slot--empty" data-drop-zone="input-slot" data-slot-index="${slotIndex}" data-slot-type="open" data-accept-tag="${input.acceptTag}" title="${label}">
                    ${iconHtml}
                </div>
                ${quantityBadge}
            </div>
        `;
    }
}

/**
 * Helper to render slot icons using AssetManager (with ghost support)
 */
function renderSlotIcon(entityOrId, isGhost = false) {
    const spritePath = resolveSpritePath(entityOrId);
    const itemDef = typeof entityOrId === 'object' ? entityOrId : getItem(entityOrId);
    const icon = itemDef?.icon || (typeof entityOrId === 'string' && entityOrId.length <= 2 ? entityOrId : '📦');
    const ghostClass = isGhost ? 'card__input-sprite--ghost card__input-icon--empty' : '';

    if (spritePath && typeof spritePath === 'string') {
        return `<img src="${spritePath}" class="card__input-sprite ${ghostClass}" alt="icon">`;
    } else if (spritePath && spritePath.isDiscovery) {
        // We can't use complex multi-img here easily without bloating the slot, 
        // but luckily renderFixedSlot/renderOpenSlot are small.
        // Actually, let's just use the smart path guesser in resolveSpritePath 
        // which now returns a string for known types.
        return `<span class="card__input-icon ${ghostClass}">${icon}</span>`;
    }

    return `<span class="card__input-icon ${ghostClass}">${icon}</span>`;
}

/**
 * Get representative data for an item tag (sprite or emoji)
 */
export function getTagIconData(tag) {
    const tagData = {
        'ore': { id: 'ore_copper', icon: '⛏️' },
        'fuel': { id: 'ore_coal', icon: '🔥' },
        'wood': { id: 'wood_oak', icon: '🪵' },
        'stone': { icon: '🪨' },
        'metal': { id: 'ingot_copper', icon: '⚙️' },
        'tool': { icon: '🔨' },
        'weapon': { icon: '⚔️' },
        'armor': { icon: '🛡️' },
        'consumable': { icon: '🧪' },
        'material': { icon: '📦' },
        'gem': { icon: '💎' },
        'key': { id: 'key_copper', icon: '🗝️' },
        'water': { id: 'drink_water', icon: '💧' },
        'drink': { id: 'drink_water', icon: '💧' },
    };
    return tagData[tag] || { icon: '📦' };
}
