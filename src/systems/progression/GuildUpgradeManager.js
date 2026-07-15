import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { GUILD_UPGRADES, getUpgradeDef, getUpgradeCost } from '../../config/guildUpgrades.js';
import { logger } from '../../utils/Logger.js';

/**
 * GuildUpgradeManager — the Guild Hall's global upgrade tree
 * (UI overhaul Phase 4, spec §COMP-GUILD).
 *
 * Ranks persist in `state.progress.guildUpgrades` ({ upgradeId: rank });
 * every derived stat is RECOMPUTED from ranks (on purchase and on every
 * load) rather than incremented, so saves can never drift and rank-0
 * equals the game's existing defaults:
 *   bank_tabs   -> inventory.maxTabs        (5 + rank; owner design 2026-07-14)
 *   bank_slots  -> inventory.maxSlots       (20 + 10·rank)
 *   stack_size  -> inventory.maxStackBonus  (50·rank)
 *   roster_size -> progress.rosterLimit     (5 + rank)
 *
 * Gold-only costs (owner decision 2026-07-11); curves are placeholders in
 * config/guildUpgrades.js awaiting balancing.
 */
export const GuildUpgradeManager = {
    init() {
        // Reapply rank-derived stats whenever a save finishes loading.
        EventBus.subscribe('game_loaded', () => this.recompute());
        logger.info('GuildUpgradeManager', 'Guild upgrade tree ready');
    },

    getRanks() {
        const progress = GameState.state?.progress;
        if (!progress) return {};
        if (!progress.guildUpgrades) progress.guildUpgrades = {};
        return progress.guildUpgrades;
    },

    getRank(upgradeId) {
        return this.getRanks()[upgradeId] || 0;
    },

    /** Gold cost of the next rank, or null when maxed. */
    getNextCost(upgradeId) {
        const def = getUpgradeDef(upgradeId);
        if (!def) return null;
        const rank = this.getRank(upgradeId);
        return rank >= def.maxRank ? null : getUpgradeCost(def, rank);
    },

    /** Buy the next rank of an upgrade. Returns { success, error? }. */
    purchase(upgradeId) {
        const def = getUpgradeDef(upgradeId);
        if (!def) return { success: false, error: 'Unknown upgrade' };

        const rank = this.getRank(upgradeId);
        if (rank >= def.maxRank) return { success: false, error: 'Already at max rank' };

        const cost = getUpgradeCost(def, rank);
        if (!CurrencyManager.spendGold(cost, `Guild Upgrade: ${def.name}`)) {
            return { success: false, error: `Not enough gold (${cost} needed)` };
        }

        this.getRanks()[upgradeId] = rank + 1;
        this.recompute();
        NotificationSystem.success(`${def.name} upgraded — ${def.statLabel(rank + 1)}`);
        EventBus.publish('guild_upgrades_updated', { upgradeId, rank: rank + 1 });
        EventBus.publish('state_changed');
        logger.info('GuildUpgradeManager', `Purchased ${upgradeId} rank ${rank + 1} for ${cost}g`);
        return { success: true };
    },

    /** Write every rank-derived stat. Idempotent; safe on load and rank 0. */
    recompute() {
        const state = GameState.state;
        if (!state) return;
        const ranks = this.getRanks();

        if (state.inventory) {
            state.inventory.maxTabs = 5 + (ranks.bank_tabs || 0);
            state.inventory.maxSlots = 20 + (ranks.bank_slots || 0) * 10;
            state.inventory.maxStackBonus = (ranks.stack_size || 0) * 50;
            this._ensureBankTabs(state.inventory);
        }
        if (state.progress) {
            state.progress.rosterLimit = 5 + (ranks.roster_size || 0);
        }

        // Mirror the bank's tab allowance onto the Card Binder (same tab
        // system, one upgrade drives both — split later if it earns its
        // own node).
        if (state.collection?.binder) {
            state.collection.binder.maxTabs = 1 + (ranks.bank_tabs || 0);
        }

        EventBus.publish('inventory_updated');
        EventBus.publish('heroes_updated');
        EventBus.publish('collection_updated');
    },

    /**
     * Bank tabs are system-owned (owner design 2026-07-14): players never
     * create or delete them, so every unlocked tab slot must exist as a
     * group. Pads groupOrder/groupDefs up to maxTabs; idempotent.
     */
    _ensureBankTabs(inv) {
        if (!inv.groupOrder) inv.groupOrder = [];
        if (!inv.groupDefs) inv.groupDefs = {};
        let n = inv.groupOrder.length;
        while (inv.groupOrder.length < (inv.maxTabs || 0)) {
            n += 1;
            const id = `bank-tab-${n}`;
            if (inv.groupOrder.includes(id) || inv.groupDefs[id]) continue;
            inv.groupDefs[id] = { id, title: `Tab ${inv.groupOrder.length + 1}`, isCustom: false, orderedItems: [] };
            inv.groupOrder.push(id);
        }
    },

    /** For the Guild Hall screen: every upgrade with live rank/cost data. */
    getDisplayList() {
        return GUILD_UPGRADES.map(def => {
            const rank = this.getRank(def.id);
            return {
                id: def.id,
                name: def.name,
                description: def.description,
                rank,
                maxRank: def.maxRank,
                maxed: rank >= def.maxRank,
                cost: rank >= def.maxRank ? null : getUpgradeCost(def, rank),
                statLabel: def.statLabel(rank)
            };
        });
    }
};

export default GuildUpgradeManager;
