const _TILE_TYPES = {
    plains: {
        id: 'plains',
        name: 'Plains',
        icon: '🌱',
        sprite: 'pm_stone_base',
        color: '#4ade80',
        description: 'Open grassy plains. Standard building conditions.',
        bonuses: []
    },
    guild_hall_board_1: { id: 'guild_hall_board_1', name: 'Guild Hall Floor', sprite: 'pm_board_guild_hall_1' },
    guild_hall_board_2: { id: 'guild_hall_board_2', name: 'Guild Hall Floor', sprite: 'pm_board_guild_hall_2' },
    guild_hall_board_3: { id: 'guild_hall_board_3', name: 'Guild Hall Floor', sprite: 'pm_board_guild_hall_3' },
    guild_hall_board_4: { id: 'guild_hall_board_4', name: 'Guild Hall Floor', sprite: 'pm_board_guild_hall_4' },
    guild_hall_board_5: { id: 'guild_hall_board_5', name: 'Guild Hall Floor', sprite: 'pm_board_guild_hall_5' },
    forest_board_1: { id: 'forest_board_1', name: 'Forest Floor', sprite: 'pm_board_forest_1' },
    forest_board_2: { id: 'forest_board_2', name: 'Forest Floor', sprite: 'pm_board_forest_2' },
    forest_board_3: { id: 'forest_board_3', name: 'Forest Floor', sprite: 'pm_board_forest_3' },
    forest_board_4: { id: 'forest_board_4', name: 'Forest Floor', sprite: 'pm_board_forest_4' },
    mountain_board_1: { id: 'mountain_board_1', name: 'Mountain Floor', sprite: 'pm_board_mountain_1' },
    mountain_board_2: { id: 'mountain_board_2', name: 'Mountain Floor', sprite: 'pm_board_mountain_2' },
    mountain_board_3: { id: 'mountain_board_3', name: 'Mountain Floor', sprite: 'pm_board_mountain_3' },
    mountain_board_4: { id: 'mountain_board_4', name: 'Mountain Floor', sprite: 'pm_board_mountain_4' },
    mountain_board_5: { id: 'mountain_board_5', name: 'Mountain Floor', sprite: 'pm_board_mountain_5' },
    mountain_board_6: { id: 'mountain_board_6', name: 'Mountain Floor', sprite: 'pm_board_mountain_6' },
    farmland_board_irrigated: { id: 'farmland_board_irrigated', name: 'Irrigated Farmland', sprite: 'pm_board_farmland_irrigated' },
    farmland_board_irrigated_l: { id: 'farmland_board_irrigated_l', name: 'Irrigated Farmland (L)', sprite: 'pm_board_farmland_irrigated_l' },
    farmland_board_irrigated_r: { id: 'farmland_board_irrigated_r', name: 'Irrigated Farmland (R)', sprite: 'pm_board_farmland_irrigated_r' },
    village_board_1: { id: 'village_board_1', name: 'Cobblestone Street', sprite: 'pm_board_village_1' },
    forest: {
        id: 'forest',
        name: 'Forest',
        icon: '🌳',
        sprite: 'pm_test_nature',
        propSprite: 'skill_nature',
        color: '#166534',
        description: 'Dense woodland. Rich in timber and wildlife.',
        bonuses: [
            { type: 'speed', value: 0.1, category: 'nature', range: 'adjacent' }
        ]
    },
    nature_boost: {
        id: 'nature_boost',
        name: 'Nature Shrine',
        icon: '✨',
        sprite: 'pm_test_nature',
        propSprite: 'skill_nature',
        color: '#4ade80',
        description: 'A place of ancient power. Significantly boosts nearby nature tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'nature', range: 'adjacent' }
        ]
    },
    industry_boost: {
        id: 'industry_boost',
        name: 'Industrial Forge',
        icon: '⚙️',
        sprite: 'pm_test_industry',
        propSprite: 'skill_industry',
        color: '#94a3b8',
        description: 'A heavy-duty industrial site. Optimizes mining, smelting, and crafting.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'industry', range: 'adjacent' }
        ]
    },
    culinary_boost: {
        id: 'culinary_boost',
        name: 'Great Kitchen',
        icon: '🍳',
        sprite: 'pm_test_culinary',
        propSprite: 'skill_culinary',
        color: '#fbbf24',
        description: 'A professional cooking station. Significantly speeds up culinary tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'culinary', range: 'adjacent' }
        ]
    },
    nautical_boost: {
        id: 'nautical_boost',
        name: 'Nautical Hub',
        icon: '⚓',
        sprite: 'pm_test_nautical',
        propSprite: 'skill_nautical',
        color: '#3b82f6',
        description: 'A specialized maritime terminal. significantly boosts fishing and nautical activities.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'nautical', range: 'adjacent' }
        ]
    },
    social_boost: {
        id: 'social_boost',
        name: 'Grand Embassy',
        icon: '🤝',
        sprite: 'pm_test_social',
        propSprite: 'skill_social',
        color: '#f472b6',
        description: 'A hub for diplomacy and whispers. Boosts social and intrigue tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'social', range: 'adjacent' }
        ]
    },
    crime_boost: {
        id: 'crime_boost',
        name: 'Shadow Den',
        icon: '🕵️',
        sprite: 'pm_test_crime',
        propSprite: 'skill_crime',
        color: '#475569',
        description: 'A discreet location for illicit activities. Boosts crime tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'crime', range: 'adjacent' }
        ]
    },
    occult_boost: {
        id: 'occult_boost',
        name: 'Ritual Altar',
        icon: '🔮',
        sprite: 'pm_test_occult',
        propSprite: 'skill_occult',
        color: '#a855f7',
        description: 'Channeling ancient mysteries. Boosts occult tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'occult', range: 'adjacent' }
        ]
    },
    science_boost: {
        id: 'science_boost',
        name: 'Alchemy Lab',
        icon: '⚗️',
        sprite: 'pm_test_science',
        propSprite: 'skill_flask',
        color: '#10b981',
        description: 'Advancing the bounds of knowledge. Boosts science tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'science', range: 'adjacent' }
        ]
    },
    farmland_nature_boost_l: {
        id: 'farmland_nature_boost_l',
        name: 'Nature Shrine',
        icon: '✨',
        sprite: 'pm_board_farmland_irrigated_l',
        propSprite: 'skill_nature',
        color: '#4ade80',
        description: 'A place of ancient power. Significantly boosts nearby nature tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'nature', range: 'adjacent' }
        ]
    },
    farmland_culinary_boost_r: {
        id: 'farmland_culinary_boost_r',
        name: 'Great Kitchen',
        icon: '🍳',
        sprite: 'pm_board_farmland_irrigated_r',
        propSprite: 'skill_culinary',
        color: '#fbbf24',
        description: 'A professional cooking station. Significantly speeds up culinary tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'culinary', range: 'adjacent' }
        ]
    },
    ocean: {
        id: 'ocean',
        name: 'Ocean',
        icon: '🌊',
        sprite: 'pm_test_nautical',
        description: 'Deep water. Required for Nautical tasks.',
        bonuses: [],
        constraints: {
            allowedCategories: ['fishing', 'nautical'],
            blockedCategories: ['mining', 'logging', 'crafting']
        }
    },
    gutter: {
        id: 'gutter',
        name: 'Wilderness',
        icon: '🌫️',
        sprite: 'pm_stone_base',
        description: 'Dangerous outer lands. Players cannot place cards here.',
        isGutter: true,
        isNonPlayable: true
    }
};

// Freeze all definitions for V8 optimization
for (const tile of Object.values(_TILE_TYPES)) Object.freeze(tile);
export const TILE_TYPES = Object.freeze(_TILE_TYPES);

/** O(1) lookup. Returns plains as default — never null. */
export function getTileType(id) {
    return TILE_TYPES[id] || TILE_TYPES.plains;
}
