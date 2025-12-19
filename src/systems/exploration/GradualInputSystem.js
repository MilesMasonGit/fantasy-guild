// Fantasy Guild - Gradual Input System
// Shared system for Explore Cards and Area Projects

import { InventoryManager } from '../inventory/InventoryManager.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { getItem } from '../../config/registries/itemRegistry.js';

/**
 * GradualInputSystem - Handles gradual resource consumption
 * 
 * Unlike Task Cards that consume all inputs instantly, this system consumes
 * 1 of each required item per tick/cycle until all quotas are met.
 * 
 * Used by:
 * - Explore Cards (consuming items to explore biomes)
 * - Area Projects (consuming items to complete buildings)
 */

/**
 * Initialize input progress tracking for a set of requirements
 * @param {Object} requirements - { itemId: requiredAmount }
 * @returns {Object} inputProgress structure
 */
export function initInputProgress(requirements) {
    const progress = {};
    for (const [itemId, required] of Object.entries(requirements)) {
        progress[itemId] = {
            current: 0,
            required: required
        };
    }
    return progress;
}

/**
 * Process one cycle of gradual input consumption
 * Consumes 1 of each item type that hasn't reached its quota
 * 
 * @param {Object} inputProgress - Progress object with { itemId: { current, required } }
 * @param {Object} requirements - { itemId: requiredAmount } (for reference)
 * @param {Function} [itemResolver] - Optional (key) => itemId. Used to resolve tag-based keys to specific items (e.g. from slots).
 * @returns {{ consumed: Object, complete: boolean, blocked: boolean, anyRemaining: boolean }}
 */
export function processGradualInputCycle(inputProgress, requirements, itemResolver = null) {
    const consumed = {};
    let anyConsumed = false;

    // First pass: consume items
    for (const [key, required] of Object.entries(requirements)) {
        const progress = inputProgress[key];

        if (!progress) {
            logger.warn('GradualInputSystem', `No progress tracking for item: ${key}`);
            continue;
        }

        // Skip if this item's quota is already complete
        if (progress.current >= progress.required) {
            continue;
        }

        let targetItemId = key;

        // Handle tag-based requirements (e.g. 'tag:key')
        if (key.startsWith('tag:')) {
            const tag = key.substring(4);

            // If a resolver is provided, ask it which item to use (e.g. from a specific slot)
            // The resolver is passed the key (e.g. 'tag:key') and the index (implicit or explicit)
            // But we don't have index here.
            // However, requirements is usually iterated in order.

            if (itemResolver) {
                targetItemId = itemResolver(key);
            } else {
                targetItemId = findAvailableItemForTag(tag);
            }

            if (!targetItemId) {
                continue; // No matching item found or assigned
            }
        }

        // Try to consume 1 from inventory
        if (InventoryManager.hasItem(targetItemId, 1)) {
            InventoryManager.removeItem(targetItemId, 1);
            progress.current++;
            consumed[key] = 1; // Record against the requirement key
            anyConsumed = true;

            logger.debug('GradualInputSystem',
                `Consumed 1 ${targetItemId} for ${key} (${progress.current}/${progress.required})`);
        }
    }

    // Second pass: check if all quotas are now complete
    let allComplete = true;
    let anyRemaining = false;

    for (const [key, required] of Object.entries(requirements)) {
        const progress = inputProgress[key];
        if (progress && progress.current < progress.required) {
            allComplete = false;
            anyRemaining = true;
            break;
        }
    }

    return {
        consumed,           // What was consumed this cycle { requirementKey: amount }
        complete: allComplete,  // All quotas met?
        blocked: !anyConsumed && anyRemaining,  // Can't proceed - no items available
        anyRemaining        // Are there still quotas to fill?
    };
}

/**
 * Helper: Find first available item in inventory that matches a tag
 */
function findAvailableItemForTag(tag) {
    const inventory = InventoryManager.getAllItems();
    // inventory is { itemId: quantity } or { itemId: { qty, dur } }

    // getItem is imported at the top of the file

    for (const [itemId, value] of Object.entries(inventory)) {
        const qty = typeof value === 'object' ? value.qty : value;
        if (qty > 0) {
            const template = getItem(itemId);
            if (template && template.tags && template.tags.includes(tag)) {
                return itemId;
            }
        }
    }
    return null;
}

/**
 * Check if player can make any progress (has at least 1 of any required item)
 * @param {Object} inputProgress - Progress object
 * @param {Object} requirements - { itemId: requiredAmount }
 * @param {Function} [itemResolver] - Optional (key) => itemId
 * @returns {boolean}
 */
export function canMakeProgress(inputProgress, requirements, itemResolver = null) {
    for (const [key, required] of Object.entries(requirements)) {
        const progress = inputProgress[key];

        if (progress && progress.current < progress.required) {
            if (key.startsWith('tag:')) {
                const tag = key.substring(4);
                let targetItemId = null;

                if (itemResolver) {
                    targetItemId = itemResolver(key);
                } else {
                    targetItemId = findAvailableItemForTag(tag);
                }

                if (targetItemId && InventoryManager.hasItem(targetItemId, 1)) {
                    return true;
                }
            } else {
                if (InventoryManager.hasItem(key, 1)) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Check if all quotas are complete
 * @param {Object} inputProgress - Progress object
 * @returns {boolean}
 */
export function isComplete(inputProgress) {
    for (const progress of Object.values(inputProgress)) {
        if (progress.current < progress.required) {
            return false;
        }
    }
    return true;
}

/**
 * Get total progress as a percentage
 * @param {Object} inputProgress - Progress object
 * @returns {number} 0-100
 */
export function getTotalProgressPercent(inputProgress) {
    let totalCurrent = 0;
    let totalRequired = 0;

    for (const progress of Object.values(inputProgress)) {
        totalCurrent += progress.current;
        totalRequired += progress.required;
    }

    if (totalRequired === 0) return 100;
    return Math.floor((totalCurrent / totalRequired) * 100);
}

/**
 * Combine base and specific requirements into a single requirements object
 * @param {Object} explorationCost - { base: {}, specific: {} }
 * @returns {Object} Combined { itemId: requiredAmount }
 */
export function combineRequirements(explorationCost) {
    const combined = {};

    if (explorationCost.base) {
        Object.assign(combined, explorationCost.base);
    }

    if (explorationCost.specific) {
        for (const [itemId, amount] of Object.entries(explorationCost.specific)) {
            combined[itemId] = (combined[itemId] || 0) + amount;
        }
    }

    return combined;
}

/**
 * Apply a cost multiplier to requirements (for scaling exploration costs)
 * @param {Object} requirements - { itemId: requiredAmount }
 * @param {number} multiplier - Cost multiplier
 * @returns {Object} Scaled requirements
 */
export function applyMultiplier(requirements, multiplier) {
    const scaled = {};
    for (const [itemId, amount] of Object.entries(requirements)) {
        scaled[itemId] = Math.ceil(amount * multiplier);
    }
    return scaled;
}
