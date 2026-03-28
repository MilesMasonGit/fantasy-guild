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
    forest: {
        id: 'forest',
        name: 'Forest',
        icon: '🌳',
        sprite: 'pm_test_nature',
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
        color: '#10b981',
        description: 'Advancing the bounds of knowledge. Boosts science tasks.',
        bonuses: [
            { type: 'speed', value: 0.2, category: 'science', range: 'adjacent' }
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
  }
};

// Freeze all definitions for V8 optimization
for (const tile of Object.values(_TILE_TYPES)) Object.freeze(tile);
export const TILE_TYPES = Object.freeze(_TILE_TYPES);

/** O(1) lookup. Returns plains as default — never null. */
export function getTileType(id) {
  return TILE_TYPES[id] || TILE_TYPES.plains;
}
