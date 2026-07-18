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

    // (No `settings` section: player settings are device-local and owned by
    // SettingsManager/localStorage. The drifted duplicate that used to live
    // here was removed in the code-review Wave 5 sweep — CR-011.)

    // === Heroes ===
    heroes: [],    // Array of hero objects
    bench: [],     // Array of benched hero objects

    // === Recruitment (Phase 7 drawer flow) ===
    // Candidates persist so players can't reroll for free by reopening the
    // drawer — same lock the legacy board recruit card provided.
    recruitment: {
        candidates: []   // up to 3 generated hero blobs awaiting a hire pick
    },

    cards: {
        idCounter: 1     // Counter for generating unique card IDs (ephemeral loop cards)
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
    // The Projects system is retired (owner decision 2026-07-17, CR-038) —
    // the Guild Hall upgrade tree (progress.guildUpgrades, created by
    // GuildUpgradeManager) is its replacement. Old saves may still carry
    // completedProjects/projects/chainProgress/modifiers; they load as
    // ignored extra fields.
    progress: {
        rosterLimit: 5, // Active roster capacity
        unlockedRarities: ['common', 'uncommon'],
        // Per-biome task discovery: { biomeId: ['task1', 'task2', ...] }
        discoveredTasksByBiome: {}
    },

    // === Time ===
    time: {
        gameTimeMs: 0,
        lastTickAt: null,
        isPaused: false,
        // Time Bank (Phase 8): milliseconds of time saved while offline, spent
        // by fast-forwarding the live engine. Capped at TIME_BANK.MAX_MS.
        timeBankMs: 0
    },


    // === Collection (Booster Pack system) ===
    collection: {
        // `playsets` is the single source of truth for card ownership
        // (Phase 2 §2A decision — the planned `ownedCards` structure was
        // dropped in favor of this existing one).
        playsets: {},           // { [templateId]: count (0-4) }
        mastery: {},            // { [templateId]: true } — set when playset reaches 4/4
        unlockedAreaSets: ['area_guild_hall'],  // Starting area
        globalPacksBought: 0,   // unified pack cost scaling (Phase 5 §5F)
        discoveredItems: {},     // { [itemId]: true }
        discoveredEnemies: {},   // { [enemyId]: true }
        itemLifetimeCounts: {},  // { [itemId]: number }
        enemyKillCounts: {},     // { [enemyId]: number }
        cardUseCounts: {},       // { [templateId]: number } — completed loop actions / crafts (Phase 7 binder stats)
        provenance: {},          // { [sourceId]: { [itemId]: true } }
        // Options from a bought-but-unclaimed booster pack; the gold is
        // already spent, so these survive a reload (CR-040).
        pendingPackOptions: [],
    },

    // (No `mapFragments`: fragments were retired by Quest System v2 — the
    // quest boards own area unlocking now. Removed in Wave 5, CR-037.)

    // === UI State (Transient Focus) ===
    // The single "active area" concept was retired with the deck loop
    // (owner decision 2026-07-17, CR-005) — all unlocked areas render at
    // once. A future show/hide-areas toggle gets its own state shape.
    ui: {
        newDiscoveries: {}               // { [id]: true } - IDs with active "New!" badges
    },

    // === Area States (per-area deck loop state, built lazily) ===
    areaStates: {
        // Populated at runtime by ensureAreaState().
        // Shape: { [areaId]: AreaStateObject }
    }
};

/**
 * List of all required top-level state keys
 */
const REQUIRED_KEYS = [
    'meta', 'heroes', 'cards',
    'inventory', 'currency', 'progress', 'time',
    'collection'
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

    // Check required state keys. A null/undefined section counts as missing:
    // it passes `in` but crashes everything downstream, and the shape checks
    // below all skip falsy values (found by the CR-008 wiring tests).
    for (const key of REQUIRED_KEYS) {
        if (!(key in saveData.state)) {
            errors.push(`Missing state.${key}`);
        } else if (saveData.state[key] === null || saveData.state[key] === undefined) {
            errors.push(`state.${key} is null`);
        }
    }

    // Validate heroes array
    if (saveData.state.heroes && !Array.isArray(saveData.state.heroes)) {
        errors.push('state.heroes must be an array');
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

    // Validate areaStates structure (if present)
    if (saveData.state.areaStates) {
        if (typeof saveData.state.areaStates !== 'object') {
            errors.push('state.areaStates must be an object');
        } else {
            for (const [areaId, areaState] of Object.entries(saveData.state.areaStates)) {
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
