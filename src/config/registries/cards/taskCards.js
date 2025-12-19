
import { CARD_TYPES, TASK_CATEGORIES } from '../cardConstants.js';

export const TASK_CARDS = {
    // === Starting Tasks (Always Available) ===

    well: {
        id: 'well',
        name: 'Well',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.WATER,
        description: 'Draw water from the well.',
        skill: 'nature',
        skillRequirement: 0,
        biomeId: null,
        isUnique: true,
        baseTickTime: 5000,
        baseEnergyCost: 0,
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'water', quantity: 1, chance: 100 }
        ],
        xpAwarded: 5,
        icon: '💧'
    },

    gather_wood: {
        id: 'gather_wood',
        name: 'Gather Wood',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.LOGGING,
        description: 'Collect fallen branches and deadwood.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 8000,
        baseEnergyCost: 2,
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'wood', quantity: 1, chance: 100 }
        ],
        xpAwarded: 8,
        icon: '🌲'
    },

    scrap_furniture: {
        id: 'scrap_furniture',
        name: 'Scrap Broken Furniture',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Salvage usable wood from old furniture.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: 'guild_hall',
        isUnique: true,
        baseTickTime: 15000,
        baseEnergyCost: 2,
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'wood', quantity: 1, chance: 100 }
        ],
        xpAwarded: 10,
        icon: '🪑'
    },

    dusty_charcoal_kiln: {
        id: 'dusty_charcoal_kiln',
        name: 'Dusty Charcoal Kiln',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.SMELTING,
        description: 'Slowly burn wood into charcoal in an old kiln.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: 'guild_hall',
        isUnique: true,
        baseTickTime: 20000,
        baseEnergyCost: 2,
        toolRequired: null,
        inputs: [
            { itemId: 'wood', quantity: 2 }
        ],
        outputs: [
            { itemId: 'charcoal', quantity: 1, chance: 100 }
        ],
        xpAwarded: 15,
        icon: '🔥'
    },

    charcoal_kiln: {
        id: 'charcoal_kiln',
        name: 'Charcoal Kiln',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.SMELTING,
        description: 'Slowly burn wood into charcoal.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 10000,
        baseEnergyCost: 2,
        toolRequired: null,
        inputs: [
            { itemId: 'wood', quantity: 2 }
        ],
        outputs: [
            { itemId: 'charcoal', quantity: 1, chance: 100 }
        ],
        xpAwarded: 10,
        icon: '🔥'
    },

    logging: {
        id: 'logging',
        name: 'Logging',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.LOGGING,
        description: 'Chop trees for wood.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: 'forest',
        isUnique: false,
        baseTickTime: 8000,
        baseEnergyCost: 2,
        toolRequired: null,
        outputs: [
            { itemId: 'wood', quantity: 1, chance: 100 },
            { itemId: 'branch', quantity: 1, chance: 30 }
        ],
        inputs: [
            { acceptTag: 'axe', quantity: 1, isTool: true, slotLabel: 'Axe' }
        ],
        xpAwarded: 10,
        icon: '🪓'
    },

    mining: {
        id: 'mining',
        name: 'Mining',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.MINING,
        description: 'Mine ore from rocks.',
        skill: 'industry',
        skillRequirement: 5,
        biomeId: 'mountain',
        isUnique: false,
        baseTickTime: 10000,
        baseEnergyCost: 3,
        toolRequired: null,
        outputs: [
            { itemId: 'stone', quantity: 1, chance: 100 },
            { itemId: 'iron_ore', quantity: 1, chance: 20 }
        ],
        inputs: [
            { acceptTag: 'pickaxe', quantity: 1, isTool: true, slotLabel: 'Pickaxe' }
        ],
        xpAwarded: 15,
        icon: '⛏️'
    },

    fishing: {
        id: 'fishing',
        name: 'Fishing',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.FISHING,
        description: 'Catch fish from the river.',
        skill: 'nature',
        skillRequirement: 0,
        biomeId: 'river',
        isUnique: false,
        baseTickTime: 6000,
        baseEnergyCost: 10,
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'fish', quantity: 1, chance: 80 },
            { itemId: 'fish', quantity: 2, chance: 20 }
        ],
        xpAwarded: 8,
        icon: '🎣'
    },

    foraging: {
        id: 'foraging',
        name: 'Foraging',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.FORAGING,
        description: 'Gather herbs and berries.',
        skill: 'nature',
        skillRequirement: 0,
        biomeId: 'forest',
        isUnique: false,
        baseTickTime: 5000,
        baseEnergyCost: 10,
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'berries', quantity: 1, chance: 60 },
            { itemId: 'herbs', quantity: 1, chance: 40 }
        ],
        xpAwarded: 6,
        icon: '🌿'
    },

    lemon_orchard: {
        id: 'lemon_orchard',
        name: 'Lemon Orchard',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.FORAGING,
        description: 'Pick fresh lemons from the orchard trees.',
        skill: 'nature',
        skillRequirement: 0,
        biomeId: 'farmland',
        isUnique: false,
        baseTickTime: 6000,  // Tier 1: 5-8s
        baseEnergyCost: 2,   // Tier 1: 0-3
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'lemon', quantity: 2, chance: 100 }
        ],
        xpAwarded: 8,        // Tier 1: 5-10
        icon: '🍋'
    },

    apple_orchard: {
        id: 'apple_orchard',
        name: 'Apple Orchard',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.FORAGING,
        description: 'Pick fresh apples from the orchard trees.',
        skill: 'nature',
        skillRequirement: 0,
        biomeId: 'farmland',
        isUnique: false,
        baseTickTime: 6000,  // Tier 1: 5-8s
        baseEnergyCost: 2,   // Tier 1: 0-3
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'apple', quantity: 2, chance: 100 }
        ],
        xpAwarded: 8,        // Tier 1: 5-10
        icon: '🍎'
    },

    wheat_field: {
        id: 'wheat_field',
        name: 'Wheat Field',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.FORAGING,
        description: 'Harvest golden wheat from the fields.',
        skill: 'nature',
        skillRequirement: 0,
        biomeId: 'farmland',
        isUnique: false,
        baseTickTime: 7000,  // Tier 1: 5-8s
        baseEnergyCost: 3,   // Tier 1: 0-3
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'wheat', quantity: 3, chance: 100 }
        ],
        xpAwarded: 10,       // Tier 1: 5-10
        icon: '🌾'
    },

    windmill: {
        id: 'windmill',
        name: 'Windmill',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Grind wheat into fine flour.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: 'farmland',
        isUnique: false,
        baseTickTime: 8000,  // Tier 1: 5-8s
        baseEnergyCost: 2,   // Tier 1: 0-3
        toolRequired: null,
        inputs: [
            { itemId: 'wheat', quantity: 3 }
        ],
        outputs: [
            { itemId: 'flour', quantity: 2, chance: 100 }
        ],
        xpAwarded: 10,       // Tier 1: 5-10
        icon: '🏭'
    },

    hunting: {
        id: 'hunting',
        name: 'Hunting',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.HUNTING,
        description: 'Hunt wild animals for leather and meat.',
        skill: 'nature',
        skillRequirement: 5,
        biomeId: 'forest',
        isUnique: false,
        baseTickTime: 12000,
        baseEnergyCost: 10,
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'leather', quantity: 1, chance: 100 },
            { itemId: 'raw_meat', quantity: 1, chance: 50 }
        ],
        xpAwarded: 15,
        icon: '🦌'
    },

    // === Mining Gathering Tasks ===

    gather_coal: {
        id: 'gather_coal',
        name: 'Gather Coal',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.MINING,
        description: 'Collect coal from surface deposits.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: 'mountain',
        isUnique: false,
        baseTickTime: 6000,
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'coal', quantity: 1, chance: 100 }
        ],
        xpAwarded: 8,
        icon: '⚫'
    },

    gather_copper_ore: {
        id: 'gather_copper_ore',
        name: 'Gather Copper Ore',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.MINING,
        description: 'Mine copper ore from rocky outcrops.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: 'mountain',
        isUnique: false,
        baseTickTime: 8000,
        baseEnergyCost: 8,
        toolRequired: null,
        inputs: [],
        outputs: [
            { itemId: 'copper_ore', quantity: 1, chance: 100 }
        ],
        xpAwarded: 10,
        icon: '🟠'
    },

    mine_copper_ore: {
        id: 'mine_copper_ore',
        name: 'Mine Copper Ore',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.MINING,
        description: 'Use a pickaxe to efficiently mine copper ore.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: 'mountain',
        isUnique: false,
        baseTickTime: 10000,
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [
            { acceptTag: 'pickaxe', quantity: 1, isTool: true, slotLabel: 'Pickaxe' }
        ],
        outputs: [
            { itemId: 'copper_ore', quantity: 3, chance: 100 }
        ],
        xpAwarded: 15,
        icon: '⛏️'
    },

    // === Crafting Tasks (Require Inputs) ===

    smelt_any_ore: {
        id: 'smelt_any_ore',
        name: 'Smelt Ore',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.SMELTING,
        description: 'Smelt any ore into an ingot using fuel.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 10000,
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [
            { acceptTag: 'ore', quantity: 1, slotLabel: 'Any Ore' },
            { acceptTag: 'fuel', quantity: 1, slotLabel: 'Any Fuel' }
        ],
        outputMap: {
            'copper_ore': [{ itemId: 'copper_ingot', quantity: 1, chance: 100 }],
            'iron_ore': [{ itemId: 'iron_ingot', quantity: 1, chance: 100 }]
        },
        outputs: [],
        xpAwarded: 15,
        icon: '🔥'
    },

    craft_pickaxe: {
        id: 'craft_pickaxe',
        name: 'Craft Pickaxe',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Forge a copper pickaxe from ingots.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 12000,
        baseEnergyCost: 8,
        toolRequired: null,
        inputs: [
            { itemId: 'copper_ingot', quantity: 1 }
        ],
        outputs: [
            { itemId: 'copper_pickaxe', quantity: 1, chance: 100 }
        ],
        xpAwarded: 20,
        icon: '🔨'
    },

    craft_axe: {
        id: 'craft_axe',
        name: 'Craft Axe',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Forge a copper axe from ingots and wood.',
        skill: 'industry',
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 10000,
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [
            { itemId: 'copper_ingot', quantity: 1 },
            { itemId: 'wood', quantity: 2 }
        ],
        outputs: [
            { itemId: 'copper_axe', quantity: 1, chance: 100 }
        ],
        xpAwarded: 20,
        icon: '🪓'
    },

    craft_torch: {
        id: 'craft_torch',
        name: 'Craft Torch',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Create torches from wood and fuel.',
        skill: 'crafting',
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 5000,
        baseEnergyCost: 2,
        toolRequired: null,
        inputs: [
            { acceptTag: 'fuel', quantity: 1, slotLabel: 'Any Fuel' },
            { itemId: 'wood', quantity: 1 }
        ],
        outputs: [
            { itemId: 'torch', quantity: 10, chance: 100 }
        ],
        xpAwarded: 10,
        icon: '🔦'
    },

    craft_wooden_sword: {
        id: 'craft_wooden_sword',
        name: 'Craft Wooden Sword',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Carve a simple sword from wood.',
        skill: 'crafting',
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 8000,
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [
            { itemId: 'wood', quantity: 3 }
        ],
        outputs: [
            { itemId: 'wooden_sword', quantity: 1, chance: 100 }
        ],
        xpAwarded: 15,
        icon: '🗡️'
    },

    craft_wooden_bow: {
        id: 'craft_wooden_bow',
        name: 'Craft Wooden Bow',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Bend flexible wood into a bow.',
        skill: 'crafting',
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 10000,
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [
            { itemId: 'wood', quantity: 4 },
            { itemId: 'branch', quantity: 2 }
        ],
        outputs: [
            { itemId: 'wooden_bow', quantity: 1, chance: 100 }
        ],
        xpAwarded: 20,
        icon: '🏹'
    },

    craft_leather_armor: {
        id: 'craft_leather_armor',
        name: 'Craft Leather Armor',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Stitch leather into protective armor.',
        skill: 'crafting',
        skillRequirement: 5,
        biomeId: null,
        isUnique: false,
        baseTickTime: 15000,
        baseEnergyCost: 8,
        toolRequired: null,
        inputs: [
            { itemId: 'leather', quantity: 3 }
        ],
        outputs: [
            { itemId: 'leather_armor', quantity: 1, chance: 100 }
        ],
        xpAwarded: 25,
        icon: '🦺'
    },

    forge_advanced_gear: {
        id: 'forge_advanced_gear',
        name: 'Forge Advanced Gear',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Craft advanced equipment using multiple materials.',
        skill: 'crafting',
        skillRequirement: 10,
        biomeId: null,
        isUnique: false,
        baseTickTime: 20000,
        baseEnergyCost: 15,
        toolRequired: null,
        inputs: [
            { itemId: 'iron_ingot', quantity: 2 },
            { itemId: 'copper_ingot', quantity: 3 },
            { itemId: 'leather', quantity: 2 },
            { itemId: 'wood', quantity: 5 },
            { acceptTag: 'fuel', quantity: 2, slotLabel: 'Any Fuel' }
        ],
        outputs: [
            { itemId: 'iron_sword', quantity: 1, chance: 100 }
        ],
        xpAwarded: 50,
        icon: '⚒️'
    },

    spread_rumors: {
        id: 'spread_rumors',
        name: 'Spread Rumors',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.INTRIGUE,
        description: 'Whisper secrets and manipulate the villagers.',
        skill: 'occult',
        skillRequirement: 1,
        biomeId: 'village',
        isUnique: false,
        baseTickTime: 60000,  // 60 seconds
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [],
        outputs: [
            { currencyId: 'influence', quantity: 1, chance: 100 }
        ],
        xpAwarded: 30,
        icon: '🗣️'
    },

    lemonade_stand: {
        id: 'lemonade_stand',
        name: 'Lemonade Stand',
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.CRAFTING,
        description: 'Mix water and lemons to make refreshing lemonade.',
        skill: 'culinary',
        skillRequirement: 0,
        biomeId: 'village',
        isUnique: false,
        baseTickTime: 6000,   // Tier 1: 5-8s
        baseEnergyCost: 2,    // Tier 1: 0-3
        toolRequired: null,
        inputs: [
            { itemId: 'water', quantity: 1 },
            { itemId: 'lemon', quantity: 2 }
        ],
        outputs: [
            { itemId: 'lemonade', quantity: 2, chance: 100 }
        ],
        xpAwarded: 10,        // Tier 1: 5-10
        icon: '🧃'
    },

    grandmas_kitchen: {
        id: 'grandmas_kitchen',
        name: "Grandma's Kitchen",
        cardType: CARD_TYPES.TASK,
        taskCategory: TASK_CATEGORIES.COOKING,
        description: 'Bake a delicious apple pie using a family recipe.',
        skill: 'culinary',
        skillRequirement: 0,
        biomeId: 'village',
        isUnique: false,
        baseTickTime: 8000,   // Tier 1: 5-8s
        baseEnergyCost: 3,    // Tier 1: 0-3
        toolRequired: null,
        inputs: [
            { itemId: 'apple', quantity: 2 },
            { itemId: 'flour', quantity: 1 }
        ],
        outputs: [
            { itemId: 'apple_pie', quantity: 1, chance: 100 }
        ],
        xpAwarded: 10,        // Tier 1: 5-10
        icon: '🥧'
    }
};
