// Fantasy Guild - State Schema
// Phase 5: State Foundation

/**
 * StateSchema - Defines initial state and validation for game data
 */

/**
 * Game version for save migration
 */
export const GAME_VERSION = '1.0.0';

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

    // === Cards ===
    cards: {
        active: [],      // Cards currently in play
        completed: [],   // Recently completed (for animation/display)
        idCounter: 1,    // Counter for generating unique card IDs
        limits: {
            max: 999,  // High limit for development
            currentCount: 1
        }
    },

    // === Inventory ===
    inventory: {
        slots: {
            max: 20,
            used: 0
        },
        maxStack: 50,
        maxStackBonus: 0,  // Added from projects (inventory_slots/max_stack chains)
        items: {},        // { itemId: { quantity, durabilities? } }
        groups: [
            { id: 'loot', name: 'Loot', items: [], collapsed: false }
        ]
    },

    // === Currency ===
    currency: {
        influence: 10,  // Starting: 1 T1 project @ 10
        totalRecruits: 0  // Tracks number of completed recruitments (cost increases +2 per)
    },

    // === Progress ===
    progress: {
        completedProjects: [],
        // Track highest completed tier per chain (0 = none completed)
        chainProgress: {
            recruiting: 0,
            inventory_slots: 0,
            max_stack: 0,
            mining_fortune: 0,
            logging_fortune: 0
        },
        unlockedRarities: ['common', 'uncommon'],
        unlockedBiomes: ['forest', 'mountain', 'farmland', 'village'],
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

    // === Exploration (Region/Biome progress) ===
    exploration: {
        count: 0  // Global exploration count for cost scaling
    },

    // === Library (Discovered content for crafting) ===
    library: {
        tasks: []       // Discovered task templateIds: ['logging', 'mining', ...]
    }
};

/**
 * List of all required top-level state keys
 */
const REQUIRED_KEYS = [
    'meta', 'settings', 'heroes', 'cards', 'library',
    'inventory', 'currency', 'progress', 'threats', 'time'
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
    }

    // Validate inventory structure
    if (saveData.state.inventory) {
        if (typeof saveData.state.inventory.items !== 'object') {
            errors.push('state.inventory.items must be an object');
        }
        if (!Array.isArray(saveData.state.inventory.groups)) {
            errors.push('state.inventory.groups must be an array');
        }
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
