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
import { getQuestDefinition } from './questRegistry.js';
import { getInvasion } from './invasionRegistry.js';
import { getDungeon } from './dungeonRegistry.js';

import { DatabaseManager } from '../DatabaseManager.js';

const jsonCardFiles = DatabaseManager.cardFiles;
const jsonWorkstationFiles = DatabaseManager.workstationFiles;
const jsonSubskillFiles = DatabaseManager.subskillFiles;

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
        if (config.level) cardDef.skillRequirement = config.level;
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

    // Load subskills to resolve parent skills for workstations
    let subskillsList = [];
    for (const module of Object.values(jsonSubskillFiles)) {
        const data = module.default || module;
        if (Array.isArray(data)) {
            subskillsList = subskillsList.concat(data);
        } else if (data && typeof data === 'object') {
            subskillsList = subskillsList.concat(Object.values(data));
        }
    }
    const subskillToParent = {};
    subskillsList.forEach(sub => {
        if (sub.id && sub.parentSkill) {
            subskillToParent[sub.id] = sub.parentSkill;
        }
    });

    // Load workstations and map them to card templates
    let workstationsList = [];
    for (const module of Object.values(jsonWorkstationFiles)) {
        const data = module.default || module;
        if (Array.isArray(data)) {
            workstationsList = workstationsList.concat(data);
        } else if (data && typeof data === 'object') {
            workstationsList = workstationsList.concat(Object.values(data));
        }
    }

    workstationsList.forEach(ws => {
        if (!ws.id) return;
        const parentSkill = subskillToParent[ws.subskillId] || 'industry';
        
        const cardDef = {
            id: ws.id,
            name: ws.name,
            cardType: 'workstation',
            areaSet: ws.areaId || null,
            preset: 'RECIPE_SELECTOR',
            config: {
                recipeGroup: ws.subskillId,
                skill: parentSkill,
                actionLabel: 'Crafting...',
                skillCap: ws.skillCap || 90
            },
            sprite: ws.sprite || null,
            isUnique: false
        };

        const processed = processJsonCard(ws.id, cardDef, 'workstation');
        if (processed) {
            jsonCards[ws.id] = processed;
        }
    });

    const count = Object.keys(jsonCards).length;
    if (count > 0) {
        logger.info('CardRegistry', `Loaded ${count} JSON card(s) (including workstations)`);
    }

    return jsonCards;
}

// Load JSON cards at module initialization
const JSON_CARDS = loadJsonCards();

// Combine all cards into main registry (JSON takes priority)
export const CARDS = Object.freeze({
    ...SPECIAL_CARDS,
    ...JSON_CARDS  // JSON cards override special cards with same ID
});

// Validate all cards at startup
validateAllCards(CARDS);

/**
 * Get all card templates
 * @returns {Object}
 */
export function getAllCards() {
    return CARDS;
}

// === Helper Functions ===

// Cache for dynamically resolved templates (Quest, Event, Invasion, Dungeon)
// Ensures reference stability for React components
const DYNAMIC_CACHE = {};

/**
 * Get a card template by ID
 * @param {string} cardId 
 * @returns {Object|null}
 */
export function getCard(cardId) {
    if (!cardId || typeof cardId !== 'string') return null;
    
    // 1. Check static registry
    if (CARDS[cardId]) return CARDS[cardId];
    
    // 2. Check dynamic cache for reference stability
    if (DYNAMIC_CACHE[cardId]) return DYNAMIC_CACHE[cardId];

    let template = null;

    // 3. Dynamic resolution for events
    if (cardId.startsWith('event_')) {
        const eventId = cardId.replace('event_', '');
        const eventDef = getEventDef(eventId);
        if (eventDef) {
            template = {
                ...eventDef,
                cardType: 'event',
                isUnique: false
            };
        }
    }

    // 4. Dynamic resolution for invasions
    if (!template && cardId.startsWith('invasion_')) {
        const invasionId = cardId.replace('invasion_', '');
        const invasionDef = getInvasion(invasionId);
        if (invasionDef) {
            template = {
                ...invasionDef,
                cardType: 'invasion',
                isUnique: false
            };
        }
    }

    // 5. Dynamic resolution for dungeons
    if (!template && cardId.startsWith('dungeon_')) {
        const dungeonId = cardId.replace('dungeon_', '');
        const dungeonDef = getDungeon(dungeonId);
        if (dungeonDef) {
            template = {
                ...dungeonDef,
                id: cardId,
                cardType: CARD_TYPES.DUNGEON,
                location: 'board'
            };
        }
    }

    // 6. Dynamic resolution for quests (New System)
    if (!template && cardId.startsWith('quest_')) {
        const questDef = getQuestDefinition(cardId);
        if (questDef) {
            template = {
                ...questDef,
                cardType: CARD_TYPES.QUEST,
                description: questDef.description || 'Complete this task to earn an Area Map Fragment.',
                isUnique: true,
                traits: [
                    { id: 'header', type: 'header' },
                    { id: 'desc', type: 'description' },
                    { id: 'quest', type: 'quest' }
                ]
            };
        }
    }

    // Cache the result if found
    if (template) {
        DYNAMIC_CACHE[cardId] = template;
    }

    return template;
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
