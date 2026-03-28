import { getTileType } from '../config/registries/index.js';

/**
 * Static offsets for neighbors (cardinal directions).
 * Frozen to prevent shape-polymorphism.
 */
const NEIGHBOR_OFFSETS = Object.freeze([
    { dx: 0, dy: -1 }, // N
    { dx: 0, dy:  1 }, // S
    { dx:-1, dy:  0 }, // W
    { dx: 1, dy:  0 }, // E
]);

/**
 * Get the tile context for a coordinate.
 * Performance: Accepts raw tileMap reference. Zero allocations per call.
 * 
 * @param {Object} tileMap - GameState.grid.tileMap (sparse map)
 * @param {number} x
 * @param {number} y
 * @returns {{ tile: Object, neighbors: Object[] }}
 */
export function getContext(tileMap, x, y) {
    const tile = getTileType(tileMap[`${x},${y}`]);
    const neighbors = NEIGHBOR_OFFSETS.map(
        o => getTileType(tileMap[`${x + o.dx},${y + o.dy}`])
    );
    return { tile, neighbors };
}

/**
 * Check if a card category is allowed on a tile based on registry constraints.
 * 
 * @param {string} tileId - The tile type ID
 * @param {string} cardCategory - The card category to check (e.g., 'logging', 'fishing')
 * @returns {boolean}
 */
export function isPlacementAllowed(tileId, cardCategory) {
    const tile = getTileType(tileId);
    if (!tile.constraints) return true; // No constraints = allowed by default
    
    // Blocked check
    if (tile.constraints.blockedCategories?.includes(cardCategory)) {
        return false;
    }
    
    // Allowed check (if specified, must be in list)
    if (tile.constraints.allowedCategories) {
        return tile.constraints.allowedCategories.includes(cardCategory);
    }
    
    return true;
}
