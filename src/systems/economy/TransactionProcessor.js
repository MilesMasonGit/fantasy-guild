// Fantasy Guild - Transaction Processor
// Unified reward/cost processing protocol.
// All reward-granting code routes through this module.

import { InventoryManager } from '../inventory/InventoryManager.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';

/**
 * Transaction Entry Types:
 * - ITEM:     { type: 'ITEM',     id: string, amount: number, chance?: number }
 * - CURRENCY: { type: 'CURRENCY', id: string, amount: number }
 * - XP:       { type: 'XP',       skill: string, amount: number }
 *
 * Transaction Schema:
 * { entries: TransactionEntry[] }
 */

/**
 * Apply a reward transaction, granting all entries.
 * Each entry with a `chance` (0-100) is rolled individually.
 *
 * @param {Object} transaction - { entries: Array<TransactionEntry> }
 * @param {string|null} heroId - Hero to award XP to (if applicable)
 * @param {string|null} sourceId - The cardTemplateId or enemyId that produced this item
 * @returns {{ granted: Array, failed: Array }} Summary of what was granted
 */
export function apply(transaction, heroId = null, sourceId = null) {
    if (!transaction?.entries?.length) return { granted: [], failed: [] };

    const granted = [];
    const failed = [];

    for (const entry of transaction.entries) {
        // Roll chance if present
        if (entry.chance !== undefined && entry.chance < 100) {
            const roll = Math.random() * 100;
            if (roll > entry.chance) {
                logger.debug('TransactionProcessor', `Chance roll failed for ${entry.type}:${entry.id || entry.skill} (${roll.toFixed(1)} > ${entry.chance})`);
                continue; // Skip this entry
            }
        }

        try {
            switch (entry.type) {
                case 'ITEM': {
                    const amount = entry.amount || 1;
                    InventoryManager.addItem(entry.id, amount, sourceId);
                    granted.push({ type: 'ITEM', id: entry.id, amount });
                    logger.debug('TransactionProcessor', `Granted ${amount}x ${entry.id}`);
                    break;
                }
                case 'CURRENCY': {
                    const amount = entry.amount || 0;
                    if (entry.id === 'gold') {
                        CurrencyManager.addGold(amount, 'transaction');
                    } else if (entry.id === 'influence') {
                        CurrencyManager.addInfluence(amount, 'transaction');
                    }
                    granted.push({ type: 'CURRENCY', id: entry.id, amount });
                    logger.debug('TransactionProcessor', `Granted ${amount} ${entry.id}`);
                    break;
                }
                case 'XP': {
                    if (heroId && entry.skill) {
                        SkillSystem.addXP(heroId, entry.skill, entry.amount || 0);
                        granted.push({ type: 'XP', skill: entry.skill, amount: entry.amount });
                        logger.debug('TransactionProcessor', `Granted ${entry.amount} XP in ${entry.skill} to ${heroId}`);
                    } else {
                        failed.push({ ...entry, reason: 'No heroId or skill specified' });
                    }
                    break;
                }
                default:
                    logger.warn('TransactionProcessor', `Unknown entry type: ${entry.type}`);
                    failed.push({ ...entry, reason: `Unknown type: ${entry.type}` });
            }
        } catch (err) {
            logger.error('TransactionProcessor', `Failed to process entry: ${JSON.stringify(entry)} — ${err.message}`);
            failed.push({ ...entry, reason: err.message });
        }
    }

    if (granted.length > 0) {
        EventBus.publish('transaction_applied', { granted, heroId });
    }

    return { granted, failed };
}

/**
 * Perform a weighted pick from a loot table and grant the selected reward.
 * Returns ONE reward per call (standard RPG loot table behavior).
 *
 * @param {Array} lootTable - Array of { itemId, quantity, chance, type }
 * @param {string|null} heroId - Hero for XP grants
 * @returns {{ selected: Object|null, granted: Array }}
 */
export function weightedPick(lootTable, heroId = null) {
    if (!lootTable?.length) return { selected: null, granted: [] };

    // Calculate total weight
    const totalWeight = lootTable.reduce((sum, o) => sum + (o.chance ?? 100), 0);
    const rollRange = Math.max(100, totalWeight);
    const roll = Math.random() * rollRange;

    let cumulativeWeight = 0;
    for (const output of lootTable) {
        cumulativeWeight += (output.chance ?? 100);

        if (roll <= cumulativeWeight) {
            // This is the chosen outcome
            if (output.itemId) {
                const transaction = {
                    entries: [{ type: 'ITEM', id: output.itemId, amount: output.quantity || 1 }]
                };
                const result = apply(transaction, heroId);
                return { selected: output, granted: result.granted };
            }
            return { selected: output, granted: [] };
        }
    }

    return { selected: null, granted: [] };
}

/**
 * Convert a legacy outputs array to a transaction.
 * Useful for migrating existing output definitions.
 *
 * @param {Array} outputs - Legacy outputs (e.g. [{ itemId, quantity, chance }])
 * @param {string|null} skill - Skill for XP entry
 * @param {number} xpAmount - XP amount
 * @returns {Object} Transaction schema
 */
export function fromOutputs(outputs, skill = null, xpAmount = 0) {
    const entries = [];

    if (skill && xpAmount > 0) {
        entries.push({ type: 'XP', skill, amount: xpAmount });
    }

    for (const output of (outputs || [])) {
        if (output.itemId) {
            entries.push({
                type: 'ITEM',
                id: output.itemId,
                amount: output.quantity || 1,
                ...(output.chance !== undefined && output.chance < 100 ? { chance: output.chance } : {}),
            });
        }
    }

    return { entries };
}
