// Fantasy Guild - Loot System

import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { warnMissingContent } from '../../utils/missingContent.js';
import { randomInt } from '../../utils/RNG.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { getYieldMultiplier } from '../effects/StatusEffectSystem.js';
import { resolveYield } from '../effects/EffectAxes.js';
import * as SpriteLayer from '../board/SpriteLayer.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

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
 * Loot rolls. Enemy kills roll each drop line independently; task rewards
 * (`handleTaskReward`) pick one entry per group.
 */
const LootSystem = {
    initialized: false,

    init() {
        if (this.initialized) return;
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (data) => this.handleCombatVictory(data));
        this.initialized = true;
        logger.info('LootSystem', 'Loot system initialized');
    },

    /**
     * Roll a victory's drops: floating sprites on the board, straight to the Bank otherwise.
     */
    handleCombatVictory(data) {
        const { cardId, heroId, enemyId, enemyName, drops, areaId, instanceId } = data;

        const sourceData = (Array.isArray(drops) && drops.length > 0) ? { drops } : null;

        if (!sourceData) {
            EventBus.publish(ENGINE_EVENTS.LOOT_GENERATED, { cardId, heroId, enemyId, enemyName, drops: [] });
            return;
        }

        // Every drop line rolls on its own `chance`, as a station's outputs do in
        // `BoardRunner`: a Goblin with Bones 100% and Copper Ore 30% drops Bones
        // every kill AND Ore 30% of the time.
        const generatedDrops = this.rollEachLine(sourceData.drops, areaId);

        if (generatedDrops.length > 0) {
            if (instanceId != null) {
                // On the board, loot drops as floating sprites where the kill
                // happened and is not banked until collected; banking it directly
                // would skip the sprite layer.
                for (const drop of generatedDrops) {
                    SpriteLayer.addSprite('item', drop.itemId, drop.quantity, instanceId);
                }
            } else {
                // No Token to anchor sprites to: bank directly.
                for (const d of generatedDrops) {
                    InventoryManager.addItem(d.itemId, d.quantity || 1, enemyId);
                }
            }
        }

        EventBus.publish(ENGINE_EVENTS.LOOT_GENERATED, { cardId, heroId, enemyId, enemyName, instanceId, drops: generatedDrops });
    },

    /**
     * Roll task outputs as one pick-one group and bank them. ⚠️ No caller in `src/`.
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
            // …and stamped Token YIELD scales the base quantity first. resolveYield
            // keeps the fractional result so scaleYield's probabilistic rounding
            // applies once, at the end, over both sources combined.
            for (const d of itemDrops) {
                const amount = scaleYield(resolveYield(card.aggregator, d.quantity), yieldMult);
                InventoryManager.addItem(d.itemId, amount || 1, card.templateId);
            }
        }

        EventBus.publish(ENGINE_EVENTS.LOOT_GENERATED, { cardId: card.id, areaId, drops: generatedDrops });

        if (combatTrigger) {
            return { type: 'combat_trigger', enemyId: combatTrigger.enemyId };
        }
        return null;
    },

    /**
     * Roll every line independently: each entry lands when its own `chance`
     * (default 100) hits, with its quantity rolled over its authored min–max.
     *
     * @param {Array} entries - `{ itemId, chance, minQty, maxQty }` lines
     * @returns {Array} the drops that landed, possibly empty
     */
    rollEachLine(entries, areaId) {
        const results = [];
        for (const entry of (Array.isArray(entries) ? entries : [])) {
            if (!entry) continue;
            const chance = entry.chance ?? 100;
            if (chance < 100 && Math.random() * 100 > chance) continue;
            const drop = this._rollEntryDetails(entry, areaId);
            if (drop && (drop.type === 'combat_trigger' || drop.quantity > 0)) results.push(drop);
        }
        return results;
    },

    /**
     * Polymorphic drop generator: ONE weighted pick per group. Handles
     * clusters and flat drop lists.
     *
     * ⚠️ Not the enemy-kill path (kills use `rollEachLine`). Only
     * `handleTaskReward` calls it, and nothing in `src/` calls that.
     */
    generateDrops(source, areaId) {
        const results = [];
        
        if (source.clusters && Array.isArray(source.clusters)) {
            for (const cluster of source.clusters) {
                const drop = this._processCluster(cluster, areaId);
                if (drop) results.push(drop);
            }
        } 
        else if (source.drops && Array.isArray(source.drops)) {
            // Flat drops list: treated as one group
            const drop = this._processCluster(source.drops, areaId);
            if (drop) results.push(drop);
        }

        return results;
    },

    /**
     * Normalised drop lines for UI display; does not roll.
     */
    previewDrops(source) {
        const results = [];
        const table = source;
        if (!table) return [];

        const extract = (entries) => entries.map(drop => {
            const item = getItem(drop.itemId || drop.id);
            return {
                itemId: drop.itemId || drop.id,
                itemName: item?.name || drop.itemId || drop.id,
                itemIcon: item?.icon || '?',
                chance: drop.chance ?? 100,
                // Same min/max/amount/quantity fallbacks as `_rollEntryDetails`.
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
     * Rolls one entry's item and quantity
     * @private
     */
    _rollEntryDetails(entry, areaId) {
        if (entry.type === 'combat_trigger') {
            return { type: 'combat_trigger', enemyId: entry.enemyId };
        }
        const itemId = entry.itemId || entry.id;
        const item = getItem(itemId);
        if (!item) {
            // A loot table naming an item that no longer exists would roll, win
            // and pay nothing, indistinguishable from an unlucky roll.
            warnMissingContent('LootSystem', 'item', itemId,
                'this drop pays out nothing at all');
            return null;
        }

        // `quantity` is accepted alongside min/max because card `config.outputs`
        // and recipe authors use it. Ignoring it would silently drop exactly 1.
        const min = entry.minQty ?? entry.min ?? entry.amount ?? entry.quantity ?? 1;
        const max = entry.maxQty ?? entry.max ?? entry.amount ?? entry.quantity ?? 1;
        let quantity = randomInt(min, max);

        return { itemId, quantity, itemName: item.name, itemIcon: item.icon };
    }
};

export { LootSystem };
