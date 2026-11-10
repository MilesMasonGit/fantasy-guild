// how much of a world place is water, grass and Stone, before and after it is settled

import { worldTables } from '../../config/registries/worldTablesRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as Atlas from '../atlas/Atlas.js';
import { budget, apportion } from '../atlas/Budget.js';
import { groundCounts } from '../atlas/Layout.js';
import { shippedMat } from '../atlas/layoutInputs.js';
import { regionGroundCounts } from '../atlas/regionGround.js';
import { matCap } from '../board/MatCap.js';
import { recipesOfCell } from './cellRegion.js';
import { regionIdOfCell } from './Settling.js';
import { currentWorld } from './worldState.js';

/**
 * The world map's ground dials: what share of a place's mat is water, Stone, and the dry land left
 * ("grass", whatever its biome draws it as: grass, rock or sand).
 *
 * - **A settled place** reads the cells its Region stored when it was written (`regionGround`).
 * - **A place not yet settled** reads the ground its layout would start with, without placing a Token
 *   (`Layout.groundCounts`): the cell's mat (`cellMat.js`) as its one recipe, budgeted, and its water
 *   and Stone drawn with the cell's own seed. A world cell has one biome, so that is all its ground.
 *   ⚠️ Settling writes the place with the first of a few seeds whose layout fits every Token
 *   (`Settling.seedFor`), and this reads the first: a place whose first layout leaves a Token out
 *   would settle with somewhat different ground. About 2 ms a cell, read once per cell.
 */

const skillOf = (typeId) => getTokenType(typeId)?.config?.skill || null;

/** Cell counts by world cell; a world never changes. */
const counted = new WeakMap();

/** The ground counts, `{ water, stone, land, cells }`, of a cell not yet settled. */
export function cellGroundCounts(cell) {
    if (!cell) return null;
    if (counted.has(cell)) return counted.get(cell);
    const tables = worldTables();
    const hall = currentWorld()?.cells.find(c => c.ring === 0);
    const { recipes } = recipesOfCell(cell, { tables, skillOf, hallOrigins: (hall?.origins || []).map(o => o.id) });
    const counts = groundCounts(budget(recipes, { cap: matCap() }), { seed: cell.seed >>> 0, mat: shippedMat() });
    counted.set(cell, counts);
    return counts;
}

/**
 * Counts as whole percentages that add up to 100 (largest remainder), `{ water, grass, stone }`. No
 * cells at all reads as all grass.
 */
export function groundShares(counts) {
    if (!(counts?.cells > 0)) return { water: 0, grass: 100, stone: 0 };
    return apportion({ water: counts.water, grass: counts.land, stone: counts.stone }, 100);
}

/**
 * The ground dials of world cell `id`, `{ water, grass, stone }` in whole percent, or null with no
 * such cell: its Region's stored ground once settled, else what settling it would write.
 */
export function placeGround(id, world = currentWorld()) {
    const cell = world?.cells.find(c => c.id === id);
    if (!cell) return null;
    const regionId = regionIdOfCell(id);
    if (regionId) return groundShares(regionGroundCounts(Atlas.getRegion(regionId)));
    // The Hall's cell is always the Starter Camp's; without one it is the meadow it is drawn as.
    if (cell.ring === 0) return groundShares(null);
    return groundShares(cellGroundCounts(cell));
}
