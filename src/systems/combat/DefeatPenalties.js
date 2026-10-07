// Fantasy Guild — Defeat penalties

import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEquippedEntries, isGearCategory, isConsumableCategory } from '../../config/registries/equipmentConstants.js';
import { DEFEAT_PENALTY } from '../../config/loopConstants.js';

/**
 * What losing a fight costs: a share of each carried food/drink stack, and a
 * chance to permanently lose each equipped gear piece. Returns the losses as
 * display names (`"25 Pie"` for part of a stack, `"Sword"` for a destroyed
 * piece) and announces nothing itself; the caller sends ONE defeat notification.
 *
 * Defeat has to cost equipment: combat is the one part of the board that
 * rewards being at the keyboard, and a hero left unattended in a fight they
 * cannot win must lose something. Numbers live in `DEFEAT_PENALTY`.
 */
export function applyDefeatPenalties(heroId) {
    const lost = [];
    const hero = HeroManager.getHero(heroId);
    if (!hero) return lost;
    const equipped = getEquippedEntries(hero);

    // 1. Consumable stack loss: a share of each CARRIED food/drink item's banked
    //    stack is destroyed. Walks the hero's grid, not any container.
    //
    //    ⚠️ The Consumable class (potions/scrolls/runes) is exempt because it is
    //    dormant: `consumeLoopConsumables` has no caller outside tests, so an
    //    equipped potion is never spent. Not an oversight to fix; wire the Prep
    //    Phase first.
    for (const entry of equipped) {
        if (isGearCategory(entry.category)) continue;        // gear is rolled below
        if (isConsumableCategory(entry.category)) continue;  // exempt: dormant, see above
        const banked = InventoryManager.getItemCount(entry.itemId);
        const loss = Math.ceil(banked * DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO);
        if (loss > 0) {
            InventoryManager.removeItem(entry.itemId, loss);
            lost.push(`${loss} ${getItem(entry.itemId)?.name || entry.itemId}`);
        }
    }

    // 2. Permanent gear loss: each equipped GEAR piece can break (unequipped and
    //    removed from the bank). Gear only, so no loss is charged twice.
    for (const entry of equipped) {
        if (!isGearCategory(entry.category)) continue;
        if (Math.random() < DEFEAT_PENALTY.GEAR_LOSS_CHANCE) {
            const item = getItem(entry.itemId);
            EquipmentManager.unequipItem(heroId, entry.index);
            InventoryManager.removeItem(entry.itemId, 1);
            lost.push(item?.name || entry.itemId);
        }
    }
    return lost;
}
