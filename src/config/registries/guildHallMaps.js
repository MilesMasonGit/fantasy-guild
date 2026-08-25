// Fantasy Guild - Guild Hall Tutorial Maps
// Single unified "Guild Hall Map" with hidden scripted sequence drops

export const GUILD_HALL_DROP_SEQUENCE = [
    // Drop 1: Campfire
    [
        { kind: 'token', refId: 'token_campfire', weight: 10 }
    ],
    // Drop 2: Redberry Bush
    [
        { kind: 'token', refId: 'token_redberry_bush', weight: 10 }
    ],
    // Drop 3: Oak Tree
    [
        { kind: 'token', refId: 'token_oak_tree', weight: 10 }
    ],
    // Drop 4: Rusty Woodaxe
    [
        { kind: 'token', refId: 'token_rusty_woodaxe', weight: 10 }
    ],
    // Drop 5: 200 Shrimp Trawler Potions
    [
        { kind: 'item', refId: 'item_shrimp_trawler_potion', quantity: 200, weight: 10 }
    ],
    // Drop 6: Copper Rubble
    [
        { kind: 'token', refId: 'token_copper_rubble', weight: 10 }
    ],
    // Drop 7: Rusty Pickaxe
    [
        { kind: 'token', refId: 'token_rusty_pickaxe', weight: 10 }
    ],
    // Drop 8: Furnace
    [
        { kind: 'token', refId: 'token_furnace', weight: 10 }
    ],
    // Drop 9: Shrimp Coast
    [
        { kind: 'token', refId: 'token_shrimp_coast', weight: 10 }
    ],
    // Drop 10: Fishing Net
    [
        { kind: 'token', refId: 'token_fishing_net', weight: 10 }
    ],
    // Drop 11: Cooking Pot
    [
        { kind: 'token', refId: 'token_cooking_pot', weight: 10 }
    ],
    // Drop 12: Coins (2000 GP)
    [
        { kind: 'item', refId: 'item_coins', quantity: 2000, weight: 10 }
    ]
];

export const GUILD_HALL_MAP = {
    id: 'map_guild_hall',
    name: 'Guild Hall Map',
    // No `theme: 'guild_hall'` field: removed 2026-08-24 (CR2-125). Its two
    // readers (`mapRegistry.listMaps` and `Cartographer.rollBurst`) now test
    // the id instead, which is what they always meant.
    price: 0,
    pool: GUILD_HALL_DROP_SEQUENCE[0]
};

export const GUILD_HALL_MAPS = {
    map_guild_hall: GUILD_HALL_MAP,
    map_guild_hall_map: GUILD_HALL_MAP,
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
    map_guild_hall_13: GUILD_HALL_MAP,
    map_guild_hall_14: GUILD_HALL_MAP
};
