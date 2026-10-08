// Fantasy Guild - Item Registry

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
import { migrateSkillIds } from '../../systems/effects/skillIdMigration.js';

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

// === Dynamic Item Loader ===
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
                dynamicItems[itemId] = migrateSkillIds(itemDef);
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
                dynamicItems[itemId] = migrateSkillIds(itemDef);
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
