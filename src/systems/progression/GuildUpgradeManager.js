import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import {
    GUILD_UPGRADES, getUpgradeDef, getUpgradeCost, isTileAccessible, getLockReason,
    ROSTER_BASE
} from '../../config/guildUpgrades.js';
import { BASE_TOKEN_BANK_SLOTS, SLOTS_PER_RANK } from '../board/TokenBank.js';
import { generateHero } from '../hero/HeroGenerator.js';
import { rehydrateHero } from '../hero/logic/HeroRehydration.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as TileModifiers from '../board/TileModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { logger } from '../../utils/Logger.js';

/**
 * GuildUpgradeManager — the upgrade tree installed on the 7×7 Guild Hall playmat.
 *
 * Ranks persist in `state.progress.guildUpgrades` ({ upgradeId: rank }); every
 * derived stat is RECOMPUTED from ranks:
 *   bank_tabs        -> inventory.maxTabs      (5 + rank)
 *   bank_slots       -> inventory.maxSlots     (20 + 10·rank)
 *   token_bank_slots -> board.tokenBankSlots   (12 + 4·rank)
 *   token_bank_tabs  -> board.tokenTabsUnlocked (5 + rank)
 *   roster_size      -> progress.rosterLimit   (5 + rank, capped at 12 by D-251)
 */
export const GuildUpgradeManager = {
    init() {
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
        const ranks = this.getRanks();
        if (upgradeId === 'wishing_well' || upgradeId === 'guildmasters_banner') {
            return ranks.wishing_well ?? ranks.guildmasters_banner ?? 0;
        }
        return ranks[upgradeId] || 0;
    },

    /** Check if an upgrade node is accessible by its tile adjacency. */
    isAccessible(upgradeId) {
        const def = getUpgradeDef(upgradeId);
        if (!def || def.tileIndex == null) return false;
        return isTileAccessible(def.tileIndex, this.getRanks());
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

        const ranks = this.getRanks();
        if (def.tileIndex != null && !isTileAccessible(def.tileIndex, ranks)) {
            const reason = getLockReason(def.tileIndex, ranks);
            return { success: false, error: reason || 'That upgrade is locked' };
        }

        const rank = this.getRank(upgradeId);
        if (rank >= def.maxRank) return { success: false, error: 'Already at max rank' };

        const cost = getUpgradeCost(def, rank);
        if (cost > 0) {
            if (!CurrencyManager.spendGold(cost, `Guild Upgrade: ${def.name}`)) {
                return { success: false, error: `Not enough gold (${cost} needed)` };
            }
        }

        const newRank = rank + 1;
        ranks[upgradeId] = newRank;
        this.recompute();

        // Roster size upgrade immediately recruits a new hero
        if (upgradeId === 'roster_size') {
            const hero = generateHero();
            rehydrateHero(hero);
            GameState.heroes.push(hero);
            NotificationSystem.success(`New Hero Recruited: ${hero.name}! (${def.name} Level ${newRank})`);
            EventBus.publish('hero_recruited', {
                heroId: hero.id,
                name: hero.name
            });
        } else {
            NotificationSystem.success(`${def.name} upgraded — ${def.statLabel(newRank)}`);
        }

        EventBus.publish('guild_upgrades_updated', { upgradeId, rank: newRank });
        EventBus.publish('state_changed');
        logger.info('GuildUpgradeManager', `Purchased ${upgradeId} rank ${newRank} for ${cost}g`);
        return { success: true };
    },

    /** Write every rank-derived stat. Idempotent; safe on load and rank 0. */
    recompute() {
        const state = GameState.state;
        if (!state) return;
        const ranks = this.getRanks();

        if (state.inventory) {
            state.inventory.maxTabs = 1 + (ranks.bank_tabs || 0);
            state.inventory.maxSlots = 64 + (ranks.bank_slots || 0) * 32;
            this._ensureBankTabs(state.inventory);
        }
        if (state.progress) {
            // D-251 pins the roster at twelve: ROSTER_BASE starting heroes plus
            // the track's 7 ranks. This used to read `Math.max(1, rank)`, which
            // both started a fresh guild at 1 hero instead of 5 and topped out
            // at the wrong number.
            state.progress.rosterLimit = ROSTER_BASE + (ranks.roster_size || 0);
        }
        if (state.board) {
            state.board.tokenBankSlots =
                BASE_TOKEN_BANK_SLOTS + (ranks.token_bank_slots || 0) * SLOTS_PER_RANK;
            state.board.tokenTabsUnlocked = 1 + (ranks.token_bank_tabs || 0);
        }

        // Synchronize dynamic production for Guild Hall token
        const wishingWellRank = ranks.wishing_well ?? ranks.guildmasters_banner ?? 0;
        const guildHallDef = getTokenType('token_guild_hall');
        if (guildHallDef) {
            guildHallDef.statements = [];
            if (wishingWellRank > 0) {
                guildHallDef.tokenType = 'resource';
                guildHallDef.requiresHero = true;
                guildHallDef.config = {
                    skill: null,
                    skillRequired: 0,
                    cycleTimeMs: 10000,
                    xp: 0,
                    inputs: [],
                    outputs: [
                        {
                            itemId: 'item_water',
                            chance: 100,
                            minQty: wishingWellRank,
                            maxQty: wishingWellRank
                        }
                    ]
                };
            } else {
                guildHallDef.config = null;
            }
            TileModifiers.rebuildAll();
        }

        EventBus.publish('token_bank_updated');
        EventBus.publish('inventory_updated');
        EventBus.publish('heroes_updated');
        // `collection_updated` was published here to nobody and was deleted on
        // 2026-08-24 (CR2-092). `guild_upgrades_updated` is the one the UI and
        // the quest system actually listen for.
    },

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

    getDisplayList() {
        return GUILD_UPGRADES.map(def => {
            const rank = this.getRank(def.id);
            const accessible = def.tileIndex != null ? isTileAccessible(def.tileIndex, this.getRanks()) : true;
            return {
                id: def.id,
                name: def.name,
                description: def.description,
                tileIndex: def.tileIndex,
                rank,
                maxRank: def.maxRank,
                maxed: rank >= def.maxRank,
                accessible,
                cost: rank >= def.maxRank ? null : getUpgradeCost(def, rank),
                statLabel: def.statLabel(rank),
                sprite: def.sprite
            };
        });
    }
};

export default GuildUpgradeManager;
