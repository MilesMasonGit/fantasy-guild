// Fantasy Guild - Tutorial Quests Specification
// Rewards unified "Guild Hall Map" with scripted sequence drops

export const TUTORIAL_QUESTS = [
    {
        id: 'tutorial_1',
        step: 0,
        title: 'Recruit a Hero',
        instruction: 'Recruit a Hero from the Guild Hall (Purple orb on the top left of the screen, or center tile of the playmat)',
        targetType: 'hero_recruited',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_2',
        step: 1,
        title: 'Explore one Map',
        instruction: 'Explore one Map (Double click them to open)',
        targetType: 'map_burst',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_3',
        step: 2,
        title: 'Place a Token',
        instruction: 'Drag and drop a Token from the Tray to the Playmat.',
        targetType: 'token_placed',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_4',
        step: 3,
        title: 'Deploy a Hero',
        instruction: 'Drag and drop a Hero from the Hero Dock onto a Token.',
        targetType: 'hero_deployed',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_5',
        step: 4,
        title: 'Token Cycles',
        instruction: 'Complete 10 Token work cycles.',
        targetType: 'cycle_completed',
        requiredCount: 10,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_6',
        step: 5,
        title: 'Collect Items',
        instruction: 'Collect 10 items off the playmat (Hover over to collect)',
        targetType: 'loot_collected',
        requiredCount: 10,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_7',
        step: 6,
        title: 'Item Bank',
        instruction: 'Open your Item Bank (Yellow orb on the left of the screen)',
        targetType: 'open_bank',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_8',
        step: 7,
        title: 'Equip a Hero',
        instruction: 'Drag an item from your Item Bank onto a Hero in the Hero Dock.',
        targetType: 'hero_equipped',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_9',
        step: 8,
        title: 'Token Vault',
        instruction: 'Open your Token Vault (Light Blue orb on the left of the screen)',
        targetType: 'open_vault',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_10',
        step: 9,
        title: 'Stage a Token',
        instruction: 'Drag and drop a Token from the Vault to the Tray',
        targetType: 'vault_withdrawn',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_11',
        step: 10,
        title: 'Add a Context Token',
        instruction: 'Place a Tool (like a Pickaxe or an Axe) adjacent to a relevant Token on the Playmat.',
        targetType: 'context_token_placed',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_12',
        step: 11,
        title: "Cartographer's Shop",
        instruction: "Open the Cartographer's Shop (Green orb on the left of the screen)",
        targetType: 'open_cartographer',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    },
    {
        id: 'tutorial_13',
        step: 12,
        title: 'Buy a Map',
        instruction: 'Buy one map (Drag and drop the map into your Tray)',
        targetType: 'map_purchased',
        requiredCount: 1,
        rewardMapId: 'map_guild_hall',
        rewardMapName: 'Guild Hall Map'
    }
];
