// Fantasy Guild - Loot System
// Phase 31: Combat System - Loot Generation (Cluster-Based Evolution)

import { EventBus } from '../core/EventBus.js';
import { getDropTable } from '../../config/registries/dropTableRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { logger } from '../../utils/Logger.js';
import { randomInt } from '../../utils/RNG.js';
import * as TransactionProcessor from '../economy/TransactionProcessor.js';
import { MasterySystem } from '../progression/MasterySystem.js';

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
        const { cardId, heroId, enemyId, enemyName, drops, dropTableId, areaId } = data;
        
        // Source Resolution
        const table = dropTableId ? getDropTable(dropTableId) : null;
        const sourceData = (Array.isArray(drops) && drops.length > 0) ? { drops } : table;

        if (!sourceData) {
            EventBus.publish('loot_generated', { cardId, heroId, enemyId, enemyName, drops: [] });
            return;
        }

        const generatedDrops = this.generateDrops(sourceData, areaId);

        // Apply and Publish
        if (generatedDrops.length > 0) {
            TransactionProcessor.apply({
                entries: generatedDrops.map(d => ({ type: 'ITEM', id: d.itemId, amount: d.quantity })),
                source: `Loot (${enemyName})`
            }, heroId, enemyId);
        }

        EventBus.publish('loot_generated', { cardId, heroId, enemyId, enemyName, drops: generatedDrops });
    },

    /**
     * Universal Reward Orchestrator (Used by Task Cards)
     */
    handleTaskReward(card, outputs) {
        if (!outputs || !Array.isArray(outputs) || outputs.length === 0) return;

        const areaId = card.areaId || card.config?.areaId || 'guild_hall_v1';
        
        // Wrap task outputs in a single cluster for "Pick One" behavior
        const generatedDrops = this.generateDrops({ drops: outputs }, areaId);

        if (generatedDrops.length > 0) {
            TransactionProcessor.apply({
                entries: generatedDrops.map(d => ({ type: 'ITEM', id: d.itemId, amount: d.quantity })),
                source: `Task (${card.name})`
            }, null, card.templateId);
        }

        EventBus.publish('loot_generated', { cardId: card.id, drops: generatedDrops });
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
        const table = typeof source === 'string' ? getDropTable(source) : source;
        if (!table) return [];

        const extract = (entries) => entries.map(drop => {
            const item = getItem(drop.itemId || drop.id);
            return {
                itemId: drop.itemId || drop.id,
                itemName: item?.name || drop.itemId || drop.id,
                itemIcon: item?.icon || '?',
                chance: drop.chance ?? 100,
                minQty: drop.minQty ?? drop.min ?? drop.amount ?? 1,
                maxQty: drop.maxQty ?? drop.max ?? drop.amount ?? 1
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
        const itemId = entry.itemId || entry.id;
        const item = getItem(itemId);
        if (!item) return null;

        const min = entry.minQty ?? entry.min ?? entry.amount ?? 1;
        const max = entry.maxQty ?? entry.max ?? entry.amount ?? 1;
        let quantity = randomInt(min, max);

        // Apply Mastery Yield
        const bonuses = MasterySystem.getEffectiveBonuses({ areaId, itemId, itemTags: item.tags || [] });
        if (bonuses.yieldDoubleChance > 0 && Math.random() < bonuses.yieldDoubleChance) {
            quantity *= 2;
            logger.info('LootSystem', `Mastery DOUBLE! ${item.name}`);
        }

        return { itemId, quantity, itemName: item.name, itemIcon: item.icon };
    }
};

export { LootSystem };
