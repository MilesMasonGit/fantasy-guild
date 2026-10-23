// the gathering tools a hero holds

import { GameState } from '../../state/GameState.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';
import { toolOf, toolMeets, HAND_CATEGORY } from '../../config/registries/toolKinds.js';
import { slotBacked } from './heldCopies.js';

/**
 * A tool counts while it is held in the hands (its item's category is Hand) and backed: a copy the
 * hero holds always is; an older save's link only while the Bank holds one (`heldCopies.js`).
 *
 * ⚠️ Reads the hero record straight from state, not through `HeroManager.getHero`, which rehydrates
 * as a side effect: this is asked by the flag chooser and the board runner every tick.
 */

function heroRecord(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

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
    getGrid(hero).forEach((itemId, slot) => {
        if (!itemId) return;
        const tool = heldTool(itemId);
        if (tool) out.push({ itemId, kind: tool.kind, tier: tool.tier, backed: slotBacked(hero, slot) });
    });
    return out;
}

/** Whether hero `heroId` holds a backed tool that answers `need`. No need: true. */
export function holdsToolFor(heroId, need) {
    if (!need) return true;
    const hero = heroRecord(heroId);
    if (!hero) return false;
    const grid = getGrid(hero);
    for (let slot = 0; slot < grid.length; slot++) {
        const itemId = grid[slot];
        if (itemId && toolMeets(heldTool(itemId), need) && slotBacked(hero, slot)) return true;
    }
    return false;
}
