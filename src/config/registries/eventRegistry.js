/**
 * EventRegistry - Definitions for dynamic Regional Events
 * Stages I-III (250, 500, 750 Chaos Points)
 */

export const EVENTS = {
    forest: [
        {
            id: 'bountiful_bloom',
            name: 'Bountiful Bloom',
            icon: '🌸',
            type: 'positive',
            description: 'Nature thrives today. Nearby nature tasks gain +50% yield.',
            durationMs: 600000, // 10 minutes
            traits: [
                { type: 'aura', radius: 1, targetCategory: 'NATURE', effectType: 'YIELD', value: 0.5 }
            ]
        },
        {
            id: 'morning_mist',
            name: 'Morning Mist',
            icon: '🌫️',
            type: 'positive',
            description: 'The cool mist aids concentration. +10% XP gain for all skills.',
            durationMs: 300000, // 5 minutes
            traits: [
                { type: 'aura', radius: 2, targetCategory: 'ALL', effectType: 'XP', value: 0.1 }
            ]
        },
        {
            id: 'thorn_tangle',
            name: 'Thorn Tangle',
            icon: '🌿',
            type: 'hazard',
            description: 'Overgrown briers slow movement. Nearby tasks take 20% longer.',
            durationMs: 300000,
            traits: [
                { type: 'aura', radius: 1, targetCategory: 'ALL', effectType: 'SPEED', value: -0.2 }
            ]
        },
        {
            id: 'rainfall',
            name: 'Rainfall',
            icon: '🌧️',
            type: 'positive',
            description: 'A refreshing downpour. Nearby nature tasks are 10% faster.',
            durationMs: 300000,
            traits: [
                { type: 'aura', radius: 1, targetCategory: 'NATURE', effectType: 'SPEED', value: 0.1 }
            ]
        }
    ],
    farmland: [
        {
            id: 'golden_harvest',
            name: 'Golden Harvest',
            icon: '🌾',
            type: 'positive',
            description: 'The soil is rich. Nearby farming yields +50%.',
            durationMs: 600000,
            traits: [
                { type: 'aura', radius: 1, targetCategory: 'FARMING', effectType: 'YIELD', value: 0.5 }
            ]
        },
        {
            id: 'rainfall',
            name: 'Rainfall',
            icon: '🌧️',
            type: 'positive',
            description: 'A refreshing downpour. Nearby nature tasks are 10% faster.',
            durationMs: 300000,
            traits: [
                { type: 'aura', radius: 1, targetCategory: 'NATURE', effectType: 'SPEED', value: 0.1 }
            ]
        }
    ],
    area_guild_hall: [
        {
            id: 'efficient_logistics',
            name: 'Efficient Logistics',
            icon: '📦',
            type: 'positive',
            description: 'Storage management is humming. 10% faster production.',
            durationMs: 900000, // 15 minutes
            traits: [
                { type: 'aura', radius: 2, targetCategory: 'PRODUCTION', effectType: 'SPEED', value: 0.1 }
            ]
        }
    ]
};

/**
 * Get events for a specific area
 * @param {string} areaId 
 * @returns {Array}
 */
export function getAreaEvents(areaId) {
    return EVENTS[areaId] || [];
}

/**
 * Get a random event for an area
 * @param {string} areaId 
 * @returns {Object|null}
 */
export function getRandomEvent(areaId) {
    const pool = getAreaEvents(areaId);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get event definition by ID (global lookup)
 */
export function getEventDef(eventId) {
    for (const areaEvents of Object.values(EVENTS)) {
        const found = areaEvents.find(e => e.id === eventId);
        if (found) return found;
    }
    return null;
}
