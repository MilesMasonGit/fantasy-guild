// Fantasy Guild - Area Set Registry
// Defines all Area Sets for the Booster Pack system.

import { logger } from '../../utils/Logger.js';

/**
 * AreaSetRegistry - Defines themed "Areas" that group cards into Sets.
 *
 * Each Area Set:
 * - Has a pool of cards that can drop from its Booster Packs.
 * - Requires a number of Map Fragments (from Quests) to unlock.
 * - Has escalating pack Gold costs.
 * - Provides areaArt used for World Map, Packs, Chests, and Quests.
 */

const STATIC_AREA_SETS = {};

/**
 * Load all JSON area sets from data/cards/area/areas.json
 * Uses Vite's import.meta.glob for static analysis
 */
import { DatabaseManager } from '../DatabaseManager.js';

const jsonAreaFilesSingle = DatabaseManager.areaFilesSingle;
const jsonAreaFilesGlob = DatabaseManager.areaFilesGlob;

function loadJsonAreas() {
    const dynamicAreas = {};

    function processAreasData(areasData) {
        for (const [areaId, areaDef] of Object.entries(areasData)) {
            if (!areaDef.id) areaDef.id = areaId;
            dynamicAreas[areaId] = areaDef;
        }
    }

    // Process areas.json if it exists
    for (const [path, module] of Object.entries(jsonAreaFilesSingle)) {
        try {
            const areasData = module.default || module;
            processAreasData(areasData);
        } catch (error) {
            console.warn(`Error loading area JSON from ${path}:`, error);
        }
    }

    // Process other area JSONs in cards/area/
    for (const [path, module] of Object.entries(jsonAreaFilesGlob)) {
        try {
            const areasData = module.default || module;
            processAreasData(areasData);
        } catch (error) {
            console.warn(`Error loading area JSON from ${path}:`, error);
        }
    }

    return dynamicAreas;
}

const DYNAMIC_AREA_SETS = loadJsonAreas();

export const AREA_SETS = {
    ...STATIC_AREA_SETS,
    ...DYNAMIC_AREA_SETS
};

// Auto-populate cardPool and deckList from dynamic cards
function populateCardPools(areaSets) {
    const jsonCardFilesGlob = DatabaseManager.cardFiles;
    const jsonWorkstationFilesGlob = DatabaseManager.workstationFiles;

    // Helper to add card to area set pool
    function addCardToPool(cardId, cardDef, areaId) {
        const areaSet = areaSets[areaId];
        if (!areaSet) return;

        const isQuest = cardId.startsWith('quest_') || cardDef.cardType === 'quest';
        const isExplore = cardId.startsWith('explore_') || cardDef.cardType === 'explore';
        const isPack = cardId.startsWith('pack_') || cardDef.cardType === 'pack' || cardId === 'booster_pack';
        const isChest = cardDef.cardType === 'chest';
        const isDungeon = cardDef.cardType === 'dungeon';

        if (isQuest || isExplore || isPack || isChest || isDungeon) return;

        if (!areaSet.cardPool) areaSet.cardPool = [];
        if (!areaSet.deckList) areaSet.deckList = {};

        if (areaSet.deckList[cardId] === undefined) {
            const isUnique = cardDef.isUnique || cardDef.config?.isUnique;
            const weight = isUnique ? 5 : 10;
            const count = isUnique ? 1 : 4;

            areaSet.cardPool.push({ cardId, weight, isUnique });
            areaSet.deckList[cardId] = count;
        }
    }

    // Process standard card files
    for (const [path, module] of Object.entries(jsonCardFilesGlob)) {
        try {
            if (path.includes('/area/')) continue;
            const cardsData = module.default || module;
            for (const [cardId, cardDef] of Object.entries(cardsData)) {
                const areaId = cardDef.areaId || cardDef.config?.areaId || cardDef.biomeId || cardDef.areaSet;
                if (!areaId) continue;
                addCardToPool(cardId, cardDef, areaId);
            }
        } catch (error) {
            console.warn(`Error scanning card file for pools ${path}:`, error);
        }
    }

    // Process workstation files
    for (const [path, module] of Object.entries(jsonWorkstationFilesGlob)) {
        try {
            const workstationsData = module.default || module;
            const list = Array.isArray(workstationsData) ? workstationsData : Object.values(workstationsData);
            for (const ws of list) {
                if (!ws.id || !ws.areaId) continue;
                addCardToPool(ws.id, { cardType: 'workstation', isUnique: false }, ws.areaId);
            }
        } catch (error) {
            console.warn(`Error scanning workstations for pools ${path}:`, error);
        }
    }
}

populateCardPools(AREA_SETS);
Object.freeze(AREA_SETS);

// === Helper Functions ===

/**
 * Get an Area Set by ID
 * @param {string} areaSetId
 * @returns {Object|null}
 */
export function getAreaSet(areaSetId) {
    return AREA_SETS[areaSetId] || null;
}

/**
 * Get all Area Set definitions
 * @returns {Object}
 */
export function getAllAreaSets() {
    return AREA_SETS;
}

/**
 * Get all Area Set IDs
 * @returns {string[]}
 */
export function getAllAreaSetIds() {
    return Object.keys(AREA_SETS);
}

/**
 * Get the total number of fragments required to unlock an area
 * @param {string} areaSetId
 * @returns {number}
 */
export function getRequiredFragments(areaSetId) {
    const set = getAreaSet(areaSetId);
    return set ? set.totalFragments : Infinity;
}

/**
 * Calculate the gold cost for the next pack purchase in an area
 * @param {string} areaSetId
 * @param {number} packsBought - Number of packs already purchased in this area
 * @returns {number}
 */
export function getPackCost(areaSetId, packsBought = 0) {
    const set = getAreaSet(areaSetId);
    if (!set) return 50;
    const calculated = set.packBaseGoldCost + (packsBought * (set.packCostScaling || 0));
    return Math.max(50, calculated);
}

/**
 * Get the total number of cards in an area's set (sum of all counts in deckList)
 * @param {string} areaSetId
 * @returns {number}
 */
export function getSetTotal(areaSetId) {
    const set = getAreaSet(areaSetId);
    if (!set || !set.deckList) return 0;
    return Object.values(set.deckList).reduce((sum, count) => sum + count, 0);
}

logger.info('AreaSetRegistry', `Loaded ${Object.keys(AREA_SETS).length} Area Set(s)`);
