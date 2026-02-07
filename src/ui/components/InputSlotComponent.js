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
 * Renders a single input slot for a modular card trait
 * @param {Object} trait - The trait definition
 * @param {Object} card - The card instance
 * @returns {string} HTML string
 */
export function renderInputSlot(trait, card) {
    // Locked slots show item info but are not interactive (for Projects/Collection quests)
    if (trait.locked) {
        if (trait.itemId) {
            const itemDef = getItem(trait.itemId);
            const itemName = itemDef?.name || trait.itemId;
            const inventoryCount = InventoryManager.getItemCount(trait.itemId);
            const hasItem = inventoryCount > 0;
            const statusClass = hasItem ? 'card__input-slot--available' : 'card__input-slot--missing';
            const iconHtml = renderSlotIcon(itemDef || trait.itemId);

            return `
                <div class="card__input-slot-container">
                    <div class="card__input-slot card__input-slot--locked ${statusClass}" title="${itemName} (Have ${inventoryCount})">
                        ${iconHtml}
                        <span class="card__input-count">${inventoryCount}</span>
                    </div>
                </div>
            `;
        } else if (trait.acceptTag) {
            // Locked tag slot - show tag icon
            const tagData = getTagIconData(trait.acceptTag);
            const label = trait.slotLabel || `Any ${trait.acceptTag}`;
            const iconHtml = renderSlotIcon(tagData.id || tagData.icon, true);

            return `
                <div class="card__input-slot-container">
                    <div class="card__input-slot card__input-slot--locked" title="${label}">
                        ${iconHtml}
                    </div>
                </div>
            `;
        }
        return '';
    }

    if (trait.itemId) {
        return renderFixedSlot(trait, trait.slotIndex || 0);
    } else if (trait.acceptTag) {
        return renderOpenSlot(trait, trait.slotIndex || 0, card);
    }
    return '';
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

        // NEW: Support exact item ID matching via data-accept-item-id
        const acceptItemIdAttr = input.acceptItemId ? `data-accept-item-id="${input.acceptItemId}"` : '';

        return `
            <div class="card__input-slot-container">
                <div class="card__input-slot card__input-slot--open card__input-slot--empty" data-drop-zone="input-slot" data-slot-index="${slotIndex}" data-slot-type="open" data-accept-tag="${input.acceptTag}" ${acceptItemIdAttr} title="${label}">
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
        // Include onerror fallback to emoji when sprite doesn't exist
        // Render at 64x64 for input slots
        return `
            <img src="${spritePath}" 
                 class="card__input-sprite ${ghostClass}" 
                 style="width: 64px; height: 64px; image-rendering: pixelated;"
                 alt="icon"
                 onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline';">
            <span class="card__input-icon ${ghostClass}" style="display:none; font-size: 2rem;">${icon}</span>
        `;
    } else if (spritePath && spritePath.isDiscovery) {
        // Discovery mode - just use emoji for simplicity in slots
        return `<span class="card__input-icon ${ghostClass}" style="font-size: 2rem;">${icon}</span>`;
    }

    return `<span class="card__input-icon ${ghostClass}" style="font-size: 2rem;">${icon}</span>`;
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
