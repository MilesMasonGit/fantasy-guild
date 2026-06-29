// Fantasy Guild - Quest Registry
// Defines all passive exploration quests

/**
 * Registry of all available quests per area
 * Each quest tracks a specific event type and target
 */
const STATIC_QUEST_REGISTRY = {};

/**
 * Load all JSON quest files from data/
 * Uses Vite's import.meta.glob for static analysis
 */
import { DatabaseManager } from '../DatabaseManager.js';

const jsonQuestFilesSingle = DatabaseManager.questFilesSingle;
const jsonQuestFilesGlob = DatabaseManager.questFilesGlob;

function loadJsonQuests() {
    const dynamicQuests = {};

    function processQuestsData(questsData) {
        for (const [questId, questDef] of Object.entries(questsData)) {
            if (!questDef.id) questDef.id = questId;
            const areaId = questDef.areaId || 'global';
            if (!dynamicQuests[areaId]) {
                dynamicQuests[areaId] = [];
            }
            // Remove duplicates from the same area if we reload
            dynamicQuests[areaId] = dynamicQuests[areaId].filter(q => q.id !== questDef.id);
            dynamicQuests[areaId].push(questDef);
        }
    }

    // Process quests.json if it exists
    for (const [path, module] of Object.entries(jsonQuestFilesSingle)) {
        try {
            const questsData = module.default || module;
            processQuestsData(questsData);
        } catch (error) {
            console.warn(`Error loading quest JSON from ${path}:`, error);
        }
    }

    // Process quests/**/*.json if they exist
    for (const [path, module] of Object.entries(jsonQuestFilesGlob)) {
        try {
            const questsData = module.default || module;
            processQuestsData(questsData);
        } catch (error) {
            console.warn(`Error loading quest JSON from ${path}:`, error);
        }
    }

    return dynamicQuests;
}

const DYNAMIC_QUESTS = loadJsonQuests();

// Merge static quests and dynamic quests
export const QUEST_REGISTRY = { ...STATIC_QUEST_REGISTRY };

for (const [areaId, quests] of Object.entries(DYNAMIC_QUESTS)) {
    if (!QUEST_REGISTRY[areaId]) {
        QUEST_REGISTRY[areaId] = [];
    }
    // Merge without duplicates
    const existingIds = new Set(QUEST_REGISTRY[areaId].map(q => q.id));
    for (const q of quests) {
        if (existingIds.has(q.id)) {
            // Overwrite static quest if ID matches
            QUEST_REGISTRY[areaId] = QUEST_REGISTRY[areaId].map(oldQ => oldQ.id === q.id ? q : oldQ);
        } else {
            QUEST_REGISTRY[areaId].push(q);
        }
    }
}

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
