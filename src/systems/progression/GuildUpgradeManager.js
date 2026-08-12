import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import {
    GUILD_UPGRADES, getUpgradeDef, getUpgradeCost, isUpgradeVisible
} from '../../config/guildUpgrades.js';
import { BASE_TOKEN_BANK_SLOTS, SLOTS_PER_RANK } from '../board/TokenBank.js';
import { logger } from '../../utils/Logger.js';

/**
 * GuildUpgradeManager — the upgrade tree installed on the Guild Hall tile, the
 * permanent centre of the 7×7 board (D-106).
 *
 * Ranks persist in `state.progress.guildUpgrades` ({ upgradeId: rank }); every
 * derived stat is **RECOMPUTED from ranks** (on purchase and on every load)
 * rather than incremented, so saves can never drift and rank-0 equals the
 * game's defaults:
 *   bank_tabs        -> inventory.maxTabs      (5 + rank)
 *   bank_slots       -> inventory.maxSlots     (20 + 10·rank)
 *   token_bank_slots -> board.tokenBankSlots   (12 + 4·rank)
 *   token_bank_tabs  -> board.tokenTabsUnlocked (5 + rank)
 *   roster_size      -> progress.rosterLimit   (5 + rank)
 *
 * That recompute-don't-increment discipline is the reason this survived the
 * playmat rework intact while most of its *content* did not — keep it for any
 * track added later.
 *
 * ## Two of §11's four tracks (G-10)
 * **Storage** (three lines: item tabs, item slots, Token Vault slots) and
 * **Roster**. Aura and Economy stay deferred — Aura is no longer *blocked*,
 * since Phase 5's adjacency work gives it a delivery path, so it is a small
 * later addition rather than a new system.
 *
 * ## Trimmed in Phase 1 §G (decision G-10)
 * Removed with the deck loop: Outpost banner creation (`_ensureOutpostBanners`,
 * `_grantCardWithBanner`), the `collection.universals` / `collection.playsets`
 * rank-grant writes, the `stack_size` stat, and the `unlockedAreaSets` gate on
 * purchase.
 *
 * Gold-only costs; curves are placeholders in config/guildUpgrades.js.
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

        // Every remaining node is global, so this always passes. Kept as a real
        // check rather than deleted: it was a genuine rule (not just a UI
        // filter) and any future gated track — Aura, Economy — will want it
        // back rather than reinventing it.
        if (!isUpgradeVisible(def)) {
            return { success: false, error: 'That upgrade is not available yet' };
        }

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
            this._ensureBankTabs(state.inventory);
        }
        if (state.progress) {
            state.progress.rosterLimit = 5 + (ranks.roster_size || 0);
        }
        if (state.board) {
            // The Token Bank's slot cap — D-137's second Storage line, kept as
            // an independent track because a player can be short of Token
            // variety while having item slots to spare, and vice versa.
            // ⚠️ Slots are capacity; `token_bank_tabs` below is organisation.
            state.board.tokenBankSlots =
                BASE_TOKEN_BANK_SLOTS + (ranks.token_bank_slots || 0) * SLOTS_PER_RANK;

            // The Vault's tab count (D-243). `TokenGroups.pad()` grows the strip
            // to match on its next read — no separate padding step here, unlike
            // `_ensureBankTabs`, because the Token strip repairs itself on read.
            state.board.tokenTabsUnlocked = 5 + (ranks.token_bank_tabs || 0);
        }

        // `maxStackBonus` is no longer written: the `stack_size` node is retired
        // (Phase 1 §G). It added +50 to a ceiling of 1e12, and D-137 says stacks
        // are never capped anyway. The field stays in the schema, at 0, so old
        // reads are harmless.

        EventBus.publish('token_bank_updated');
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

    /**
     * For the Guild Hall screen: every VISIBLE upgrade with live rank/cost
     * data. Nodes gated behind an unowned area are omitted entirely (D-36) —
     * the player shouldn't see an Alchemist Lab before the region exists.
     */
    getDisplayList() {
        return GUILD_UPGRADES
            .filter(def => isUpgradeVisible(def))
            .map(def => {
                const rank = this.getRank(def.id);
                return {
                    id: def.id,
                    name: def.name,
                    description: def.description,
                    rank,
                    maxRank: def.maxRank,
                    maxed: rank >= def.maxRank,
                    cost: rank >= def.maxRank ? null : getUpgradeCost(def, rank),
                    statLabel: def.statLabel(rank),
                    // Every surviving node is a capacity stat. The 'outpost' and
                    // 'universal' sections were card-grant trees and went with
                    // the deck loop; Aura and Economy will add sections here.
                    category: 'capacity'
                };
            });
    }
};

export default GuildUpgradeManager;
