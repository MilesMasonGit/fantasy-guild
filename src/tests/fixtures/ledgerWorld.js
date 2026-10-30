// Fantasy Guild — test fixture: a small world for the ledger's reach and tree engines.
//
// A Starter Camp of copper, coal and oak with a Furnace and a Goblin Camp; a Shop that sells a
// Foundation the Smithy is built on; the tutorial's Mountain Map (plane 1), whose Chief's Tent spawns
// the Goblin Chief, whose first kill always drops the Volcano Map (plane 2), the only map with iron;
// water with a baited pool; a bonus drop; Passive Production; a luck-only drop; an item nothing
// makes; and one Planned stub of each kind.

const out = (itemId, chance = 100, minQty = 1, maxQty = minQty, extra = {}) => ({ itemId, chance, minQty, maxQty, ...extra });
const work = (skill, skillRequired, cycleTimeMs, outputs, inputs = []) => ({ skill, skillRequired, cycleTimeMs, xp: 1, inputs, outputs });
const station = (skill, stationKind) => ({ keyword: 'station', payload: stationKind ? { skill, stationKind } : { skill } });

export const PLAN_ITEMS = {
    item_copper_ore: { id: 'item_copper_ore', name: 'Copper Ore', type: 'material', plan: { tier: 0 } },
    item_coal: { id: 'item_coal', name: 'Coal', type: 'material' },
    item_oak_wood: { id: 'item_oak_wood', name: 'Oak Wood', type: 'material' },
    item_copper_ingot: { id: 'item_copper_ingot', name: 'Copper Ingot', type: 'material' },
    item_iron_ore: { id: 'item_iron_ore', name: 'Iron Ore', type: 'material', plan: { status: 'live', tier: 2 } },
    item_iron_ingot: { id: 'item_iron_ingot', name: 'Iron Ingot', type: 'material', plan: { tier: 2 }, valueSource: 'recipe_iron_ingot' },
    item_bones: { id: 'item_bones', name: 'Bones', type: 'material' },
    item_honey: { id: 'item_honey', name: 'Honey', type: 'food' },
    item_gem: { id: 'item_gem', name: 'Gem', type: 'treasure', plan: { status: 'parked' } },
    item_shrimp: { id: 'item_shrimp', name: 'Shrimp', type: 'food' },
    item_trout: { id: 'item_trout', name: 'Trout', type: 'food' },
    item_worm: { id: 'item_worm', name: 'Worm', type: 'material' },
    item_seed: { id: 'item_seed', name: 'Seed', type: 'material' },
    item_bird_nest: { id: 'item_bird_nest', name: 'Bird Nest', type: 'material' },
    item_copper_pickaxe: { id: 'item_copper_pickaxe', name: 'Copper Pickaxe', type: 'tool', equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 1, starter: true } },
    item_copper_woodaxe: { id: 'item_copper_woodaxe', name: 'Copper Woodaxe', type: 'tool', equipSlot: 'hand', tool: { kind: 'woodaxe', tier: 1, starter: true } },
    item_copper_sickle: { id: 'item_copper_sickle', name: 'Copper Sickle', type: 'tool', equipSlot: 'hand', tool: { kind: 'sickle', tier: 1, starter: true } },
    item_fishing_rod: { id: 'item_fishing_rod', name: 'Fishing Rod', type: 'tool', equipSlot: 'hand', tool: { kind: 'fishing_rod', tier: 1, starter: true } },
    item_iron_pickaxe: { id: 'item_iron_pickaxe', name: 'Iron Pickaxe', type: 'tool', equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 2 } },
    map_mountain: {
        id: 'map_mountain', name: 'Mountain Map', type: 'map', plan: { tier: 1 },
        cartography: { biome: 'mountain', points: 40, tutorial: true, nodes: [{ typeId: 'token_copper_vein', weight: 3 }], camps: [{ typeId: 'token_chief_tent', count: 1 }] },
    },
    map_volcano: {
        id: 'map_volcano', name: 'Volcano Map', type: 'map', plan: { tier: 2 },
        cartography: { biome: 'volcano', points: 40, bountyWeight: 0, nodes: [{ typeId: 'token_iron_vein', weight: 3 }, { typeId: 'token_coal_vein', weight: 1 }, { typeId: 'token_wild_hive', weight: 1 }] },
    },
    mod_deep_veins: {
        id: 'mod_deep_veins', name: 'Deep Veins', type: 'modifier', plan: { tier: 1 },
        cartography: { bountyWeight: 0, effects: [{ kind: 'density', typeId: 'token_copper_vein', points: 10 }] },
    },
    item_water: { id: 'item_water', name: 'Water', type: 'drink' },
    item_wheat: { id: 'item_wheat', name: 'Wheat', type: 'material' },
    item_wheat_seed: { id: 'item_wheat_seed', name: 'Wheat Seed', type: 'material' },
    item_mythril_ore: { id: 'item_mythril_ore', name: 'Mythril Ore', type: 'material', plan: { status: 'planned', tier: 3, note: 'plane 3' } },
};

export const PLAN_TOKENS = {
    token_guild_hall: { id: 'token_guild_hall', name: 'Guild Hall', trickle: [{ itemId: 'item_seed', quantity: 2 }] },
    token_copper_vein: { id: 'token_copper_vein', name: 'Copper Vein', needsTool: { kind: 'pickaxe', minTier: 1 }, config: work('mining', 1, 6000, [out('item_copper_ore', 100, 1, 2)]) },
    token_coal_vein: { id: 'token_coal_vein', name: 'Coal Vein', needsTool: { kind: 'pickaxe', minTier: 1 }, config: work('mining', 1, 4000, [out('item_coal')]) },
    token_iron_vein: {
        id: 'token_iron_vein', name: 'Iron Vein', needsTool: { kind: 'pickaxe', minTier: 1 }, config: work('mining', 15, 12000, [out('item_iron_ore')]),
        statements: [{ keyword: 'spawns', payload: { typeId: 'token_fire_elemental', placement: 'nearest_free', chance: 2 }, when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self' } }],
    },
    token_fire_elemental: { id: 'token_fire_elemental', name: 'Fire Elemental', enemy: { level: 17, style: 'magic' }, config: work('', 1, 12000, [out('item_bones')]) },
    token_wild_hive: { id: 'token_wild_hive', name: 'Wild Hive', config: work('farming', 1, 20000, [out('item_honey')]) },
    token_wild_patch: {
        id: 'token_wild_patch', name: 'Wild Wheat Patch', needsTool: { kind: 'sickle', minTier: 1 },
        statements: [station('farming', 'field')], field: { startsWith: 'recipe_wheat' }, config: work('farming', 1, 10000, []),
    },
    token_oak_tree: {
        id: 'token_oak_tree', name: 'Oak Tree', needsTool: { kind: 'woodaxe', minTier: 1 },
        config: work('forestry', 1, 5000, [out('item_oak_wood')]),
        respawn: { mode: 'regrow', into: 'token_oak_stump' },
    },
    token_oak_stump: { id: 'token_oak_stump', name: 'Oak Stump', grows: { into: 'token_oak_sapling', afterMs: 1000, cost: [{ itemId: 'item_seed', quantity: 1 }] } },
    token_oak_sapling: { id: 'token_oak_sapling', name: 'Oak Sapling', grows: { into: 'token_oak_tree', afterMs: 1000 } },
    token_furnace: { id: 'token_furnace', name: 'Furnace', statements: [station('smithing', 'furnace')], config: work('smithing', 1, 9000, []) },
    token_smithy: { id: 'token_smithy', name: 'Smithy', statements: [station('smithing', 'smithy')], config: work('smithing', 1, 9000, []) },
    token_idle_anvil: { id: 'token_idle_anvil', name: 'Idle Anvil', statements: [station('smithing', 'smithy')], config: null, shop: { price: [], section: 'general' } },
    token_wood_foundation: { id: 'token_wood_foundation', name: 'Wood Foundation', foundation: { kind: 'wood', skill: 'construction' }, shop: { price: [{ itemId: 'item_oak_wood', quantity: 15 }], section: 'construction' } },
    token_goblin_camp: { id: 'token_goblin_camp', name: 'Goblin Camp', spawner: { spawns: [{ typeId: 'token_goblin', weight: 1 }], allowance: 3, intervalMs: 30000, upkeep: [] } },
    token_goblin: {
        id: 'token_goblin', name: 'Goblin', enemy: { level: 5, style: 'melee' },
        config: work('', 1, 12000, [out('item_bones'), out('item_honey', 3)]),
    },
    token_chief_tent: { id: 'token_chief_tent', name: "Chief's Tent", spawner: { spawns: [{ typeId: 'token_goblin_chief', weight: 1 }], allowance: 1, intervalMs: 300000, upkeep: [] } },
    token_goblin_chief: {
        id: 'token_goblin_chief', name: 'Goblin Chief', enemy: { level: 20, style: 'melee', boss: true },
        config: work('', 1, 12000, [out('item_bones'), out('map_volcano', 3, 1, 1, { firstKill: true })]),
    },
    token_coast: {
        id: 'token_coast', name: 'Coast', config: work('fishing', 1, 8000, []),
        catchPools: [
            { tool: 'fishing_rod', bait: null, catches: [{ itemId: 'item_shrimp', weight: 1 }] },
            { tool: 'fishing_rod', bait: 'item_worm', catches: [{ itemId: 'item_trout', weight: 1 }] },
        ],
    },
    token_birdwatcher: {
        id: 'token_birdwatcher', name: 'Birdwatcher',
        statements: [{ keyword: 'grants', payload: { type: 'BONUS_DROP', itemId: 'item_bird_nest', quantity: 1, chance: 25 }, to: { mode: 'id', value: 'token_oak_tree' } }],
        shop: { price: [{ itemId: 'item_copper_ingot', quantity: 2 }], section: 'general' },
    },
    token_mythril_vein: { id: 'token_mythril_vein', name: 'Mythril Vein', plan: { status: 'planned', tier: 3 } },
};

export const PLAN_RECIPES = [
    { id: 'recipe_copper_ingot', name: 'Copper Ingot', skill: 'smithing', levelRequirement: 1, durationMs: 9000, stationKinds: ['furnace'], inputs: [{ itemId: 'item_copper_ore', quantity: 2 }, { itemId: 'item_coal', quantity: 1 }], outputs: [out('item_copper_ingot')] },
    { id: 'recipe_iron_ingot', name: 'Iron Ingot', skill: 'smithing', levelRequirement: 15, durationMs: 18000, stationKinds: ['furnace'], inputs: [{ itemId: 'item_iron_ore', quantity: 2 }, { itemId: 'item_coal', quantity: 2 }], outputs: [out('item_iron_ingot')] },
    { id: 'recipe_iron_pickaxe', name: 'Iron Pickaxe', skill: 'smithing', levelRequirement: 16, durationMs: 30000, stationKinds: ['smithy'], inputs: [{ itemId: 'item_iron_ingot', quantity: 3 }, { itemId: 'item_oak_wood', quantity: 1 }], outputs: [out('item_iron_pickaxe')] },
    { id: 'recipe_build_smithy', name: 'Build Smithy', skill: 'construction', levelRequirement: 3, durationMs: 20000, foundationKinds: ['wood'], inputs: [{ itemId: 'item_copper_ingot', quantity: 5 }], outputs: [{ tokenId: 'token_smithy', chance: 100, minQty: 1, maxQty: 1 }] },
    { id: 'recipe_wheat', name: 'Wheat', skill: 'farming', levelRequirement: 1, durationMs: 10000, stationKinds: ['field'], crop: { growMs: 60000, load: 10 }, inputs: [{ itemId: 'item_wheat_seed', quantity: 1 }], outputs: [out('item_wheat', 100, 1, 2), out('item_wheat_seed', 40)] },
    // A Planned recipe makes nothing, whatever it says.
    { id: 'recipe_mythril_bar', name: 'Mythril Bar', skill: 'smithing', inputs: [], outputs: [out('item_gem')], plan: { status: 'planned', tier: 3 } },
];

export const PLAN_STARTER_CAMP = {
    tokens: [
        { typeId: 'token_copper_vein', x: 100, y: 100 },
        { typeId: 'token_coal_vein', x: 200, y: 100 },
        { typeId: 'token_oak_tree', x: 300, y: 100 },
        { typeId: 'token_oak_tree', x: 400, y: 100 },
        { typeId: 'token_furnace', x: 500, y: 100 },
        { typeId: 'token_goblin_camp', x: 600, y: 100 },
        { typeId: 'token_coast', x: 700, y: 100 },
        { typeId: 'token_wild_patch', x: 800, y: 100 },
    ],
    bank: { item_worm: 5 },
};

/** The whole fixture, in the shape the CMS store holds it (recipes in skill pools). */
export function ledgerWorkspace() {
    const recipePools = {};
    for (const recipe of PLAN_RECIPES) (recipePools[recipe.skill] ||= []).push(structuredClone(recipe));
    return {
        items: structuredClone(PLAN_ITEMS),
        tokens: structuredClone(PLAN_TOKENS),
        recipePools,
        effects: {},
        starterCamp: structuredClone(PLAN_STARTER_CAMP),
    };
}

/** The fixture with an Iron Chest (one Charge, never back) as a treasure on the Mountain Map. */
export function withIronChest() {
    const ws = ledgerWorkspace();
    ws.tokens.token_iron_chest = {
        id: 'token_iron_chest', name: 'Iron Chest', uses: 1,
        config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: 'item_iron_ore', chance: 100, minQty: 4, maxQty: 8 }] },
    };
    ws.items.map_mountain.cartography.treasures = [{ typeId: 'token_iron_chest', count: 1 }];
    return ws;
}
