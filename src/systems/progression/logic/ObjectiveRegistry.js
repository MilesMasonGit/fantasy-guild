/**
 * Objective handlers for QuestTracker.
 * Maps event types to validation logic.
 */
const HANDLERS = {
    'ON_ENEMY_KILLED': (template, payload) => {
        const isMatch = template.targetId === 'any' || template.targetId === payload.enemyId;
        return { isMatch, amount: isMatch ? 1 : 0 };
    },

    'ON_ITEM_GAINED': (template, payload) => {
        const isMatch = template.targetId === 'any' || template.targetId === payload.itemId;
        return { isMatch, amount: isMatch ? (payload.amount || 1) : 0 };
    },

    'ON_CRAFT_COMPLETED': (template, payload) => {
        const isMatch = template.targetId === 'any' || template.targetId === payload.recipeId;
        return { isMatch, amount: isMatch ? 1 : 0 };
    },

    // Extensibility: Future handlers
    'ON_EXPLORATION_COMPLETED': (template, payload) => {
        const isMatch = template.targetId === 'any' || template.targetId === payload.areaId;
        return { isMatch, amount: isMatch ? 1 : 0 };
    },

    // Action quests (Quest System v2 — tutorial MSQs like "Deploy a Hero").
    'ON_HERO_ASSIGNED': (template, payload) => {
        const isMatch = template.targetId === 'any' || !template.targetId || template.targetId === payload.areaId;
        return { isMatch, amount: isMatch ? 1 : 0 };
    }
};

/**
 * Evaluate if a quest instance is progressed by an event.
 * @param {Object} template - The quest definition 
 * @param {string} eventType - The type of event (e.g., 'ON_ITEM_GAINED')
 * @param {Object} payload - The event data
 * @returns {Object} { isMatch: boolean, amount: number }
 */
export const ObjectiveRegistry = {
    evaluate(template, eventType, payload) {
        const handler = HANDLERS[eventType];
        if (!handler) return { isMatch: false, amount: 0 };
        return handler(template, payload);
    }
};
