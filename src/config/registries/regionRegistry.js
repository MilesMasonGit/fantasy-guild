// Fantasy Guild - Region Registry
// Defines regions containing groups of biomes for exploration

/**
 * RegionRegistry - Defines all exploration regions
 * 
 * Regions are groups of biomes that can be explored.
 * Each Explore Card is tied to one Region.
 * Exploring a biome within a region spawns an Area Card for that biome.
 */

export const REGIONS = {
    // === Starting Region ===
    ruined_guild_hall: {
        id: 'ruined_guild_hall',
        name: 'Ruined Guild Hall',
        description: 'The abandoned guild hall, now overrun with pests.',
        icon: '🏚️',
        biomes: ['guild_hall'],  // Single biome for starting region
        // No cost multiplier for starting region
        baseCostMultiplier: 1
    },

    // === Early Game Regions ===
    wilderness: {
        id: 'wilderness',
        name: 'Wilderness',
        description: 'Untamed lands surrounding the guild, rich with resources.',
        icon: '🌲',
        biomes: ['forest', 'plains', 'mountain'],
        baseCostMultiplier: 1.5
    },

    wetlands: {
        id: 'wetlands',
        name: 'Wetlands',
        description: 'Marshy terrain with unique flora and fauna.',
        icon: '🌿',
        biomes: ['swamp', 'river', 'lake'],
        baseCostMultiplier: 2
    },

    underground: {
        id: 'underground',
        name: 'Underground',
        description: 'Deep caverns hiding rare minerals and dangers.',
        icon: '⛏️',
        biomes: ['cave', 'mine', 'crystal_cavern'],
        baseCostMultiplier: 2.5
    }
};

// === Helper Functions ===

/**
 * Get a region by ID
 * @param {string} regionId 
 * @returns {Object|null}
 */
export function getRegion(regionId) {
    return REGIONS[regionId] || null;
}

/**
 * Get all regions
 * @returns {Object[]}
 */
export function getAllRegions() {
    return Object.values(REGIONS);
}

/**
 * Get biomes available in a region
 * @param {string} regionId 
 * @returns {string[]}
 */
export function getRegionBiomes(regionId) {
    const region = REGIONS[regionId];
    return region?.biomes || [];
}

/**
 * Get unexplored biomes in a region (not yet converted to Area Cards)
 * @param {string} regionId 
 * @param {string[]} exploredBiomes - Array of already explored biome IDs
 * @returns {string[]}
 */
export function getUnexploredBiomes(regionId, exploredBiomes = []) {
    const allBiomes = getRegionBiomes(regionId);
    return allBiomes.filter(biomeId => !exploredBiomes.includes(biomeId));
}

/**
 * Check if all biomes in a region have been explored
 * @param {string} regionId 
 * @param {string[]} exploredBiomes
 * @returns {boolean}
 */
export function isRegionComplete(regionId, exploredBiomes = []) {
    const unexplored = getUnexploredBiomes(regionId, exploredBiomes);
    return unexplored.length === 0;
}
