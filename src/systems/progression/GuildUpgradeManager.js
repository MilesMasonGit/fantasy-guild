import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import {
    getUpgradeDef, getUpgradePrice, totalPrice, isUpgradeAccessible, getLockReason,
    rosterLimitForRank, BANK_TAB_SLOTS, BANK_TAB_CAP
} from '../../config/guildUpgrades.js';
// Loads the authored stars into the sky (`data/hallStars.json`) before anything reads it.
import '../../config/registries/hallStarRegistry.js';
import { createHero } from '../hero/logic/HeroLifecycle.js';
import * as HallRules from './HallRules.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * GuildUpgradeManager — the Guild Hall upgrade web.
 *
 * Ranks persist in `state.progress.guildUpgrades` ({ upgradeId: rank }); every
 * derived stat is RECOMPUTED from ranks in `recompute()`, the authored stars' rules included
 * (`HallRules`).
 */
export const GuildUpgradeManager = {
    init() {
        EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => this.recompute());
        HallRules.init();
        logger.info('GuildUpgradeManager', 'Guild upgrade tree ready');
    },

    getRanks() {
        const progress = GameState.state?.progress;
        if (!progress) return {};
        if (!progress.guildUpgrades) progress.guildUpgrades = {};
        return progress.guildUpgrades;
    },

    getRank(upgradeId) {
        const ranks = this.getRanks();
        if (upgradeId === 'wishing_well' || upgradeId === 'guildmasters_banner') {
            return ranks.wishing_well ?? ranks.guildmasters_banner ?? 0;
        }
        return ranks[upgradeId] || 0;
    },

    /**
     * Item price of the next rank as `[{ itemId, quantity }]` (`[]` = free),
     * or null when maxed. Hall upgrades cost items, never gold.
     */
    getNextCost(upgradeId) {
        const def = getUpgradeDef(upgradeId);
        if (!def) return null;
        return getUpgradePrice(def, this.getRank(upgradeId));
    },

    /**
     * What the Bank is short of for a price: `[{ itemId, name, needed, have }]`,
     * empty when it can pay in full.
     */
    getShortfall(price) {
        return totalPrice(price)
            .map(({ itemId, quantity }) => ({
                itemId,
                name: getItem(itemId)?.name || itemId,
                needed: quantity,
                have: InventoryManager.getItemCount(itemId)
            }))
            .filter(s => s.have < s.needed);
    },

    /** True when the next rank is buyable right now with what the Bank holds. */
    canAfford(upgradeId) {
        const price = this.getNextCost(upgradeId);
        return price != null && this.getShortfall(price).length === 0;
    },

    /**
     * Take a whole price out of the Bank, all or nothing. Checks every item
     * first; if a removal still fails part-way, the items already taken are
     * put back. Returns { success, error? }.
     */
    _payItems(price) {
        const shortfall = this.getShortfall(price);
        if (shortfall.length > 0) {
            const list = shortfall
                .map(s => `${s.needed} ${s.name} (have ${s.have})`)
                .join(', ');
            return { success: false, error: `Not enough items: need ${list}` };
        }
        const taken = [];
        for (const { itemId, quantity } of totalPrice(price)) {
            if (!InventoryManager.removeItem(itemId, quantity)) {
                taken.forEach(t => InventoryManager.addItem(t.itemId, t.quantity));
                return { success: false, error: `Could not take ${quantity} ${getItem(itemId)?.name || itemId} from the Bank` };
            }
            taken.push({ itemId, quantity });
        }
        return { success: true };
    },

    /** Buy the next rank of an upgrade. Returns { success, error? }. */
    purchase(upgradeId) {
        return this.purchaseRanks(upgradeId, 1);
    },

    /**
     * The combined price of the next `count` ranks, merged per item, or null when fewer than
     * `count` ranks are left. `count` 1 is the next rank's own price.
     */
    getRanksCost(upgradeId, count = 1) {
        const def = getUpgradeDef(upgradeId);
        const n = Math.floor(Number(count) || 0);
        if (!def || n < 1) return null;
        const rank = this.getRank(upgradeId);
        if (rank + n > def.maxRank) return null;
        const parts = [];
        for (let r = rank; r < rank + n; r++) parts.push(...(getUpgradePrice(def, r) || []));
        return totalPrice(parts);
    },

    /**
     * Buy the next `count` ranks of an upgrade at once, all or nothing: the same Bank, ranks and
     * rules as `count` single buys, paid as one price, written as one rank change and announced
     * by one `GUILD_UPGRADES_UPDATED` ({ upgradeId, rank, fromRank, count }), so the sky plays
     * one ceremony and listeners that count purchases read `count`. Returns { success, error? }.
     */
    purchaseRanks(upgradeId, count = 1) {
        const def = getUpgradeDef(upgradeId);
        if (!def) return { success: false, error: 'Unknown upgrade' };
        const n = Math.floor(Number(count) || 0);
        if (n < 1) return { success: false, error: 'No ranks to buy' };

        const ranks = this.getRanks();
        const rank = this.getRank(upgradeId);
        // Each step is asked as a single buy would ask it: a gate may read the star's own rank.
        for (let r = rank; r < rank + n && r < def.maxRank; r++) {
            const at = { ...ranks, [def.id]: r };
            if (!isUpgradeAccessible(def.id, at)) {
                const reason = getLockReason(def.id, at);
                return { success: false, error: reason || 'That upgrade is locked' };
            }
        }

        if (rank >= def.maxRank) return { success: false, error: 'Already at max rank' };
        if (rank + n > def.maxRank) return { success: false, error: `Only ${def.maxRank - rank} ranks left` };

        const price = this.getRanksCost(upgradeId, n) || [];
        const paid = this._payItems(price);
        if (!paid.success) return paid;

        const newRank = rank + n;
        ranks[upgradeId] = newRank;
        this.recompute();

        // Each Roster Size rank immediately recruits a new hero.
        if (upgradeId === 'roster_size') for (let i = 0; i < n; i++) createHero();

        EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId, rank: newRank, fromRank: rank, count: n });
        logger.info('GuildUpgradeManager', `Purchased ${upgradeId} rank ${n > 1 ? `${rank + 1}-` : ''}${newRank} for ${price.map(p => `${p.quantity}x ${p.itemId}`).join(', ') || 'free'}`);
        return { success: true };
    },

    /** Write every rank-derived stat. Idempotent; safe on load and rank 0. */
    recompute() {
        const state = GameState.state;
        if (!state) return;
        const ranks = this.getRanks();

        if (state.inventory) {
            state.inventory.maxTabs = Math.min(BANK_TAB_CAP, 1 + (ranks.bank_tabs || 0));
            state.inventory.maxSlots = state.inventory.maxTabs * BANK_TAB_SLOTS;
            this._ensureBankTabs(state.inventory);
            InventoryManager.spillOverfullTabs();
        }
        if (state.progress) {
            // One definition, in `guildUpgrades.js`; `HeroLifecycle` falls back to
            // the same function when a save has no rosterLimit written yet.
            state.progress.rosterLimit = rosterLimitForRank(ranks.roster_size);
        }
        HallRules.apply(ranks);

        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED);
    },

    /**
     * The ONLY way a Bank tab comes into existence. Buying `bank_tabs` raises
     * `maxTabs`; this tops `groupOrder` back up to it, so the new tab appears the
     * moment the upgrade is bought.
     */
    _ensureBankTabs(inv) {
        if (!inv.groupOrder) inv.groupOrder = [];
        if (!inv.groupDefs) inv.groupDefs = {};
        let n = inv.groupOrder.length;
        while (inv.groupOrder.length < (inv.maxTabs || 0)) {
            n += 1;
            const id = `bank-tab-${n}`;
            if (inv.groupOrder.includes(id) || inv.groupDefs[id]) continue;
            inv.groupDefs[id] = { id, title: `Tab ${inv.groupOrder.length + 1}`, orderedItems: [] };
            inv.groupOrder.push(id);
        }
    }
};
