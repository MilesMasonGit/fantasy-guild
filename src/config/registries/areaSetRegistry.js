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
        backgroundImage: 'pm_table_wood_spruce',
        backgroundMode: 'tiled-grid',
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
            { cardId: 'combat_wild_chickens_guild_hall', weight: 8 },
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
            combat_wild_chickens_guild_hall: 4,
        },
        gridConfig: {
            width: 5,
            height: 5,
            max_width: 5,
            max_height: 5,
            hubPosition: { x: 2, y: 2 }, // Explicit Hub Placement
            baseTileTemplate: 'guild_hall',
            baseTileVariants: 5,
            validCells: [
                // 5x5 Diamond (Manhattan distance <= 2 from center 2,2)
                ...Array.from({ length: 5 * 5 }, (_, i) => {
                    const x = i % 5;
                    const y = Math.floor(i / 5);
                    return { x, y };
                }).filter(cell => Math.abs(cell.x - 2) + Math.abs(cell.y - 2) <= 2)
            ],
            tileMap: {
                "2,0": "occult_boost",
                "1,1": "nature_boost",
                "2,1": "guild_hall_board_1",
                "3,1": "industry_boost",
                "0,2": "social_boost",
                "1,2": "guild_hall_board_2",
                "2,2": "guild_hall_board_3",
                "3,2": "guild_hall_board_4",
                "4,2": "crime_boost",
                "1,3": "culinary_boost",
                "2,3": "guild_hall_board_5",
                "3,3": "nautical_boost",
                "2,4": "science_boost"
            }
        },
        masteryBonuses: {
            setMastery: { yieldChanceMultiplier: 1.25 },
            questMastery: { workSpeedMultiplier: 1.25 }
        },
        exploration: {
            itemPool: ['wood_oak', 'stone', 'copper_ore', 'coal'],
            cardId: 'explore_abandoned_guild_hall'
        }
    },

    forest_v1: {
        id: 'forest_v1',
        name: 'Forest',
        icon: '🌲',
        areaArt: 'bg_forest',
        backgroundImage: 'pm_table_forest',
        backgroundMode: 'tiled-grid',
        totalFragments: 2,
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
            width: 3,
            height: 3,
            max_width: 3,
            max_height: 3,
            hubPosition: { x: 2, y: 2 }, // Hub at bottom right corner
            baseTileTemplate: 'forest',
            baseTileVariants: 4,
            validCells: [
                ...Array.from({ length: 9 }, (_, i) => ({
                    x: i % 3,
                    y: Math.floor(i / 3)
                }))
            ],
            tileMap: {
                "0,0": "forest_board_1",
                "1,0": "nature_boost",
                "2,0": "nature_boost",
                "0,1": "forest_board_2",
                "1,1": "nature_boost",
                "2,1": "forest_board_3",
                "0,2": "forest_board_4",
                "1,2": "forest_board_1",
                "2,2": "forest_board_2"
            }
        },
        masteryBonuses: {
            setMastery: [
                { id: 'forest_oak_local', type: 'yield_double', value: 0.10, scope: 'local', filter: { itemId: 'wood_oak' }, description: '10% chance to double Oak Wood in Forest.' },
                { id: 'forest_wood_global', type: 'yield_double', value: 0.10, scope: 'global', filter: { tag: 'wood' }, description: '10% chance to double all Wood types globally.' }
            ],
            questMastery: [
                { id: 'forest_combat_global', type: 'combat_damage', value: 1.10, scope: 'global', description: '+10% Combat Damage globally.' }
            ]
        },
        exploration: {
            itemPool: ['wood_oak', 'red_berry', 'copper_ore', 'coal'],
            cardId: 'explore_forest'
        }
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
        areaArt: 'bg_mountains_snowy',
        backgroundImage: 'pm_table_mountain',
        backgroundMode: 'tiled-grid',
        totalFragments: 2,
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
            width: 5,
            height: 5,
            max_width: 5,
            max_height: 5,
            center: { x: 2, y: 0 }, // Hub at top center
            baseTileTemplate: 'mountain',
            baseTileVariants: 6,
            validCells: [
                // 3-level Pyramid
                ...Array.from({ length: 3 }, (_, y) => {
                    const width = 1 + (y * 2);
                    const start_x = 2 - y;
                    return Array.from({ length: width }, (_, i) => ({ x: start_x + i, y }));
                }).flat()
            ],
            tileMap: {
                "2,0": "mountain_board_1",
                "1,1": "industry_boost",
                "2,1": "mountain_board_2",
                "3,1": "industry_boost",
                "0,2": "mountain_board_3",
                "1,2": "mountain_board_4",
                "2,2": "mountain_board_5",
                "3,2": "mountain_board_6",
                "4,2": "mountain_board_1"
            }
        },
        masteryBonuses: {
            setMastery: { yieldChanceMultiplier: 0.20 },
            questMastery: { workSpeedMultiplier: 1.15 }
        },
        exploration: {
            itemPool: ['stone', 'copper_ore', 'coal'],
            cardId: 'explore_mountain'
        }
    },

    farmland_v1: {
        id: 'farmland_v1',
        name: 'Farmland',
        icon: '🌾',
        areaArt: 'bg_golden_plains',
        backgroundImage: 'pm_table_farmland_soil',
        backgroundMode: 'tiled-grid',
        totalFragments: 3,
        packBaseGoldCost: 80,
        packCostScaling: 8,
        cardPool: [
            { cardId: 'foraging', weight: 10 },
            { cardId: 'logging', weight: 5 },
        ],
        deckList: {
            foraging: 4,
            logging: 2,
        },
        gridConfig: {
            width: 5,
            height: 3,
            max_width: 5,
            max_height: 5,
            center: { x: 2, y: 1 }, // Hub at center of middle row
            baseTileTemplate: 'farmland',
            baseTileVariants: 1,
            validCells: [
                { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
                { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
                { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }
            ],
            tileMap: {
                "1,0": "farmland_nature_boost_l",
                "2,0": "farmland_board_irrigated",
                "3,0": "farmland_board_irrigated_r",
                "0,1": "farmland_board_irrigated_l",
                "1,1": "farmland_board_irrigated",
                "2,1": "farmland_board_irrigated",
                "3,1": "farmland_board_irrigated",
                "4,1": "farmland_board_irrigated_r",
                "1,2": "farmland_board_irrigated_l",
                "2,2": "farmland_board_irrigated",
                "3,2": "farmland_culinary_boost_r"
            }
        },
        masteryBonuses: {
            setMastery: { yieldChanceMultiplier: 0.15 },
            questMastery: { workSpeedMultiplier: 1.10 }
        },
        exploration: {
            itemPool: ['apple', 'red_berry'],
            cardId: 'explore_farmland'
        }
    },
    village_v1: {
        id: 'village_v1',
        name: 'Village',
        icon: '🏠',
        areaArt: 'bg_cozy_village',
        backgroundImage: 'pm_table_wood_planks_oak',
        backgroundMode: 'tiled-grid',
        totalFragments: 2,
        packBaseGoldCost: 60,
        packCostScaling: 6,
        cardPool: [
            { cardId: 'well', weight: 10 },
            { cardId: 'scrap_furniture', weight: 10 },
        ],
        deckList: {
            well: 4,
            scrap_furniture: 3,
        },
        gridConfig: {
            width: 4,
            height: 4,
            max_width: 4,
            max_height: 4,
            center: { x: 0, y: 0 }, // Hub at intersection
            baseTileTemplate: 'village',
            baseTileVariants: 1,
            validCells: [
                { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
                { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 },
                { x: 1, y: 2 }, { x: 2, y: 1 }
            ],
            tileMap: {
                "0,0": "village_board_1",
                "1,2": "occult_boost",
                "2,1": "crime_boost",
                "1,0": "village_board_1",
                "2,0": "village_board_1",
                "3,0": "village_board_1",
                "0,1": "village_board_1",
                "0,2": "village_board_1",
                "0,3": "village_board_1"
            }
        },
        masteryBonuses: {
            setMastery: { yieldChanceMultiplier: 0.10 },
            questMastery: { workSpeedMultiplier: 1.05 }
        },
        exploration: {
            itemPool: ['stone', 'wood_oak'],
            cardId: 'explore_village'
        }
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
    if (!set) return 50;
    const calculated = set.packBaseGoldCost + (packsBought * (set.packCostScaling || 0));
    return Math.max(50, calculated);
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
