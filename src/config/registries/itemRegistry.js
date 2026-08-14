// Fantasy Guild - Item Registry
// Phase 16 / CMS Rework Phase 10: Dynamic JSON Loader (CMS-83)

/**
 * ItemRegistry - Defines all item templates loaded dynamically from data/
 *
 * Item Types:
 * - material: Basic resources (wood, stone, etc.)
 * - ingredient: Cooking / crafting ingredients
 * - tool: Equipment that boosts skills
 * - weapon: Equipment for combat
 * - armor: Equipment for defence
 * - food: Restores HP/Energy
 * - drink: Restores Energy
 * - potion: Buff consumables
 * - currency: Special tracking items
 * - drop: Monster parts/loot
 */

import { DatabaseManager } from '../DatabaseManager.js';

// === Item Type Constants ===
export const DEFAULT_MAX_STACK = 1e12;

export const ITEM_TYPES = {
    MATERIAL: 'material',
    INGREDIENT: 'ingredient',
    TOOL: 'tool',
    WEAPON: 'weapon',
    ARMOR: 'armor',
    FOOD: 'food',
    DRINK: 'drink',
    POTION: 'potion',
    CURRENCY: 'currency',
    DROP: 'drop'
};

// === Dynamic Item Loader (CMS-83) ===
const jsonItemFilesSingle = DatabaseManager.itemFilesSingle;
const jsonItemFilesGlob = DatabaseManager.itemFilesGlob;

function loadJsonItems() {
    const dynamicItems = {};

    // Process items.json if it exists
    for (const [path, module] of Object.entries(jsonItemFilesSingle || {})) {
        try {
            const itemsData = module.default || module;
            for (const [itemId, itemDef] of Object.entries(itemsData)) {
                if (!itemDef.id) itemDef.id = itemId;
                dynamicItems[itemId] = itemDef;
            }
        } catch (error) {
            console.warn(`Error loading item JSON from ${path}:`, error);
        }
    }

    // Process items/**/*.json if they exist
    for (const [path, module] of Object.entries(jsonItemFilesGlob || {})) {
        try {
            const itemsData = module.default || module;
            for (const [itemId, itemDef] of Object.entries(itemsData)) {
                if (!itemDef.id) itemDef.id = itemId;
                dynamicItems[itemId] = itemDef;
            }
        } catch (error) {
            console.warn(`Error loading item JSON from ${path}:`, error);
        }
    }

    return dynamicItems;
}

export const ITEMS = Object.freeze(loadJsonItems());

// === Helper Functions ===

/**
 * Get an item template by ID
 * @param {string} itemId 
 * @returns {Object|null}
 */
export function getItem(itemId) {
    return ITEMS[itemId] || null;
}

/**
 * Get all item templates
 * @returns {Object}
 */
export function getAllItems() {
    return ITEMS;
}

/**
 * Get items by type
 * @param {string} itemType 
 * @returns {Array}
 */
export function getItemsByType(itemType) {
    return Object.values(ITEMS).filter(i => i.type === itemType);
}

/**
 * Check if item exists
 * @param {string} itemId 
 * @returns {boolean}
 */
export function itemExists(itemId) {
    return !!ITEMS[itemId];
}

/**
 * Get items by tag
 * @param {string} tag - Tag to filter by
 * @returns {Array} Items with matching tag
 */
export function getItemsByTag(tag) {
    return Object.values(ITEMS).filter(item => item.tags?.includes(tag));
}
