// Fantasy Guild - Card Registry
// Unified card registry with JSON + legacy support

// Re-export constants
export * from './cardConstants.js';

// Import constants for local usage
import { CARD_TYPES, TASK_CATEGORIES, CARD_RARITIES } from './cardConstants.js';

// Import system card definitions (recruit, area_dynamic)
import { SPECIAL_CARDS } from './cards/specialCards.js';

// Import preset expansion
import { expandPreset } from '../cards/card-presets.js';
import { validateAllCards } from '../cards/CardValidator.js';
import { logger } from '../../utils/Logger.js';
import { getEventDef } from './eventRegistry.js';
import { getInvasion } from './invasionRegistry.js';
import { getDungeon } from './dungeonRegistry.js';

/**
 * Load all JSON card files from data/cards/
 * Uses Vite's import.meta.glob for static analysis
 */
const jsonCardFiles = import.meta.glob('/data/cards/**/*.json', { eager: true });

/**
 * Process a single JSON card definition
 */
function processJsonCard(cardId, cardDef, cardType) {
    // Ensure ID is set
    if (!cardDef.id) cardDef.id = cardId;

    // Ensure card type is set
    if (!cardDef.cardType) cardDef.cardType = cardType;

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
        if (config.minToolTier) cardDef.minToolTier = config.minToolTier;
        if (config.acceptedToolType) cardDef.acceptedToolType = config.acceptedToolType;
        if (config.enemyId) cardDef.enemyId = config.enemyId;
    }

    // Set defaults
    cardDef.isUnique = cardDef.isUnique ?? false;
    cardDef.areaSet = cardDef.areaSet ?? null;
    cardDef.baseTickTime = cardDef.baseTickTime ?? 10000;
    cardDef.skillRequirement = cardDef.skillRequirement ?? 0;

    return cardDef;
}

/**
 * Load and process all JSON cards
 */
function loadJsonCards() {
    const jsonCards = {};
    const folderTypeMap = {
        'tasks': 'task',
        'combat': 'combat',
        'crafting': 'crafting',
        'explore': 'explore',
        'area': 'area',
        'invasion': 'invasion',
        'treasure': 'treasure',
        'recruit': 'recruit',
        'quest': 'quest',
        'chest': 'chest',
        'dungeon': 'dungeon',
        'blueprint': 'blueprint',
        'pack': 'pack',
        'project': 'project'
    };

    for (const [path, module] of Object.entries(jsonCardFiles)) {
        // Determine card type from folder path
        let cardType = 'task';
        for (const [folder, type] of Object.entries(folderTypeMap)) {
            if (path.includes(`/cards/${folder}/`)) {
                cardType = type;
                break;
            }
        }

        try {
            const cardsData = module.default || module;

            for (const [cardId, cardDef] of Object.entries(cardsData)) {
                const processed = processJsonCard(cardId, cardDef, cardType);
                if (processed) {
                    jsonCards[cardId] = processed;
                }
            }

            logger.debug('CardRegistry', `Loaded JSON cards from ${path}`);
        } catch (error) {
            logger.warn('CardRegistry', `Error loading ${path}: ${error.message}`);
        }
    }

    const count = Object.keys(jsonCards).length;
    if (count > 0) {
        logger.info('CardRegistry', `Loaded ${count} JSON card(s)`);
    }

    return jsonCards;
}

// Load JSON cards at module initialization
const JSON_CARDS = loadJsonCards();

// Combine all cards into main registry (JSON takes priority)
export const CARDS = {
    ...SPECIAL_CARDS,
    ...JSON_CARDS  // JSON cards override special cards with same ID
};

// Validate all cards at startup
validateAllCards(CARDS);

// === Helper Functions ===

/**
 * Get a card template by ID
 * @param {string} cardId 
 * @returns {Object|null}
 */
export function getCard(cardId) {
    if (CARDS[cardId]) return CARDS[cardId];

    // Dynamic resolution for events
    if (cardId?.startsWith('event_')) {
        const eventId = cardId.replace('event_', '');
        const eventDef = getEventDef(eventId);
        if (eventDef) {
            return {
                ...eventDef,
                cardType: 'event',
                isUnique: false
            };
        }
    }

    // Dynamic resolution for invasions
    if (cardId?.startsWith('invasion_')) {
        const invasionId = cardId.replace('invasion_', '');
        const invasionDef = getInvasion(invasionId);
        if (invasionDef) {
            return {
                ...invasionDef,
                cardType: 'invasion',
                isUnique: false
            };
        }
    }

    // Dynamic resolution for dungeons
    if (cardId?.startsWith('dungeon_')) {
        const dungeonId = cardId.replace('dungeon_', '');
        const template = getDungeon(dungeonId);
        if (template) {
            return {
                ...template,
                id: cardId, // CRITICAL: Preserve the full ID for UI template lookups
                cardType: CARD_TYPES.DUNGEON,
                location: 'board'
            };
        }
    }

    return null;
}

/**
 * Get all card templates
 * @returns {Object}
 */
export function getAllCards() {
    return { ...CARDS };
}

/**
 * Get cards by type
 * @param {string} cardType 
 * @returns {Array}
 */
export function getCardsByType(cardType) {
    return Object.values(CARDS).filter(c => c.cardType === cardType);
}

/**
 * Get all task cards
 * @returns {Array}
 */
export function getTaskCards() {
    return getCardsByType(CARD_TYPES.TASK);
}

/**
 * Get all unique cards (don't count against limit)
 * @returns {Array}
 */
export function getUniqueCards() {
    return Object.values(CARDS).filter(c => c.isUnique);
}

/**
 * Check if a card requires a specific skill level
 * @param {string} cardId 
 * @param {number} skillLevel 
 * @returns {boolean}
 */
export function meetsRequirement(cardId, skillLevel) {
    const card = getCard(cardId);
    if (!card) return false;
    return skillLevel >= (card.skillRequirement || 0);
}

/**
 * Get all card IDs
 * @returns {Array<string>}
 */
export function getAllCardIds() {
    return Object.keys(CARDS);
}

/**
 * Get card count
 * @returns {number}
 */
export function getCardCount() {
    return Object.keys(CARDS).length;
}



/**
 * Get all combat card templates
 * @returns {Array}
 */
export function getCombatCards() {
    return getCardsByType(CARD_TYPES.COMBAT);
}

/**
 * Get combat cards by biome
 * @param {string} biomeId 
 * @returns {Array}
 */
export function getCombatCardsByBiome(biomeId) {
    return Object.values(CARDS).filter(
        c => c.cardType === CARD_TYPES.COMBAT && c.biomeId === biomeId
    );
}

/**
 * Get a random combat card for a biome
 * @param {string} biomeId 
 * @returns {Object|null}
 */
export function getRandomCombatCardForBiome(biomeId) {
    const combatCards = getCombatCardsByBiome(biomeId);
    if (combatCards.length === 0) return null;
    return combatCards[Math.floor(Math.random() * combatCards.length)];
}

/**
 * Get all cards belonging to a specific Area Set
 * @param {string} areaSetId
 * @returns {Array}
 */
export function getCardsByAreaSet(areaSetId) {
    return Object.values(CARDS).filter(c => c.areaSet === areaSetId);
}
