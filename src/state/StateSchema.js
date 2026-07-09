// Fantasy Guild - State Schema
// Phase 5: State Foundation

/**
 * StateSchema - Defines initial state and validation for game data
 */

/**
 * Game version for save migration
 */
export const GAME_VERSION = '0.2.0';

/**
 * Initial game state for new games
 * This is the complete state structure - all sections must be present
 */
export const INITIAL_STATE = {
    // === Meta ===
    meta: {
        version: GAME_VERSION,
        createdAt: null,       // Set on new game
        lastSavedAt: null,
        totalPlaytime: 0       // Milliseconds
    },

    // === Settings ===
    settings: {
        audio: {
            masterVolume: 0.8,
            musicVolume: 0.5,
            sfxVolume: 1.0,
            muted: false
        },
        gameplay: {
            gameSpeed: 1.0,
            autoSaveInterval: 30,   // Seconds
            showDamageNumbers: true,
            compactCardView: false
        },
        notifications: {
            showItemGained: true,
            showXpGained: false,
            showLevelUp: true,
            showCombatResults: true
        }
    },

    // === Heroes ===
    heroes: [],    // Array of hero objects
    bench: [],     // Array of benched hero objects

    // === Recruitment (Phase 7 drawer flow, USE_DECK_LOOP) ===
    // Candidates persist so players can't reroll for free by reopening the
    // drawer — same lock the legacy board recruit card provided.
    recruitment: {
        candidates: []   // up to 3 generated hero blobs awaiting a hire pick
    },

    cards: {
        active: [],      // Cards currently in play on the board: { id, templateId, position: {x,y}, ... }
        library: [],     // Cards stored in the library
        idCounter: 1,    // Counter for generating unique card IDs
        limits: {
            max: 999,        // Legacy limit
            boardMax: 999,   // Grid-based: effectively unlimited board space (bounded by 12x12)
            libraryMax: 999, // Infinite storage
            currentCount: 1
        }
    },

    // === Inventory ===
    inventory: {
        slots: {
            max: 20,
            used: 0
        },
        maxStack: 99999,
        maxStackBonus: 0,  // Added from projects (inventory_slots/max_stack chains)
        items: {},        // { itemId: { quantity, durabilities? } }
        groupOrder: ['default-loot'],   // ['default-loot', 'default-materials', etc.]
        groupDefs: {
            'default-loot': { title: 'Loot', isCustom: false, id: 'default-loot', orderedItems: [] }
        },    // { 'custom-1': { title: 'Favorites', isCustom: true } }
        itemOverrides: {} // itemId -> groupId mapping: { 'apple': 'custom-1' }
    },

    // === Currency ===
    currency: {
        influence: 10,  // Starting: 1 T1 project @ 10
        gold: 0,        // Starting gold
        totalRecruits: 0  // Tracks number of completed recruitments (cost increases +2 per)
    },

    // === Progress ===
    progress: {
        completedProjects: [],
        projects: {},   // { [projectId]: { level: number, inputProgress: { [itemId]: number } } }
        rosterLimit: 5, // Active roster capacity
        // Track highest completed tier per chain (0 = none completed)
        chainProgress: {
            recruiting: 0,
            inventory_slots: 0,
            max_stack: 0,
            mining_fortune: 0,
            logging_fortune: 0
        },
        unlockedRarities: ['common', 'uncommon'],
        // Per-biome task discovery: { biomeId: ['task1', 'task2', ...] }
        discoveredTasksByBiome: {}
    },

    // === Threats ===
    threats: {
        activeInvasions: [],
        activeDebuffs: []
    },

    // === Modifiers (Project bonuses, cached) ===
    modifiers: {
        // Double items chance by task category: { mining: 0.10, logging: 0.05 }
        doubleItemsChance: {},
        // XP bonus by task category: { mining: 0.10, foraging: 0.15 }
        xpBonus: {}
    },

    // === Time ===
    time: {
        gameTimeMs: 0,
        lastTickAt: null,
        isPaused: false
    },


    // === Collection (Booster Pack system) ===
    collection: {
        // Under USE_DECK_LOOP, `playsets` is the single source of truth for
        // card ownership (Phase 2 §2A decision — the planned `ownedCards`
        // structure was dropped in favor of this existing one). The old
        // cards.active / cards.library arrays remain for the legacy mode only.
        playsets: {},           // { [templateId]: count (0-4) }
        mastery: {},            // { [templateId]: true } — set when playset reaches 4/4
        unlockedAreaSets: ['area_guild_hall'],  // Starting area
        packsBought: {},        // { [areaSetId]: count } — legacy per-area cost scaling
        globalPacksBought: 0,   // unified pack cost scaling (Phase 5 §5F, USE_DECK_LOOP)
        discoveredItems: {},     // { [itemId]: true }
        discoveredEnemies: {},   // { [enemyId]: true }
        itemLifetimeCounts: {},  // { [itemId]: number }
        enemyKillCounts: {},     // { [enemyId]: number }
        cardUseCounts: {},       // { [templateId]: number } — completed loop actions / crafts (Phase 7 binder stats)
        provenance: {},          // { [sourceId]: { [itemId]: true } }
    },

    // === Map Fragments (World Map progression) ===
    mapFragments: {}, // { [targetAreaId]: count }

    // === Grid State (Phase 3 Spatial) ===
    // Current grid configuration for the active area
    grid: {
        width: 8,
        height: 8,
        max_width: 12,
        max_height: 12,
        center: { x: 3, y: 3 },
        tileMap: {},  // Sparse: { '2,3': 'forest', '5,5': 'ocean' }
        propsMap: {}  // Sparse: { '2,3': 'altar_boost' }
    },

    // === Quests (Phase 2 Exploration) ===
    globalQuests: [],

    // === Library (Discovered content for crafting) ===
    library: {
        tasks: []       // Discovered task templateIds: ['logging', 'mining', ...]
    },

    // === UI State (Transient Focus) ===
    ui: {
        activeAreaId: 'area_guild_hall',   // The biome whose board is currently rendered
        newDiscoveries: {}               // { [id]: true } - IDs with active "New!" badges
    },

    // === Area States (Per-Biome Hibernate Storage) ===
    areaStates: {
        // Populated at runtime. Empty on new game because the starting area
        // is live in `cards.active` and doesn't need a snapshot yet.
        //
        // Shape: { [areaId]: AreaStateObject }
    }
};

/**
 * List of all required top-level state keys
 */
const REQUIRED_KEYS = [
    'meta', 'settings', 'heroes', 'cards', 'library',
    'inventory', 'currency', 'progress', 'threats', 'time',
    'collection', 'mapFragments', 'globalQuests'
];

/**
 * Validate save data structure
 * @param {Object} saveData - The save data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSaveData(saveData) {
    const errors = [];

    // Check top-level structure
    if (!saveData) {
        errors.push('Save data is null or undefined');
        return { valid: false, errors };
    }

    if (!saveData.version) {
        errors.push('Missing version field');
    }

    if (!saveData.state) {
        errors.push('Missing state field');
        return { valid: false, errors };
    }

    // Check required state keys
    for (const key of REQUIRED_KEYS) {
        if (!(key in saveData.state)) {
            errors.push(`Missing state.${key}`);
        }
    }

    // Validate heroes array
    if (saveData.state.heroes && !Array.isArray(saveData.state.heroes)) {
        errors.push('state.heroes must be an array');
    }

    // Validate cards structure
    if (saveData.state.cards) {
        if (!Array.isArray(saveData.state.cards.active)) {
            errors.push('state.cards.active must be an array');
        }
        if (saveData.state.cards.library && !Array.isArray(saveData.state.cards.library)) {
            errors.push('state.cards.library must be an array');
        }
    }

    // Validate inventory structure
    if (saveData.state.inventory) {
        if (typeof saveData.state.inventory.items !== 'object') {
            errors.push('state.inventory.items must be an object');
        }
        if (!Array.isArray(saveData.state.inventory.groupOrder)) {
            errors.push('state.inventory.groupOrder must be an array');
        }
    }

    // Validate collection structure
    if (saveData.state.collection) {
        if (typeof saveData.state.collection.playsets !== 'object' || Array.isArray(saveData.state.collection.playsets)) {
            errors.push('state.collection.playsets must be an object');
        } else {
            for (const [templateId, count] of Object.entries(saveData.state.collection.playsets)) {
                if (typeof count !== 'number' || count < 0 || count > 4) {
                    errors.push(`state.collection.playsets.${templateId} must be a number between 0 and 4`);
                }
            }
        }
    }

    // Validate globalQuests structure
    if (saveData.state.globalQuests && !Array.isArray(saveData.state.globalQuests)) {
        errors.push('state.globalQuests must be an array');
    }

    // Validate areaStates structure (if present)
    if (saveData.state.areaStates) {
        if (typeof saveData.state.areaStates !== 'object') {
            errors.push('state.areaStates must be an object');
        } else {
            for (const [areaId, areaState] of Object.entries(saveData.state.areaStates)) {
                // Two valid shapes (Deck Loop rework, Phase 2 §2C):
                // - legacy grid shape carries `cardSnapshots`
                // - deck loop shape carries `deckSlots` (+ loop fields) and no cardSnapshots
                if (areaState.cardSnapshots !== undefined && !Array.isArray(areaState.cardSnapshots)) {
                    errors.push(`state.areaStates.${areaId}.cardSnapshots must be an array`);
                }
                if (areaState.deckSlots !== undefined) {
                    if (!Array.isArray(areaState.deckSlots)) {
                        errors.push(`state.areaStates.${areaId}.deckSlots must be an array`);
                    } else {
                        areaState.deckSlots.forEach((slot, i) => {
                            if (!slot || typeof slot !== 'object') {
                                errors.push(`state.areaStates.${areaId}.deckSlots[${i}] must be an object`);
                                return;
                            }
                            if (slot.templateId !== null && typeof slot.templateId !== 'string') {
                                errors.push(`state.areaStates.${areaId}.deckSlots[${i}].templateId must be a string or null`);
                            }
                            if (typeof slot.slotType !== 'string') {
                                errors.push(`state.areaStates.${areaId}.deckSlots[${i}].slotType must be a string`);
                            }
                        });
                    }
                }
                if (areaState.assignedHeroId !== undefined && areaState.assignedHeroId !== null && typeof areaState.assignedHeroId !== 'string') {
                    errors.push(`state.areaStates.${areaId}.assignedHeroId must be a string or null`);
                }
                if (areaState.activeCardIndex !== undefined && typeof areaState.activeCardIndex !== 'number') {
                    errors.push(`state.areaStates.${areaId}.activeCardIndex must be a number`);
                }
                if (areaState.mode !== undefined && !['adventure', 'stationed'].includes(areaState.mode)) {
                    errors.push(`state.areaStates.${areaId}.mode must be 'adventure' or 'stationed'`);
                }
                if (areaState.stationState !== undefined && (typeof areaState.stationState !== 'object' || areaState.stationState === null)) {
                    errors.push(`state.areaStates.${areaId}.stationState must be an object`);
                }
                if (areaState.unlockQuestProgress !== undefined && (typeof areaState.unlockQuestProgress !== 'object' || areaState.unlockQuestProgress === null)) {
                    errors.push(`state.areaStates.${areaId}.unlockQuestProgress must be an object`);
                }

                // Phase 2: Mastery & Exploration State Checks
                if (areaState.mastery && typeof areaState.mastery !== 'object') {
                    errors.push(`state.areaStates.${areaId}.mastery must be an object`);
                }
                if (areaState.collectionProgress && typeof areaState.collectionProgress !== 'object') {
                    errors.push(`state.areaStates.${areaId}.collectionProgress must be an object`);
                }
                if (areaState.completedQuestIds && !Array.isArray(areaState.completedQuestIds)) {
                    errors.push(`state.areaStates.${areaId}.completedQuestIds must be an array`);
                }
                if (areaState.explorationCount !== undefined && typeof areaState.explorationCount !== 'number') {
                    errors.push(`state.areaStates.${areaId}.explorationCount must be a number`);
                }
                if (areaState.chaosPoints !== undefined && typeof areaState.chaosPoints !== 'number') {
                    errors.push(`state.areaStates.${areaId}.chaosPoints must be a number`);
                }
                if (areaState.chaosStage !== undefined && typeof areaState.chaosStage !== 'number') {
                    errors.push(`state.areaStates.${areaId}.chaosStage must be a number`);
                }
                if (areaState.invasionThreat !== undefined && typeof areaState.invasionThreat !== 'number') {
                    errors.push(`state.areaStates.${areaId}.invasionThreat must be a number`);
                }
                if (areaState.activeInvasionId !== undefined && areaState.activeInvasionId !== null && typeof areaState.activeInvasionId !== 'string') {
                    errors.push(`state.areaStates.${areaId}.activeInvasionId must be a string or null`);
                }
            }
        }
    }

    // Validate bench array
    if (saveData.state.bench && !Array.isArray(saveData.state.bench)) {
        errors.push('state.bench must be an array');
    }

    // Validate roster limit
    if (saveData.state.progress && typeof saveData.state.progress.rosterLimit !== 'number') {
        errors.push('state.progress.rosterLimit must be a number');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Create a fresh initial state with current timestamp
 * @returns {Object} New game state
 */
export function createInitialState() {
    const state = structuredClone(INITIAL_STATE);
    state.meta.createdAt = Date.now();
    state.time.lastTickAt = Date.now();
    return state;
}
