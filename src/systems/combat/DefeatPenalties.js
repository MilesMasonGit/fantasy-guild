// Fantasy Guild — Defeat penalties (D-74)

import * as HeroManager from '../hero/HeroManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEquippedEntries, isGearCategory } from '../../config/registries/equipmentConstants.js';
import { DEFEAT_PENALTY } from '../../config/loopConstants.js';

/**
 * What losing a fight costs (D-74).
 *
 * ## Why this is its own module now
 * These rules lived inside `LoopRunner._applyDeathPenalties`, and the playmat
 * rework deletes `LoopRunner`. Extracted here rather than deleted-and-rewritten,
 * because the *rules* survive the rework untouched — only the thing that calls
 * them changes. `DefeatPenalties.test.js` pins them and keeps working.
 *
 * Phase 6 wires board combat to call this when a hero drops to 0 HP.
 *
 * ## Why defeat has to cost something
 * §8.1 makes combat the one part of the board that rewards being at the
 * keyboard: there is no difficulty warning and no preview (D-130), so the player
 * is expected to watch the first few fights of any new enemy and pull out if it
 * is going badly. **Leaving a hero unattended in a fight they cannot win means
 * death, and death costs equipment.** Remove the cost and the "active half" of
 * the game stops being active.
 *
 * ⚠️ With item durability retired (D-118), defeat-loss is now the **only** way
 * equipment ever leaves a hero. That is risk 12: gear demand comes solely from
 * roster growth and better recipes, so the crafting chain may go quiet between
 * Map unlocks.
 *
 * Numbers are placeholders in `loopConstants.js` (`DEFEAT_PENALTY`), owner-
 * approved for later tuning.
 */
export function applyDefeatPenalties(heroId) {
    const hero = HeroManager.getHero(heroId);
    if (!hero) return;
    const equipped = getEquippedEntries(hero);

    // 1. Consumable stack loss: a portion of each CARRIED consumable's banked
    //    stack is destroyed. This walks the hero's grid, not any container —
    //    consumables live in the 9-slot loadout (D-7).
    //
    //    It bites harder than the deck-era version did: a hero may carry up to
    //    nine consumables where the deck held a handful. Accepted (owner call
    //    2026-08-01) — a loaded hero risks more, and CONSUMABLE_LOSS_RATIO is
    //    the dial if playtest disagrees.
    for (const entry of equipped) {
        if (isGearCategory(entry.category)) continue;   // gear is rolled below
        const banked = InventoryManager.getItemCount(entry.itemId);
        const loss = Math.ceil(banked * DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO);
        if (loss > 0) InventoryManager.removeItem(entry.itemId, loss);
    }

    // 2. Permanent gear loss: each equipped GEAR piece can break. Unequip plus
    //    remove from the bank = gone forever.
    //
    //    Gear only — food, drink and consumables on the same grid are already
    //    covered by the stack loss above, and rolling them here too would
    //    punish the same loss twice.
    for (const entry of equipped) {
        if (!isGearCategory(entry.category)) continue;
        if (Math.random() < DEFEAT_PENALTY.GEAR_LOSS_CHANCE) {
            const item = getItem(entry.itemId);
            EquipmentManager.unequipItem(heroId, entry.index);
            InventoryManager.removeItem(entry.itemId, 1);
            NotificationSystem.warning(`${item?.name || entry.itemId} was destroyed in the defeat!`);
        }
    }
}
