// Developer tools: engine-side helpers behind the QA panel (`ui/components/TestDashboard.jsx`),
// kept out of the component so they can be unit-tested and called from the console.

import { InventoryManager } from '../inventory/InventoryManager.js';
import { getAllItems, getItem } from '../../config/registries/itemRegistry.js';
import * as SpawnerSystem from '../board/SpawnerSystem.js';
import { addCoins } from '../inventory/Coins.js';
import { COIN_ITEM_ID } from '../../config/registries/coinCosts.js';

/**
 * Every live item id, sorted. Only `item_*` ids: the registry also holds
 * legacy ids without the prefix, which mask data bugs and are not what a test
 * should use.
 * @returns {string[]}
 */
export function listGivableItemIds() {
    return Object.keys(getAllItems())
        .filter(id => id.startsWith('item_'))
        .sort();
}

/**
 * Put `amount` of `itemId` into the Bank through `InventoryManager.addItem`,
 * the one real add path. Whatever the Bank cannot hold follows that path's
 * normal overflow (it becomes a sprite on the mat), so nothing is lost.
 *
 * @param {string} itemId
 * @param {number} amount - whole number, at least 1
 * @param {object} [deps] - injection seam for tests
 * Coins are the guild's whole number, not a Bank stack: giving them calls `addCoins`.
 * @returns {{ ok: boolean, added: number, overflow: number, coins?: boolean, error?: string }}
 *   `overflow` is the part that did not fit in the Bank and went to the mat.
 */
export function giveItem(itemId, amount, { inventory = InventoryManager } = {}) {
    const id = String(itemId ?? '').trim();
    const n = Math.floor(Number(amount));
    if (!id) return { ok: false, added: 0, overflow: 0, error: 'No item id given.' };
    if (!getItem(id)) return { ok: false, added: 0, overflow: 0, error: `Unknown item id: ${id}` };
    if (!Number.isFinite(n) || n < 1) {
        return { ok: false, added: 0, overflow: 0, error: 'Amount must be a whole number of at least 1.' };
    }

    if (id === COIN_ITEM_ID) {
        addCoins(n);
        return { ok: true, added: n, overflow: 0, coins: true };
    }

    const added = inventory.addItem(id, n, 'dev_give_item');
    return { ok: true, added, overflow: n - added };
}

/**
 * Live Spawner counts for the QA panel, as `[{ id, kind, count, cap }]`: one row per spawner on the
 * mat (`id` its instance id, `kind` its name and whether it counts its reach or its own). Empty
 * when there are no spawners, and the panel shows "No spawners yet".
 * @returns {Array<{ id: string, kind: string, count: number, cap: number }>}
 */
export function getSpawnerKindCounts() {
    return SpawnerSystem.familyCounts().map(({ id, kind, count, cap }) => ({ id, kind, count, cap }));
}