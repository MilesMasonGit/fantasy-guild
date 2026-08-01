import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import {
    GUILD_UPGRADES, UNIVERSAL_GRANT_UPGRADES, STATION_GRANT_UPGRADES,
    getUpgradeDef, getUpgradeCost, isUpgradeVisible
} from '../../config/guildUpgrades.js';
import { getOutposts, unlockOutpost } from '../loop/OutpostManager.js';
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

        // Area gating is a real rule, not just a UI filter (D-36) — otherwise
        // a stale screen or a console call could buy a node for a region the
        // player has never reached.
        const unlocked = GameState.state?.collection?.unlockedAreaSets || [];
        if (!isUpgradeVisible(def, unlocked)) {
            return { success: false, error: 'That area has not been unlocked yet' };
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
            state.inventory.maxStackBonus = (ranks.stack_size || 0) * 50;
            this._ensureBankTabs(state.inventory);
        }
        if (state.progress) {
            state.progress.rosterLimit = 5 + (ranks.roster_size || 0);
        }

        // The Card Binder's tab allowance used to mirror the bank's here.
        // Binder tabs are retired (D-41): card ownership is per area, so the
        // area IS the organisation and there is no pile left to file.
        // `bank_tabs` still drives the Bank's own tabs, above.

        // Universal cards (D-51): a node's rank IS how many copies you own,
        // so this recomputes rather than increments — the same reason every
        // other stat here is derived. C-12 reuses this for Outpost cards.
        // Outpost BANNERS first (D-21): unlocking one grants a card (D-35) by
        // bumping that card's node rank, so ownership below picks it up in the
        // same pass rather than lagging a recompute behind.
        this._ensureOutpostBanners(ranks);

        if (state.collection) {
            if (!state.collection.universals) state.collection.universals = {};
            for (const def of UNIVERSAL_GRANT_UPGRADES) {
                state.collection.universals[def.grantsUniversal] = ranks[def.id] || 0;
            }

            // Outpost cards (D-34/D-37): same mechanism one step out — the
            // tree is now the ONLY way to acquire a station card, so rank IS
            // ownership. Stations are neither universal nor area-scoped, so
            // they live in the legacy global `playsets` bucket.
            if (!state.collection.playsets) state.collection.playsets = {};
            for (const def of STATION_GRANT_UPGRADES) {
                state.collection.playsets[def.grantsStation] = ranks[def.id] || 0;
            }
        }

        EventBus.publish('inventory_updated');
        EventBus.publish('heroes_updated');
        EventBus.publish('collection_updated');
    },

    /**
     * Bring the Outpost banner count up to what the ranks say (D-21).
     *
     * Grow-only by design: unlike a numeric stat, a banner carries a hero, an
     * installed card and production progress, so "recompute" here means "top
     * up to", never "set to". Idempotent — safe on every load.
     */
    _ensureOutpostBanners(ranks) {
        if (!GameState.state) return;
        const node = GUILD_UPGRADES.find(u => u.grantsOutpostBanner);
        if (!node) return;

        const target = 1 + (ranks[node.id] || 0);   // 1 starting banner + ranks
        let guard = 0;
        while (getOutposts().length < target && guard++ < 16) {
            unlockOutpost(this._grantCardWithBanner(ranks, node.grantsCardOnUnlock));
        }
    },

    /**
     * The free card that comes with a new banner (D-35), granted by bumping
     * that card's own node RANK rather than installing a bare copy.
     *
     * Rank is the single source of truth for ownership, so installing a card
     * outside it would leave the player holding something `playsets` says they
     * don't own — allocations would read `owned: 0, slotted: 1`. Going through
     * rank also means the free copy shows up in the tree as owned, which is
     * what the player would expect.
     *
     * @returns {string|null} the card id to install, or null if none is free.
     */
    _grantCardWithBanner(ranks, cardId) {
        if (!cardId) return null;
        const grantNode = STATION_GRANT_UPGRADES.find(u => u.grantsStation === cardId);
        if (!grantNode) return cardId;   // not a tree-granted card; install as-is

        const rank = ranks[grantNode.id] || 0;
        if (rank >= grantNode.maxRank) {
            // Already maxed — hand over a banner with nothing pre-installed
            // rather than minting an over-cap copy.
            return null;
        }
        ranks[grantNode.id] = rank + 1;
        return cardId;
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
        const unlocked = GameState.state?.collection?.unlockedAreaSets || [];
        return GUILD_UPGRADES
            .filter(def => isUpgradeVisible(def, unlocked))
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
                    // Which tree section this belongs in. Universal cards and
                    // Outpost cards are both rank-grants, but they are
                    // different systems and must not read as one list.
                    category: def.grantsStation ? 'outpost'
                        : def.grantsUniversal ? 'universal'
                        : 'capacity',
                    // Owned copies must be legible in the tree (D-37's cost).
                    grantsCard: def.grantsStation || def.grantsUniversal || null,
                    ownedCopies: (def.grantsStation || def.grantsUniversal) ? rank : null
                };
            });
    }
};

export default GuildUpgradeManager;
