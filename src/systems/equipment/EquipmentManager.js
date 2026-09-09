// Fantasy Guild - Equipment Manager
// Phase 40: Equipment Architecture Evolution (Auditor Refactor)

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

/**
 * EquipmentManager - Hub for Hero equipment state and modifier syncing.
 * 
 * Enforces the "Shared Reference" model: Items stay in the shared Inventory stack,
 * and heroes "link" to them in their equipment slots.
 */
/**
 * Which grid slot an item of `category` should go into for this hero.
 *
 * The grid is positionally free (D-7), so placement is simply "the first empty
 * slot". The only rule is the category's cap (D-55): once a hero already
 * carries the maximum of a category, a further item of it DISPLACES the oldest
 * one rather than taking a new slot — which preserves the old behaviour where
 * a third weapon swapped out the first, without needing named instances.
 *
 * @returns {{ slot: number, displaces: number|null }|null}
 *          null when the item can't be placed at all (grid full, no cap).
 */
export function resolveTargetSlot(hero, category) {
    const cap = getCategoryCap(category);
    if (!cap) return null;

    const held = slotsInCategory(hero, category);
    if (held.length >= cap) {
        // At the cap — replace the earliest of this category in grid order.
        return { slot: held[0], displaces: held[0] };
    }

    const free = findFreeSlot(hero);
    if (free === -1) return null;                 // grid full
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

    // 1. Validation Logic (Delegated)
    if (!InventoryManager.hasItem(itemId, 1)) return { success: false, error: 'Out of stock' };
    
    const { canEquip, reason } = EquipmentValidator.canHeroEquip(heroId, itemId);
    if (!canEquip) {
        NotificationSystem.error(`${hero.name} cannot equip ${template.name}: ${reason}`);
        return { success: false, error: reason };
    }

    // 2. Resolve category -> grid slot. Heroes carry gear AND consumables in
    //    one flexible grid now (D-7), so food/drink/consumable are equippable
    //    categories again — this is the CR-029 reversal made concrete.
    const category = template.equipSlot;
    if (!category || !isEquipCategory(category)) {
        return { success: false, error: 'Item cannot be equipped' };
    }

    // Carrying the same item twice buffs nothing (D-18), so refuse the
    // duplicate outright rather than silently wasting a slot.
    if (getGrid(hero).includes(itemId)) {
        return { success: false, error: `${template.name} is already equipped` };
    }

    let slot = null;
    if (preferredSlot !== null && preferredSlot >= 0 && preferredSlot < 9) {
        const held = slotsInCategory(hero, category).filter(s => s !== preferredSlot);
        const cap = getCategoryCap(category);
        if (held.length >= cap) {
            slot = held[0]; // Cap reached: displace earliest in category
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

    // 3. Apply State & Modifiers
    if (!Array.isArray(hero.equipment)) hero.equipment = createEmptyEquipment();
    hero.equipment[slot] = itemId;
    recalculateEquipmentModifiers(hero);

    EventBus.publish('hero_equipment_changed', { heroId, slot, itemId, action: 'equip' });
    EventBus.publish('heroes_updated', { source: 'equipItem', heroId });
    
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

    // Recalculate all equipment modifiers
    recalculateEquipmentModifiers(hero);

    EventBus.publish('hero_equipment_changed', { heroId, slot, itemId: null, previousItemId: itemId, action: 'unequip' });
    EventBus.publish('heroes_updated', { source: 'unequipItem', heroId });
    
    logger.info('EquipmentManager', `${hero.name} unequipped ${itemId} from ${slot}`);
    return { success: true };
}

/**
 * Whether each equipped item is currently backed by stock in the Bank.
 *
 * ## ⚠️ It used to toggle aggregator sources; there are none left to toggle
 * The old pipeline registered an `equip:<slot>` modifier per item and this
 * switched it off when the shared stack ran dry. Items are bearers now and their
 * rules are read live from the loadout (`HeroEffects.loadoutStatements`), which
 * checks stock itself — so the out-of-stock rule is enforced at the point of
 * use rather than by pre-registering something and disabling it later.
 *
 * Kept because the UI wants the same answer to grey a slot out (UE-22): the item
 * stays equipped, it simply does nothing until the Bank has one again.
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
 * Clear the modifiers a hero's loadout used to register on their aggregator.
 *
 * ## ⚠️ This function used to BE the gear effect system, and it is deleted
 * (UE-16)
 *
 * It read four flat stat fields off an item template (`damage`, `defense`,
 * `hpBonus`, `tickSpeedBonus`), a `skillBonus` object, and an `assignedEffect`
 * id which it hand-mapped through a `switch` of eight legacy names onto twelve
 * modifier types. **Nothing authored any of it.** All 54 shipped items carry the
 * same fourteen fields and none of them is an effect; `ItemEditor` had no field
 * for one; and nine of the twelve modifier types it wrote had no reader anywhere
 * in the game (ticket CR2-074). It was a write-only pipeline feeding a mostly
 * unread vocabulary.
 *
 * Items are **bearers** now (Unified Effects P4). An item's rules are named
 * library effects like everything else, resolved by `HeroEffects` and read
 * through the hero scope in `TileModifiers.resolveAxis` — one vocabulary, one
 * editor, one generated sentence. Combat's three genuinely-wired inputs
 * (`DEFENSE`, `ACCURACY`, `RESIST_FLAT`) become things content can feed the
 * moment somebody authors a rule that provides them.
 *
 * What remains is the wipe. A save written before this ran still holds
 * `equip:*` modifiers on its heroes' aggregators, and leaving them there would
 * keep a deleted system's numbers alive in every existing game.
 */
export function recalculateEquipmentModifiers(hero) {
    if (!hero?.aggregator) return;

    for (const sourceId of Array.from(hero.aggregator.modifiers.keys())) {
        if (sourceId.startsWith('equip:')) {
            hero.aggregator.removeModifiersBySource(sourceId);
        }
    }

    /**
     * Then register what the loadout's **named effects** say (P7).
     *
     * Only the combat axes come through here. Everything else a carried rule
     * does — yield, work time, grants, statuses — is read live off the loadout
     * at the moment it matters, because a loadout is not the board and a cached
     * contribution goes stale. Combat is the exception: `CombatFormulas` is a
     * pure calculation module that already queries this aggregator, and reaching
     * from it into the item registry and the Bank would invert that dependency.
     *
     * One source id, not one per slot: the loadout is a single bearer (UE-19),
     * so two items granting one effect have already been merged before they get
     * here.
     */
    const source = 'equip:loadout';
    for (const { type, value, category } of HeroEffects.loadoutCombatContributions(hero)) {
        // `target.category` is the shape `ModifierAggregator._forEachMatching`
        // matches on, and the only way `STATUS_IMMUNITY` can name one status
        // rather than blocking every one of them (P4).
        hero.aggregator.addModifier({
            type, value, bucket: 'flat', source, persistent: true,
            ...(category ? { target: { category } } : {})
        });
    }
}

// Backward compatibility (Default object)
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
