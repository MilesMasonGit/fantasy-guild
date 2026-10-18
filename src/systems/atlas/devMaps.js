// placeholder map recipes for the dev console, and a layout drawn in text

import { HALL_CLEARING } from './Layout.js';
import { terrainAt } from './TerrainMap.js';
import { WATER_KIND } from './WaterShapes.js';

/**
 * Map recipes for trying the Atlas from the dev console in a game with no authored map items:
 * `Game.Atlas.devGrantMaps()`, `devPreview(['forest', 'overgrown'])`, `devSettle(...)`. They name
 * today's Tokens; every number is a placeholder, not content.
 *
 * The Overgrown here also carries a Region rule, +10 % Forestry yield, so a Region rule can be
 * seen applying and dropping as the guild travels. The `water_*` maps are a biome's map that names
 * one variety of its water (`inland`), for the dev panel's water views.
 */

export const DEV_RULE_FORESTRY_YIELD = Object.freeze({
    id: 'stm_dev_region_forestry', keyword: 'provides',
    payload: Object.freeze({ type: 'YIELD', bucket: 'percentage', value: 0.1, category: 'forestry' })
});

const BASE_MAPS = Object.freeze({
    forest: Object.freeze({
        id: 'dev_map_forest', name: 'Forest Map', kind: 'base', biome: 'forest', points: 40,
        nodes: [
            { typeId: 'token_oak_tree', weight: 6 },
            { typeId: 'token_redberry_bush', weight: 1 },
            { typeId: 'token_blackberry_bush', weight: 1 }
        ]
    }),
    mountain: Object.freeze({
        id: 'dev_map_mountain', name: 'Mountain Map', kind: 'base', biome: 'mountain', points: 36,
        nodes: [
            { typeId: 'token_copper_ore_vein', weight: 3 },
            { typeId: 'token_coal_vein', weight: 2 },
            { typeId: 'token_stone_outcrop', weight: 2 }
        ]
    }),
    coast: Object.freeze({
        id: 'dev_map_coast', name: 'Coast Map', kind: 'base', biome: 'coast', points: 12,
        nodes: [{ typeId: 'token_coast', weight: 1 }]
    }),
    meadow: Object.freeze({
        id: 'dev_map_meadow', name: 'Meadow Map', kind: 'base', biome: 'meadow', points: 20,
        nodes: [{ typeId: 'token_apple_tree', weight: 2 }, { typeId: 'token_redberry_bush', weight: 1 }]
    }),
    flower_meadow: Object.freeze({
        id: 'dev_map_flower_meadow', name: 'Flower Meadow Map', kind: 'base', biome: 'flower_meadow', points: 16,
        nodes: [
            { typeId: 'token_strawberry_bush', weight: 2 },
            { typeId: 'token_blueberry_bush', weight: 1 },
            { typeId: 'token_apple_tree', weight: 1 }
        ]
    }),
    cherry_grove: Object.freeze({
        id: 'dev_map_cherry_grove', name: 'Cherry Grove Map', kind: 'base', biome: 'cherry_grove', points: 20,
        nodes: [{ typeId: 'token_cherry_tree', weight: 4 }, { typeId: 'token_peach_tree', weight: 1 }]
    }),
    yellowstone: Object.freeze({
        id: 'dev_map_yellowstone', name: 'Yellowstone Map', kind: 'base', biome: 'yellowstone', points: 24,
        nodes: [{ typeId: 'token_fir_tree', weight: 4 }, { typeId: 'token_stone_outcrop', weight: 1 }]
    }),
    volcano: Object.freeze({
        id: 'dev_map_volcano', name: 'Volcano Map', kind: 'base', biome: 'volcano', points: 20,
        nodes: [
            { typeId: 'token_coal_vein', weight: 2 },
            { typeId: 'token_stone_outcrop', weight: 2 },
            { typeId: 'token_iron_ore_vein', weight: 1 }
        ]
    }),
    overgrown: Object.freeze({
        id: 'dev_mod_overgrown', name: 'Overgrown', kind: 'modifier',
        effects: [{ kind: 'density', typeId: 'token_oak_tree', points: 16 }],
        rules: [DEV_RULE_FORESTRY_YIELD]
    }),
    firGrove: Object.freeze({
        id: 'dev_mod_fir_grove', name: 'Fir Grove', kind: 'modifier',
        effects: [{ kind: 'replace', from: 'token_oak_tree', to: 'token_fir_tree' }]
    }),
    goblinCamp: Object.freeze({
        id: 'dev_mod_goblin_camp', name: 'Goblin Camp', kind: 'modifier',
        effects: [{ kind: 'threat', typeId: 'token_goblin_camp', count: 1 }]
    })
});

/** A biome's dev map naming one variety of water. */
const withWater = (base, kind) => Object.freeze({ ...BASE_MAPS[base], id: `dev_map_water_${kind}`, inland: kind });

export const DEV_MAPS = Object.freeze({
    ...BASE_MAPS,
    water_lake_river: withWater('meadow', WATER_KIND.LAKE_RIVER),
    water_lake: withWater('meadow', WATER_KIND.LAKE),
    water_river: withWater('meadow', WATER_KIND.RIVER),
    water_split: withWater('meadow', WATER_KIND.SPLIT),
    water_spring: withWater('meadow', WATER_KIND.SPRING),
    water_braided: withWater('mountain', WATER_KIND.BRAIDED),
    water_tarn: withWater('mountain', WATER_KIND.TARN),
    water_pond: withWater('forest', WATER_KIND.POND),
    water_sulphur: withWater('yellowstone', WATER_KIND.SULPHUR),
    // The Coast's sea, as its own view.
    water_sea: Object.freeze({ ...BASE_MAPS.coast, id: 'dev_map_water_sea' })
});

const GLYPHS = Object.freeze({
    token_oak_tree: 'O', token_fir_tree: 'F', token_redberry_bush: 'R', token_blackberry_bush: 'B',
    token_copper_ore_vein: 'C', token_coal_vein: 'K', token_stone_outcrop: 'S', token_goblin_camp: 'G',
    token_coast: 'W'
});
const GROUND = Object.freeze({ grass: ',', rock: '^', sand: ':', water: '~' });

/**
 * A layout in text, for the console: one character per 32 × 64 mat units (characters are about
 * twice as tall as wide), each Token's centre in capitals and the rest of its art in lower case,
 * the Hall `H` with its clearing blank; then the ground, one character per terrain cell.
 *
 * @param {object} result  a `Layout.layout()` result
 * @param {{artRadius?: (typeId: string) => number}} [options]
 * @returns {string}
 */
export function asciiLayout(result, { artRadius = () => 64 } = {}) {
    const { mat, hall, nodes } = result;
    const cell = 32;
    const glyph = (typeId) => GLYPHS[typeId] ?? '?';
    const sq = (n) => n * n;
    const tokens = [];
    for (let r = 0; r < Math.ceil(mat.h / (cell * 2)); r++) {
        let line = '';
        for (let c = 0; c < Math.ceil(mat.w / cell); c++) {
            const x = (c + 0.5) * cell;
            const y = (r + 0.5) * cell * 2;
            let ch = sq(x - hall.x) + sq(y - hall.y) < sq(HALL_CLEARING) ? ' ' : '.';
            let nearest = Infinity;
            for (const n of nodes) {
                const d = sq(x - n.x) + sq(y - n.y);
                if (d < 0.55 * sq(artRadius(n.typeId)) && d < nearest) {
                    nearest = d;
                    ch = glyph(n.typeId).toLowerCase();
                }
            }
            for (const n of nodes) {
                if (Math.floor(n.x / cell) === c && Math.floor(n.y / (cell * 2)) === r) ch = glyph(n.typeId);
            }
            if (Math.floor(hall.x / cell) === c && Math.floor(hall.y / (cell * 2)) === r) ch = 'H';
            line += ch;
        }
        tokens.push(line);
    }

    const ground = [];
    const { cols, rows, cell: side } = result.terrain;
    for (let r = 0; r < rows; r++) {
        let line = '';
        for (let c = 0; c < cols; c++) line += GROUND[terrainAt(result.terrain, (c + 0.5) * side, (r + 0.5) * side)] ?? '?';
        ground.push(line);
    }

    const legend = 'H Hall, O Oak, F Fir, R Redberry, B Blackberry, C Copper, K Coal, S Stone, G Goblin Camp, '
        + 'W Coast, ? other (capital: its centre; lower case: the rest of its art)';
    return [legend, ...tokens, '', 'Ground: , grass  ^ rock  : sand  ~ water', ...ground].join('\n');
}
