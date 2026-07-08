import { getItem } from '../registries/itemRegistry.js';

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
    BASIC_TASK: (config) => {
        const primaryOutput = config.outputs?.[0];
        const item = primaryOutput ? getItem(primaryOutput.itemId) : null;

        const traits = [
            { id: 'header', type: 'header' },
            { id: 'desc', type: 'description' },
            { id: 'skill_req', type: 'skillrequirement', skill: config.skill, level: config.levelRequired || 1 },
            { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' }
        ];

        // Add tool slot if accepted tool is defined
        if (config.acceptedToolType) {
            traits.push({
                id: 'tool',
                type: 'toolslot',
                toolType: config.acceptedToolType,
                minTier: config.minToolTier || 0
            });
        }

        traits.push(
            {
                id: 'work',
                type: 'workcycle',
                skill: config.skill,
                actionLabel: config.actionLabel || 'Working...',
                taskIcon: config.outputs?.[0]?.itemId || '📜'
            },
            { id: 'loot', type: 'loot', items: config.outputs || [] }
        );

        return traits;
    },

    /**
     * CRAFTING_TASK - Task with input requirements
     * Used for: smelting, crafting, cooking
     * Config: { skill, actionLabel, xp, inputs, outputs }
     */
    CRAFTING_TASK: (config) => {
        const primaryOutput = config.outputs?.[0];
        const item = primaryOutput ? getItem(primaryOutput.itemId) : null;

        const traits = [
            { id: 'header', type: 'header' },
            { id: 'desc', type: 'description' },
            { id: 'skill_req', type: 'skillrequirement', skill: config.skill, level: config.levelRequired || 1 },
            { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Hero' }
        ];

        // Add input slots
        if (config.genericSlots) {
            config.genericSlots.forEach((slot, index) => {
                traits.push({
                    id: `input_${index}`,
                    type: 'inputslot',
                    slotIndex: index,
                    acceptTags: slot.acceptTags || [],
                    slotLabel: slot.slotLabel
                });
            });
        } else {
            // Legacy fallback for cards that haven't migrated to generic slots
            const inputs = config.inputs || [];
            inputs.forEach((input, index) => {
                traits.push({
                    id: `input_${index}`,
                    type: 'inputslot',
                    slotIndex: index,
                    itemId: input.itemId,
                    acceptTags: input.acceptTag ? [input.acceptTag] : [],
                    quantity: input.quantity || 1,
                    slotLabel: input.slotLabel  // Only use explicit slotLabel, let renderer resolve item names
                });
            });
        }

        traits.push(
            {
                id: 'work',
                type: 'workcycle',
                skill: config.skill,
                actionLabel: config.actionLabel || 'Crafting...',
                taskIcon: config.outputs?.[0]?.itemId || '📜'
            },
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
     * Config: { skill, requiredItem, requiredQuantity }
     */
    EXPLORE: (config) => {
        const traits = [
            { id: 'header', type: 'header' },
            { id: 'desc', type: 'description' },
            { id: 'skill_req', type: 'skillrequirement', skill: config.skill || 'nature', level: 1 },
            { id: 'hero', type: 'heroslot', title: config.heroTitle || 'Explorer' }
        ];

        // Add dynamic input slot for the exploration cost if provided
        if (config.requiredItem) {
            traits.push({
                id: 'explore_cost',
                type: 'inputslot',
                slotIndex: 0,
                itemId: config.requiredItem,
                quantity: config.requiredQuantity || 5,
                slotLabel: 'Supplies'
            });
        }

        traits.push(
            { id: 'work', type: 'workcycle', skill: config.skill || 'nature', actionLabel: config.actionLabel || 'Exploring...' },
            { id: 'quest_selection', type: 'quest_selection' }
        );

        return traits;
    },

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
    ],

    /**
     * CONSUMABLE - Banked-item pipeline card (Deck Loop rework, Phase 5)
     * Slotted into an area deck; each loop pass consumes 1 unit of
     * config.itemId from the guild bank (§3E). Presentation-only traits —
     * the LoopRunner drives consumption directly off the template.
     * Config: { itemId }
     */
    CONSUMABLE: (config) => [
        { id: 'header', type: 'header' },
        { id: 'desc', type: 'description' }
    ],

    /**
     * BLUEPRINT - Specialization modifier card
     * Used for: pie tin, pickaxe, etc.
     */
    BLUEPRINT: (config) => {
        const skillRaw = config.requiredSkill || "unknown";
        const skillName = skillRaw.charAt(0).toUpperCase() + skillRaw.slice(1);

        return [
            { id: 'header', type: 'header' },
            { id: 'img', type: 'sprite' },
            { id: 'desc', type: 'description', text: `Requires ${skillName} Spec.` },
            { id: 'draggable', type: 'draggable' }
        ];
    }
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
