// Fantasy Guild - Drop Table Registry
// Phase 29: Combat System

/**
 * DropTableRegistry - Defines loot tables for enemies and other sources
 * 
 * Each drop table contains a list of possible drops with:
 * - itemId: Reference to ItemRegistry
 * - minQty: Minimum quantity dropped
 * - maxQty: Maximum quantity dropped
 * - chance: Probability (0-100) of this item dropping
 */

export const DROP_TABLES = {
    // === Forest Enemy Drops ===
    wolf_drops: {
        id: 'wolf_drops',
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 60 },
            { itemId: 'wolf_fang', minQty: 1, maxQty: 1, chance: 25 }
        ]
    },

    boar_drops: {
        id: 'boar_drops',
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 3, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 2, chance: 80 },
            { itemId: 'boar_tusk', minQty: 1, maxQty: 1, chance: 20 }
        ]
    },

    // === Plains Enemy Drops ===
    rat_drops: {
        id: 'rat_drops',
        drops: [
            { itemId: 'rat_tail', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 30 }
        ]
    },

    snake_drops: {
        id: 'snake_drops',
        drops: [
            { itemId: 'snake_skin', minQty: 1, maxQty: 1, chance: 100 },
            { itemId: 'venom_sac', minQty: 1, maxQty: 1, chance: 15 }
        ]
    },

    // === Mountain Enemy Drops ===
    goat_drops: {
        id: 'goat_drops',
        drops: [
            { itemId: 'leather', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 2, chance: 70 },
            { itemId: 'goat_horn', minQty: 1, maxQty: 1, chance: 30 }
        ]
    },

    eagle_drops: {
        id: 'eagle_drops',
        drops: [
            { itemId: 'feather', minQty: 2, maxQty: 5, chance: 100 },
            { itemId: 'raw_meat', minQty: 1, maxQty: 1, chance: 50 },
            { itemId: 'eagle_talon', minQty: 1, maxQty: 1, chance: 20 }
        ]
    },

    // === Cave Enemy Drops ===
    bat_drops: {
        id: 'bat_drops',
        drops: [
            { itemId: 'bat_wing', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'guano', minQty: 1, maxQty: 3, chance: 40 }
        ]
    },

    spider_drops: {
        id: 'spider_drops',
        drops: [
            { itemId: 'spider_silk', minQty: 1, maxQty: 3, chance: 100 },
            { itemId: 'spider_fang', minQty: 1, maxQty: 1, chance: 25 },
            { itemId: 'venom_sac', minQty: 1, maxQty: 1, chance: 20 }
        ]
    },

    // === Swamp Enemy Drops ===
    frog_drops: {
        id: 'frog_drops',
        drops: [
            { itemId: 'frog_leg', minQty: 2, maxQty: 2, chance: 100 },
            { itemId: 'slime', minQty: 1, maxQty: 2, chance: 50 }
        ]
    },

    leech_drops: {
        id: 'leech_drops',
        drops: [
            { itemId: 'slime', minQty: 1, maxQty: 2, chance: 100 },
            { itemId: 'leech_blood', minQty: 1, maxQty: 1, chance: 40 }
        ]
    }
};

// === Helper Functions ===

/**
 * Get a drop table by ID
 * @param {string} dropTableId 
 * @returns {Object|null}
 */
export function getDropTable(dropTableId) {
    return DROP_TABLES[dropTableId] || null;
}

/**
 * Get all drop tables
 * @returns {Object}
 */
export function getAllDropTables() {
    return { ...DROP_TABLES };
}

/**
 * Get all drop table IDs
 * @returns {string[]}
 */
export function getAllDropTableIds() {
    return Object.keys(DROP_TABLES);
}
