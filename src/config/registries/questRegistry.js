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
            icon: '🔥'
        },
        {
            id: 'quest_gh_water',
            name: 'Clean Refreshment',
            description: 'Provide fresh Water from the well.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'drink_water',
            maxProgress: 1,
            icon: '💧'
        },
        {
            id: 'quest_gh_copper',
            name: 'Basic Materials',
            description: 'Mine Copper Ore for early crafting.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'ore_copper',
            maxProgress: 1,
            icon: '⛏️'
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
            icon: '🐺'
        },
        {
            id: 'quest_forest_berries',
            name: 'Forage Supplies',
            description: 'Gather Red Berries from the forest.',
            targetEvent: 'ON_ITEM_GAINED',
            targetId: 'red_berry',
            maxProgress: 50,
            icon: '🍒'
        },
        {
            id: 'quest_forest_spiders',
            name: 'Clear the Webs',
            description: 'Defeat Spiders lurking in the canopy.',
            targetEvent: 'ON_ENEMY_KILLED',
            targetId: 'spider', // Placeholder
            maxProgress: 10,
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
