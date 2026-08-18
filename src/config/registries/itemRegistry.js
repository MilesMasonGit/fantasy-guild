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

// Deliberately NOT frozen — `registerItems` below needs to extend it. Content
// still only ever arrives from data/, so nothing in the shipping build mutates
// this; the seam exists for the test fixtures.
export const ITEMS = loadJsonItems();

/**
 * Register extra item templates at runtime — **the test-fixture seam**.
 *
 * The mirror of `registerTokenTypes` in `tokenRegistry.js`, and it exists for
 * the same reason that one does: engine suites assert on fixed numbers, so they
 * run against `fixture_` content rather than shipped content, and **content
 * must be free to be re-authored without the engine suite noticing**.
 *
 * Tokens got that seam in Phase 10; items did not, so the fixture Tokens went
 * on referencing real item ids. Re-authoring content in the CMS then emptied
 * those ids out from under them and broke ~25 engine assertions across six
 * suites — the exact coupling the fixture split was built to prevent.
 *
 * Vitest isolates module registries per test file, so registering never leaks
 * into the content validation suite (`ContentRules.test.js`, which imports no
 * fixtures and must keep seeing shipped content only).
 *
 * ⚠️ **Nothing in `src/systems` or `src/ui` may call this.** It is a seam for
 * tests, not an extension point — content belongs in data/, where the
 * validation rules can see it.
 */
export function registerItems(definitions) {
    Object.assign(ITEMS, definitions || {});
}

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
