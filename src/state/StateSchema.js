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
 * The board's default shape, in one place.
 *
 * There used to be three disagreeing copies of this — `INITIAL_STATE.board`,
 * `BoardState.board()` and `SpriteLayer.sprites()` — and no two listed the same
 * fields (CR2-049). Both helpers now call this, so "what is an empty board"
 * has a single answer.
 *
 * See the `board` comment in INITIAL_STATE below for what each field holds.
 */
export function createEmptyBoard() {
    return {
        tiles: {},
        heroTiles: {},
        vacancies: {},
        tokenBank: {},
        tray: [],
        maps: [],
        sprites: [],
        // Monotonic z-index handed out by `BoardState.nextTrayZ()` so the Token
        // picked up last sits on top of the Tray pile. Persisted, so the pile
        // keeps its stacking order across a reload.
        nextTrayZ: 0,
        // Recomputed from the Guild Hall ranks by GuildUpgradeManager.recompute()
        // on every load; TokenBank.slotCap() falls back to its own base if this
        // is still null.
        tokenBankSlots: null,
        // Likewise rank-derived (1 + token_bank_tabs). TokenGroups.unlockedCount()
        // floors it at TOKEN_TAB_FREE.
        tokenTabsUnlocked: 1,
        // The Token Vault's tabs. Shape is owned by `TokenGroups.makeDefault()`
        // and built on first read, deliberately — declaring it here would be a
        // second copy of that shape. Null means "not opened yet".
        tokenGroups: null
    };
}

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
    // ⚠️ A hero's own shape is NOT declared here — it is owned by
    // `HeroGenerator` (creation) and `HeroRehydration` (load). Fields that only
    // appear on some heroes are saved with them, notably
    // `woundedRemainingMs` (WoundedSystem's recovery countdown; null once
    // recovered, absent on a hero who has never been wounded) and its legacy
    // predecessor `woundedUntil`, which is still carried by every hero in the
    // owner's real saves and is converted on the first wounded tick.
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
        // Inert. Nothing reads `slots.max` or `slots.used` anywhere in the game
        // or the CMS — the live cap is `maxSlots` below and usage is counted on
        // demand. Kept declared so old saves carrying it still load.
        slots: {
            max: 20,
            used: 0
        },
        // Bank capacity, both rank-derived: GuildUpgradeManager.recompute()
        // rewrites them on every load (1 + bank_tabs, 64 + bank_slots·32).
        // These are the starting values, i.e. rank 0.
        maxTabs: 1,
        maxSlots: 64,
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
        discoveredTasksByBiome: {},
        // Guild Hall upgrade ranks: { upgradeId: rank }. Owned by
        // GuildUpgradeManager, which derives rosterLimit, the bank caps and the
        // Token Vault caps from it on every load.
        guildUpgrades: {},
        // Which Maps the player has seen drop from a burst (Cartographer's
        // silhouettes): { mapId: true }.
        mapDiscoveries: {},
        // How many Maps have been opened at the Guild Hall. It is the index into
        // GUILD_HALL_DROP_SEQUENCE, so losing it restarts the scripted opening
        // drops from the beginning.
        guildHallMapOpens: 0
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
    // place, empty, rather than removed, because **it is part of the shape a
    // save is written in** — the same reason `totalRecruits`, `influence` and
    // `dur` are still here. Inert fields stay; removing one changes what an
    // existing save round-trips to, for no gain.
    //
    // ⚠️ Corrected 2026-08-26 (CR2-108 sweep). This note used to give two
    // reasons that were both true once and are both false now: the card-shape
    // checks in `validateSaveData` were deleted with CR2-043 (see the note at
    // its old site below), and **nothing anywhere reads `unlockedAreaSets`** —
    // the dormant quest system does not, and neither does anything else in
    // `src/` or `cms/src/`. Verified by search, not by reading this comment.
    //
    // What SURVIVES here is the discovery/statistics half, which is not
    // area-scoped and which the board still feeds.
    collection: {
        binders: {},             // retired — per-area card ownership (D-3)
        universals: {},          // retired — the Universal Bucket (D-46)
        playsets: {},            // retired — global card ownership
        mastery: {},             // retired — playset completion bonuses
        unlockedAreaSets: ['area_guild_hall'],  // inert — written into saves, read by nothing
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
    //   nextTrayZ   number                  Tray stacking counter
    //   tokenTabsUnlocked  number           derived from the Token tabs upgrade
    //   tokenGroups { groupOrder, groupDefs, overrides }  the Vault's tabs
    //
    // Index 24 is the permanent Guild Hall and is never placeable (D-106).
    //
    // ⚠️ **`heroTiles` is a hero's position, and it is the only copy.** It used
    // to be a `heroId` field on the Token instance, which meant a hero could not
    // outlive the Token they stood on — see `BoardState.tileOfHero`. A hero with
    // no entry here is in the Dock; the Dock is still not a data structure.
    board: createEmptyBoard(),

    // === Quests (Phase 8 Quests & Tutorial Chain) ===
    quests: {
        active: [],
        // The tutorial quests already finished. `tutorialStep` is derived from
        // its length by `QuestManager.ensureState()` on every load — this list
        // is the record, the step number is the summary.
        completedTutorials: [],
        tutorialStep: 0,
        nextQuestAt: null
    },

    // === Cartographer (Maps) ===
    // Which Maps have been bought, which unlocks their bounties. Written by
    // `Cartographer.buyMap`; the discovery half lives in
    // `progress.mapDiscoveries`.
    cartographer: {
        purchasedMaps: []
    }
};

/**
 * List of all required top-level state keys.
 *
 * `board` and `quests` are the two sections this game is actually made of — the
 * 7×7 playmat and the tutorial chain — and neither was listed until CR2-043.
 * `migrateState` runs before this check and backfills any wholly-missing
 * top-level section from INITIAL_STATE, so requiring them cannot reject a save
 * that merely predates them.
 *
 * `cards` is kept only because saves still carry it; it now holds one unused
 * id counter.
 */
const REQUIRED_KEYS = [
    'meta', 'heroes', 'cards',
    'inventory', 'currency', 'progress', 'time',
    'collection', 'board', 'quests'
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

    // The card-ownership validation that used to live here — ~30 lines
    // enforcing that `collection.playsets` and `collection.binders` were maps
    // of counts between 0 and 4 — was deleted with CR2-043. Playsets, binders,
    // areas and cards are all retired; the fields survive as inert empty
    // objects (see `collection` above) and nothing can put counts in them.

    // The areaStates validation block was removed with areas. There is
    // deliberately no deep board check: `migrateState` now backfills a
    // section's missing fields before this runs, so a shape check here could
    // never fire.

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
