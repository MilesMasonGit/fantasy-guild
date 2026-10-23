// the starter tools: one of each in the Bank, once per game

import { GameState } from '../../state/GameState.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { starterToolIds } from '../../config/registries/toolKinds.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { heldCount } from './heldCopies.js';

/**
 * Put one of each starter tool (an item whose Tool is marked Starter) in the Bank, unless the guild
 * already owns one (in the Bank or in a hero's hands), once per game: a new game at its opening,
 * and a save from before tools were gear the first time it loads after. Without them no hero could
 * gather, and with nothing gathered no tool could be made.
 *
 * ⚠️ `progress.starterTools` is set only once content has starter tools, so a save loaded before
 * the content arrives still gets them on a later load.
 *
 * @returns {string[]} the ids put in the Bank
 */
export function grantStarterTools() {
    const progress = GameState.state?.progress;
    if (!progress || progress.starterTools === true) return [];
    const ids = starterToolIds(getAllItems());
    if (!ids.length) return [];
    const granted = [];
    for (const itemId of ids) {
        if (InventoryManager.hasItem(itemId, 1) || heldCount(itemId) > 0) continue;
        if (InventoryManager.addItem(itemId, 1, 'opening') > 0) granted.push(itemId);
    }
    progress.starterTools = true;
    return granted;
}
