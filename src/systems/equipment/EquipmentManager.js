import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import {
    createEmptyEquipment, getGrid,
    findFreeSlot, slotsInCategory, getCategoryCap, isEquipCategory
} from '../../config/registries/equipmentConstants.js';
import * as EquipmentValidator from './EquipmentValidator.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Items stay in the shared Inventory stack; heroes link to them in their equipment slots.
 */
/**
 * Which grid slot an item of `category` should go into for this hero: the first
 * empty slot, unless the category's cap is reached, in which case the oldest
 * item of that category is displaced.
 *
 * @returns {{ slot: number, displaces: number|null }|null}
 *          null when the item can't be placed at all (grid full, no cap).
 */
export function resolveTargetSlot(hero, category) {
    const cap = getCategoryCap(category);
    if (!cap) return null;

    const held = slotsInCategory(hero, category);
    if (held.length >= cap) {
        return { slot: held[0], displaces: held[0] };
    }

    const free = findFreeSlot(hero);
    if (free === -1) return null;
    return { slot: free, displaces: null };
}

/**
 * Equip an item to a hero. The slot is derived from the item's category —
 * callers don't choose it (see resolveTargetSlot).
 */
export function equipItem(heroId, itemId, preferredSlot = null) {
    const hero = HeroManager.getHero(heroId);
    const template = getItem(itemId);
    if (!hero || !template) return { success: false, error: 'Target not found' };

    if (!InventoryManager.hasItem(itemId, 1)) return { success: false, error: 'Out of stock' };
    
    const { canEquip, reason } = EquipmentValidator.canHeroEquip(heroId, itemId);
    if (!canEquip) {
        NotificationSystem.error(`${hero.name} cannot equip ${template.name}: ${reason}`);
        return { success: false, error: reason };
    }

    // Food, drink and consumables share the grid with gear.
    const category = template.equipSlot;
    if (!category || !isEquipCategory(category)) {
        return { success: false, error: 'Item cannot be equipped' };
    }

    // Carrying the same item twice buffs nothing, so refuse rather than waste a slot.
    if (getGrid(hero).includes(itemId)) {
        return { success: false, error: `${template.name} is already equipped` };
    }

    let slot = null;
    if (preferredSlot !== null && preferredSlot >= 0 && preferredSlot < 9) {
        const held = slotsInCategory(hero, category).filter(s => s !== preferredSlot);
        const cap = getCategoryCap(category);
        if (held.length >= cap) {
            slot = held[0];
        } else {
            slot = preferredSlot;
        }
    } else {
        const target = resolveTargetSlot(hero, category);
        if (!target) {
            const cap = getCategoryCap(category);
            return {
                success: false,
                error: cap ? 'No free slot in the loadout' : 'Item cannot be equipped'
            };
        }
        slot = target.slot;
    }

    if (getGrid(hero)[slot]) unequipItem(heroId, slot);

    if (!Array.isArray(hero.equipment)) hero.equipment = createEmptyEquipment();
    hero.equipment[slot] = itemId;
    recalculateEquipmentModifiers(hero);

    EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId, slot, itemId, action: 'equip' });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'equipItem', heroId });
    
    logger.info('EquipmentManager', `${hero.name} equipped ${template.name} to ${slot}`);
    return { success: true };
}

/**
 * Unequip an item from a hero's slot
 */
export function unequipItem(heroId, slot) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.equipment?.[slot]) return { success: false, error: 'Slot is empty' };

    const itemId = hero.equipment[slot];
    hero.equipment[slot] = null;

    recalculateEquipmentModifiers(hero);

    EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId, slot, itemId: null, previousItemId: itemId, action: 'unequip' });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'unequipItem', heroId });
    
    logger.info('EquipmentManager', `${hero.name} unequipped ${itemId} from ${slot}`);
    return { success: true };
}

/**
 * Whether each equipped item is currently backed by stock in the Bank. An
 * item stays equipped without stock but does nothing; rules are read live from
 * the loadout, which checks stock where it is used.
 *
 *
 * @returns {Record<number, boolean>} slot index → whether it is backed by stock
 */
export function syncEquipmentModifiers(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.equipment) return {};

    const backed = {};
    getGrid(hero).forEach((itemId, slot) => {
        if (!itemId) return;
        backed[slot] = InventoryManager.hasItem(itemId, 1);
    });
    return backed;
}

/**
 * Get the item equipped in a specific slot
 */
export function getEquippedItem(heroId, slot) {
    return HeroManager.getHero(heroId)?.equipment?.[slot] || null;
}

/**
 * Get all equipment for a hero
 */
export function getAllEquipment(heroId) {
    const hero = HeroManager.getHero(heroId);
    return hero ? [...getGrid(hero)] : createEmptyEquipment();
}

/**
 * Wipe the `equip:*` modifiers older saves still hold on their heroes'
 * aggregators, then register the loadout's combat contributions.
 */
export function recalculateEquipmentModifiers(hero) {
    if (!hero?.aggregator) return;

    for (const sourceId of Array.from(hero.aggregator.modifiers.keys())) {
        if (sourceId.startsWith('equip:')) {
            hero.aggregator.removeModifiersBySource(sourceId);
        }
    }

    // Only combat axes are registered here: everything else a carried rule does
    // is read live off the loadout, because a cached contribution goes stale.
    // CombatFormulas queries this aggregator, and reaching from it into the item
    // registry and the Bank would invert that dependency.
    const source = 'equip:loadout';
    for (const { type, value, category } of HeroEffects.loadoutCombatContributions(hero)) {
        // `target.category` lets STATUS_IMMUNITY name one status instead of blocking all.
        hero.aggregator.addModifier({
            type, value, bucket: 'flat', source, persistent: true,
            ...(category ? { target: { category } } : {})
        });
    }
}

export const EquipmentManager = {
    equipItem,
    unequipItem,
    resolveTargetSlot,
    syncEquipmentModifiers,
    getEquippedItem,
    getAllEquipment,
    recalculateEquipmentModifiers
};

export default EquipmentManager;
