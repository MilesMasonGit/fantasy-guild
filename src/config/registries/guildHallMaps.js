// Fantasy Guild - Guild Hall Tutorial Maps
// Single unified "Guild Hall Map" with hidden scripted sequence drops

export const GUILD_HALL_DROP_SEQUENCE = [
    // Drop 1
    [
        { kind: 'token', refId: 'token_oak_forest', weight: 10 },
        { kind: 'item', refId: 'item_water', quantity: 5, weight: 10 }
    ],
    // Drop 2
    [
        { kind: 'token', refId: 'token_charcoal_kiln', weight: 10 },
        { kind: 'item', refId: 'item_water', quantity: 5, weight: 10 }
    ],
    // Drop 3
    [
        { kind: 'token', refId: 'token_copper_ore_vein', weight: 10 },
        { kind: 'item', refId: 'item_copper_ore', quantity: 5, weight: 10 }
    ],
    // Drop 4
    [
        { kind: 'token', refId: 'token_copper_pickaxe', weight: 10 },
        { kind: 'item', refId: 'item_copper_ore', quantity: 5, weight: 10 }
    ],
    // Drop 5
    [
        { kind: 'token', refId: 'token_forge', weight: 10 },
        { kind: 'item', refId: 'item_copper_ingot', quantity: 3, weight: 10 }
    ],
    // Drop 6
    [
        { kind: 'token', refId: 'token_copper_ore_minecart', weight: 10 },
        { kind: 'item', refId: 'item_water', quantity: 5, weight: 10 }
    ],
    // Drop 7
    [
        { kind: 'token', refId: 'token_wizard_academy', weight: 10 },
        { kind: 'item', refId: 'item_copper_ingot', quantity: 3, weight: 10 }
    ],
    // Drop 8
    [
        { kind: 'token', refId: 'token_forge_altar', weight: 10 },
        { kind: 'item', refId: 'item_copper_ore', quantity: 10, weight: 10 }
    ],
    // Drop 9
    [
        { kind: 'token', refId: 'token_oak_forest', weight: 10 },
        { kind: 'item', refId: 'item_water', quantity: 10, weight: 10 }
    ],
    // Drop 10
    [
        { kind: 'token', refId: 'token_copper_ore_vein', weight: 10 },
        { kind: 'item', refId: 'item_copper_ingot', quantity: 5, weight: 10 }
    ],
    // Drop 11
    [
        { kind: 'token', refId: 'token_copper_pickaxe', weight: 10 },
        { kind: 'item', refId: 'item_copper_ingot', quantity: 5, weight: 10 }
    ],
    // Drop 12
    [
        { kind: 'token', refId: 'token_charcoal_kiln', weight: 10 },
        { kind: 'item', refId: 'item_copper_ore', quantity: 10, weight: 10 }
    ],
    // Drop 13
    [
        { kind: 'token', refId: 'token_forge', weight: 10 },
        { kind: 'item', refId: 'item_copper_ingot', quantity: 5, weight: 10 }
    ]
];

export const GUILD_HALL_MAP = {
    id: 'map_guild_hall',
    name: 'Guild Hall Map',
    theme: 'guild_hall',
    price: 0,
    pool: GUILD_HALL_DROP_SEQUENCE[0]
};

export const GUILD_HALL_MAPS = {
    map_guild_hall: GUILD_HALL_MAP,
    // Step aliases map to the same unified definition
    map_guild_hall_1: GUILD_HALL_MAP,
    map_guild_hall_2: GUILD_HALL_MAP,
    map_guild_hall_3: GUILD_HALL_MAP,
    map_guild_hall_4: GUILD_HALL_MAP,
    map_guild_hall_5: GUILD_HALL_MAP,
    map_guild_hall_6: GUILD_HALL_MAP,
    map_guild_hall_7: GUILD_HALL_MAP,
    map_guild_hall_8: GUILD_HALL_MAP,
    map_guild_hall_9: GUILD_HALL_MAP,
    map_guild_hall_10: GUILD_HALL_MAP,
    map_guild_hall_11: GUILD_HALL_MAP,
    map_guild_hall_12: GUILD_HALL_MAP,
    map_guild_hall_13: GUILD_HALL_MAP
};
