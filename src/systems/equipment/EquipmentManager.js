import { EventBus } from '../core/EventBus.js';
import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { t } from '../../i18n/index.js';
import {
    createEmptyEquipment, getGrid,
    findFreeSlot, slotsInCategory, getCategoryCap, isEquipCategory,
    handEntries, handsOfItem, HANDS
} from '../../config/registries/equipmentConstants.js';
import * as EquipmentValidator from './EquipmentValidator.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { takesCopy, holdsCopy, markHeld, slotBacked, heldCount } from './heldCopies.js';

/**
 * Gear, weapons and tools are one copy per hero: equipping one moves it out of the Bank into the
 * hero's hands, and taking it off puts it back. Food, drink and potions stay in the Bank's shared
 * stack, which the slot names (`heldCopies.js`).
 */

const itemName = (itemId) => getItem(itemId)?.name || itemId;

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
 * The hand items put down to make room for `itemId` going into grid slot `slot`: while the other
 * hand items and it need more than two hands, the first of them in grid order. So a two-handed
 * weapon clears the hands, and a tool or a one-handed weapon taken up puts a two-handed weapon down.
 */
function handsToFree(hero, itemId, slot) {
    const need = handsOfItem(itemId);
    if (!need) return [];
    const others = handEntries(hero, slot);
    let used = others.reduce((n, e) => n + e.hands, 0);
    const out = [];
    for (const entry of others) {
        if (used + need <= HANDS) break;
        out.push(entry.index);
        used -= entry.hands;
    }
    return out;
}

/** Another hero's slot holding its own copy of `itemId`, when the drop came from there; else null. */
function giverOf(heroId, itemId, from) {
    if (!from || from.heroId == null || from.slot == null || from.heroId === heroId) return null;
    const hero = HeroManager.getHero(from.heroId);
    if (!hero || getGrid(hero)[from.slot] !== itemId || !holdsCopy(hero, from.slot)) return null;
    return { heroId: from.heroId, hero, slot: from.slot };
}

/** The first of `itemIds` the Bank has no room for, taking them back in order; null when all fit. */
function firstWithoutRoom(itemIds, freed) {
    for (let i = 0; i < itemIds.length; i++) {
        if (!InventoryManager.hasRoomFor(itemIds.slice(0, i + 1), { freed })) return itemIds[i];
    }
    return null;
}

function bankFull(hero, itemId) {
    return { success: false, error: t('equipment.bankFull', { hero: hero.name, item: itemName(itemId) }) };
}

/** Empty a slot, putting a held copy back in the Bank unless `returnCopy` is false (the caller checked the room). */
function vacate(heroId, hero, slot, { returnCopy = true } = {}) {
    const itemId = hero.equipment[slot];
    if (returnCopy && holdsCopy(hero, slot)) InventoryManager.putBack(itemId);
    hero.equipment[slot] = null;
    markHeld(hero, slot, false);

    recalculateEquipmentModifiers(hero);

    EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId, slot, itemId: null, previousItemId: itemId, action: 'unequip' });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'unequipItem', heroId });

    logger.info('EquipmentManager', `${hero.name} unequipped ${itemId} from ${slot}`);
}

/**
 * Equip an item to a hero. The slot is derived from the item's category —
 * callers don't choose it (see resolveTargetSlot).
 *
 * A copy item comes out of the Bank, or, when `from` names another hero's slot holding one, out of
 * that hero's hands (a hand-over). What it displaces goes back to the Bank; if the Bank has no room
 * for it, nothing happens and the refusal says so.
 *
 * @param {{heroId: string, slot: number}|null} [from] where a dragged copy was picked up
 */
export function equipItem(heroId, itemId, preferredSlot = null, from = null) {
    const hero = HeroManager.getHero(heroId);
    const template = getItem(itemId);
    if (!hero || !template) return { success: false, error: 'Target not found' };

    const { canEquip, reason } = EquipmentValidator.canHeroEquip(heroId, itemId);
    if (!canEquip) return { success: false, error: reason };

    // Food, drink and consumables share the grid with gear.
    const category = template.equipSlot;
    if (!category || !isEquipCategory(category)) {
        return { success: false, error: 'Item cannot be equipped' };
    }

    // Carrying the same item twice buffs nothing, so refuse rather than waste a slot.
    if (getGrid(hero).includes(itemId)) {
        return { success: false, error: `${template.name} is already equipped` };
    }

    const copy = takesCopy(itemId);
    const giver = copy ? giverOf(heroId, itemId, from) : null;
    if (!giver && !InventoryManager.hasItem(itemId, 1)) {
        if (copy && heldCount(itemId) > 0) return { success: false, error: t('equipment.allInUse', { item: template.name }) };
        return { success: false, error: 'Out of stock' };
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

    const grid = getGrid(hero);
    const leaving = [...(grid[slot] ? [slot] : []), ...handsToFree(hero, itemId, slot)];
    const returning = leaving.filter(s => holdsCopy(hero, s)).map(s => grid[s]);
    // ⚠️ The new copy leaves the Bank before the displaced ones come back: taking out its last copy
    // frees the slot one of them may need.
    const freed = copy && !giver ? itemId : null;
    const stuck = returning.length ? firstWithoutRoom(returning, freed) : null;
    if (stuck) return bankFull(hero, stuck);

    if (giver) vacate(giver.heroId, giver.hero, giver.slot, { returnCopy: false });
    else if (copy) InventoryManager.takeOut(itemId);
    for (const s of leaving) vacate(heroId, hero, s);

    if (!Array.isArray(hero.equipment)) hero.equipment = createEmptyEquipment();
    hero.equipment[slot] = itemId;
    markHeld(hero, slot, copy);
    recalculateEquipmentModifiers(hero);

    EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId, slot, itemId, action: 'equip' });
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'equipItem', heroId });

    logger.info('EquipmentManager', `${hero.name} equipped ${template.name} to ${slot}`);
    return { success: true };
}

/**
 * Unequip an item from a hero's slot. A held copy goes back to the Bank; with no room there it
 * stays with the hero and the refusal says so.
 */
export function unequipItem(heroId, slot) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.equipment?.[slot]) return { success: false, error: 'Slot is empty' };

    const itemId = hero.equipment[slot];
    if (holdsCopy(hero, slot) && !InventoryManager.hasRoomFor([itemId])) return bankFull(hero, itemId);

    vacate(heroId, hero, slot);
    return { success: true };
}

/**
 * Break the item in a slot (a lost fight): a copy the hero holds is gone with it; an older save's
 * link to the Bank costs the Bank one, as it always did.
 */
export function destroyEquipped(heroId, slot) {
    const hero = HeroManager.getHero(heroId);
    const itemId = hero?.equipment?.[slot];
    if (!itemId) return { success: false, error: 'Slot is empty' };

    const held = holdsCopy(hero, slot);
    vacate(heroId, hero, slot, { returnCopy: false });
    if (!held) InventoryManager.removeItem(itemId, 1);
    return { success: true };
}

/**
 * Settle a loaded roster to one copy per hero. Heroes are taken in roster order and their slots in
 * grid order: a slot of gear that is still an older save's link takes a copy out of the Bank, or is
 * emptied when the Bank has none left. A held copy of an item that is no longer gear goes back to
 * the Bank. A save from after the change has nothing to settle.
 *
 * @returns {Array<{heroId: string, heroName: string, itemId: string, itemName: string}>} the slots
 *          emptied, for the one notice that says so
 */
export function reconcileHeldCopies(heroes = HeroManager.getAllHeroes() || []) {
    const lost = [];
    for (const hero of heroes) {
        let changed = false;
        getGrid(hero).forEach((itemId, slot) => {
            if (!itemId) return;
            const held = holdsCopy(hero, slot);
            if (takesCopy(itemId) && !held) {
                if (InventoryManager.takeOut(itemId, { quiet: true })) {
                    markHeld(hero, slot, true);
                } else {
                    hero.equipment[slot] = null;
                    lost.push({ heroId: hero.id, heroName: hero.name, itemId, itemName: itemName(itemId) });
                }
                changed = true;
            } else if (!takesCopy(itemId) && held && InventoryManager.putBack(itemId, { quiet: true })) {
                markHeld(hero, slot, false);
                changed = true;
            }
        });
        if (changed) recalculateEquipmentModifiers(hero);
    }
    return lost;
}

/**
 * Whether each equipped item can currently do anything: a held copy always, a shared item while
 * the Bank holds one. A shared item stays equipped without stock but does nothing; rules are read
 * live from the loadout, which checks stock where it is used.
 *
 * @returns {Record<number, boolean>} slot index → whether it is backed
 */
export function syncEquipmentModifiers(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero?.equipment) return {};

    const backed = {};
    getGrid(hero).forEach((itemId, slot) => {
        if (!itemId) return;
        backed[slot] = slotBacked(hero, slot);
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
    destroyEquipped,
    reconcileHeldCopies,
    resolveTargetSlot,
    syncEquipmentModifiers,
    getEquippedItem,
    getAllEquipment,
    recalculateEquipmentModifiers
};

export default EquipmentManager;
