// Fantasy Guild — sample map ingredients for the Atlas generation tests

/**
 * Ingredients in the generation engine's internal recipe shape (see the header of
 * `src/systems/atlas/Budget.js`), standing in for what A5's adapter will make of the owner's
 * authored maps. The ids name today's Tokens so the printed preview reads like the game; the
 * numbers are placeholders, not content.
 *
 * **For tests only.**
 */

export const FOREST = Object.freeze({
    id: 'map_forest', kind: 'base', biome: 'forest', points: 40,
    nodes: [
        { typeId: 'token_oak_tree', weight: 6 },
        { typeId: 'token_redberry_bush', weight: 1 },
        { typeId: 'token_blackberry_bush', weight: 1 }
    ]
});

export const MOUNTAIN = Object.freeze({
    id: 'map_mountain', kind: 'base', biome: 'mountain', points: 36,
    nodes: [
        { typeId: 'token_copper_ore_vein', weight: 3 },
        { typeId: 'token_coal_vein', weight: 2 },
        { typeId: 'token_stone_outcrop', weight: 2 }
    ]
});

export const COAST = Object.freeze({
    id: 'map_coast', kind: 'base', biome: 'coast', points: 12,
    nodes: [{ typeId: 'token_coast', weight: 1 }]
});

/** The Forest with 16 more Oaks. */
export const OVERGROWN_FOREST = Object.freeze({
    ...FOREST, id: 'map_overgrown_forest', points: 56,
    nodes: [
        { typeId: 'token_oak_tree', weight: 46 },
        { typeId: 'token_redberry_bush', weight: 5 },
        { typeId: 'token_blackberry_bush', weight: 5 }
    ]
});

/** A map with an enemy camp of its own. */
export const withGoblinCamp = (map) => ({ ...map, camps: [{ typeId: 'token_goblin_camp', count: 1 }] });

/** A map with a treasure of its own. */
export const withRuins = (map) => ({ ...map, treasures: [{ typeId: 'token_ruins', count: 1 }] });
