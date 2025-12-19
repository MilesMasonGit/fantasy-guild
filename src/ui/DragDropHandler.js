// Fantasy Guild - Drag and Drop Handler
// Phase 14: Drag & Drop

import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as CardManager from '../systems/cards/CardManager.js';
import { logger } from '../utils/Logger.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { getItem } from '../config/registries/itemRegistry.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';

/**
 * DragDropHandler - Manages drag and drop interactions
 * 
 * Handles:
 * - Hero card dragging
 * - Card drop zones
 * - Visual feedback during drag
 * - Assignment logic on drop
 */

// Current drag state
let dragState = {
    isDragging: false,
    dragType: null,       // 'hero', 'item', etc.
    dragData: null,       // Data about dragged element
    sourceElement: null,  // Original DOM element
    ghostElement: null    // Drag preview element
};

// ========================================
// Initialization
// ========================================

/**
 * Initialize drag and drop handlers
 * Called after DOM is ready
 */
export function init() {
    // Set up global drag event listeners
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    logger.info('DragDropHandler', 'Initialized');
}

// ========================================
// Drag Start
// ========================================

/**
 * Handle drag start event
 * @param {DragEvent} e 
 */
function handleDragStart(e) {
    const heroCard = e.target.closest('[data-draggable="hero"]');
    if (heroCard) {
        startHeroDrag(e, heroCard);
        return;
    }

    // Check for item drag (from inventory)
    const itemElement = e.target.closest('[data-draggable="item"]');
    if (itemElement) {
        startItemDrag(e, itemElement);
        return;
    }
}

/**
 * Start dragging a hero card
 * @param {DragEvent} e 
 * @param {HTMLElement} heroCard 
 */
function startHeroDrag(e, heroCard) {
    const heroId = heroCard.dataset.heroId;
    if (!heroId) return;

    const hero = HeroManager.getHero(heroId);
    if (!hero) return;

    // Check if hero can be dragged (not wounded, not already assigned)
    if (hero.status === 'wounded') {
        NotificationSystem.warning('This hero is wounded and cannot work.');
        e.preventDefault();
        return;
    }

    // Update drag state
    dragState = {
        isDragging: true,
        dragType: 'hero',
        dragData: { heroId, heroName: hero.name },
        sourceElement: heroCard,
        ghostElement: null
    };

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(dragState.dragData));

    // Add dragging class
    heroCard.classList.add('dragging');

    // Highlight valid drop zones
    highlightDropZones(true);

    EventBus.publish('drag_started', { type: 'hero', heroId });
    logger.debug('DragDropHandler', `Started dragging hero ${hero.name} `);
}

/**
 * Start dragging an item from inventory
 * @param {DragEvent} e 
 * @param {HTMLElement} itemElement 
 */
function startItemDrag(e, itemElement) {
    const itemId = itemElement.dataset.itemId;
    if (!itemId) return;

    const itemDef = getItem(itemId);
    if (!itemDef) return;

    // Check if player has this item
    if (!InventoryManager.hasItem(itemId, 1)) {
        NotificationSystem.warning('You don\'t have any of this item.');
        e.preventDefault();
        return;
    }

    // Update drag state
    dragState = {
        isDragging: true,
        dragType: 'item',
        dragData: { itemId, itemName: itemDef.name, tags: itemDef.tags || [] },
        sourceElement: itemElement,
        ghostElement: null
    };

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(dragState.dragData));

    // Add dragging class
    itemElement.classList.add('dragging');

    // Highlight valid drop zones (open input slots, equipment slots, and hero cards)
    highlightInputSlots(true);
    highlightEquipmentSlots(true, itemDef);
    highlightHeroCards(true, itemDef);

    EventBus.publish('drag_started', { type: 'item', itemId });
    logger.debug('DragDropHandler', `Started dragging item ${itemDef.name} `);
}

// ========================================
// Drag Over / Leave
// ========================================

/**
 * Handle drag over event (for drop zones)
 * @param {DragEvent} e 
 */
function handleDragOver(e) {
    if (!dragState.isDragging) return;

    // Refresh drop zone highlights to detect newly created cards (e.g., Area cards from exploration)
    // This ensures cards created after drag started are still highlighted
    if (dragState.dragType === 'hero') {
        highlightDropZones(true);
    } else if (dragState.dragType === 'item') {
        const itemDef = dragState.dragData?.itemId ? getItem(dragState.dragData.itemId) : null;
        highlightInputSlots(true);
        highlightEquipmentSlots(true, itemDef);
        highlightHeroCards(true, itemDef);
    }

    const dropZone = e.target.closest('[data-drop-zone]');
    if (!dropZone) return;

    // Check if this is a valid drop
    const isValid = isValidDrop(dropZone);

    if (isValid) {
        e.preventDefault(); // Allow drop
        dropZone.classList.add('drop-zone--valid');
        dropZone.classList.remove('drop-zone--invalid');
    } else {
        dropZone.classList.add('drop-zone--invalid');
        dropZone.classList.remove('drop-zone--valid');
    }
}

/**
 * Handle drag leave event
 * @param {DragEvent} e 
 */
function handleDragLeave(e) {
    const dropZone = e.target.closest('[data-drop-zone]');
    if (dropZone) {
        dropZone.classList.remove('drop-zone--valid', 'drop-zone--invalid');
    }
}

/**
 * Check if a drop zone is valid for current drag
 * @param {HTMLElement} dropZone 
 * @returns {boolean}
 */
function isValidDrop(dropZone) {
    if (!dragState.isDragging) return false;

    const zoneType = dropZone.dataset.dropZone;

    if (dragState.dragType === 'hero') {
        // Heroes can be dropped on cards
        if (zoneType === 'card') {
            const cardId = dropZone.dataset.cardId;
            const card = CardManager.getCard(cardId);
            const heroId = dragState.dragData.heroId;

            // Valid if card exists AND it's not the card the hero is already on
            // (Allows moving to empty cards OR replacing a hero on another card)
            return card && card.assignedHeroId !== heroId;
        }
    }

    if (dragState.dragType === 'item') {
        // Items can be dropped on open input slots
        const slotType = dropZone.dataset.slotType;
        if (slotType === 'open') {
            const acceptTag = dropZone.dataset.acceptTag;
            const itemTags = dragState.dragData.tags || [];
            // Valid if item has the required tag
            return itemTags.includes(acceptTag);
        }

        // Items can be dropped on equipment slots
        const zoneType = dropZone.dataset.dropZone;
        if (zoneType === 'equipment') {
            const heroId = dropZone.dataset.heroId;
            const equipSlot = dropZone.dataset.equipmentSlot;
            const itemId = dragState.dragData.itemId;

            // Check if item matches slot type
            const itemDef = getItem(itemId);
            if (!itemDef || itemDef.equipSlot !== equipSlot) {
                return false;
            }

            // Check skill requirements (canHeroEquip handles this)
            const { canEquip } = EquipmentManager.canHeroEquip(heroId, itemId);
            return canEquip;
        }

        // Items can be dropped anywhere on hero card to auto-equip
        if (zoneType === 'hero-equip') {
            const heroId = dropZone.dataset.heroId;
            const itemId = dragState.dragData.itemId;
            const itemDef = getItem(itemId);

            // Valid if item has an equipSlot and hero can equip it
            if (!itemDef?.equipSlot) return false;

            const { canEquip } = EquipmentManager.canHeroEquip(heroId, itemId);
            return canEquip;
        }
    }

    return false;
}

// ========================================
// Drop
// ========================================

/**
 * Handle drop event
 * @param {DragEvent} e 
 */
function handleDrop(e) {
    if (!dragState.isDragging) return;

    e.preventDefault();

    const dropZone = e.target.closest('[data-drop-zone]');
    if (dropZone) {
        const zoneType = dropZone.dataset.dropZone;

        if (dragState.dragType === 'hero' && zoneType === 'card') {
            handleHeroDropOnCard(dragState.dragData.heroId, dropZone);
        }

        // Handle item drop on equipment slot
        if (dragState.dragType === 'item' && zoneType === 'equipment') {
            handleItemDropOnEquipment(dragState.dragData.itemId, dropZone);
        }

        // Handle item drop anywhere on hero card
        if (dragState.dragType === 'item' && zoneType === 'hero-equip') {
            handleItemDropOnHeroCard(dragState.dragData.itemId, dropZone);
        }
    }

    // Check for item drop on open input slot
    const inputSlot = e.target.closest('.card__input-slot--open');
    if (inputSlot && dragState.dragType === 'item') {
        handleItemDropOnSlot(dragState.dragData.itemId, inputSlot);
    }

    // Clean up
    if (dropZone) {
        dropZone.classList.remove('drop-zone--valid', 'drop-zone--invalid');
    }
    if (inputSlot) {
        inputSlot.classList.remove('drop-zone--valid', 'drop-zone--invalid');
    }
}

/**
 * Handle hero dropped on a card
 * @param {string} heroId 
 * @param {HTMLElement} dropZone 
 */
function handleHeroDropOnCard(heroId, dropZone) {
    const cardId = dropZone.dataset.cardId;
    if (!cardId) return;

    const hero = HeroManager.getHero(heroId);
    const card = CardManager.getCard(cardId);

    if (!hero || !card) return;

    // Store the source card for potential swap
    const sourceCardId = hero.assignedCardId;
    const targetHasHero = card.assignedHeroId !== null;
    const targetHeroId = card.assignedHeroId;

    // If hero is already assigned to a different card, unassign first (reassignment)
    if (sourceCardId && sourceCardId !== cardId) {
        CardManager.unassignHero(sourceCardId);
        logger.debug('DragDropHandler', `Auto-unassigned hero from card ${sourceCardId} for reassignment`);
    }

    // If target card has a hero, unassign them first (for swap or replacement)
    if (targetHasHero) {
        CardManager.unassignHero(cardId);
        logger.debug('DragDropHandler', `Unassigned ${targetHeroId} from target card ${cardId}`);
    }

    // Try to assign hero to card
    const cardResult = CardManager.assignHero(cardId, heroId);
    if (!cardResult.success) {
        // Handle skill requirement failure with specific feedback
        if (cardResult.error === 'SKILL_REQUIREMENT_NOT_MET') {
            const { skill, level } = cardResult.required;
            const heroLevel = cardResult.heroLevel;
            NotificationSystem.warning(
                `${hero.name} lacks ${skill} level ${level}! (has level ${heroLevel})`
            );
            // Add shake animation to card
            const cardElement = dropZone.closest('.card');
            if (cardElement) {
                cardElement.classList.add('card--rejected');
                setTimeout(() => cardElement.classList.remove('card--rejected'), 400);
            }
        } else {
            NotificationSystem.warning(`Cannot assign: ${cardResult.error}`);
        }
        return;
    }

    // Update hero status
    const heroResult = HeroManager.assignHeroToCard(heroId, cardId);
    if (!heroResult.success) {
        // Rollback card assignment
        CardManager.unassignHero(cardId);
        NotificationSystem.warning(`Cannot assign: ${heroResult.error}`);
        return;
    }

    // If this was a swap (target had a hero AND source had a card), try to move displaced hero to source
    if (targetHasHero && sourceCardId && targetHeroId) {
        const targetHero = HeroManager.getHero(targetHeroId);
        if (targetHero) {
            const swapResult = CardManager.assignHero(sourceCardId, targetHeroId);
            if (swapResult.success) {
                HeroManager.assignHeroToCard(targetHeroId, sourceCardId);
                NotificationSystem.success(`Swapped ${hero.name} and ${targetHero.name}`);
                EventBus.publish('hero_assigned', { heroId: targetHeroId, cardId: sourceCardId });
            } else {
                NotificationSystem.success(`${hero.name} assigned to ${card.name}`);
            }
        }
    } else {
        NotificationSystem.success(`${hero.name} assigned to ${card.name}`);
    }

    EventBus.publish('hero_assigned', { heroId, cardId });
}

/**
 * Handle item dropped on an open input slot
 * @param {string} itemId 
 * @param {HTMLElement} inputSlot 
 */
function handleItemDropOnSlot(itemId, inputSlot) {
    const slotIndex = parseInt(inputSlot.dataset.slotIndex, 10);
    const acceptTag = inputSlot.dataset.acceptTag;

    // Find the parent card
    const cardElement = inputSlot.closest('[data-card-id]');
    if (!cardElement) {
        console.error('Could not find parent card for input slot');
        return;
    }

    const cardId = cardElement.dataset.cardId;
    const itemDef = getItem(itemId);

    if (!itemDef) {
        NotificationSystem.error('Item not found');
        return;
    }

    // Validate tag
    if (!itemDef.tags?.includes(acceptTag)) {
        NotificationSystem.warning(`${itemDef.name} is not a valid ${acceptTag} `);
        return;
    }

    // Assign item to slot
    const result = CardManager.assignItemToSlot(cardId, slotIndex, itemId);
    if (result.success) {
        NotificationSystem.success(`${itemDef.name} added to slot`);
        // Trigger UI refresh
        EventBus.publish('cards_updated');
    } else {
        NotificationSystem.error(`Failed to assign: ${result.error} `);
    }
}

/**
 * Handle item dropped on a hero's equipment slot
 * @param {string} itemId 
 * @param {HTMLElement} dropZone 
 */
function handleItemDropOnEquipment(itemId, dropZone) {
    const heroId = dropZone.dataset.heroId;
    const slot = dropZone.dataset.equipmentSlot;

    if (!heroId || !slot) {
        console.error('Missing heroId or slot on equipment drop zone');
        return;
    }

    const hero = HeroManager.getHero(heroId);
    const itemDef = getItem(itemId);

    if (!hero || !itemDef) {
        NotificationSystem.error('Invalid hero or item');
        return;
    }

    // Validate item can go in this slot
    if (itemDef.equipSlot !== slot) {
        NotificationSystem.warning(`${itemDef.name} cannot be equipped in ${slot} slot`);
        return;
    }

    // Try to equip
    const result = EquipmentManager.equipItem(heroId, itemId);

    if (result.success) {
        NotificationSystem.success(`${itemDef.name} equipped to ${hero.name} `);
        EventBus.publish('heroes_updated', { source: 'equipment_dropped' });
    }
    // Error notification is handled by EquipmentManager.equipItem
}

/**
 * Handle item dropped anywhere on a hero card (auto-equip)
 * @param {string} itemId 
 * @param {HTMLElement} dropZone - The hero card element
 */
function handleItemDropOnHeroCard(itemId, dropZone) {
    const heroId = dropZone.dataset.heroId;

    if (!heroId) {
        console.error('Missing heroId on hero card drop zone');
        return;
    }

    const hero = HeroManager.getHero(heroId);
    const itemDef = getItem(itemId);

    if (!hero || !itemDef) {
        NotificationSystem.error('Invalid hero or item');
        return;
    }

    // Item must have an equipSlot
    if (!itemDef.equipSlot) {
        NotificationSystem.warning(`${itemDef.name} cannot be equipped`);
        return;
    }

    // Try to equip to the appropriate slot
    const result = EquipmentManager.equipItem(heroId, itemId);

    if (result.success) {
        NotificationSystem.success(`${itemDef.name} equipped to ${hero.name} `);
        EventBus.publish('heroes_updated', { source: 'hero_card_equip' });
    }
    // Error notification is handled by EquipmentManager.equipItem
}

// ========================================
// Drag End
// ========================================

/**
 * Handle drag end event
 * @param {DragEvent} e 
 */
function handleDragEnd(e) {
    if (!dragState.isDragging) return;

    // Remove dragging class from source
    if (dragState.sourceElement) {
        dragState.sourceElement.classList.remove('dragging');
    }

    // Remove all drop zone highlights
    highlightDropZones(false);
    highlightInputSlots(false);
    highlightEquipmentSlots(false);
    highlightHeroCards(false);

    // Reset drag state
    dragState = {
        isDragging: false,
        dragType: null,
        dragData: null,
        sourceElement: null,
        ghostElement: null
    };

    EventBus.publish('drag_ended', {});
}

// ========================================
// Helpers
// ========================================

/**
 * Highlight/unhighlight card drop zones (hero slots)
 * @param {boolean} highlight 
 */
function highlightDropZones(highlight) {
    // Only highlight card drop zones (for hero drops), not input-slot drop zones
    const dropZones = document.querySelectorAll('[data-drop-zone="card"]');
    dropZones.forEach(zone => {
        if (highlight) {
            zone.classList.add('drop-zone--active');
        } else {
            zone.classList.remove('drop-zone--active', 'drop-zone--valid', 'drop-zone--invalid');
        }
    });
}

/**
 * Highlight/unhighlight open input slots for item drag
 * @param {boolean} highlight 
 */
function highlightInputSlots(highlight) {
    const inputSlots = document.querySelectorAll('.card__input-slot--open');
    inputSlots.forEach(slot => {
        if (highlight) {
            slot.classList.add('drop-zone--active');
        } else {
            slot.classList.remove('drop-zone--active', 'drop-zone--valid', 'drop-zone--invalid');
        }
    });
}

/**
 * Highlight/unhighlight equipment slots for item drag
 * @param {boolean} highlight 
 * @param {Object} itemDef - Item template (only needed when highlighting)
 */
function highlightEquipmentSlots(highlight, itemDef = null) {
    const equipSlots = document.querySelectorAll('.hero-equipment__slot');
    equipSlots.forEach(slot => {
        if (highlight) {
            // Only highlight if item can go in this slot
            const slotType = slot.dataset.equipmentSlot;
            if (itemDef && itemDef.equipSlot === slotType) {
                slot.classList.add('drop-zone--active');
            }
        } else {
            slot.classList.remove('drop-zone--active', 'drop-zone--valid', 'drop-zone--invalid');
        }
    });
}

/**
 * Highlight/unhighlight hero cards for item drag (whole card drop zone)
 * @param {boolean} highlight 
 * @param {Object} itemDef - Item template (only needed when highlighting)
 */
function highlightHeroCards(highlight, itemDef = null) {
    const heroCards = document.querySelectorAll('.hero-card[data-drop-zone="hero-equip"]');
    heroCards.forEach(card => {
        if (highlight) {
            // Only highlight if item is equippable
            if (itemDef && itemDef.equipSlot) {
                card.classList.add('drop-zone--active');
            }
        } else {
            card.classList.remove('drop-zone--active', 'drop-zone--valid', 'drop-zone--invalid');
        }
    });
}

/**
 * Get current drag state (for debugging)
 * @returns {Object}
 */
export function getDragState() {
    return { ...dragState };
}

/**
 * Check if currently dragging
 * @returns {boolean}
 */
export function isDragging() {
    return dragState.isDragging;
}
