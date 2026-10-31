// a world cell as the recipes its Region is written from: a stand-in until the mat is written from the cell (pure)

import { ORIGIN_ROLE } from './generate.js';

/**
 * ⚠️ A stand-in. Settling a cell writes its Region the way a map wrote one: one Base Map recipe
 * made of the cell's origins (`Budget.js`'s shape), plus each hidden extra (a modifier through its
 * own recipe, a treasure as a treasure). Kits, the specialty's better things, the arrival
 * encounter and the wild extremes are not read yet: writing the mat from the cell replaces this.
 *
 * Pure: the caller hands it the modifier recipes and the names.
 */

/** How many nodes a cell writes, as one of today's maps does. */
export const CELL_POINTS = 40;

/** How heavily each kind of origin is written: the cell's own line first. */
export const ROLE_WEIGHT = Object.freeze({
    [ORIGIN_ROLE.MAIN]: 3,
    [ORIGIN_ROLE.KEY]: 3,
    [ORIGIN_ROLE.BLEND]: 1,
    [ORIGIN_ROLE.HALL]: 1
});

/** The ground each kit stands on, among today's biomes (`Budget.BIOME_GROUND`). */
export const KIT_BIOME = Object.freeze({
    highland: 'mountain',
    woodland: 'forest',
    plains: 'meadow',
    wetland: 'bog',
    riverside: 'coast'
});

export const DEFAULT_BIOME = 'meadow';

/** The base recipe's id: one per cell, so two Regions of one cell would read as the same map. */
export function cellRecipeId(cell) {
    return `world_cell_${cell.id}`;
}

/**
 * The recipes a cell's Region is written from: its base recipe first, then one per hidden modifier.
 *
 * @param {object} cell a world cell
 * @param {object} [lookups]
 * @param {(itemId: string) => object|null} [lookups.modifierRecipe] a modifier's recipe, or null
 * @param {string} [lookups.name] what the Region's practical name calls the base recipe
 * @returns {object[]}
 */
export function recipesOfCell(cell, { modifierRecipe = () => null, name = '' } = {}) {
    const nodes = [];
    for (const o of cell?.origins || []) {
        if (!nodes.some(n => n.typeId === o.id)) nodes.push({ typeId: o.id, weight: ROLE_WEIGHT[o.role] ?? 1 });
    }
    const treasures = [];
    const modifiers = [];
    for (const extra of cell?.extras || []) {
        if (extra.kind === 'treasure') {
            const row = treasures.find(t => t.typeId === extra.id);
            if (row) row.count++; else treasures.push({ typeId: extra.id, count: 1 });
        } else if (extra.kind === 'modifier') {
            const recipe = modifierRecipe(extra.id);
            if (recipe) modifiers.push(recipe);
        }
    }
    const base = {
        id: cellRecipeId(cell),
        kind: 'base',
        name,
        biome: KIT_BIOME[cell?.kit] || DEFAULT_BIOME,
        points: CELL_POINTS,
        nodes
    };
    if (treasures.length) base.treasures = treasures;
    return [base, ...modifiers];
}
