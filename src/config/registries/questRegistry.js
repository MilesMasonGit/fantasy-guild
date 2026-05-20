// Fantasy Guild - Quest Registry
// Defines all passive exploration quests

/**
 * Registry of all available quests per area
 * Each quest tracks a specific event type and target
 */
export const QUEST_REGISTRY = {
    guild_hall_v1: [
        {
            id: 'quest_gh_charcoal',
            name: 'Fuel the Fires',
            description: 'Gather Charcoal to keep the guild warm.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'wood_charcoal',
            maxProgress: 1,
            mapFragmentTarget: 'mountain_v1',
            fragmentIcon: '🏔️',
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 50 }
            ],
            icon: '🔥'
        },
        {
            id: 'quest_gh_water',
            name: 'Clean Refreshment',
            description: 'Provide fresh Water from the well.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'drink_water',
            maxProgress: 1,
            mapFragmentTarget: 'village_v1',
            fragmentIcon: '🏠',
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 50 }
            ],
            icon: '💧'
        },
        {
            id: 'quest_gh_copper',
            name: 'Basic Materials',
            description: 'Mine Copper Ore for early crafting.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'ore_copper',
            maxProgress: 1,
            mapFragmentTarget: 'mountain_v1',
            fragmentIcon: '🏔️',
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 50 }
            ],
            icon: '⛏️'
        },
        {
            id: 'quest_gh_wood',
            name: 'Timber Supply',
            description: 'Chop some Oak Wood for the workshop.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'wood_oak',
            maxProgress: 1,
            mapFragmentTarget: 'forest_v1',
            fragmentIcon: '🌲',
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 50 }
            ],
            icon: '🪓'
        },
        {
            id: 'quest_gh_berries',
            name: 'Wild Foraging',
            description: 'Pick some sweet Berries from the garden.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'berries',
            maxProgress: 1,
            mapFragmentTarget: 'forest_v1',
            fragmentIcon: '🌲',
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 50 }
            ],
            icon: '🍇'
        },
        {
            id: 'quest_gh_herbs',
            name: 'Medicinal Herbs',
            description: 'Gather Herbs for the infirmary.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'herbs',
            maxProgress: 1,
            mapFragmentTarget: 'farmland_v1',
            fragmentIcon: '🥖',
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 50 }
            ],
            icon: '🌿'
        },
        {
            id: 'quest_gh_wheat',
            name: 'Golden Grains',
            description: 'Harvest some Wheat for the bakery.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'wheat',
            maxProgress: 1,
            mapFragmentTarget: 'farmland_v1',
            fragmentIcon: '🥖',
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 50 }
            ],
            icon: '🌾'
        },
        {
            id: 'quest_gh_stone',
            name: 'Foundation Stones',
            description: 'Gather Stone for structural repairs.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'stone',
            maxProgress: 1,
            mapFragmentTarget: 'village_v1',
            fragmentIcon: '🏠',
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 50 }
            ],
            icon: '🪨'
        }
    ],
    forest_v1: [
        {
            id: 'quest_forest_wolves',
            name: 'Thin the Pack',
            description: 'Defeat Wolves threatening the logging camps.',
            targetEvent: 'ON_ENEMY_KILLED',
            targetId: 'wolf',
            maxProgress: 15,
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 250 },
                { type: 'ITEM', id: 'map_fragment', amount: 1 }
            ],
            icon: '🐺'
        },
        {
            id: 'quest_forest_berries',
            name: 'Forage Supplies',
            description: 'Gather Red Berries from the forest.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'red_berry',
            maxProgress: 50,
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 150 },
                { type: 'ITEM', id: 'map_fragment', amount: 1 }
            ],
            icon: '🍒'
        },
        {
            id: 'quest_forest_spiders',
            name: 'Clear the Webs',
            description: 'Defeat Spiders lurking in the canopy.',
            targetEvent: 'ON_ENEMY_KILLED',
            targetId: 'spider', // Placeholder
            maxProgress: 10,
            rewards: [
                { type: 'CURRENCY', id: 'gold', amount: 200 },
                { type: 'ITEM', id: 'map_fragment', amount: 1 }
            ],
            icon: '🕸️'
        }
    ]
};

/**
 * Find a specific quest in the registry by its ID
 * @param {string} questId 
 * @returns {Object|null}
 */
export function getQuestDefinition(questId) {
    for (const areaQuests of Object.values(QUEST_REGISTRY)) {
        const quest = areaQuests.find(q => q.id === questId);
        if (quest) return quest;
    }
    return null;
}

/**
 * Get all available quests for a specific area
 * @param {string} areaId 
 * @returns {Array} Array of quest definitions
 */
export function getAreaQuests(areaId) {
    return QUEST_REGISTRY[areaId] || [];
}
