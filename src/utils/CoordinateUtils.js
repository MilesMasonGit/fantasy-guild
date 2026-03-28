import { GRID_PITCH, PLAYMAT_PADDING } from '../config/registries/layoutConstants.js';

/**
 * CoordinateUtils - Centralized logic for the Point-Map architecture.
 * Translates logical grid coordinates (x, y) into absolute pixel centers on the playmat.
 */

/**
 * Returns the absolute pixel center for a given grid coordinate.
 * @param {number} gridX - The logical X coordinate on the grid.
 * @param {number} gridY - The logical Y coordinate on the grid.
 * @param {number} offsetX - The logical X offset to shift the entire grid (used for bounding boxes).
 * @param {number} offsetY - The logical Y offset to shift the entire grid.
 * @returns {Object} { px, py } absolute pixel coordinates.
 */
export const getLogicalPosition = (gridX, gridY, offsetX = 0, offsetY = 0) => {
    return {
        px: (gridX - offsetX) * GRID_PITCH + PLAYMAT_PADDING,
        py: (gridY - offsetY) * GRID_PITCH + PLAYMAT_PADDING
    };
};
