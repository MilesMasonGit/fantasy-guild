// the starter tools: one of each in the Bank, once per game

import { GameState } from '../../state/GameState.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { starterToolIds, toolOf } from '../../config/registries/toolKinds.js';
import { getGrid } from '../../config/registries/equipmentConstants.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { heldCount, holdsCopy } from './heldCopies.js';

/** Whether the guild owns any tool of `kind`: in the Bank or in a hero's hands. */
function ownsToolKind(kind, items) {
    const isKind = (id) => toolOf(items[id])?.kind === kind;
    const bank = GameState.state?.inventory?.items || {};
    if (Object.keys(bank).some(id => InventoryManager.hasItem(id, 1) && isKind(id))) return true;
    return (GameState.state?.heroes || []).some(hero =>
        getGrid(hero).some((id, slot) => id && holdsCopy(hero, slot) && isKind(id)));
}

/**
 * Put one of each starter tool (an item whose Tool is marked Starter) in the Bank, unless the guild
 * already owns one (in the Bank or in a hero's hands), once per starter: a new game at its opening,
 * a save from before tools were gear the first time it loads after, and a tool marked Starter later
 * on the next load. Without them no hero could gather, and with nothing gathered no tool could be
 * made.
 *
 * `progress.starterTools` lists every starter already given (or passed over), so each is given once.
 * ⚠️ `true` is a save from before the list: it got the starters of its day, which the list cannot
 * name, so it is given a starter only when the guild owns no tool of that kind at all.
 * ⚠️ It is set only once content has starter tools, so a save loaded before the content arrives
 * still gets them on a later load.
 *
 * @returns {string[]} the ids put in the Bank
 */
export function grantStarterTools() {
    const progress = GameState.state?.progress;
    if (!progress) return [];
    const items = getAllItems();
    const ids = starterToolIds(items);
    if (!ids.length) return [];
    const legacy = progress.starterTools === true;
    const record = Array.isArray(progress.starterTools) ? [...progress.starterTools] : [];
    const granted = [];
    for (const itemId of ids) {
        if (record.includes(itemId)) continue;
        record.push(itemId);
        if (legacy && ownsToolKind(toolOf(items[itemId])?.kind, items)) continue;
        if (InventoryManager.hasItem(itemId, 1) || heldCount(itemId) > 0) continue;
        if (InventoryManager.addItem(itemId, 1, 'opening') > 0) granted.push(itemId);
    }
    progress.starterTools = record;
    return granted;
}
