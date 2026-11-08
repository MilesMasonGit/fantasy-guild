// tools and weapons that break: one roll as a cycle completes, for the one item that cycle used

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';
import { neededToolOf } from '../../config/registries/toolKinds.js';
import { breakChanceOf } from '../../config/registries/itemBreak.js';
import { getHeroWeaponSlot } from '../combat/CombatFormulas.js';
import { fittingToolSlotOf } from './HeroTools.js';
import { destroyEquipped } from './EquipmentManager.js';

/**
 * A tool or weapon with a `breakChance` (`itemBreak.js`) may break, checked only as a cycle it was
 * used for completes, never part-way:
 * - a work cycle (`BoardRunner.completeCycle`, a failed one included): the tool the Token needs,
 *   the first fitting one in the hero's hands (`HeroTools.fittingToolSlotOf`), the one the cycle
 *   used. A Token that needs no tool uses none.
 * - a kill (`BoardCombat`, the fight's cycle): the weapon swung (`CombatFormulas.getHeroWeaponSlot`).
 * A broken item leaves the hero's hands for good (`EquipmentManager.destroyEquipped`); nothing
 * takes its place, from the Bank or anywhere.
 *
 * ⚠️ The roll is the one `Math.random` draw, made after everything else that cycle drew, so live
 * play and a catch-up's steps break the same item on the same cycle. ⚠️ An item with no chance
 * draws nothing: content without the field leaves the random stream (and the bench's work check)
 * exactly as it was.
 */

export const USE = Object.freeze({ WORK: 'work', FIGHT: 'fight' });

/** The hero record, straight from state: `HeroManager.getHero` rebuilds a hero as a side effect. */
function heroRecord(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/**
 * Roll for the item in `slot` of `heroId`'s hands. Breaks it and announces `GEAR_BROKE` on a hit.
 * @returns {string|null} the item id that broke, or null
 */
function roll(heroId, slot, use, instance) {
    if (slot === null || slot === undefined) return null;
    const hero = heroRecord(heroId);
    const itemId = hero ? getGrid(hero)[slot] : null;
    const chance = breakChanceOf(getItem(itemId));
    if (!(chance > 0)) return null;
    if (!(Math.random() * 100 < chance)) return null;
    destroyEquipped(heroId, slot);
    EventBus.publish(BOARD_EVENTS.GEAR_BROKE, {
        heroId, heroName: hero.name || null, itemId, slot, use,
        instanceId: instance?.id ?? null, typeId: instance?.typeId ?? null
    });
    return itemId;
}

/**
 * A work cycle on `instance` (of type `def`, as it was when the cycle ran) completed with `heroId`
 * on it: the tool its work needed may break.
 */
export function afterWorkCycle(heroId, def, instance) {
    if (!heroId) return null;
    const need = neededToolOf(def);
    if (!need) return null;
    return roll(heroId, fittingToolSlotOf(heroId, need), USE.WORK, instance);
}

/** `heroId` killed the enemy on `instance`: the weapon they swung may break. Barehanded, nothing. */
export function afterKill(heroId, instance) {
    const hero = heroRecord(heroId);
    if (!hero) return null;
    return roll(heroId, getHeroWeaponSlot(hero), USE.FIGHT, instance);
}
