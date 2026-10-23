// which loadout slots hold a copy of their own, out of the Bank

import { GameState } from '../../state/GameState.js';
import { getGrid, categoryOfItem, isGearCategory } from '../../config/registries/equipmentConstants.js';
import { InventoryStore } from '../inventory/InventoryStore.js';

/**
 * Gear, weapons and tools are one copy per hero: equipping one takes that copy out of the Bank into
 * the hero's hands (`hero.heldCopies[slot]` is true), and taking it off puts it back. Food, drink
 * and potions stay shared: the slot only names a Bank stack, which every hero carrying it draws on.
 *
 * ⚠️ The mark, not the item's category, says whether a slot holds a copy. A slot of gear without the
 * mark is an older save's link to the Bank (or a test writing the grid straight), and the load
 * settles it (`EquipmentManager.reconcileHeldCopies`); until then it counts only while the Bank
 * holds one, as every link always did. An item whose category changes in the CMS while a hero holds
 * it is settled the same way, so a copy is never minted or lost by an edit.
 */

/** Whether equipping `itemId` takes a copy out of the Bank. */
export function takesCopy(itemId) {
    return isGearCategory(categoryOfItem(itemId));
}

/** Whether slot `slot` of the hero holds a copy of its own. */
export function holdsCopy(hero, slot) {
    return Array.isArray(hero?.heldCopies) && hero.heldCopies[slot] === true;
}

/** Mark slot `slot` as holding (or not) a copy of its own. */
export function markHeld(hero, slot, held) {
    if (!hero) return;
    if (!Array.isArray(hero.heldCopies)) {
        if (!held) return;
        hero.heldCopies = getGrid(hero).map(() => false);
    }
    hero.heldCopies[slot] = !!held;
    if (!hero.heldCopies.some(Boolean)) delete hero.heldCopies;
}

/**
 * Whether a slot's item can do anything: a copy the hero holds always does; a shared item (or an
 * older save's link) while the Bank holds at least one.
 */
export function slotBacked(hero, slot) {
    const itemId = getGrid(hero)[slot];
    if (!itemId) return false;
    if (holdsCopy(hero, slot)) return true;
    return (InventoryStore.getEntry(itemId)?.quantity || 0) >= 1;
}

/** How many copies of `itemId` the roster holds in its hands. */
export function heldCount(itemId, heroes = GameState.state?.heroes || []) {
    let n = 0;
    for (const hero of heroes) {
        getGrid(hero).forEach((id, slot) => {
            if (id === itemId && holdsCopy(hero, slot)) n++;
        });
    }
    return n;
}

/**
 * Line the marks up with a loaded grid: one per slot, only where a slot holds an item, and none at
 * all on a hero who holds no copy.
 */
export function normaliseHeldCopies(hero) {
    if (!hero) return;
    const marks = Array.isArray(hero.heldCopies) ? hero.heldCopies : [];
    const next = getGrid(hero).map((itemId, slot) => !!itemId && marks[slot] === true);
    if (next.some(Boolean)) hero.heldCopies = next;
    else delete hero.heldCopies;
}
