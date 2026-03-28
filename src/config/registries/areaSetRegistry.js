// Fantasy Guild - Area Set Registry
// Defines all Area Sets for the Booster Pack system.

import { logger } from '../../utils/Logger.js';

/**
 * AreaSetRegistry - Defines themed "Areas" that group cards into Sets.
 *
 * Each Area Set:
 * - Has a pool of cards that can drop from its Booster Packs.
 * - Requires a number of Map Fragments (from Quests) to unlock.
 * - Has escalating pack Gold costs.
 * - Provides areaArt used for World Map, Packs, Chests, and Quests.
 */

export const AREA_SETS = {
    guild_hall_v1: {
        id: 'guild_hall_v1',
        name: 'Guild Hall',
        icon: '🏰',
        areaArt: 'bg_guild_hall',
        backgroundImage: 'bg_table_wood_4x4_natural',
        backgroundMode: 'repeat',
        totalFragments: 0,
        packBaseGoldCost: 50,
        packCostScaling: 5,         // +5g per pack purchased
        cardPool: [
            // Standard tasks — all share equal weight
            { cardId: 'logging', weight: 10 },
            { cardId: 'foraging', weight: 10 },
            { cardId: 'well', weight: 10 },
            { cardId: 'copper_mine', weight: 10 },
            { cardId: 'copper_smelter', weight: 10 },
            { cardId: 'scrap_furniture', weight: 10 },
            { cardId: 'charcoal_kiln', weight: 10 },
            // Unique — lower weight
            { cardId: 'adventurers_workbench', weight: 3, isUnique: true },
            { cardId: 'bunk_bed', weight: 5, isUnique: true },
        ],
        deckList: {
            logging: 4,
            foraging: 4,
            well: 4,
            copper_mine: 4,
            copper_smelter: 4,
            scrap_furniture: 4,
            charcoal_kiln: 4,
            adventurers_workbench: 1,
            bunk_bed: 1,
        },
        gridConfig: {
            width: 9, // Bounding box for radius 4
            height: 9,
            max_width: 9,
            max_height: 9,
            hubPosition: { x: 4, y: 4 }, // Explicit Hub Placement
            validCells: [
                // 8x8 Diamond (Manhattan distance <= 4 from center 4,4)
                ...Array.from({ length: 9 * 9 }, (_, i) => {
                    const x = i % 9;
                    const y = Math.floor(i / 9);
                    return { x, y };
                }).filter(cell => Math.abs(cell.x - 4) + Math.abs(cell.y - 4) <= 4)
            ],
            tileMap: {
                '2,2': 'nature_boost',
                '6,2': 'industry_boost',
                '2,6': 'culinary_boost',
                '6,6': 'nautical_boost',
                '0,4': 'social_boost',
                '8,4': 'crime_boost',
                '4,0': 'occult_boost',
                '4,8': 'science_boost'
            }
        },
    },

    forest_v1: {
        id: 'forest_v1',
        name: 'Forest',
        icon: '🌲',
        areaArt: null,
        backgroundImage: null,
        backgroundMode: 'tiled-grid',
        totalFragments: 5,
        packBaseGoldCost: 75,
        packCostScaling: 8,
        cardPool: [
            { cardId: 'logging', weight: 10 },
            { cardId: 'foraging', weight: 10 },
            { cardId: 'gather_coal', weight: 10 },
            // Combat card
            { cardId: 'combat_wolf', weight: 8 },
        ],
        deckList: {
            logging: 4,
            foraging: 4,
            gather_coal: 4,
            combat_wolf: 4,
        },
        gridConfig: {
            width: 11,
            height: 11,
            max_width: 11,
            max_height: 11,
            center: { x: 5, y: 5 },
            validCells: [
                // Large 7x7 clearing in the center of an 11x11 grid
                ...Array.from({ length: 7 * 7 }, (_, i) => ({
                    x: (i % 7) + 2,
                    y: Math.floor(i / 7) + 2
                }))
            ],
            tileMap: {
                '4,4': 'forest',
                '5,4': 'forest',
                '4,5': 'forest',
                '6,3': 'forest',
                '3,6': 'forest'
            }
        },
    },

    forest_clearing_v1: {
        id: 'forest_clearing_v1',
        name: 'Forest Clearing',
        icon: '🌳',
        areaArt: null,
        backgroundImage: null,
        backgroundMode: 'tiled-grid',
        totalFragments: 10,
        packBaseGoldCost: 120,
        packCostScaling: 12,
        cardPool: [
            { cardId: 'logging', weight: 8 },
            { cardId: 'foraging', weight: 8 },
            { cardId: 'gather_coal', weight: 8 },
            { cardId: 'combat_wolf', weight: 10 },
            { cardId: 'combat_bear', weight: 5 },
        ],
        deckList: {
            logging: 3,
            foraging: 3,
            gather_coal: 3,
            combat_wolf: 4,
            combat_bear: 2,
        },
        gridConfig: {
            width: 11,
            height: 11,
            max_width: 11,
            max_height: 11,
            center: { x: 5, y: 5 },
            validCells: [
                // Cross pattern for clearing
                ...Array.from({ length: 11 }, (_, i) => ({ x: i, y: 5 })),
                ...Array.from({ length: 11 }, (_, i) => ({ x: 5, y: i })),
                // Central 5x5
                ...Array.from({ length: 5 * 5 }, (_, i) => ({
                    x: (i % 5) + 3,
                    y: Math.floor(i / 5) + 3
                }))
            ],
            tileMap: {
                '5,4': 'forest',
                '5,6': 'forest',
                '4,5': 'forest',
                '6,5': 'forest'
            }
        },
    },

    mountain_v1: {
        id: 'mountain_v1',
        name: 'Mountain',
        icon: '⛰️',
        areaArt: null,
        backgroundImage: null,
        backgroundMode: 'tiled-grid',
        totalFragments: 8,
        packBaseGoldCost: 100,
        packCostScaling: 10,
        cardPool: [
            { cardId: 'copper_mine', weight: 10 },
            { cardId: 'mining', weight: 10 },
        ],
        deckList: {
            copper_mine: 4,
            mining: 4,
        },
        gridConfig: {
            width: 11,
            height: 11,
            max_width: 11,
            max_height: 11,
            center: { x: 5, y: 0 }, // Hub at top center
            validCells: [
                // Vertical strip (Mountain pass)
                ...Array.from({ length: 7 }, (_, i) => ({ x: 4, y: i })),
                ...Array.from({ length: 7 }, (_, i) => ({ x: 5, y: i })),
                ...Array.from({ length: 7 }, (_, i) => ({ x: 6, y: i })),
                { x: 5, y: 7 }, { x: 5, y: 8 }
            ]
        },
    },
};

// === Helper Functions ===

/**
 * Get an Area Set by ID
 * @param {string} areaSetId
 * @returns {Object|null}
 */
export function getAreaSet(areaSetId) {
    return AREA_SETS[areaSetId] || null;
}

/**
 * Get all Area Set definitions
 * @returns {Object}
 */
export function getAllAreaSets() {
    return { ...AREA_SETS };
}

/**
 * Get all Area Set IDs
 * @returns {string[]}
 */
export function getAllAreaSetIds() {
    return Object.keys(AREA_SETS);
}

/**
 * Get the total number of fragments required to unlock an area
 * @param {string} areaSetId
 * @returns {number}
 */
export function getRequiredFragments(areaSetId) {
    const set = getAreaSet(areaSetId);
    return set ? set.totalFragments : Infinity;
}

/**
 * Calculate the gold cost for the next pack purchase in an area
 * @param {string} areaSetId
 * @param {number} packsBought - Number of packs already purchased in this area
 * @returns {number}
 */
export function getPackCost(areaSetId, packsBought = 0) {
    const set = getAreaSet(areaSetId);
    if (!set) return Infinity;
    return set.packBaseGoldCost + (packsBought * set.packCostScaling);
}

/**
 * Get the total number of cards in an area's set (sum of all counts in deckList)
 * @param {string} areaSetId
 * @returns {number}
 */
export function getSetTotal(areaSetId) {
    const set = getAreaSet(areaSetId);
    if (!set || !set.deckList) return 0;
    return Object.values(set.deckList).reduce((sum, count) => sum + count, 0);
}

logger.info('AreaSetRegistry', `Loaded ${Object.keys(AREA_SETS).length} Area Set(s)`);
