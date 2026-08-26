// Fantasy Guild - Loot System
// Phase 31: Combat System - Loot Generation (Cluster-Based Evolution)

import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { warnMissingContent } from '../../utils/missingContent.js';
import { randomInt } from '../../utils/RNG.js';
import * as TransactionProcessor from '../economy/TransactionProcessor.js';
import { getYieldMultiplier } from '../effects/StatusEffectSystem.js';
import { resolveYield } from '../effects/EffectAxes.js';
import * as SpriteLayer from '../board/SpriteLayer.js';

/**
 * Scale a drop quantity by a yield multiplier (Cookout-style buffs) with
 * probabilistic rounding: qty 1 × 1.2 → 1, plus a 20% chance of +1.
 */
function scaleYield(quantity, multiplier) {
    if (!multiplier || multiplier === 1) return quantity;
    const scaled = (quantity || 1) * multiplier;
    const whole = Math.floor(scaled);
    return whole + (Math.random() < (scaled - whole) ? 1 : 0);
}

/**
 * LootSystem - Evolved for Cluster-Based mutually exclusive rewards.
 * 
 * Each table contains one or more "Clusters."
 * For each cluster, the system picks EXACTLY one item (or none if chance sum < 100).
 */
const LootSystem = {
    initialized: false,

    init() {
        if (this.initialized) return;
        EventBus.subscribe('combat_victory', (data) => this.handleCombatVictory(data));
        this.initialized = true;
        logger.info('LootSystem', 'Loot system initialized');
    },

    /**
     * Handle combat victory - Selective Source Processing
     */
    handleCombatVictory(data) {
        const { cardId, heroId, enemyId, enemyName, drops, areaId, tile } = data;

        // Source Resolution. An enemy's rewards are its inline `drops[]` and
        // nothing else — the card-era `dropTableId` lookup was deleted on
        // 2026-08-24 (CR2-116); no enemy ever carried that field, so it only
        // ever resolved to null.
        const sourceData = (Array.isArray(drops) && drops.length > 0) ? { drops } : null;

        if (!sourceData) {
            EventBus.publish('loot_generated', { cardId, heroId, enemyId, enemyName, drops: [] });
            return;
        }

        const generatedDrops = this.generateDrops(sourceData, areaId);

        if (generatedDrops.length > 0) {
            if (tile != null) {
                // On the BOARD, loot drops as floating sprites where the kill
                // happened (D-40) — it is not banked until collected. Routing
                // combat loot straight into the Bank would make kills the one
                // thing on the board that skips the sprite layer, and would
                // quietly bypass D-138's "nothing is ever lost" guarantee.
                for (const drop of generatedDrops) {
                    SpriteLayer.addSprite('item', drop.itemId, drop.quantity, tile);
                }
            } else {
                TransactionProcessor.apply({
                    entries: generatedDrops.map(d => ({ type: 'ITEM', id: d.itemId, amount: d.quantity })),
                    source: `Loot (${enemyName})`
                }, heroId, enemyId);
            }
        }

        EventBus.publish('loot_generated', { cardId, heroId, enemyId, enemyName, tile, drops: generatedDrops });
    },

    /**
     * Universal Reward Orchestrator (Used by Task Cards)
     */
    handleTaskReward(card, outputs) {
        if (!outputs || !Array.isArray(outputs) || outputs.length === 0) return null;

        const areaId = card.areaId || card.config?.areaId || 'area_guild_hall';
        
        // Wrap task outputs in a single cluster for "Pick One" behavior
        const generatedDrops = this.generateDrops({ drops: outputs }, areaId);

        const itemDrops = generatedDrops.filter(d => d && d.type !== 'combat_trigger');
        const combatTrigger = generatedDrops.find(d => d && d.type === 'combat_trigger');

        if (itemDrops.length > 0) {
            // Yield buffs (Cookout) scale task outputs for the working hero…
            const yieldMult = getYieldMultiplier(card.assignedHeroId);
            // …and stamped Token YIELD (§15.8, Phase 5) scales the base quantity
            // first, through the full Three-Bucket formula. resolveYield keeps
            // the fractional result so scaleYield's probabilistic rounding
            // applies once, at the end, over both sources combined.
            TransactionProcessor.apply({
                entries: itemDrops.map(d => ({
                    type: 'ITEM',
                    id: d.itemId,
                    amount: scaleYield(resolveYield(card.aggregator, d.quantity), yieldMult)
                })),
                source: `Task (${card.name})`
            }, null, card.templateId);
        }

        EventBus.publish('loot_generated', { cardId: card.id, areaId, drops: generatedDrops });

        if (combatTrigger) {
            return { type: 'combat_trigger', enemyId: combatTrigger.enemyId };
        }
        return null;
    },

    /**
     * Polymorphic Drop Generator
     * Handles New Architecture (clusters) and Legacy Architecture (flat drops)
     */
    generateDrops(source, areaId) {
        const results = [];
        
        if (source.clusters && Array.isArray(source.clusters)) {
            // New Multi-Cluster Pattern
            for (const cluster of source.clusters) {
                const drop = this._processCluster(cluster, areaId);
                if (drop) results.push(drop);
            }
        } 
        else if (source.drops && Array.isArray(source.drops)) {
            // Legacy/Task Cluster (Treated as 1 group)
            const drop = this._processCluster(source.drops, areaId);
            if (drop) results.push(drop);
        }

        return results;
    },

    /**
     * Unified Polymorphic Preview for UI
     */
    previewDrops(source) {
        const results = [];
        // `source` is a drops-bearing object. It used to also accept a drop
        // table id string; that registry was deleted on 2026-08-24 (CR2-116).
        const table = source;
        if (!table) return [];

        const extract = (entries) => entries.map(drop => {
            const item = getItem(drop.itemId || drop.id);
            return {
                itemId: drop.itemId || drop.id,
                itemName: item?.name || drop.itemId || drop.id,
                itemIcon: item?.icon || '?',
                chance: drop.chance ?? 100,
                // `quantity` is accepted alongside min/max because that is what
                // card `config.outputs` and every recipe author — and what
                // StationManager already reads. Without it an authored
                // `"quantity": 3` was silently ignored and every task dropped
                // exactly 1, which is a very quiet way to lose a design.
                minQty: drop.minQty ?? drop.min ?? drop.amount ?? drop.quantity ?? 1,
                maxQty: drop.maxQty ?? drop.max ?? drop.amount ?? drop.quantity ?? 1
            };
        });

        if (table.clusters) table.clusters.forEach(c => results.push(...extract(c)));
        else if (table.drops) results.push(...extract(table.drops));
        else if (Array.isArray(table)) results.push(...extract(table));

        return results;
    },

    /**
     * Single Weighted Roll per Group
     * @private
     */
    _processCluster(entries, areaId) {
        if (!entries || entries.length === 0) return null;

        const totalWeight = entries.reduce((sum, e) => sum + (e.chance ?? 100), 0);
        const roll = Math.random() * Math.max(100, totalWeight);

        let cumulative = 0;
        for (const entry of entries) {
            cumulative += (entry.chance ?? 100);
            if (roll <= cumulative) {
                return this._rollEntryDetails(entry, areaId);
            }
        }
        return null;
    },

    /**
     * Quantity and Mastery Processor
     * @private
     */
    _rollEntryDetails(entry, areaId) {
        if (entry.type === 'combat_trigger') {
            return { type: 'combat_trigger', enemyId: entry.enemyId };
        }
        const itemId = entry.itemId || entry.id;
        const item = getItem(itemId);
        if (!item) {
            // The swallow Session 3 traced four layers deep (CR2-108c). A loot
            // table naming an item that no longer exists rolls, wins, and pays
            // nothing — indistinguishable from an unlucky roll.
            warnMissingContent('LootSystem', 'item', itemId,
                'this drop pays out nothing at all');
            return null;
        }

        // `quantity` is accepted alongside min/max because it is what card
        // `config.outputs` and every recipe author, and what StationManager
        // already reads. Without it an authored `"quantity": 3` was silently
        // ignored and every task dropped exactly 1 — a very quiet way to lose a
        // design. (This is the REAL roller; `previewDrops` only feeds the UI.)
        const min = entry.minQty ?? entry.min ?? entry.amount ?? entry.quantity ?? 1;
        const max = entry.maxQty ?? entry.max ?? entry.amount ?? entry.quantity ?? 1;
        let quantity = randomInt(min, max);

        // The old double-yield mastery roll is gone with MasterySystem (C-19).
        // Binder Mastery rides the area aggregator instead; a YIELD-axis bonus
        // would need that aggregator consulted here, which it is not today
        // (see buff_diversification_orientation.md §3).

        return { itemId, quantity, itemName: item.name, itemIcon: item.icon };
    }
};

export { LootSystem };
