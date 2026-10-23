// the QA panel's gear checks: a full Bank, and an older save whose heroes share one tool
// ⚠️ DEV BUILDS ONLY: reached from `GearDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { GameState } from '../../state/GameState.js';
import { SaveManager } from '../../systems/core/SaveManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { starterToolIds, toolOf } from '../../config/registries/toolKinds.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';

/**
 * Fill every free Bank slot with one of an item it does not hold, so taking gear off meets a full
 * Bank. Only items no hero can equip, so none of them is one a hero would want to put back.
 * @returns {number} the slots filled
 */
export function devFillBank() {
    let filled = 0;
    for (const item of Object.values(getAllItems())) {
        if (!item?.id || item.equipSlot) continue;
        if (InventoryManager.getItemCount(item.id) > 0) continue;
        if (InventoryManager.lacksSlotFor(item.id)) break;
        if (InventoryManager.addItem(item.id, 1, 'dev') > 0) filled++;
    }
    return filled;
}

/** The tool the shared-tool check hands round: the first starter tool, else the first tool. */
export function sharedToolId(items = getAllItems()) {
    return starterToolIds(items)[0]
        || Object.values(items).find(item => item?.id && item.equipSlot === 'hand' && toolOf(item))?.id
        || null;
}

/**
 * A save written as one from before one item, one hero: every hero (villagers aside) carries
 * `toolId` as a link to the Bank rather than a copy of their own, and the Bank holds one. Loading
 * it gives that copy to the first hero in roster order and empties the others, with one notice.
 * @param {object} data a whole save, as `GameState.serializeJson` writes it (changed in place)
 * @returns {number} the heroes carrying the shared tool
 */
export function shareOneToolOldStyle(data, toolId) {
    const heroes = (data?.state?.heroes || []).filter(h => h && !h.isVillager);
    let sharing = 0;
    for (const hero of heroes) {
        const grid = getGrid(hero);
        let slot = grid.indexOf(toolId);
        if (slot === -1) slot = grid.findIndex(id => !id);
        if (slot === -1) continue;
        hero.equipment[slot] = toolId;
        if (Array.isArray(hero.heldCopies)) hero.heldCopies[slot] = false;
        sharing++;
    }
    data.state.inventory.items[toolId] = { quantity: 1, dur: null };
    return sharing;
}

/**
 * ⚠️ Rewrites the save in the slot being played, then reloads into it the way a load does, so the
 * load's settling and its notice are what the player would see.
 * @returns {{ok: boolean, error?: string}}
 */
export function devShareOneTool() {
    const slot = SaveManager.getCurrentSlot();
    if (slot === null || !GameState.getIsInitialized()) return { ok: false, error: 'No game is open' };
    const toolId = sharedToolId();
    if (!toolId) return { ok: false, error: 'No tool in the content' };
    const data = JSON.parse(GameState.serializeJson());
    if (shareOneToolOldStyle(data, toolId) < 2) return { ok: false, error: 'Hire at least two heroes with a free slot first' };
    return SaveManager.restoreAndReload(slot, JSON.stringify(data))
        ? { ok: true }
        : { ok: false, error: 'The save could not be written' };
}
