// Fantasy Guild - Item Registry
// Phase 16: Item Registry

/**
 * ItemRegistry - Defines all item templates
 * 
 * Item Types:
 * - material: Basic resources (wood, stone, etc.)
 * - tool: Equipment that boosts skills
 * - weapon: Equipment for combat
 * - armor: Equipment for defence
 * - food: Restores HP/Energy
 * - currency: Special tracking items
 * - drop: Monster parts/loot
 */

// === Item Type Constants ===
export const ITEM_TYPES = {
    MATERIAL: 'material',
    TOOL: 'tool',
    WEAPON: 'weapon',
    ARMOR: 'armor',
    FOOD: 'food',
    POTION: 'potion',
    CURRENCY: 'currency',
    DROP: 'drop'
};

// === Item Templates ===

export const ITEMS = {
    // === Basic Resources ===

    wood: {
        id: 'wood',
        name: 'Wood',
        type: ITEM_TYPES.MATERIAL,
        tags: ['building', 'fuel'],
        description: 'A basic building material.',
        stackable: true,
        maxStack: 999,
        icon: '🌲' // Tree emoji (widely supported)
    },

    stone: {
        id: 'stone',
        name: 'Stone',
        type: ITEM_TYPES.MATERIAL,
        tags: ['building'],
        description: 'Hard rock suitable for construction.',
        stackable: true,
        maxStack: 999,
        icon: '🪨'
    },

    water: {
        id: 'water',
        name: 'Water',
        type: ITEM_TYPES.MATERIAL,
        tags: ['drink'],
        description: 'Clean water from the well.',
        stackable: true,
        maxStack: 99,
        equipSlot: 'drink',
        restoreAmount: 15,
        restoreType: 'energy',
        icon: '💧'
    },

    // === Foraging Drops ===

    berries: {
        id: 'berries',
        name: 'Berries',
        type: ITEM_TYPES.FOOD,
        tags: ['food', 'ingredient'],
        description: 'Sweet wild berries.',
        stackable: true,
        maxStack: 50,
        equipSlot: 'food',
        restoreAmount: 10,
        restoreType: 'hp',
        icon: '🍇'
    },

    herbs: {
        id: 'herbs',
        name: 'Herbs',
        type: ITEM_TYPES.MATERIAL,
        tags: ['ingredient', 'alchemy'],
        description: 'Medicinal plants used in alchemy.',
        stackable: true,
        icon: '🌿'
    },

    lemon: {
        id: 'lemon',
        name: 'Lemon',
        type: ITEM_TYPES.FOOD,
        tags: ['food', 'ingredient', 'fruit'],
        description: 'A sour citrus fruit from the orchard.',
        stackable: true,
        maxStack: 99,
        equipSlot: 'food',
        restoreAmount: 5,
        restoreType: 'energy',
        icon: '🍋'
    },

    apple: {
        id: 'apple',
        name: 'Apple',
        type: ITEM_TYPES.FOOD,
        tags: ['food', 'ingredient', 'fruit'],
        description: 'A crisp red apple from the orchard.',
        stackable: true,
        maxStack: 99,
        equipSlot: 'food',
        restoreAmount: 8,
        restoreType: 'hp',
        icon: '🍎'
    },

    wheat: {
        id: 'wheat',
        name: 'Wheat',
        type: ITEM_TYPES.MATERIAL,
        tags: ['ingredient', 'grain', 'crop'],
        description: 'Golden stalks of wheat, ready for milling.',
        stackable: true,
        maxStack: 99,
        icon: '🌾'
    },

    flour: {
        id: 'flour',
        name: 'Flour',
        type: ITEM_TYPES.MATERIAL,
        tags: ['ingredient', 'baking'],
        description: 'Fine white flour, ground from wheat.',
        stackable: true,
        maxStack: 99,
        icon: '🥛'
    },

    lemonade: {
        id: 'lemonade',
        name: 'Lemonade',
        type: ITEM_TYPES.FOOD,
        tags: ['drink', 'crafted'],
        description: 'A refreshing citrus beverage.',
        stackable: true,
        maxStack: 50,
        equipSlot: 'drink',
        restoreAmount: 20,
        restoreType: 'energy',
        icon: '🧃'
    },

    apple_pie: {
        id: 'apple_pie',
        name: 'Apple Pie',
        type: ITEM_TYPES.FOOD,
        tags: ['food', 'crafted', 'baked'],
        description: 'A delicious homemade pie, just like grandma used to make.',
        stackable: true,
        maxStack: 20,
        equipSlot: 'food',
        restoreAmount: 30,
        restoreType: 'hp',
        icon: '🥧'
    },

    raw_meat: {
        id: 'raw_meat',
        name: 'Raw Meat',
        type: ITEM_TYPES.FOOD,
        tags: ['food', 'ingredient', 'raw'],
        description: 'Fresh meat from wild animals.',
        stackable: true,
        maxStack: 50,
        equipSlot: 'food',
        restoreAmount: 15,
        restoreType: 'hp',
        icon: '🥩'
    },

    raw_chicken: {
        id: 'raw_chicken',
        name: 'Raw Chicken',
        type: ITEM_TYPES.FOOD,
        tags: ['food', 'ingredient', 'raw'],
        description: 'Fresh chicken meat.',
        stackable: true,
        maxStack: 50,
        equipSlot: 'food',
        restoreAmount: 10,
        restoreType: 'hp',
        icon: '🍗'
    },

    // === Secondary Resources ===

    branch: {
        id: 'branch',
        name: 'Branch',
        type: ITEM_TYPES.MATERIAL,
        description: 'A small stick, useful for handle making.',
        stackable: true,
        icon: '🌱'
    },

    iron_ore: {
        id: 'iron_ore',
        name: 'Iron Ore',
        type: ITEM_TYPES.MATERIAL,
        tags: ['ore', 'metal'],
        description: 'Raw iron that needs smelting.',
        stackable: true,
        icon: '⛏️'
    },

    fish: {
        id: 'fish',
        name: 'Fish',
        type: ITEM_TYPES.FOOD,
        tags: ['food', 'ingredient'],
        description: 'A fresh catch from the river.',
        stackable: true,
        restoreAmount: 10,
        restoreType: 'energy',
        icon: '🐟'
    },

    // === Tools (Placeholders) ===

    wooden_axe: {
        id: 'wooden_axe',
        name: 'Wooden Axe',
        type: ITEM_TYPES.TOOL,
        tags: ['tool', 'axe'],
        description: 'A crude axe for chopping trees.',
        stackable: true,
        maxDurability: 50,
        skillBonus: { skill: 'industry', value: 1 },
        icon: '🪓'
    },

    // === Mining Resources ===

    coal: {
        id: 'coal',
        name: 'Coal',
        type: ITEM_TYPES.MATERIAL,
        tags: ['fuel'],
        description: 'Black fuel used for smelting.',
        stackable: true,
        maxStack: 999,
        icon: '⚫'
    },

    charcoal: {
        id: 'charcoal',
        name: 'Charcoal',
        type: ITEM_TYPES.MATERIAL,
        tags: ['fuel'],
        description: 'Burned wood that makes excellent fuel.',
        stackable: true,
        maxStack: 999,
        icon: '▪️'
    },

    copper_ore: {
        id: 'copper_ore',
        name: 'Copper Ore',
        type: ITEM_TYPES.MATERIAL,
        tags: ['ore', 'metal'],
        description: 'Raw copper ore that needs smelting.',
        stackable: true,
        maxStack: 999,
        icon: '🟠',
        sprite: 'assets/icons/resources/copper_ore_v4_source.png'
    },

    // === Smelted Materials ===

    copper_ingot: {
        id: 'copper_ingot',
        name: 'Copper Ingot',
        type: ITEM_TYPES.MATERIAL,
        tags: ['ingot', 'metal'],
        description: 'A refined bar of copper, ready for crafting.',
        stackable: true,
        maxStack: 999,
        icon: '🟧'
    },

    iron_ingot: {
        id: 'iron_ingot',
        name: 'Iron Ingot',
        type: ITEM_TYPES.MATERIAL,
        tags: ['ingot', 'metal'],
        description: 'A refined bar of iron, ready for crafting.',
        stackable: true,
        maxStack: 999,
        icon: '⬜'
    },

    // === Crafted Tools ===

    copper_pickaxe: {
        id: 'copper_pickaxe',
        name: 'Copper Pickaxe',
        type: ITEM_TYPES.TOOL,
        tags: ['tool', 'pickaxe'],
        description: 'A sturdy pickaxe for mining ore.',
        stackable: true,
        maxDurability: 100,
        skillBonus: { skill: 'industry', value: 2 },
        icon: '⛏️'
    },

    copper_axe: {
        id: 'copper_axe',
        name: 'Copper Axe',
        type: ITEM_TYPES.TOOL,
        tags: ['tool', 'axe'],
        description: 'A reliable axe for chopping trees.',
        stackable: true,
        maxDurability: 100,
        skillBonus: { skill: 'industry', value: 2 },
        icon: '🪓'
    },

    // === Crafted Items ===

    torch: {
        id: 'torch',
        name: 'Torch',
        type: ITEM_TYPES.MATERIAL,
        tags: ['light', 'crafted'],
        description: 'A simple light source made from wood and coal.',
        stackable: true,
        maxStack: 999,
        icon: '🔦'
    },

    lockpick: {
        id: 'lockpick',
        name: 'Lockpick',
        type: ITEM_TYPES.MATERIAL,
        tags: ['tool', 'crafted', 'key'],
        description: 'Useful for opening old locks.',
        stackable: true,
        maxStack: 99,
        icon: '🗝️'
    },

    // === Equipment ===

    wooden_sword: {
        id: 'wooden_sword',
        name: 'Wooden Sword',
        type: ITEM_TYPES.WEAPON,
        tags: ['weapon', 'melee', 'crafted'],
        description: 'A simple sword carved from wood.',
        stackable: true,
        maxStack: 5,
        equipSlot: 'weapon',
        skillRequired: 'melee',
        levelRequired: 1,
        maxDurability: 50,
        damage: 3,
        tickSpeedBonus: -200,
        icon: '🗡️'
    },

    wooden_bow: {
        id: 'wooden_bow',
        name: 'Wooden Bow',
        type: ITEM_TYPES.WEAPON,
        tags: ['weapon', 'ranged', 'crafted'],
        description: 'A simple bow made from flexible wood.',
        stackable: true,
        maxStack: 5,
        equipSlot: 'weapon',
        skillRequired: 'ranged',
        levelRequired: 1,
        maxDurability: 40,
        damage: 4,
        tickSpeedBonus: -100,
        icon: '🏹'
    },

    leather: {
        id: 'leather',
        name: 'Leather',
        type: ITEM_TYPES.MATERIAL,
        tags: ['material', 'crafting'],
        description: 'Tanned animal hide, useful for crafting.',
        stackable: true,
        maxStack: 99,
        icon: '🟤'
    },

    leather_armor: {
        id: 'leather_armor',
        name: 'Leather Armor',
        type: ITEM_TYPES.ARMOR,
        tags: ['armor', 'crafted'],
        description: 'Basic protection made from leather.',
        stackable: true,
        maxStack: 3,
        equipSlot: 'armor',
        skillRequired: 'defence',
        levelRequired: 1,
        maxDurability: 60,
        defense: 2,
        hpBonus: 10,
        icon: '🦺'
    },

    // === Metal Weapons ===

    iron_sword: {
        id: 'iron_sword',
        name: 'Iron Sword',
        type: ITEM_TYPES.WEAPON,
        tags: ['weapon', 'melee', 'crafted', 'metal'],
        description: 'A sturdy sword forged from iron.',
        stackable: true,
        maxStack: 5,
        equipSlot: 'weapon',
        skillRequired: 'melee',
        levelRequired: 5,
        maxDurability: 100,
        minDamage: 5,
        maxDamage: 10,
        tickSpeedBonus: -300,
        icon: '⚔️'
    },

    leather_armor: {
        id: 'leather_armor',
        name: 'Leather Armor',
        type: ITEM_TYPES.ARMOR,
        tags: ['armor', 'leather', 'crafted'],
        description: 'Basic protection made from tanned hide.',
        stackable: true,
        maxStack: 5,
        equipSlot: 'armor',
        defense: 3, // Adds +3 to Defence Skill
        icon: '🧥'
    },

    iron_armor: {
        id: 'iron_armor',
        name: 'Iron Armor',
        type: ITEM_TYPES.ARMOR,
        tags: ['armor', 'metal', 'crafted'],
        description: 'Heavy plated armor for serious combat.',
        stackable: true,
        maxStack: 5,
        equipSlot: 'armor',
        skillRequired: 'defence',
        levelRequired: 5,
        defense: 8, // Adds +8 to Defence Skill
        icon: '🛡️'
    },

    // === Unique/Quest Items ===

    rotten_battleaxe: {
        id: 'rotten_battleaxe',
        name: 'Rotten Battleaxe',
        type: ITEM_TYPES.WEAPON,
        tags: ['weapon', 'tool', 'axe', 'decayed'],
        description: 'A heavy, rusted axe. Surprisingly effective at chopping both wood and bone.',
        stackable: false,
        equipSlot: 'weapon',
        skillRequired: 'melee',
        levelRequired: 1,
        maxDurability: 80,
        damage: 4, // Slightly better than wooden sword (3)
        // Secondary tool properties
        toolType: 'axe',
        skillBonus: { skill: 'industry', value: 1 },
        icon: '🪓'
    },

    // === Monster Drops ===

    wolf_fang: {
        id: 'wolf_fang',
        name: 'Wolf Fang',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'fang', 'alchemy'],
        description: 'A sharp fang from a wolf.',
        stackable: true,
        maxStack: 99,
        icon: '🦷'
    },

    boar_tusk: {
        id: 'boar_tusk',
        name: 'Boar Tusk',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'tusk', 'crafting'],
        description: 'A curved tusk from a wild boar.',
        stackable: true,
        maxStack: 99,
        icon: '🦴'
    },

    rat_tail: {
        id: 'rat_tail',
        name: 'Rat Tail',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'alchemy'],
        description: 'A thin, wiry tail from a giant rat.',
        stackable: true,
        maxStack: 99,
        icon: '🐁'
    },

    snake_skin: {
        id: 'snake_skin',
        name: 'Snake Skin',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'leather', 'crafting'],
        description: 'Shed skin from a grass snake.',
        stackable: true,
        maxStack: 99,
        icon: '🐍'
    },

    venom_sac: {
        id: 'venom_sac',
        name: 'Venom Sac',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'alchemy', 'poison'],
        description: 'A sac filled with potent venom.',
        stackable: true,
        maxStack: 50,
        icon: '💚'
    },

    goat_horn: {
        id: 'goat_horn',
        name: 'Goat Horn',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'horn', 'crafting'],
        description: 'A curved horn from a mountain goat.',
        stackable: true,
        maxStack: 99,
        icon: '📯'
    },

    feather: {
        id: 'feather',
        name: 'Feather',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'crafting', 'fletching'],
        description: 'A large feather, useful for arrows.',
        stackable: true,
        maxStack: 999,
        icon: '🪶'
    },

    eagle_talon: {
        id: 'eagle_talon',
        name: 'Eagle Talon',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'claw', 'crafting'],
        description: 'A razor-sharp talon from a giant eagle.',
        stackable: true,
        maxStack: 99,
        icon: '🦅'
    },

    bat_wing: {
        id: 'bat_wing',
        name: 'Bat Wing',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'alchemy', 'occult'],
        description: 'A leathery wing from a cave bat.',
        stackable: true,
        maxStack: 99,
        icon: '🦇'
    },

    guano: {
        id: 'guano',
        name: 'Guano',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'fertilizer', 'alchemy'],
        description: 'Bat droppings. Surprisingly useful.',
        stackable: true,
        maxStack: 999,
        icon: '💩'
    },

    spider_silk: {
        id: 'spider_silk',
        name: 'Spider Silk',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'crafting', 'textile'],
        description: 'Strong silk threads from a giant spider.',
        stackable: true,
        maxStack: 999,
        icon: '🕸️'
    },

    spider_fang: {
        id: 'spider_fang',
        name: 'Spider Fang',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'fang', 'alchemy'],
        description: 'A venomous fang from a giant spider.',
        stackable: true,
        maxStack: 99,
        icon: '🕷️'
    },

    frog_leg: {
        id: 'frog_leg',
        name: 'Frog Leg',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'food', 'ingredient'],
        description: 'A meaty leg from a giant frog.',
        stackable: true,
        maxStack: 99,
        icon: '🦵'
    },

    slime: {
        id: 'slime',
        name: 'Slime',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'alchemy', 'goo'],
        description: 'Sticky goo from various creatures.',
        stackable: true,
        maxStack: 999,
        icon: '🟢'
    },

    leech_blood: {
        id: 'leech_blood',
        name: 'Leech Blood',
        type: ITEM_TYPES.DROP,
        tags: ['drop', 'alchemy', 'occult'],
        description: 'Dark blood from a swamp leech.',
        stackable: true,
        maxStack: 50,
        icon: '🩸'
    }
};

// === Helper Functions ===

/**
 * Get an item template by ID
 * @param {string} itemId 
 * @returns {Object|null}
 */
export function getItem(itemId) {
    return ITEMS[itemId] || null;
}

/**
 * Get all item templates
 * @returns {Object}
 */
export function getAllItems() {
    return { ...ITEMS };
}

/**
 * Get items by type
 * @param {string} itemType 
 * @returns {Array}
 */
export function getItemsByType(itemType) {
    return Object.values(ITEMS).filter(i => i.type === itemType);
}

/**
 * Check if item exists
 * @param {string} itemId 
 * @returns {boolean}
 */
export function itemExists(itemId) {
    return !!ITEMS[itemId];
}

/**
 * Get items by tag
 * @param {string} tag - Tag to filter by
 * @returns {Array} Items with matching tag
 */
export function getItemsByTag(tag) {
    return Object.values(ITEMS).filter(item => item.tags?.includes(tag));
}

