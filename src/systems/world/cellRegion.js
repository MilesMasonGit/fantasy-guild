// a world cell's mat as the recipes its Region is written from (pure)

import { cellMat } from './cellMat.js';

/**
 * Settling a cell writes its Region through the Atlas's generation (`Budget.js` → `Layout.js`):
 * one base recipe holding exactly the mat's natural work (`cellMat.js`), on its kit's ground, with
 * its camps, chests, Stone and any odd water. The arrival's enemies are not in the recipe: they
 * come onto the mat once the guild is there (`Arrival.js`).
 *
 * Pure: the caller hands it the tables, the Token skills and the name.
 */

/** The base recipe's id: one per cell, so two Regions of one cell would read as the same place. */
export function cellRecipeId(cell) {
    return `world_cell_${cell.id}`;
}

/**
 * The recipes a mat is written from: its one base recipe. With one base recipe Budget writes each
 * node exactly as many times as its weight, the points being their sum.
 *
 * @param {object} mat a {@link cellMat} result
 * @param {{id: string, name?: string}} options
 * @returns {object[]}
 */
export function recipesOfMat(mat, { id, name = '' }) {
    const nodes = mat.nodes.map(n => ({ typeId: n.typeId, weight: n.count }));
    const base = {
        id,
        kind: 'base',
        name,
        biome: mat.biome,
        points: nodes.reduce((sum, n) => sum + n.weight, 0),
        nodes
    };
    if (mat.camps.length) base.camps = mat.camps.map(c => ({ ...c }));
    if (mat.treasures.length) base.treasures = mat.treasures.map(t => ({ ...t }));
    if (mat.water !== null) base.water = mat.water;
    if (mat.inland) base.inland = mat.inland;
    if (mat.stone.outcrops > 0 || mat.stone.ridge) base.stone = { ...mat.stone };
    return [base];
}

/**
 * A cell's mat and the recipes it is written from.
 *
 * @param {object} cell a world cell
 * @param {object} lookups
 * @param {object} lookups.tables normalised world tables
 * @param {(typeId: string) => string|null} lookups.skillOf a Token's work skill
 * @param {string[]} [lookups.hallOrigins] the Hall's cell's origins
 * @param {string} [lookups.name] what the Region's practical name calls the base recipe
 * @returns {{mat: object, recipes: object[]}}
 */
export function recipesOfCell(cell, { tables, skillOf, hallOrigins = [], name = '' }) {
    const mat = cellMat(cell, tables, { skillOf, hallOrigins });
    return { mat, recipes: recipesOfMat(mat, { id: cellRecipeId(cell), name }) };
}
