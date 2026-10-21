// the gathering tools a hero holds

import { GameState } from '../../state/GameState.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';
import { InventoryStore } from '../inventory/InventoryStore.js';
import { toolOf, toolMeets, HAND_CATEGORY } from '../../config/registries/toolKinds.js';

/**
 * A tool counts while it is held in the hands (its item's category is Hand) and the Bank still
 * holds one: an item stays equipped without stock but does nothing, as every carried item does.
 *
 * ⚠️ Reads the hero record straight from state, not through `HeroManager.getHero`, which rehydrates
 * as a side effect: this is asked by the flag chooser and the board runner every tick.
 */

function heroRecord(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

const backed = (itemId) => (InventoryStore.getEntry(itemId)?.quantity || 0) >= 1;

/** The tool an equipped item is, when it is held in a hand; else null. */
function heldTool(itemId) {
    const item = getItem(itemId);
    return item?.equipSlot === HAND_CATEGORY ? toolOf(item) : null;
}

/** Whether an item is a gathering tool. */
export function isToolItem(itemId) {
    return !!toolOf(getItem(itemId));
}

/** The tools a hero record holds, as `[{ itemId, kind, tier, backed }]` in grid order. */
export function toolsOfHero(hero) {
    const out = [];
    for (const itemId of getGrid(hero)) {
        if (!itemId) continue;
        const tool = heldTool(itemId);
        if (tool) out.push({ itemId, kind: tool.kind, tier: tool.tier, backed: backed(itemId) });
    }
    return out;
}

/** Whether hero `heroId` holds a tool, backed by the Bank, that answers `need`. No need: true. */
export function holdsToolFor(heroId, need) {
    if (!need) return true;
    const hero = heroRecord(heroId);
    if (!hero) return false;
    for (const itemId of getGrid(hero)) {
        if (itemId && toolMeets(heldTool(itemId), need) && backed(itemId)) return true;
    }
    return false;
}
