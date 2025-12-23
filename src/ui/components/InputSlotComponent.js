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

    const spritePath = resolveSpritePath(itemDef);
    const iconHtml = spritePath
        ? `<img src="${spritePath}" class="card__input-sprite" alt="${itemName}">`
        : `<span class="card__input-icon">${itemIcon}</span>`;

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
            durabilityHtml = `<span class="card__durability-badge">${Math.floor(percent)}%</span>`;
        }

        const spritePath = resolveSpritePath(itemDef);
        const iconHtml = spritePath
            ? `<img src="${spritePath}" class="card__input-sprite" alt="${itemName}">`
            : `<span class="card__input-icon">${itemIcon}</span>`;

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
        // Empty open slot - show drop zone with tag-specific icon
        const tagData = getTagIconData(input.acceptTag);
        const label = input.slotLabel || `Any ${input.acceptTag}`;
        const quantityBadge = input.quantity > 1 ? `<span class="card__input-quantity">×${input.quantity}</span>` : '';

        const iconHtml = tagData.sprite
            ? `<img src="${tagData.sprite}" class="card__input-sprite card__input-sprite--ghost" alt="${input.acceptTag}">`
            : `<span class="card__input-icon card__input-icon--empty">${tagData.icon}</span>`;

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
 * Get representative data for an item tag (sprite or emoji)
 * @param {string} tag - Item tag (e.g., 'ore', 'fuel', 'wood')
 * @returns {Object} { sprite, icon }
 */
export function getTagIconData(tag) {
    const tagData = {
        'ore': { sprite: 'assets/sprites/implemented/items/copper_ore.png', icon: '⛏️' },
        'fuel': { sprite: 'assets/sprites/implemented/items/coal.png', icon: '🔥' },
        'wood': { sprite: 'assets/sprites/implemented/items/wood.png', icon: '🪵' },
        'stone': { icon: '🪨' },
        'metal': { sprite: 'assets/sprites/implemented/items/copper_ingot.png', icon: '⚙️' },
        'tool': { icon: '🔨' },
        'weapon': { icon: '⚔️' },
        'armor': { icon: '🛡️' },
        'consumable': { icon: '🧪' },
        'material': { icon: '📦' },
        'gem': { icon: '💎' },
        'key': { icon: '🗝️' },
        'water': { sprite: 'assets/sprites/implemented/items/water.png', icon: '💧' },
        'drink': { sprite: 'assets/sprites/implemented/items/water.png', icon: '💧' },
    };
    return tagData[tag] || { icon: '📦' };
}
