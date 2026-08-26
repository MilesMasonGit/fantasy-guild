// Fantasy Guild - State Schema
// Phase 5: State Foundation

/**
 * StateSchema - Defines initial state and validation for game data
 */

/**
 * Save schema version, deliberately decoupled from the app version in
 * package.json. It names the app version at which the save *structure* last
 * changed, so it only moves when saves genuinely break.
 *
 * '0.2.0' — the Area Deck Loop rework.
 * '0.4.0' — the Hero Dock rework: `state.bench` is removed entirely (the
 *           roster is the whole roster now), and hero equipment moves from two
 *           slots to six. Old saves are refused rather than migrated, matching
 *           the deck-loop precedent (hero_dock_roadmap_v1.md D7 / Phase 0).
 * '0.6.0' — the 7×7 Playmat rework (D-110). Nothing meaningful maps across:
 *           cards become Tokens carrying board state, areas cease to exist
 *           entirely, and heroes lose their area binding. Refused, not
 *           migrated — see playmat_roadmap_v1.md Phase 0 §C.
 * '0.7.0' — the Skill & Class rework (D-253). A hero's shape changes
 *           fundamentally: they hold 6 of 27 skills instead of all 15, six
 *           skill ids are deleted outright, `defense` folds into the single
 *           combat skill, and every hero gains a job. A migration would
 *           produce nonsense heroes, so old saves are refused — see
 *           skill_class_rework_roadmap_v1.md Phase 0.
 */
export const GAME_VERSION = '0.7.0';

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
    // The roster is the whole roster — there is no bench (Hero Dock Phase 3).
    // `progress.rosterLimit` caps it, and recruiting is refused at the cap.
    heroes: [],    // Array of hero objects

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
        maxStack: 1e12,   // see DEFAULT_MAX_STACK in itemRegistry.js
        maxStackBonus: 0,  // Added from projects (inventory_slots/max_stack chains)
        items: {},        // { itemId: { quantity, durabilities? } }
        // Bank tabs. Extra entries are added ONLY by
        // GuildUpgradeManager._ensureBankTabs when the `bank_tabs` upgrade
        // raises maxTabs, and are named 'bank-tab-2', 'bank-tab-3', … There
        // are no player-created tabs (owner ruling 2026-08-25, CR2-089).
        groupOrder: ['default-loot'],   // ['default-loot', 'bank-tab-2', …]
        groupDefs: {
            // `isCustom` is inert: always false now, kept so old saves load.
            'default-loot': { title: 'Loot', isCustom: false, id: 'default-loot', orderedItems: [] }
        },
        itemOverrides: {} // itemId -> groupId: { 'item_apple': 'bank-tab-2' }
    },

    // === Currency ===
    currency: {
        gold: 0,        // Starting gold
        // Inert. Influence was the recruitment currency; it could be earned but
        // never spent, and was cut (owner decision 2026-08-19, CR2-093).
        // Nothing reads or writes it; kept so existing saves load.
        influence: 10,
        // Inert. It fed the recruit-cost formula, which went with the
        // retirement/recruit-purchasing retirement (owner decision 2026-08-19,
        // CR2-086). Nothing reads or writes it; kept so existing saves load.
        totalRecruits: 0
    },

    // === Progress ===
    // The Projects system is retired (owner decision 2026-07-17, CR-038) —
    // the Guild Hall upgrade tree (progress.guildUpgrades, created by
    // GuildUpgradeManager) is its replacement. Old saves may still carry
    // completedProjects/projects/chainProgress/modifiers; they load as
    // ignored extra fields.
    progress: {
        rosterLimit: 0, // Active roster capacity (matches roster_size rank, starts at 0, max 12)
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


    // === Collection ===
    // The card-ownership half of this section is retired with the deck loop
    // (binders, universals, playsets, mastery, pack purchases). It is left in
    // place, empty, rather than removed: `validateSaveData` below still checks
    // the shapes, and the dormant quest system still reads `unlockedAreaSets`
    // (roadmap G-9). It goes when quests are resolved.
    //
    // What SURVIVES here is the discovery/statistics half, which is not
    // area-scoped and which the board still feeds.
    collection: {
        binders: {},             // retired — per-area card ownership (D-3)
        universals: {},          // retired — the Universal Bucket (D-46)
        playsets: {},            // retired — global card ownership
        mastery: {},             // retired — playset completion bonuses
        unlockedAreaSets: ['area_guild_hall'],  // vestigial; read only by dormant quests
        areaPacksBought: {},     // retired — the pack economy (D-153)
        pendingPackAreaId: null,
        pendingPackOptions: [],

        // --- Live ---
        discoveredItems: {},     // { [itemId]: true }
        discoveredEnemies: {},   // { [enemyId]: true }
        itemLifetimeCounts: {},  // { [itemId]: number }
        enemyKillCounts: {},     // { [enemyId]: number }
        cardUseCounts: {},       // { [typeId]: number } — completed cycles per Token type
        provenance: {}           // { [sourceId]: { [itemId]: true } }
    },

    // === UI State (Transient Focus) ===
    ui: {
        newDiscoveries: {}               // { [id]: true } - IDs with active "New!" badges
    },

    // === The Board (7×7 playmat) ===
    //   tiles       { [index 0-48]: { typeId, usesRemaining, cycleElapsedMs } }
    //   heroTiles   { [heroId]: index }     where each hero STANDS (Phase 7)
    //   vacancies   { [index]: { typeId, unstocked } }   tiles that ran dry
    //   tokenBank   { [typeId]: [{ usesRemaining }, ...] }  capped by DISTINCT types (D-137)
    //   tokenBankSlots  number              derived from the Storage upgrade track
    //   tray        [ { typeId, usesRemaining }, ... ]   ~15-20 slots (D-168)
    //   sprites     [ ... ]                 loot on the floor (D-40), added Phase 3
    //
    // Index 24 is the permanent Guild Hall and is never placeable (D-106).
    //
    // ⚠️ **`heroTiles` is a hero's position, and it is the only copy.** It used
    // to be a `heroId` field on the Token instance, which meant a hero could not
    // outlive the Token they stood on — see `BoardState.tileOfHero`. A hero with
    // no entry here is in the Dock; the Dock is still not a data structure.
    board: {
        tiles: {},
        heroTiles: {},
        vacancies: {},
        tokenBank: {},
        tray: [],
        maps: []
    },

    // === Quests (Phase 8 Quests & Tutorial Chain) ===
    quests: {
        active: [],
        tutorialStep: 0,
        nextQuestAt: null
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

        // Per-area binders (D-3): { areaId: { templateId: count } }.
        const binders = saveData.state.collection.binders;
        if (binders !== undefined) {
            if (typeof binders !== 'object' || Array.isArray(binders)) {
                errors.push('state.collection.binders must be an object');
            } else {
                for (const [areaId, binder] of Object.entries(binders)) {
                    if (typeof binder !== 'object' || Array.isArray(binder)) {
                        errors.push(`state.collection.binders.${areaId} must be an object`);
                        continue;
                    }
                    for (const [templateId, count] of Object.entries(binder)) {
                        if (typeof count !== 'number' || count < 0 || count > 4) {
                            errors.push(`state.collection.binders.${areaId}.${templateId} must be a number between 0 and 4`);
                        }
                    }
                }
            }
        }
    }

    // The areaStates validation block is removed with areas. Board state
    // validation (tiles, tokenBank, tray) lands with Phase 2.

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
