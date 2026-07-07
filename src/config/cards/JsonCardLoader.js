import { expandPreset } from './card-presets.js';
import { logger } from '../../utils/Logger.js';
import { DatabaseManager } from '../DatabaseManager.js';

/**
 * Card type to folder mapping
 */
const CARD_TYPE_FOLDERS = {
    task: 'tasks',
    combat: 'combat',
    crafting: 'crafting',
    explore: 'explore',
    area: 'area',
    invasion: 'invasion',
    treasure: 'treasure',
    recruit: 'recruit'
};

/**
 * Storage for loaded JSON cards
 */
let loadedCards = {};
let isLoaded = false;

/**
 * Load all card JSON files from data/cards/
 * This should be called once at game startup
 * @returns {Promise<Object>} All loaded cards keyed by ID
 */
export async function loadAllCards() {
    if (isLoaded) {
        logger.debug('JsonCardLoader', 'Cards already loaded, returning cached');
        return loadedCards;
    }

    logger.info('JsonCardLoader', 'Loading JSON card definitions...');
    loadedCards = {};

    // Load each card type folder
    for (const [cardType, folderName] of Object.entries(CARD_TYPE_FOLDERS)) {
        try {
            await loadCardsFromFolder(cardType, folderName);
        } catch (error) {
            logger.warn('JsonCardLoader', `Failed to load ${folderName} folder: ${error.message}`);
        }
    }

    isLoaded = true;
    const count = Object.keys(loadedCards).length;
    logger.info('JsonCardLoader', `Loaded ${count} cards from JSON`);

    return loadedCards;
}

/**
 * Load cards from a specific type folder
 * @param {string} cardType - Card type (task, combat, etc.)
 * @param {string} folderName - Folder name in data/cards/
 */
async function loadCardsFromFolder(cardType, folderName) {
    // Get all JSON files in the folder using the centralized DatabaseManager
    const jsonFiles = DatabaseManager.cardFiles;

    for (const [path, module] of Object.entries(jsonFiles)) {
        // Check if this file is in the correct folder
        if (!path.includes(`/cards/${folderName}/`)) continue;

        try {
            const cardsData = module.default || module;

            // Each JSON file can contain multiple cards (keyed by ID)
            for (const [cardId, cardDef] of Object.entries(cardsData)) {
                const processedCard = processCardDefinition(cardId, cardDef, cardType);
                if (processedCard) {
                    loadedCards[cardId] = processedCard;
                }
            }

            logger.debug('JsonCardLoader', `Loaded cards from ${path}`);
        } catch (error) {
            logger.warn('JsonCardLoader', `Error processing ${path}: ${error.message}`);
        }
    }
}

/**
 * Process a single card definition
 * Expands presets and normalizes fields
 * @param {string} cardId - Card ID
 * @param {Object} cardDef - Raw card definition from JSON
 * @param {string} cardType - Card type from folder
 * @returns {Object|null} Processed card or null if invalid
 */
function processCardDefinition(cardId, cardDef, cardType) {
    // Ensure ID is set
    if (!cardDef.id) {
        cardDef.id = cardId;
    }

    // Ensure card type is set
    if (!cardDef.cardType) {
        cardDef.cardType = cardType;
    }

    // Expand preset if specified
    if (cardDef.preset && !cardDef.traits) {
        const config = cardDef.config || {};
        cardDef.traits = expandPreset(cardDef.preset, config);

        // Copy config values to top-level for compatibility
        if (config.baseTickTime) cardDef.baseTickTime = config.baseTickTime;
        if (config.xp) cardDef.xpAwarded = config.xp;
        if (config.skill) cardDef.skill = config.skill;
        if (config.outputs) cardDef.outputs = config.outputs;
        if (config.inputs) cardDef.inputs = config.inputs;
        if (config.enemyId) cardDef.enemyId = config.enemyId;
    }

    // Set defaults
    cardDef.isUnique = cardDef.isUnique ?? false;
    cardDef.baseTickTime = cardDef.baseTickTime ?? 10000;
    cardDef.skillRequirement = cardDef.skillRequirement ?? 0;

    return cardDef;
}

/**
 * Get a loaded card by ID
 * @param {string} cardId 
 * @returns {Object|null}
 */
export function getJsonCard(cardId) {
    return loadedCards[cardId] || null;
}

/**
 * Get all loaded cards
 * @returns {Object}
 */
export function getAllJsonCards() {
    return { ...loadedCards };
}

/**
 * Check if cards have been loaded
 * @returns {boolean}
 */
export function isCardsLoaded() {
    return isLoaded;
}

/**
 * Force reload all cards (useful for development)
 */
export async function reloadCards() {
    isLoaded = false;
    loadedCards = {};
    return loadAllCards();
}
