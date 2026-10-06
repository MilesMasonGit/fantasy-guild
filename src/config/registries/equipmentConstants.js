// Fantasy Guild - Equipment Constants
//
// A thin FACADE over the authored category table in `equipmentCategories.js`.
//
// The model in two layers:
//
//  - **Categories** are what an ITEM declares via its `equipSlot` field
//    (hand / hat / chest / trinket / food / drink / consumable). An item knows
//    what kind of thing it is.
//  - **The grid** is what a HERO carries: nine generic slots, any item
//    in any slot. What constrains a loadout is the per-category cap,
//    never the slot's position.
//
// A "slot" is an INDEX (0-8), not a name.

import { getItem } from './itemRegistry.js';
import {
    GRID_SLOT_COUNT,
    getCategoryCap,
    isEquipCategory,
    isWeaponCategory,
    isGearCategory,
    isConsumableCategory,
    getCategoryInfo,
    listCategoryIds,
    categoryIdsOfKind,
    CATEGORY_KINDS
} from './equipmentCategories.js';

export {
    GRID_SLOT_COUNT,
    getCategoryCap,
    isEquipCategory,
    isWeaponCategory,
    isGearCategory,
    isConsumableCategory,
    getCategoryInfo,
    categoryIdsOfKind,
    CATEGORY_KINDS
};

/** Every equippable category id — what an item's `equipSlot` may say. */
export const EQUIPMENT_CATEGORIES = listCategoryIds();

/** Grid positions, in display order. Nine slots, rendered 3×3. */
export const SLOT_ORDER = Array.from({ length: GRID_SLOT_COUNT }, (_, i) => i);

/** A fresh, empty loadout grid. */
export function createEmptyEquipment() {
    return Array.from({ length: GRID_SLOT_COUNT }, () => null);
}

/**
 * A hero's grid as a plain array, tolerating anything odd on the hero object
 * (a legacy named-slot object, a short array, or nothing at all).
 */
export function getGrid(hero) {
    const grid = hero?.equipment;
    if (Array.isArray(grid)) return grid;
    if (grid && typeof grid === 'object') return Object.values(grid);   // legacy shape
    return [];
}

/** The category an item belongs to, or null when it isn't equippable. */
export function categoryOfItem(itemId) {
    const category = itemId ? getItem(itemId)?.equipSlot : null;
    return category && isEquipCategory(category) ? category : null;
}

/** Occupied slots as `{ index, itemId, category }`, in grid order. */
export function getEquippedEntries(hero) {
    return getGrid(hero)
        .map((itemId, index) => (itemId ? { index, itemId, category: categoryOfItem(itemId) } : null))
        .filter(Boolean);
}

/** How many items of a category the hero is carrying. */
export function countInCategory(hero, categoryId) {
    return getEquippedEntries(hero).filter(e => e.category === categoryId).length;
}

/** The first empty grid slot, or -1 when the grid is full. */
export function findFreeSlot(hero) {
    return getGrid(hero).findIndex(itemId => !itemId);
}

/** Grid indices holding items of a category, in order. */
export function slotsInCategory(hero, categoryId) {
    return getEquippedEntries(hero).filter(e => e.category === categoryId).map(e => e.index);
}

/**
 * The slot holding the hero's primary weapon — the FIRST grid slot holding a
 * weapon-category item, or null when unarmed.
 *
 * Combat needs to name a single weapon to know which style an attack uses.
 * With two weapons the choice stays well-defined: the first in grid order.
 */
export function getPrimaryWeaponSlot(hero) {
    const entry = getEquippedEntries(hero).find(e => isWeaponCategory(e.category));
    return entry ? entry.index : null;
}

/** The item id of the hero's primary weapon, or null when unarmed. */
export function getPrimaryWeapon(hero) {
    const slot = getPrimaryWeaponSlot(hero);
    return slot === null ? null : getGrid(hero)[slot];
}

/** Every equipped item id of a given kind (gear / sustenance / consumable). */
export function itemsOfKind(hero, kind) {
    const ids = new Set(categoryIdsOfKind(kind));
    return getEquippedEntries(hero).filter(e => ids.has(e.category)).map(e => e.itemId);
}

/** Grid indices holding worn gear — what defeat-loss applies to. */
export function gearSlots(hero) {
    return getEquippedEntries(hero).filter(e => isGearCategory(e.category)).map(e => e.index);
}

export default {
    GRID_SLOT_COUNT,
    SLOT_ORDER,
    EQUIPMENT_CATEGORIES,
    createEmptyEquipment,
    getGrid,
    categoryOfItem,
    getEquippedEntries,
    countInCategory,
    findFreeSlot,
    slotsInCategory,
    getPrimaryWeaponSlot,
    getPrimaryWeapon,
    itemsOfKind,
    gearSlots
};
