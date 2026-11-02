// Builds the W6 world content pack (brief 330 W6) from a worktree's data/ and cms/plan/plan.json.
//
//   node mkpack_w6.mjs <worktree> <out-dir>
//
// Writes <out-dir>/<pack id>.json (the pack, unstamped: run changePackTool stamp on it) and
// <out-dir>/workspace_applied.json (the workspace with every entry applied, for `world --from`).
// Reads only; the pack is the one thing it makes.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const [root, outDir] = process.argv.slice(2);
if (!root || !outDir) throw new Error('usage: node mkpack_w6.mjs <worktree> <out-dir>');
const mod = async (rel) => import(pathToFileURL(path.join(root, rel)).href);
const { workspaceFromDataFiles, currentValue, setValue, proposedValue } = await mod('cms/src/engine/changePacks.js');

const read = (rel, fallback) => (fs.existsSync(path.join(root, rel)) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : fallback);
const ws = workspaceFromDataFiles({
    items: read('data/items.json'), tokens: read('data/tokens.json'), effects: read('data/effects.json', {}),
    tokenRecipes: read('data/tokenRecipes.json', []), starterCamp: read('data/starterCamp.json', null),
    skillPerks: read('data/skillPerks.json', null), hallStars: read('data/hallStars.json', null),
    world: read('data/world.json', null), plan: read('cms/plan/plan.json', null),
});
const clone = (v) => JSON.parse(JSON.stringify(v));
const cur = (kind, id) => {
    const v = currentValue(ws, kind, id);
    if (!v) throw new Error(`not in the workspace: ${kind} ${id}`);
    return clone(v);
};
const entries = [];
const add = (e) => entries.push(e);
const w = (id, weight = 1) => ({ id, weight });
const drop = (itemId, chance) => ({ itemId, chance, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: true });
const tokenName = (id) => ws.tokens[id]?.name || id;

// ── 1. The world tables ────────────────────────────────────────────────────────────────────────
// Each origin sits in the ring of its plan tier (the owner: guaranteed in the inner ring matching its
// tier); tier-0 origins the Starter Camp already holds are copies there. Later rings may repeat an
// origin as an extra copy. Crops, Herbs, Waters and Arcane are placeholder lines (the owner settles
// Crops' and Herbs' tiers later; Arcane has no content of its own yet).
const camps1 = [
    'token_wolf_den', 'token_crab_rocks', 'token_wild_hive', 'token_cow_pasture', 'token_thorn_thicket',
    { id: 'token_alpha_den', kits: ['woodland'] }, { id: 'token_chief_tent', kits: ['highland'] },
    { id: 'token_tide_pool', kits: ['riverside'] }, { id: 'token_slime_pit', kits: ['wetland'] },
    { id: 'token_wind_stones', kits: ['highland'] }, { id: 'token_queens_hive', kits: ['plains'] }
];
const camps2 = [
    { id: 'token_ember_vents', kits: ['highland'] }, { id: 'token_sulphur_rocks', kits: ['highland'] },
    { id: 'token_frog_pond', kits: ['wetland'] }, { id: 'token_smoking_crater', kits: ['highland'] },
    { id: 'token_basking_stone', kits: ['plains'] }, { id: 'token_toxic_pool', kits: ['wetland'] }
];
const WORLD = {
    version: 1,
    lines: [
        {
            id: 'ores', name: 'Ores', skill: 'mining', kits: { highland: 3, riverside: 1 },
            origins: {
                1: [w('token_copper_ore_vein', 3), w('token_coal_vein', 2), w('token_stone_outcrop', 2)],
                2: [w('token_iron_ore_vein', 3)],
                3: [w('token_silver_ore_vein', 2), w('token_gold_ore_vein', 2), w('token_mythril_ore_vein', 2),
                    w('token_adamantium_ore'), w('token_darkmetal_ore_vein'), w('token_clay_deposit'), w('token_quartz_deposit')]
            }
        },
        {
            id: 'trees', name: 'Trees', skill: 'forestry', kits: { woodland: 3, highland: 1 },
            origins: {
                1: [w('token_oak_tree')],
                2: [w('token_fir_tree', 2)],
                3: [w('token_birch_tree', 2), w('token_maple_tree', 2), w('token_cedar_tree'), w('token_mahogany_tree'), w('token_ebony_tree')]
            }
        },
        {
            id: 'crops', name: 'Crops', skill: 'farming', kits: { plains: 3, woodland: 1 },
            origins: {
                1: [w('token_apple_tree', 2), w('token_blackberry_bush'), w('token_blueberry_bush'), w('token_strawberry_bush'),
                    w('token_cherry_tree'), w('token_peach_tree')],
                2: [w('token_grapevine', 2), w('token_cherry_tree'), w('token_strawberry_bush'), w('token_peach_tree')],
                3: [w('token_raspberry_bush'), w('token_pineapple_bush'), w('token_lemon_tree'), w('token_lime_tree'),
                    w('token_orange_tree'), w('token_watermelon_patch'), w('token_banana_tree'), w('token_coconut_tree')]
            }
        },
        {
            id: 'herbs', name: 'Herbs', skill: 'alchemy', kits: { wetland: 3, plains: 1 },
            origins: { 1: [w('token_wild_lavender')], 2: [w('token_wild_lavender')], 3: [w('token_wild_lavender')] }
        },
        {
            id: 'waters', name: 'Waters', skill: 'fishing', kits: { riverside: 3, wetland: 1 },
            origins: {
                1: [w('token_coast', 2), w('token_shrimp_coast')],
                2: [w('token_river', 2), w('token_lake', 2), w('token_bog_pool')],
                3: [w('token_river'), w('token_lake'), w('token_bog_pool')]
            }
        },
        {
            id: 'arcane', name: 'Arcane', skill: 'magic',
            kits: { highland: 1, woodland: 1, plains: 1, wetland: 1, riverside: 1 },
            origins: {
                1: [w('token_wishing_well')],
                2: [w('token_wishing_well'), w('token_quartz_deposit')],
                3: [w('token_quartz_deposit')]
            }
        }
    ],
    neighbours: [{ a: 'waters', b: 'herbs', weight: 1 }, { a: 'waters', b: 'crops', weight: 1 }],
    neighbourStrength: 8,
    mainPerCell: 1,
    blendsPerNeighbour: 1,
    keys: { 1: [], 2: ['token_iron_ore_vein', 'token_fir_tree'], 3: [] },
    kits: [
        { id: 'highland', name: 'Highland', biome: 'mountain', stone: 5,
            work: { mining: 2, forestry: 1, farming: 0.5, fishing: 0.5, combat: 0.5 },
            camps: ['token_goblin_camp'], bossCamps: ['token_chief_tent', 'token_wind_stones'] },
        { id: 'woodland', name: 'Woodland', biome: 'forest', stone: 2,
            work: { forestry: 2, mining: 1, farming: 0.5, fishing: 0.5, combat: 0.5 },
            camps: ['token_wolf_den'], bossCamps: ['token_alpha_den'] },
        { id: 'plains', name: 'Plains', biome: 'meadow', stone: 1,
            work: { farming: 2, forestry: 1, mining: 0.5, fishing: 0.5, combat: 0.5 },
            camps: ['token_wild_hive', 'token_cow_pasture'], bossCamps: ['token_queens_hive'] },
        { id: 'wetland', name: 'Wetland', biome: 'bog', stone: 1,
            work: { alchemy: 1, fishing: 1, farming: 1, forestry: 0.5, combat: 0.5 },
            camps: ['token_thorn_thicket'], bossCamps: ['token_slime_pit'] },
        { id: 'riverside', name: 'Riverside', biome: 'coast', stone: 2,
            work: { fishing: 2, farming: 1, forestry: 0.5, mining: 0.5, combat: 0.5 },
            camps: ['token_crab_rocks'], bossCamps: ['token_tide_pool'] }
    ],
    camps: { 1: camps1, 2: camps2, 3: [] },
    heroTokens: { mining: 5, forestry: 4, farming: 3, fishing: 2, alchemy: 3, combat: 1 },
    specialtyHeroes: 1,
    arrival: {
        1: { count: [3, 4], enemies: [w('token_goblin', 3), w('token_wolf', 2), w('token_crab', 2), w('token_bee'), w('token_thorn_elemental'), w('token_cow')],
            bossChance: 0, bosses: [] },
        2: { count: [4, 5], enemies: [w('token_wolf', 2), w('token_bee', 2), w('token_crab'), w('token_frog'), w('token_sulphur_lizard')],
            bossChance: 0.3, bosses: [w('token_wolf_alpha'), w('token_greater_slime'), w('token_water_elemental'), w('token_wind_elemental'), w('token_queen_bee')] },
        3: { count: [5, 6], enemies: [w('token_frog', 2), w('token_sulphur_lizard', 2), w('token_fire_elemental', 2), w('token_bee')],
            bossChance: 0.5, bosses: [w('token_goblin_chief'), w('token_toxic_frog'), w('token_big_lizard'), w('token_fire_elemental_chief')] }
    },
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
        2: { items: [{ qty: 60 }, { qty: 30 }, { qty: 30, from: 'hall' }], skills: [{ skill: 'line', level: 15 }] },
        3: { items: [{ qty: 150 }, { qty: 75 }, { qty: 75, from: 'hall' }], skills: [{ skill: 'line', level: 30 }] }
    },
    wild: {
        rings: 3, priceGrowth: 1.5, levelStep: 10, valueGrowth: 1.5, extremeShare: 0.5, compositionShare: 0.75,
        layouts: [{ id: 'islands', weight: 1 }, { id: 'chasm', weight: 1 }, { id: 'mostly_water', weight: 1 }, { id: 'cramped', weight: 1 }]
    }
};
add({
    op: ws.world ? 'edit' : 'create', kind: 'world', id: 'world', value: WORLD,
    note: 'The world tables, first content: every origin in the ring of its tier (tier-0 ones the Starter Camp holds repeated in ring 1); every creature camp guaranteed in the ring of its tier (11 in ring 1, 6 in ring 2); kits by biome; arrivals and prices per ring. Crops, Herbs, Waters and Arcane are placeholder lines: Herbs is Wild Lavender in every ring (so Alchemy can start in ring 1), Arcane borrows the Wishing Well and the Quartz Deposit until it has content of its own.'
});

// ── 2. Mines on Stone (the held W4 pack, with T-284: the Starter Camp's first mine needs no map) ──
const coalMap = 'item_coal_prospecting_map';
add({
    op: 'create', kind: 'item', id: coalMap,
    value: { id: coalMap, name: 'Coal Prospecting Map', description: 'Shows where coal lies under a Stone outcrop: a Build Coal Mine recipe spends one.',
        type: 'material', sprite: 't_map_mountain', stackable: true, restoreAmount: 0, equipSlot: '', value: 1, autoSyncId: true, tags: [],
        plan: { status: 'live', tier: 1, note: 'Prospecting map (brief 330 W6): Goblins drop it now and then, the Goblin Chief often.' } },
    note: 'The prospecting map a Coal Mine is built from (owner: metal mines need a prospecting map). Its source: Goblins (3 %) and the Goblin Chief (25 %).',
    placeholderArt: true
});
{
    const r = cur('recipe', 'recipe_build_coal_mine');
    r.inputs = [...r.inputs, { itemId: coalMap, quantity: 1 }];
    add({ op: 'edit', kind: 'recipe', id: r.id, value: r, note: 'Build Coal Mine also spends a Coal Prospecting Map.' });
}
for (const [id, why] of [
    ['token_copper_mine', 'Copper Mine stands only on Stone. Its recipe needs no prospecting map (owner, T-284: the Starter Camp\'s first mine), and the Starter Camp now has a Stone patch under it.'],
    ['token_coal_mine', 'Coal Mine stands only on Stone.'],
    ['token_quarry', 'Quarry stands only on Stone. Its recipe stays as it is: no unlock item (owner\'s table: basic).']
]) {
    const t = cur('token', id);
    t.standsOn = ['stone'];
    add({ op: 'edit', kind: 'token', id, value: t, note: why });
}

// ── 3. Creature banners: each creature's rare drop builds a copy of its camp (owner) ─────────────
// Everyday creatures 0.5 %, bosses 2 % (the old camp modifiers' chances); built on a Wood Foundation
// from the banner and 5 Oak Wood, Construction 1 (ring-1 camps) or 5 (ring-2 camps).
const CAMP_OF = {}; // enemy → its camp
for (const [id, def] of Object.entries(ws.tokens)) {
    for (const s of def.spawner?.spawns || []) if (ws.tokens[s.typeId]?.enemy) CAMP_OF[s.typeId] = id;
}
const tierOf = (def) => def?.plan?.tier ?? 1;
const enemyDrops = new Map(); // enemy id → extra outputs
const pushDrop = (enemy, out) => { if (!enemyDrops.has(enemy)) enemyDrops.set(enemy, []); enemyDrops.get(enemy).push(out); };
for (const [enemy, camp] of Object.entries(CAMP_OF).sort()) {
    const e = ws.tokens[enemy];
    const boss = e.enemy?.boss === true || ws.tokens[camp].spawner?.allowance === 1;
    const short = e.name;
    const banner = `item_${enemy.replace(/^token_/, '')}_banner`;
    // Planned a stage after its creature: a rare drop is for building once the place is had, and a
    // stage does not wait on luck (planned at the creature's own tier, Plane 1 would wait 4 hours;
    // even the Goblin's, a Starter Camp creature, would hold Plane 1 for an hour and a half).
    const ringTier = Math.max(tierOf(e), tierOf(ws.tokens[camp]));
    const tier = Math.max(2, ringTier + 1);
    add({
        op: 'create', kind: 'item', id: banner,
        value: { id: banner, name: `${short} Banner`, description: `A ${short}'s banner: builds a ${ws.tokens[camp].name} like the one in the wild.`,
            type: 'material', sprite: 't_banner_red', stackable: true, restoreAmount: 0, equipSlot: '', value: 1, autoSyncId: true, tags: [],
            plan: { status: 'live', tier, note: 'Creature banner (brief 330 W6): a rare drop that builds its camp.' } },
        note: `${short} Banner: a rare drop from ${short === e.name ? 'the ' + short : short} (${boss ? '2' : '0.5'} %) that builds a ${ws.tokens[camp].name}.`,
        placeholderArt: true
    });
    const recipeId = `recipe_build_${camp.replace(/^token_/, '')}`;
    if (ws.recipePools && Object.values(ws.recipePools).some(p => p.some(r => r.id === recipeId))) throw new Error(`recipe id taken: ${recipeId}`);
    add({
        op: 'create', kind: 'recipe', id: recipeId,
        value: { id: recipeId, name: `Build ${ws.tokens[camp].name}`, skill: 'construction', levelRequirement: ringTier >= 2 ? 5 : 1, requiresContext: [],
            inputs: [{ itemId: banner, quantity: 1 }, { itemId: 'item_oak_wood', quantity: 5 }],
            outputs: [{ tokenId: camp, chance: 100, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: false }],
            durationMs: 30000, stationChargeCost: 1, xp: 15, foundationKinds: ['wood'], sim: { tempo: 'heavy' },
            plan: { status: 'live', tier, note: 'Builds a creature camp from its banner (brief 330 W6).' } },
        note: `Build ${ws.tokens[camp].name} from a ${short} Banner and 5 Oak Wood on a Wood Foundation: the same camp as the wild one (owner).`
    });
    pushDrop(enemy, drop(banner, boss ? 2 : 0.5));
}
pushDrop('token_goblin', drop(coalMap, 3));
pushDrop('token_goblin_chief', drop(coalMap, 25));
for (const [enemy, outs] of [...enemyDrops].sort(([a], [b]) => a.localeCompare(b))) {
    const t = cur('token', enemy);
    t.config.outputs = [...t.config.outputs, ...outs];
    const names = outs.map(o => `${o.itemId === coalMap ? 'a Coal Prospecting Map' : 'its banner'} (${o.chance} %)`).join(' and ');
    add({ op: 'edit', kind: 'token', id: enemy, value: t, note: `${t.name} also drops ${names}.` });
}

// ── 4. Seeds where missing: each wild tree drops its seedling; the planted forests are built ─────
for (const [tree, seedling] of [
    ['token_birch_tree', 'item_birch_seedling'], ['token_maple_tree', 'item_maple_seedling'], ['token_cedar_tree', 'item_cedar_seedling'],
    ['token_mahogany_tree', 'item_mahogany_seedling'], ['token_ebony_tree', 'item_ebony_seedling']
]) {
    const t = cur('token', tree);
    t.config.outputs = [...t.config.outputs, drop(seedling, 20)];
    add({ op: 'edit', kind: 'token', id: tree, value: t, note: `${t.name} drops its ${ws.items[seedling].name} (20 %), as the Fir Tree does: the seed comes first from its wild tree (owner).` });
}
for (const [forest, seedling] of [
    ['token_birch_forest', 'item_birch_seedling'], ['token_maple_forest', 'item_maple_seedling'], ['token_mahogany_forest', 'item_mahogany_seedling']
]) {
    const id = `recipe_build_${forest.replace(/^token_/, '')}`;
    const base = cur('recipe', 'recipe_build_fir_forest');
    add({
        op: 'create', kind: 'recipe', id,
        value: { ...base, id, name: `Build ${tokenName(forest)}`, levelRequirement: 10,
            inputs: [{ itemId: seedling, quantity: 3 }],
            outputs: [{ tokenId: forest, chance: 100, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: false }],
            plan: { status: 'live', tier: 3, note: 'Plant a forest from its seedlings (brief 330 W6), as the Fir Forest.' } },
        note: `Build ${tokenName(forest)} from 3 ${ws.items[seedling].name}s on Farmland (Construction 10), as the Fir Forest: a planted forest of that species (owner's table).`
    });
}

// ── 5. The pickaxes past iron, so the deepest veins can be worked ──────────────────────────────
for (const [pick, ingot, level] of [
    ['item_mythril_pickaxe', 'item_mythril_ingot', 60], ['item_adamantium_pickaxe', 'item_adamantine_ingot', 75], ['item_darkmetal_pickaxe', 'item_darkmetal_ingot', 90]
]) {
    const base = cur('recipe', 'recipe_iron_pickaxe');
    const id = `recipe_${pick.replace(/^item_/, '')}`;
    add({
        op: 'create', kind: 'recipe', id,
        value: { ...base, id, name: ws.items[pick].name, levelRequirement: level, inputs: [{ itemId: ingot, quantity: 4 }],
            outputs: [{ itemId: pick, chance: 100, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: false }],
            plan: { status: 'live', tier: 3, note: 'The pickaxe past iron (brief 330 W6), as the Iron Pickaxe.' } },
        note: `${ws.items[pick].name} from 4 ${ws.items[ingot].name}s at a smithy (Smithing ${level}), as the Iron Pickaxe: the Adamantium and Darkmetal veins need a pickaxe of this tier.`
    });
}

// ── 6. Fruit trees nobody could work: Farming, as every other fruit tree ─────────────────────────
for (const id of ['token_raspberry_bush', 'token_pineapple_bush', 'token_lemon_tree', 'token_lime_tree', 'token_orange_tree',
    'token_watermelon_patch', 'token_banana_tree', 'token_coconut_tree']) {
    const t = cur('token', id);
    t.config.skill = 'farming';
    // Recalculate leaves a Token's XP as it is, and 0 teaches nothing.
    if (!(t.config.xp > 0)) t.config.xp = 1;
    add({ op: 'edit', kind: 'token', id, value: t, note: `${t.name} had no work skill, so no hero could work it: Farming at level 1 for 1 XP, as every other fruit tree and bush at level 1. It sits in Crops ring 3 (its tier).` });
}

// ── 7. Parked: unfinished content nothing makes or places, kept on purpose ──────────────────────
const PARK = [
    ['token', 'token_adamantine_ore_vein', 'A second Adamantine vein with no work skill: the Adamantium Ore is the one the world places.'],
    ['token', 'token_campfire', 'A Cooking station nothing builds yet.'],
    ['token', 'token_ceramics_kiln', 'A Crafting station nothing builds yet.'],
    ['token', 'token_copper_anvil', 'A context station nothing builds yet.'],
    ['token', 'token_forge_2', 'An old placeholder with no source and no work.'],
    ['token', 'token_forge_altar', 'An old placeholder with no source and no work.'],
    ['token', 'token_grandma_s_kitchen', 'A better kitchen nothing builds yet.'],
    ['token', 'token_pickaxe_mould', 'An old placeholder with no source and no work.'],
    ['token', 'token_wizard_academy', 'A promotion building nothing builds yet.'],
    ['token', 'token_shrimp_market', 'Markets are cut; nothing builds it.'],
    ['token', 'token_volcanic_island', 'An old placeholder with no source and no work.'],
    ['token', 'token_wheat_sprout', 'The old growing wheat: the Field grows wheat by its recipe now; nothing places it.'],
    ['token', 'token_ripe_wheat', 'The old growing wheat: the Field grows wheat by its recipe now; nothing places it.'],
    ['item', 'item_blueberry_pie', 'No recipe makes it yet.'],
    ['item', 'item_elixir_of_valor', 'No recipe makes it yet.'],
    ['item', 'item_shrimp_trawler_potion', 'No recipe makes it yet.'],
    ['item', 'item_coins', 'Nothing makes or spends it (markets are cut).']
];
for (const [kind, id, why] of PARK) {
    const v = cur(kind, id);
    v.plan = { ...(v.plan || {}), status: 'parked', note: `Parked (brief 330 W6): ${why}` };
    add({ op: 'edit', kind, id, value: v, note: `Parked: ${why} The world's checks leave it alone until it is finished; it stays in the game as it is.` });
}

const pack = {
    format: 'fantasy-guild-change-pack',
    version: 1,
    id: '2026-11-01-w6-first-world',
    createdAt: new Date().toISOString(),
    asked: 'The first world content pack (brief 330 W6): origins by ring, placeholder lines, kits, prices and arrivals per ring, prospecting maps and creature banners as drops, seeds where missing; every Live thing guaranteed in the inner ring of its tier in every world (owner, 2026-11-01); built nodes as fast as wild ones; the Starter Camp\'s first mine needs no map (T-284), with the held mines pack.',
    entries
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${pack.id}.json`), JSON.stringify(pack, null, 2) + '\n');
let applied = clone(ws);
for (const e of entries) applied = { ...applied, ...setValue(applied, e.kind, e.id, proposedValue(e)) };
fs.writeFileSync(path.join(outDir, 'workspace_applied.json'), JSON.stringify(applied));
const counts = {};
for (const e of entries) counts[`${e.op} ${e.kind}`] = (counts[`${e.op} ${e.kind}`] || 0) + 1;
console.log(`wrote ${pack.id}.json: ${entries.length} entries`, counts);
