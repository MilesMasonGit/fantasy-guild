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
 * '0.8.0' — Free Playmat slice 1.6a (FP-85). Tokens are stored by instance id
 *           at a point on the mat (`board.tokens`), not by tile, vacancies by
 *           the spot that ran dry, and the terrain fields leave the board.
 *           (Vacancies went again with the Managers, Token Lifecycle 9.2: an
 *           older save's `board.vacancies` is dropped on load, no bump; likewise
 *           the Token Vault and Tray fields, Token Lifecycle 9.3.) Old
 *           saves are refused through the existing version check — no message
 *           of their own, no export, no conversion.
 * '0.8.1' — the Atlas: a save holds every Region the guild has settled
 *           (`atlas`), each with its own board. A pre-Atlas save is refused, not
 *           carried over as a first Region.
 */
export const GAME_VERSION = '0.8.1';

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
        // Every Token on the mat, keyed by instance id; each carries its own
        // point `x`, `y` (mat units) and `placedAt` (Free Playmat 1.6a).
        tokens: {},
        // Counter behind each Token's `placedAt` — the order Tokens arrived in.
        nextTokenOrder: 0,
        // Each hero's order, keyed by hero id, saved as their flag record: pinned
        // to a Token (`pinnedTo`), or a spot to idle at (`spot`). A hero with no
        // record waits at the Guild Hall. Which Token a flag works is runtime,
        // except the note below of work a hero had reached (`workClaims`, HM-7).
        flags: {},
        // 1: this board's flags are orders. A board from an older save has none
        // and is brought over as it loads (`SaveMigration.migrateStateToOrders`).
        orders: 1,
        // Counter behind each flag's `plantedAt` — the order flags choose in.
        nextFlagOrder: 0,
        // Which Token each hero had REACHED and was working, and from which
        // side: `{ heroId: { instanceId, side } }` (Hero Movement M5, HM-7,
        // amending FP-58). On load a hero here stands back at that Token and
        // carries on; everyone else starts beside their flag. Written by
        // `BoardState` on arrival, erased when the hero lets go.
        workClaims: {},
        sprites: [],
        // 1 once `EnemyMotion.attachUntethered` has run on this board, so an
        // enemy placed by hand later is never tethered by a reload. 0 reads as
        // not yet, exactly as a missing field did.
        enemyTethers: 0,
        // `tokenBank`, `tray`, `nextTrayZ`, `tokenBankSlots`, `tokenTabsUnlocked`
        // and `tokenGroups` went with the Token Vault and the Tray (Token
        // Lifecycle 9.3): Tokens live on the mat. `migrateState` drops them
        // from an older save.

        // No ground on the board: a Region's ground is its stored cell map
        // (`region.terrain`), drawn by `TerrainCanvas`.
    };
}

/**
 * One Region of the Atlas, as saved in `atlas.regions[id]`. `Atlas.js` owns the rules; this is the
 * shape.
 */
export function createRegionRecord(id = null) {
    return {
        id,
        // 'starter' (the board a new game opens on; never abandoned) or 'settled' (written from maps).
        kind: 'settled',
        // Made from the ingredients when the Region is written; never changes.
        practicalName: '',
        // Generated, then the player's to rename.
        flavourName: '',
        // The item ids written into it, in slot order.
        ingredients: [],
        // The seed its layout was settled with.
        seed: 0,
        // Biome weights, `{ forest: 1, mountain: 1 }`: how many of its Base Maps were of each biome.
        // Null for a Region no map wrote.
        biome: null,
        // Its ground as the maps describe it (`Budget.budget().ground`): `{ main, terrains, water,
        // shore }`. Null for a Region no map wrote.
        ground: null,
        // The terrain grid under it, as `TerrainMap.encodeTerrain` stores it (read with
        // `terrainAt`). Null for a Region no map wrote.
        terrain: null,
        // Region-wide rules, in force only while the guild is here (`RegionRules.js`).
        rules: [],
        // Game time (ms) it was written at.
        settledAt: 0,
        // Hidden from the Region list.
        archived: false,
        // ⚠️ Null for the Region the guild is in: its board is the live `state.board`. Every other
        // Region keeps its whole board here, frozen, as a save would write it.
        board: null,
        // Where the Hall and the quest Tokens stood when the guild left, by instance id
        // (`{ x, y, placedAt }`), so going back puts them where they were.
        travellers: {}
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
        // rewrites them on every load (1 + bank_tabs, 64 per tab).
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
    // Deleted with the gold code (Token Lifecycle 9.4, SP-65). Gold, and the
    // inert `influence` and `totalRecruits` beside it, left the save; an older
    // save's `currency` section is dropped by `migrateState`.

    // === Progress ===
    // The Projects system is retired (owner decision 2026-07-17, CR-038) —
    // the Guild Hall upgrade tree (progress.guildUpgrades, created by
    // GuildUpgradeManager) is its replacement. Old saves may still carry
    // completedProjects/projects/chainProgress/modifiers; they load as
    // ignored extra fields.
    progress: {
        rosterLimit: 0, // Active roster capacity (matches roster_size rank, starts at 0, max 8 — ROSTER_MAX)
        unlockedRarities: ['common', 'uncommon'],
        // Per-biome task discovery: { biomeId: ['task1', 'task2', ...] }
        discoveredTasksByBiome: {},
        // Guild Hall upgrade ranks: { upgradeId: rank }. Owned by
        // GuildUpgradeManager, which derives rosterLimit and the bank caps
        // from it on every load. (The Token Vault tracks went in Token
        // Lifecycle 9.3; `migrateState` drops their ranks.)
        guildUpgrades: {}
        // `mapDiscoveries` and `guildHallMapOpens` went with the Map bursts
        // (Token Lifecycle 9.1); `migrateState` drops them from an older save.
    },

    // === Time ===
    time: {
        gameTimeMs: 0
    },


    // === Collection ===
    // Discovery and statistics. An older save may still carry the retired
    // card-ownership fields (binders, playsets, packs…); `migrateState` only
    // back-fills missing keys, so they ride along unread.
    collection: {
        discoveredItems: {},     // { [itemId]: true }
        discoveredEnemies: {},   // { [enemyId]: true }
        itemLifetimeCounts: {},  // { [itemId]: number }
        enemyKillCounts: {},     // { [enemyId]: number }
        cardUseCounts: {},       // { [typeId]: number } — completed cycles per Token type
        provenance: {}           // { [sourceId]: { [itemId]: true } }
    },

    // === UI State (Transient Focus) ===
    ui: {
        newDiscoveries: {},              // { [id]: true } - IDs with active "New!" badges
        pinnedStubs: []                  // [{ itemId, added, removed }] - pinned item stubs, counting since pinned
    },

    // === The Board (the playmat) ===
    //   tokens      { [id]: { id, typeId, x, y, placedAt, usesRemaining, cycleElapsedMs, selectedRecipeId? } }  (Free Playmat 1.6a)
    //               + origin 'placed'|'spawned' (absent reads as placed), clocks? { growMs, turnMs, turnWon?, ... },
    //                 turnedFrom? typeId  (Token Lifecycle 3.1 / 3.2, roadmap §3.1),
    //                 fixture? true and biome? string on a node a map wrote, fixture? 'camp' on a Token the Starter Camp laid (`BoardState.isFixture`),
    //                 demolish? true on a Token marked for demolition (`Demolition.js`; its progress is cycleElapsedMs),
    //                 field? { cropId?, load?, full? } on a Field: the crop in its ground and the harvests left (`Fields.js`; its growth on clocks.fieldMs)
    //   nextTokenOrder number               the next Token's placedAt
    //   flags       { [heroId]: { x, y, plantedAt, pinnedTo?, spot?, needsJob? } }  each hero's order: pinnedTo = the Token instance id it
    //                 works; spot = a point to idle at; needsJob = the ordered Token is gone for good. Neither: an old area flag (tests only)
    //   orders      1                       the flags are orders (an older save's board is migrated as it loads, `SaveMigration.migrateStateToOrders`)
    //   nextFlagOrder number                the next flag's plantedAt
    //   sprites     [ ... ]                 item loot on the floor (D-40), added Phase 3;
    //                                       no Token sprites since Token Lifecycle 9.3
    //
    // ⚠️ **`flags` is a hero's place on the board, and it is the only copy.**
    // Which Token a flag works is a runtime claim; the save keeps only
    // `workClaims`, a note of work a hero had reached, so a reload can put them
    // back at it (Hero Movement M5, HM-7, amending FP-58). A hero with no flag
    // is in the Dock; the Dock is still not a data structure.
    board: createEmptyBoard(),

    // === Quests (Phase 8 Quests & Tutorial Chain) ===
    quests: {
        active: [],
        // The tutorial quests already finished. `tutorialStep` is derived from
        // its length by `QuestManager.ensureState()` on every load — this list
        // is the record, the step number is the summary.
        completedTutorials: [],
        tutorialStep: 0,
        // The bounty clock in game ms (B6.1, TL-18): advanced by the tick's
        // `delta` while fewer bounty quest Tokens than the cap are on the mat.
        // The quests themselves are Tokens (`instance.quest`); `active` above
        // only holds an older save's sidebar quests until they are converted.
        clockMs: 0,
        nextQuestAt: null
    },

    // === The Atlas (Regions) ===
    // `board` above is always the active Region's board; every other Region is a record here
    // (`createRegionRecord`) holding its own frozen board. Owned by `Atlas.js`.
    atlas: {
        activeRegionId: null,
        // Region ids are `region_<n>`, never reused, so an abandoned Region's id stays dead.
        nextRegionNumber: 1,
        regions: {},
        // The guild's layout seed: each new Cartography preview steps it and lays out with the
        // result, so layouts vary without the game ever drawing from `Math.random`. Null until the
        // first preview, which starts it from `meta.createdAt`.
        seed: null
    },

    // === Cartographer (Maps) ===
    // Deleted with the Map bursts and the Map purchase (Token Lifecycle 9.1).
    // An older save's `cartographer` section is dropped by `migrateState`.
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
    'inventory', 'progress', 'time',
    'collection', 'board', 'quests', 'atlas'
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
    return state;
}
