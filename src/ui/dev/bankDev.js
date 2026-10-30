// The QA panel's Bank checks: Bank Tabs ranks, a Bank of every kind, an older save with Bank Slots.
// ⚠️ DEV BUILDS ONLY: reached from `BankDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { GameState } from '../../state/GameState.js';
import { SaveManager } from '../../systems/core/SaveManager.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';

/** Write a Bank Tabs rank straight into the save: a dev convenience, not a purchase. */
export function devSetBankTabs(rank) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.bank_tabs = rank;
    GuildUpgradeManager.recompute();
    EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});
}

/**
 * One of every item kind the content has, into the Bank, as far as its slots go.
 * @returns {{added: number, left: number}} kinds added, and kinds that found no slot
 */
export function devBankEveryKind() {
    let added = 0;
    let left = 0;
    InventoryManager.batch(() => {
        for (const item of Object.values(getAllItems())) {
            if (!item?.id || InventoryManager.getItemCount(item.id) > 0) continue;
            if (InventoryManager.lacksSlotFor(item.id)) { left++; continue; }
            if (InventoryManager.addItem(item.id, 1, 'dev') > 0) added++;
        }
    });
    return { added, left };
}

/**
 * A save written as one from before each tab held 64 kinds: Bank Slots rank 3, one Bank Tabs
 * rank, and every item kind filed in the first tab. Loading it drops the Bank Slots ranks, fills the
 * second tab from the first, and keeps the rest in the first tab until moved.
 * @param {object} data a whole save, as `GameState.serializeJson` writes it (changed in place)
 * @returns {number} the kinds the save's Bank holds
 */
export function bankSlotsOldStyle(data) {
    const { state } = data;
    state.progress.guildUpgrades = { ...(state.progress.guildUpgrades || {}), bank_slots: 3, bank_tabs: 1 };
    const inv = state.inventory;
    inv.maxSlots = 64 + 3 * 32;
    inv.maxTabs = 2;
    inv.itemOverrides = {};
    for (const id of (inv.groupOrder || []).slice(2)) delete inv.groupDefs[id];
    inv.groupOrder = (inv.groupOrder || []).slice(0, 2);
    for (const def of Object.values(inv.groupDefs || {})) def.orderedItems = [];
    for (const item of Object.values(getAllItems())) {
        if (item?.id && !inv.items[item.id]) inv.items[item.id] = { quantity: 1, dur: null };
    }
    return Object.keys(inv.items).length;
}

/**
 * ⚠️ Rewrites the save in the slot being played, then reloads into it the way a load does.
 * @returns {{ok: boolean, error?: string}}
 */
export function devOldBankSlotsSave() {
    const slot = SaveManager.getCurrentSlot();
    if (slot === null || !GameState.getIsInitialized()) return { ok: false, error: 'No game is open' };
    const data = JSON.parse(GameState.serializeJson());
    bankSlotsOldStyle(data);
    return SaveManager.restoreAndReload(slot, JSON.stringify(data))
        ? { ok: true }
        : { ok: false, error: 'The save could not be written' };
}
