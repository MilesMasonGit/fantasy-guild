// The tools-as-gear content, as the change pack `2026-10-21-tools-as-gear` proposes it.
// ⚠️ DEV ONLY, and temporary: the QA panel's "Preview the tools pack" lays this over the content in
// memory so the rules can be seen before the owner accepts the pack and Syncs. Once the Sync has
// landed it duplicates `data/` and can be deleted with `ToolsDevSection.jsx` and `toolsPreview.js`.
// Pure data, no imports: the script that wrote the pack reads it too.

const tool = (id, name, sprite, kind, tier, { starter = false, description = '' } = {}) => ({
    name,
    description,
    type: 'tool',
    sprite,
    stackable: true,
    restoreAmount: 0,
    equipSlot: 'hand',
    value: null,
    valueSource: null,
    autoSyncId: true,
    id,
    tool: { kind, tier, ...(starter ? { starter: true } : {}) }
});

/**
 * Every tool item, by id. `item_copper_pickaxe` is the owner's, given its Tool. The four starters
 * are the copper tools and the Fishing Rod.
 * ⚠️ Built on call, not at load: a module-level call keeps this file in the production bundle.
 */
export const toolItems = () => ({
    item_copper_pickaxe: tool('item_copper_pickaxe', 'Copper Pickaxe', 'i_pick_copper', 'pickaxe', 1, { starter: true }),
    item_iron_pickaxe: tool('item_iron_pickaxe', 'Iron Pickaxe', 'i_pick_iron', 'pickaxe', 2),
    item_mythril_pickaxe: tool('item_mythril_pickaxe', 'Mythril Pickaxe', 'i_pick_myth', 'pickaxe', 3),
    item_adamantium_pickaxe: tool('item_adamantium_pickaxe', 'Adamantium Pickaxe', 'i_pick_addy', 'pickaxe', 4),
    item_darkmetal_pickaxe: tool('item_darkmetal_pickaxe', 'Darkmetal Pickaxe', 'i_pick_dark', 'pickaxe', 5),
    item_copper_woodaxe: tool('item_copper_woodaxe', 'Copper Woodaxe', 'i_woodaxe_copper', 'woodaxe', 1, { starter: true }),
    item_fishing_rod: tool('item_fishing_rod', 'Fishing Rod', 'i_rod_wood', 'fishing_rod', 1, { starter: true }),
    item_copper_sickle: tool('item_copper_sickle', 'Copper Sickle', 'i_chisel_copper', 'sickle', 1, { starter: true })
});

/**
 * The tool each gathering Token needs, by Token id: `[kind, minTier]`. An ore needs the pick of the
 * tier below its own metal: copper picks mine iron, iron picks mythril, mythril picks adamantine,
 * adamantium picks darkmetal. Silver and gold sit with mythril, behind the Iron Pickaxe.
 */
export const TOKEN_NEEDS = {
    token_copper_ore_vein: ['pickaxe', 1],
    token_iron_ore_vein: ['pickaxe', 1],
    token_silver_ore_vein: ['pickaxe', 2],
    token_gold_ore_vein: ['pickaxe', 2],
    token_mythril_ore_vein: ['pickaxe', 2],
    token_adamantine_ore_vein: ['pickaxe', 3],
    token_adamantium_ore: ['pickaxe', 3],
    token_darkmetal_ore_vein: ['pickaxe', 4],
    token_coal_vein: ['pickaxe', 1],
    token_stone_outcrop: ['pickaxe', 1],
    token_clay_deposit: ['pickaxe', 1],
    token_quartz_deposit: ['pickaxe', 1],
    token_oak_tree: ['woodaxe', 1],
    token_fir_tree: ['woodaxe', 1],
    token_birch_tree: ['woodaxe', 1],
    token_maple_tree: ['woodaxe', 1],
    token_cedar_tree: ['woodaxe', 1],
    token_mahogany_tree: ['woodaxe', 1],
    token_ebony_tree: ['woodaxe', 1],
    token_fir_forest: ['woodaxe', 1],
    token_birch_forest: ['woodaxe', 1],
    token_maple_forest: ['woodaxe', 1],
    token_mahogany_forest: ['woodaxe', 1],
    token_shrimp_coast: ['fishing_rod', 1],
    token_ripe_wheat: ['sickle', 1]
};

/** The retired tool Tokens: tools are items now. */
export const RETIRED_TOOL_TOKENS = [
    'token_rusty_pickaxe', 'token_copper_pickaxe', 'token_iron_pickaxe', 'token_mythril_pickaxe',
    'token_adamantium_pickaxe', 'token_darkmetal_pickaxe', 'token_rusty_woodaxe', 'token_copper_woodaxe',
    'token_fishing_net'
];

/** Recipes that made a tool Token and now make the tool item: recipe id → [old Token, new item]. */
export const RECIPE_OUTPUTS = {
    recipe_copper_pickaxe: ['token_copper_pickaxe', 'item_copper_pickaxe'],
    recipe_mtozw3la: ['token_copper_woodaxe', 'item_copper_woodaxe']
};
