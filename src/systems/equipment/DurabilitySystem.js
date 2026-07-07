// Fantasy Guild - Durability System (Unified)
// Phase 40: Equipment Architecture Evolution

import { InventoryManager } from '../inventory/InventoryManager.js';
import * as CardManager from '../cards/CardManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { EventBus } from '../core/EventBus.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * DurabilitySystem - Central hub for all item wear and tear.
 * 
 * Each item's health is tracked by the Vault (InventoryManager).
 * This system provides the automation layer for consuming stock on breakage.
 */
/**
 * Reduce weapon durability (Combat)
 */
export function applyWeaponWear(heroId) {
    reduceHeroEquipmentDurability(heroId, 'weapon', 1);
}

/**
 * Reduce armor durability (Combat)
 */
export function applyArmorWear(heroId) {
    reduceHeroEquipmentDurability(heroId, 'armor', 1);
}

/**
 * Reduce durability for a specific hero slot
 * Primary entry point for hero gear wear.
 */
export function reduceHeroEquipmentDurability(heroId, slot, amount = 1) {
    const hero = HeroManager.getHero(heroId);
    const itemId = hero?.equipment?.[slot];
    if (!hero || !itemId) return;

    InventoryManager.decrementDurability(itemId, amount);
    
    // Auxiliary armor slot wear (simulates full-set degradation)
    if (slot === 'armor') {
        const auxSlots = ['head', 'body', 'hands', 'feet'];
        const randomSlot = auxSlots[Math.floor(Math.random() * auxSlots.length)];
        const auxItem = hero.equipment[randomSlot];
        if (auxItem) InventoryManager.decrementDurability(auxItem, amount * 0.5);
    }
}

/**
 * Process tool durability decay (Card/Task)
 * @returns {boolean} true if tool is still usable, false if broken and empty
 */
export function tickDurability(cardInstance, slotIndex, amount = 1) {
    const itemId = cardInstance.assignedItems[slotIndex];
    if (!itemId) return true;

    const result = InventoryManager.decrementDurability(itemId, amount);
    if (result.depleted) {
        _breakCardTool(cardInstance, slotIndex, getItem(itemId));
        return false;
    }
    return true;
}

/**
 * Get durability percentage for display
 */
export function getDurabilityPercent(itemId) {
    if (!itemId) return 0;
    const template = getItem(itemId);
    if (!template?.maxDurability) return 100;

    const currentDur = InventoryManager.getDurability(itemId);
    return currentDur === null ? 100 : Math.max(0, Math.min(100, (currentDur / template.maxDurability) * 100));
}

/**
 * Internal: Break tool (removes from slot)
 * @private
 */
export function _breakCardTool(cardInstance, slotIndex, itemTemplate) {
    cardInstance.assignedItems[slotIndex] = null;
    NotificationSystem.warning(`Tool broken: ${itemTemplate.name} (Out of stock!)`);
    EventBus.publish('card_updated', { cardId: cardInstance.id });
    CardManager.setCardStatus(cardInstance.id, 'paused');
}

// Backward compatibility (Default object)
export const DurabilitySystem = {
    applyWeaponWear,
    applyArmorWear,
    reduceHeroEquipmentDurability,
    tickDurability,
    getDurabilityPercent,
    _breakCardTool
};

export default DurabilitySystem;
