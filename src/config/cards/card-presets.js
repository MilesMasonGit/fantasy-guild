/**
 * Fantasy Guild - Card Presets
 * Trait bundles that expand into full trait arrays
 */

/**
 * CARD_PRESETS
 * Each preset is a function that takes a config object and returns an array of traits.
 * This allows cards to use a simple "preset" field instead of defining traits manually.
 */
export const CARD_PRESETS = {
    /**
     * BASIC_TASK - Standard work cycle task
     * Used for: gathering, farming, simple production
     * Config: { skill, actionLabel, xp, outputs }
     */
    BASIC_TASK: (config) => [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'skill_req', type: 'skillrequirement', skill: config.skill, level: config.levelRequired || 1 },
        { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' },
        { id: 'work', type: 'workcycle', skill: config.skill, actionLabel: config.actionLabel || 'Working...' },
        { id: 'loot', type: 'loot', items: config.outputs || [] }
    ],

    /**
     * CRAFTING_TASK - Task with input requirements
     * Used for: smelting, crafting, cooking
     * Config: { skill, actionLabel, xp, inputs, outputs }
     */
    CRAFTING_TASK: (config) => {
        const traits = [
            { id: 'header', type: 'header' },
            { id: 'desc', type: 'description' },
            { id: 'skill_req', type: 'skillrequirement', skill: config.skill, level: config.levelRequired || 1 },
            { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' }
        ];

        // Add input slots
        const inputs = config.inputs || [];
        inputs.forEach((input, index) => {
            traits.push({
                id: `input_${index}`,
                type: 'inputslot',
                slotIndex: index,
                itemId: input.itemId,
                acceptTag: input.acceptTag,
                quantity: input.quantity || 1,
                slotLabel: input.slotLabel  // Only use explicit slotLabel, let renderer resolve item names
            });
        });

        traits.push(
            { id: 'work', type: 'workcycle', skill: config.skill, actionLabel: config.actionLabel || 'Crafting...' },
            { id: 'loot', type: 'loot', items: config.outputs || [] }
        );

        return traits;
    },

    /**
     * BASIC_COMBAT - Repeatable combat encounter
     * Used for: hunting, clearing enemies
     * Config: { enemyId }
     */
    BASIC_COMBAT: (config) => [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' },
        { id: 'combat', type: 'combat', enemyId: config.enemyId },
        { id: 'loot', type: 'loot' } // Loot defined by enemy drops
    ],

    /**
     * INVASION - Combat with debuff timer, removed when defeated
     * Used for: enemy invasions, time-pressure encounters
     * Config: { enemyId, killsRequired, debuffType }
     */
    INVASION: (config) => [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' },
        { id: 'debuff', type: 'debuff_timer', debuffType: config.debuffType || 'standard' },
        { id: 'combat', type: 'combat', enemyId: config.enemyId },
        { id: 'quest', type: 'quest', questType: 'combat', count: config.killsRequired || 1 },
        { id: 'reward', type: 'reward', rewards: config.rewards || [] }
    ],

    /**
     * TREASURE - One-time reward, removed after claim
     * Used for: chests, discoveries, quest rewards
     * Config: { rewards }
     */
    TREASURE: (config) => [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' },
        { id: 'reward', type: 'reward', rewards: config.rewards || [], oneTime: true }
    ],

    /**
     * EXPLORE - Discover new areas
     * Used for: exploration cards
     * Config: { skill }
     */
    EXPLORE: (config) => [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' },
        { id: 'selector', type: 'exploreselector' },
        { id: 'discovery', type: 'discovery' },
        { id: 'work', type: 'workcycle', skill: config.skill || 'nature', actionLabel: config.actionLabel || 'Exploring...' }
    ],

    /**
     * AREA - Unlocked location with quests and projects
     * Used for: discovered areas
     * Config: { questType ('combat' or 'collection') }
     */
    AREA: (config) => [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' },
        { id: 'combat', type: 'combat' },
        { id: 'quest', type: 'quest', questType: config.questType || 'combat' }
    ],

    /**
     * RECIPE_SELECTOR - Crafting with recipe selection
     * Used for: forges, kitchens, workbenches
     * Config: { recipeGroup, skill }
     */
    RECIPE_SELECTOR: (config) => [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' },
        { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' },
        { id: 'recipe', type: 'recipe_selector', recipeGroup: config.recipeGroup },
        { id: 'inputs', type: 'dynamic_inputslots' }, // Populated based on selected recipe
        { id: 'work', type: 'workcycle', skill: config.skill, actionLabel: config.actionLabel || 'Crafting...' },
        { id: 'loot', type: 'loot' } // Output based on selected recipe
    ]
};

/**
 * Expand a preset into full traits array
 * @param {string} presetName - Name of the preset (e.g., 'BASIC_TASK')
 * @param {Object} config - Configuration object for the preset
 * @returns {Array} Array of trait objects
 */
export function expandPreset(presetName, config = {}) {
    const preset = CARD_PRESETS[presetName];
    if (!preset) {
        console.warn(`[CardPresets] Unknown preset: ${presetName}`);
        return [];
    }
    return preset(config);
}

/**
 * Get list of available preset names
 * @returns {Array<string>}
 */
export function getPresetNames() {
    return Object.keys(CARD_PRESETS);
}
