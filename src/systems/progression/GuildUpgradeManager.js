import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import {
    GUILD_UPGRADES, getUpgradeDef, getUpgradeCost, isTileAccessible, getLockReason,
    rosterLimitForRank
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
 *   bank_tabs        -> inventory.maxTabs      (1 + rank)
 *   bank_slots       -> inventory.maxSlots     (64 + 32·rank)
 *   token_bank_slots -> board.tokenBankSlots   (BASE + SLOTS_PER_RANK·rank)
 *   token_bank_tabs  -> board.tokenTabsUnlocked (1 + rank)
 *   roster_size      -> progress.rosterLimit   (rosterLimitForRank(rank), 12 by D-251)
 *
 * (The five figures above were all wrong until 2026-08-25 — they described an
 * older cost curve. Read `recompute()` below, not this list.)
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
            // One definition, in `guildUpgrades.js` (CR2-193) — `HeroLifecycle`
            // falls back to the same function when a save has no rosterLimit
            // written yet. D-251 pins the cap at twelve: ROSTER_BASE (0) plus
            // the roster_size track's 12 ranks.
            state.progress.rosterLimit = rosterLimitForRank(ranks.roster_size);
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

    /**
     * The ONLY way a Bank tab comes into existence (owner ruling 2026-08-25).
     * Buying `bank_tabs` raises `maxTabs`; this tops `groupOrder` back up to it,
     * so the new tab appears the moment the upgrade is bought. Players cannot
     * create, name, delete or reorder tabs — the code that offered that was
     * unreachable and was removed from `InventoryManager` (CR2-089).
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
