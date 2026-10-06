import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import {
    GUILD_UPGRADES, getUpgradeDef, getUpgradePrice, totalPrice, isUpgradeAccessible, getLockReason,
    rosterLimitForRank
} from '../../config/guildUpgrades.js';
import { generateHero } from '../hero/HeroGenerator.js';
import { rehydrateHero } from '../hero/logic/HeroRehydration.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as TileModifiers from '../board/TileModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { logger } from '../../utils/Logger.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * GuildUpgradeManager — the Guild Hall upgrade web.
 *
 * Ranks persist in `state.progress.guildUpgrades` ({ upgradeId: rank }); every
 * derived stat is RECOMPUTED from ranks in `recompute()`.
 */
export const GuildUpgradeManager = {
    init() {
        EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => this.recompute());
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

    /** Whether an upgrade's node is open on the web: a linked node bought, or linked to the Hall. */
    isAccessible(upgradeId) {
        const def = getUpgradeDef(upgradeId);
        if (!def) return false;
        return isUpgradeAccessible(def.id, this.getRanks());
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
        const def = getUpgradeDef(upgradeId);
        if (!def) return { success: false, error: 'Unknown upgrade' };

        const ranks = this.getRanks();
        if (!isUpgradeAccessible(def.id, ranks)) {
            const reason = getLockReason(def.id, ranks);
            return { success: false, error: reason || 'That upgrade is locked' };
        }

        const rank = this.getRank(upgradeId);
        if (rank >= def.maxRank) return { success: false, error: 'Already at max rank' };

        const price = getUpgradePrice(def, rank) || [];
        const paid = this._payItems(price);
        if (!paid.success) return paid;

        const newRank = rank + 1;
        ranks[upgradeId] = newRank;
        this.recompute();

        // Roster size upgrade immediately recruits a new hero
        if (upgradeId === 'roster_size') {
            const hero = generateHero();
            rehydrateHero(hero);
            GameState.heroes.push(hero);
            NotificationSystem.success(`New Hero Recruited: ${hero.name}! (${def.name} Level ${newRank})`);
            EventBus.publish(ENGINE_EVENTS.HERO_RECRUITED, {
                heroId: hero.id,
                name: hero.name
            });
        } else {
            NotificationSystem.success(`${def.name} upgraded — ${def.statLabel(newRank)}`);
        }

        EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, { upgradeId, rank: newRank });
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
        logger.info('GuildUpgradeManager', `Purchased ${upgradeId} rank ${newRank} for ${price.map(p => `${p.quantity}x ${p.itemId}`).join(', ') || 'free'}`);
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
            // One definition, in `guildUpgrades.js`; `HeroLifecycle` falls back to
            // the same function when a save has no rosterLimit written yet.
            state.progress.rosterLimit = rosterLimitForRank(ranks.roster_size);
            state.progress.flagRadiusBonus = (ranks.flag_radius || 0) * 40;
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
            inv.groupDefs[id] = { id, title: `Tab ${inv.groupOrder.length + 1}`, isCustom: false, orderedItems: [] };
            inv.groupOrder.push(id);
        }
    },

    getDisplayList() {
        return GUILD_UPGRADES.map(def => {
            const rank = this.getRank(def.id);
            const accessible = isUpgradeAccessible(def.id, this.getRanks());
            return {
                id: def.id,
                name: def.name,
                description: def.description,
                rank,
                maxRank: def.maxRank,
                maxed: rank >= def.maxRank,
                accessible,
                cost: getUpgradePrice(def, rank),
                canAfford: this.canAfford(def.id),
                statLabel: def.statLabel(rank),
                sprite: def.sprite
            };
        });
    }
};

export default GuildUpgradeManager;
