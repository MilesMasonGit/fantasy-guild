// The world tables until the CMS holds them: placeholder content from today's Tokens

/**
 * ⚠️ PLACEHOLDER. The owner ruled that the world's content (which origins sit in which ring of each
 * wedge, the kits, the prices, the extras' values) comes through the ledger as a CMS pack (brief 330
 * W6). Until `data/world.json` exists the game generates from these tables, so the machinery runs
 * on something readable. Every number here is a stand-in; nothing here is a design decision.
 *
 * Today's Tokens fill what they can: Herbs has one herb, Arcane has nothing yet, so those wedges
 * generate with holes the world lists as problems.
 *
 * Shape: `worldTablesShape.js`.
 */

const w = (id, weight = 1) => ({ id, weight });

export const PLACEHOLDER_WORLD_TABLES = Object.freeze({
    version: 1,
    lines: [
        {
            id: 'ores', name: 'Ores', skill: 'mining', kits: { highland: 3, riverside: 1 },
            origins: {
                1: [w('token_copper_ore_vein', 3), w('token_coal_vein', 2), w('token_stone_outcrop', 2), w('token_clay_deposit')],
                2: [w('token_iron_ore_vein', 3), w('token_quartz_deposit')],
                3: [w('token_silver_ore_vein'), w('token_gold_ore_vein'), w('token_mythril_ore_vein')]
            }
        },
        {
            id: 'trees', name: 'Trees', skill: 'forestry', kits: { woodland: 3, highland: 1 },
            origins: {
                1: [w('token_oak_tree')],
                2: [w('token_fir_tree', 2), w('token_birch_tree')],
                3: [w('token_maple_tree'), w('token_cedar_tree'), w('token_mahogany_tree')]
            }
        },
        {
            id: 'crops', name: 'Crops', skill: 'farming', kits: { plains: 3, woodland: 1 },
            origins: {
                1: [w('token_apple_tree', 2), w('token_redberry_bush'), w('token_blackberry_bush'), w('token_wild_wheat_patch')],
                2: [w('token_grapevine'), w('token_cherry_tree'), w('token_strawberry_bush'), w('token_blueberry_bush')],
                3: [w('token_peach_tree')]
            }
        },
        {
            id: 'herbs', name: 'Herbs', skill: 'alchemy', kits: { wetland: 3, plains: 1 },
            origins: { 1: [], 2: [w('token_wild_lavender')], 3: [] }
        },
        {
            id: 'waters', name: 'Waters', skill: 'fishing', kits: { riverside: 3, wetland: 1 },
            origins: {
                1: [w('token_coast')],
                2: [w('token_river'), w('token_lake')],
                3: [w('token_bog_pool')]
            }
        },
        {
            id: 'arcane', name: 'Arcane', skill: 'magic',
            kits: { highland: 1, woodland: 1, plains: 1, wetland: 1, riverside: 1 },
            origins: { 1: [], 2: [], 3: [] }
        }
    ],
    // The owner's example: Waters beside Herbs and Crops, Arcane anywhere.
    neighbours: [{ a: 'waters', b: 'herbs', weight: 1 }, { a: 'waters', b: 'crops', weight: 1 }],
    neighbourStrength: 8,
    mainPerCell: 1,
    blendsPerNeighbour: 1,
    // The owner's example: the second ring always offers iron and fir.
    keys: { 1: [], 2: ['token_iron_ore_vein', 'token_fir_tree'], 3: [] },
    // Each kit covers most skills in its own balance, four and a half heroes' work (a specialty
    // may add one), on its own ground;
    // Highland leans to stone, Riverside to water (owner). Creatures spread by biome.
    kits: [
        {
            id: 'highland', name: 'Highland', biome: 'mountain', stone: 5,
            work: { mining: 2, forestry: 1, farming: 0.5, fishing: 0.5, combat: 0.5 },
            camps: ['token_goblin_camp'], bossCamps: ['token_chief_tent']
        },
        {
            id: 'woodland', name: 'Woodland', biome: 'forest', stone: 2,
            work: { forestry: 2, mining: 1, farming: 0.5, fishing: 0.5, combat: 0.5 },
            camps: ['token_wolf_den'], bossCamps: ['token_alpha_den']
        },
        {
            id: 'plains', name: 'Plains', biome: 'meadow', stone: 1,
            work: { farming: 2, forestry: 1, mining: 0.5, fishing: 0.5, combat: 0.5 },
            camps: ['token_wild_hive'], bossCamps: ['token_queens_hive']
        },
        {
            id: 'wetland', name: 'Wetland', biome: 'bog', stone: 1,
            work: { alchemy: 1, fishing: 1, farming: 1, forestry: 0.5, combat: 0.5 },
            camps: ['token_thorn_thicket'], bossCamps: ['token_slime_pit']
        },
        {
            id: 'riverside', name: 'Riverside', biome: 'coast', stone: 2,
            work: { fishing: 2, farming: 1, forestry: 0.5, mining: 0.5, combat: 0.5 },
            camps: ['token_crab_rocks'], bossCamps: ['token_tide_pool']
        }
    ],
    // The study's "one hero working without waiting": five veins, four trees, two waters, one camp.
    heroTokens: { mining: 5, forestry: 4, farming: 3, fishing: 2, alchemy: 3, combat: 1 },
    specialtyHeroes: 1,
    // A handful of enemies sized to the ring, sometimes a boss (owner: 3 to 6, no respawn).
    arrival: {
        1: { count: [3, 4], enemies: [w('token_goblin', 3), w('token_wolf'), w('token_crab')], bossChance: 0, bosses: [] },
        2: {
            count: [4, 5], enemies: [w('token_goblin', 2), w('token_wolf', 2), w('token_crab'), w('token_bee')],
            bossChance: 0.3, bosses: [w('token_wolf_alpha'), w('token_greater_slime')]
        },
        3: {
            count: [5, 6], enemies: [w('token_bee'), w('token_frog', 2), w('token_sulphur_lizard'), w('token_fire_elemental')],
            bossChance: 0.5, bosses: [w('token_water_elemental'), w('token_wind_elemental'), w('token_queen_bee'), w('token_goblin_chief')]
        }
    },
    specialties: ['mining', 'forestry', 'farming', 'fishing', 'alchemy', 'combat'],
    pityWindow: 4,
    extras: [
        { id: 'token_copper_chest', kind: 'treasure', value: 6, rings: [1, 2], max: 2 },
        { id: 'token_iron_chest', kind: 'treasure', value: 12, rings: [2, 3], max: 2 }
    ],
    ringValue: { 1: 6, 2: 12, 3: 12 },
    valueTolerance: 0.1,
    prices: {
        1: { items: [{ qty: 20 }, { qty: 10 }], skills: [{ skill: 'line', level: 5 }] },
        2: { items: [{ qty: 40 }, { qty: 20 }, { qty: 20, from: 'hall' }], skills: [{ skill: 'line', level: 15 }] },
        3: { items: [{ qty: 80 }, { qty: 40 }, { qty: 40, from: 'hall' }], skills: [{ skill: 'line', level: 30 }] }
    },
    wild: {
        rings: 3, priceGrowth: 1.5, levelStep: 10, valueGrowth: 1.5, extremeShare: 0.5, compositionShare: 0.75,
        // The owner's odd layouts: islands, a chasm, mostly water, little building room.
        layouts: [{ id: 'islands', weight: 1 }, { id: 'chasm', weight: 1 }, { id: 'mostly_water', weight: 1 }, { id: 'cramped', weight: 1 }]
    }
});
