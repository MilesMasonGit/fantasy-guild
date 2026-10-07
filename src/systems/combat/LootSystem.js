// Fantasy Guild - Loot System

import { EventBus } from '../core/EventBus.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { warnMissingContent } from '../../utils/missingContent.js';
import { randomInt } from '../../utils/RNG.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as SpriteLayer from '../board/SpriteLayer.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Loot rolls. Enemy kills roll each drop line independently.
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
