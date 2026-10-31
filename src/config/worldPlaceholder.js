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
    kits: [
        { id: 'highland', name: 'Highland' },
        { id: 'woodland', name: 'Woodland' },
        { id: 'plains', name: 'Plains' },
        { id: 'wetland', name: 'Wetland' },
        { id: 'riverside', name: 'Riverside' }
    ],
    specialties: ['mining', 'forestry', 'farming', 'fishing', 'alchemy', 'combat'],
    pityWindow: 4,
    extras: [
        { id: 'mod_rich_veins', kind: 'modifier', value: 10, lines: ['ores'] },
        { id: 'mod_overgrown', kind: 'modifier', value: 10, lines: ['trees'] },
        { id: 'mod_bountiful', kind: 'modifier', value: 10, lines: ['crops'] },
        { id: 'mod_teeming_waters', kind: 'modifier', value: 10, lines: ['waters'] },
        { id: 'mod_goblin_camp', kind: 'modifier', value: 8 },
        { id: 'mod_wolf_den', kind: 'modifier', value: 8, lines: ['trees', 'arcane'] },
        { id: 'mod_crab_rocks', kind: 'modifier', value: 8, lines: ['waters'] },
        { id: 'mod_wild_hive', kind: 'modifier', value: 8, lines: ['crops', 'herbs'] },
        { id: 'mod_cow_pasture', kind: 'modifier', value: 8, lines: ['crops'] },
        { id: 'mod_thorn_thicket', kind: 'modifier', value: 8, lines: ['herbs', 'arcane'] },
        { id: 'mod_ember_vents', kind: 'modifier', value: 8, rings: [2, 3], lines: ['ores', 'arcane'] },
        { id: 'mod_sulphur_rocks', kind: 'modifier', value: 8, rings: [2, 3] },
        { id: 'mod_frog_pond', kind: 'modifier', value: 8, rings: [2, 3], lines: ['herbs', 'waters'] },
        { id: 'token_copper_chest', kind: 'treasure', value: 6, rings: [1, 2], max: 2 },
        { id: 'token_iron_chest', kind: 'treasure', value: 12, rings: [2, 3], max: 2 }
    ],
    ringValue: { 1: 16, 2: 24, 3: 32 },
    valueTolerance: 0.1,
    prices: {
        1: { items: [{ qty: 20 }, { qty: 10 }], skills: [{ skill: 'line', level: 5 }] },
        2: { items: [{ qty: 40 }, { qty: 20 }, { qty: 20, from: 'hall' }], skills: [{ skill: 'line', level: 15 }] },
        3: { items: [{ qty: 80 }, { qty: 40 }, { qty: 40, from: 'hall' }], skills: [{ skill: 'line', level: 30 }] }
    },
    wild: {
        rings: 3, priceGrowth: 1.5, levelStep: 10, valueGrowth: 1.5, extremeShare: 0.5,
        // The owner's odd layouts: islands, a chasm, mostly water, little building room.
        layouts: [{ id: 'islands', weight: 1 }, { id: 'chasm', weight: 1 }, { id: 'mostly_water', weight: 1 }, { id: 'cramped', weight: 1 }]
    }
});
