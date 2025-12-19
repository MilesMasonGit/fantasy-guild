// Fantasy Guild - UI Subscription Manager
// Centralized management of EventBus subscriptions for UI panels
// Prevents memory leaks by ensuring subscriptions are properly cleaned up

import { EventBus } from '../systems/core/EventBus.js';
import { updateInventoryDisplay } from './panels/RightPanel.js';
import { updateHeroList } from './panels/LeftPanel.js';
import { updateInfluenceDisplay } from './panels/TopBar.js';
import { GameState } from '../state/GameState.js';
import { logger } from '../utils/Logger.js';

/**
 * Store unsubscribe functions for all UI subscriptions
 */
const subscriptions = {
    inventory: null,
    inventoryStackFull: null,
    heroes: null,
    heroRetired: null,
    influenceChanged: null,
    heroEquipmentFlash: null,
    cardHeroAssignFlash: null,
    cardItemAssignFlash: null,
    cardSpawnFlash: null,
};

/**
 * Set up all UI panel subscriptions
 * Call this once when the ViewManager initializes
 */
export function setupSubscriptions() {
    logger.debug('UISubscriptionManager', 'Setting up UI subscriptions');

    // Clean up any existing subscriptions first
    cleanupSubscriptions();

    // Inventory panel updates + card input slot count updates
    subscriptions.inventory = EventBus.subscribe('inventory_updated', (data) => {
        updateInventoryDisplay();

        // Efficiently update item count badges on all cards showing this item
        if (data?.itemId) {
            updateCardItemCounts(data.itemId, data.amount);

            // Flash inventory item when quantity is added
            if (data.added && data.added > 0) {
                setTimeout(() => {
                    flashInventoryItem(data.itemId);
                }, 100);
            }
        }
    });

    // Red flash on inventory item when stack is full
    subscriptions.inventoryStackFull = EventBus.subscribe('inventory_stack_full', (data) => {
        if (data?.itemId) {
            setTimeout(() => {
                flashInventoryStackFull(data.itemId);
            }, 100);
        }
    });

    // Hero list updates
    subscriptions.heroes = EventBus.subscribe('heroes_updated', () => {
        updateHeroList(GameState.heroes);
    });

    subscriptions.heroRetired = EventBus.subscribe('hero_retired', () => {
        updateHeroList(GameState.heroes);
    });

    // Influence updates
    subscriptions.influenceChanged = EventBus.subscribe('influence_changed', ({ amount }) => {
        updateInfluenceDisplay(amount);
    });

    // Hero equipment flash - visual feedback when items are equipped
    // Use requestAnimationFrame to wait for heroes_updated re-render to complete
    subscriptions.heroEquipmentFlash = EventBus.subscribe('hero_equipment_changed', (data) => {
        if (data.action === 'equip') {
            // Delay until after the DOM re-render from heroes_updated
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    flashHeroCard(data.heroId);
                });
            });
        }
    });

    // Card flash when hero is assigned
    // Use setTimeout to wait for CenterPanel's updateCardStack() and drop-zone cleanup
    subscriptions.cardHeroAssignFlash = EventBus.subscribe('hero_assigned_to_card', (data) => {
        setTimeout(() => {
            flashCard(data.cardId);
        }, 100);
    });

    // Card flash when item is assigned to a slot
    subscriptions.cardItemAssignFlash = EventBus.subscribe('item_assigned_to_slot', (data) => {
        setTimeout(() => {
            flashCard(data.cardId);
        }, 100);
    });

    // Gold flash when a new card is spawned
    subscriptions.cardSpawnFlash = EventBus.subscribe('card_spawned', (data) => {
        // Delay to ensure DOM is updated after CenterPanel renders the card
        setTimeout(() => {
            flashCardSpawn(data.cardId);
        }, 150);
    });
}

/**
 * Clean up all UI subscriptions
 * Call this when the game restarts or ViewManager is destroyed
 */
export function cleanupSubscriptions() {
    logger.debug('UISubscriptionManager', 'Cleaning up UI subscriptions');

    // Call each unsubscribe function if it exists
    Object.keys(subscriptions).forEach(key => {
        if (subscriptions[key]) {
            subscriptions[key](); // Call the unsubscribe function
            subscriptions[key] = null;
        }
    });
}

/**
 * Get subscription status (for debugging)
 * @returns {Object} Status of each subscription
 */
export function getSubscriptionStatus() {
    return Object.keys(subscriptions).reduce((status, key) => {
        status[key] = subscriptions[key] !== null;
        return status;
    }, {});
}

/**
 * Efficiently update item count badges on all cards showing a specific item
 * Uses DOM queries to update only the relevant badges without re-rendering
 * @param {string} itemId - The item that changed
 * @param {number} newCount - The new inventory count
 */
function updateCardItemCounts(itemId, newCount) {
    // Find all fixed input slots with this item
    const fixedSlots = document.querySelectorAll(`.card__input-slot[data-item-id="${itemId}"]`);
    fixedSlots.forEach(slot => {
        const countBadge = slot.querySelector('.card__input-count');
        if (countBadge) {
            countBadge.textContent = newCount;
        }
    });

    // Find all open (assigned) slots with this item
    const openSlots = document.querySelectorAll(`.card__input-slot[data-assigned-item="${itemId}"]`);
    openSlots.forEach(slot => {
        const countBadge = slot.querySelector('.card__input-count');
        if (countBadge) {
            countBadge.textContent = newCount;
        }
    });
}

/**
 * Flash a hero card green to provide visual feedback when items are equipped
 * @param {string} heroId - The hero whose card should flash
 */
function flashHeroCard(heroId) {
    logger.debug('UISubscriptionManager', `Flashing hero card: ${heroId}`);

    const heroCard = document.querySelector(`.hero-card[data-hero-id="${heroId}"]`);
    if (!heroCard) {
        logger.warn('UISubscriptionManager', `Hero card not found for: ${heroId}`);
        return;
    }

    // Remove class first to allow re-triggering
    heroCard.classList.remove('hero-card--equip-flash');

    // Force reflow to restart animation
    void heroCard.offsetWidth;

    // Add the flash class
    heroCard.classList.add('hero-card--equip-flash');
    logger.debug('UISubscriptionManager', 'Flash class added');

    // Remove class after animation completes
    setTimeout(() => {
        heroCard.classList.remove('hero-card--equip-flash');
    }, 1200);
}

/**
 * Flash a card green to provide visual feedback when hero or item is assigned
 * @param {string} cardId - The card ID to flash
 */
function flashCard(cardId) {
    logger.debug('UISubscriptionManager', `Flashing card: ${cardId}`);

    const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (!card) {
        logger.warn('UISubscriptionManager', `Card not found for: ${cardId}`);
        return;
    }

    // Remove class first to allow re-triggering
    card.classList.remove('card--assign-flash');

    // Force reflow to restart animation
    void card.offsetWidth;

    // Add the flash class
    card.classList.add('card--assign-flash');
    logger.debug('UISubscriptionManager', 'Card flash class added');

    // Remove class after animation completes
    setTimeout(() => {
        card.classList.remove('card--assign-flash');
    }, 1200);
}

/**
 * Flash an inventory item green when quantity is added
 * @param {string} itemId - The item ID to flash
 */
function flashInventoryItem(itemId) {
    logger.debug('UISubscriptionManager', `Flashing inventory item: ${itemId}`);

    const item = document.querySelector(`.inventory-item[data-item-id="${itemId}"]`);
    if (!item) {
        logger.debug('UISubscriptionManager', `Inventory item not found for: ${itemId}`);
        return;
    }

    // Remove class first to allow re-triggering
    item.classList.remove('inventory-item--flash');

    // Force reflow to restart animation
    void item.offsetWidth;

    // Add the flash class
    item.classList.add('inventory-item--flash');

    // Remove class after animation completes
    setTimeout(() => {
        item.classList.remove('inventory-item--flash');
    }, 1200);
}

/**
 * Flash a card gold when it spawns
 * @param {string} cardId - The card ID to flash
 */
function flashCardSpawn(cardId) {
    logger.debug('UISubscriptionManager', `Flashing spawn for card: ${cardId}`);

    const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (!card) {
        logger.debug('UISubscriptionManager', `Card not found for spawn flash: ${cardId}`);
        return;
    }

    // Remove class first to allow re-triggering
    card.classList.remove('card--spawn-flash');

    // Force reflow to restart animation
    void card.offsetWidth;

    // Add the flash class
    card.classList.add('card--spawn-flash');

    // Remove class after animation completes
    setTimeout(() => {
        card.classList.remove('card--spawn-flash');
    }, 1200);
}

/**
 * Flash an inventory item red when stack is full
 * @param {string} itemId - The item ID to flash
 */
function flashInventoryStackFull(itemId) {
    logger.debug('UISubscriptionManager', `Flashing stack full for item: ${itemId}`);

    const item = document.querySelector(`.inventory-item[data-item-id="${itemId}"]`);
    if (!item) {
        logger.debug('UISubscriptionManager', `Inventory item not found for stack full: ${itemId}`);
        return;
    }

    // Remove class first to allow re-triggering
    item.classList.remove('inventory-item--stack-full');

    // Force reflow to restart animation
    void item.offsetWidth;

    // Add the flash class
    item.classList.add('inventory-item--stack-full');

    // Remove class after animation completes
    setTimeout(() => {
        item.classList.remove('inventory-item--stack-full');
    }, 1200);
}
